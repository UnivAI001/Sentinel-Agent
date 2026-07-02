import { getSenderHistory } from '../lib/supabase.js';

/**
 * Determine severity based on Qwen's analysis + historical sender data.
 * Returns: { severity, reason, autoAction }
 */
export async function decideSeverity(email, analysis) {
  console.log('⚖️  Deciding severity...');

  const history = await getSenderHistory(email.sender);

  let severity = 'LOW';
  let reason = '';
  let autoAction = 'log_only';

  // ─── CRITICAL ────────────────────────────────────────
  // Malware, confirmed credential harvesting, or executable attachments
  if (
    analysis.threatType === 'malware' ||
    (analysis.confidence >= 0.9 && analysis.threatType === 'phishing' && analysis.indicators.includes('credential_harvesting'))
  ) {
    severity = 'CRITICAL';
    reason = `Confirmed ${analysis.threatType} with high confidence (${analysis.confidence}). ${analysis.reasoning}`;
    autoAction = 'pause_and_alert';
  }
  // Check for dangerous attachment types
  else if (hasExecutableAttachments(email)) {
    severity = 'CRITICAL';
    reason = 'Email contains executable/archive attachment — never opened, immediately flagged.';
    autoAction = 'pause_and_alert';
  }

  // ─── HIGH ────────────────────────────────────────────
  // Confirmed spoofing, suspicious links, brand impersonation
  else if (
    analysis.threatType === 'spoofing' ||
    analysis.threatType === 'brand_impersonation' ||
    (analysis.threatType === 'phishing' && analysis.confidence >= 0.7)
  ) {
    severity = 'HIGH';
    reason = `${analysis.threatType} detected (confidence: ${analysis.confidence}). Indicators: ${analysis.indicators.join(', ')}`;
    autoAction = 'pause_require_approval';
  }
  // Repeat offender bumps to HIGH
  else if (history.pastThreats >= 2) {
    severity = 'HIGH';
    reason = `Sender has ${history.pastThreats} past threat incidents. Current: ${analysis.threatType}`;
    autoAction = 'pause_require_approval';
  }

  // ─── MEDIUM ──────────────────────────────────────────
  // Unfamiliar sender with minor flags, or spam
  else if (
    analysis.threatType === 'spam' ||
    analysis.threatType === 'social_engineering' ||
    (analysis.confidence >= 0.4 && analysis.confidence < 0.7) ||
    history.pastThreats === 1
  ) {
    severity = 'MEDIUM';
    reason = `${analysis.threatType} with moderate confidence (${analysis.confidence}). Monitoring.`;
    autoAction = 'log_and_warn';
  }

  // ─── LOW ─────────────────────────────────────────────
  // Everything else — clean, known sender, no indicators
  else {
    severity = 'LOW';
    reason = analysis.threatType === 'legitimate'
      ? 'Email appears legitimate. No threat indicators found.'
      : `Minor concern: ${analysis.threatType} (confidence: ${analysis.confidence}). Auto-resolved.`;
    autoAction = 'log_only';
  }

  console.log(`  → Severity: ${severity} | Action: ${autoAction}`);
  return { severity, reason, autoAction, senderHistory: history };
}

function hasExecutableAttachments(email) {
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.js', '.vbs', '.ps1', '.msi', '.zip', '.rar', '.7z'];
  return (email.attachments || []).some((att) => {
    const name = (att.filename || '').toLowerCase();
    return dangerousExtensions.some((ext) => name.endsWith(ext));
  });
}
