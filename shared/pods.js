/* The pods, as one tree, rendered by every Collabrium app from this one
   file. Three copies exist (one per repository) and they must stay
   identical: the whole point is that no app can disagree with another
   about what the other apps contain.

   The shape is the DS's second-level navigation. A pod is a parent row
   that only opens and closes; its entries are the children, and the
   first child is the pod's front door. The pod this page belongs to
   opens by default and links its children relatively, so a local copy
   never leaves localhost; every other pod links to its deployed address.
   One destination is ever active: the child for the page you are on,
   whose parent goes bold with no fill, exactly as the DS asks.

   Entries with no path are real places in a pod's IA that have no page
   yet; they render dimmed rather than vanish, so the map stays honest. */
(function () {
'use strict';

var PODS = [
  { key: 'collabrium', label: 'Collabrium', hover: 'Collabrium', mark: 'coin',
    base: 'https://app-shell-intro.vercel.app/pages/',
    entries: [
      { label: 'Dashboard', path: 'landing-v3.html' },
      { label: 'Feedback',  path: 'feedback-v1.html' }
    ] },
  { key: 'sales', label: 'Sales', hover: 'Collab:Sales', mark: 'gold',
    base: 'https://collab-sales-ui.vercel.app/',
    /* the two doors the hero cards already use; Collab:Sales renders
       client-side, so its full menu waits on its owners */
    entries: [
      { label: 'Client intelligence', path: 'client-intelligence' },
      { label: 'Proposals',           path: 'proposals' }
    ] },
  { key: 'media', label: 'Media', hover: 'Collab:Media', mark: 'water',
    base: 'https://collab-media.vercel.app/pages/',
    entries: [
      { label: 'New media plan', path: 'planner.html',       also: ['planner-v1.html'] },
      { label: 'My media plans', path: 'campaign-list.html', also: ['campaigns.html'] },
      { label: 'Ad formats',     path: 'formats.html',       also: ['formats-original.html'] },
      { label: 'Audiences',      path: 'audiences.html' }
    ] },
  { key: 'influence', label: 'Influence', hover: 'Collab:Influence', mark: 'earth',
    base: 'https://collab-influence.vercel.app/pages/',
    entries: [
      { label: 'Influencers', path: 'influencers-v2.html', also: ['influencers.html'] },
      { label: 'Campaigns',   path: 'campaigns.html',      also: ['campaign.html'] },
      { label: 'Agencies',    path: null },
      { label: 'Brands',      path: null }
    ] },
  { key: 'studio',  label: 'Studio',  hover: 'Collab:Studio · soon',  mark: 'fire', soon: true },
  { key: 'content', label: 'Content', hover: 'Collab:Content · soon', mark: 'wood', soon: true }
];

var tree = document.getElementById('podsNav');
if (!tree) return;
var here = tree.getAttribute('data-pod');
var page = (location.pathname.split('/').pop() || '').split('?')[0];
var nav = tree.closest('.c-sidebar');

function mark(m) {
  return '<i class="c-pod-mark" aria-hidden="true"><img src="../collabrium-dls/SVG/' + m + '.svg" alt="" /></i>';
}
function isPage(entry) {
  return entry.path === page || (entry.also || []).indexOf(page) >= 0;
}

PODS.forEach(function (pod) {
  if (pod.soon) {
    tree.insertAdjacentHTML('beforeend',
      '<a class="c-sidebar-item soon" aria-disabled="true" title="No workspace deployed yet">' + mark(pod.mark) +
      '<span class="label">' + pod.label + '</span><span class="c-badge c-badge-neutral">Soon</span>' +
      '<span class="c-sidebar-hover-text">' + pod.hover + '</span></a>');
    return;
  }
  var mine = pod.key === here;
  var kidsId = 'podKids-' + pod.key;

  var parent = document.createElement('button');
  parent.type = 'button';
  parent.className = 'c-sidebar-item';
  parent.setAttribute('aria-expanded', String(mine));
  parent.setAttribute('aria-controls', kidsId);
  parent.innerHTML = mark(pod.mark) + '<span class="label">' + pod.label + '</span>' +
    '<span class="c-nav-parent-toggle" aria-hidden="true"><i class="ph ph-caret-' + (mine ? 'up' : 'down') + '"></i></span>' +
    '<span class="c-sidebar-hover-text">' + pod.hover + '</span>';

  var kids = document.createElement('div');
  kids.className = 'c-nav-children' + (mine ? ' is-open' : '');
  kids.id = kidsId;
  var inner = document.createElement('div');
  inner.className = 'c-nav-children-inner';

  var activeHere = false;
  pod.entries.forEach(function (e) {
    if (!e.path) {
      var s = document.createElement('span');
      s.className = 'c-nav-child soon';
      s.setAttribute('aria-disabled', 'true');
      s.title = 'Not built yet';
      s.textContent = e.label;
      inner.appendChild(s);
      return;
    }
    var a = document.createElement('a');
    a.className = 'c-nav-child';
    a.href = mine ? e.path : pod.base + e.path;
    a.textContent = e.label;
    if (mine && isPage(e)) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
      activeHere = true;
    }
    inner.appendChild(a);
  });
  if (activeHere) parent.classList.add('parent-active-child');

  kids.appendChild(inner);
  tree.appendChild(parent);
  tree.appendChild(kids);

  parent.addEventListener('click', function () {
    /* Collapsed, there is no room to reveal children: the icon routes to
       the pod's front door instead, per the DS's collapsed-rail rule. */
    if (nav && nav.classList.contains('is-collapsed')) {
      var first = inner.querySelector('a.c-nav-child');
      if (first) location.href = first.href;
      return;
    }
    var open = kids.classList.toggle('is-open');
    parent.setAttribute('aria-expanded', String(open));
    parent.querySelector('.c-nav-parent-toggle i').className = 'ph ph-caret-' + (open ? 'up' : 'down');
  });
});
})();
