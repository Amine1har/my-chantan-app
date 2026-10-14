(function() {
  if (window.parent === window) return;
  if (window.__chantanConsoleReady) return;
  window.__chantanConsoleReady = true;

  var MAX_MSG_LENGTH = 2000;
  var DEBOUNCE_MS = 500;
  var lastMessages = {};

  // ── Broken-preview signal (drives the parent "Fix it for me" card) ──
  // Collected uncaught errors + a one-shot "the preview is broken" report.
  // The card is for a true blank/broken preview, not every transient console
  // error from Vite/HMR while files are being rewritten. Console messages are
  // still forwarded for diagnostics; only a still-empty root arms auto-fix.
  var collectedErrors = [];
  var brokenReported = false;
  var sawConsoleError = false;
  var lastErrorAt = 0;
  var lastBrokenAt = 0;
  var recoveryTimer = null;

  function truncate(str) {
    if (typeof str !== 'string') {
      try { str = JSON.stringify(str); } catch (e) { str = String(str); }
    }
    if (str.length > MAX_MSG_LENGTH) return str.substring(0, MAX_MSG_LENGTH) + '…[truncated]';
    return str;
  }

  function isDuplicate(level, msg) {
    var key = level + ':' + msg;
    var now = Date.now();
    if (lastMessages[key] && (now - lastMessages[key]) < DEBOUNCE_MS) {
      return true;
    }
    lastMessages[key] = now;
    return false;
  }

  function argsToString(args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) {
      var arg = args[i];
      if (typeof arg === 'string') {
        parts.push(arg);
      } else if (arg instanceof Error) {
        parts.push(arg.message || String(arg));
      } else {
        try { parts.push(JSON.stringify(arg)); } catch (e) { parts.push(String(arg)); }
      }
    }
    return parts.join(' ');
  }

  function postConsoleMessage(level, message, extra) {
    var msg = truncate(message);
    if (isDuplicate(level, msg)) return;
    var payload = {
      type: 'chantan:console',
      level: level,
      message: msg,
      timestamp: Date.now()
    };
    if (extra) {
      if (extra.stack) payload.stack = truncate(extra.stack);
      if (extra.source) payload.source = extra.source;
      if (extra.line) payload.line = extra.line;
    }
    window.parent.postMessage(payload, '*');
  }

  function recordError(message, extra) {
    lastErrorAt = Date.now();
    var e = { message: truncate(message) };
    if (extra) {
      if (extra.stack) e.stack = truncate(extra.stack);
      if (extra.source) e.source = extra.source;
      if (extra.line) e.line = extra.line;
    }
    collectedErrors.push(e);
    if (collectedErrors.length > 10) collectedErrors.shift();
  }

  function postRecovered() {
    try {
      window.parent.postMessage({
        type: 'chantan:preview-recovered',
        timestamp: Date.now()
      }, '*');
    } catch (e) { /* ignore */ }
    collectedErrors = [];
    sawConsoleError = false;
    lastBrokenAt = 0;
    brokenReported = false;
  }

  function rootHasContent() {
    var r = document.getElementById('root');
    if (!r) return false;
    return r.children.length > 0 || (r.textContent || '').trim() !== '';
  }

  function scheduleRecoveryCheck() {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = setTimeout(function () {
      recoveryTimer = null;
      if (!lastBrokenAt) return;
      if (!rootHasContent()) return;
      if (Date.now() - lastErrorAt < 2000) {
        scheduleRecoveryCheck();
        return;
      }
      postRecovered();
    }, 2500);
  }

  // Tell the Chantan parent the preview is broken. One-shot, re-armed after 8s
  // so a later distinct breakage can surface again. Only fires when we actually
  // have a captured error — a momentarily empty page during mount is not broken.
  function reportBroken() {
    if (brokenReported || collectedErrors.length === 0) return;
    brokenReported = true;
    lastBrokenAt = Date.now();
    try {
      window.parent.postMessage({
        type: 'chantan:preview-broken',
        timestamp: lastBrokenAt,
        errors: collectedErrors.slice(-6)
      }, '*');
    } catch (e) { /* ignore */ }
    scheduleRecoveryCheck();
    setTimeout(function() { brokenReported = false; }, 8000);
  }

  function rootIsEmpty() {
    var r = document.getElementById('root');
    if (!r) return false; // unknown mount target — don't assume broken
    return r.children.length === 0 && (r.textContent || '').trim() === '';
  }

  // White-page safety net: the app failed to render (#root empty) AND an error
  // was seen. `includeConsole` lets the later check also count console errors
  // (Vite compile errors with overlay off) — gated to the later pass so a slow
  // app that logs an error but still mounts isn't flagged prematurely.
  function checkWhitePage(includeConsole) {
    if (!rootIsEmpty()) {
      scheduleRecoveryCheck();
      return;
    }
    if (collectedErrors.length === 0) {
      if (includeConsole && sawConsoleError) {
        collectedErrors.push({ message: 'The app failed to load (errors were logged to the console).' });
      } else {
        return;
      }
    }
    reportBroken();
  }

  function checkWhitePageSoon(includeConsole) {
    setTimeout(function () { checkWhitePage(includeConsole); }, 250);
    setTimeout(function () { checkWhitePage(includeConsole); }, 1000);
  }

  function startRecoveryObserver() {
    var observeTarget = document.getElementById('root') || document.documentElement;
    if (!observeTarget || typeof MutationObserver === 'undefined') return;
    var observer = new MutationObserver(function () {
      if (lastBrokenAt && rootHasContent()) scheduleRecoveryCheck();
    });
    try {
      observer.observe(observeTarget, { childList: true, subtree: true, characterData: true });
    } catch (e) { /* ignore */ }
  }

  // Override console methods
  var levels = ['log', 'warn', 'error', 'info'];
  for (var i = 0; i < levels.length; i++) {
    (function(level) {
      var original = console[level];
      console[level] = function() {
        var message = argsToString(arguments);
        if (level === 'error') sawConsoleError = true;
        postConsoleMessage(level, message);
        return original.apply(console, arguments);
      };
    })(levels[i]);
  }

  // Capture window.onerror
  window.onerror = function(message, source, line, col, error) {
    recordError(String(message), {
      stack: error && error.stack ? error.stack : undefined,
      source: source,
      line: line
    });
    postConsoleMessage('error', String(message), {
      stack: error && error.stack ? error.stack : undefined,
      source: source,
      line: line
    });
    checkWhitePageSoon(false);
  };

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    var reason = e.reason;
    var message = 'Unhandled Promise Rejection';
    var stack;
    if (reason instanceof Error) {
      message = reason.message || message;
      stack = reason.stack;
    } else if (typeof reason === 'string') {
      message = reason;
    } else {
      try { message = JSON.stringify(reason); } catch (err) { /* ignore */ }
    }
    recordError(message, { stack: stack });
    postConsoleMessage('error', message, { stack: stack });
    checkWhitePageSoon(false);
  });

  // Resource-load failures (a failed module/stylesheet usually means a broken
  // build) fire 'error' on the element, not window.onerror — catch them on the
  // capture phase. A failed image is NOT treated as a broken preview.
  window.addEventListener('error', function(e) {
    var t = e && e.target;
    if (!t || t === window) return; // runtime exceptions handled by window.onerror
    var tag = t.tagName ? t.tagName.toUpperCase() : '';
    if (tag === 'SCRIPT' || tag === 'LINK') {
      recordError('Failed to load ' + tag.toLowerCase() + ': ' + (t.src || t.href || 'unknown'));
      checkWhitePageSoon(false);
    }
  }, true);

  // If an error was seen and the app never rendered, surface the fix card.
  // Early pass: only uncaught errors (strong signal). Later passes give a slow
  // app time to mount before a console error (e.g. a Vite compile error) counts.
  setTimeout(function () { checkWhitePage(false); }, 1500);
  setTimeout(function () { checkWhitePage(true); }, 4000);
  setTimeout(function () { checkWhitePage(true); }, 7000);
  setTimeout(startRecoveryObserver, 0);
  window.addEventListener('load', function () { setTimeout(scheduleRecoveryCheck, 1500); });
})();
