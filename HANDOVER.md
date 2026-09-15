# Collab:Influence — Influencers page

A standalone HTML prototype of the influencer roster for Collab:Influence.
No build step, no dependencies, no server framework — it is plain HTML, CSS
and JavaScript that runs from any static file server.

---

## ⚠️ Read this first: the dataset contains real personal data

`shared/influencers-data.js` holds **277 records with real NRIC numbers,
home addresses, phone numbers and email addresses**.

- Do not deploy this publicly without access protection.
- Do not commit it to a public repository.
- The page deliberately keeps PII **off** the cards and the list — it appears
  only inside the detail modal, in a gold-tinted block labelled
  "Sensitive. Never shown outside this workspace."

There is currently a Vercel deployment at `collab-influence.vercel.app`.
**It is not access-protected**, which means the data file is readable by
anyone with the URL. If you keep using it, turn on
Settings → Deployment Protection → Vercel Authentication first.

---

## Run it

There is no build. Serve the folder and open the page:

```bash
cd collab-influence
python3 -m http.server 8796
```

Then open **http://localhost:8796/pages/influencers-v2.html**

The browser caches this page hard. When you change something and the change
does not appear, add a cache-buster: `?v=2`, `?v=3`, and so on.

## Which file am I editing?

| File | What it is |
|---|---|
| `pages/influencers-v2.html` | **The current roster design.** |
| `pages/campaigns.html` | **Campaigns list** — pipeline track with a ghost *Lead* node, board view (drag a card between columns to change its stage) and table view, the stepped Add / Edit campaign sheet. |
| `pages/campaign.html?id=…` | **Campaign page** — stage track, *Next up* strip, run-date timeline, deliverables ring, and the tabs Overview · Selection · Deliverables · Documents · Activity. Documents is still a designed placeholder that reads the roster. |
| `pages/share.html?c=…&b=…` | **The client's page** for one sent batch — they answer per channel and it writes straight back to the campaign. |
| `pages/influencers.html` | The earlier roster version, kept for comparison. Not maintained. |

Campaign records carry a `color` field from the live app's form. Nothing renders it any more (the card stripe and title bar were removed as noise); it is kept in the data so it can come back if the team gives it a meaning.

Open **http://localhost:8796/pages/campaigns.html** for the campaigns surface.

### The campaign feature in one paragraph

Two routes into the same thing. **Route 1:** create a campaign from the list — three steps, Basics, *The ask* (steppers per platform × tier; pax and platforms derive from it) and Commercials — with a *lead* switch on step 1 for anything not yet won. **Route 2:** multi-select on the roster page and *Create selection list*, which sends a batch against an existing campaign or a new lead. Either way you land on the campaign page, where *Next up* says the one thing to do, and **Selection** is a board laid out from the ask: one card per band, the client's approvals arriving as fills you confirm or mark unavailable, open slots offering *Send batch k* (the send sheet, destination locked) or *Add by hand*. Confirmed creators then get **Deliverables**, whose statuses feed the ring, and everything the store writes shows in **Activity** alongside the team's notes. The design specs are in `docs/superpowers/specs/`; the campaign overhaul one is the current map.

Everything lives in that one file — markup, styles and behaviour — on purpose,
so the prototype stays portable. It is long, but it is ordered: design tokens
and component styles at the top, page markup in the middle, behaviour at the
bottom. The comments explain *why* a thing is the way it is, which matters
here because several choices look odd until you know what they are avoiding.

## Folder map

```
pages/            the prototype itself
shared/           generated data + small runtime helpers
  influencers-data.js    495 records (GENERATED — see below)
  avatar-manifest.js     which profiles have a local photo (GENERATED)
  post-manifest.js       which profiles have post images (GENERATED)
  influencer-store.js    localStorage overlay: adds/edits/removes/pins
  campaigns-data.js      5 seeded sample campaigns (hand-written, safe to edit)
  campaign-store.js      localStorage overlay, vocabularies (stages, tiers, pick answers,
                         deliverable states), every write, and the activity log those writes leave
  campaign-model.js      pure maths over a campaign: migration, slots and shortfall, the board's
                         groups, nextUp, deliverable counts. No DOM, no storage — this is what the tests hit
  campaign-form.js       the stepped Add / Edit campaign form, shared by both campaign pages; opens inside swing-modal
  send-sheet.js          the "send this list to the client" sheet, shared by the roster and campaign pages
  swing-modal.js         the fold-out card modal (flies out of what you clicked) and the influencer
                         profile view inside it; the campaign page uses it for profiles and batches
  tiers.js               follower brackets (Seeder … Mega) — the one place they are defined
tests/            node:test suites over the shared files (see below)
docs/superpowers/specs/   the approved design specs, newest is the campaign overhaul
collabrium-dls/   the Collabrium design system, vendored. Do not edit.
assets/avatars/   harvested profile photos
assets/posts/     harvested TikTok post images
scripts/          Python data + harvesting tools
```

## The data pipeline

The dataset is **generated**, not hand-edited. The source is an Excel export:

```
~/Desktop/influencers_from_KULT.xlsx     ← NOT in this package, ask Ryan
```

```bash
python3 scripts/xlsx-to-data.py          # xlsx  →  shared/influencers-data.js
```

Anything you type into `shared/influencers-data.js` by hand is lost the next
time that runs.

### A quirk worth knowing

The export has `xhsHandle` / `xhsFollowers` / `xhsLink` columns, but **every
one of the 495 rows is empty**. The list view therefore hides any platform
column with no data in the current result set — that is deliberate, not a
bug. If XHS data ever arrives, the column reappears on its own.

## Profile photos

**471 of 495 profiles (95%) have a real photo.** The rest fall back to
initials, which is a designed state, not a failure.

| Script | Status | What it does |
|---|---|---|
| `harvest-tt-avatars.py` | live | TikTok avatars via the public embed widget. Got 409. |
| `harvest-ig-avatars.py` | live | Instagram avatars via the web profile API. Got 62. |
| `audit-avatars.py` | live | Rebuilds the manifest from disk **and** audits it. |
| `harvest-posts.py` | live | TikTok post images (used by the older v1 banners). |
| `harvest-avatars.py` | **retired** | Old Instagram og:image scraper. Do not use — see below. |

All are re-runnable and skip files already on disk.

### Finishing the last 24

They failed to **rate limiting**, not to missing accounts — a direct probe
returned HTTP 401 "please wait", not "not found". Re-running should close
most of them:

```bash
python3 scripts/harvest-ig-avatars.py --only-missing
python3 scripts/audit-avatars.py          # rebuild the manifest afterwards
```

Instagram throttles after roughly 60–70 requests, so expect to run it a few
times with gaps in between rather than once.

### Why `harvest-avatars.py` is retired

Scraping `og:image` off an Instagram profile page looks like it works and
then quietly ruins the dataset: Instagram serves the real image for the first
handful of requests, then hands back **its own logo** for every subsequent
handle while still returning HTTP 200. An early run produced 484 files that
were all the same graphic. Nothing in the response tells you this happened.

Because of that, every harvest script md5-hashes what it downloads and
deletes any image whose hash repeats more than three times, and
`audit-avatars.py` re-checks the whole folder on every run. **If you write a
new image source, keep that check.**

## State and storage

Roster edits are not persisted to a server. `influencer-store.js` layers
additions, edits, removals and pins over the read-only dataset in
`localStorage`.

v2 uses **its own storage keys**, so edits made in v2 do not show up in v1
and vice versa. To wipe everything back to the generated dataset, run
`influencerStore.reset()` in the console.

Multi-select is deliberately **not** persisted — it is a working set for the
action you are about to take, held in a plain `Set` called `selected`.
*Create selection list* opens the send sheet: the selection becomes a batch
on an existing campaign or a new lead, and you land on that campaign's
Selection tab with the batch open. Campaign edits, rosters, batches,
deliverables and the activity log live in `localStorage` under
`collab-campaigns-v1`; run `campaignStore.reset()` in the console to go back
to the seeded five.

The seed is read-only and every page reads it through `campaignStore`, which
migrates old shapes on the way out (creator-level roster entries become one
per channel; a `{done, total}` deliverables pair keeps feeding the ring until
the first real deliverable is added). The one wrinkle: migration needs the
influencer map, which the campaigns *list* does not load, so legacy rosters
pass through it unmigrated and the list falls back to Pax where it would
otherwise show slots.

**Brand logos.** `shared/shell.js` resolves a logo from the brand name: a
curated map of Malaysian brands first, then, when a key is present, an
Exa search for the brand's official site, then favicon guesses. The key
lives in `shared/keys.local.js` (gitignored) as `COLLAB_KEYS.exa`; copy
`shared/keys.example.js` to create it. Without it the curated map and the
guesses still work, and the console shows one harmless 404 for the file.
Resolved domains and winning logo URLs are cached in `localStorage`.

**Cache-busting is manual.** Every shared script is loaded with `?v=N`; when
you change one, bump its number on every page that loads it, or the browser
keeps the old file and you will chase a bug that is not there.

## Tests

```bash
node --test "tests/**/*.test.mjs"
```

They load the shared files into a small sandbox (`tests/helpers/load.mjs`)
so they run without a browser. Anything that decides what a number means —
tiers, slots, shortfall, nextUp, what the store logs — has a test; the
pages themselves are verified by hand in the browser.

## Things that look wrong but are not

- **The scrollbar is hidden.** It is an overlay scrollbar with zero layout
  width, so it painted straight over the A–Z rail. The rail reports position
  better than a bar does, so the bar went.
- **The table header un-rounds when it pins.** Rounded corners against rows
  sliding underneath leave two notches of background showing.
- **The detail modal folds into the row's avatar, not the row.** A row is
  ~1270×68 and the panel ~480×640, so flying out of the row itself meant
  scaling 2.65× wide and 0.1× tall — it read as a glitch.
- **Sections use `content-visibility`.** This makes 495 rows cheap to
  re-render, but heights above the viewport are estimates, which is why the
  A–Z rail re-measures as it glides instead of aiming once.

## Not done yet

- 24 profiles still without a photo (rate-limited, re-runnable — see above).
- The campaign Documents tab is a placeholder that reads the roster; CoE/ADSIS
  generation is a later build.
- The client's page (`share.html`) only takes answers; it does not show
  deliverables or drafts to the client yet.
- `by` on activity entries is the constant *Digital Team* — there are no users
  or permissions in the prototype.
- Nothing is wired to a backend; all edits are local to the browser.
