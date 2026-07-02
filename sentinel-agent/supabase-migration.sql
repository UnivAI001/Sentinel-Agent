-- Sentinel Agent — Supabase Schema Migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ═══════════════════════════════════════════
-- INCIDENTS TABLE — Core table for all scanned emails
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Email metadata
  sender_email TEXT NOT NULL,
  sender_domain TEXT,
  reply_to TEXT,
  subject TEXT NOT NULL,
  body_preview TEXT,
  urls TEXT[] DEFAULT '{}',
  attachment_count INTEGER DEFAULT 0,
  
  -- Header analysis
  spf_status TEXT DEFAULT 'unknown',
  dkim_status TEXT DEFAULT 'unknown',
  
  -- AI analysis results
  threat_type TEXT NOT NULL DEFAULT 'unknown',
  confidence DECIMAL(3,2) DEFAULT 0.00,
  indicators TEXT[] DEFAULT '{}',
  ai_reasoning TEXT,
  
  -- Severity decision
  severity TEXT NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  decision_reason TEXT,
  
  -- Status & actions
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'resolved', 'monitored', 'pending_review', 'escalated')),
  action_taken TEXT,
  admin_notes TEXT,
  escalation_deadline TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  
  -- Report
  report_title TEXT,
  report_summary TEXT,
  report_details JSONB,
  
  -- Gmail reference
  gmail_id TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- INDEXES for fast lookups
-- ═══════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_sender_email ON incidents(sender_email);
CREATE INDEX IF NOT EXISTS idx_incidents_sender_domain ON incidents(sender_domain);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_threat_type ON incidents(threat_type);

-- ═══════════════════════════════════════════
-- AUTO-UPDATE updated_at trigger
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Service key bypasses RLS, but enabling for safety
-- ═══════════════════════════════════════════

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (our backend)
CREATE POLICY "Service role full access" ON incidents
    FOR ALL
    USING (true)
    WITH CHECK (true);
