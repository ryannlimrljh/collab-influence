import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadShared} from './helpers/load.mjs';

const win = loadShared('tiers.js', 'campaign-model.js');

/* campaigns-data.js is a plain assignment to window.CAMPAIGNS, so evaluate
   it with `window` bound to the sandbox, the same way loadShared does. */
const src = readFileSync(new URL('../shared/campaigns-data.js', import.meta.url), 'utf8');
new Function('window', src)(win);

const byId = Object.fromEntries(win.CAMPAIGNS.map(c => [c.id, c]));

test('camp-004 asks for five channel slots', () => {
  assert.equal(win.campaignModel.derivedPax(byId['camp-004']), 5);
});

test('camp-001 asks for three', () => {
  assert.equal(win.campaignModel.derivedPax(byId['camp-001']), 3);
});

test('every requirement uses real platform and tier keys', () => {
  const platforms = win.campaignStore ? null : ['tiktok', 'instagram', 'xhs'];
  const tiers = win.tiers.TIERS.map(t => t.key);
  for (const c of win.CAMPAIGNS) {
    for (const [p, bands] of Object.entries(c.requirement || {})) {
      assert.ok(platforms.includes(p), `${c.id}: unknown platform ${p}`);
      for (const t of Object.keys(bands)) {
        assert.ok(tiers.includes(t), `${c.id}: unknown tier ${t}`);
      }
      for (const v of Object.values(bands)) {
        assert.ok(Number.isInteger(v) && v > 0, `${c.id}: bad count ${v}`);
      }
    }
  }
});

test('every batch carries an integer number', () => {
  for (const c of win.CAMPAIGNS) {
    for (const b of c.batches || []) {
      assert.ok(Number.isInteger(b.n), `${c.id}: batch without a number`);
    }
  }
});

test('seeded activity is well-formed and in time order', () => {
  const TYPES = ['create', 'stage', 'batch', 'answer', 'roster', 'edit', 'note', 'deliverable', 'file'];
  for (const c of win.CAMPAIGNS) {
    const a = c.activity || [];
    let last = '';
    for (const e of a) {
      assert.ok(TYPES.includes(e.type), `${c.id}: type ${e.type}`);
      assert.match(e.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, `${c.id}: at ${e.at}`);
      assert.ok(e.text && e.by, `${c.id}: text and by`);
      assert.ok(e.at >= last, `${c.id}: newest last`);
      assert.ok(e.at <= new Date().toISOString(), `${c.id}: ${e.at} is in the future`);
      last = e.at;
      if (e.ref && e.ref.batch != null) assert.ok((c.batches || []).some(b => b.n === e.ref.batch), `${c.id}: ref batch ${e.ref.batch} exists`);
    }
  }
});

test('seeded deliverables reference roster creators with real kinds and states', () => {
  const KINDS = {tiktok: ['video'], instagram: ['reel', 'post', 'story'], xhs: ['note']};
  const STATUS = ['not_started', 'drafted', 'review', 'approved', 'posted'];
  const CLIENT = ['pending', 'approved', 'changes'];
  for (const c of win.CAMPAIGNS) {
    if (!Array.isArray(c.deliverables)) continue;
    const onRoster = new Set((c.roster || []).map(r => r.inf));
    const ids = new Set();
    for (const d of c.deliverables) {
      assert.ok(d.id && !ids.has(d.id), `${c.id}: unique id ${d.id}`); ids.add(d.id);
      assert.ok(onRoster.has(d.inf), `${c.id}: ${d.inf} is on the roster`);
      assert.ok((KINDS[d.platform] || []).includes(d.kind), `${c.id}: ${d.platform} ${d.kind}`);
      assert.ok(STATUS.includes(d.status) && CLIENT.includes(d.clientApproval), `${c.id}: states`);
    }
  }
  const c1 = byId['camp-001'];
  assert.equal(c1.deliverables.length, 8);
  assert.equal(c1.deliverables.filter(d => d.status === 'posted').length, 1);
});
