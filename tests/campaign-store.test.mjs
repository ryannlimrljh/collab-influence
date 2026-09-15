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

test('addBatch omits channels when it has no profiles to read them from', () => {
  /* campaigns.html creates a batch without loading the influencer file.
     An empty channels map is truthy and migrate() would treat the pick as
     already migrated, stranding it without channels forever. */
  const win = loadShared('tiers.js', 'campaign-model.js', 'campaign-store.js');
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: []}];
  const n = win.campaignStore.addBatch('c1', {infIds: ['inf-001']});
  const pick = win.campaignStore.get('c1').batches[n - 1].picks[0];
  assert.equal(pick.channels, undefined, 'left for migrate() to fill in');
  assert.equal(pick.inf, 'inf-001');
});

test('a channel-less pick is migrated once a page supplies the profiles', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: [
    {n: 1, picks: [{inf: 'inf-001', kultRemark: '', clientRemark: ''}]}
  ]}];
  const pick = win.campaignStore.get('c1').batches[0].picks[0];
  assert.deepEqual(pick.channels, {tiktok: 'none', instagram: 'none'});
});


test('a stage change writes one activity line, whoever makes it', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'lead', roster: [], batches: []}];
  const S = win.campaignStore;
  S.update('c1', {stage: 'sourcing'});
  const c = S.get('c1');
  assert.equal(c.activity.length, 1);
  assert.equal(c.activity[0].type, 'stage');
  assert.match(c.activity[0].text, /Marked as won/);
  S.update('c1', {name: 'renamed'});
  assert.equal(S.get('c1').activity.length, 1, 'a plain edit does not log');
});

test('batches, answers, confirmations and notes all land in the same stream', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: []}];
  const S = win.campaignStore;
  const n = S.addBatch('c1', {infIds: ['inf-001'], recipient: 'amy@brand.com'});
  S.setChannelStatus('c1', n, 'inf-001', 'tiktok', 'selected');
  S.setRosterState('c1', 'inf-001', 'tiktok', 'confirmed');
  S.addNote('c1', '  Client wants Malay-speaking creators.  ');
  S.addNote('c1', '   ');
  const types = S.get('c1').activity.map(e => e.type);
  assert.deepEqual(types, ['batch', 'answer', 'roster', 'note']);
  const a = S.get('c1').activity;
  assert.match(a[0].text, /Sent batch 1 to amy@brand.com/);
  assert.match(a[1].text, /Client approved .* on TikTok/);
  assert.match(a[2].text, /Confirmed .* on TikTok/);
  assert.equal(a[3].text, 'Client wants Malay-speaking creators.');
  assert.ok(a.every(e => e.by === 'Digital Team' && e.at));
});

test('a created campaign starts with its creation line', () => {
  const win = fresh();
  win.CAMPAIGNS = [];
  const S = win.campaignStore;
  const id = S.createLead({name: 'Pitch'});
  assert.equal(S.get(id).activity[0].text, 'Created as a lead');
  const id2 = S.add({name: 'Won', stage: 'sourcing'});
  assert.equal(S.get(id2).activity[0].text, 'Created');
});

test('setSubstitution moves where a fill is counted and logs it', () => {
  const {campaignStore: S} = fresh();
  const id = S.createLead({name: 'Sub', requirement: {tiktok: {mid: 1}}});
  S.addToRoster(id, [{inf: 'inf-002', platform: 'tiktok', tier: 'micro'}], 'team', null);
  S.setSubstitution(id, 'inf-002', 'tiktok', 'mid');
  let c = S.get(id);
  assert.equal(c.roster[0].substitutedFor, 'mid');
  assert.equal(c.roster[0].tier, 'micro', 'the real tier stays');
  assert.match(c.activity[c.activity.length - 1].text, /Counted .* on TikTok toward Mid/);
  S.setSubstitution(id, 'inf-002', 'tiktok', null);
  c = S.get(id);
  assert.equal(c.roster[0].substitutedFor, null);
  assert.match(c.activity[c.activity.length - 1].text, /Stopped counting/);
});

test('deliverables: add, update with logging, remove; the ring reads the list', () => {
  const win = fresh(); const S = win.campaignStore, M = win.campaignModel;
  const id = S.createLead({name: 'D', requirement: {tiktok: {mid: 1}}});
  S.addToRoster(id, [{inf: 'inf-001', platform: 'tiktok', tier: 'macro'}], 'team', null);
  const did = S.addDeliverable(id, {inf: 'inf-001', platform: 'instagram'});
  let c = S.get(id);
  assert.equal(c.deliverables.length, 1);
  assert.equal(c.deliverables[0].kind, 'reel', 'first kind for the platform');
  assert.equal(c.deliverables[0].status, 'not_started');
  assert.match(c.activity[c.activity.length - 1].text, /Planned a Instagram reel for inf-001/);
  S.updateDeliverable(id, did, {caption: 'hello'});
  c = S.get(id);
  assert.equal(c.deliverables[0].caption, 'hello');
  assert.doesNotMatch(c.activity[c.activity.length - 1].text, /hello/, 'plain edits are not logged');
  S.updateDeliverable(id, did, {status: 'posted'});
  c = S.get(id);
  assert.match(c.activity[c.activity.length - 1].text, /as posted/);
  assert.deepEqual(M.deliverableCounts(c), {done: 1, total: 1, list: true});
  S.updateDeliverable(id, did, {clientApproval: 'changes'});
  c = S.get(id);
  assert.match(c.activity[c.activity.length - 1].text, /Client asked for changes/);
  assert.equal(c.activity[c.activity.length - 1].ref.client, true);
  S.updateDeliverable(id, did, {platform: 'tiktok'});
  assert.equal(S.get(id).deliverables[0].kind, 'video', 'kind follows the platform');
  S.removeDeliverable(id, did);
  assert.equal(S.get(id).deliverables.length, 0);
});

test('the first deliverable replaces an old {done,total} pair', () => {
  const win = fresh(); const S = win.campaignStore, M = win.campaignModel;
  win.CAMPAIGNS = [{id: 'c9', stage: 'drafting', roster: [], batches: [], deliverables: {done: 1, total: 8}}];
  assert.deepEqual(M.deliverableCounts(S.get('c9')), {done: 1, total: 8, list: false});
  S.addDeliverable('c9', {inf: 'inf-001', platform: 'tiktok'});
  assert.deepEqual(M.deliverableCounts(S.get('c9')), {done: 0, total: 1, list: true});
});

test('salespeople lists everyone named on a campaign plus names added by hand, once', () => {
  const win = fresh(); const S = win.campaignStore;
  win.CAMPAIGNS = [{id: 'a', salesperson: 'Grace Wong', roster: [], batches: []}, {id: 'b', salesperson: 'grace wong', roster: [], batches: []}, {id: 'c', salesperson: '', roster: [], batches: []}];
  assert.deepEqual(S.salespeople(), ['Grace Wong']);
  S.addSalesperson('Amir Rahman'); S.addSalesperson('  '); S.addSalesperson('amir rahman');
  assert.deepEqual(S.salespeople(), ['Amir Rahman', 'Grace Wong']);
  S.reset();
  assert.deepEqual(S.salespeople(), ['Amir Rahman', 'Grace Wong'], 'survives a store reset');
});

test('removeBatch drops the list and the roster fills the client put there, keeps hand-added ones', () => {
  const win = fresh(); const S = win.campaignStore;
  const id = S.createLead({name: 'RB', requirement: {tiktok: {mid: 1}}});
  const n = S.addBatch(id, {infIds: ['inf-001']});
  S.setChannelStatus(id, n, 'inf-001', 'tiktok', 'selected');
  S.addToRoster(id, [{inf: 'inf-002', platform: 'tiktok', tier: 'mid'}], 'team', null);
  assert.equal(S.get(id).roster.length, 2);
  S.removeBatch(id, n);
  const c = S.get(id);
  assert.equal(c.batches.length, 0);
  assert.deepEqual(c.roster.map(r => r.inf), ['inf-002']);
  assert.match(c.activity[c.activity.length - 1].text, /Deleted batch 1/);
});

test('addFiles keeps small files with their data, big ones by name, and writes one activity line', () => {
  const win = fresh();
  win.CAMPAIGNS = [{id: 'c1', stage: 'sourcing', roster: [], batches: [], activity: []}];
  const S = win.campaignStore;
  const ids = S.addFiles('c1', [
    {name: 'brief.pdf', size: 1200, type: 'application/pdf', data: 'data:application/pdf;base64,QUJD'},
    {name: 'deck.pptx', size: S.FILE_KEEP + 1, type: 'application/vnd.ms-powerpoint', data: 'data:x;base64,QUJD'}
  ]);
  const c = S.get('c1');
  assert.equal(ids.length, 2);
  assert.equal(c.files.length, 2);
  assert.equal(c.files[0].data, 'data:application/pdf;base64,QUJD');
  assert.equal(c.files[1].data, null, 'past the cap only the name and size stay');
  assert.match(c.activity.slice(-1)[0].text, /^Attached 2 files: brief\.pdf, deck\.pptx$/);
  S.removeFile('c1', ids[0]);
  assert.deepEqual(S.get('c1').files.map(f => f.name), ['deck.pptx']);
  assert.equal(S.get('c1').activity.slice(-1)[0].text, 'Removed brief.pdf');
});

test('file helpers: sizes read naturally and icons follow the type', () => {
  const {campaignStore: S} = fresh();
  assert.equal(S.fmtSize(900), '900 B');
  assert.equal(S.fmtSize(20480), '20 KB');
  assert.equal(S.fmtSize(2.5 * 1048576), '2.5 MB');
  assert.equal(S.fileIcon({type: 'application/pdf', name: 'x.pdf'}), 'ph-file-pdf');
  assert.equal(S.fileIcon({type: '', name: 'deck.pptx'}), 'ph-presentation-chart');
  assert.equal(S.fileIcon({type: 'image/png', name: 'a.png'}), 'ph-file-image');
  assert.equal(S.fileIcon({type: '', name: 'notes.txt'}), 'ph-file');
});
