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

/* ── Rows to show. The bug this covers: a campaign with no ask rendered no
   rows, so there was nowhere to type the numbers — the ask ended up bounded
   by whether the campaign already had one. */

test('bandRows shows a row for every band the picks occupy, even with no ask', () => {
  const rows = SS.bandRows({}, ['a', 'b'], PEOPLE);
  assert.deepEqual(rows, [
    {platform: 'tiktok',    tier: 'macro', want: 0, have: 1, gap: 0},
    {platform: 'instagram', tier: 'mid',   want: 0, have: 1, gap: 0},
    {platform: 'tiktok',    tier: 'mid',   want: 0, have: 1, gap: 0}
  ]);
});

test('bandRows lists asked bands first, then the extras being sent', () => {
  const rows = SS.bandRows({instagram: {mid: 2}}, ['a', 'b'], PEOPLE);
  assert.deepEqual(rows[0], {platform: 'instagram', tier: 'mid', want: 2, have: 1, gap: 1});
  assert.equal(rows.length, 3, 'plus the two bands only the picks occupy');
});

test('bandRows keeps an asked band with nobody to fill it', () => {
  const rows = SS.bandRows({xhs: {micro: 3}}, ['b'], PEOPLE);
  assert.deepEqual(rows[0], {platform: 'xhs', tier: 'micro', want: 3, have: 0, gap: 3});
});

test('bandRows with nothing at all is empty', () => {
  assert.deepEqual(SS.bandRows({}, [], PEOPLE), []);
});
