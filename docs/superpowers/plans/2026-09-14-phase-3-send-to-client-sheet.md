# Phase 3 — Send-to-client sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "send to campaign" ask for a destination first, inherit the campaign's remaining ask, and warn before you send a list that cannot fill it.

**Architecture:** One shared sheet (`shared/send-sheet.js`) replaces the two separate ones the prototype grew — `infSendScrim` on the roster and `openPicker('batch')` on the campaign page. The batch record gains the ask it was sent against, a recipient and an expiry. A campaign can be created inline at stage `lead`, so a list can exist before the work is won.

**Tech Stack:** Plain browser-global IIFE JavaScript, no build step, no dependencies. Tests under `node --test` via `tests/helpers/load.mjs`. Styling from the vendored `collabrium-dls/`.

**Depends on:** Phases 1-2 (branch `send-to-campaign`). `campaignModel.coverageOf`, `shortfallOf`, `slotsOf`, `derivedPax` and `campaignStore.setRequirement` / `isActiveStage` already exist and are tested.

---

## Why this phase exists

The production modal has five faults, all of which this phase closes:

1. **Two name fields.** `Name` and `List name`, same placeholder.
2. **Campaign is optional**, and sits near the bottom — so the destination is an afterthought rather than the point.
3. **No way to build a list for unwon work.** The `lead` stage now exists but nothing puts anything into it.
4. **The ask is capped by the answer.** `paxHtml()` derives its tier boxes from the creators already picked ("2 available"), so you can never request more than you happened to select.
5. **The link is `Public — anyone with the link`.** Approvals are unattributed and links never expire.

And one the prototype adds: `addBatch()` still writes `status: 'none'` per pick, the pre-Phase-1 shape. Migration covers it, but new records should not be born old.

---

## File structure

**Create**

| File | Responsibility |
|---|---|
| `shared/send-sheet.js` | The sheet: markup, state, validation. One copy, both pages. No storage writes of its own — it calls back with a result. |
| `tests/send-sheet.test.mjs` | The sheet's pure logic: ask defaulting, coverage rollup, validation. |

**Modify**

| File | Change |
|---|---|
| `shared/campaign-store.js` | `addBatch` takes an options object and writes channel-level picks; add `createLead`. |
| `shared/campaign-model.js` | Add `askFor(campaign)` — the remaining shortfall, falling back to the full requirement. |
| `tests/campaign-store.test.mjs`, `tests/campaign-model.test.mjs` | Cover the above. |
| `pages/influencers-v2.html` | Replace the `infSendScrim` markup and its handlers with the shared sheet. |
| `pages/campaign.html` | Point `openPicker('batch')` at the shared sheet. |
| `pages/share.html` | Honour a batch's expiry and its optional name prompt. |

### Hazards, learned the hard way in phases 1-2

1. **Bump the `?v=` of every shared file you edit**, on every page that loads it. These pages cache hard (HANDOVER.md). A changed file behind an unchanged version string serves stale, and the failure looks like your code never ran. Current versions: `tiers.js?v=1`, `campaign-model.js?v=2`, `campaign-store.js?v=4`, `campaigns-data.js?v=3`.
2. `node --test tests/` fails on Node 24. Use `node --test "tests/**/*.test.mjs"`.
3. Line numbers shift as you edit. Find every edit by content.
4. `tests/helpers/load.mjs` passes `window` as a function parameter. Do not change it.
5. **Tests passing does not mean the page works.** Phase 1-2 shipped a green suite over five broken read-sites. After every task that touches a page, load it and exercise the thing you changed.

---

## Task 1: The batch carries the ask it was sent against

**Files:**
- Modify: `shared/campaign-model.js`, `shared/campaign-store.js`
- Modify: `tests/campaign-model.test.mjs`, `tests/campaign-store.test.mjs`

- [ ] **Step 1: Write the failing model test**

Append to `tests/campaign-model.test.mjs`:

```js
/* ── What a new batch should ask for. */

test('askFor is the remaining shortfall when something is already filled', () => {
  const c = {requirement: {tiktok: {mid: 2, macro: 1}}, roster: [
    {inf: 'a', platform: 'tiktok', tier: 'mid', state: 'confirmed'}
  ]};
  assert.deepEqual(M.askFor(c), {tiktok: {mid: 1, macro: 1}});
});

test('askFor is the whole requirement when nothing is filled', () => {
  const c = {requirement: {tiktok: {mid: 2}, instagram: {macro: 1}}, roster: []};
  assert.deepEqual(M.askFor(c), {tiktok: {mid: 2}, instagram: {macro: 1}});
});

test('askFor drops a band that is already met', () => {
  const c = {requirement: {tiktok: {mid: 1, macro: 1}}, roster: [
    {inf: 'a', platform: 'tiktok', tier: 'mid', state: 'approved'}
  ]};
  assert.deepEqual(M.askFor(c), {tiktok: {macro: 1}});
});

test('askFor is empty when the ask is fully filled', () => {
  const c = {requirement: {tiktok: {mid: 1}}, roster: [
    {inf: 'a', platform: 'tiktok', tier: 'mid', state: 'confirmed'}
  ]};
  assert.deepEqual(M.askFor(c), {});
});

test('askFor on a campaign with no requirement is empty', () => {
  assert.deepEqual(M.askFor({roster: []}), {});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/campaign-model.test.mjs`
Expected: FAIL — `M.askFor is not a function`. Report the real output.

- [ ] **Step 3: Implement `askFor`**

Insert in `shared/campaign-model.js` immediately before the `window.campaignModel = {` line:

```js
  /* What a new batch should ask for: whatever the campaign still owes.
     shortfallOf gives a flat list; the sheet wants it in requirement shape
     so it can seed the steppers directly. */
  function askFor(c) {
    var out = {};
    shortfallOf(c).forEach(function (s) {
      out[s.platform] = out[s.platform] || {};
      out[s.platform][s.tier] = s.want;
    });
    return out;
  }
```

Add `askFor: askFor,` to the exported object, on the line with `slotsOf`.

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test tests/campaign-model.test.mjs`
Expected: PASS — 23 tests, 0 failures.

- [ ] **Step 5: Write the failing store test**

Append to `tests/campaign-store.test.mjs`:

```js
/* ── Sending a batch. */

test('addBatch writes channel-level picks, not a creator-level status', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: []}];
  const n = win.campaignStore.addBatch('c1', {infIds: ['inf-001']});
  const b = win.campaignStore.get('c1').batches[n - 1];
  assert.deepEqual(b.picks[0].channels, {tiktok: 'none', instagram: 'none'});
  assert.equal(b.picks[0].status, undefined, 'no pre-Phase-1 status field');
});

test('addBatch records the ask, recipient and expiry it was sent with', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: []}];
  const n = win.campaignStore.addBatch('c1', {
    infIds: ['inf-001'], name: 'Batch 1',
    ask: {tiktok: {macro: 1}}, recipient: 'anna@brand.com',
    expiresAt: '2026-10-10', requireName: true
  });
  const b = win.campaignStore.get('c1').batches[n - 1];
  assert.deepEqual(b.ask, {tiktok: {macro: 1}});
  assert.equal(b.recipient, 'anna@brand.com');
  assert.equal(b.expiresAt, '2026-10-10');
  assert.equal(b.requireName, true);
  assert.equal(b.name, 'Batch 1');
});

test('addBatch defaults the name and leaves the optional fields null', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: []}];
  const n = win.campaignStore.addBatch('c1', {infIds: ['inf-001']});
  const b = win.campaignStore.get('c1').batches[n - 1];
  assert.equal(b.name, 'Batch 1');
  assert.equal(b.recipient, null);
  assert.equal(b.expiresAt, null);
  assert.equal(b.requireName, false);
  assert.deepEqual(b.ask, {});
});

test('createLead makes a campaign at stage lead, out of the active count', () => {
  const win = fresh();
  win.CAMPAIGNS = [];
  const id = win.campaignStore.createLead({name: 'Raya pitch', brand: 'Shopee'});
  const c = win.campaignStore.get(id);
  assert.equal(c.stage, 'lead');
  assert.equal(c.name, 'Raya pitch');
  assert.equal(c.brand, 'Shopee');
  assert.equal(win.campaignStore.isActiveStage(c.stage), false);
  assert.deepEqual(c.roster, []);
  assert.deepEqual(c.batches, []);
});

test('createLead accepts a requirement and derives pax from it', () => {
  const win = fresh();
  win.CAMPAIGNS = [];
  const id = win.campaignStore.createLead({
    name: 'Raya pitch', brand: 'Shopee', requirement: {tiktok: {mid: 3}}
  });
  const c = win.campaignStore.get(id);
  assert.equal(c.pax, 3);
  assert.deepEqual(c.platforms, ['tiktok']);
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `node --test tests/campaign-store.test.mjs`
Expected: FAIL — `addBatch` receives an object where it expects a name string, and `createLead is not a function`.

- [ ] **Step 7: Replace `addBatch` and add `createLead`**

In `shared/campaign-store.js`, replace the whole `addBatch` property with:

```js
    /* ── Preview batches — one per link sent to the client.

       Takes an options object rather than positional arguments: a batch now
       carries the ask it was sent against, who it went to and when it lapses,
       and a fourth positional argument was one too many. */
    addBatch: function (id, opts) {
      var c = get(id); if (!c) return null;
      opts = opts || {};
      var batches = (c.batches || []).slice();
      var n = batches.length + 1;
      batches.push({
        n: n,
        name: opts.name || ('Batch ' + n),
        sentAt: today(),
        /* The ask is copied, not referenced: it is what this batch was sent
           against, and must not move when the campaign's own ask changes. */
        ask: opts.ask ? JSON.parse(JSON.stringify(opts.ask)) : {},
        recipient: opts.recipient || null,
        expiresAt: opts.expiresAt || null,
        requireName: !!opts.requireName,
        picks: (opts.infIds || []).map(function (inf) {
          var channels = {};
          window.campaignModel.channelsOf(PEOPLE[inf]).forEach(function (ch) {
            channels[ch.platform] = 'none';
          });
          return {inf: inf, kultRemark: '', channels: channels, clientRemark: ''};
        }),
        paxTargets: {}, notes: ''
      });
      update(id, {batches: batches});
      return n;
    },

    /* A pitch: a campaign that exists so a list can be built against it
       before the work is won. isActiveStage keeps it out of the dashboard's
       counts until someone moves it to Sourcing. */
    createLead: function (fields) {
      fields = fields || {};
      var requirement = fields.requirement || {};
      return window.campaignStore.add({
        name: fields.name || 'Untitled lead',
        brand: fields.brand || '', agency: '', description: '',
        pic: fields.pic || 'Digital Team', overseer: '', salesperson: '',
        start: fields.start || null, end: fields.end || null,
        color: 'obsidian', io: '', types: ['Influencers'], stage: 'lead',
        requirement: requirement,
        platforms: Object.keys(requirement),
        pax: window.campaignModel.derivedPax({requirement: requirement}),
        quote: null, cost: null, picPct: 100, overseerPct: null, remarks: '',
        deliverables: {done: 0, total: 0}
      });
    },
```

- [ ] **Step 8: Run it and watch it pass**

Run: `node --test "tests/**/*.test.mjs"`
Expected: PASS — 53 tests, 0 failures.

- [ ] **Step 9: Update the two existing callers of the old signature**

There are **two**, and missing either leaves a page silently creating empty batches.

`pages/influencers-v2.html` calls `campaignStore.addBatch(v, name, ids)`:

```js
    var n = campaignStore.addBatch(v, {name: name, infIds: ids});
```

`pages/campaign.html` (in the picker's confirm handler, around line 1145) calls
`S.addBatch(c.id, E('cdBatchName').value.trim() || null, ids)`:

```js
      var n = S.addBatch(c.id, {name: E('cdBatchName').value.trim() || null, infIds: ids});
```

Task 5 replaces this second call entirely, but it must be correct in the meantime —
never leave the tree in a state where a page is broken between commits.

Then confirm none are left using three positional arguments:

```bash
grep -rn "addBatch(" pages/ shared/ | grep -v "addBatch: function"
```

- [ ] **Step 10: Bump the cache-busters and verify the page still sends**

`shared/campaign-store.js` and `shared/campaign-model.js` both changed. Bump both on every page that loads them:

```bash
perl -pi -e 's{campaign-store\.js\?v=4}{campaign-store.js?v=5}; s{campaign-model\.js\?v=2}{campaign-model.js?v=3}' pages/*.html
grep -ho 'shared/campaign-\(store\|model\)\.js?v=[0-9]*' pages/*.html | sort | uniq -c
```

Every page that loads each file must show the same version.

Then, with `python3 -m http.server 8796` running, open
`http://localhost:8796/pages/influencers-v2.html`, tick two profiles, and use the existing
**Send to campaign** sheet to send them to `Enfagrow A+ MindPro Routine Phase 5`.

Expected: it lands on the campaign's KOL Selection tab with a new batch whose picks
show per-channel controls and no console errors. Report what you saw.

- [ ] **Step 11: Commit**

```bash
git add shared/campaign-store.js shared/campaign-model.js tests/ pages/
git commit -m "store: a batch records the ask, recipient and expiry it was sent with

Also adds createLead, so a list can be built against a pitch before the
work is won, and addBatch now writes channel-level picks rather than the
pre-Phase-1 creator status."
```

Append a `Co-Authored-By:` trailer naming whichever Claude model you are.

---

## Task 2: The sheet's logic, without the DOM

Building the sheet's decisions as pure functions first means they can be tested, and
keeps the DOM layer thin.

**Files:**
- Create: `shared/send-sheet.js`, `tests/send-sheet.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/send-sheet.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadShared} from './helpers/load.mjs';

const win = loadShared('tiers.js', 'campaign-model.js', 'send-sheet.js');
const SS = win.sendSheet;

const PEOPLE = {
  'a': {id: 'a', name: 'Both', platforms: [
    {platform: 'tiktok', handle: 'a', followers: 200000},   // macro
    {platform: 'instagram', handle: 'a', followers: 60000}  // mid
  ]},
  'b': {id: 'b', name: 'TikTok only', platforms: [
    {platform: 'tiktok', handle: 'b', followers: 60000}     // mid
  ]}
};

test('coverage rolls candidates up against the ask', () => {
  const rows = SS.coverage({tiktok: {mid: 2, macro: 1}, instagram: {macro: 1}},
    ['a', 'b'], PEOPLE);
  assert.deepEqual(rows, [
    {platform: 'tiktok',    tier: 'mid',   want: 2, have: 1, gap: 1},
    {platform: 'tiktok',    tier: 'macro', want: 1, have: 1, gap: 0},
    {platform: 'instagram', tier: 'macro', want: 1, have: 0, gap: 1}
  ]);
});

test('summary counts candidates, their channels, and the gaps', () => {
  const s = SS.summary({tiktok: {mid: 2, macro: 1}}, ['a', 'b'], PEOPLE);
  assert.equal(s.candidates, 2);
  assert.equal(s.channels, 3, 'a has two channels, b has one');
  assert.equal(s.asked, 3);
  assert.equal(s.shortBands, 1, 'tiktok mid is one short');
});

test('summary on an empty ask reports no shortfall', () => {
  const s = SS.summary({}, ['a'], PEOPLE);
  assert.equal(s.asked, 0);
  assert.equal(s.shortBands, 0);
});

/* Validation is advisory about coverage and strict about destination:
   a list with nowhere to go is the one thing worth blocking. */
test('an existing-campaign destination needs a campaign id', () => {
  assert.deepEqual(SS.validate({mode: 'existing', campaignId: '', infIds: ['a']}),
    {ok: false, field: 'campaignId', message: 'Choose a campaign to send this to.'});
  assert.equal(SS.validate({mode: 'existing', campaignId: 'c1', infIds: ['a']}).ok, true);
});

test('a lead destination needs a name', () => {
  assert.deepEqual(SS.validate({mode: 'lead', leadName: '  ', infIds: ['a']}),
    {ok: false, field: 'leadName', message: 'Give the lead a name.'});
  assert.equal(SS.validate({mode: 'lead', leadName: 'Raya pitch', infIds: ['a']}).ok, true);
});

test('sending nobody is refused', () => {
  assert.deepEqual(SS.validate({mode: 'existing', campaignId: 'c1', infIds: []}),
    {ok: false, field: 'infIds', message: 'Pick at least one profile first.'});
});

test('a short ask is allowed through — coverage warns, it does not block', () => {
  assert.equal(SS.validate({mode: 'existing', campaignId: 'c1', infIds: ['b'],
    ask: {instagram: {macro: 5}}}).ok, true);
});

test('expiry turns a day count into a date', () => {
  assert.equal(SS.expiryFrom('2026-09-14', 30), '2026-10-14');
  assert.equal(SS.expiryFrom('2026-09-14', 0), null, 'never expires');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/send-sheet.test.mjs`
Expected: FAIL — `ENOENT` on `shared/send-sheet.js`.

- [ ] **Step 3: Write the logic half of the module**

```js
/* shared/send-sheet.js — the "send to campaign" sheet.

   The prototype grew two of these: infSendScrim on the roster page and
   openPicker('batch') on the campaign page, each knowing a little about
   batches and neither knowing about the ask. This is the one copy.

   The decisions are pure functions on the exported object so they can be
   tested without a DOM; open() builds the markup and calls back with a
   result rather than writing to the store itself. */
(function () {
  'use strict';

  var M = null;
  function model() { return M || (M = window.campaignModel); }

  /* Candidates rolled up against an ask. Thin wrapper over coverageOf so
     the sheet has one thing to call and the tests one thing to pin. */
  function coverage(ask, infIds, people) {
    return model().coverageOf(ask, infIds, people);
  }

  function summary(ask, infIds, people) {
    var rows = coverage(ask, infIds, people);
    var channels = 0;
    (infIds || []).forEach(function (id) {
      channels += model().channelsOf(people[id]).length;
    });
    return {
      candidates: (infIds || []).length,
      channels: channels,
      asked: rows.reduce(function (a, r) { return a + r.want; }, 0),
      shortBands: rows.filter(function (r) { return r.gap > 0; }).length
    };
  }

  /* Strict about where it goes, advisory about what it covers. A list with
     nowhere to land is the only thing worth refusing. */
  function validate(state) {
    if (!(state.infIds || []).length) {
      return {ok: false, field: 'infIds', message: 'Pick at least one profile first.'};
    }
    if (state.mode === 'lead') {
      if (!String(state.leadName || '').trim()) {
        return {ok: false, field: 'leadName', message: 'Give the lead a name.'};
      }
      return {ok: true};
    }
    if (!state.campaignId) {
      return {ok: false, field: 'campaignId', message: 'Choose a campaign to send this to.'};
    }
    return {ok: true};
  }

  /* 0 days means no expiry. Kept as a plain date string, the way every
     other date in the store is held. */
  function expiryFrom(fromISO, days) {
    if (!days) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fromISO);
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    d.setUTCDate(d.getUTCDate() + Number(days));
    return d.toISOString().slice(0, 10);
  }

  window.sendSheet = {
    coverage: coverage, summary: summary,
    validate: validate, expiryFrom: expiryFrom
  };
})();
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test "tests/**/*.test.mjs"`
Expected: PASS — 61 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add shared/send-sheet.js tests/send-sheet.test.mjs
git commit -m "send-sheet: coverage, validation and expiry as pure functions"
```

---

## Task 3: The sheet itself

**Files:**
- Modify: `shared/send-sheet.js`

- [ ] **Step 1: Add `open()` to the module**

Insert before the `window.sendSheet = {` line. It builds its own scrim, so a page
only has to call it.

```js
  var PLAT_LABEL = {tiktok: 'TikTok', instagram: 'Instagram', xhs: 'Xiaohongshu'};
  var EXPIRY_OPTIONS = [
    {days: 14, label: '14 days'}, {days: 30, label: '30 days'},
    {days: 60, label: '60 days'}, {days: 0,  label: 'Never'}
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* opts: {infIds, people, campaigns, defaultCampaignId, onSend}
     onSend receives the resolved state; the caller writes to the store, so
     this module never has to know which page it is on. */
  function open(opts) {
    var S = window.campaignStore;
    var state = {
      mode: 'existing',
      campaignId: opts.defaultCampaignId || (opts.campaigns[0] && opts.campaigns[0].id) || '',
      leadName: '', leadBrand: '',
      ask: {}, name: '', recipient: '', expiryDays: 30, requireName: false,
      infIds: opts.infIds || []
    };

    var host = document.createElement('div');
    host.className = 'inf-scrim ss-scrim';
    host.style.cssText = 'display:flex; align-items:center; justify-content:center;';
    document.body.appendChild(host);

    function destinationCampaign() {
      return state.mode === 'existing' && state.campaignId ? S.get(state.campaignId) : null;
    }

    /* The ask defaults to what the destination still owes. Choosing a
       different destination re-seeds it, unless the user has edited it. */
    var askTouched = false;
    function seedAsk() {
      if (askTouched) return;
      var c = destinationCampaign();
      state.ask = c ? model().askFor(c) : {};
      var n = ((c && c.batches) || []).length + 1;
      state.name = 'Batch ' + n;
    }

    function askRows() {
      var out = [];
      Object.keys(state.ask).forEach(function (p) {
        Object.keys(state.ask[p]).forEach(function (t) {
          out.push({platform: p, tier: t, want: state.ask[p][t]});
        });
      });
      return out;
    }

    function render() {
      seedAsk();
      var cov = coverage(state.ask, state.infIds, opts.people);
      var sum = summary(state.ask, state.infIds, opts.people);
      var c = destinationCampaign();

      host.innerHTML =
        '<div class="c-modal ss-modal" role="dialog" aria-modal="true" aria-labelledby="ssTitle">' +
        '<div class="c-modal-head"><h4 id="ssTitle">Send to campaign</h4>' +
          '<button class="c-icon-btn" type="button" data-ss="close" aria-label="Close"><i class="ph ph-x"></i></button></div>' +
        '<div class="c-modal-body">' +

          '<p class="ss-count">' + sum.candidates +
            (sum.candidates === 1 ? ' profile' : ' profiles') + ' · ' +
            sum.channels + ' channel accounts</p>' +

          '<h5 class="ss-h">Destination</h5>' +
          '<label class="ss-radio"><input type="radio" name="ssMode" value="existing"' +
            (state.mode === 'existing' ? ' checked' : '') + ' /> Existing campaign</label>' +
          (state.mode === 'existing'
            ? '<div class="c-field ss-indent"><select data-ss="campaign">' +
              opts.campaigns.map(function (x) {
                return '<option value="' + esc(x.id) + '"' +
                  (x.id === state.campaignId ? ' selected' : '') + '>' + esc(x.name) +
                  (x.brand ? ' · ' + esc(x.brand) : '') +
                  (x.stage === 'lead' ? ' (lead)' : '') + '</option>';
              }).join('') + '</select>' +
              (c && model().derivedPax(c)
                ? '<p class="ss-hint">Still needs: ' + (askRows().length
                    ? askRows().map(function (r) {
                        return esc(PLAT_LABEL[r.platform] || r.platform) + ' ' +
                          esc(window.tiers.tierByKey(r.tier).name) + ' ×' + r.want;
                      }).join(', ')
                    : 'nothing — the ask is already filled') + '</p>'
                : '<p class="ss-hint">This campaign has no ask set yet.</p>') +
              '</div>'
            : '') +

          '<label class="ss-radio"><input type="radio" name="ssMode" value="lead"' +
            (state.mode === 'lead' ? ' checked' : '') + ' /> New lead</label>' +
          (state.mode === 'lead'
            ? '<div class="ss-indent ss-row">' +
              '<div class="c-field"><label for="ssLeadName">Name</label>' +
                '<input id="ssLeadName" data-ss="leadName" value="' + esc(state.leadName) +
                '" placeholder="e.g. Raya 2027 pitch" /></div>' +
              '<div class="c-field"><label for="ssLeadBrand">Brand</label>' +
                '<input id="ssLeadBrand" data-ss="leadBrand" value="' + esc(state.leadBrand) +
                '" placeholder="e.g. Shopee" /></div>' +
              '</div><p class="ss-hint ss-indent">Creates a campaign at stage Lead. It stays out of the active counts until you move it to Sourcing.</p>'
            : '') +

          '<h5 class="ss-h">The ask</h5>' +
          '<div class="ss-ask">' + (askRows().length
            ? askRows().map(function (r) {
                return '<div class="ss-ask-row"><span>' +
                  esc(PLAT_LABEL[r.platform] || r.platform) + ' · ' +
                  esc(window.tiers.tierByKey(r.tier).name) + '</span>' +
                  '<input type="number" min="0" inputmode="numeric" value="' + r.want +
                  '" data-ss="ask" data-plat="' + esc(r.platform) + '" data-tier="' +
                  esc(r.tier) + '" aria-label="' + esc(PLAT_LABEL[r.platform] + ' ' +
                  window.tiers.tierByKey(r.tier).name + ' wanted') + '" /></div>';
              }).join('')
            : '<p class="ss-hint">No ask set. The client will see the list with no target to hit.</p>') +
          '</div>' +

          '<h5 class="ss-h">Coverage</h5>' +
          (cov.length
            ? '<table class="ss-cov"><tbody>' + cov.map(function (r) {
                var cls = r.have === 0 ? 'is-none' : (r.gap > 0 ? 'is-short' : 'is-ok');
                var note = r.have === 0 ? 'nothing to show'
                         : (r.gap > 0 ? 'short ' + r.gap : 'covered');
                return '<tr class="' + cls + '"><td>' +
                  esc(PLAT_LABEL[r.platform] || r.platform) + ' · ' +
                  esc(window.tiers.tierByKey(r.tier).name) + '</td>' +
                  '<td class="n">' + r.have + ' / ' + r.want + '</td>' +
                  '<td class="note">' + note + '</td></tr>';
              }).join('') + '</tbody></table>' +
              (sum.shortBands
                ? '<p class="ss-warn"><i class="ph-fill ph-warning"></i> ' + sum.shortBands +
                  (sum.shortBands === 1 ? ' band is' : ' bands are') +
                  ' short. You can still send — the client will see the target and fall short of it.</p>'
                : '')
            : '<p class="ss-hint">Nothing to check against until there is an ask.</p>') +

          '<h5 class="ss-h">Link</h5>' +
          '<div class="ss-row">' +
            '<div class="c-field"><label for="ssName">Batch name</label>' +
              '<input id="ssName" data-ss="name" value="' + esc(state.name) + '" /></div>' +
            '<div class="c-field"><label for="ssExpiry">Expires</label>' +
              '<select id="ssExpiry" data-ss="expiryDays">' + EXPIRY_OPTIONS.map(function (o) {
                return '<option value="' + o.days + '"' +
                  (o.days === state.expiryDays ? ' selected' : '') + '>' + o.label + '</option>';
              }).join('') + '</select></div>' +
          '</div>' +
          '<div class="c-field"><label for="ssRecipient">Client contact <span class="ss-opt">(optional)</span></label>' +
            '<input id="ssRecipient" data-ss="recipient" value="' + esc(state.recipient) +
            '" placeholder="Name or email — recorded against their answers" /></div>' +
          '<label class="ss-check"><input type="checkbox" data-ss="requireName"' +
            (state.requireName ? ' checked' : '') + ' /> Ask for a name before responding</label>' +

          '<p class="ss-err" data-ss="err" hidden></p>' +
        '</div>' +
        '<div class="c-modal-foot">' +
          '<button class="c-btn c-btn-ghost c-btn-md" type="button" data-ss="cancel">Cancel</button>' +
          '<button class="c-btn c-btn-primary c-btn-md" type="button" data-ss="send">' +
            '<i class="ph ph-paper-plane-tilt"></i> Create preview link</button>' +
        '</div></div>';
    }

    function close() { host.remove(); }

    host.addEventListener('click', function (e) {
      if (e.target === host || e.target.closest('[data-ss="close"], [data-ss="cancel"]')) return close();
      if (!e.target.closest('[data-ss="send"]')) return;
      var v = validate(state);
      if (!v.ok) {
        var err = host.querySelector('[data-ss="err"]');
        err.textContent = v.message; err.hidden = false;
        return;
      }
      close();
      opts.onSend({
        mode: state.mode, campaignId: state.campaignId,
        leadName: state.leadName.trim(), leadBrand: state.leadBrand.trim(),
        ask: state.ask, name: state.name.trim(), recipient: state.recipient.trim(),
        expiresAt: expiryFrom(S.today(), Number(state.expiryDays)),
        requireName: state.requireName, infIds: state.infIds
      });
    });

    host.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'ssMode') { state.mode = t.value; askTouched = false; return render(); }
      if (t.dataset.ss === 'campaign') { state.campaignId = t.value; askTouched = false; return render(); }
      if (t.dataset.ss === 'ask') {
        askTouched = true;
        var n = Math.max(0, Number(t.value) || 0);
        state.ask[t.dataset.plat] = state.ask[t.dataset.plat] || {};
        if (n) state.ask[t.dataset.plat][t.dataset.tier] = n;
        else delete state.ask[t.dataset.plat][t.dataset.tier];
        return render();
      }
      if (t.dataset.ss === 'requireName') { state.requireName = t.checked; return; }
      if (t.dataset.ss === 'expiryDays') { state.expiryDays = Number(t.value); return; }
    });

    /* Text inputs update state without a re-render, so the caret stays put. */
    host.addEventListener('input', function (e) {
      var k = e.target.dataset.ss;
      if (k === 'leadName' || k === 'leadBrand' || k === 'name' || k === 'recipient') {
        state[k] = e.target.value;
      }
    });

    document.addEventListener('keydown', function esc2(e) {
      if (e.key === 'Escape' && document.body.contains(host)) { close(); document.removeEventListener('keydown', esc2); }
    });

    render();
    setTimeout(function () {
      var f = host.querySelector('select, input');
      if (f) f.focus();
    }, 60);
  }
```

Add `open: open,` to the exported object.

- [ ] **Step 2: Add the styles**

Append to `collabrium-dls`-composing page styles — but since this module is shared,
put the CSS in the module itself, injected once:

```js
  var CSS = [
    '.ss-modal{margin:var(--spacing-16); max-width:560px; max-height:86vh; display:flex; flex-direction:column;}',
    '.ss-modal .c-modal-body{overflow:auto;}',
    '.ss-count{margin:0 0 var(--spacing-16); font-size:var(--text-caption-size); color:var(--color-neutral-6);}',
    '.ss-h{margin:var(--spacing-20) 0 var(--spacing-8); font-size:var(--text-caption-size); font-weight:800; color:var(--color-neutral-9);}',
    '.ss-h:first-of-type{margin-top:0;}',
    '.ss-radio{display:flex; align-items:center; gap:8px; min-height:36px; font-size:var(--text-body2-size); cursor:pointer;}',
    '.ss-indent{margin:var(--spacing-4) 0 var(--spacing-12) 24px;}',
    '.ss-row{display:flex; gap:var(--spacing-12); flex-wrap:wrap;}',
    '.ss-row .c-field{flex:1; min-width:160px;}',
    '.ss-hint{margin:6px 0 0; font-size:var(--text-footnote-size); color:var(--color-neutral-6);}',
    '.ss-opt{font-weight:400; color:var(--color-neutral-5);}',
    '.ss-ask-row{display:flex; align-items:center; gap:var(--spacing-12); min-height:44px; font-size:var(--text-caption-size);}',
    '.ss-ask-row span{flex:1;}',
    '.ss-ask-row input{width:72px; height:36px; text-align:center; border:1px solid var(--color-neutral-3); border-radius:var(--radius-sm); font-family:inherit;}',
    '.ss-cov{width:100%; border-collapse:collapse; font-size:var(--text-caption-size);}',
    '.ss-cov td{padding:6px 0; border-bottom:1px solid var(--color-neutral-2);}',
    '.ss-cov td.n{text-align:right; font-weight:700; width:72px;}',
    '.ss-cov td.note{text-align:right; width:110px; color:var(--color-neutral-6);}',
    '.ss-cov tr.is-ok td.note{color:var(--color-green);}',
    '.ss-cov tr.is-short td.note{color:#8A5A00;}',
    '.ss-cov tr.is-none td.note{color:var(--color-red);}',
    '.ss-warn{display:flex; gap:6px; align-items:flex-start; margin:var(--spacing-8) 0 0; font-size:var(--text-footnote-size); color:#8A5A00;}',
    '.ss-check{display:flex; align-items:center; gap:8px; min-height:44px; font-size:var(--text-caption-size); cursor:pointer;}',
    '.ss-err{margin:var(--spacing-12) 0 0; color:var(--color-red); font-size:var(--text-caption-size);}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('ss-css')) return;
    var s = document.createElement('style');
    s.id = 'ss-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
```

Call `injectCSS();` as the first line of `open()`.

- [ ] **Step 3: Confirm the logic tests still pass**

Run: `node --test "tests/**/*.test.mjs"`
Expected: PASS — 61 tests, 0 failures. `open()` is not unit-tested; it is
verified in the browser in Task 4.

- [ ] **Step 4: Commit**

```bash
git add shared/send-sheet.js
git commit -m "send-sheet: the sheet itself, destination first"
```

---

## Task 4: Use it on the roster page

**Files:**
- Modify: `pages/influencers-v2.html`

- [ ] **Step 1: Delete the old sheet markup**

Remove the whole `<div class="inf-scrim" id="infSendScrim">…</div>` block — it starts
around line 1074 and ends at the matching `</div>`. The shared module builds its own.

- [ ] **Step 2: Load the module**

Add after the `campaign-model.js` script tag:

```html
<script src="../shared/send-sheet.js?v=1"></script>
```

- [ ] **Step 3: Replace the handlers**

Delete `openSend`, `closeSend`, `NEW_CAMPAIGN`, `sendScrim` and every
`document.getElementById('infSend…')` listener. Replace with:

```js
  /* "Send to campaign" hands the selection to a campaign — or to a new lead,
     for work that is not won yet. The sheet gathers the destination, the ask
     and the link options; writing to the store stays here. */
  document.getElementById('infSelGenerate').addEventListener('click', function () {
    if (!selected.size) return;
    window.sendSheet.open({
      infIds: Array.from(selected),
      people: byId,
      campaigns: campaignStore.merged(),
      onSend: function (r) {
        var id = r.campaignId;
        if (r.mode === 'lead') {
          id = campaignStore.createLead({
            name: r.leadName, brand: r.leadBrand, requirement: r.ask
          });
        } else if (Object.keys(r.ask).length) {
          /* Sending against an edited ask updates the campaign's own ask, so
             the next batch inherits the corrected figure. */
          campaignStore.setRequirement(id, mergeAsk(campaignStore.get(id), r.ask));
        }
        var n = campaignStore.addBatch(id, {
          name: r.name, infIds: r.infIds, ask: r.ask,
          recipient: r.recipient, expiresAt: r.expiresAt, requireName: r.requireName
        });
        location.href = 'campaign.html?id=' + encodeURIComponent(id) + '&tab=kol&batch=' + n;
      }
    });
  });

  /* The batch's ask is what is still outstanding, so the campaign's ask is
     that plus whatever is already filled. */
  function mergeAsk(c, ask) {
    var filled = window.campaignModel.slotStatus(c), out = {};
    Object.keys(ask).forEach(function (p) {
      Object.keys(ask[p]).forEach(function (t) {
        out[p] = out[p] || {};
        out[p][t] = ask[p][t] + (((filled[p] || {})[t] || {}).filled || 0);
      });
    });
    /* Bands already met keep their figure rather than disappearing. */
    Object.keys(filled).forEach(function (p) {
      Object.keys(filled[p]).forEach(function (t) {
        if (out[p] && out[p][t] != null) return;
        if (!filled[p][t].want) return;
        out[p] = out[p] || {};
        out[p][t] = filled[p][t].want;
      });
    });
    return out;
  }
```

- [ ] **Step 4: Verify in the browser**

With the server running, open `http://localhost:8796/pages/influencers-v2.html?v=p3`.

Check each of these and report what you saw:

| Check | Expected |
|---|---|
| Tick 3 profiles, click the selection CTA | The sheet opens, "Destination" first, `Existing campaign` selected |
| Choose `Enfagrow A+ MindPro Routine Phase 5` | "Still needs:" names the outstanding bands; the ask steppers seed from them |
| Look at Coverage | A row per asked band, with `have / want` and `covered` / `short N` / `nothing to show` |
| Pick a campaign you cannot cover | The amber warning appears and the Send button still works |
| Switch to `New lead`, leave the name blank, press Send | Inline error "Give the lead a name." — nothing is written |
| Fill the lead name, press Send | Lands on the new campaign's KOL Selection tab with the batch present |
| Go to `campaigns.html` | The lead is listed at stage `Lead` |
| Console | No errors |

- [ ] **Step 5: Commit**

```bash
git add pages/influencers-v2.html
git commit -m "roster: send to campaign through the shared sheet"
```

---

## Task 5: Use it on the campaign page

**Files:**
- Modify: `pages/campaign.html`

- [ ] **Step 1: Load the module**

```html
<script src="../shared/send-sheet.js?v=1"></script>
```

- [ ] **Step 2: Point the batch path at the sheet**

`openPicker(mode)` serves two jobs: `'roster'` adds people by hand, `'batch'` sends a
preview link. Keep `'roster'` exactly as it is. For `'batch'`, the existing picker
still chooses *who* — so run it first, then hand its result to the sheet.

Find where the picker confirms a batch (the handler that calls `S.addBatch`) and
replace the batch branch with:

```js
      window.sendSheet.open({
        infIds: ids,
        people: byInf,
        campaigns: S.merged(),
        defaultCampaignId: c.id,
        onSend: function (r) {
          var id = r.mode === 'lead'
            ? S.createLead({name: r.leadName, brand: r.leadBrand, requirement: r.ask})
            : r.campaignId;
          var n = S.addBatch(id, {
            name: r.name, infIds: r.infIds, ask: r.ask,
            recipient: r.recipient, expiresAt: r.expiresAt, requireName: r.requireName
          });
          if (id !== c.id) { location.href = 'campaign.html?id=' + encodeURIComponent(id) + '&tab=kol&batch=' + n; return; }
          renderAll();
          toast('Preview link created.');
        }
      });
```

- [ ] **Step 3: Verify in the browser**

Open `http://localhost:8796/pages/campaign.html?id=camp-004&tab=kol&v=p3`.

| Check | Expected |
|---|---|
| Click **New preview link**, pick 2 profiles, confirm | The sheet opens with this campaign preselected |
| The ask | Seeded from what camp-004 still owes, not from the 2 profiles you picked |
| Send | A new batch appears on the tab, with its picks showing per-channel status |
| **Add manually** | Still the plain picker, unchanged — no sheet |
| Console | No errors |

- [ ] **Step 4: Commit**

```bash
git add pages/campaign.html
git commit -m "campaign: send a preview link through the shared sheet"
```

---

## Task 6: The share page honours the link's terms

**Files:**
- Modify: `pages/share.html`
- Modify: `tests/send-sheet.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `tests/send-sheet.test.mjs`:

```js
test('a link is expired only when its date has passed', () => {
  assert.equal(SS.isExpired({expiresAt: '2026-09-13'}, '2026-09-14'), true);
  assert.equal(SS.isExpired({expiresAt: '2026-09-14'}, '2026-09-14'), false, 'the last day still works');
  assert.equal(SS.isExpired({expiresAt: '2026-09-15'}, '2026-09-14'), false);
  assert.equal(SS.isExpired({expiresAt: null}, '2026-09-14'), false, 'no expiry set');
  assert.equal(SS.isExpired({}, '2026-09-14'), false);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/send-sheet.test.mjs`
Expected: FAIL — `SS.isExpired is not a function`.

- [ ] **Step 3: Implement it**

In `shared/send-sheet.js`, beside `expiryFrom`:

```js
  /* Inclusive of the expiry day: a link that expires today still opens. */
  function isExpired(batch, todayISO) {
    var e = batch && batch.expiresAt;
    return !!e && String(e) < String(todayISO);
  }
```

Add `isExpired: isExpired,` to the export.

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test "tests/**/*.test.mjs"`
Expected: PASS — 62 tests, 0 failures.

- [ ] **Step 5: Use it on the share page**

Load the module in `pages/share.html`, after `campaign-model.js`:

```html
<script src="../shared/send-sheet.js?v=1"></script>
```

Extend the gate that already handles a missing campaign or batch:

```js
  if (!campaign || !batch) {
    E('shRoot').innerHTML = '<div class="sh-gate"><h1>This link is no longer available</h1>' +
      '<p>Ask your contact at KULT for a new one.</p></div>';
    return;
  }
  if (window.sendSheet.isExpired(batch, S.today())) {
    E('shRoot').innerHTML = '<div class="sh-gate"><h1>This link has expired</h1>' +
      '<p>It closed on ' + esc(S.fmtDate(batch.expiresAt, true)) +
      '. Ask your contact at KULT to reopen it.</p></div>';
    return;
  }
```

- [ ] **Step 6: Add the name prompt**

When `batch.requireName` is set and no name has been given yet, ask before showing the
list. The name is held per browser, beside the answers.

```js
  /* Who is answering. Only asked for when the sender ticked the box; kept in
     the same place as the answers, so a reload does not ask twice. */
  var NAME_KEY = 'collab-share-name-' + campaign.id + '-' + batch.n;
  function signer() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  }
  if (batch.requireName && !signer()) {
    E('shRoot').innerHTML = '<div class="sh-gate">' +
      '<h1>' + esc(campaign.name) + '</h1>' +
      '<p>Before you start, who should we record these choices against?</p>' +
      '<div class="sh-gate-form"><input id="shWho" placeholder="Your name" aria-label="Your name" />' +
      '<button class="c-btn c-btn-primary c-btn-md" type="button" id="shWhoGo">Continue</button></div></div>';
    E('shWhoGo').addEventListener('click', function () {
      var v = E('shWho').value.trim();
      if (!v) return E('shWho').focus();
      try { localStorage.setItem(NAME_KEY, v); } catch (e) {}
      location.reload();
    });
    E('shWho').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') E('shWhoGo').click();
    });
    return;
  }
```

Add the style beside the other `.sh-gate` rules:

```css
  .sh-gate-form{display:flex; gap:var(--spacing-8); margin-top:var(--spacing-16);
    justify-content:center; flex-wrap:wrap;}
  .sh-gate-form input{height:44px; min-width:220px; padding:0 var(--spacing-12);
    border:1px solid var(--color-neutral-3); border-radius:var(--radius-sm);
    font-family:inherit; font-size:var(--text-body2-size);}
  .sh-gate-form input:focus{outline:none; border-color:var(--color-navy);
    box-shadow:var(--shadow-focus);}
```

And show who is answering, under the masthead subtitle:

```js
      (signer() ? ' · answering as ' + esc(signer()) : '') +
```

appended to the existing `.sub` line's content.

- [ ] **Step 7: Verify in the browser**

| Check | Expected |
|---|---|
| `share.html?c=camp-004&b=1` | Opens as before — no expiry, no name set on the seeded batch |
| Send a fresh batch with expiry `14 days` and the name box ticked | Its link asks for a name first |
| Enter a name, continue | The list appears, masthead reads "answering as …" |
| Reload | It does not ask again |
| Hand-edit that batch's `expiresAt` to yesterday in devtools, reload | The expired gate shows, with the date |
| Console | No errors |

- [ ] **Step 8: Commit**

```bash
git add pages/share.html shared/send-sheet.js tests/send-sheet.test.mjs
git commit -m "share: honour the link's expiry and name prompt"
```

---

## Task 7: Full pass

**Files:** none — verification only.

- [ ] **Step 1: Run the suite**

Run: `node --test "tests/**/*.test.mjs"`
Expected: PASS — 62 tests, 0 failures.

- [ ] **Step 2: Check every shared file's version is consistent across pages**

```bash
grep -ho 'shared/[a-z-]*\.js?v=[0-9.]*' pages/*.html | sort | uniq -c
```

Each shared file must appear at exactly one version. A file at two versions means a
page is serving a stale copy.

- [ ] **Step 3: Walk every page**

| Page | Expect |
|---|---|
| `influencers-v2.html` | Roster renders; selection CTA opens the new sheet |
| `campaigns.html` | List renders; any lead shows at stage `Lead` |
| `campaign.html?id=camp-004&tab=kol` | Batches list, roster shows "Booked for" |
| `share.html?c=camp-004&b=1` | Contract, grouping and per-channel answers all work |

- [ ] **Step 4: End-to-end, once**

Pick 4 profiles on the roster → send as a **new lead** with an ask you cannot fully
cover → confirm the warning → send → open the generated share link → approve two
channels → return to the campaign and confirm both appear on the roster with the
right "Booked for" values, and that `campaigns.html` shows the lead.

- [ ] **Step 5: Commit anything outstanding**

```bash
git add -A
git commit -m "phase 3 complete — destination-first send sheet with coverage"
```

---

## Out of scope

- **The slot board** (phase 4) — `campaign.html`'s two stacked lists stay as they are.
- **The shortfall loop** (phase 5) — an open slot does not yet offer "Send batch 2".
- **Real client accounts.** The name prompt is a record of who answered, not
  authentication. Anyone with the link can still open it.
- **Editing a sent batch's ask.** The ask is copied onto the batch at send time and
  stays put; changing it means sending another.

## Open questions

- **Does an edited ask write back to the campaign?** Task 4 says yes via `mergeAsk`,
  so the next batch inherits the corrected figure. The alternative — batch-only, leaving
  the campaign's ask untouched — keeps the campaign as the single source of truth but
  makes the correction invisible to the next batch. Worth revisiting once someone has
  used it twice.
- **Expiry default of 30 days** is a guess. No production behaviour to match.
