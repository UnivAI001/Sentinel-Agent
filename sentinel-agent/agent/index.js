import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { analyzeEmail } from './analyze.js';
import { decideSeverity } from './decide.js';
import { respondToThreat } from './respond.js';
import { generateReport } from './report.js';
import { insertScan, insertIncident, verifyUserToken } from '../lib/supabase.js';

const app = express();
app.use(cors({ origin: '*' })); // Allow extension origin
app.use(express.json({ limit: '10mb' })); // Support large extracted emails

// --- SSE Setup for Dashboard ---
let clients = [];

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const id = req.query.id; // optional
  const clientObj = { id, res };
  clients.push(clientObj);

  req.on('close', () => {
    clients = clients.filter(client => client !== clientObj);
  });
});

function broadcast(event, data, targetId = null) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    // If targetId provided, only send to matching specific client ID OR clients listening globally (null ID)
    if (!targetId || client.id === targetId || !client.id) {
      client.res.write(payload);
    }
  });
}
// ------------------------------

app.post('/api/analyze', async (req, res) => {
  const email = req.body;
  if (!email || !email.bodyText) {
    return res.status(400).json({ error: 'Invalid email payload' });
  }

  // Auth Extraction
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  let authUser = null;

  try {
    authUser = await verifyUserToken(token);
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }

  const emailId = email.scanId || 'ext_' + Date.now();
  
  // Format the email struct for the pipeline
  const pipelineEmail = {
    id: emailId,
    subject: email.subject || 'Unknown Subject',
    sender: email.sender || 'Unknown Sender',
    bodyText: email.bodyText,
    urls: email.links ? email.links.map(l => l.url) : [],
    images: email.images || [],
    receivedAt: new Date().toISOString()
  };

  try {
    console.log(`\n─── Processing Request via Extension: "${pipelineEmail.subject}" ───`);
    broadcast('scan_start', { subject: pipelineEmail.subject, sender: pipelineEmail.sender }, emailId);

    // Stage 2: Scanning
    console.log('  🔍 Scanning URLs/Attachments...');
    broadcast('scan_progress', { step: 'scanning', status: 'Extracting and sandboxing URLs...' }, emailId);
    const scanResults = null; // Sync playwight would go here, skipping for MVP/speed.

    // Stage 3: Qwen AI Analysis
    console.log('  🤖 Running Qwen Analysis...');
    broadcast('scan_progress', { step: 'analyzing', status: 'Ai reasoning via Qwen taking place...' }, emailId);
    const analysis = await analyzeEmail(pipelineEmail, scanResults);
    
    // Stage 4: Severity Decision
    console.log('  ⚖️ Deciding Severity...');
    broadcast('scan_progress', { step: 'deciding', status: 'Determining severity and historical rules...' }, emailId);
    const decision = await decideSeverity(pipelineEmail, analysis);

    // Save to Database
    console.log('  💾 Saving to Database...');
    broadcast('scan_progress', { step: 'saving', status: 'Saving scan to Supabase...' }, emailId);
    
    // Use the new "scans" schema linked to the user's ID
    const scanRecord = await insertScan({
      user_id: authUser.id,
      sender: pipelineEmail.sender,
      subject: pipelineEmail.subject,
      verdict: analysis.threatType,
      severity: decision.severity,
      confidence: (analysis.confidence || 15) / 100,
      reasoning: analysis.shortReason || decision.reason,
      link_count: pipelineEmail.urls.length,
      metadata: { full_reasoning: analysis.reasoning, indicators: analysis.indicators }
    });

    // Stage 5 & 6 (Async so we don't block response, mapped to scanRecord instead of incident)
    respondToThreat(scanRecord.id, pipelineEmail, analysis, decision).catch(console.error);
    generateReport(scanRecord.id, pipelineEmail, analysis, decision).catch(console.error);

    // Broadcast Complete to Dashboard
    broadcast('scan_complete', { 
      incidentId: scanRecord.id, 
      severity: decision.severity,
      threatType: analysis.threatType
    }, emailId);

    // Return JSON to Extension
    res.json({
      severity: decision.severity,
      shortReason: analysis.shortReason || decision.reason,
      reasoning: analysis.reasoning,
      threatType: analysis.threatType,
      confidence: analysis.confidence || 15
    });

    console.log(`  ✅ Pipeline complete for request.\n`);

  } catch (err) {
    console.error('❌ Pipeline Error:', err);
    broadcast('scan_error', { message: err.message }, emailId);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n================================`);
  console.log(`🚀 Sentinel Backend running`);
  console.log(`📡 API & SSE listening on port ${PORT}`);
  console.log(`================================\n`);
});
