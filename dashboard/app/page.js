'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [extensionStepDone, setExtensionStepDone] = useState(false);

  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [liveScan, setLiveScan] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        if (localStorage.getItem('extensionDone')) setExtensionStepDone(true);
        fetchData();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        if (localStorage.getItem('extensionDone')) setExtensionStepDone(true);
        fetchData();
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    // Real-time subscription to scans table
    const channel = supabase
      .channel('scans-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scans', filter: `user_id=eq.${session.user.id}` }, () => {
        fetchData();
      })
      .subscribe();

    // Poll every 30s as fallback
    const interval = setInterval(fetchData, 30000);

    // Live EventSource (SSE) from Backend Extension API
    const eventSource = new EventSource('http://47.251.250.224:4000/api/stream');
    eventSource.addEventListener('scan_start', (e) => setLiveScan({ ...JSON.parse(e.data), step: 'started', status: 'Initializing analysis engine...' }));
    eventSource.addEventListener('scan_progress', (e) => setLiveScan(prev => ({ ...prev, ...JSON.parse(e.data) })));
    eventSource.addEventListener('scan_error', () => setLiveScan(null));
    eventSource.addEventListener('scan_complete', () => {
      setTimeout(() => setLiveScan(null), 5000); 
      fetchData(); 
    });

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      eventSource.close();
    };
  }, [session]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
    else setAuthError('Signup successful! Check your email for confirmation, or you are now logged in.');
  };

  const handleExtensionDone = () => {
    localStorage.setItem('extensionDone', 'true');
    setExtensionStepDone(true);
  };

  async function fetchData() {
    setLoading(true);

    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setIncidents(data);
      computeStats(data);
    }
    setLoading(false);
  }

  function computeStats(data) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayItems = data.filter((i) => new Date(i.created_at) >= today);

    setStats({
      total: data.length,
      totalToday: todayItems.length,
      safe: data.filter((i) => i.severity === 'LOW').length,
      safeToday: todayItems.filter((i) => i.severity === 'LOW').length,
      suspicious: data.filter((i) => ['MEDIUM', 'HIGH'].includes(i.severity)).length,
      critical: data.filter((i) => i.severity === 'CRITICAL').length,
      pending: data.filter((i) => i.status === 'pending_review').length,
    });
  }

  const filteredIncidents = filter === 'all'
    ? incidents
    : filter === 'pending'
      ? incidents.filter((i) => i.status === 'pending_review')
      : incidents.filter((i) => i.severity === filter.toUpperCase());

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  if (!session) {
    return (
      <div className="dashboard-container liquid-bg" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', margin: 0, padding: 0, maxWidth: '100%', position: 'absolute', top: 0, left: 0 }}>
        <div className="liquid-glass-card" style={{ width: '420px', padding: '40px' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 className="dashboard-title" style={{ justifyContent: 'center' }}>
              <span style={{ filter: 'drop-shadow(0 0 10px rgba(99,102,241,0.5))' }}>🛡️</span>
              <span className="dashboard-title-accent">Sentinel</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 12, fontSize: '0.95rem' }}>
              {isSignUp ? 'Create your account to get started' : 'Welcome back to your security hub'}
            </p>
          </div>
          <form onSubmit={isSignUp ? handleSignUp : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="liquid-input" style={{ padding: '14px', borderRadius: '12px' }} required />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="liquid-input" style={{ padding: '14px', borderRadius: '12px' }} required />
            <button type="submit" className="liquid-btn-primary" style={{ padding: '14px', borderRadius: '12px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
            {authError && <p style={{ color: 'var(--accent-rose)', fontSize: '0.9rem', textAlign: 'center', background: 'rgba(244,63,94,0.1)', padding: '8px', borderRadius: '8px' }}>{authError}</p>}
          </form>
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p className="toggle-text" onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}>
              {isSignUp ? <>Already have an account? <span>Sign In</span></> : <>New here? <span>Create Account</span></>}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (session && !extensionStepDone) {
    return (
      <div className="dashboard-container liquid-bg" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', margin: 0, padding: 0, maxWidth: '100%', position: 'absolute', top: 0, left: 0 }}>
        <div className="liquid-glass-card" style={{ width: '500px', padding: '50px', textAlign: 'center' }}>
          <div style={{ marginBottom: '30px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px', animation: 'float 6s ease-in-out infinite' }}>🧩</div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '12px' }}>Install the Extension</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Sentinel requires its companion browser extension to automatically analyze emails and protect your inbox in real-time.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <a href="/sentinel-extension.zip" download style={{ textDecoration: 'none' }}>
              <button className="liquid-btn-primary" style={{ padding: '16px', borderRadius: '12px', color: '#fff', fontWeight: 600, width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download Extension ZIP
              </button>
            </a>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: '8px' }}>How to install locally:</div>
              <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Go to <strong>chrome://extensions</strong> in your browser</li>
                <li>Turn on <strong>Developer Mode</strong> at the top right</li>
                <li>Extract and load unpacked, or drag and drop the downloaded ZIP</li>
              </ol>
            </div>

            <button onClick={handleExtensionDone} className="liquid-btn-ghost" style={{ padding: '14px', borderRadius: '12px', fontWeight: 600, width: '100%', cursor: 'pointer' }}>
              Done, take me to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">
          <span>🛡️</span>
          <span className="dashboard-title-accent">Sentinel</span>
          <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>Agent</span>
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ 
            width: 8, height: 8, borderRadius: '50%', 
            background: 'var(--accent-emerald)', 
            boxShadow: '0 0 8px var(--accent-emerald)',
            animation: 'pulse-critical 2s infinite'
          }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Live Monitoring • {session.user.email}</span>
        </div>
      </div>

      {/* Live Scan Feed */}
      {liveScan && (
        <div className="glass-card" style={{ marginBottom: '24px', borderLeft: '4px solid #818cf8', background: 'rgba(99, 102, 241, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="spinner" style={{ width: 20, height: 20, border: '2px solid rgba(99,102,241,0.2)', borderTopColor: '#818cf8', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#818cf8' }}>Active Request: {liveScan.subject}</h3>
            </div>
            <span className="badge" style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>{liveScan.step}</span>
          </div>
          <div style={{ padding: '12px', background: 'rgba(15,23,42,0.6)', borderRadius: 8, fontFamily: 'monospace', fontSize: '0.85rem', color: '#cbd5e1' }}>
            {liveScan.status}
          </div>
          <div style={{ width: '100%', height: 4, background: '#1e293b', marginTop: 12, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              background: 'linear-gradient(90deg, #4f46e5, #818cf8)', 
              width: liveScan.step === 'started' ? '10%' : liveScan.step === 'scanning' ? '40%' : liveScan.step === 'analyzing' ? '70%' : liveScan.step === 'saving' ? '90%' : '100%',
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <div className="stats-grid">
          <div className="glass-card stat-card total">
            <div className="stat-number" style={{ color: 'var(--accent-indigo)' }}>{stats.total}</div>
            <div className="stat-label">Total Scanned</div>
            <div className="stat-sub">{stats.totalToday} today</div>
          </div>
          <div className="glass-card stat-card safe">
            <div className="stat-number" style={{ color: 'var(--accent-emerald)' }}>{stats.safe}</div>
            <div className="stat-label">Safe</div>
            <div className="stat-sub">{stats.safeToday} today</div>
          </div>
          <div className="glass-card stat-card suspicious">
            <div className="stat-number" style={{ color: 'var(--accent-amber)' }}>{stats.suspicious}</div>
            <div className="stat-label">Suspicious</div>
            <div className="stat-sub">MEDIUM + HIGH</div>
          </div>
          <div className="glass-card stat-card critical">
            <div className="stat-number" style={{ color: 'var(--accent-rose)' }}>{stats.critical}</div>
            <div className="stat-label">Critical</div>
            <div className="stat-sub">Immediate action</div>
          </div>
          <div className="glass-card stat-card pending">
            <div className="stat-number" style={{ color: '#a78bfa' }}>{stats.pending}</div>
            <div className="stat-label">Pending Review</div>
            <div className="stat-sub">Needs approval</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar">
        {['all', 'pending', 'low', 'medium', 'high', 'critical'].map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '🔍 All' : f === 'pending' ? '⏳ Pending Review' : f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Incidents Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div className="incident-row incident-row-header">
          <span>Subject / Sender</span>
          <span>Threat</span>
          <span>Severity</span>
          <span>Status</span>
          <span>Confidence</span>
          <span>Time</span>
        </div>

        {loading && incidents.length === 0 ? (
          <div style={{ padding: '20px' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="loading-skeleton" style={{ height: 50, marginBottom: 8 }} />
            ))}
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3 style={{ marginBottom: 8 }}>No incidents found</h3>
            <p>
              {filter === 'all'
                ? 'Sentinel Agent is waiting for emails to scan.'
                : `No ${filter.toUpperCase()} incidents at this time.`}
            </p>
          </div>
        ) : (
          filteredIncidents.map((incident) => (
            <Link
              key={incident.id}
              href={`/case/${incident.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="incident-row">
                <div>
                  <div className="incident-subject">{incident.subject}</div>
                  <div className="incident-sender">{incident.sender}</div>
                </div>
                <div>
                  <span className="badge" style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: 'var(--accent-indigo)',
                    fontSize: '0.7rem'
                  }}>
                    {incident.verdict || 'scanning'}
                  </span>
                </div>
                <div>
                  <span className={`badge badge-${(incident.severity || 'low').toLowerCase()}`}>
                    {incident.severity}
                  </span>
                </div>
                <div>
                  <span className={`badge status-${incident.status}`}>
                    {(incident.status || 'new').replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <div style={{ 
                    width: '100%', 
                    height: 6, 
                    borderRadius: 3, 
                    background: 'rgba(255,255,255,0.06)' 
                  }}>
                    <div style={{
                      width: `${(incident.confidence || 0) * 100}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: (incident.confidence || 0) > 0.7
                        ? 'var(--severity-critical)'
                        : (incident.confidence || 0) > 0.4
                          ? 'var(--severity-medium)'
                          : 'var(--severity-low)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {Math.round((incident.confidence || 0) * 100)}%
                  </span>
                </div>
                <div className="incident-time">
                  {timeAgo(incident.created_at)}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
