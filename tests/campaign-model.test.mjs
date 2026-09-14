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

/* ── The creator-level rollup the campaign page still reads. */

test('pickStatus takes the most positive answer across channels', () => {
  assert.equal(M.pickStatus({channels: {tiktok: 'selected', instagram: 'rejected'}}), 'selected');
  assert.equal(M.pickStatus({channels: {tiktok: 'kiv', instagram: 'rejected'}}), 'kiv');
  assert.equal(M.pickStatus({channels: {tiktok: 'rejected', instagram: 'unavailable'}}), 'rejected');
  assert.equal(M.pickStatus({channels: {tiktok: 'unavailable'}}), 'unavailable');
});

test('pickStatus is none when nothing is answered, or there are no channels', () => {
  assert.equal(M.pickStatus({channels: {tiktok: 'none', instagram: 'none'}}), 'none');
  assert.equal(M.pickStatus({channels: {}}), 'none');
  assert.equal(M.pickStatus({}), 'none');
  assert.equal(M.pickStatus(null), 'none');
});

test('pickStatus round-trips a migrated record, where channels agree', () => {
  const out = M.migrate({roster: [], batches: [
    {n: 1, picks: [{inf: 'inf-001', status: 'kiv'}]}
  ]}, PEOPLE);
  assert.equal(M.pickStatus(out.batches[0].picks[0]), 'kiv');
});

/* ── Load order must never decide whether data survives. */

test('without people the record passes through in its stored shape', () => {
  const stored = {
    roster: [{inf: 'inf-001', source: 'client', batch: 1}],
    batches: [{n: 1, picks: [{inf: 'inf-001', status: 'selected'}]}]
  };
  const out = M.migrate(stored, {});
  assert.deepEqual(out.roster, stored.roster, 'roster is not emptied');
  assert.equal(out.batches[0].picks[0].status, 'selected', 'the answer is not lost');
  assert.equal(out.batches[0].picks[0].channels, undefined, 'nothing is half-migrated');
  assert.deepEqual(out.requirement, {}, 'requirement is still defaulted');
});

test('with people present, a stale id is still dropped', () => {
  const out = M.migrate({roster: [{inf: 'inf-999', source: 'team', batch: null}], batches: []}, PEOPLE);
  assert.deepEqual(out.roster, []);
});

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

/* ── deliverableCounts and nextUp. */
test('deliverableCounts reads {done,total} until the list exists, then posted/length', () => {
  assert.deepEqual(M.deliverableCounts({deliverables: {done: 1, total: 8}}), {done: 1, total: 8, list: false});
  assert.deepEqual(M.deliverableCounts({}), {done: 0, total: 0, list: false});
  assert.deepEqual(M.deliverableCounts({deliverables: [
    {inf: 'a', status: 'posted'}, {inf: 'a', status: 'drafted'}, {inf: 'b', status: 'posted'}
  ]}), {done: 2, total: 3, list: true});
});

test('nextUp on a lead walks ask → send → wait', () => {
  let n = M.nextUp({stage: 'lead'});
  assert.equal(n.primary.action, 'ask'); assert.equal(n.secondary.action, 'won');
  n = M.nextUp({stage: 'lead', requirement: {tiktok: {mid: 1}}});
  assert.equal(n.sentence, 'Nothing sent to the client yet.');
  assert.equal(n.primary.label, 'Send selection list'); assert.equal(n.primary.action, 'send');
  n = M.nextUp({stage: 'lead', requirement: {tiktok: {mid: 1}}, batches: [{n: 1, sentAt: '2026-09-10'}]});
  assert.match(n.sentence, /Waiting on the client · sent \{date\}/);
  assert.equal(n.date, '2026-09-10');
  assert.equal(n.primary.action, 'client'); assert.equal(n.secondary.action, 'won');
});

test('nextUp in sourcing: confirm first, then send, then move on', () => {
  const req = {tiktok: {mid: 2}};
  let n = M.nextUp({stage: 'sourcing', requirement: req, batches: [{n: 1}],
    roster: [{inf: 'a', platform: 'tiktok', tier: 'mid', state: 'approved'}]});
  assert.equal(n.sentence, '1 approval to confirm and 1 open slot.');
  assert.equal(n.primary.label, 'Confirm availability (1)'); assert.equal(n.primary.action, 'confirm');
  assert.equal(n.secondary.label, 'Send batch 2');
  n = M.nextUp({stage: 'sourcing', requirement: req, roster: []});
  assert.equal(n.sentence, '2 open slots.');
  assert.equal(n.primary.label, 'Send batch 1'); assert.equal(n.secondary, null);
  n = M.nextUp({stage: 'sourcing', requirement: req, roster: [
    {inf: 'a', platform: 'tiktok', tier: 'mid', state: 'confirmed'},
    {inf: 'b', platform: 'tiktok', tier: 'mid', state: 'confirmed'}]});
  assert.equal(n.sentence, 'Line-up complete.');
  assert.equal(n.primary.action, 'stage:drafting');
  n = M.nextUp({stage: 'sourcing'});
  assert.equal(n.primary.action, 'ask');
});

test('nextUp in drafting and posting reads the deliverables', () => {
  const roster = [{inf: 'a', platform: 'tiktok', tier: 'mid', state: 'confirmed'},
                  {inf: 'b', platform: 'instagram', tier: 'mid', state: 'confirmed'}];
  let n = M.nextUp({stage: 'drafting', roster, deliverables: {done: 0, total: 0}});
  assert.equal(n.sentence, '2 creators have no deliverables yet.');
  assert.equal(n.primary.action, 'tab:deliverables'); assert.equal(n.secondary.action, 'stage:posting');
  n = M.nextUp({stage: 'drafting', roster, deliverables: [{inf: 'a', status: 'drafted'}, {inf: 'b', status: 'not_started'}]});
  assert.equal(n.sentence, '2 deliverables planned.');
  assert.equal(n.primary.action, 'stage:posting');
  n = M.nextUp({stage: 'drafting', roster: []});
  assert.equal(n.primary.action, 'tab:selection');
  n = M.nextUp({stage: 'posting', roster, deliverables: {done: 1, total: 8}});
  assert.equal(n.sentence, '1 of 8 posted.');
  assert.equal(n.primary.label, 'Track deliverables'); assert.equal(n.secondary.action, 'stage:reporting');
  n = M.nextUp({stage: 'posting', roster, deliverables: {done: 3, total: 3}});
  assert.equal(n.primary.action, 'stage:reporting'); assert.equal(n.secondary, null);
});

test('nextUp on the late stages just moves on, and completed only reports', () => {
  assert.equal(M.nextUp({stage: 'reporting'}).primary.action, 'stage:payment');
  assert.equal(M.nextUp({stage: 'payment'}).primary.label, 'Move to Completed');
  const n = M.nextUp({stage: 'completed', end: '2026-10-01'});
  assert.equal(n.sentence, 'Wrapped {date}.'); assert.equal(n.date, '2026-10-01');
  assert.equal(n.primary, null); assert.equal(n.secondary, null);
});
