/* The pods, as one map, rendered by every Collabrium app from this one
   file. Three copies exist (one per repository) and they must stay
   identical: the whole point is that no app can disagree with another
   about what the other apps contain.

   The shape: the pod this page belongs to sits first, its entries open
   beneath it with nothing to expand or collapse, because this is where
   the reader is and the entries are the menu. A divider follows, then
   the Pods heading, because the heading describes what comes after it,
   not the menu above. Every other pod is a single row that leads to that pod's front door, its
   first entry, at its deployed address; the pod's own menu is drawn by
   the pod itself once you arrive. The own pod links relatively, so a
   local copy never leaves localhost.

   One destination is ever active: the entry for the page you are on,
   whose pod row goes bold with no fill, exactly as the DS asks. In the
   collapsed rail the entries hide and the pod row, a link to the front
   door, is the way in, per the DS's collapsed-rail rule.

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

function mark(m) {
  return '<i class="c-pod-mark" aria-hidden="true"><img src="../collabrium-dls/SVG/' + m + '.svg" alt="" /></i>';
}
function isPage(entry) {
  return entry.path === page || (entry.also || []).indexOf(page) >= 0;
}
/* A pod's front door is its first built entry. */
function door(pod) {
  var e = (pod.entries || []).filter(function (x) { return x.path; })[0];
  return e ? e.path : null;
}
function rowHTML(pod, href) {
  return '<a class="c-sidebar-item" href="' + href + '">' + mark(pod.mark) +
    '<span class="label">' + pod.label + '</span>' +
    '<span class="c-sidebar-hover-text">' + pod.hover + '</span></a>';
}
function soonHTML(pod) {
  return '<a class="c-sidebar-item soon" aria-disabled="true" title="No workspace deployed yet">' + mark(pod.mark) +
    '<span class="label">' + pod.label + '</span><span class="c-badge c-badge-neutral">Soon</span>' +
    '<span class="c-sidebar-hover-text">' + pod.hover + '</span></a>';
}

var mine = null, others = [];
PODS.forEach(function (pod) { if (pod.key === here) mine = pod; else others.push(pod); });

if (mine) {
  /* This pod: its row, then its entries, open and staying open. */
  tree.insertAdjacentHTML('beforeend', rowHTML(mine, door(mine) || '#'));
  var parent = tree.lastElementChild;

  var kids = document.createElement('div');
  kids.className = 'c-nav-children is-open';
  var inner = document.createElement('div');
  inner.className = 'c-nav-children-inner';

  var activeHere = false;
  mine.entries.forEach(function (e) {
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
    a.href = e.path;
    a.textContent = e.label;
    if (isPage(e)) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
      activeHere = true;
    }
    inner.appendChild(a);
  });
  if (activeHere) parent.classList.add('parent-active-child');

  kids.appendChild(inner);
  tree.appendChild(kids);

  /* The line between where you are and where else you can go. */
  tree.insertAdjacentHTML('beforeend', '<hr class="c-sidebar-divider" />');
}

/* The heading belongs to the other pods, not to the page's own menu,
   so it follows the divider. */
tree.insertAdjacentHTML('beforeend',
  '<div class="c-sidebar-section">Pods</div>' +
  '<p class="c-sidebar-caption">The other Collabrium workspaces. One click and you are across.</p>');

/* Every other pod: one row, one door. */
others.forEach(function (pod) {
  if (pod.soon) { tree.insertAdjacentHTML('beforeend', soonHTML(pod)); return; }
  tree.insertAdjacentHTML('beforeend', rowHTML(pod, pod.base + door(pod)));
});
})();
