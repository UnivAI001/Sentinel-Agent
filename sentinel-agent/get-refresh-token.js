/**
 * Gmail OAuth2 Refresh Token Generator
 * 
 * This script opens a browser window for you to log into Google,
 * grant permission, and then gives you a refresh token to paste into .env
 * 
 * Run: node get-refresh-token.js
 */

import { google } from 'googleapis';
import http from 'http';
import open from 'open';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Gmail scopes we need: read emails
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

console.log('\n═══════════════════════════════════════════');
console.log('  🔑 Gmail OAuth2 — Refresh Token Generator');
console.log('═══════════════════════════════════════════\n');
console.log('A browser window will open. Log in with the Gmail account');
console.log('you want Sentinel Agent to monitor, and click "Allow".\n');

// Start a tiny local server to catch the callback
const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) return;

  const url = new URL(req.url, 'http://localhost:3333');
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('No authorization code received.');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; background: #0a0a0f; color: #f1f5f9; text-align: center;">
          <h1>✅ Success!</h1>
          <p>Refresh token generated. You can close this window and go back to your terminal.</p>
        </body>
      </html>
    `);

    console.log('\n✅ SUCCESS! Here is your refresh token:\n');
    console.log('─────────────────────────────────────────');
    console.log(tokens.refresh_token);
    console.log('─────────────────────────────────────────\n');
    console.log('👉 Copy the token above and paste it into your .env file as:');
    console.log(`   GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);

    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500);
    res.end('Error exchanging code for tokens.');
    console.error('❌ Error:', err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(3333, async () => {
  console.log('🌐 Opening browser...\n');
  try {
    await open(authUrl);
  } catch {
    console.log('Could not auto-open browser. Please open this URL manually:\n');
    console.log(authUrl);
    console.log('');
  }
});
