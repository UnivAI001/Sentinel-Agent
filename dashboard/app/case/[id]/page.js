'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CaseDetail() {
  const params = useParams();
  const router = useRouter();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchIncident();
  }, [params.id]);

  async function fetchIncident() {
    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Failed to fetch incident:', error);
    } else {
      setIncident(data);
    }
    setLoading(false);
  }

  async function handleAction(action) {
    setActionLoading(true);
    const updates = {};

    switch (action) {
      case 'approve':
        updates.status = 'resolved';
        updates.action_taken = 'admin_approved_safe';
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = 'admin';
        break;
      case 'escalate':
        updates.status = 'escalated';
        updates.action_taken = 'admin_escalated';
        break;
      case 'dismiss':
        updates.status = 'resolved';
        updates.action_taken = 'admin_dismissed';
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = 'admin';
        break;
    }

    const { error } = await supabase
      .from('scans')
      .update({ metadata: { ...incident.metadata, ...updates } })
      .eq('id', params.id);

    if (!error) {
      fetchIncident();
    }
    setActionLoading(false);
  }

  async function handleFeedback(e) {
    e.preventDefault();
    const notes = e.target.notes.value;
    if (!notes.trim()) return;

    await supabase
      .from('scans')
      .update({ metadata: { ...incident.metadata, admin_notes: notes } })
      .eq('id', params.id);

    fetchIncident();
    e.target.reset();
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-skeleton" style={{ height: 40, width: 300, marginBottom: 20 }} />
        <div className="loading-skeleton" style={{ height: 400 }} />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="dashboard-container">
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>Incident not found</h3>
          <Link href="/" className="btn btn-ghost" style={{ marginTop: 16 }}>← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const report = incident.report_details ? (typeof incident.report_details === 'string' ? JSON.parse(incident.report_details) : incident.report_details) : null;

  return (
    <div className="dashboard-container">
      {/* Back + Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>
          ← Back to Dashboard
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{incident.subject}</h1>
        <span className={`badge badge-${(incident.severity || 'UNKNOWN').toLowerCase()}`}>{incident.severity}</span>
        <span className={`badge status-${incident.metadata?.status || 'new'}`}>{(incident.metadata?.status || 'new').replace('_', ' ')}</span>
      </div>

      <div className="detail-grid">
        {/* Main Content */}
        <div>
          {/* Email Info */}
          <div className="glass-card detail-section">
            <div className="detail-section-title">📧 Email Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="detail-field">
                <div className="detail-label">From</div>
                <div className="detail-value">{incident.sender}</div>
              </div>
              <div className="detail-field">
                <div className="detail-label">Domain</div>
                <div className="detail-value">{incident.sender?.split('@')[1] || 'unknown'}</div>
              </div>
              <div className="detail-field">
                <div className="detail-label">Analyzed Log</div>
                <div className="detail-value">{new Date(incident.created_at).toLocaleString()}</div>
              </div>
              <div className="detail-field">
                <div className="detail-label">Detected Links</div>
                <div className="detail-value">
                  {incident.link_count}
                </div>
              </div>
            </div>
            {incident.body_preview && (
              <div className="detail-field" style={{ marginTop: 16 }}>
                <div className="detail-label">Body Preview</div>
                <div className="detail-value" style={{
                  padding: 16,
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 8,
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {incident.body_preview}
                </div>
              </div>
            )}
          </div>

          {/* AI Analysis */}
          <div className="glass-card detail-section">
            <div className="detail-section-title">🤖 AI Analysis</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="detail-field">
                <div className="detail-label">Threat Type</div>
                <div className="detail-value" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  {incident.verdict || incident.threat_type}
                </div>
              </div>
              <div className="detail-field">
                <div className="detail-label">Confidence</div>
                <div className="detail-value">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{
                        width: `${(incident.confidence || 0) * 100}%`,
                        height: '100%',
                        borderRadius: 4,
                        background: (incident.confidence || 0) > 0.7 ? 'var(--severity-critical)' : (incident.confidence || 0) > 0.4 ? 'var(--severity-medium)' : 'var(--severity-low)',
                      }} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      {Math.round((incident.confidence || 0) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {incident.metadata?.indicators && incident.metadata.indicators.length > 0 && (
              <div className="detail-field" style={{ marginTop: 12 }}>
                <div className="detail-label">Threat Indicators</div>
                <div>
                  {incident.metadata.indicators.map((ind, i) => (
                    <span key={i} className="indicator-tag">{ind.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              </div>
            )}

            {incident.reasoning && (
              <div className="detail-field" style={{ marginTop: 12 }}>
                <div className="detail-label">AI Reasoning</div>
                <div className="detail-value" style={{ lineHeight: 1.6 }}>{incident.reasoning}</div>
              </div>
            )}

            {incident.metadata?.full_reasoning && (
              <div className="detail-field" style={{ marginTop: 12 }}>
                <div className="detail-label">Full Technical Breakdown</div>
                <div className="detail-value" style={{ lineHeight: 1.6 }}>{incident.metadata.full_reasoning}</div>
              </div>
            )}
          </div>

          {/* Report */}
          {report && (
            <div className="glass-card detail-section">
              <div className="detail-section-title">📋 Incident Report</div>
              <div className="detail-field">
                <div className="detail-label">Title</div>
                <div className="detail-value" style={{ fontWeight: 600, fontSize: '1.05rem' }}>{report.title}</div>
              </div>
              <div className="detail-field">
                <div className="detail-label">Summary</div>
                <div className="detail-value" style={{ lineHeight: 1.6 }}>{report.summary}</div>
              </div>
              {report.technicalDetails && (
                <div className="detail-field">
                  <div className="detail-label">Technical Details</div>
                  <div className="detail-value" style={{ lineHeight: 1.6 }}>{report.technicalDetails}</div>
                </div>
              )}
              {report.recommendedActions && (
                <div className="detail-field">
                  <div className="detail-label">Recommended Actions</div>
                  <ul style={{ paddingLeft: 20, color: 'var(--text-primary)', lineHeight: 1.8 }}>
                    {report.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
              {report.riskAssessment && (
                <div className="detail-field">
                  <div className="detail-label">Risk Assessment</div>
                  <div className="detail-value">{report.riskAssessment}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {/* Admin Actions */}
          {(!incident.metadata?.status || incident.metadata.status === 'new') && (
            <div className="glass-card detail-section">
              <div className="detail-section-title">⚡ Admin Actions</div>

              {incident.escalation_deadline && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 8,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  marginBottom: 16,
                  fontSize: '0.8rem',
                  color: 'var(--accent-rose)',
                }}>
                  ⏰ Auto-escalation at:<br />
                  <strong>{new Date(incident.escalation_deadline).toLocaleString()}</strong>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="btn btn-success"
                  onClick={() => handleAction('approve')}
                  disabled={actionLoading}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  ✅ Mark as Safe
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleAction('escalate')}
                  disabled={actionLoading}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  🚨 Escalate
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => handleAction('dismiss')}
                  disabled={actionLoading}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  🗑️ Dismiss
                </button>
              </div>
            </div>
          )}

          {/* URLs */}
          {incident.metadata?.urls && incident.metadata.urls.length > 0 && (
            <div className="glass-card detail-section">
              <div className="detail-section-title">🔗 Extracted URLs</div>
              {incident.metadata.urls.map((url, i) => (
                <div key={i} style={{
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 6,
                  marginBottom: 6,
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  color: 'var(--accent-amber)',
                }}>
                  {url}
                </div>
              ))}
            </div>
          )}

          {/* Feedback */}
          <div className="glass-card detail-section">
            <div className="detail-section-title">💬 Admin Notes / Feedback</div>
            {incident.metadata?.admin_notes && (
              <div style={{
                padding: 12,
                background: 'rgba(99, 102, 241, 0.08)',
                borderRadius: 8,
                marginBottom: 12,
                fontSize: '0.85rem',
                lineHeight: 1.6,
              }}>
                {incident.metadata.admin_notes}
              </div>
            )}
            <form onSubmit={handleFeedback}>
              <textarea
                name="notes"
                placeholder="Add notes or feedback for the AI model..."
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: 12,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
              <button type="submit" className="btn btn-primary" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
                Save Notes
              </button>
            </form>
          </div>

          {/* Timeline */}
          <div className="glass-card detail-section">
            <div className="detail-section-title">🕐 Timeline</div>
            <div style={{ fontSize: '0.8rem', lineHeight: 2 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Created at:</span> {new Date(incident.created_at).toLocaleString()}</div>
              {incident.metadata?.resolved_at && (
                <div><span style={{ color: 'var(--text-muted)' }}>Resolved:</span> {new Date(incident.metadata.resolved_at).toLocaleString()}</div>
              )}
              {incident.metadata?.resolved_by && (
                <div><span style={{ color: 'var(--text-muted)' }}>By:</span> {incident.metadata.resolved_by}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
