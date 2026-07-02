import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── AUTH OPERATIONS ───────────────────────────────────────────

export async function verifyUserToken(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error('Invalid or expired authentication token');
  }
  return user;
}

// ─── SCAN OPERATIONS ───────────────────────────────────────────

export async function insertScan(scan) {
  const { data, error } = await supabase
    .from('scans')
    .insert(scan)
    .select()
    .single();

  if (error) {
    console.error('Supabase scan insert error:', error.message);
    throw error;
  }
  return data;
}

// ─── Incident Operations ───────────────────────────────────────

/**
 * Insert a new incident into the database.
 */
export async function insertIncident(incident) {
  const { data, error } = await supabase
    .from('incidents')
    .insert(incident)
    .select()
    .single();

  if (error) {
    console.error('Supabase insert error:', error.message);
    throw error;
  }
  return data;
}

/**
 * Update an existing incident (e.g. after admin approval/override).
 */
export async function updateIncident(id, updates) {
  const { data, error } = await supabase
    .from('incidents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Supabase update error:', error.message);
    throw error;
  }
  return data;
}

/**
 * Get all incidents, ordered by most recent first.
 */
export async function getIncidents(limit = 50) {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Supabase fetch error:', error.message);
    throw error;
  }
  return data;
}

/**
 * Get a single incident by ID.
 */
export async function getIncidentById(id) {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Supabase fetch error:', error.message);
    throw error;
  }
  return data;
}

// ─── Sender History ────────────────────────────────────────────

/**
 * Check if we've seen this sender/domain before and how many threats they've triggered.
 */
export async function getSenderHistory(senderEmail) {
  const domain = senderEmail.split('@')[1] || senderEmail;

  const { data, error } = await supabase
    .from('incidents')
    .select('id, severity, sender_email, created_at')
    .or(`sender_email.eq.${senderEmail},sender_domain.eq.${domain}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase history lookup error:', error.message);
    return { seenBefore: false, pastThreats: 0, history: [] };
  }

  const threats = (data || []).filter((i) =>
    ['HIGH', 'CRITICAL'].includes(i.severity)
  );

  return {
    seenBefore: data && data.length > 0,
    pastThreats: threats.length,
    totalEmails: data ? data.length : 0,
    history: data || [],
  };
}

/**
 * Get dashboard statistics.
 */
export async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: allIncidents, error } = await supabase
    .from('incidents')
    .select('id, severity, status, created_at');

  if (error) {
    console.error('Stats fetch error:', error.message);
    return null;
  }

  const todayIncidents = allIncidents.filter(
    (i) => new Date(i.created_at) >= today
  );

  return {
    total: allIncidents.length,
    totalToday: todayIncidents.length,
    safe: allIncidents.filter((i) => i.severity === 'LOW').length,
    safeToday: todayIncidents.filter((i) => i.severity === 'LOW').length,
    suspicious: allIncidents.filter((i) =>
      ['MEDIUM', 'HIGH'].includes(i.severity)
    ).length,
    critical: allIncidents.filter((i) => i.severity === 'CRITICAL').length,
    pending: allIncidents.filter((i) => i.status === 'pending_review').length,
    resolved: allIncidents.filter((i) => i.status === 'resolved').length,
  };
}
