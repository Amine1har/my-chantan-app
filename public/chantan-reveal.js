/* chantan-reveal v1 — platform scroll-reveal runtime. NOT part of the app's code.
   Reveals elements carrying class "reveal" as they enter the viewport, for both
   server-rendered markup and nodes React mounts later.

   FAIL-OPEN CONTRACT (do not weaken):
   - The CSS hide-gate (html.reveal-js — see index.css) is armed ONLY as the
     very last statement of the success path, after every observer is live.
   - Every bail path DISARMS the gate and force-reveals all present and future
     .reveal nodes, because a project may also carry a foreign inline reveal
     script that armed the gate before (or after) this file ran.
   - Net effect: any failure anywhere degrades to "no animation", never to
     invisible content. */
(function () {
  'use strict';
  var doc = document;

  // Force-visible mode: disarm the gate now and keep neutralizing it forever —
  // a foreign script may re-arm the gate or mount hidden nodes after us.
  function bail() {
    try {
      var reveal = function () {
        // GUARDED writes only: an unconditional classList.remove/add would
        // re-fire this same class-attribute observer forever (infinite loop).
        var html = doc.documentElement;
        if (html.classList.contains('reveal-js')) html.classList.remove('reveal-js');
        var els = doc.querySelectorAll('.reveal:not(.is-visible)');
        for (var i = 0; i < els.length; i++) els[i].classList.add('is-visible');
      };
      reveal();
      if (doc.body) new MutationObserver(reveal).observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    } catch (e) { /* nothing left to do — the base CSS default is visible */ }
  }

  function boot(armAllowed) {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return bail();
      if (!('IntersectionObserver' in window) || !doc.body) return bail();

      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          // Tall elements (mobile product grids) may never reach the 12%
          // ratio — treat any intersection of a >=half-viewport element as in.
          if (e.isIntersecting && (e.intersectionRatio >= 0.12 || e.boundingClientRect.height >= window.innerHeight * 0.5)) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }
      }, { threshold: [0, 0.12], rootMargin: '0px 0px -10% 0px' });

      var track = function (el) {
        if (el.classList && !el.classList.contains('is-visible')) io.observe(el);
      };
      var scan = function (node) {
        if (!node || node.nodeType !== 1) return;
        if (node.classList && node.classList.contains('reveal')) track(node);
        if (node.querySelectorAll) node.querySelectorAll('.reveal').forEach(track);
      };
      scan(doc.body);
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type === 'attributes') { scan(m.target); continue; } // re-render stripped is-visible
          for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
        }
      }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

      // Watchdog: anything intersecting the viewport but still hidden a beat
      // after load gets revealed (frozen scroll drivers, missed IO callbacks).
      window.addEventListener('load', function () {
        setTimeout(function () {
          var els = doc.querySelectorAll('.reveal:not(.is-visible)');
          for (var i = 0; i < els.length; i++) {
            var r = els[i].getBoundingClientRect();
            if (r.bottom > 0 && r.top < window.innerHeight) els[i].classList.add('is-visible');
          }
        }, 4000);
      });

      if (!armAllowed) return; // late boot (tag moved into <head>): animate nothing rather than flash paint-then-hide

      // The hide/show CSS pair is platform-owned too — appended here so a
      // rewritten project index.css can never end up with hide-without-show.
      var style = doc.createElement('style');
      style.textContent = 'html.reveal-js .reveal{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s cubic-bezier(.22,1,.36,1)}html.reveal-js .reveal.is-visible{opacity:1;transform:none}';
      doc.head.appendChild(style);

      // Success path complete — arming is the LAST statement.
      doc.documentElement.classList.add('reveal-js');
    } catch (e) { bail(); }
  }

  if (doc.body) boot(true);
  else doc.addEventListener('DOMContentLoaded', function () { boot(false); });
})();
