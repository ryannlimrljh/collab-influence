// tests/helpers/load.mjs
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* Load browser-global IIFE files into a fresh sandbox object.
   Files are evaluated in order against one shared `window`, because
   campaign-model.js reads the tier table that tiers.js attaches. */
export function loadShared(...files) {
  const mem = {};
  const win = {
    localStorage: {
      getItem: k => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: k => { delete mem[k]; }
    }
  };
  win.window = win;
  const prevWindow = globalThis.window;
  const prevStorage = globalThis.localStorage;
  globalThis.window = win;
  globalThis.localStorage = win.localStorage;
  try {
    for (const f of files) {
      (0, eval)(readFileSync(join(ROOT, 'shared', f), 'utf8'));
    }
  } finally {
    globalThis.window = prevWindow;
    globalThis.localStorage = prevStorage;
  }
  return win;
}
