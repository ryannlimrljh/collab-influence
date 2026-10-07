/* The pods, as one map, rendered by every Collabrium app from this one
   file. Three copies exist (one per repository) and they must stay
   identical: the whole point is that no app can disagree with another
   about what the other apps contain.

   The shape: a tray under the logo holding one mark per pod, the
   element icon from that pod's own logo, a rocket for the mothership;
   the pod you are in sits on a white tab.
   It is the way across, and it costs one row however long the pod's
   own menu grows beneath it, which is the whole reason it sits there:
   anything placed after a real pod menu lands below the fold. Hover
   or focus any mark and a tip gives
   the pod's full name and what it does; the grey boxes are pods with
   no workspace yet. Collapsed, the strip keeps only this pod's box and
   a click on it opens the pods as a flyout beside the rail.

   Below the strip, this pod's own menu on two shelves: Workspace for
   the modules people work in, General for the library they look things
   up in. Entries are the DS's first-level rows, icon and label, the
   icons being the ones each pod's menu carried before the pods map. The pods' real builds carry their own menus; they take the
   strip alone. Entries with no path are real places in a pod's IA that
   have no page yet; they render dimmed rather than vanish, so the map
   stays honest. The own pod links relatively, so a local copy never
   leaves localhost; every other pod links to its deployed address. */
(function () {
'use strict';

var PODS = [
  /* Collabrium is the mothership, and its mark is a rocket: the coin is
     the group logo and Sales already wears gold, so two coins would
     clash, and a house clashes with every pod's own Home row. */
  { key: 'collabrium', label: 'Collabrium', icon: 'rocket-launch', tint: 'neutral',
    about: 'The group home: the leadership board, feedback and the assistant.',
    base: 'https://app-shell-intro.vercel.app/pages/',
    entries: [
      { label: 'Dashboard', path: 'landing-v3.html',  group: 'workspace', icon: 'house' },
      { label: 'Feedback',  path: 'feedback-v1.html', group: 'general',   icon: 'lightbulb-filament' }
    ] },
  { key: 'sales', label: 'Collab:Sales', mark: 'gold', tint: 'gold',
    about: 'Client intelligence, campaigns and proposals.',
    base: 'https://collab-sales-ui.vercel.app/',
    /* the two doors the hero cards already use; Collab:Sales renders
       client-side, so its full menu waits on its owners */
    entries: [
      { label: 'Proposals',           path: 'proposals',           group: 'workspace', icon: 'file-text' },
      { label: 'Client intelligence', path: 'client-intelligence', group: 'general',   icon: 'sparkle' }
    ] },
  { key: 'media', label: 'Collab:Media', mark: 'water', tint: 'water',
    about: 'Media plans, ad formats and audiences.',
    base: 'https://collab-media.vercel.app/pages/',
    entries: [
      /* Home is the pod's front door, so it leads: door() takes the first
         built entry, and arriving from another pod should land on the
         landing rather than part-way into the wizard. It was briefly only
         an `also` of My media plans, which left the landing with no row of
         its own and lit the wrong one when you were on it. */
      { label: 'Home',           path: 'campaigns.html',                                      group: 'workspace', icon: 'house' },
      { label: 'New media plan', path: 'planner.html',       also: ['planner-v1.html'],       group: 'workspace', icon: 'compass-tool' },
      { label: 'My media plans', path: 'campaign-list.html',                                  group: 'workspace', icon: 'rows' },
      { label: 'Ad formats',     path: 'formats.html',       also: ['formats-original.html'], group: 'general',   icon: 'frame-corners' },
      { label: 'Audiences',      path: 'audiences.html',                                      group: 'general',   icon: 'users-three' }
    ] },
  { key: 'influence', label: 'Collab:Influence', mark: 'earth', tint: 'earth',
    about: 'Creators, campaigns, agencies and brands.',
    base: 'https://collab-influence.vercel.app/pages/',
    entries: [
      { label: 'Influencers', path: 'influencers-v2.html', also: ['influencers.html'], group: 'workspace', icon: 'users-three' },
      { label: 'Campaigns',   path: 'campaigns.html',      also: ['campaign.html'],    group: 'workspace', icon: 'folder-open' },
      { label: 'Agencies',    path: null,                                              group: 'general',   icon: 'buildings' },
      { label: 'Brands',      path: null,                                              group: 'general',   icon: 'tag' }
    ] },
  { key: 'studio',  label: 'Collab:Studio',  mark: 'fire', tint: 'fire', soon: true,
    about: 'Production and creative delivery. Not built yet.' },
  { key: 'content', label: 'Collab:Content', mark: 'wood', tint: 'wood', soon: true,
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
  if (pod.icon) {
    var ic = el('i', 'ph-fill ph-' + pod.icon);
    ic.setAttribute('aria-hidden', 'true');
    c.appendChild(ic);
  } else {
    var img = document.createElement('img');
    img.src = '../collabrium-dls/SVG/' + pod.mark + '.svg';
    img.alt = '';
    c.appendChild(img);
  }
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
/* Entries are the DS's first-level rows, icon and label, so the
   collapsed rail keeps the icons and the shell's own hover label names
   them; only the shelf labels hide. */
var mine = null;
PODS.forEach(function (pod) { if (pod.key === here) mine = pod; });
if (mine) {
  tree.appendChild(el('hr', 'c-sidebar-divider'));
  GROUPS.forEach(function (g) {
    var members = mine.entries.filter(function (e) { return e.group === g.key; });
    if (!members.length) return;
    tree.appendChild(el('div', 'c-sidebar-section c-nav-group', g.label));
    members.forEach(function (e) {
      var row = e.path ? el('a', 'c-sidebar-item') : el('span', 'c-sidebar-item soon');
      var ic = el('i', 'ph-fill ph-' + e.icon);
      ic.setAttribute('aria-hidden', 'true');
      row.appendChild(ic);
      row.appendChild(el('span', 'label', e.label));
      if (!e.path) {
        row.setAttribute('aria-disabled', 'true');
        row.title = 'Not built yet';
        row.appendChild(el('span', 'c-badge c-badge-neutral', 'Soon'));
      } else {
        row.href = e.path;
        if (isPage(e)) { row.classList.add('active'); row.setAttribute('aria-current', 'page'); }
      }
      row.appendChild(el('span', 'c-sidebar-hover-text', e.label));
      tree.appendChild(row);
    });
  });
}
})();
