document.addEventListener('DOMContentLoaded', async () => {
  const authState = document.getElementById('auth-state');
  const initialState = document.getElementById('initial-state');
  const loadingState = document.getElementById('loading-state');
  const resultState = document.getElementById('result-state');

  const emailInput = document.getElementById('email-input');
  const passwordInput = document.getElementById('password-input');
  const loginBtn = document.getElementById('login-btn');
  const authError = document.getElementById('auth-error');
  
  const scanBtn = document.getElementById('scan-btn');
  const seeMoreBtn = document.getElementById('see-more-btn');
  const copyBtn = document.getElementById('copy-btn');
  const closeBtn = document.getElementById('close-btn');
  
  const progressFill = document.getElementById('progress-fill');
  const loadingText = document.getElementById('loading-text');
  const sseLogs = document.getElementById('sse-logs');
  
  const verdictBadge = document.getElementById('verdict-badge');
  const verdictTitle = document.getElementById('verdict-title');
  const shortReason = document.getElementById('short-reason');
  const extendedReasonContainer = document.getElementById('extended-reason-container');
  const extendedReason = document.getElementById('extended-reason');

  let sseSource = null;
  let currentResult = null;
  let sessionToken = null;
  let userId = null;

  const SUPABASE_URL = 'https://gpbrnjdtpqrcgqfbkmue.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYnJuamR0cHFyY2dxZmJrbXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MzU1NjMsImV4cCI6MjA5ODAxMTU2M30.YMi_LXFPwd2mgE5ltjiul3pEWHQSOM_kQdbgylNLEVg';

  function switchState(showState) {
    [authState, initialState, loadingState, resultState].forEach(s => s.classList.add('hidden'));
    showState.classList.remove('hidden');
  }

  // --- Auth Logic ---
  chrome.storage.local.get(['sessionToken', 'userId'], (result) => {
    if (result.sessionToken && result.userId) {
      sessionToken = result.sessionToken;
      userId = result.userId;
      switchState(initialState);
    } else {
      switchState(authState);
    }
  });

  loginBtn.addEventListener('click', async () => {
    loginBtn.textContent = 'Signing in...';
    authError.style.display = 'none';

    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          email: emailInput.value,
          password: passwordInput.value
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || 'Login failed');

      sessionToken = data.access_token;
      userId = data.user.id;

      chrome.storage.local.set({ sessionToken, userId }, () => {
        switchState(initialState);
      });
    } catch (err) {
      authError.textContent = err.message;
      authError.style.display = 'block';
    } finally {
      loginBtn.textContent = 'Sign In';
    }
  });

  function addLog(msg) {
    const p = document.createElement('p');
    p.textContent = msg;
    sseLogs.appendChild(p);
    sseLogs.scrollTop = sseLogs.scrollHeight;
  }

  scanBtn.addEventListener('click', async () => {
    switchState(loadingState);
    progressFill.style.width = '20%';
    addLog('Extracting active email from Gmail...');

    try {
      // 1. Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url.includes('mail.google.com')) {
        throw new Error('Please open an email in Gmail to scan.');
      }

      // 2. Inject content script to extract email data
      const extractionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      const emailData = extractionResults[0]?.result;
      if (!emailData || !emailData.bodyText) {
        throw new Error('No email content found. Please open an email thread.');
      }

      progressFill.style.width = '40%';
      addLog('Email extracted successfully');
      addLog('Connecting to Sentinel Agent Backend...');

      const emailId = Date.now().toString();

      // 3. Connect to SSE for realtime updates, filtering by our ID
      sseSource = new EventSource(`http://47.251.250.224:4000/api/stream?id=${emailId}`);
      sseSource.addEventListener('scan_start', (e) => addLog('Engine Initializing...'));
      sseSource.addEventListener('scan_progress', (e) => {
        const data = JSON.parse(e.data);
        addLog(data.status);
        if (data.step === 'scanning') progressFill.style.width = '40%';
        if (data.step === 'analyzing') progressFill.style.width = '70%';
        if (data.step === 'saving') progressFill.style.width = '90%';
      });
      sseSource.addEventListener('scan_complete', () => {
        progressFill.style.width = '100%';
        addLog('Scan Complete. Resolving...');
        sseSource.close();
      });
      sseSource.addEventListener('scan_error', (e) => addLog('Engine Error: ' + JSON.parse(e.data).message));
      
      const payload = {
        scanId: emailId,
        subject: emailData.subject,
        bodyText: emailData.bodyText,
        links: emailData.links,
        images: emailData.images,
        sender: emailData.sender
      };

      const scanRes = await fetch('http://47.251.250.224:4000/api/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!scanRes.ok) throw new Error('Backend analysis failed');
      
      const result = await scanRes.json();
      currentResult = result;
      
      // Render Result
      setTimeout(() => {
        showVerdict(result);
      }, 500);

    } catch (err) {
      alert('Error: ' + err.message);
      switchState(initialState);
    }
  });

  function showVerdict(result) {
    switchState(resultState);
    
    // Reset badges
    verdictBadge.className = 'badge';
    
    const severity = (result.severity || 'UNKNOWN').toUpperCase();
    
    if (severity === 'LOW') {
      verdictBadge.classList.add('severity-low');
      verdictTitle.textContent = 'Safe Email';
    } else if (severity === 'MEDIUM') {
      verdictBadge.classList.add('severity-medium');
      verdictTitle.textContent = 'Proceed with Caution';
    } else if (severity === 'HIGH') {
      verdictBadge.classList.add('severity-high');
      verdictTitle.textContent = 'Suspicious Email';
    } else if (severity === 'CRITICAL') {
      verdictBadge.classList.add('severity-critical');
      verdictTitle.textContent = 'Critical Threat Detected';
    } else {
      verdictBadge.classList.add('severity-medium');
    }
    
    verdictBadge.textContent = severity;
    shortReason.textContent = result.shortReason || 'No summary provided.';
    extendedReason.textContent = result.reasoning || 'No extended reasoning available.';
  }

  seeMoreBtn.addEventListener('click', () => {
    extendedReasonContainer.classList.toggle('hidden');
    if (extendedReasonContainer.classList.contains('hidden')) {
      seeMoreBtn.textContent = 'See More';
    } else {
      seeMoreBtn.textContent = 'See Less';
    }
  });

  copyBtn.addEventListener('click', async () => {
    if (!currentResult) return;
    
    const textToCopy = `Sentinel Agent Analysis Report
Severity: ${currentResult.severity || 'Unknown'}
Threat Type: ${currentResult.threatType || 'Unknown'}

Summary:
${currentResult.shortReason || 'No summary'}

Detailed Reasoning:
${currentResult.reasoning || 'No details'}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    } catch (err) {
      addLog('Failed to copy text: ' + err.message);
    }
  });

  closeBtn.addEventListener('click', () => {
    window.close();
  });
});
