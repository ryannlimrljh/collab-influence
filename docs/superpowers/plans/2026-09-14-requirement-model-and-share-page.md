# Requirement Model + Client Share Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the channel × tier ask a first-class part of a campaign, and give the client a share page that shows that ask and counts against it.

**Architecture:** A new pure-logic module (`shared/campaign-model.js`) owns the requirement, slot and coverage maths and the migration from the old creator-level shapes. A new `shared/tiers.js` becomes the single tier table, replacing three copies and adding `KOC`. `campaign-store.js` migrates records on read so existing pages keep working untouched. A new `pages/share.html` renders one card per creator with a decision row per channel and a sticky progress contract.

**Tech Stack:** Plain browser-global IIFE JavaScript, no build step, no dependencies. Tests run under Node's built-in `node --test` via a small shim that loads the same IIFE files. Styling from the vendored `collabrium-dls/`.

**Scope:** This plan covers phases 1 and 2 of the spec (`docs/superpowers/specs/2026-09-14-send-to-campaign-design.md`). Phases 3 (send-to-client sheet), 4 (slot board) and 5 (shortfall loop) get their own plans — each builds on this model layer and is independently shippable.

---

## File structure

**Create**

| File | Responsibility |
|---|---|
| `tests/helpers/load.mjs` | Load a browser-global IIFE file into Node with `window`/`localStorage` shims. |
| `tests/tiers.test.mjs` | Tier band boundaries and key/name mapping. |
| `tests/campaign-model.test.mjs` | Migration, slots, fills, coverage, shortfall. |
| `shared/tiers.js` | The one tier table, exported as `window.tiers` = `{TIERS, tierOf, tierByKey}`. |
| `shared/campaign-model.js` | Pure functions over a campaign record. No storage, no DOM. |
| `pages/share.html` | Client-facing selection page. |

**Modify**

| File | Change |
|---|---|
| `shared/campaign-store.js` | Add `lead` stage; migrate records on read; requirement and channel-level roster operations. |
| `shared/campaigns-data.js` | Give seeded campaigns a `requirement` so the share page has something to render. |
| `pages/campaign.html:563-571` | Drop the local `TIERS`/`TIER_DOT`/`tierOf`, use `shared/tiers.js`. |
| `pages/influencers-v2.html:1113-1128, 1294-1298, 604-625` | Same, plus rename the `.inf-tier-N` CSS ramp to be name-keyed. |

**Leave alone:** `pages/influencers.html` — HANDOVER.md marks it unmaintained.

### Two traps this structure avoids

1. `campaign.html`'s `TIERS[].cls` is **dead code** — its `TIER_DOT` is keyed by tier *name*, while `influencers-v2`'s is keyed by `cls`. Two different maps, same variable name. The shared table collapses both into a `dot` field on the tier record.
2. `influencers-v2` renders `'inf-tier-' + t.rank` where `rank` is the array index, and CSS defines `.inf-tier-0` … `.inf-tier-5` only. Inserting `KOC` shifts every rank and silently unstyles `Mega`. Task 2 renames the ramp to `.inf-tier-<key>` so the index coupling is gone for good.

---

## Task 1: Shared tier table with KOC

**Files:**
- Create: `tests/helpers/load.mjs`
- Create: `tests/tiers.test.mjs`
- Create: `shared/tiers.js`

- [ ] **Step 1: Write the loader helper**

`shared/*.js` are IIFEs that read and write browser globals. This loads one into Node.

```js
// tests/helpers/load.mjs
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* Load browser-global IIFE files into a fresh sandbox object.

   `window` and `localStorage` are passed as PARAMETERS, not installed on
   globalThis. That matters: every closure in the loaded file captures them
   lexically, so a function that looks up `window.tiers.tierOf(...)` when it is
   called — which is exactly what campaign-model.js does — still resolves
   correctly long after loadShared has returned. Installing them on globalThis
   and restoring in a `finally` looks tidier but breaks precisely that case.

   node:vm would also fix it, but objects built inside a vm context belong to
   another realm, and assert.deepEqual then fails on prototype identity for
   every array and object these tests compare. Same realm is the point.

   Files are evaluated in order against one shared sandbox, because
   campaign-model.js reads the tier table that tiers.js attaches. */
export function loadShared(...files) {
  const mem = {};
  const win = {
    localStorage: {
      getItem: k => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: k => { delete mem[k]; }
    },
    console
  };
  win.window = win;
  for (const f of files) {
    const src = readFileSync(join(ROOT, 'shared', f), 'utf8');
    new Function('window', 'localStorage', src)(win, win.localStorage);
  }
  return win;
}
```

- [ ] **Step 2: Write the failing test**

```js
// tests/tiers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadShared} from './helpers/load.mjs';

const {tierOf, tierByKey, TIERS} = loadShared('tiers.js').tiers;

test('seeder covers everything below 500', () => {
  assert.equal(tierOf(0).key, 'seeder');
  assert.equal(tierOf(438).key, 'seeder');
});

test('koc sits between 500 and 1000', () => {
  assert.equal(tierOf(500).key, 'koc');
  assert.equal(tierOf(708).key, 'koc');
  assert.equal(tierOf(932).key, 'koc');
});

/* Every band gets both of its edges, so a wrong `max` anywhere is caught
   rather than merely implied by the neighbouring band's edge. */
test('bands above koc are unchanged', () => {
  assert.equal(tierOf(1000).key, 'nano');
  assert.equal(tierOf(4999).key, 'nano');
  assert.equal(tierOf(5000).key, 'micro');
  assert.equal(tierOf(19999).key, 'micro');
  assert.equal(tierOf(20000).key, 'mid');
  assert.equal(tierOf(99999).key, 'mid');
  assert.equal(tierOf(100000).key, 'macro');
  assert.equal(tierOf(499999).key, 'macro');
  assert.equal(tierOf(500000).key, 'mega');
  assert.equal(tierOf(1.2e6).key, 'mega');
});

test('null followers have no tier', () => {
  assert.equal(tierOf(null), null);
  assert.equal(tierOf(undefined), null);
});

test('unparseable followers have no tier', () => {
  assert.equal(tierOf(NaN), null);
  assert.equal(tierOf('abc'), null);
  assert.equal(tierOf({}), null);
});

/* Documenting accepted behaviour rather than asserting an ideal: a negative
   count is bad data, and Seeder is the least surprising place to put it. */
test('numeric strings work and negatives fall in seeder', () => {
  assert.equal(tierOf('708').key, 'koc');
  assert.equal(tierOf(-5).key, 'seeder');
});

test('Infinity lands in the top band rather than nowhere', () => {
  assert.equal(tierOf(Infinity).key, 'mega');
});

test('every tier carries a key, name and dot colour', () => {
  assert.equal(TIERS.length, 7);
  for (const t of TIERS) {
    assert.ok(t.key && t.name && t.dot, `incomplete tier: ${JSON.stringify(t)}`);
  }
});

/* KOC is what this file adds, so pin its record exactly — a typo in `cls`
   or `dot` is otherwise invisible until it reaches the page. */
test('the KOC record is exactly as specified', () => {
  assert.deepEqual(tierByKey('koc'), {
    key: 'koc', name: 'KOC', max: 1000, cls: 'c-tag-koc', dot: 'var(--color-turquoise)'
  });
});

test('tierByKey round-trips and is case-sensitive', () => {
  assert.equal(tierByKey('macro').name, 'Macro');
  assert.equal(tierByKey('nope'), null);
  assert.equal(tierByKey('MACRO'), null);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/tiers.test.mjs`
Expected: FAIL — `ENOENT` on `shared/tiers.js`.

- [ ] **Step 4: Write the implementation**

```js
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/tiers.test.mjs`
Expected: PASS — 10 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/load.mjs tests/tiers.test.mjs shared/tiers.js
git commit -m "tiers: one shared table, with KOC between Seeder and Nano"
```

---

## Task 2: Adopt the shared table in both live pages

No new behaviour — the same tiers rendered from one source, plus the CSS ramp keyed by name so adding a tier can never unstyle another one again.

**Files:**
- Modify: `pages/campaign.html:563-571`
- Modify: `pages/influencers-v2.html:1113-1128`, `1294-1298`, and CSS at `604-625`

- [ ] **Step 1: Point campaign.html at the shared table**

Add the script tag beside the other shared includes in `<head>`:

```html
<script src="../shared/tiers.js"></script>
```

Replace lines 565-571 (`var TIERS`, `var TIER_DOT`, `function tierOf`) with a
local alias, matching how this page already aliases `campaignStore` to `S`:

```js
  var TIERS = window.tiers.TIERS, tierOf = window.tiers.tierOf;
```

Note that this page's `TIERS[].cls` was never read — its `TIER_DOT` was keyed by
tier *name*, not `cls`. Nothing depends on dropping it.

`paxHtml()` at `campaign.html:860-866` maps `TIERS` down to tier **names** and
then looks the colour up by name. With the colour now a field on the record, keep
the tier objects instead of reducing them to names. Replace lines 860-866 with:

```js
      var tiers = TIERS.filter(function(t){ return bands[pl][t.name]; });
      var total = tiers.reduce(function(a, t){ return a + bands[pl][t.name]; }, 0);
      return '<div class="cd-pax-plat"><span class="pl">' + PLAT_LABEL[pl] + '<span class="c">' + total + (total === 1 ? ' account' : ' accounts') + '</span></span><div class="cd-pax-row">' +
        tiers.map(function(t){
          var n = t.name;
          var v = (targets[pl] || {})[n];
          return '<div class="cd-pax-box"><span class="t"><span class="cmp-dot" style="background:' + t.dot + '"></span><b>' + n + '</b>(' + bands[pl][n] + ' shown)</span>' +
            '<input inputmode="numeric" placeholder="—" data-pax-target data-batch="' + b.n + '" data-plat="' + pl + '" data-tier="' + n + '" value="' + (v == null ? '' : esc(v)) + '" /></div>';
        }).join('') + '</div></div>';
```

`data-tier` deliberately still carries the tier **name**, because `paxTargets` is
keyed by name today and the change-handler at `campaign.html:1049` reads it back.
Phase 4 replaces this whole block; do not change the stored shape here.

- [ ] **Step 2: Load campaign.html and confirm nothing moved**

Run: `python3 -m http.server 8796` then open
`http://localhost:8796/pages/campaign.html?id=camp-004&v=2`

Expected: the KOL Selection tab renders tier names and coloured dots exactly as before. No console errors.

- [ ] **Step 3: Rename the CSS ramp in influencers-v2.html**

Replace the six numeric rules at `604-625` with name-keyed ones and add `KOC`:

```css
.inf-tier-seeder{background:var(--color-neutral-2); color:var(--color-neutral-5);}
.inf-tier-koc{background:var(--color-neutral-2); color:var(--color-turquoise);}
.inf-tier-koc .dot{background:var(--color-turquoise);}
.inf-tier-nano{background:var(--color-wood-bg); color:var(--color-salmon-pink);}
.inf-tier-nano .dot{background:var(--color-salmon-pink);}
.inf-tier-micro{background:var(--color-earth-bg); color:var(--color-green);}
.inf-tier-micro .dot{background:var(--color-green);}
.inf-tier-mid{background:var(--color-water-bg); color:var(--color-navy);}
.inf-tier-mid .dot{background:var(--color-navy);}
.inf-tier-macro{background:var(--color-fire-bg); color:var(--color-orange);}
.inf-tier-macro .dot{background:var(--color-orange);}
.inf-tier-mega{background:var(--color-gold-bg); color:#8A5A00;}
.inf-tier-mega .dot{background:var(--color-amber);}
```

Keep the existing `.inf-tier` base rule untouched. Add the tag class used by the card dot:

```css
.c-tag-koc{color:var(--color-turquoise);}
```

- [ ] **Step 4: Point influencers-v2.html at the shared table**

Add beside the other shared includes:

```html
<script src="../shared/tiers.js"></script>
```

Replace `var TIERS` (1115-1122) and `function tierOf` (1123-1128) with a local
alias, the way the pages already alias `campaignStore` to `S`. Every existing
`tierOf(...)` and `TIERS` call site then keeps working untouched:

```js
  var TIERS = window.tiers.TIERS, tierOf = window.tiers.tierOf;
```

Delete `var TIER_DOT` (1294-1298) outright — the colour is a field on the tier
record now, so the map has no remaining callers once the render sites below are
updated.

Replace the four render sites that build the ramp class. At `1306-1309`:

```js
(t ? '<span class="tdot" style="background:' + t.dot + '"></span>' : '') +
(t ? '<span class="inf-tier inf-tier-' + t.key + '">' +
     (t.key !== 'seeder' ? '<span class="dot"></span>' : '') + t.name + '</span>' : '') +
```

Apply the same substitution at `1509-1510` and `2271-2272`. The old condition was `t.rank ?` — truthy for every tier except index 0 — so `t.key !== 'seeder'` preserves it exactly.

- [ ] **Step 5: Confirm the roster page is unchanged**

Open `http://localhost:8796/pages/influencers-v2.html?v=2`

Expected: tier chips keep their colours; the `Platform & Tier` filter now offers `KOC`; no console errors. Spot-check a profile under 500 followers reads `Seeder` and one at ~700 reads `KOC`.

- [ ] **Step 6: Commit**

```bash
git add pages/campaign.html pages/influencers-v2.html
git commit -m "pages: read tiers from the shared table, name-key the tier ramp"
```

---

## Task 3: Migrate old records to channel-level shapes

**Files:**
- Create: `shared/campaign-model.js`
- Create: `tests/campaign-model.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/campaign-model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadShared} from './helpers/load.mjs';

const {campaignModel: M} = loadShared('tiers.js', 'campaign-model.js');

/* Two creators. Abby is on both platforms, Aeisya on TikTok only. */
const PEOPLE = {
  'inf-001': {id: 'inf-001', name: 'Abby', platforms: [
    {platform: 'instagram', handle: 'abby', followers: 26900},
    {platform: 'tiktok',    handle: 'abby', followers: 214000}
  ]},
  'inf-002': {id: 'inf-002', name: 'Aeisya', platforms: [
    {platform: 'tiktok', handle: 'aeisya', followers: 25200}
  ]}
};

test('a creator-level pick status fans out to every channel', () => {
  const out = M.migrate({
    roster: [],
    batches: [{n: 1, picks: [{inf: 'inf-001', status: 'selected', kultRemark: 'x', clientRemark: ''}]}]
  }, PEOPLE);
  assert.deepEqual(out.batches[0].picks[0].channels, {instagram: 'selected', tiktok: 'selected'});
  assert.equal(out.batches[0].picks[0].status, undefined, 'old field is dropped');
  assert.equal(out.batches[0].picks[0].kultRemark, 'x', 'remarks survive');
});

test('a creator-level roster entry becomes one entry per channel, confirmed', () => {
  const out = M.migrate({
    roster: [{inf: 'inf-001', source: 'client', batch: 1}],
    batches: []
  }, PEOPLE);
  assert.equal(out.roster.length, 2);
  const ig = out.roster.find(r => r.platform === 'instagram');
  assert.deepEqual(ig, {
    inf: 'inf-001', platform: 'instagram', tier: 'mid',
    source: 'client', batch: 1, state: 'confirmed', substitutedFor: null
  });
});

test('a single-channel creator yields a single roster entry', () => {
  const out = M.migrate({roster: [{inf: 'inf-002', source: 'team', batch: null}], batches: []}, PEOPLE);
  assert.equal(out.roster.length, 1);
  assert.equal(out.roster[0].tier, 'mid');
});

test('an unknown influencer id is dropped rather than crashing', () => {
  const out = M.migrate({roster: [{inf: 'inf-999', source: 'team', batch: null}], batches: []}, PEOPLE);
  assert.deepEqual(out.roster, []);
});

test('migration is idempotent', () => {
  const once = M.migrate({roster: [{inf: 'inf-002', source: 'team', batch: null}], batches: []}, PEOPLE);
  const twice = M.migrate(once, PEOPLE);
  assert.deepEqual(twice.roster, once.roster);
});

test('a campaign without a requirement gets an empty one', () => {
  const out = M.migrate({roster: [], batches: []}, PEOPLE);
  assert.deepEqual(out.requirement, {});
});

test('an existing requirement is left alone', () => {
  const req = {tiktok: {mid: 3}};
  const out = M.migrate({roster: [], batches: [], requirement: req}, PEOPLE);
  assert.deepEqual(out.requirement, req);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/campaign-model.test.mjs`
Expected: FAIL — `ENOENT` on `shared/campaign-model.js`.

- [ ] **Step 3: Write the implementation**

```js
/* shared/campaign-model.js — the requirement, and the maths over it.

   Pure functions only: no storage, no DOM. campaign-store.js calls migrate()
   on read so the pages never see an un-migrated record, and the share page
   calls the slot and coverage helpers directly.

   `people` is always a map of influencer id -> record from influencers-data.js,
   passed in rather than read off a global so this file stays testable. */
(function () {
  'use strict';

  function channelsOf(rec) {
    return ((rec && rec.platforms) || []).filter(function (p) { return p.handle; });
  }

  /* ── Migration. Old records hold one status per creator and one roster
     entry per creator; both become per channel. Idempotent: a record that
     already has `channels` or channel-level roster entries passes through. */
  function migrate(c, people) {
    people = people || {};
    var out = Object.assign({}, c);
    out.requirement = c.requirement || {};

    out.batches = (c.batches || []).map(function (b) {
      return Object.assign({}, b, {picks: (b.picks || []).map(function (p) {
        if (p.channels) return p;
        var channels = {};
        channelsOf(people[p.inf]).forEach(function (ch) {
          channels[ch.platform] = p.status || 'none';
        });
        var next = Object.assign({}, p, {channels: channels});
        delete next.status;
        return next;
      })});
    });

    out.roster = [];
    (c.roster || []).forEach(function (r) {
      if (r.platform) { out.roster.push(r); return; }
      channelsOf(people[r.inf]).forEach(function (ch) {
        var t = window.tiers.tierOf(ch.followers);
        out.roster.push({
          inf: r.inf, platform: ch.platform, tier: t ? t.key : null,
          source: r.source || 'team', batch: r.batch == null ? null : r.batch,
          /* Pre-dates the availability step, so treat it as settled. */
          state: 'confirmed', substitutedFor: null
        });
      });
    });

    return out;
  }

  window.campaignModel = {migrate: migrate, channelsOf: channelsOf};
})();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/campaign-model.test.mjs`
Expected: PASS — 7 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add shared/campaign-model.js tests/campaign-model.test.mjs
git commit -m "model: migrate picks and roster to channel-level shapes"
```

---

## Task 4: Slots, fills, coverage and shortfall

**Files:**
- Modify: `shared/campaign-model.js`
- Modify: `tests/campaign-model.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `tests/campaign-model.test.mjs`:

```js
const REQ = {tiktok: {mid: 2, macro: 1}, instagram: {mid: 1}};

test('slots flatten the requirement in platform then tier order', () => {
  assert.deepEqual(M.slotsOf({requirement: REQ}), [
    {platform: 'tiktok',    tier: 'mid',   want: 2},
    {platform: 'tiktok',    tier: 'macro', want: 1},
    {platform: 'instagram', tier: 'mid',   want: 1}
  ]);
});

test('derivedPax is the sum of every slot', () => {
  assert.equal(M.derivedPax({requirement: REQ}), 4);
  assert.equal(M.derivedPax({requirement: {}}), 0);
});

test('fills count approved and confirmed but not unavailable', () => {
  const c = {requirement: REQ, roster: [
    {inf: 'a', platform: 'tiktok', tier: 'mid', state: 'confirmed'},
    {inf: 'b', platform: 'tiktok', tier: 'mid', state: 'approved'},
    {inf: 'c', platform: 'tiktok', tier: 'mid', state: 'unavailable'}
  ]};
  const s = M.slotStatus(c);
  assert.equal(s.tiktok.mid.filled, 2);
  assert.equal(s.tiktok.mid.want, 2);
  assert.equal(s.tiktok.mid.open, 0);
  assert.equal(s.tiktok.mid.over, 0);
});

test('overage is reported, never clamped', () => {
  const c = {requirement: {tiktok: {macro: 1}}, roster: [
    {inf: 'a', platform: 'tiktok', tier: 'macro', state: 'confirmed'},
    {inf: 'b', platform: 'tiktok', tier: 'macro', state: 'approved'}
  ]};
  const s = M.slotStatus(c);
  assert.equal(s.tiktok.macro.filled, 2);
  assert.equal(s.tiktok.macro.over, 1);
  assert.equal(s.tiktok.macro.open, 0);
});

test('shortfall lists only what is still open', () => {
  const c = {requirement: REQ, roster: [
    {inf: 'a', platform: 'tiktok', tier: 'mid', state: 'confirmed'}
  ]};
  assert.deepEqual(M.shortfallOf(c), [
    {platform: 'tiktok',    tier: 'mid',   want: 1},
    {platform: 'tiktok',    tier: 'macro', want: 1},
    {platform: 'instagram', tier: 'mid',   want: 1}
  ]);
});

test('coverage counts candidate channels against the ask', () => {
  const people = {
    'inf-001': {id: 'inf-001', platforms: [
      {platform: 'tiktok', handle: 'a', followers: 60000},
      {platform: 'instagram', handle: 'a', followers: 60000}
    ]},
    'inf-002': {id: 'inf-002', platforms: [
      {platform: 'tiktok', handle: 'b', followers: 60000}
    ]}
  };
  const cov = M.coverageOf(REQ, ['inf-001', 'inf-002'], people);
  assert.deepEqual(cov.find(x => x.platform === 'tiktok' && x.tier === 'mid'),
    {platform: 'tiktok', tier: 'mid', want: 2, have: 2, gap: 0});
  assert.deepEqual(cov.find(x => x.platform === 'tiktok' && x.tier === 'macro'),
    {platform: 'tiktok', tier: 'macro', want: 1, have: 0, gap: 1});
  assert.deepEqual(cov.find(x => x.platform === 'instagram' && x.tier === 'mid'),
    {platform: 'instagram', tier: 'mid', want: 1, have: 1, gap: 0});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/campaign-model.test.mjs`
Expected: FAIL — `M.slotsOf is not a function`.

- [ ] **Step 3: Write the implementation**

Insert before the `window.campaignModel = ...` line in `shared/campaign-model.js`:

```js
  /* Requirement -> a flat, ordered list of asks. Object key order is
     insertion order for string keys, which is what we want: the ask reads
     back the way it was entered. */
  function slotsOf(c) {
    var req = (c && c.requirement) || {}, out = [];
    Object.keys(req).forEach(function (platform) {
      Object.keys(req[platform]).forEach(function (tier) {
        var want = Number(req[platform][tier]) || 0;
        if (want > 0) out.push({platform: platform, tier: tier, want: want});
      });
    });
    return out;
  }

  function derivedPax(c) {
    return slotsOf(c).reduce(function (a, s) { return a + s.want; }, 0);
  }

  /* A roster entry occupies its slot while it is approved or confirmed.
     `unavailable` releases it, which is what reopens the slot. */
  function occupies(r) { return r.state === 'approved' || r.state === 'confirmed'; }

  /* platform -> tier -> {want, filled, open, over}. Tiers present on the
     roster but absent from the ask still appear, with want 0, so an
     unasked-for fill is visible rather than silently dropped. */
  function slotStatus(c) {
    var out = {};
    function cell(platform, tier) {
      out[platform] = out[platform] || {};
      out[platform][tier] = out[platform][tier] || {want: 0, filled: 0, open: 0, over: 0};
      return out[platform][tier];
    }
    slotsOf(c).forEach(function (s) { cell(s.platform, s.tier).want = s.want; });
    ((c && c.roster) || []).filter(occupies).forEach(function (r) {
      cell(r.platform, r.tier).filled += 1;
    });
    Object.keys(out).forEach(function (p) {
      Object.keys(out[p]).forEach(function (t) {
        var x = out[p][t];
        x.open = Math.max(0, x.want - x.filled);
        x.over = Math.max(0, x.filled - x.want);
      });
    });
    return out;
  }

  function shortfallOf(c) {
    var st = slotStatus(c);
    return slotsOf(c).map(function (s) {
      return {platform: s.platform, tier: s.tier, want: st[s.platform][s.tier].open};
    }).filter(function (s) { return s.want > 0; });
  }

  /* How well a set of candidates covers an ask, before anything is sent.
     Counts channel accounts, not people: one creator on two platforms
     contributes to both. */
  function coverageOf(requirement, infIds, people) {
    var have = {};
    (infIds || []).forEach(function (id) {
      channelsOf(people[id]).forEach(function (ch) {
        var t = window.tiers.tierOf(ch.followers);
        if (!t) return;
        have[ch.platform] = have[ch.platform] || {};
        have[ch.platform][t.key] = (have[ch.platform][t.key] || 0) + 1;
      });
    });
    return slotsOf({requirement: requirement}).map(function (s) {
      var n = (have[s.platform] && have[s.platform][s.tier]) || 0;
      return {platform: s.platform, tier: s.tier, want: s.want, have: n,
              gap: Math.max(0, s.want - n)};
    });
  }
```

And extend the export:

```js
  window.campaignModel = {
    migrate: migrate, channelsOf: channelsOf,
    slotsOf: slotsOf, derivedPax: derivedPax, slotStatus: slotStatus,
    shortfallOf: shortfallOf, coverageOf: coverageOf
  };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/campaign-model.test.mjs`
Expected: PASS — 13 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add shared/campaign-model.js tests/campaign-model.test.mjs
git commit -m "model: slots, fills, coverage and shortfall over the requirement"
```

---

## Task 5: Wire the model into the store

**Files:**
- Modify: `shared/campaign-store.js:20-26` (stages), `104-110` (`get`/`merged`), `194-243` (roster and pick operations)
- Create: `tests/campaign-store.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/campaign-store.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadShared} from './helpers/load.mjs';

function fresh() {
  const win = loadShared('tiers.js', 'campaign-model.js', 'campaign-store.js');
  win.PEOPLE = {
    'inf-001': {id: 'inf-001', platforms: [
      {platform: 'tiktok', handle: 'a', followers: 214000},
      {platform: 'instagram', handle: 'a', followers: 26900}
    ]}
  };
  win.campaignStore.setPeople(win.PEOPLE);
  return win;
}

test('lead is the first stage and is not an active one', () => {
  const {campaignStore: S} = fresh();
  assert.equal(S.STAGES[0].key, 'lead');
  assert.equal(S.isActiveStage('lead'), false);
  assert.equal(S.isActiveStage('sourcing'), true);
});

test('records come back migrated', () => {
  const win = fresh();
  win.CAMPAIGNS = [{
    id: 'c1', stage: 'sourcing',
    roster: [{inf: 'inf-001', source: 'client', batch: 1}],
    batches: [{n: 1, picks: [{inf: 'inf-001', status: 'selected'}]}]
  }];
  const c = win.campaignStore.get('c1');
  assert.equal(c.roster.length, 2, 'one entry per channel');
  assert.deepEqual(c.batches[0].picks[0].channels, {tiktok: 'selected', instagram: 'selected'});
});

test('setRequirement recomputes pax and platforms', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: []}];
  const c = win.campaignStore.setRequirement('c1', {tiktok: {mid: 3}, instagram: {macro: 2}});
  assert.equal(c.pax, 5);
  assert.deepEqual(c.platforms, ['tiktok', 'instagram']);
});

test('approving one channel adds only that channel to the roster', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: [
    {n: 1, picks: [{inf: 'inf-001', channels: {tiktok: 'none', instagram: 'none'}}]}
  ]}];
  const c = win.campaignStore.setChannelStatus('c1', 1, 'inf-001', 'tiktok', 'selected');
  assert.equal(c.roster.length, 1);
  assert.deepEqual(c.roster[0], {
    inf: 'inf-001', platform: 'tiktok', tier: 'macro',
    source: 'client', batch: 1, state: 'approved', substitutedFor: null
  });
  assert.equal(c.batches[0].picks[0].channels.instagram, 'none', 'other channel untouched');
});

test('taking an approval back removes that roster entry', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: [
    {n: 1, picks: [{inf: 'inf-001', channels: {tiktok: 'none', instagram: 'none'}}]}
  ]}];
  win.campaignStore.setChannelStatus('c1', 1, 'inf-001', 'tiktok', 'selected');
  const c = win.campaignStore.setChannelStatus('c1', 1, 'inf-001', 'tiktok', 'rejected');
  assert.deepEqual(c.roster, []);
});

test('confirming availability does not duplicate the entry', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: [
    {n: 1, picks: [{inf: 'inf-001', channels: {tiktok: 'none'}}]}
  ]}];
  win.campaignStore.setChannelStatus('c1', 1, 'inf-001', 'tiktok', 'selected');
  const c = win.campaignStore.setRosterState('c1', 'inf-001', 'tiktok', 'confirmed');
  assert.equal(c.roster.length, 1);
  assert.equal(c.roster[0].state, 'confirmed');
});

test('a team-added entry survives a client answer on the same channel', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing',
    roster: [{inf: 'inf-001', platform: 'tiktok', tier: 'macro', source: 'team',
              batch: null, state: 'confirmed', substitutedFor: null}],
    batches: [{n: 1, picks: [{inf: 'inf-001', channels: {tiktok: 'selected'}}]}]};
  const c = win.campaignStore.setChannelStatus('c1', 1, 'inf-001', 'tiktok', 'rejected');
  assert.equal(c.roster.length, 1, 'a hand-added entry is not the client\'s to remove');
  assert.equal(c.roster[0].source, 'team');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/campaign-store.test.mjs`
Expected: FAIL — `S.isActiveStage is not a function`.

- [ ] **Step 3: Add the lead stage and the people hook**

In `shared/campaign-store.js`, prepend to `STAGES` (line 20):

```js
    {key: 'lead',      label: 'Lead',      short: 'Lead',      dot: 'var(--color-neutral-4)'},
```

Below the `COLORS` declaration add:

```js
  /* Stages that count as live work. `lead` is a pitch, not a campaign yet,
     so it stays out of the dashboard's active counts and the pipeline strip. */
  function isActiveStage(key) { return key !== 'lead' && key !== 'completed'; }

  /* The influencer records migration needs, injected rather than read off a
     global so the store can be tested without loading a 283KB data file. */
  var PEOPLE = {};
  function setPeople(map) { PEOPLE = map || {}; }
```

- [ ] **Step 4: Migrate on read**

Replace `merged()` and `get()` (lines 104-110) so no caller ever sees an old shape:

```js
  function merged() {
    var s = state();
    var live = function (r) { return s.removed.indexOf(r.id) < 0; };
    var out = base().filter(live).map(function (r) { return apply(r, s); })
      .concat(s.added.filter(live).map(function (r) { return apply(r, s); }));
    out.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    return out.map(function (c) { return window.campaignModel.migrate(c, PEOPLE); });
  }
  function get(id) {
    return merged().filter(function (c) { return c.id === id; })[0] || null;
  }
```

- [ ] **Step 5: Add requirement and channel-level operations**

Replace `addToRoster`, `removeFromRoster` and `updatePick` (lines 194-243) with:

```js
    /* The ask. pax and platforms are derived from it, not typed, so the
       list view keeps rendering without knowing about slots. */
    setRequirement: function (id, requirement) {
      return update(id, {
        requirement: requirement,
        pax: window.campaignModel.derivedPax({requirement: requirement}),
        platforms: Object.keys(requirement)
      });
    },

    /* Roster — one entry per creator per channel. */
    addToRoster: function (id, entries, source, batch) {
      var c = get(id); if (!c) return null;
      var roster = (c.roster || []).slice();
      entries.forEach(function (e) {
        if (roster.some(function (r) { return r.inf === e.inf && r.platform === e.platform; })) return;
        roster.push({
          inf: e.inf, platform: e.platform, tier: e.tier,
          source: source || 'team', batch: batch == null ? null : batch,
          state: e.state || 'confirmed', substitutedFor: e.substitutedFor || null
        });
      });
      return update(id, {roster: roster});
    },
    removeFromRoster: function (id, inf, platform) {
      var c = get(id); if (!c) return null;
      return update(id, {roster: (c.roster || []).filter(function (r) {
        return !(r.inf === inf && (platform == null || r.platform === platform));
      })});
    },
    /* The agency's availability call: approved -> confirmed, or unavailable,
       which releases the slot without deleting the history. */
    setRosterState: function (id, inf, platform, nextState) {
      var c = get(id); if (!c) return null;
      return update(id, {roster: (c.roster || []).map(function (r) {
        return (r.inf === inf && r.platform === platform)
          ? Object.assign({}, r, {state: nextState,
              confirmedAt: nextState === 'confirmed' ? today() : r.confirmedAt})
          : r;
      })});
    },

    /* One channel's answer on one pick. `selected` puts that channel on the
       roster as approved; any other answer takes back an entry the client's
       own answer put there, and leaves a hand-added one alone. */
    setChannelStatus: function (id, n, inf, platform, status) {
      var c = get(id); if (!c) return null;
      var batches = (c.batches || []).map(function (b) {
        if (b.n !== n) return b;
        return Object.assign({}, b, {picks: (b.picks || []).map(function (p) {
          if (p.inf !== inf) return p;
          var channels = Object.assign({}, p.channels);
          channels[platform] = status;
          return Object.assign({}, p, {channels: channels});
        })});
      });

      var roster = (c.roster || []).slice();
      var at = function (r) { return r.inf === inf && r.platform === platform; };
      if (status === 'selected') {
        if (!roster.some(at)) {
          var ch = window.campaignModel.channelsOf(PEOPLE[inf])
            .filter(function (x) { return x.platform === platform; })[0];
          var t = ch ? window.tiers.tierOf(ch.followers) : null;
          roster.push({
            inf: inf, platform: platform, tier: t ? t.key : null,
            source: 'client', batch: n, state: 'approved',
            substitutedFor: null, approvedAt: today()
          });
        }
      } else {
        roster = roster.filter(function (r) {
          return !(at(r) && r.source === 'client' && r.batch === n);
        });
      }
      return update(id, {batches: batches, roster: roster});
    },
```

`today()` above is the store's existing module-level helper (`campaign-store.js`,
defined beside `fmtDate`). It is in scope inside the exported object literal —
no import or aliasing needed.

Extend the export object with `isActiveStage` and `setPeople`:

```js
    isActiveStage: isActiveStage, setPeople: setPeople,
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test tests/campaign-store.test.mjs`
Expected: PASS — 7 tests, 0 failures.

- [ ] **Step 7: Run the whole suite**

Run: `node --test "tests/**/*.test.mjs"`
Expected: PASS — 30 tests across 3 files, 0 failures.

- [ ] **Step 8: Update the callers that used the old signatures**

`pages/campaign.html:1014` calls `S.removeFromRoster(c.id, inf)` — still valid, the
platform argument is optional and omitting it removes every channel.

`pages/campaign.html:1133` calls `S.addToRoster(c.id, ids, 'team', null)` with an
array of ids. Change to entries:

```js
      S.addToRoster(c.id, ids.map(function(inf){
        var top = (byInf[inf].platforms || []).filter(function(p){ return p.handle; })
          .sort(function(a,b){ return (b.followers||0) - (a.followers||0); })[0];
        var t = top ? window.tiers.tierOf(top.followers) : null;
        return {inf: inf, platform: top ? top.platform : null, tier: t ? t.key : null};
      }), 'team', null);
```

Add the data hook near the top of `campaign.html`'s script, after the shared
includes load:

```js
  campaignStore.setPeople(byInf);
```

`byInf` is already built in `campaign.html`; move `setPeople` to just after it.

- [ ] **Step 9: Confirm the campaign page still works**

Open `http://localhost:8796/pages/campaign.html?id=camp-001&v=3`

Expected: the KOL Selection tab lists the same people; `Selected influencers`
now shows the migrated roster; no console errors.

- [ ] **Step 10: Commit**

```bash
git add shared/campaign-store.js tests/campaign-store.test.mjs pages/campaign.html
git commit -m "store: lead stage, migrate on read, channel-level roster and picks"
```

---

## Task 6: Give the seeded campaigns a requirement

**Files:**
- Modify: `shared/campaigns-data.js`

- [ ] **Step 1: Add a requirement to camp-004**

`camp-004` (Enfagrow A+ MindPro) is the one with a real batch, so it is what the
share page will demo. Add beside `pax`:

```js
    requirement: {tiktok: {mid: 2, macro: 1}, instagram: {mid: 1, macro: 1}},
```

Leave its `pax: 13` in place — Task 5's `setRequirement` only recomputes on edit,
and the spec preserves legacy `pax` until someone touches the ask.

- [ ] **Step 2: Add one to camp-001 so the other batch renders too**

```js
    requirement: {tiktok: {mid: 2}, instagram: {nano: 1}},
```

- [ ] **Step 3: Add a test so the seed data cannot drift**

Create `tests/campaigns-data.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadShared} from './helpers/load.mjs';

const win = loadShared('tiers.js', 'campaign-model.js');

/* campaigns-data.js is a plain assignment to window.CAMPAIGNS, so point
   `window` at the sandbox and evaluate it the same way the browser does. */
const prev = globalThis.window;
globalThis.window = win;
try { (0, eval)(readFileSync(new URL('../shared/campaigns-data.js', import.meta.url), 'utf8')); }
finally { globalThis.window = prev; }

const byId = Object.fromEntries(win.CAMPAIGNS.map(c => [c.id, c]));

test('camp-004 asks for five channel slots', () => {
  assert.equal(win.campaignModel.derivedPax(byId['camp-004']), 5);
});

test('every requirement uses real platform and tier keys', () => {
  const platforms = ['tiktok', 'instagram', 'xhs'];
  const tiers = win.tiers.TIERS.map(t => t.key);
  for (const c of win.CAMPAIGNS) {
    for (const [p, bands] of Object.entries(c.requirement || {})) {
      assert.ok(platforms.includes(p), `${c.id}: unknown platform ${p}`);
      for (const t of Object.keys(bands)) {
        assert.ok(tiers.includes(t), `${c.id}: unknown tier ${t}`);
      }
    }
  }
});

test('every pick and roster entry points at a campaign that exists', () => {
  for (const c of win.CAMPAIGNS) {
    for (const b of c.batches || []) {
      assert.ok(Number.isInteger(b.n), `${c.id}: batch without a number`);
    }
  }
});
```

Run: `node --test tests/campaigns-data.test.mjs`
Expected: PASS — 3 tests, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add shared/campaigns-data.js tests/campaigns-data.test.mjs
git commit -m "data: seed campaigns with a channel and tier requirement"
```

---

## Task 7: Share page — shell and progress contract

**Files:**
- Create: `pages/share.html`

The share page is client-facing: no app shell, no sidebar, no navigation back
into the workspace. It reads `?c=<campaignId>&b=<batchNo>`.

- [ ] **Step 1: Create the page with its head and data wiring**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Select your line-up · Collab:Influence</title>
<link rel="stylesheet" href="../collabrium-dls/collabrium.css" />
<script src="../shared/influencers-data.js"></script>
<script src="../shared/avatar-manifest.js"></script>
<script src="../shared/campaigns-data.js"></script>
<script src="../shared/tiers.js"></script>
<script src="../shared/campaign-model.js"></script>
<script src="../shared/campaign-store.js"></script>
<style>
  /* Client-facing, so the page is its own surface: no shell chrome. */
  body{margin:0; background:var(--color-canvas-warm); color:var(--color-neutral-9);}
  .sh-wrap{max-width:1080px; margin:0 auto; padding:var(--spacing-32) var(--spacing-24) var(--spacing-60);}
  .sh-head h1{margin:0 0 var(--spacing-4); font-size:var(--text-h2-size);}
  .sh-head .sub{color:var(--color-neutral-6); font-size:var(--text-caption-size);}

  /* The progress contract. Sticky, because it is the instruction: the
     client needs to see what is still owed while they scroll. */
  .sh-contract{position:sticky; top:0; z-index:10;
    background:var(--color-canvas-warm); padding:var(--spacing-12) 0;
    border-bottom:1px solid var(--color-neutral-3); margin-bottom:var(--spacing-20);}
  .sh-chips{display:flex; flex-wrap:wrap; gap:var(--spacing-8); align-items:center;}
  .sh-chip{display:inline-flex; align-items:center; gap:6px; padding:4px 10px;
    border-radius:999px; border:1px solid var(--color-neutral-3);
    font-size:var(--text-caption-size); background:var(--color-neutral-1);}
  .sh-chip .dot{width:8px; height:8px; border-radius:50%;}
  .sh-chip.is-met{border-color:var(--color-green); color:var(--color-green);}
  .sh-chip.is-over{border-color:var(--color-amber); color:#8A5A00;}
  .sh-total{margin-left:auto; font-weight:700;}
</style>
</head>
<body>
<div class="sh-wrap">
  <header class="sh-head">
    <h1 id="shTitle">—</h1>
    <p class="sub" id="shSub">—</p>
  </header>
  <div class="sh-contract"><div class="sh-chips" id="shChips"></div></div>
  <main id="shList"></main>
</div>
<script>
(function () {
  'use strict';
  var M = window.campaignModel, S = window.campaignStore;

  var byInf = {};
  (window.INFLUENCERS || []).forEach(function (r) { byInf[r.id] = r; });
  S.setPeople(byInf);

  var qs = new URLSearchParams(location.search);
  var campaign = S.get(qs.get('c'));
  var batch = campaign && (campaign.batches || [])
    .filter(function (b) { return String(b.n) === qs.get('b'); })[0];

  function E(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  if (!campaign || !batch) {
    E('shTitle').textContent = 'This link is no longer available';
    E('shSub').textContent = 'Ask your contact at KULT for a new one.';
    return;
  }

  window.shareCtx = {campaign: campaign, batch: batch, byInf: byInf, E: E, esc: esc};
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Render the header and the contract**

Append inside the same IIFE, before the `window.shareCtx` line:

```js
  E('shTitle').textContent = campaign.name + ' — please pick your line-up';
  E('shSub').textContent = 'Sent ' + S.fmtDate(batch.sentAt, true) +
    ' · ' + (batch.picks || []).length + ' creators to consider';

  /* Counts what the client has approved so far, per channel and tier,
     against the campaign's ask. Recomputed on every answer. */
  function chosen() {
    var out = {};
    (batch.picks || []).forEach(function (p) {
      Object.keys(p.channels || {}).forEach(function (plat) {
        if (p.channels[plat] !== 'selected') return;
        var ch = M.channelsOf(byInf[p.inf])
          .filter(function (x) { return x.platform === plat; })[0];
        var t = ch ? window.tiers.tierOf(ch.followers) : null;
        if (!t) return;
        out[plat] = out[plat] || {};
        out[plat][t.key] = (out[plat][t.key] || 0) + 1;
      });
    });
    return out;
  }

  var PLAT_LABEL = {tiktok: 'TikTok', instagram: 'Instagram', xhs: 'XHS'};

  function renderContract() {
    var got = chosen(), slots = M.slotsOf(campaign);
    var total = 0, want = 0;
    E('shChips').innerHTML = slots.map(function (s) {
      var n = (got[s.platform] && got[s.platform][s.tier]) || 0;
      total += n; want += s.want;
      var cls = n >= s.want ? (n > s.want ? 'is-over' : 'is-met') : '';
      var tier = window.tiers.tierByKey(s.tier);
      return '<span class="sh-chip ' + cls + '">' +
        '<span class="dot" style="background:' + tier.dot + '"></span>' +
        esc(PLAT_LABEL[s.platform] || s.platform) + ' ' + esc(tier.name) +
        ' <b>' + n + '/' + s.want + '</b></span>';
    }).join('') +
      '<span class="sh-total">' + total + ' of ' + want + ' chosen</span>';
  }
  renderContract();
  window.renderContract = renderContract;
```

- [ ] **Step 3: Verify the contract renders**

Open `http://localhost:8796/pages/share.html?c=camp-004&b=1`

Expected: the heading names the campaign; five chips read
`TikTok Mid 0/2`, `TikTok Macro 0/1`, `Instagram Mid 0/1`, `Instagram Macro 0/1`,
and a total of `0 of 5 chosen`. No console errors.

- [ ] **Step 4: Commit**

```bash
git add pages/share.html
git commit -m "share: client page shell with a sticky progress contract"
```

---

## Task 8: Share page — one card per creator, one row per channel

This is the change that retires both the duplicate cards and the
"answering one of their accounts answers all of them" disclaimer.

**Files:**
- Modify: `pages/share.html`

- [ ] **Step 1: Add the card styles**

Append to the `<style>` block:

```css
  .sh-grid{display:grid; gap:var(--spacing-16);
    grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));}
  .sh-card{background:var(--color-neutral-1); border:1px solid var(--color-neutral-3);
    border-radius:var(--radius-lg); padding:var(--spacing-16);}
  .sh-id{display:flex; gap:var(--spacing-12); align-items:center;}
  .sh-id img, .sh-id .ph{width:48px; height:48px; border-radius:50%; object-fit:cover;
    background:var(--color-neutral-2); display:grid; place-items:center; font-weight:700;}
  .sh-id .nm{font-weight:700;}
  .sh-id .mt{font-size:var(--text-caption-size); color:var(--color-neutral-6);}
  .sh-ch{border-top:1px solid var(--color-neutral-2); padding-top:var(--spacing-12);
    margin-top:var(--spacing-12); display:flex; flex-direction:column; gap:var(--spacing-12);}
  .sh-ch-row .hd{display:flex; align-items:center; gap:8px;
    font-size:var(--text-caption-size); margin-bottom:6px;}
  .sh-ch-row .hd .f{margin-left:auto; color:var(--color-neutral-6);}
  .sh-btns{display:flex; gap:6px;}
  /* 44px minimum touch target, and the label is text so it never relies
     on colour alone to say which answer is active. */
  .sh-btns button{flex:1; min-height:44px; border-radius:var(--radius-md);
    border:1px solid var(--color-neutral-3); background:var(--color-neutral-1);
    font-size:var(--text-caption-size); cursor:pointer;
    transition:background 150ms ease, border-color 150ms ease;}
  .sh-btns button:hover{background:var(--color-neutral-2);}
  .sh-btns button:focus-visible{outline:2px solid var(--color-obsidian); outline-offset:2px;}
  .sh-btns button[aria-pressed="true"][data-a="selected"]{background:var(--color-earth-bg);
    border-color:var(--color-green); color:var(--color-green); font-weight:700;}
  .sh-btns button[aria-pressed="true"][data-a="kiv"]{background:var(--color-gold-bg);
    border-color:var(--color-amber); color:#8A5A00; font-weight:700;}
  .sh-btns button[aria-pressed="true"][data-a="rejected"]{background:var(--color-neutral-2);
    border-color:var(--color-neutral-5); color:var(--color-neutral-7); font-weight:700;}
  .sh-why{margin-top:var(--spacing-12); font-size:var(--text-caption-size);
    color:var(--color-neutral-7);}
  .sh-why b{color:var(--color-neutral-9);}
  @media (prefers-reduced-motion: reduce){ .sh-btns button{transition:none;} }
```

- [ ] **Step 2: Render the cards**

Append inside the IIFE:

```js
  var ANSWERS = [
    {key: 'selected', label: 'Approve'},
    {key: 'kiv',      label: 'KIV'},
    {key: 'rejected', label: 'Reject'}
  ];

  /* AVATAR_FILES maps an id to which harvests exist, e.g. {tt:1, ig:1} —
     the filename is built from the id, it is not stored. Same construction
     as influencers-v2.html:1171 and campaign.html:590. Local files only:
     unavatar 429s under load, and this page has no shell to recover in. */
  function avatarHTML(rec) {
    var m = (window.AVATAR_FILES || {})[rec.id] || {};
    var src = m.tt ? ('../assets/avatars/' + rec.id + '-tt.jpg')
            : m.ig ? ('../assets/avatars/' + rec.id + '-ig.jpg') : null;
    var parts = String(rec.name || '?').trim().split(/\s+/);
    var initials = esc(((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase());
    if (!src) return '<span class="ph">' + initials + '</span>';
    /* Fall back to initials in place if the harvest is missing on disk. */
    return '<img src="' + esc(src) + '" alt="" ' +
      'onerror="this.outerHTML=\'<span class=&quot;ph&quot;>' + initials + '</span>\'" />';
  }

  function fmtFollowers(n) {
    if (n == null) return '';
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 ? 1 : 0).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  /* One card per creator. Each channel they are on gets its own decision
     row, because the ask is per channel and tier — a creator can be wanted
     on TikTok and not on Instagram. */
  function cardHTML(pick) {
    var rec = byInf[pick.inf];
    if (!rec) return '';
    var meta = [rec.age, rec.gender, rec.location].filter(Boolean).join(' · ');
    var rows = M.channelsOf(rec).map(function (ch) {
      var t = window.tiers.tierOf(ch.followers);
      var cur = (pick.channels || {})[ch.platform] || 'none';
      return '<div class="sh-ch-row">' +
        '<div class="hd">' +
          '<span class="dot" style="width:8px;height:8px;border-radius:50%;background:' +
            (t ? t.dot : 'var(--color-neutral-4)') + '"></span>' +
          '<b>' + esc(PLAT_LABEL[ch.platform] || ch.platform) + '</b>' +
          (t ? '<span class="c-badge c-badge-neutral">' + esc(t.name) + '</span>' : '') +
          '<span class="f">' + esc(fmtFollowers(ch.followers)) + ' followers</span>' +
        '</div>' +
        '<div class="sh-btns" role="group" aria-label="' +
          esc(rec.name + ' on ' + (PLAT_LABEL[ch.platform] || ch.platform)) + '">' +
          ANSWERS.map(function (a) {
            return '<button type="button" data-a="' + a.key + '"' +
              ' data-inf="' + esc(pick.inf) + '" data-plat="' + esc(ch.platform) + '"' +
              ' aria-pressed="' + (cur === a.key) + '">' + a.label + '</button>';
          }).join('') +
        '</div></div>';
    }).join('');

    return '<article class="sh-card">' +
      '<div class="sh-id">' + avatarHTML(rec) +
        '<div><div class="nm">' + esc(rec.name) + '</div>' +
        '<div class="mt">' + esc(meta || '—') + '</div>' +
        '<div class="mt">' + esc((rec.niches || []).join(' · ')) + '</div></div>' +
      '</div>' +
      '<div class="sh-ch">' + rows + '</div>' +
      (pick.kultRemark
        ? '<p class="sh-why"><b>Why we suggest them:</b> ' + esc(pick.kultRemark) + '</p>'
        : '') +
      '</article>';
  }

  function renderList() {
    E('shList').innerHTML = '<div class="sh-grid">' +
      (batch.picks || []).map(cardHTML).join('') + '</div>';
  }
  renderList();
```

- [ ] **Step 3: Wire the answers**

```js
  /* One listener on the list, so re-rendering never leaves handlers behind. */
  E('shList').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-a]');
    if (!b) return;
    var inf = b.dataset.inf, plat = b.dataset.plat, answer = b.dataset.a;
    var pick = (batch.picks || []).filter(function (p) { return p.inf === inf; })[0];
    /* Clicking the active answer clears it, so a mis-click is undoable. */
    var next = (pick.channels || {})[plat] === answer ? 'none' : answer;

    campaign = S.setChannelStatus(campaign.id, batch.n, inf, plat, next);
    batch = (campaign.batches || []).filter(function (x) { return x.n === batch.n; })[0];
    renderList();
    renderContract();
  });
```

- [ ] **Step 4: Verify in the browser**

Open `http://localhost:8796/pages/share.html?c=camp-004&b=1&v=2`

Expected:
- each creator appears **once**, with a decision row per channel they are on;
- approving a creator's TikTok row moves only the TikTok chip, e.g.
  `TikTok Macro 0/1` → `TikTok Macro 1/1` and the chip turns green;
- approving beyond the ask turns the chip amber rather than blocking;
- clicking the active answer again clears it and the chip counts back down;
- a reload keeps the answers (they are in `localStorage` via the store).

- [ ] **Step 5: Commit**

```bash
git add pages/share.html
git commit -m "share: one card per creator with a decision row per channel"
```

---

## Task 9: Share page — grouping and filters

Platform tabs become filters, because tabs were what forced a creator to appear
twice.

**Files:**
- Modify: `pages/share.html`

- [ ] **Step 1: Add the filter bar markup**

Insert between the contract and the list:

```html
  <div class="sh-filters" id="shFilters">
    <input type="search" id="shQ" placeholder="Search creators…" aria-label="Search creators" />
    <span class="sh-fgroup" id="shPlat" role="group" aria-label="Filter by channel"></span>
    <label class="sh-toggle">
      <input type="checkbox" id="shFlat" /> Show as one list
    </label>
  </div>
```

```css
  .sh-filters{display:flex; gap:var(--spacing-12); align-items:center;
    flex-wrap:wrap; margin-bottom:var(--spacing-20);}
  .sh-filters input[type=search]{height:40px; min-width:220px; flex:1;
    border:1px solid var(--color-neutral-3); border-radius:var(--radius-md);
    padding:0 var(--spacing-12); background:var(--color-neutral-1);}
  .sh-fgroup{display:flex; gap:6px;}
  .sh-fgroup button{min-height:40px; padding:0 var(--spacing-12);
    border:1px solid var(--color-neutral-3); border-radius:999px;
    background:var(--color-neutral-1); cursor:pointer;}
  .sh-fgroup button[aria-pressed="true"]{background:var(--color-obsidian);
    color:var(--color-neutral-1); border-color:var(--color-obsidian);}
  .sh-group-hd{margin:var(--spacing-24) 0 var(--spacing-12); font-size:var(--text-caption-size);
    font-weight:700; color:var(--color-neutral-7);}
  .sh-toggle{display:inline-flex; align-items:center; gap:6px;
    font-size:var(--text-caption-size); color:var(--color-neutral-7);}
```

- [ ] **Step 2: Render the filters and group the list**

Replace `renderList()` with:

```js
  var filter = {q: '', plat: 'all', flat: false};

  E('shPlat').innerHTML = [{key: 'all', label: 'All channels'}]
    .concat(M.slotsOf(campaign).map(function (s) { return s.platform; })
      .filter(function (p, i, a) { return a.indexOf(p) === i; })
      .map(function (p) { return {key: p, label: PLAT_LABEL[p] || p}; }))
    .map(function (o) {
      return '<button type="button" data-plat="' + esc(o.key) + '" aria-pressed="' +
        (filter.plat === o.key) + '">' + esc(o.label) + '</button>';
    }).join('');

  function matches(pick) {
    var rec = byInf[pick.inf];
    if (!rec) return false;
    if (filter.q) {
      var hay = [rec.name].concat(rec.niches || [],
        M.channelsOf(rec).map(function (c) { return c.handle; })).join(' ').toLowerCase();
      if (hay.indexOf(filter.q.toLowerCase()) < 0) return false;
    }
    if (filter.plat !== 'all') {
      if (!M.channelsOf(rec).some(function (c) { return c.platform === filter.plat; })) return false;
    }
    return true;
  }

  /* Grouped by the slot the creator is proposed for — the channel and tier
     they best match in the ask — so the client reads the list the same way
     the ask is written. `Show as one list` falls back to a flat grid. */
  function slotFor(rec) {
    var slots = M.slotsOf(campaign);
    var hit = null;
    M.channelsOf(rec).forEach(function (ch) {
      var t = window.tiers.tierOf(ch.followers);
      if (!t || hit) return;
      if (slots.some(function (s) { return s.platform === ch.platform && s.tier === t.key; })) {
        hit = {platform: ch.platform, tier: t.key};
      }
    });
    return hit;
  }

  function renderList() {
    var picks = (batch.picks || []).filter(matches);
    if (!picks.length) {
      E('shList').innerHTML = '<p class="sub">No creators match that search.</p>';
      return;
    }
    if (filter.flat) {
      E('shList').innerHTML = '<div class="sh-grid">' + picks.map(cardHTML).join('') + '</div>';
      return;
    }
    var groups = {}, order = [];
    picks.forEach(function (p) {
      var s = slotFor(byInf[p.inf]);
      var key = s ? (s.platform + '/' + s.tier) : 'other';
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(p);
    });
    E('shList').innerHTML = order.map(function (key) {
      var label = key === 'other' ? 'Also worth a look' : (function () {
        var bits = key.split('/');
        return 'For ' + (PLAT_LABEL[bits[0]] || bits[0]) + ' · ' + window.tiers.tierByKey(bits[1]).name;
      })();
      return '<h2 class="sh-group-hd">' + esc(label) + '</h2><div class="sh-grid">' +
        groups[key].map(cardHTML).join('') + '</div>';
    }).join('');
  }
  renderList();
```

- [ ] **Step 3: Wire the filter controls**

```js
  E('shQ').addEventListener('input', function (e) {
    filter.q = e.target.value.trim();
    renderList();
  });
  E('shPlat').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-plat]');
    if (!b) return;
    filter.plat = b.dataset.plat;
    Array.prototype.forEach.call(E('shPlat').children, function (x) {
      x.setAttribute('aria-pressed', String(x.dataset.plat === filter.plat));
    });
    renderList();
  });
  E('shFlat').addEventListener('change', function (e) {
    filter.flat = e.target.checked;
    renderList();
  });
```

- [ ] **Step 4: Verify**

Open `http://localhost:8796/pages/share.html?c=camp-004&b=1&v=3`

Expected:
- creators are grouped under headings like `For TikTok · Macro`;
- `All channels` / `TikTok` / `Instagram` filter the grid, and no creator is
  ever shown twice under any filter;
- `Show as one list` flattens the grouping;
- searching a name narrows the list and the contract chips do **not** change
  (filtering is not answering).

- [ ] **Step 5: Commit**

```bash
git add pages/share.html
git commit -m "share: channel filters and slot grouping, replacing platform tabs"
```

---

## Task 10: Full pass

**Files:** none — verification only.

- [ ] **Step 1: Run the suite**

Run: `node --test "tests/**/*.test.mjs"`
Expected: PASS — 33 tests across 4 files, 0 failures.

- [ ] **Step 2: Walk every page for regressions**

With `python3 -m http.server 8796` running, open each and confirm no console
errors and no visual change except where intended:

| Page | Expect |
|---|---|
| `pages/influencers-v2.html?v=4` | Tier chips unchanged; `KOC` appears in the tier filter. |
| `pages/campaigns.html?v=4` | List renders; `Lead` is available as a stage. |
| `pages/campaign.html?id=camp-004&v=4` | KOL Selection lists picks; roster shows migrated entries. |
| `pages/share.html?c=camp-004&b=1&v=4` | Contract, grouping, per-channel answers all work. |

- [ ] **Step 3: Confirm the answers round-trip**

On the share page, approve two channels, reload, and confirm both stay
approved. Then open `pages/campaign.html?id=camp-004` and confirm the same two
appear on the roster as `approved`, awaiting the manual availability call.

- [ ] **Step 4: Commit any fixes, then tag the milestone**

```bash
git add -A
git commit -m "share: phase 1 and 2 complete — requirement model and client page"
```

---

## What this plan does not do

Deliberately left for later plans, per the spec's delivery order:

- **Phase 3** — the send-to-client sheet (destination-first, inherited ask,
  coverage check). `coverageOf()` is built and tested here so that plan has it
  ready.
- **Phase 4** — the slot board replacing the two stacked lists on
  `campaign.html`. `slotStatus()` is built and tested here for the same reason.
- **Phase 5** — the shortfall loop and tier-substitution flagging.
  `shortfallOf()` is built and tested here.

The three helpers are written now because they are pure functions over the same
model and are cheap to test in isolation; wiring them to UI is what the later
plans do.

## Open questions carried from the spec

- **KOC boundary at 500** — inferred from production values (`Seeder` observed
  at 438, `KOC` at 708). Task 1's test encodes it. If the live app disagrees,
  change the one `max` in `shared/tiers.js` and the test.
- **Grouping on the client page** — Task 9 ships grouped-by-slot with a
  `Show as one list` toggle, so both readings are available and the default can
  be flipped in one line.
