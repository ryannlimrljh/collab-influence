/* The pods, as one map, rendered by every Collabrium app from this one
   file. Three copies exist (one per repository) and they must stay
   identical: the whole point is that no app can disagree with another
   about what the other apps contain.

   The shape: a strip of boxed initials under the logo, one box per pod.
   It is the way across, and it costs one row however long the pod's
   own menu grows beneath it, which is the whole reason it sits there:
   anything placed after a real pod menu lands below the fold. The pod
   you are in is the filled box; hover or focus any box and a tip gives
   the pod's full name and what it does; the grey boxes are pods with
   no workspace yet. Collapsed, the strip keeps only this pod's box and
   a click on it opens the pods as a flyout beside the rail.

   Below the strip, this pod's own menu on two shelves: Workspace for
   the modules people work in, General for the library they look things
   up in. The pods' real builds carry their own menus; they take the
   strip alone. Entries with no path are real places in a pod's IA that
   have no page yet; they render dimmed rather than vanish, so the map
   stays honest. The own pod links relatively, so a local copy never
   leaves localhost; every other pod links to its deployed address. */
(function () {
'use strict';

var PODS = [
  { key: 'collabrium', label: 'Collabrium', initials: 'C', tint: 'neutral',
    about: 'The group home: the leadership board, feedback and the assistant.',
    base: 'https://app-shell-intro.vercel.app/pages/',
    entries: [
      { label: 'Dashboard', path: 'landing-v3.html',  group: 'workspace' },
      { label: 'Feedback',  path: 'feedback-v1.html', group: 'general' }
    ] },
  { key: 'sales', label: 'Collab:Sales', initials: 'S', tint: 'gold',
    about: 'Client intelligence, campaigns and proposals.',
    base: 'https://collab-sales-ui.vercel.app/',
    /* the two doors the hero cards already use; Collab:Sales renders
       client-side, so its full menu waits on its owners */
    entries: [
      { label: 'Proposals',           path: 'proposals',           group: 'workspace' },
      { label: 'Client intelligence', path: 'client-intelligence', group: 'general' }
    ] },
  { key: 'media', label: 'Collab:Media', initials: 'M', tint: 'water',
    about: 'Media plans, ad formats and audiences.',
    base: 'https://collab-media.vercel.app/pages/',
    entries: [
      { label: 'New media plan', path: 'planner.html',       also: ['planner-v1.html'],       group: 'workspace' },
      { label: 'My media plans', path: 'campaign-list.html', also: ['campaigns.html'],        group: 'workspace' },
      { label: 'Ad formats',     path: 'formats.html',       also: ['formats-original.html'], group: 'general' },
      { label: 'Audiences',      path: 'audiences.html',                                      group: 'general' }
    ] },
  { key: 'influence', label: 'Collab:Influence', initials: 'I', tint: 'earth',
    about: 'Creators, campaigns, agencies and brands.',
    base: 'https://collab-influence.vercel.app/pages/',
    entries: [
      { label: 'Influencers', path: 'influencers-v2.html', also: ['influencers.html'], group: 'workspace' },
      { label: 'Campaigns',   path: 'campaigns.html',      also: ['campaign.html'],    group: 'workspace' },
      { label: 'Agencies',    path: null,                                              group: 'general' },
      { label: 'Brands',      path: null,                                              group: 'general' }
    ] },
  { key: 'studio',  label: 'Collab:Studio',  initials: 'St', tint: 'fire', soon: true,
    about: 'Production and creative delivery. Not built yet.' },
  { key: 'content', label: 'Collab:Content', initials: 'Co', tint: 'wood', soon: true,
    about: 'Content scheduling and publishing. Not built yet.' }
];

/* A pod's menu has two shelves: the modules people work in, and the
   library they look things up in. Order here is render order. */
var GROUPS = [
  { key: 'workspace', label: 'Workspace' },
  { key: 'general',   label: 'General' }
];

var tree = document.getElementById('podsNav');
if (!tree) return;
var here = tree.getAttribute('data-pod');
var page = (location.pathname.split('/').pop() || '').split('?')[0];
var nav = tree.closest('.c-sidebar');
var collapsed = function () { return !!(nav && nav.classList.contains('is-collapsed')); };

function isPage(entry) {
  return entry.path === page || (entry.also || []).indexOf(page) >= 0;
}
/* A pod's front door is its first built entry. */
function door(pod) {
  var e = (pod.entries || []).filter(function (x) { return x.path; })[0];
  return e ? e.path : null;
}
function href(pod) {
  return pod.key === here ? door(pod) : pod.base + door(pod);
}
function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
/* The box. As a link in the strip; as a plain mark inside a flyout row,
   where the row itself is the link. */
function chip(pod, decorative) {
  var c = (pod.soon || decorative) ? el('span', 'c-pod-chip' + (pod.soon ? ' soon' : '')) : el('a', 'c-pod-chip');
  c.classList.add('tint-' + pod.tint);
  c.textContent = pod.initials;
  if (decorative) { c.setAttribute('aria-hidden', 'true'); return c; }
  c.setAttribute('aria-label', pod.label + '. ' + pod.about);
  if (pod.soon) c.setAttribute('aria-disabled', 'true'); else c.href = href(pod);
  return c;
}

/* ── The tip: one fixed element, shared by every box ─────────────── */
var tip = null;
function showTip(anchor, pod) {
  if (fly && fly.classList.contains('is-open')) return;
  if (!tip) {
    tip = el('div', 'c-pod-tip');
    tip.setAttribute('role', 'tooltip');
    tip.appendChild(el('b'));
    tip.appendChild(el('span'));
    document.body.appendChild(tip);
  }
  tip.firstChild.textContent = pod.label;
  tip.lastChild.textContent = pod.about;
  var r = anchor.getBoundingClientRect();
  tip.style.left = '0px'; tip.style.top = '0px';
  var w = tip.offsetWidth, h = tip.offsetHeight;
  var left, top;
  if (collapsed() && nav) {
    /* beside the rail, like the DS's own hover label */
    left = nav.getBoundingClientRect().right + 8;
    top = r.top + (r.height - h) / 2;
  } else {
    left = r.left;
    top = r.bottom + 8;
  }
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
  tip.classList.add('is-visible');
}
function hideTip() { if (tip) tip.classList.remove('is-visible'); }

/* ── The flyout: the pods as rows, for the collapsed rail ────────── */
var fly = null;
function buildFly() {
  fly = el('div', 'c-pod-fly');
  fly.setAttribute('role', 'menu');
  fly.setAttribute('aria-label', 'Pods');
  PODS.forEach(function (pod) {
    var row = pod.soon ? el('span', 'c-pod-fly-row') : el('a', 'c-pod-fly-row');
    row.setAttribute('role', 'menuitem');
    if (pod.soon) row.setAttribute('aria-disabled', 'true'); else row.href = href(pod);
    if (pod.key === here) row.setAttribute('aria-current', 'true');
    var box = chip(pod, true);
    if (pod.key === here) box.classList.add('is-current');
    row.appendChild(box);
    var text = el('span', 'c-pod-fly-text');
    text.appendChild(el('b', null, pod.label));
    text.appendChild(el('small', null, pod.about));
    row.appendChild(text);
    fly.appendChild(row);
  });
  document.body.appendChild(fly);
}
function closeFly() {
  if (!fly) return;
  fly.classList.remove('is-open');
  document.removeEventListener('click', onDocClick, true);
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', closeFly);
}
function onDocClick(e) { if (fly && !fly.contains(e.target) && !strip.contains(e.target)) closeFly(); }
function onKey(e) { if (e.key === 'Escape') { closeFly(); current.focus(); } }
function openFly(anchor) {
  if (!fly) buildFly();
  hideTip();
  var r = anchor.getBoundingClientRect();
  fly.classList.add('is-open');
  var h = fly.offsetHeight;
  fly.style.left = ((nav ? nav.getBoundingClientRect().right : r.right) + 8) + 'px';
  fly.style.top = Math.max(8, Math.min(r.top, window.innerHeight - h - 8)) + 'px';
  var first = fly.querySelector('a');
  if (first) first.focus();
  setTimeout(function () {
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', closeFly);
  }, 0);
}

/* ── The strip ───────────────────────────────────────────────────── */
var strip = el('div', 'c-pod-strip');
strip.setAttribute('role', 'group');
strip.setAttribute('aria-label', 'Pods');
var current = null;
PODS.forEach(function (pod) {
  var c = chip(pod);
  if (pod.key === here) {
    c.classList.add('is-current');
    c.setAttribute('aria-current', 'true');
    current = c;
    /* Collapsed, this is the only box left, so it opens the others. */
    c.addEventListener('click', function (e) {
      if (!collapsed()) return;
      e.preventDefault();
      if (fly && fly.classList.contains('is-open')) closeFly(); else openFly(c);
    });
  }
  c.addEventListener('mouseenter', function () { showTip(c, pod); });
  c.addEventListener('focus', function () { showTip(c, pod); });
  c.addEventListener('mouseleave', hideTip);
  c.addEventListener('blur', hideTip);
  strip.appendChild(c);
});
tree.appendChild(strip);

/* ── This pod's own menu ─────────────────────────────────────────── */
var mine = null;
PODS.forEach(function (pod) { if (pod.key === here) mine = pod; });
if (mine) {
  tree.appendChild(el('hr', 'c-sidebar-divider'));
  var kids = el('div', 'c-nav-children is-open');
  var inner = el('div', 'c-nav-children-inner');
  GROUPS.forEach(function (g) {
    var members = mine.entries.filter(function (e) { return e.group === g.key; });
    if (!members.length) return;
    inner.appendChild(el('div', 'c-sidebar-section c-nav-group', g.label));
    members.forEach(function (e) {
      if (!e.path) {
        var s = el('span', 'c-nav-child soon', e.label);
        s.setAttribute('aria-disabled', 'true');
        s.title = 'Not built yet';
        inner.appendChild(s);
        return;
      }
      var a = el('a', 'c-nav-child', e.label);
      a.href = e.path;
      if (isPage(e)) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
      inner.appendChild(a);
    });
  });
  kids.appendChild(inner);
  tree.appendChild(kids);
}
})();
