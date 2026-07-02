-- Supabase Shared Login & Scans Table Migration

-- 1. Create the scans table (replaces incidents)
CREATE TABLE IF NOT EXISTS public.scans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sender TEXT NOT NULL,
    subject TEXT,
    verdict TEXT,
    severity TEXT NOT NULL,
    reasoning TEXT,
    link_count INT DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Setup Row Level Security (RLS)
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Users can only see their own scans
CREATE POLICY "Users can view their own scans"
ON public.scans FOR SELECT
USING (auth.uid() = user_id);

-- Users/Backend can insert their own scans (if backend is using a service key, it bypasses RLS)
CREATE POLICY "Users can insert their own scans"
ON public.scans FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Disable updates/deletes to preserve incident history integrity
CREATE POLICY "Users cannot delete scans"
ON public.scans FOR DELETE
USING (false);

CREATE POLICY "Users cannot update scans"
ON public.scans FOR UPDATE
USING (false);

-- 4. Create indexes for faster queries
CREATE INDEX idx_scans_user_id ON public.scans(user_id);
CREATE INDEX idx_scans_created_at ON public.scans(created_at DESC);
CREATE INDEX idx_scans_severity ON public.scans(severity);
