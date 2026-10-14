(function() {
  if (window.__chantanSelectorReady) return;
  window.__chantanSelectorReady = true;

  var active = false;
  var hoveredEl = null;
  var styleEl = null;
  var labelEl = null;
  var hoverOverlay = null;
  var outlineEls = [];

  var SELECTABLE = 'h1,h2,h3,h4,h5,h6,p,a,button,img,input,textarea,select,label,li,td,th,span,video,audio,svg,icon,figure,figcaption,blockquote,code,pre,ul,ol,nav,header,footer,main,section,form,table,article,aside,details,summary';

  function injectStyles() {
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.id = 'chantan-ve-styles';
    styleEl.textContent = [
      '.chantan-ve-outline { outline: 1.5px dashed rgba(99,102,241,0.35) !important; outline-offset: 1px; cursor: pointer !important; transition: outline 0.1s ease; }',
      '.chantan-ve-outline:hover { outline: 2px solid #6366f1 !important; outline-offset: 1px; }',
      '.chantan-ve-hover-overlay { position: fixed; pointer-events: none; background: rgba(99,102,241,0.06); border: 2px solid #6366f1; border-radius: 3px; z-index: 99998; transition: all 0.1s ease; display: none; }',
      '.chantan-ve-label { position: fixed; pointer-events: none; z-index: 99999; background: #6366f1; color: #fff; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; font-family: system-ui, -apple-system, sans-serif; white-space: nowrap; display: none; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }',
      'body.chantan-ve-active * { cursor: pointer !important; }',
      'body.chantan-ve-active { cursor: pointer !important; }',
    ].join('\n');
    document.head.appendChild(styleEl);
  }

  function createOverlayElements() {
    if (hoverOverlay) return;
    hoverOverlay = document.createElement('div');
    hoverOverlay.className = 'chantan-ve-hover-overlay';
    document.body.appendChild(hoverOverlay);
    labelEl = document.createElement('div');
    labelEl.className = 'chantan-ve-label';
    document.body.appendChild(labelEl);
  }

  function getElementName(el) {
    var tag = el.tagName.toLowerCase();
    var role = el.getAttribute('role') || '';
    if (tag === 'button' || role === 'button') return 'Button';
    if (tag === 'a') return 'Link';
    if (tag === 'img') return 'Image';
    if (tag === 'input') return 'Input (' + (el.type || 'text') + ')';
    if (tag === 'textarea') return 'Text Area';
    if (tag === 'select') return 'Select';
    if (/^h[1-6]$/.test(tag)) return 'Heading ' + tag[1];
    if (tag === 'p') return 'Paragraph';
    if (tag === 'span') return 'Text';
    if (tag === 'nav') return 'Navigation';
    if (tag === 'header') return 'Header';
    if (tag === 'footer') return 'Footer';
    if (tag === 'main') return 'Main';
    if (tag === 'section') return 'Section';
    if (tag === 'article') return 'Article';
    if (tag === 'aside') return 'Sidebar';
    if (tag === 'form') return 'Form';
    if (tag === 'table') return 'Table';
    if (tag === 'ul' || tag === 'ol') return 'List';
    if (tag === 'li') return 'List Item';
    if (tag === 'label') return 'Label';
    if (tag === 'figure') return 'Figure';
    if (tag === 'figcaption') return 'Caption';
    if (tag === 'blockquote') return 'Quote';
    if (tag === 'code' || tag === 'pre') return 'Code';
    if (tag === 'video') return 'Video';
    if (tag === 'audio') return 'Audio';
    if (tag === 'svg') return 'Icon';
    if (tag === 'td' || tag === 'th') return 'Table Cell';
    if (tag === 'details') return 'Details';
    if (tag === 'summary') return 'Summary';
    return tag;
  }

  function getElementText(el) {
    var tag = el.tagName.toLowerCase();
    var ariaLabel = el.getAttribute('aria-label') || '';
    if (ariaLabel) return ariaLabel.substring(0, 40);
    var placeholder = el.getAttribute('placeholder') || '';
    if (placeholder) return placeholder.substring(0, 40);
    var alt = el.getAttribute('alt') || '';
    if (alt) return alt.substring(0, 40);
    if (/^(button|a|span|label|li|summary|h[1-6]|p|figcaption|blockquote|td|th)$/.test(tag)) {
      var text = (el.textContent || '').trim();
      if (text.length > 50) text = text.substring(0, 47) + '...';
      return text;
    }
    return '';
  }

  function findSection(el) {
    var current = el.parentElement;
    var depth = 0;
    while (current && depth < 10) {
      var tag = current.tagName ? current.tagName.toLowerCase() : '';
      if (tag === 'header' || tag === 'nav') return 'Header';
      if (tag === 'footer') return 'Footer';
      if (tag === 'main') return 'Main content';
      if (tag === 'aside') return 'Sidebar';
      if (tag === 'section') {
        var heading = current.querySelector('h1,h2,h3');
        if (heading) return heading.textContent.trim().substring(0, 40);
        return 'Section';
      }
      if (current.getAttribute && current.getAttribute('role') === 'banner') return 'Header';
      if (current.getAttribute && current.getAttribute('role') === 'contentinfo') return 'Footer';
      if (current.getAttribute && current.getAttribute('role') === 'navigation') return 'Navigation';
      current = current.parentElement;
      depth++;
    }
    return 'Page';
  }

  function getFullDescription(el) {
    return {
      tag: el.tagName.toLowerCase(),
      name: getElementName(el).toLowerCase(),
      text: getElementText(el),
      section: findSection(el),
      classes: (el.className || '').toString().substring(0, 200),
      id: el.id || '',
      role: el.getAttribute('role') || '',
    };
  }

  function formatLabel(el) {
    var name = getElementName(el);
    var text = getElementText(el);
    if (text) return name + ' \u2014 "' + text + '"';
    return name;
  }

  function showOutlines() {
    var els = document.querySelectorAll(SELECTABLE);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.offsetWidth < 8 || el.offsetHeight < 8) continue;
      if (el.closest('.chantan-ve-hover-overlay, .chantan-ve-label')) continue;
      if (el.id && el.id.indexOf('chantan') === 0) continue;
      el.classList.add('chantan-ve-outline');
      outlineEls.push(el);
    }
  }

  function hideOutlines() {
    for (var i = 0; i < outlineEls.length; i++) {
      outlineEls[i].classList.remove('chantan-ve-outline');
    }
    outlineEls = [];
  }

  function handleMouseOver(e) {
    if (!active) return;
    var target = e.target;
    while (target && target !== document.body && !target.classList.contains('chantan-ve-outline')) {
      target = target.parentElement;
    }
    if (!target || target === document.body) {
      if (hoverOverlay) hoverOverlay.style.display = 'none';
      if (labelEl) labelEl.style.display = 'none';
      hoveredEl = null;
      return;
    }
    if (target === hoveredEl) return;
    hoveredEl = target;
    var rect = target.getBoundingClientRect();
    hoverOverlay.style.display = 'block';
    hoverOverlay.style.left = (rect.left - 1) + 'px';
    hoverOverlay.style.top = (rect.top - 1) + 'px';
    hoverOverlay.style.width = (rect.width + 2) + 'px';
    hoverOverlay.style.height = (rect.height + 2) + 'px';
    var labelText = formatLabel(target);
    labelEl.textContent = labelText;
    labelEl.style.display = 'block';
    var labelTop = rect.top - 24;
    if (labelTop < 4) labelTop = rect.bottom + 4;
    labelEl.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 200)) + 'px';
    labelEl.style.top = labelTop + 'px';
  }

  function handleMouseOut(e) {
    if (!active) return;
    var related = e.relatedTarget;
    if (hoveredEl && hoveredEl.contains(related)) return;
    if (hoverOverlay) hoverOverlay.style.display = 'none';
    if (labelEl) labelEl.style.display = 'none';
    hoveredEl = null;
  }

  function handleClick(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    var target = e.target;
    while (target && target !== document.body && !target.classList.contains('chantan-ve-outline')) {
      target = target.parentElement;
    }
    if (!target || target === document.body) return;
    var desc = getFullDescription(target);
    window.parent.postMessage({ type: 'chantan:element-selected', data: desc }, '*');
    deactivate();
  }

  function activate() {
    if (active) return;
    active = true;
    injectStyles();
    createOverlayElements();
    document.body.classList.add('chantan-ve-active');
    showOutlines();
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    window.parent.postMessage({ type: 'chantan:selector-active' }, '*');
  }

  function deactivate() {
    active = false;
    hoveredEl = null;
    document.body.classList.remove('chantan-ve-active');
    hideOutlines();
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('mouseout', handleMouseOut, true);
    document.removeEventListener('click', handleClick, true);
    if (hoverOverlay) hoverOverlay.style.display = 'none';
    if (labelEl) labelEl.style.display = 'none';
    window.parent.postMessage({ type: 'chantan:selector-inactive' }, '*');
  }

  function normalizeNavigationPath(value) {
    if (typeof value !== 'string') return null;
    var path = value.trim();
    if (!path || path.charAt(0) !== '/') return null;
    if (path.indexOf('//') === 0) return null;
    return path;
  }

  function navigateWithinPreview(path) {
    var nextPath = normalizeNavigationPath(path);
    if (!nextPath) return;
    try {
      var current = location.pathname + location.search + location.hash;
      if (current !== nextPath) {
        history.pushState(null, '', nextPath);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      reportPath();
    } catch (e) {}
  }

  function shouldHandleInternalLink(e, anchor) {
    if (!anchor || e.defaultPrevented) return false;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (anchor.hasAttribute('download')) return false;
    var target = (anchor.getAttribute('target') || '').toLowerCase();
    if (target && target !== '_self') return false;
    try {
      var next = new URL(anchor.getAttribute('href') || '', location.href);
      if (next.origin !== location.origin) return false;
      return normalizeNavigationPath(next.pathname + next.search + next.hash) !== null;
    } catch (err) {
      return false;
    }
  }

  document.addEventListener('click', function(e) {
    if (active) return;
    var anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!shouldHandleInternalLink(e, anchor)) return;
    e.preventDefault();
    try {
      var next = new URL(anchor.getAttribute('href'), location.href);
      navigateWithinPreview(next.pathname + next.search + next.hash);
    } catch (err) {}
  }, true);

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'chantan:start-selector') activate();
    if (e.data && e.data.type === 'chantan:stop-selector') deactivate();
    if (e.data && e.data.type === 'chantan:navigate') navigateWithinPreview(e.data.path);
  });

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && active) deactivate();
  });

  // ─── Vite Error Detection ───
  // Detect Vite error overlays and report to parent so Chantan can show Auto-fix
  var errorReported = false;

  function extractViteError(overlay) {
    try {
      var shadow = overlay.shadowRoot;
      if (!shadow) return null;
      // Vite 5/6 error overlay structure
      var msgEl = shadow.querySelector('.message-body') || shadow.querySelector('.message');
      var fileEl = shadow.querySelector('.file') || shadow.querySelector('.tip .file-link');
      var msg = msgEl ? msgEl.textContent.trim() : '';
      var file = fileEl ? fileEl.textContent.trim() : '';
      if (!msg && !file) {
        // Fallback: get all text from first few elements
        var allText = shadow.textContent || '';
        msg = allText.substring(0, 500).trim();
      }
      if (file && msg.indexOf(file) === -1) msg = msg + ' in ' + file;
      // Keep only first 2 lines (error + file) — skip stack trace
      var lines = msg.split('\n').filter(function(l) { return l.trim(); });
      return lines.slice(0, 3).join(' ').substring(0, 400);
    } catch (e) {
      return 'Build error detected in preview';
    }
  }

  function reportViteError(overlay) {
    if (errorReported) return;
    var errMsg = extractViteError(overlay);
    if (errMsg) {
      errorReported = true;
      window.parent.postMessage({ type: 'vite-error', err: { message: errMsg } }, '*');
      // Reset after 5s so new errors can be reported
      setTimeout(function() { errorReported = false; }, 5000);
    }
  }

  // Watch for vite-error-overlay appearing in DOM
  var errorObserver = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.tagName && node.tagName.toLowerCase() === 'vite-error-overlay') {
          // Delay slightly to let shadow DOM render
          setTimeout(function() { reportViteError(node); }, 200);
        }
      }
    }
  });
  errorObserver.observe(document.documentElement, { childList: true, subtree: true });

  // Also check if error overlay already exists on load
  setTimeout(function() {
    var existing = document.querySelector('vite-error-overlay');
    if (existing) reportViteError(existing);
  }, 500);

  // ─── Route change reporter ───
  // Posts the iframe's current pathname to the Chantan parent whenever the
  // SPA navigates, so the URL box in the preview toolbar stays in sync.
  // Needed because cross-origin iframes block parent.location reads.
  var lastReportedPath = null;

  function reportPath() {
    try {
      var path = location.pathname + location.search + location.hash;
      if (path === lastReportedPath) return;
      lastReportedPath = path;
      window.parent.postMessage({ type: 'chantan:route-change', path: path }, '*');
    } catch (e) {}
  }

  // Report current path on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reportPath);
  } else {
    reportPath();
  }

  // Patch pushState/replaceState — browsers don't emit events for these,
  // and React Router / SPAs use them for every navigation.
  try {
    var origPushState = history.pushState;
    var origReplaceState = history.replaceState;
    history.pushState = function() {
      origPushState.apply(this, arguments);
      reportPath();
    };
    history.replaceState = function() {
      origReplaceState.apply(this, arguments);
      reportPath();
    };
  } catch (e) {}

  // Back / forward navigation
  window.addEventListener('popstate', reportPath);
  // Hash routing fallback
  window.addEventListener('hashchange', reportPath);
})();
