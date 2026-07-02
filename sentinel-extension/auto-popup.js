// auto-popup.js — Injected into mail.google.com via content_scripts
// Uses both hash polling AND MutationObserver for maximum reliability

(function() {
  console.log('[Sentinel] auto-popup.js loaded on Gmail');

  let lastHash = '';
  let widgetVisible = false;

  // Check every second if the URL hash changed to an email thread
  function checkForEmailView() {
    const hash = window.location.hash;

    // Gmail email thread hashes look like: #inbox/FMfcgz... or #all/FMfcgz...
    const isEmailOpen = /^#(inbox|sent|starred|drafts|all|label|search)\/[A-Za-z0-9]/.test(hash);

    if (isEmailOpen && hash !== lastHash) {
      lastHash = hash;
      // Wait for Gmail to finish rendering the email
      setTimeout(showWidget, 1500);
    } else if (!isEmailOpen) {
      lastHash = '';
      removeWidget();
    }
  }

  setInterval(checkForEmailView, 1000);

  function showWidget() {
    if (document.getElementById('sentinel-auto-widget')) return;
    widgetVisible = true;

    const widget = document.createElement('div');
    widget.id = 'sentinel-auto-widget';
    Object.assign(widget.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '320px',
      background: 'rgba(15, 23, 42, 0.96)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(99, 102, 241, 0.4)',
      borderRadius: '14px',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
      zIndex: '2147483647',
      padding: '18px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#f1f5f9',
      opacity: '0',
      transform: 'translateY(20px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease'
    });

    widget.innerHTML = [
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">',
        '<div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;font-size:18px;">&#128737;&#65039;</div>',
        '<div>',
          '<div style="font-size:0.95rem;font-weight:700;color:#fff;">Sentinel Agent</div>',
          '<div style="font-size:0.7rem;color:#94a3b8;">Email threat scanner</div>',
        '</div>',
      '</div>',
      '<p style="margin:0 0 16px;font-size:0.85rem;color:#cbd5e1;line-height:1.5;">New email detected. Want to scan it for phishing, spoofing, or malware?</p>',
      '<div style="display:flex;gap:8px;">',
        '<button id="s-scan-btn" style="flex:1;padding:10px;background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.85rem;transition:transform 0.15s ease,box-shadow 0.15s ease;">Analyze Now</button>',
        '<button id="s-dismiss-btn" style="padding:10px 14px;background:transparent;color:#94a3b8;border:1px solid #334155;border-radius:8px;cursor:pointer;font-size:0.85rem;transition:border-color 0.15s ease;">Dismiss</button>',
      '</div>'
    ].join('');

    document.body.appendChild(widget);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        widget.style.opacity = '1';
        widget.style.transform = 'translateY(0)';
      });
    });

    // Hover effects
    const scanBtn = document.getElementById('s-scan-btn');
    const dismissBtn = document.getElementById('s-dismiss-btn');

    scanBtn.addEventListener('mouseenter', () => { scanBtn.style.transform = 'scale(1.03)'; scanBtn.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)'; });
    scanBtn.addEventListener('mouseleave', () => { scanBtn.style.transform = 'scale(1)'; scanBtn.style.boxShadow = 'none'; });
    dismissBtn.addEventListener('mouseenter', () => { dismissBtn.style.borderColor = '#6366f1'; });
    dismissBtn.addEventListener('mouseleave', () => { dismissBtn.style.borderColor = '#334155'; });

    dismissBtn.addEventListener('click', () => {
      widget.style.opacity = '0';
      widget.style.transform = 'translateY(20px)';
      setTimeout(() => { widget.remove(); widgetVisible = false; }, 300);
    });

    scanBtn.addEventListener('click', () => {
      scanBtn.textContent = 'Opening Scanner...';
      scanBtn.style.background = '#10b981';
      dismissBtn.style.display = 'none';

      // After a short delay, remove the widget and let the user click the extension icon
      setTimeout(() => {
        widget.innerHTML = [
          '<div style="display:flex;align-items:center;gap:10px;">',
            '<div style="font-size:1.4rem;">&#128737;&#65039;</div>',
            '<div style="font-size:0.85rem;color:#818cf8;font-weight:600;">Click the Sentinel icon in your Chrome toolbar to start the scan!</div>',
          '</div>'
        ].join('');
        setTimeout(() => { removeWidget(); }, 5000);
      }, 800);
    });
  }

  function removeWidget() {
    const el = document.getElementById('sentinel-auto-widget');
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      setTimeout(() => el.remove(), 300);
    }
    widgetVisible = false;
  }

  console.log('[Sentinel] Hash polling active — waiting for email opens...');
})();
