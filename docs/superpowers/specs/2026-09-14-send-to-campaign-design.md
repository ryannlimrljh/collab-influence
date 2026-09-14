# Send to Campaign — influencer selection, requirement-led

**Date:** 2026-09-14
**Status:** Approved design, ready for implementation plan
**Surfaces:** `pages/campaign.html`, `pages/influencers-v2.html`, a new client-facing share page, `shared/campaign-store.js`

---

## The problem

An agency sends a client a list of influencers and asks them to pick a specific
number, broken down by channel (TikTok / Instagram / XHS) and by tier (Seeder,
KOC, Nano, Micro, Mid, Macro, Mega). Today that ask is entered but never
travels: the client never sees it, nothing counts against it, and the result is
reconciled by hand.

### What production does now

```
Influencers → tick N creators → "Add new list"
  → modal: Details / Platforms quota / General access → "Create Link"
      → /share/<token>   client answers Approve · KIV · Reject per card
          → Campaign ▸ Influencer Selection ▸ Campaign picks ▸ BATCH 1
              → ???  → "Selected influencers" (0)
```

### Seven concrete faults

1. **The quota is invisible to the client.** `paxTargets` is captured in the
   create modal and rendered again for the agency in `paxHtml()`, but the
   `/share/` page contains no trace of it. The client cannot select "a specific
   number" because they are never told a number. This is the root complaint.

2. **The quota unit contradicts the decision unit.** The share page states:
   *"Some of these creators work on more than one platform and are listed under
   each. Answering one of their accounts answers all of them."* So the decision
   is per **creator**, while the quota is per **channel × tier**. One creator
   with IG-Mid and TikTok-Macro accounts is counted under both platform
   headings — `Instagram 3 profiles` and `TikTok 3 profiles` for the same three
   people. An ask of "2 IG Mid + 1 TikTok Macro" is not satisfiable in that
   model.

3. **The ask is bounded by the answer.** `paxHtml()` (`campaign.html:845`)
   derives its tier boxes from the creators already in the batch, labelling each
   "N shown". You cannot request more than you happened to select, which inverts
   the real sequence: the brief sets the ask, sourcing tries to meet it.

4. **The quota lives on the batch, not the campaign.** `b.paxTargets` is
   per-batch. The campaign carries `pax` (one integer) and `platforms` (an
   array) which never meet. Batch 2 has no idea what Batch 1 failed to fill.

5. **The campaign is optional on a list.** `Campaign` is an optional dropdown at
   the bottom of the create modal, so "send to campaign" is an afterthought
   rather than the point. There is also no way to create a list for work that
   has not been won yet.

6. **No promotion step is visible.** `Selected influencers` renders `0 on this
   campaign · feeds Documents and Drafts` directly above a batch with five
   responses, and nothing explains the relationship.

7. **Reconciliation is a text field.** The batch Notes placeholder reads
   `e.g. 10 selected + 2 pax KIV, 2 converted from Micro`. Shortfall and tier
   substitution — both computable — are being typed by hand.

Secondary: duplicate `Name` / `List name` fields with the same placeholder;
`Public — anyone with the link can view` means approvals are unattributed and
links never expire; and the tier vocabulary has drifted — production shows
**KOC** but `campaign.html:565` defines only six bands.

---

## Decisions taken

| # | Decision | Choice |
|---|---|---|
| 1 | Unit of selection | **Channel slot.** A deliverable is one post on one channel. One creator may fill two slots. |
| 2 | Enforcement | **Soft target with overage flag.** Never block the client; mark the excess for the agency to arbitrate. |
| 3 | Quota source | **Campaign-owned, inherited by batches**, with a new entry path for work that is not yet a campaign. |
| 4 | Pre-campaign work | **A campaign at stage `lead`**, ahead of `sourcing`, excluded from active counts until won. |
| 5 | Promotion to roster | **Automatic on client approval**, then a **manual availability confirmation** by the agency. Manual is how the team works today and stays. |
| 6 | Client-page grouping | Candidates grouped under the slot they are proposed for, with a "show all" toggle. Provisional — cheap to flip in the prototype. |

---

## Data model

### Campaign gains a requirement

```js
requirement: {
  tiktok:    {mid: 3, macro: 2},
  instagram: {macro: 2},
  xhs:       {micro: 1}
}
```

`pax` becomes derived (the sum of all slots) rather than typed. `platforms` is
derived from the requirement's keys. Both stay on the record for the list view,
recomputed on write.

### Roster entries become channel-level

```js
// was: {inf, source, batch}
{
  inf, platform, tier,
  source: 'client' | 'team',
  batch,
  state: 'approved' | 'confirmed' | 'unavailable',
  substitutedFor: 'mid' | null,
  approvedAt, confirmedAt
}
```

This is the one blocking change. Without `platform` on the roster entry a
creator cannot occupy two slots, and channel × tier quotas stay unsatisfiable.

`state` uses the availability step from decision 5: `approved` is the client's
answer, `confirmed` is the agency's. `unavailable` reopens the slot — giving the
existing-but-unused `unavailable` status an actual job.

### Picks carry status per channel

```js
// was: {inf, kultRemark, status, clientRemark}
{inf, kultRemark, clientRemark, channels: {tiktok: 'selected', instagram: 'none'}}
```

Values stay the current `PICK_STATUS` vocabulary.

### Stage vocabulary

Insert `{key:'lead', label:'Lead', short:'Lead', dot:'var(--color-neutral-4)'}`
at the head of `STAGES`. Dashboard active-campaign counts and the pipeline strip
exclude it.

### Tier vocabulary

Add `KOC` to `TIERS` in `campaign.html` to match production, splitting the
current `Seeder` band (`<1e3`) in two. Observed production values bracket the
boundary: `Seeder` at 2, 18, 22, 30, 112, 222, 340 and 438 followers; `KOC` at
708, 731 and 932. So the split sits between 438 and 708 — almost certainly 500:

```js
{max: 5e2, name: 'Seeder'}, {max: 1e3, name: 'KOC'}, {max: 5e3, name: 'Nano'}, …
```

Confirm the exact figure against the live app before implementing; everything
from `Nano` up is unchanged.

### Migration

Existing records carry creator-level `status` and `{inf, source, batch}` roster
entries. On read:

- a pick's `status` fans out to every channel that creator has a handle on;
- a roster entry expands to one entry per channel the creator was selected for,
  `state: 'confirmed'` (existing rows predate the availability step, so treat
  them as settled), `substitutedFor: null`;
- a campaign with no `requirement` derives an empty one; `pax` is preserved
  as-is until someone edits the ask.

---

## Surface 1 — Campaign ▸ Influencer Selection

The stacked `Selected influencers` + `Campaign picks` blocks collapse into one
board. **The requirement is the layout.** Batches become provenance.

```
8 slots · 5 filled · 2 pending · 1 open                       [Edit ask]
▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░

TikTok · Mid                                             3 of 3  ✓
  ● Aeisya              25.2K   confirmed                 Batch 1 · 8 Sep
  ● akak nyun           34.4K   confirmed                 Batch 1 · 8 Sep
  ● ashayang            32.4K   approved  [Confirm] [Unavailable]   Batch 2

TikTok · Macro                                           1 of 2  ⚠ 1 open
  ● Alanaspinktravels  331.5K   confirmed                 Batch 1
  ○ open — 2 candidates awaiting client                   Batch 2 ▸

Instagram · Macro                                        0 of 2  ⚠ 2 open
  ○ open — nothing sent yet                        [+ Add candidates]
```

- Every fill carries a provenance chip naming its batch and date.
- Overage renders as an extra row badged `+1 over`.
- A fill against a different tier renders `Micro ↑ Mid` in amber — the
  `"2 converted from Micro"` case, computed instead of typed.
- `approved → confirmed` is the manual availability check.
- Sent batches move below, collapsed, keeping today's table but with status per
  channel rather than per creator.

## Surface 2 — "Send to client" sheet

Replaces *Add New Selection List*. One scrolling sheet, sticky footer, four
blocks.

**Destination** — first and required.

```
( ) Existing campaign  [Enfagrow A+ MindPro Phase 5 ▾]
      → still needs: IG Macro ×2, TikTok Macro ×1
(•) New lead           [Name______] [Brand ▾]
      → creates a campaign at stage Lead
```

**The ask** — steppers per platform × tier, pre-filled from the campaign's
remaining shortfall, **not** bounded by the chosen candidates.

**Coverage** — the check that does not exist today.

```
12 candidates → 19 channel accounts
TikTok  Mid    4 / ask 3    ✓ headroom 1
TikTok  Macro  1 / ask 2    ⚠ short 1        [+ add from roster]
IG      Macro  0 / ask 2    ✕ nothing to show
```

Advisory only — it warns, never blocks. It stops lists going out that cannot
mathematically fill the brief.

**Send** — client contact, link expiry, and a "ask for a name before
responding" toggle, retiring `Public · anyone with the link`.

One `Name` field, not two.

## Surface 3 — client share page

A sticky progress contract replaces the invisible quota:

```
Enfagrow A+ MindPro Phase 5 — please pick your line-up
TikTok Mid 2/3 · TikTok Macro 1/2 · IG Macro 0/2            4 of 8 chosen
```

Chips read green when met, amber when exceeded.

One card per creator, one decision row per channel:

```
┌──────────────────────────────────┐
│ (◍)  Abby Suehaiveey Abir        │
│      20-30 · Female · Sabah      │
│      Content Creator · Lifestyle │
│ ──────────────────────────────── │
│  TikTok      214K   Macro        │
│    [Approve] [KIV] [Reject]      │
│  Instagram  26.9K   Mid          │
│    [Approve] [KIV] [Reject]      │
│ ──────────────────────────────── │
│  Why we suggest her: …           │
│  [comment]                       │
└──────────────────────────────────┘
```

- Platform tabs become **filters**; each creator appears exactly once.
- The line *"Answering one of their accounts answers all of them"* is deleted —
  it existed to paper over the duplication this removes.
- `kultRemark` surfaces to the client. The field is already labelled "Why you
  suggest them", which only makes sense if the client reads it.

## Surface 4 — the shortfall loop

An open slot offers `[+ Send batch 2]`, pre-filled with the remaining ask and
candidates filtered to that platform × tier. The batch Notes field stops being
load-bearing and returns to being a note.

---

## Delivery order

The data work is shared, so the board can land after the plumbing rather than
alongside it.

1. **Model + migration** — `requirement`, channel-level roster, per-channel pick
   status, `lead` stage, `KOC` tier. No UI change; existing screens keep working
   off the migrated shapes.
2. **Client share page** — per-channel cards and the progress contract. This is
   the change the client feels, and it is independently useful.
3. **Send-to-client sheet** — destination-first, inherited ask, coverage check.
4. **Slot board** — Surface 1, replacing the two stacked lists.
5. **Shortfall loop** — batch 2 pre-fill and substitution flagging.

## Out of scope

- Pricing or quotes per slot. The ask is headcount, not budget.
- Client authentication beyond an optional name prompt. Real accounts are a
  separate piece of work.
- Changes to Documents, Deliverables or Drafts, beyond the roster continuing to
  feed them.

## Constraints

- `shared/influencers-data.js` holds real NRIC numbers, home addresses, phone
  numbers and email addresses for 277 records. Any prototype, artifact or
  screenshot that leaves this machine must use synthetic profiles.
- No build step. Plain HTML, CSS and JS, served statically, consistent with the
  rest of the prototype.
- Styling comes from the vendored `collabrium-dls/`, which is not to be edited.

## Open questions

- **KOC boundary** — inferred as 500 from observed production values. Confirm
  the exact figure against the live app; the design does not depend on it.
- **Client-page grouping** — grouped by intended slot vs. one flat list. Default
  is grouped; to be tried both ways in the prototype.
