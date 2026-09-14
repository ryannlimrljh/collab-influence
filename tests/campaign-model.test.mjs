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
