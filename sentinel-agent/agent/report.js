import { updateIncident } from '../lib/supabase.js';
import { queryQwenFlash } from '../lib/qwen.js';

const REPORT_SYSTEM_PROMPT = `You are a security incident report writer. Given the threat analysis data, generate a concise but comprehensive incident report summary.

Respond with a JSON object:
{
  "title": "Short incident title",
  "summary": "2-3 sentence executive summary",
  "technicalDetails": "Technical findings and evidence",
  "recommendedActions": ["list of recommended follow-up actions"],
  "riskAssessment": "Brief risk assessment for the organization"
}`;

/**
 * Generate a structured incident report using Qwen and save to Supabase.
 */
export async function generateReport(incidentId, email, analysis, decision) {
  console.log('📄 Generating incident report...');

  const userPrompt = `Generate an incident report for:
Email From: ${email.sender}
Subject: ${email.subject}
Threat Type: ${analysis.threatType}
Confidence: ${analysis.confidence}
Severity: ${decision.severity}
Indicators: ${analysis.indicators.join(', ')}
AI Reasoning: ${analysis.reasoning}
Decision Reason: ${decision.reason}`;

  // Use the cheap/fast model for report generation
  const report = await queryQwenFlash(REPORT_SYSTEM_PROMPT, userPrompt);

  // Save report to the incident record
  await updateIncident(incidentId, {
    report_title: report.title || `Incident: ${analysis.threatType}`,
    report_summary: report.summary || analysis.reasoning,
    report_details: JSON.stringify(report),
  });

  console.log(`  📋 Report saved: ${report.title || 'Untitled'}`);
  return report;
}
