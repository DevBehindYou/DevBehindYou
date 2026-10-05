/* ==========================================================================
   DevBehindYou: analytics consent
   Google Analytics 4 loads only after a visitor clicks "Allow analytics".
   Before that, the page makes no request to Google at all (fonts are
   self-hosted too). The choice is stored in localStorage under dby-consent.

   Also sends one GA4 event per hand-off click (any link with data-goal),
   which is how the KPI "hand-off clicks" is measured. Nothing is sent
   without consent.

   Plain script, no module: it must work even if main.js fails to load.
   ========================================================================== */
(function () {
  'use strict';

  var GA_ID = 'G-RY0471FCXN';
  var KEY = 'dby-consent';
  var loaded = false;

  function getChoice() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function setChoice(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* private mode: choice lasts this visit */ }
  }

  function loadAnalytics() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  function banner() { return document.getElementById('consent'); }

  function showBanner() {
    var b = banner();
    if (!b) return;
    b.hidden = false;
  }

  function hideBanner() {
    var b = banner();
    if (b) b.hidden = true;
  }

  function decide(value) {
    setChoice(value);
    hideBanner();
    if (value === 'granted') {
      loadAnalytics();
    } else if (loaded) {
      // Already loaded this visit: stop further collection and clear GA cookies.
      window['ga-disable-' + GA_ID] = true;
      document.cookie.split(';').forEach(function (c) {
        var name = c.split('=')[0].trim();
        if (name.indexOf('_ga') === 0) {
          document.cookie = name + '=; Max-Age=0; path=/; domain=' + location.hostname;
          document.cookie = name + '=; Max-Age=0; path=/';
        }
      });
    }
  }

  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!(target instanceof Element)) return;

    var choice = target.closest('[data-consent]');
    if (choice) {
      decide(choice.getAttribute('data-consent'));
      return;
    }
    if (target.closest('[data-consent-open]')) {
      showBanner();
      var first = banner() && banner().querySelector('button');
      if (first) first.focus();
      return;
    }

    var goal = target.closest('a[data-goal]');
    if (goal && loaded && typeof window.gtag === 'function') {
      window.gtag('event', 'handoff_click', {
        goal: goal.getAttribute('data-goal'),
        link_url: goal.href,
        transport_type: 'beacon',
      });
    }
  });

  function init() {
    var choice = getChoice();
    if (choice === 'granted') loadAnalytics();
    else if (choice !== 'denied') showBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
