/**
 * Solely Embeddable Checkout Widget
 * 
 * Usage:
 *   <div data-solely-link="YOUR_LINK_ID"></div>
 *   <script src="https://solelymarketplace.com/solely-widget.js" async></script>
 * 
 * Optional attributes:
 *   data-solely-theme="dark" | "amber" | "light"  (default: "dark")
 *   data-solely-text="Custom Button Text"          (default: "Buy Safely on Solely")
 *   data-solely-size="sm" | "md" | "lg"            (default: "md")
 * 
 * Events:
 *   The widget dispatches a 'solely:payment-success' CustomEvent on the container
 *   element when payment completes, with { detail: { orderId } }.
 */
(function () {
  'use strict';

  var SOLELY_ORIGIN = 'https://solelymarketplace.com';
  var WIDGET_VERSION = '1.0.0';

  // ── Styles ─────────────────────────────────────────────────────────────
  var themes = {
    dark: {
      bg: '#18181b',
      bgHover: '#27272a',
      text: '#ffffff',
      accent: '#f59e0b',
      shadow: 'rgba(0,0,0,0.2)',
    },
    amber: {
      bg: '#f59e0b',
      bgHover: '#d97706',
      text: '#ffffff',
      accent: '#ffffff',
      shadow: 'rgba(245,158,11,0.35)',
    },
    light: {
      bg: '#ffffff',
      bgHover: '#f4f4f5',
      text: '#18181b',
      accent: '#f59e0b',
      shadow: 'rgba(0,0,0,0.08)',
    },
  };

  var sizes = {
    sm: { padding: '10px 20px', fontSize: '13px', iconSize: '14', radius: '10px' },
    md: { padding: '14px 28px', fontSize: '15px', iconSize: '16', radius: '14px' },
    lg: { padding: '18px 36px', fontSize: '17px', iconSize: '18', radius: '16px' },
  };

  // ── SVG Shield Icon ────────────────────────────────────────────────────
  function shieldSVG(size, color) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>';
  }

  // ── Create Overlay & Modal ─────────────────────────────────────────────
  function createModal(linkId, container) {
    // Backdrop
    var overlay = document.createElement('div');
    overlay.setAttribute('data-solely-overlay', '');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'background:rgba(0,0,0,0.55)', 'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:12px',
      'opacity:0', 'transition:opacity 0.25s ease',
    ].join(';');

    // Frame wrapper (for border-radius clip + shadow)
    var wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'position:relative',
      'width:100%', 'max-width:560px', 'height:90vh', 'max-height:820px',
      'border-radius:20px', 'overflow:hidden',
      'box-shadow:0 25px 60px rgba(0,0,0,0.3)',
      'background:#ffffff',
      'transform:translateY(24px) scale(0.97)',
      'transition:transform 0.3s cubic-bezier(0.16,1,0.3,1)',
    ].join(';');

    // Iframe
    var iframe = document.createElement('iframe');
    iframe.src = SOLELY_ORIGIN + '/pay/' + linkId + '?embed=true';
    iframe.setAttribute('allow', 'payment');
    iframe.setAttribute('title', 'Solely Secure Checkout');
    iframe.style.cssText = 'width:100%;height:100%;border:none;background:#fff;';

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Close checkout');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = [
      'position:absolute', 'top:12px', 'right:12px', 'z-index:10',
      'width:36px', 'height:36px',
      'border-radius:50%', 'border:none',
      'background:rgba(0,0,0,0.06)', 'color:#71717a',
      'font-size:20px', 'line-height:1',
      'cursor:pointer', 'display:flex', 'align-items:center', 'justify-content:center',
      'transition:background 0.15s, color 0.15s',
    ].join(';');
    closeBtn.onmouseover = function () {
      closeBtn.style.background = 'rgba(0,0,0,0.12)';
      closeBtn.style.color = '#18181b';
    };
    closeBtn.onmouseout = function () {
      closeBtn.style.background = 'rgba(0,0,0,0.06)';
      closeBtn.style.color = '#71717a';
    };

    // Powered by badge
    var badge = document.createElement('div');
    badge.style.cssText = [
      'position:absolute', 'bottom:0', 'left:0', 'right:0',
      'background:linear-gradient(transparent,rgba(255,255,255,0.95) 40%)',
      'padding:16px 0 10px', 'text-align:center',
      'font-family:system-ui,-apple-system,sans-serif',
      'font-size:11px', 'color:#a1a1aa',
      'pointer-events:none',
      'display:flex', 'align-items:center', 'justify-content:center', 'gap:4px',
    ].join(';');
    badge.innerHTML = shieldSVG('12', '#a1a1aa') + ' Protected by <strong style="color:#52525b">Solely</strong>';

    // Assemble
    wrapper.appendChild(iframe);
    wrapper.appendChild(closeBtn);
    wrapper.appendChild(badge);
    overlay.appendChild(wrapper);

    // Close handlers
    function close() {
      overlay.style.opacity = '0';
      wrapper.style.transform = 'translateY(24px) scale(0.97)';
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 300);
    }

    closeBtn.onclick = close;
    overlay.onclick = function (e) {
      if (e.target === overlay) close();
    };

    // Escape key
    function onKey(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKey);
      }
    }
    document.addEventListener('keydown', onKey);

    // Listen for messages from the iframe
    function onMessage(e) {
      if (e.origin !== SOLELY_ORIGIN) return;
      var data = e.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'solely-payment-success') {
        // Dispatch custom event on the container
        var event = new CustomEvent('solely:payment-success', {
          detail: { orderId: data.orderId },
          bubbles: true,
        });
        container.dispatchEvent(event);

        // Show success state briefly then close
        wrapper.innerHTML = '';
        var successDiv = document.createElement('div');
        successDiv.style.cssText = [
          'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
          'height:100%', 'padding:40px', 'text-align:center',
          'font-family:system-ui,-apple-system,sans-serif',
        ].join(';');
        successDiv.innerHTML = '<div style="width:64px;height:64px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;margin-bottom:20px">'
          + '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>'
          + '</div>'
          + '<h2 style="font-size:22px;font-weight:800;color:#18181b;margin:0 0 8px">Payment Successful!</h2>'
          + '<p style="font-size:14px;color:#71717a;margin:0;max-width:300px">Your money is held safely in escrow until you confirm delivery.</p>';
        wrapper.appendChild(successDiv);
        wrapper.style.maxHeight = '400px';

        setTimeout(close, 4000);
        window.removeEventListener('message', onMessage);
      }

      if (data.type === 'solely-checkout-close') {
        close();
        window.removeEventListener('message', onMessage);
      }
    }
    window.addEventListener('message', onMessage);

    // Mount
    document.body.appendChild(overlay);

    // Animate in (next frame)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.style.opacity = '1';
        wrapper.style.transform = 'translateY(0) scale(1)';
      });
    });
  }

  // ── Create Button ──────────────────────────────────────────────────────
  function createButton(container) {
    var linkId = container.getAttribute('data-solely-link');
    if (!linkId) return;

    var themeName = container.getAttribute('data-solely-theme') || 'dark';
    var sizeName = container.getAttribute('data-solely-size') || 'md';
    var buttonText = container.getAttribute('data-solely-text') || 'Buy Safely on Solely';

    var theme = themes[themeName] || themes.dark;
    var size = sizes[sizeName] || sizes.md;

    var btn = document.createElement('button');
    btn.innerHTML = shieldSVG(size.iconSize, theme.accent) + ' ' + buttonText;
    btn.style.cssText = [
      'background:' + theme.bg,
      'color:' + theme.text,
      'padding:' + size.padding,
      'border-radius:' + size.radius,
      'border:' + (themeName === 'light' ? '1.5px solid #e4e4e7' : 'none'),
      'font-weight:700',
      'font-size:' + size.fontSize,
      'cursor:pointer',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'display:inline-flex',
      'align-items:center',
      'gap:8px',
      'transition:all 0.2s ease',
      'box-shadow:0 4px 12px ' + theme.shadow,
      'letter-spacing:-0.01em',
      'line-height:1',
      '-webkit-font-smoothing:antialiased',
    ].join(';');

    btn.onmouseover = function () {
      btn.style.background = theme.bgHover;
      btn.style.transform = 'translateY(-1px)';
      btn.style.boxShadow = '0 6px 16px ' + theme.shadow;
    };
    btn.onmouseout = function () {
      btn.style.background = theme.bg;
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 4px 12px ' + theme.shadow;
    };
    btn.onmousedown = function () {
      btn.style.transform = 'translateY(0) scale(0.98)';
    };
    btn.onmouseup = function () {
      btn.style.transform = 'translateY(-1px)';
    };

    btn.onclick = function (e) {
      e.preventDefault();
      createModal(linkId, container);
    };

    container.appendChild(btn);
  }

  // ── Init ───────────────────────────────────────────────────────────────
  function init() {
    var containers = document.querySelectorAll('[data-solely-link]');
    for (var i = 0; i < containers.length; i++) {
      if (containers[i].getAttribute('data-solely-init') === 'true') continue;
      containers[i].setAttribute('data-solely-init', 'true');
      createButton(containers[i]);
    }
  }

  // Run on DOM ready or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for programmatic use
  window.SolelyWidget = {
    version: WIDGET_VERSION,
    init: init,
    open: function (linkId) {
      var temp = document.createElement('div');
      createModal(linkId, temp);
    },
  };
})();
