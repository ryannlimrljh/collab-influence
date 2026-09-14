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
