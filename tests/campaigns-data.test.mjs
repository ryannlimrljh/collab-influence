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
