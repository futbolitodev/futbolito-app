// [RATE-v1] 11/11/2026 — Demande de note Futbolito, autonome (chargé par index.html).
// 1) Fenêtre de notation OFFICIELLE (Apple / Google) au bon moment : juste après une
//    victoire fraîche au joueur du jour en 3 essais ou moins, ou à 3+ jours de série.
//    Jamais avant 2 victoires, une fois tous les 120 jours max. Aucune question avant,
//    aucune récompense, aucun « 5 étoiles » : c'est ce qu'imposent Apple et Google.
//    Ne fait rien tant que l'app native n'a pas le module InAppReview (version 1.3.2+).
// 2) Ligne « Noter Futbolito » dans le Profil, qui ouvre la page d'avis du store.
(function () {
  'use strict';
  var K_WINS = 'fb_rate_wins', K_LAST = 'fb_rate_last';
  var DAY = 86400000;
  var cap = function () { return window.Capacitor; };
  var isNative = function () { try { return !!(cap() && cap().isNativePlatform && cap().isNativePlatform()); } catch (_) { return false; } };
  var platform = function () { try { return cap().getPlatform(); } catch (_) { return 'web'; } };
  var get = function (k) { try { return localStorage.getItem(k); } catch (_) { return null; } };
  var set = function (k, v) { try { localStorage.setItem(k, String(v)); } catch (_) {} };
  var isEN = function () {
    var l = get('futbolito_language') || (navigator.language || 'fr');
    return String(l).toLowerCase().indexOf('en') === 0;
  };

  var reviewPlugin = function () {
    try {
      if (!isNative()) return null;
      if (cap().isPluginAvailable && !cap().isPluginAvailable('InAppReview')) return null;
      return (cap().Plugins && cap().Plugins.InAppReview) || null;
    } catch (_) { return null; }
  };

  var maybeAskReview = function (data) {
    try {
      if (!data || data.alreadyCounted) return;            // seulement une victoire fraîche
      var wins = Number(get(K_WINS) || 0) + 1;
      set(K_WINS, wins);
      var base = data.points && Number(data.points.base);
      var good = (base >= 90) || Number(data.streak || 0) >= 3; // ≤ 3 essais ou série ≥ 3
      if (!good || wins < 2) return;
      var last = Number(get(K_LAST) || 0);
      if (last && Date.now() - last < 120 * DAY) return;
      var plugin = reviewPlugin();
      if (!plugin || !plugin.requestReview) return;          // anciennes versions : rien
      set(K_LAST, Date.now());
      setTimeout(function () { try { plugin.requestReview(); } catch (_) {} }, 2500);
    } catch (_) {}
  };

  // Observe la réponse de dailyWinV3 (victoire enregistrée par le serveur).
  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var p = origFetch.apply(this, arguments);
      if (url.indexOf('/functions/v1/dailyWinV3') !== -1) {
        p.then(function (res) {
          if (!res || !res.ok) return;
          res.clone().json().then(maybeAskReview).catch(function () {});
        }).catch(function () {});
      }
      return p;
    };
  }

  // ── Ligne « Noter Futbolito » dans le Profil ──
  var STAR = 'M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z';
  var storeUrl = function () {
    var pf = platform();
    if (pf === 'ios') return 'itms-apps://itunes.apple.com/app/id6767530268?action=write-review';
    if (pf === 'android') return 'market://details?id=com.futbolito.game';
    return 'https://apps.apple.com/app/id6767530268?action=write-review';
  };
  var openStore = function () {
    try { window.open(storeUrl(), isNative() ? '_system' : '_blank', 'noopener,noreferrer'); } catch (_) {}
  };
  var addRateRow = function () {
    if (location.pathname.indexOf('/ProfilV3') !== 0) return;
    if (document.querySelector('[data-fb-rate]')) return;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var n, langRow = null;
    while ((n = w.nextNode())) {
      if (/^(Langue|Language)$/.test(n.nodeValue.trim())) {
        langRow = n.parentElement && n.parentElement.closest('button');
        if (langRow) break;
      }
    }
    if (!langRow || !langRow.parentElement) return;
    var row = langRow.cloneNode(true);
    row.setAttribute('data-fb-rate', '1');
    var spans = row.querySelectorAll('span');
    if (spans[0]) spans[0].textContent = isEN() ? 'Rate Futbolito' : 'Noter Futbolito';
    if (spans[1]) spans[1].textContent = '';
    var path = row.querySelector('svg path');
    if (path) { path.setAttribute('d', STAR); path.setAttribute('stroke', '#ffc800'); }
    row.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openStore(); });
    langRow.parentElement.insertBefore(row, langRow.nextSibling);
  };
  var start = function () {
    addRateRow();
    try { new MutationObserver(addRateRow).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
