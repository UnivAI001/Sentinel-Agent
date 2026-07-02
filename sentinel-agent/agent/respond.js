import { updateIncident } from '../lib/supabase.js';

/**
 * Execute response actions based on severity.
 * Since we're using a dashboard instead of Resend, HIGH/CRITICAL
 * cases get flagged as "pending_review" for admin action in the UI.
 */
export async function respondToThreat(incidentId, email, analysis, decision) {
  const { severity, autoAction } = decision;
  console.log(`🛡️  Responding to threat | Severity: ${severity} | Action: ${autoAction}`);

  switch (severity) {
    case 'LOW':
      // Auto-resolve: just log it
      await updateIncident(incidentId, {
        status: 'resolved',
        action_taken: 'auto_resolved',
        resolved_at: new Date().toISOString(),
      });
      console.log('  ✅ Auto-resolved (LOW severity)');
      break;

    case 'MEDIUM':
      // Log and mark for awareness — visible on dashboard
      await updateIncident(incidentId, {
        status: 'monitored',
        action_taken: 'logged_and_monitored',
      });
      console.log('  ⚠️  Logged and flagged for monitoring (MEDIUM)');
      break;

    case 'HIGH':
      // Requires admin approval via dashboard
      await updateIncident(incidentId, {
        status: 'pending_review',
        action_taken: 'awaiting_admin_approval',
      });
      console.log('  🔶 Paused — awaiting admin approval on dashboard (HIGH)');
      break;

    case 'CRITICAL':
      // Urgent — flag on dashboard with auto-escalation timer
      const escalationTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await updateIncident(incidentId, {
        status: 'pending_review',
        action_taken: 'urgent_alert_sent',
        escalation_deadline: escalationTime,
      });
      console.log(`  🔴 CRITICAL ALERT — Admin must act by ${escalationTime} or auto-escalation triggers`);
      break;

    default:
      console.log('  ❓ Unknown severity, defaulting to log only');
      await updateIncident(incidentId, {
        status: 'resolved',
        action_taken: 'unknown_severity_auto_resolved',
      });
  }
}
