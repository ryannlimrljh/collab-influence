// tests/helpers/load.mjs
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* Load browser-global IIFE files into a fresh sandbox object.

   `window` and `localStorage` are passed as PARAMETERS, not installed on
   globalThis. That matters: every closure in the loaded file captures them
   lexically, so a function that looks up `window.tiers.tierOf(...)` when it is
   called — which is exactly what campaign-model.js does — still resolves
   correctly long after loadShared has returned. Installing them on globalThis
   and restoring in a `finally` looks tidier but breaks precisely that case.

   node:vm would also fix it, but objects built inside a vm context belong to
   another realm, and assert.deepEqual then fails on prototype identity for
   every array and object these tests compare. Same realm is the point.

   Files are evaluated in order against one shared sandbox, because
   campaign-model.js reads the tier table that tiers.js attaches. */
export function loadShared(...files) {
  const mem = {};
  const win = {
    localStorage: {
      getItem: k => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: k => { delete mem[k]; }
    },
    console
  };
  win.window = win;
  for (const f of files) {
    const src = readFileSync(join(ROOT, 'shared', f), 'utf8');
    new Function('window', 'localStorage', src)(win, win.localStorage);
  }
  return win;
}
