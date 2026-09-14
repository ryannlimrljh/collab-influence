// tests/tiers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadShared} from './helpers/load.mjs';

const {tierOf, tierByKey, TIERS} = loadShared('tiers.js');

test('seeder covers everything below 500', () => {
  assert.equal(tierOf(0).key, 'seeder');
  assert.equal(tierOf(438).key, 'seeder');
});

test('koc sits between 500 and 1000', () => {
  assert.equal(tierOf(500).key, 'koc');
  assert.equal(tierOf(708).key, 'koc');
  assert.equal(tierOf(932).key, 'koc');
});

test('bands above koc are unchanged', () => {
  assert.equal(tierOf(1000).key, 'nano');
  assert.equal(tierOf(4999).key, 'nano');
  assert.equal(tierOf(20000).key, 'mid');
  assert.equal(tierOf(99999).key, 'mid');
  assert.equal(tierOf(500000).key, 'mega');
  assert.equal(tierOf(1.2e6).key, 'mega');
});

test('null followers have no tier', () => {
  assert.equal(tierOf(null), null);
  assert.equal(tierOf(undefined), null);
});

test('every tier carries a key, name and dot colour', () => {
  assert.equal(TIERS.length, 7);
  for (const t of TIERS) {
    assert.ok(t.key && t.name && t.dot, `incomplete tier: ${JSON.stringify(t)}`);
  }
});

test('tierByKey round-trips', () => {
  assert.equal(tierByKey('macro').name, 'Macro');
  assert.equal(tierByKey('nope'), null);
});
