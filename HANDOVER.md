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
| `pages/campaigns.html` | **Campaigns list** — pipeline track, board view (drag a card between columns to change its stage) and table view, Add campaign sheet. |
| `pages/campaign.html?id=…` | **Campaign detail** — stage track, run-date timeline, Overview and KOL Selection tabs; Documents and Drafts are designed placeholders for the next build. |

Campaign records carry a `color` field from the live app's form. Nothing renders it any more (the card stripe and title bar were removed as noise); it is kept in the data so it can come back if the team gives it a meaning.
| `pages/influencers.html` | The earlier roster version, kept for comparison. Not maintained. |

Open **http://localhost:8796/pages/campaigns.html** for the campaigns surface.

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
  campaign-store.js      localStorage overlay + stage/status vocabularies + shared formatting
  campaign-form.js       the Add / Edit campaign sheet, shared by both campaign pages
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
"Generate Client Preview" opens **Send to campaign**: the selection becomes a
preview batch on an existing campaign (or a new one via
`campaigns.html?new=1&picks=…`) and you land on that campaign's KOL Selection
tab. Campaign edits, rosters and batches live in `localStorage` under
`collab-campaigns-v1`; run `campaignStore.reset()` in the console to go back
to the seeded five.

The batch's "Open link" copies a placeholder URL. The client-facing preview
page itself is still to come, and the toast says so.

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
- The client-facing preview page (what "Open link" would open) does not exist yet.
- Campaign Documents and Drafts tabs are placeholders: the roster shows, CoE/ADSIS
  generation and deliverable tracking are the next build.
- Nothing is wired to a backend; all edits are local to the browser.
