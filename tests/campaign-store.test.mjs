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
    batches: [{n: 1, picks: [{inf: 'inf-001', channels: {tiktok: 'selected'}}]}]}];
  const c = win.campaignStore.setChannelStatus('c1', 1, 'inf-001', 'tiktok', 'rejected');
  assert.equal(c.roster.length, 1, 'a hand-added entry is not the client\'s to remove');
  assert.equal(c.roster[0].source, 'team');
});

/* ── The bridge the campaign page uses while its UI is still per creator. */

test('setCreatorStatus fans the answer across every channel', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: [
    {n: 1, picks: [{inf: 'inf-001', channels: {tiktok: 'none', instagram: 'none'}}]}
  ]}];
  const c = win.campaignStore.setCreatorStatus('c1', 1, 'inf-001', 'selected');
  assert.deepEqual(c.batches[0].picks[0].channels, {tiktok: 'selected', instagram: 'selected'});
  assert.equal(c.roster.length, 2, 'both channels land on the roster');
});

test('setCreatorStatus taking an answer back clears both channels', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: [
    {n: 1, picks: [{inf: 'inf-001', channels: {tiktok: 'none', instagram: 'none'}}]}
  ]}];
  win.campaignStore.setCreatorStatus('c1', 1, 'inf-001', 'selected');
  const c = win.campaignStore.setCreatorStatus('c1', 1, 'inf-001', 'rejected');
  assert.deepEqual(c.roster, []);
  assert.deepEqual(c.batches[0].picks[0].channels, {tiktok: 'rejected', instagram: 'rejected'});
});

test('pickCounts reads the rollup, not a stale status field', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: [
    {n: 1, picks: [
      {inf: 'inf-001', channels: {tiktok: 'selected', instagram: 'rejected'}},
      {inf: 'inf-002', channels: {tiktok: 'none'}}
    ]}
  ]}];
  const counts = win.campaignStore.pickCounts(win.campaignStore.get('c1'));
  assert.equal(counts.requested, 2);
  assert.equal(counts.selected, 1);
  assert.equal(counts.none, 1);
});

test('updatePick writes remarks and refuses to write status', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: [
    {n: 1, picks: [{inf: 'inf-001', kultRemark: '', channels: {tiktok: 'none'}}]}
  ]}];
  const c = win.campaignStore.updatePick('c1', 1, 'inf-001',
    {kultRemark: 'strong parenting audience', status: 'selected'});
  assert.equal(c.batches[0].picks[0].kultRemark, 'strong parenting audience');
  assert.equal(c.batches[0].picks[0].status, undefined, 'status is not patchable here');
  assert.deepEqual(c.batches[0].picks[0].channels, {tiktok: 'none'}, 'channels untouched');
  assert.deepEqual(c.roster, [], 'remarks do not touch the roster');
});
