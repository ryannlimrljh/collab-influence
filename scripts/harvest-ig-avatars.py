#!/usr/bin/env python3
"""Harvest Instagram profile photos into assets/avatars/<id>-ig.jpg.

WHY THIS EXISTS
---------------
The obvious route — scrape <meta property="og:image"> off
instagram.com/<handle>/ — looks like it works and then quietly ruins the
dataset. Instagram serves the real og:image for the first handful of
requests, then starts handing back its own default brand graphic for
every subsequent handle while still returning HTTP 200. An earlier run
produced 484 files that were all the same logo. Nothing in the response
tells you this happened, so the only defence is to hash what you got.

WHAT ACTUALLY WORKS (measured, not assumed)
-------------------------------------------
1. PRIMARY — the web profile JSON endpoint:
       https://www.instagram.com/api/v1/users/web_profile_info/?username=<h>
   with the public web app id header `x-ig-app-id: 936619743392459` and a
   normal Chrome UA. Returns the full public profile as JSON, including
   `profile_pic_url_hd` (a 320x320 CDN jpg). This is the same call the
   real instagram.com web client makes, which is why it is not subject to
   the og:image poisoning. Measured 14/15 on a mixed sample, every image
   a distinct real photo.

2. FALLBACK — the public embed widget:
       https://www.instagram.com/<handle>/embed/
   Its inline JSON carries `profile_pic_url`, but only ever at s100x100,
   and the URL is signed per-size (rewriting s100x100 -> s320x320 gets a
   403). Lower quality, so it is only used when the API fails.

Things that do NOT work, so nobody retries them:
  * urllib against the profile page -> login shell, no og:image.
  * curl with a full Chrome UA against the profile page -> login shell.
  * curl with a bare UA -> og:image, but poisoned in bulk (see above).
  * /?__a=1&__d=dis -> HTTP 201, empty body.
  * unavatar.io (instagram and tiktok sources) -> HTTP 429 on essentially
    every request.

SAFETY
------
Every image is hashed. Any md5 appearing more than DUPE_LIMIT times across
all files on disk is Instagram's default graphic, not a face, and those
files are deleted at the end. A rolling window also aborts the run early
if the last STREAK_LIMIT downloads were all byte-identical, so a poisoned
run stops in seconds instead of burning through the whole roster.

Re-runnable: profiles that already have a -ig.jpg are skipped, so an
interrupted or rate-limited run can simply be started again.

Usage:
    python3 scripts/harvest-ig-avatars.py                # full roster
    python3 scripts/harvest-ig-avatars.py --limit 15     # sample first
    python3 scripts/harvest-ig-avatars.py --no-manifest  # leave manifest alone
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
from collections import Counter, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'avatars'
OUT.mkdir(parents=True, exist_ok=True)

# Public web-app id used by instagram.com itself. Not a secret, not an
# account credential — without it the endpoint returns an empty payload.
IG_APP_ID = '936619743392459'
CHROME_UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
             '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
# The embed widget wants the plain/short UA; a full Chrome UA gets the shell.
EMBED_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

MIN_BYTES = 2048        # anything smaller is a placeholder or an error page
DUPE_LIMIT = 3          # an md5 seen more than this often is the IG default
STREAK_LIMIT = 8        # identical downloads in a row => poisoned, abort
DELAY = 1.2             # seconds between profiles, be polite
BACKOFF = (30, 90, 180)  # escalating sleep on 429/401/403

EMBED_PIC_RE = re.compile(r'"profile_pic_url\\?":\\?"(.*?)\\?"')

# Accounts with no photo set still return a perfectly valid jpg — the grey
# silhouette. It is served from a different CDN collection than real photos:
# real ones live under t51.2885-19 / t51.82787-19, the anonymous placeholder
# under t1.30497-1. Cheaper and more reliable than inspecting pixels, and it
# catches the case on the very first request instead of waiting for the
# duplicate sweep to accumulate enough copies.
DEFAULT_PIC_MARKERS = ('/t1.30497-1/', '115870214_694925034696967')


def is_default_pic(url):
    return any(m in url for m in DEFAULT_PIC_MARKERS)


def load_profiles():
    txt = (ROOT / 'shared' / 'influencers-data.js').read_text(encoding='utf-8')
    data = json.loads('[' + txt.split('[\n', 1)[1].rsplit('\n];', 1)[0] + ']')
    out = []
    for rec in data:
        for p in rec.get('platforms', []):
            if p.get('platform') == 'instagram' and p.get('handle'):
                h = normalise(p['handle'])
                if h:
                    out.append((rec['id'], h))
                break
    return data, out


def normalise(handle):
    """Handles in the sheet are mostly clean, but tolerate @foo, stray
    whitespace and the occasional pasted profile URL."""
    h = handle.strip().strip('@').strip()
    if '/' in h:
        parts = [p for p in h.split('?')[0].split('/') if p]
        h = parts[-1] if parts else ''
    return h.strip()


def curl(url, headers=(), ua=CHROME_UA, timeout=25):
    cmd = ['curl', '-s', '--compressed', '--max-time', str(timeout), '-A', ua,
           '-w', '\n%{http_code}\t%{content_type}']
    for h in headers:
        cmd += ['-H', h]
    cmd.append(url)
    try:
        p = subprocess.run(cmd, capture_output=True)
    except Exception:
        return 0, '', b''
    if p.returncode != 0:
        return 0, '', b''
    body, _, tail = p.stdout.rpartition(b'\n')
    code, _, ctype = tail.decode('ascii', 'ignore').partition('\t')
    return int(code or 0), ctype, body


def unescape_cdn(u):
    return (u.replace('\\\\/', '/').replace('\\/', '/')
             .replace('\\u0026', '&').replace('&amp;', '&'))


def pic_via_api(handle, state):
    """Primary source. Returns (url_or_None, http_status)."""
    url = ('https://www.instagram.com/api/v1/users/web_profile_info/'
           '?username=' + handle)
    for attempt in range(len(BACKOFF) + 1):
        status, _, body = curl(url, headers=['x-ig-app-id: ' + IG_APP_ID,
                                             'Referer: https://www.instagram.com/'])
        if status in (401, 403, 429) and attempt < len(BACKOFF):
            wait = BACKOFF[attempt]
            print(f'    rate-limited ({status}), backing off {wait}s', flush=True)
            state['throttled'] += 1
            time.sleep(wait)
            continue
        if status != 200:
            return None, status
        try:
            user = json.loads(body)['data']['user']
        except Exception:
            return None, status
        if not user:
            return None, status
        pic = user.get('profile_pic_url_hd') or user.get('profile_pic_url')
        return (pic or None), status
    return None, 429


def pic_via_embed(handle):
    """Fallback source: the public embed widget. 100x100 only."""
    status, _, body = curl('https://www.instagram.com/%s/embed/' % handle,
                           ua=EMBED_UA)
    if status != 200:
        return None, status
    m = EMBED_PIC_RE.search(body.decode('utf-8', 'ignore'))
    if not m:
        return None, status
    return unescape_cdn(m.group(1)), status


def download(pic_url, path):
    """Fetch, sanity-check and resize. Returns the md5 of the stored file."""
    status, ctype, body = curl(pic_url, headers=['Referer: https://www.instagram.com/'])
    if status != 200 or not ctype.startswith('image/'):
        return None
    if body[:2] != b'\xff\xd8' or len(body) < MIN_BYTES:
        return None
    path.write_bytes(body)
    subprocess.run(['sips', '-Z', '240', str(path)], capture_output=True)
    return hashlib.md5(path.read_bytes()).hexdigest()


def purge_duplicates():
    """Instagram's default graphic is byte-identical everywhere it is
    served, so any hash shared by more than DUPE_LIMIT files is not a real
    profile photo. Runs over everything on disk, including files kept from
    previous runs, so poison introduced earlier is cleaned up too."""
    hashes = {}
    for p in sorted(OUT.glob('*-ig.jpg')):
        try:
            hashes[p] = hashlib.md5(p.read_bytes()).hexdigest()
        except OSError:
            continue
    counts = Counter(hashes.values())
    bad = {h for h, n in counts.items() if n > DUPE_LIMIT}
    purged = 0
    for p, h in hashes.items():
        if h in bad:
            p.unlink()
            purged += 1
    if purged:
        print(f'POISON DETECTED: purged {purged} files across {len(bad)} '
              f'repeated hash(es) — these were Instagram default graphics, '
              f'not profile photos.', flush=True)
    return purged


def write_manifest(data):
    """Rebuilt from disk and covering BOTH platforms — the pages read one
    shared AVATAR_FILES map, so writing only 'ig' would drop the TikTok
    avatars harvested by scripts/harvest-tt-avatars.py."""
    manifest = {}
    for rec in data:
        m = {}
        if (OUT / f"{rec['id']}-tt.jpg").exists():
            m['tt'] = 1
        if (OUT / f"{rec['id']}-ig.jpg").exists():
            m['ig'] = 1
        if m:
            manifest[rec['id']] = m
    (ROOT / 'shared' / 'avatar-manifest.js').write_text(
        '/* Generated by scripts/harvest-ig-avatars.py — do not hand-edit. */\n'
        'var AVATAR_FILES = ' + json.dumps(manifest, separators=(',', ':')) + ';\n',
        encoding='utf-8')
    return manifest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0,
                    help='only attempt the first N profiles still missing a photo')
    ap.add_argument('--no-manifest', action='store_true',
                    help='do not rewrite shared/avatar-manifest.js')
    ap.add_argument('--force', action='store_true',
                    help='re-download even if the file already exists')
    ap.add_argument('--only-missing', action='store_true',
                    help='skip profiles that already have ANY avatar (i.e. a '
                         'TikTok one) — use this to close the last gaps '
                         'without re-requesting the whole roster')
    args = ap.parse_args()

    data, profiles = load_profiles()
    todo = [(i, h) for i, h in profiles
            if args.force or not (OUT / f'{i}-ig.jpg').exists()]
    if args.only_missing:
        todo = [(i, h) for i, h in todo if not (OUT / f'{i}-tt.jpg').exists()]
    have = len(profiles) - len(todo)
    if args.limit:
        todo = todo[:args.limit]

    print(f'{len(profiles)} instagram handles — {have} already on disk, '
          f'attempting {len(todo)}', flush=True)

    state = {'throttled': 0}
    ok = miss = nophoto = 0
    via = Counter()
    streak = deque(maxlen=STREAK_LIMIT)
    aborted = False

    for n, (iid, handle) in enumerate(todo, 1):
        path = OUT / f'{iid}-ig.jpg'
        digest = None
        blank = False
        pic, status = pic_via_api(handle, state)
        source = 'api'
        if pic and is_default_pic(pic):
            # No photo set. The embed widget would hand back the same
            # silhouette, so don't spend a second request on it.
            blank = True
        elif pic:
            digest = download(pic, path)
        if not digest and not blank:
            time.sleep(DELAY)
            pic, estatus = pic_via_embed(handle)
            source = 'embed'
            if pic and is_default_pic(pic):
                blank = True
            elif pic:
                digest = download(pic, path)
            if not digest:
                status = f'{status}/{estatus}'

        if blank:
            nophoto += 1
            if path.exists():
                path.unlink()
            print(f'  [{n}/{len(todo)}] {iid} @{handle} -> no photo set '
                  f'(default silhouette, skipped)', flush=True)
        elif digest:
            ok += 1
            via[source] += 1
            streak.append(digest)
            print(f'  [{n}/{len(todo)}] {iid} @{handle} -> ok ({source})', flush=True)
        else:
            miss += 1
            if path.exists():
                path.unlink()
            print(f'  [{n}/{len(todo)}] {iid} @{handle} -> miss (http {status})',
                  flush=True)

        # Early poison guard: identical bytes N times running means the CDN
        # has started serving one canned image. Stop before wrecking the set.
        if len(streak) == STREAK_LIMIT and len(set(streak)) == 1:
            print(f'\nABORTING: the last {STREAK_LIMIT} downloads were '
                  f'byte-identical. Instagram is serving a canned image. '
                  f'Wait a while and re-run.', flush=True)
            aborted = True
            break

        time.sleep(DELAY)

    purged = purge_duplicates()

    print(f'\ndone — new:{ok} miss:{miss} no-photo:{nophoto} purged:{purged} '
          f'throttled:{state["throttled"]} '
          f'(via api:{via["api"]} embed:{via["embed"]})')
    total = len(list(OUT.glob('*-ig.jpg')))
    print(f'{total} instagram photos on disk')

    if args.no_manifest:
        print('manifest not rewritten (--no-manifest)')
    else:
        manifest = write_manifest(data)
        print(f'manifest: {len(manifest)} profiles with a local avatar')

    return 1 if aborted else 0


if __name__ == '__main__':
    sys.exit(main())
