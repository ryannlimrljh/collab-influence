/* shared/swing-modal.js — the influencers page's fold-out card modal, as a
   module: a panel that flies out of the element you clicked and folds back
   into it on close. One instance per page; content is handed in as HTML.

   swingModal.open({anchor, html, width, label, onClose, guard, key})
   `guard` is a function; while it returns false, Escape and the backdrop
   leave the modal open — for a form whose own popovers take Escape first.
   `key` names what is showing, so isOpen(key) lets a popup close only
   itself and not whatever replaced it in the one shared panel.
   swingModal.confirm({anchor, title, body, ok, danger, onOk}) — a small
   yes/no card in the same panel, for deletes.
   swingModal.setBody(html)   re-render the content while open
   swingModal.close() · isOpen() · panel()

   Also influencerProfile.html(rec, {avatar, extra}) — the profile view the
   influencers page shows, for any page that wants the same card. `avatar`
   is a function(img, rec) that resolves the photo; `extra` is HTML for a
   page's own section under the profile. */
(function () {
  'use strict';

  var CSS = [
    '.sw-modal{position:fixed; inset:0; z-index:450; display:none; align-items:center; justify-content:center; perspective:1200px;}',
    '.sw-modal.is-open{display:flex;}',
    '.sw-backdrop{position:absolute; inset:0; background:var(--color-canvas-warm, #f7f5f1); opacity:0; transition:opacity .32s var(--ease-standard);}',
    '.sw-modal.is-shown .sw-backdrop{opacity:.88; transition-duration:.5s;}',
    '.sw-panel{position:relative; display:flex; flex-direction:column; width:min(var(--sw-w, 480px), calc(100vw - var(--spacing-32)));',
    '  max-height:min(760px, calc(100dvh - var(--spacing-60))); background:var(--color-neutral-1); border:1px solid var(--color-neutral-3);',
    '  border-radius:var(--radius-lg); box-shadow:0 25px 50px -12px rgba(0,0,0,.25); transform-origin:top left; opacity:0; transition:opacity .3s var(--ease-standard);',
    /* Clipped to its own corners, so a form's head or a sheet's foot with
       a background of its own cannot square them off. */
    '  overflow:hidden;}',
    '.sw-modal.is-shown .sw-panel{opacity:1;}',
    '.sw-panel.is-swinging-open{animation:sw-open .8s cubic-bezier(.25,.9,.35,1) both;}',
    '.sw-panel.is-swinging-closed{animation:sw-close .55s cubic-bezier(.3,.6,.35,1) both;}',
    '@keyframes sw-open{0%{transform:translate(var(--sw-dx, 0px), var(--sw-dy, 0px)) scale(var(--sw-sx, 1), var(--sw-sy, 1)); opacity:.4;}',
    '  45%{transform:translate(calc(var(--sw-dx, 0px) * .5), calc(var(--sw-dy, 0px) * .5)) scale(.7) rotateY(calc(48deg * var(--sw-dir, 1) * var(--sw-rot, 1))) rotateZ(calc(-7deg * var(--sw-dir, 1) * var(--sw-rot, 1))); opacity:1;}',
    '  78%{transform:translate(0px, 0px) scale(1) rotateY(calc(-7deg * var(--sw-dir, 1) * var(--sw-rot, 1))) rotateZ(calc(1deg * var(--sw-dir, 1) * var(--sw-rot, 1)));} 100%{transform:none; opacity:1;}}',
    '@keyframes sw-close{0%{transform:none; opacity:1;}',
    '  50%{transform:translate(calc(var(--sw-dx, 0px) * .5), calc(var(--sw-dy, 0px) * .5)) scale(.7) rotateY(calc(45deg * var(--sw-dir, 1) * var(--sw-rot, 1))) rotateZ(calc(-6deg * var(--sw-dir, 1) * var(--sw-rot, 1))); opacity:1;}',
    '  100%{transform:translate(var(--sw-dx, 0px), var(--sw-dy, 0px)) scale(var(--sw-sx, 1), var(--sw-sy, 1)); opacity:.35;}}',
    '@media (prefers-reduced-motion:reduce){ .sw-panel.is-swinging-open, .sw-panel.is-swinging-closed{animation:none;} }',
    '.sw-close{position:absolute; top:var(--spacing-16); right:var(--spacing-16); z-index:2; background:none; border:none; cursor:pointer; padding:0; line-height:1; color:var(--color-neutral-5); font-size:20px;}',
    '.sw-close:hover{color:var(--color-neutral-9);}',
    '.sw-body{flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column;}',
    /* ── The confirm card. */
    '.sw-confirm{padding:var(--spacing-24); padding-right:var(--spacing-48);}',
    '.sw-confirm h4{margin:0 0 var(--spacing-8); font-size:var(--text-h5-size); line-height:var(--text-h5-lh); font-weight:700;}',
    '.sw-confirm p{margin:0; font-size:var(--text-body2-size); line-height:1.5; color:var(--color-neutral-7);}',
    '.sw-confirm .sw-confirm-foot{display:flex; justify-content:flex-end; gap:var(--spacing-12); margin-top:var(--spacing-20); margin-right:calc(var(--spacing-24) * -1);}',
    '.sw-confirm .is-danger{background:var(--color-red); border-color:var(--color-red);}',
    /* ── The profile view. */
    '.sw-head{display:flex; align-items:center; gap:var(--spacing-16); padding:var(--spacing-24) var(--spacing-24) var(--spacing-16); flex:none;}',
    '.sw-head .c-card-profile-avatar{width:76px; height:76px; flex:none; font-size:var(--text-h5-size); position:relative; overflow:hidden;}',
    '.sw-head .c-card-profile-avatar img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; border-radius:var(--radius-pill); opacity:0; transition:opacity var(--duration-base) var(--ease-standard);}',
    '.sw-head .c-card-profile-avatar img.is-loaded{opacity:1;}',
    '.sw-head h3{margin:0; font-size:var(--text-h4-size); line-height:var(--text-h4-lh); font-weight:var(--text-h4-weight); padding-right:var(--spacing-24);}',
    '.sw-head p{margin:4px 0 0; font-size:var(--text-body2-size); color:var(--color-neutral-5);}',
    '.sw-prof{flex:1; min-height:0; overflow-y:auto; padding:0 var(--spacing-24) var(--spacing-24);}',
    '.sw-sect{margin-top:var(--spacing-20);}',
    '.sw-sect > h5{margin:0 0 var(--spacing-8); font-size:var(--text-caption-size); line-height:var(--text-caption-lh); font-weight:700; text-transform:uppercase; letter-spacing:var(--tracking-eyebrow); color:var(--color-neutral-5);}',
    '.sw-badges{display:flex; flex-wrap:wrap; gap:6px;}',
    'dl.sw-kvs{margin:0;}',
    '.sw-kv{display:flex; gap:var(--spacing-12); padding:6px 0; font-size:var(--text-body2-size); line-height:var(--text-body2-lh);}',
    '.sw-kv dt{flex:none; width:88px; color:var(--color-neutral-5); margin:0;}',
    '.sw-kv dd{flex:1; margin:0; color:var(--color-neutral-9); overflow-wrap:anywhere;}',
    '.sw-tier{display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:var(--radius-pill); font-size:var(--text-footnote-size); font-weight:700; line-height:16px; white-space:nowrap; border:1px solid transparent;}',
    '.sw-tier .dot{width:6px; height:6px; border-radius:var(--radius-pill); flex:none; background:currentColor;}',
    '.sw-tier-seeder{background:var(--color-neutral-2); color:var(--color-neutral-5);}',
    '.sw-tier-koc{background:var(--color-neutral-2); color:var(--color-turquoise);}',
    '.sw-tier-nano{background:var(--color-wood-bg); color:var(--color-salmon-pink); border-color:color-mix(in srgb, var(--color-salmon-pink) 22%, transparent);}',
    '.sw-tier-micro{background:var(--color-earth-bg); color:var(--color-green); border-color:color-mix(in srgb, var(--color-green) 22%, transparent);}',
    '.sw-tier-mid{background:var(--color-water-bg); color:var(--color-navy); border-color:color-mix(in srgb, var(--color-navy) 22%, transparent);}',
    '.sw-tier-macro{background:var(--color-fire-bg); color:var(--color-orange); border-color:color-mix(in srgb, var(--color-orange) 22%, transparent);}',
    '.sw-tier-mega{background:var(--color-gold-bg); color:#8A5A00; border-color:color-mix(in srgb, var(--color-amber) 40%, transparent);}',
    '.sw-tier-mega .dot{background:var(--color-amber);}',
    '.sw-pii{background:var(--color-gold-bg); border-radius:var(--radius-md); padding:var(--spacing-12) var(--spacing-16);}',
    '.sw-pii-note{display:flex; align-items:center; gap:6px; font-size:var(--text-footnote-size); color:var(--color-neutral-5); margin-bottom:var(--spacing-4);}',
    '.sw-foot{display:flex; gap:var(--spacing-8); justify-content:flex-end; padding:var(--spacing-16) var(--spacing-24); flex:none; border-top:1px solid var(--color-neutral-3);}'
  ].join('\n');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function fmtFollowers(n) {
    if (n == null) return '';
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 ? 1 : 0).replace(/\.0$/, '') + 'K';
    return String(n);
  }
  function initials(name) {
    return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('') || '?';
  }

  var host = null, panel = null, body = null, srcEl = null, srcRect = null, hideTimer = null, onCloseCb = null, guard = null, curKey = null, openTicket = 0;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ensure() {
    if (host) return;
    var s = document.createElement('style'); s.id = 'sw-css'; s.textContent = CSS; document.head.appendChild(s);
    host = document.createElement('div');
    host.className = 'sw-modal'; host.setAttribute('aria-hidden', 'true');
    host.innerHTML = '<div class="sw-backdrop"></div><div class="sw-panel" role="dialog" aria-modal="true">' +
      '<button class="sw-close" type="button" aria-label="Close"><i class="ph ph-x"></i></button><div class="sw-body"></div></div>';
    document.body.appendChild(host);
    panel = host.querySelector('.sw-panel'); body = host.querySelector('.sw-body');
    host.querySelector('.sw-close').addEventListener('click', close);
    host.addEventListener('click', function (e) { if (e.target.closest('.sw-backdrop')) request(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); request(); } }, true);
  }
  function swingVars() {
    panel.classList.remove('is-swinging-open', 'is-swinging-closed');
    void panel.offsetWidth;
    var from = (srcEl && srcEl.isConnected) ? srcEl.getBoundingClientRect() : srcRect;
    if (!from) return false;
    var to = panel.getBoundingClientRect();
    /* From a small button a big panel would start as a sliver and swing
       through a full door-fold; a floor on the start scale and a rotation
       that eases off past 520px keep the flight, lose the wrench. */
    panel.style.setProperty('--sw-dx', (from.left - to.left).toFixed(1) + 'px');
    panel.style.setProperty('--sw-dy', (from.top - to.top).toFixed(1) + 'px');
    panel.style.setProperty('--sw-sx', Math.max(.3, from.width / to.width).toFixed(4));
    panel.style.setProperty('--sw-sy', Math.max(.3, from.height / to.height).toFixed(4));
    panel.style.setProperty('--sw-rot', Math.max(.5, Math.min(1, 520 / to.width)).toFixed(2));
    panel.style.setProperty('--sw-dir', (from.left + from.width / 2) <= window.innerWidth / 2 ? '1' : '-1');
    return true;
  }
  function isOpen(key) { return !!host && host.classList.contains('is-open') && (key == null || key === curKey); }
  function request() { if (guard && guard() === false) return; close(); }
  function open(o) {
    ensure();
    o = o || {};
    clearTimeout(hideTimer);
    /* Taking the panel over from another popup runs that one's cleanup. */
    if (isOpen() && onCloseCb) { var prev = onCloseCb; onCloseCb = null; prev(); }
    srcEl = o.anchor || null; srcRect = srcEl ? srcEl.getBoundingClientRect() : null;
    onCloseCb = o.onClose || null; guard = o.guard || null; curKey = o.key || null;
    panel.style.setProperty('--sw-w', (o.width || 480) + 'px');
    panel.setAttribute('aria-label', o.label || 'Details');
    body.innerHTML = o.html || '';
    host.classList.add('is-open'); host.setAttribute('aria-hidden', 'false');
    /* The flight is measured a microtask later, once the caller has put
       its content in the body — measured empty, the panel is a sliver and
       the fold starts stretched twenty times tall. */
    var ticket = ++openTicket;
    Promise.resolve().then(function () {
      if (ticket !== openTicket || !isOpen()) return;
      if (!REDUCED && swingVars()) panel.classList.add('is-swinging-open');
      host.classList.add('is-shown');
    });
    return body;
  }
  function setBody(html) { if (host) body.innerHTML = html; return body; }
  function close() {
    if (!isOpen()) return;
    if (!REDUCED && swingVars()) panel.classList.add('is-swinging-closed');
    host.classList.remove('is-shown');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      host.classList.remove('is-open'); host.setAttribute('aria-hidden', 'true');
      panel.classList.remove('is-swinging-closed');
      body.innerHTML = ''; guard = null; curKey = null;
      if (onCloseCb) { var cb = onCloseCb; onCloseCb = null; cb(); }
    }, REDUCED ? 0 : 560);
  }

  function confirm(o) {
    o = o || {};
    var b = open({
      anchor: o.anchor, width: o.width || 400, key: o.key || 'confirm', label: o.title || 'Confirm', onClose: o.onClose,
      html: '<div class="sw-confirm" role="alertdialog" aria-labelledby="swConfirmTitle"><h4 id="swConfirmTitle">' + esc(o.title || 'Are you sure?') + '</h4>' +
        '<p>' + (o.body || '') + '</p><div class="sw-confirm-foot">' +
        '<button class="c-btn c-btn-ghost c-btn-md" type="button" data-sw-no>' + esc(o.cancel || 'Cancel') + '</button>' +
        '<button class="c-btn c-btn-primary c-btn-md' + (o.danger ? ' is-danger' : '') + '" type="button" data-sw-ok>' + (o.ok || 'OK') + '</button></div></div>'
    });
    b.querySelector('[data-sw-no]').addEventListener('click', close);
    b.querySelector('[data-sw-ok]').addEventListener('click', function () { close(); if (o.onOk) o.onOk(); });
    setTimeout(function () { var n = b.querySelector('[data-sw-no]'); if (n) n.focus(); }, 200);
    return b;
  }

  window.swingModal = {
    open: open, close: close, isOpen: isOpen, setBody: setBody, confirm: confirm,
    panel: function () { ensure(); return panel; },
    body: function () { ensure(); return body; }
  };

  /* ── The profile view, the same shape the influencers page shows. */
  window.influencerProfile = {
    html: function (r, opts) {
      opts = opts || {};
      var T = window.tiers;
      var meta = [r.age, r.gender, r.ethnicity, r.location].filter(Boolean).join(' · ');
      var badges = (r.niches || []).map(function (n) { return '<span class="c-badge c-badge-neutral">' + esc(n) + '</span>'; }).join('');
      var plats = (r.platforms || []).filter(function (p) { return p.handle; }).map(function (p) {
        var t = T && T.tierOf(p.followers);
        return '<div class="sw-kv"><dt>' + esc(p.label || p.platform) + '</dt><dd>' +
          (p.link ? '<a href="' + esc(p.link) + '" target="_blank" rel="noopener" style="color:var(--color-navy)">@' + esc(p.handle) + '</a>' : '@' + esc(p.handle)) +
          (p.followers != null ? ' · ' + fmtFollowers(p.followers) + ' followers' : '') +
          (t ? ' <span class="sw-tier sw-tier-' + t.key + '">' + (t.key !== 'seeder' ? '<span class="dot"></span>' : '') + t.name + '</span>' : '') + '</dd></div>';
      }).join('');
      var pii = r.pii || {};
      return '<div class="sw-head"><span class="c-card-profile-avatar" data-avatar-for="' + esc(r.id) + '">' + esc(initials(r.name)) + '<img alt="" /></span>' +
        '<div><h3>' + esc(r.name) + '</h3><p>' + esc(meta || '—') + '</p></div></div>' +
        '<div class="sw-prof">' +
        (opts.extra || '') +
        (badges ? '<div class="sw-sect"><h5>Niches</h5><div class="sw-badges">' + badges + '</div></div>' : '') +
        (plats ? '<div class="sw-sect"><h5>Platforms</h5><dl class="sw-kvs">' + plats + '</dl></div>' : '') +
        '<div class="sw-sect"><h5>Contact — internal only</h5><div class="sw-pii">' +
          '<p class="sw-pii-note"><i class="ph ph-lock-simple"></i> Sensitive. Never shown outside this workspace.</p>' +
          '<dl class="sw-kvs">' +
          '<div class="sw-kv"><dt>Email</dt><dd>' + esc(pii.email || '—') + '</dd></div>' +
          '<div class="sw-kv"><dt>Phone</dt><dd>' + esc(pii.phone || '—') + '</dd></div>' +
          '<div class="sw-kv"><dt>Address</dt><dd>' + esc(pii.address || '—') + '</dd></div>' +
          '<div class="sw-kv"><dt>NRIC</dt><dd>' + esc(pii.nric || '—') + '</dd></div>' +
          '</dl></div></div></div>' +
        (opts.foot ? '<div class="sw-foot">' + opts.foot + '</div>' : '');
    }
  };
})();
