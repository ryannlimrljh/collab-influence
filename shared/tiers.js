/* shared/tiers.js — the one tier table.

   Was copied into campaign.html, influencers-v2.html and influencers.html,
   each with its own idea of what a tier record holds. The dot colour used to
   live in a separate TIER_DOT map keyed differently on each page (by name in
   campaign.html, by cls in influencers-v2.html); it is a field here instead,
   so there is nothing left to keep in sync.

   `key` doubles as the requirement object's tier key: requirement.tiktok.mid. */
(function () {
  'use strict';

  var TIERS = [
    {key: 'seeder', name: 'Seeder', max: 5e2,      cls: '',            dot: 'var(--color-neutral-4)'},
    {key: 'koc',    name: 'KOC',    max: 1e3,      cls: 'c-tag-koc',   dot: 'var(--color-turquoise)'},
    {key: 'nano',   name: 'Nano',   max: 5e3,      cls: 'c-tag-wood',  dot: 'var(--color-salmon-pink)'},
    {key: 'micro',  name: 'Micro',  max: 2e4,      cls: 'c-tag-earth', dot: 'var(--color-green)'},
    {key: 'mid',    name: 'Mid',    max: 1e5,      cls: 'c-tag-water', dot: 'var(--color-navy)'},
    {key: 'macro',  name: 'Macro',  max: 5e5,      cls: 'c-tag-fire',  dot: 'var(--color-orange)'},
    {key: 'mega',   name: 'Mega',   max: Infinity, cls: 'c-tag-gold',  dot: 'var(--color-amber)'}
  ];

  function tierOf(n) {
    if (n == null) return null;
    var v = Number(n);
    if (isNaN(v)) return null;
    for (var i = 0; i < TIERS.length; i++) if (v < TIERS[i].max) return TIERS[i];
    /* Only Infinity reaches here, since the last band's max is Infinity and
       the comparison is strict. The three page-local copies returned null for
       it; returning the top band is the answer everyone actually wanted. */
    return TIERS[TIERS.length - 1];
  }
  function tierByKey(key) {
    for (var i = 0; i < TIERS.length; i++) if (TIERS[i].key === key) return TIERS[i];
    return null;
  }

  /* One namespaced object, the way campaignStore, influencerStore,
     campaignForm and collabBrand all export. */
  window.tiers = {TIERS: TIERS, tierOf: tierOf, tierByKey: tierByKey};
})();
