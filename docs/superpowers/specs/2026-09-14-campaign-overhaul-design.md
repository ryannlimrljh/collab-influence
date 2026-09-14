# Campaign overhaul — list, creation and detail, built around the two routes

**Date:** 2026-09-14
**Status:** Approved design, ready for implementation plan
**Branch:** `campaign-overhaul`, off `send-to-campaign`
**Surfaces:** `pages/campaigns.html`, `pages/campaign.html`, `shared/campaign-form.js`, `shared/campaign-store.js`, `shared/campaign-model.js`
**Builds on:** `2026-09-14-send-to-campaign-design.md` — phases 1–3 of that spec are built; this spec absorbs its phases 4 and 5.

---

## Who and what

Two users, two routes, one object.

| User | Where they are | What they do |
|---|---|---|
| **Influencer manager** (internal) | The workspace: Campaigns, Influencers | Runs a campaign end to end: pitch, source, get client sign-off, draft, post, report, get paid. |
| **Client** (external) | `share.html`, one link per batch | Answers one question: which of these creators, on which channel. |

**Route 1 — from the campaign.** Campaigns → *Add new campaign* → tag it a **lead** if not yet won → the campaign page → everything about that campaign lives there: the ask, the selection sent to the client and their answers, stage changes, details, documents, deliverables from approved creators, and the notes and history of the work.

**Route 2 — from the roster.** Influencers → tick creators → *Create Selection List* → the send sheet asks where it goes (an existing campaign, or a new lead) → the list goes to the client → the answers land on that campaign's page.

Route 2 is built. The two routes meet on the campaign page, which is where this overhaul does most of its work.

### What is wrong today

1. **Creating a campaign is an 18-field form** with no order of importance. Name sits next to Overseer %. A lead has to be chosen from a Stage dropdown at the bottom, and the form still asks for a quote.
2. **The ask is not on the form.** `requirement` exists in the model and drives the client page and the send sheet, but the only way to set it is through the sheet. Pax is still a typed number.
3. **The campaign page does not say what to do next.** A manager lands on a lead, a sourcing campaign and a posting campaign and sees the same header and the same tabs.
4. **Selection is two stacked lists** that do not know about slots, while the client page and the sheet do. The spec's slot board (its Surface 1) was never built.
5. **Lead is a seventh column** on a board that was already scrolling, and a seventh node on a track that is meant to read as a flow.
6. **Nothing records what happened.** Stage moves, batches sent and client answers leave no trace, and there is nowhere to write a note.
7. **Drafts is a placeholder** with no shape a deliverable could grow into.

---

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Lead on the list | A **ghost node** at the head of the pipeline and a **ghost column** at the head of the board: dashed, labelled *not yet won*, excluded from active counts. Not a seventh stage of the flow. |
| 2 | Creation | **Three steps, progressive disclosure.** Basics → The ask → Commercials. A lead is a switch on step 1, not a stage to find. |
| 3 | The ask on the form | Steppers per platform × tier. **Pax and platforms are derived**, never typed. |
| 4 | What to do next | A **Next up** strip under the header: one primary action per stage, computed from the campaign's state. |
| 5 | Tabs | **Overview · Selection · Deliverables · Documents · Activity.** Selection is the slot board. Drafts becomes Deliverables. Activity is new. |
| 6 | Selection unit | **Channel slot**, as the send-to-campaign spec decided. Batches are provenance. |
| 7 | History | An **activity log** on the record, written by the store on every meaningful write, plus manual notes in the same stream. |
| 8 | Client page | Unchanged. |

---

## Data model

### Additions to a campaign record

```js
activity: [
  // newest last; the page renders newest first
  {at: '2026-09-14T09:12:00Z', by: 'Digital Team', type: 'stage',  text: 'Moved to Sourcing'},
  {at, by, type: 'batch',   text: 'Sent batch 2 to client', ref: {batch: 2}},
  {at, by, type: 'answer',  text: 'Client approved Abby Suehaiveey Abir on TikTok', ref: {batch: 1, inf, platform}},
  {at, by, type: 'roster',  text: 'Confirmed ashayang on TikTok'},
  {at, by, type: 'edit',    text: 'Changed the ask'},
  {at, by, type: 'note',    text: 'Client wants a Malay-speaking Mid for the second reel.'}
]
```

`by` is the workspace user (`Digital Team` in the prototype). The store appends to `activity` inside `update`, `addBatch`, `setChannelStatus`, `setRosterState` and `setRequirement`. Notes come in through `addNote(id, text)`. Nothing else writes to it.

### Deliverables become a list

```js
// was: deliverables: {done: 1, total: 8}
deliverables: [
  {id: 'd1', inf: 'inf-195', platform: 'instagram', kind: 'reel',
   dueAt: '2026-09-16', link: '', caption: '',
   status: 'not_started' | 'drafted' | 'review' | 'approved' | 'posted',
   clientApproval: 'pending' | 'approved' | 'changes',
   internalNote: '', clientNote: ''}
]
```

The header ring reads `posted / total`. On read, a record that still holds `{done, total}` keeps rendering the ring from those two numbers until someone adds a deliverable; then the list is the truth. Kinds per platform: TikTok `video`; Instagram `reel`, `post`, `story`; Xiaohongshu `note`.

### Nothing else changes

`requirement`, channel-level `roster`, per-channel `picks`, the `lead` stage and the `KOC` tier are all already in place from the previous spec.

---

## Surface 1 — Campaigns list

Layout is the existing page: pipeline, search and chips, board or table.

**Pipeline.** Six live nodes stay as the track. Lead sits ahead of the track as a ghost: dashed 1px edge, no shadow, the count in neutral-5, and a caption *not yet won* under the label. It is still a filter. Completed stays in the track, since a campaign flows into it.

**Board.** The Lead column takes the same ghost treatment: dashed column edge, lighter head. Dragging a lead into Sourcing is how a lead is won by hand; the Next-up strip on the page is the other way. Dragging a live campaign back into Lead is refused with a toast, since a campaign cannot be un-won.

**Cards.** A lead card carries a `Lead` badge beside its name. A card whose campaign has a requirement replaces the Pax stat with **Slots** reading `2 of 5 filled`, and its cue line prefers the ask over the calendar while the campaign is in Sourcing: `3 open slots`, or `Awaiting client` when a batch is out with no answers yet. Other stages keep the run-date cues.

**Table.** Gains a `Lead` badge in the Campaign cell and reads Pax from the derived value. No other change.

---

## Surface 2 — Creating and editing a campaign

`shared/campaign-form.js` is rewritten as a stepped sheet with the same `open({rec, draft, onSave})` contract, so the list and the detail page do not change how they call it.

```
NEW CAMPAIGN                                                  step 1 of 3
Basics ─────────── The ask ─────────── Commercials

  Campaign name *      [Raya 2026 Influencer Push          ]
  Brand                [Nestlé MY     ]   Agency  [Wavemaker    ]
  PIC                  [Izuan I.    ▾]   Type    [x] Influencers [ ] Seeders [ ] KOC
  Start                [16 Sep 2026  ]   End     [29 Sep 2026  ]

  (●) This is a lead — not won yet
      It sits ahead of the pipeline and stays out of active counts.

                                       [Cancel]            [Next: the ask →]
```

**Step 1 — Basics.** Name (required), brand, agency, PIC, type, start and end, description. The **lead switch**. Turning it on sets `stage: 'lead'` and hides step 3; turning it off on an existing lead is how it is marked won from the form (stage becomes `sourcing`).

**Step 2 — The ask.** One row per platform the manager turns on, with a stepper per tier. The seven tiers from `tiers.js`, in order. Pax and the platform list are shown as derived totals at the foot: *5 slots across 2 channels*. The step can be skipped; a campaign with no ask is allowed and the card says so.

**Step 3 — Commercials.** IO, stage (live stages only), quote, cost, PIC %, overseer and overseer %, remarks. Hidden for leads. Collapsed into a single *Skip for now* affordance for anyone who does not have numbers yet.

Steps are a DLS stepper across the top. The footer's primary button reads *Next: …* until the last step, then *Create campaign* or *Save changes*. Back never loses what was typed. Validation happens on the step it belongs to; a step with an error shows the DLS error state on its indicator.

Editing opens on step 1 with every step filled. Changing the ask on an existing campaign logs `edit: Changed the ask` and does not touch batches already sent, since each batch carries the ask it went out against.

---

## Surface 3 — Campaign page

### Header

Unchanged in shape: back, title, stage badge, IO, actions, the stage track, facts, timeline, ring. Two changes:

- The stage track shows Lead as the same ghost node as the list. Clicking a later stage from Lead marks it won.
- The **Next up** strip sits between the track and the facts.

```
NEXT UP   3 open slots and 2 approvals to confirm.    [Confirm availability (2)]  [Send batch 2]
```

One sentence of state, one primary action, at most one secondary. Computed:

| Stage | State | Sentence | Primary | Secondary |
|---|---|---|---|---|
| lead | no batch yet | Nothing sent to the client yet. | Send selection list | Mark as won |
| lead | batch out | Waiting on the client · sent 10 Sep. | Open client view | Mark as won |
| sourcing | approvals awaiting confirmation | *n* approvals to confirm. | Confirm availability (*n*) | Send batch *k* |
| sourcing | open slots, nothing pending | *n* open slots. | Send batch *k* | — |
| sourcing | all slots filled and confirmed | Line-up complete. | Move to Drafting | — |
| drafting | fewer deliverables than confirmed creators | *n* creators have no deliverables yet. | Add deliverables | Move to Posting |
| drafting | all planned | *n* deliverables planned. | Move to Posting | — |
| posting | posts outstanding | *n* of *m* posted. | Track deliverables | Move to Reporting |
| reporting, payment | — | In *stage*. | Move to *next* | — |
| completed | — | Wrapped *date*. | — | — |

*Send selection list* and *Send batch k* open the shared send sheet with this campaign as the destination. *Add deliverables* and *Track deliverables* switch to the Deliverables tab. *Confirm availability* switches to Selection with the pending fills highlighted.

### Tabs

`Overview · Selection · Deliverables · Documents · Activity`. The URL keeps `?tab=`; the old `kol` and `drafts` keys still resolve to Selection and Deliverables.

### Overview

The existing card, plus a first row, **The ask**: one chip per slot reading `TikTok · Mid  2 / 3`, green when met, amber when over, neutral when open, and an *Edit ask* link that opens the form on step 2. Financials, Roster, Ownership and Revenue split are unchanged. Roster's *Booked* now counts confirmed channel fills.

### Selection — the slot board

The two stacked lists collapse into one board. **The requirement is the layout; batches are provenance.** This is Surface 1 and Surface 4 of the send-to-campaign spec, built as written there, with these additions decided here:

- A **summary line and bar** at the top: `8 slots · 5 filled · 2 pending · 1 open`, the bar segmented confirmed / approved / open in green, amber, neutral-3.
- Each **slot group** is a card headed `TikTok · Mid   3 of 3 ✓` or `1 of 2 · 1 open`. Fills list the creator, follower count, state badge, and a provenance chip `Batch 1 · 8 Sep`. An `approved` fill carries `[Confirm] [Unavailable]`. A fill against a different tier reads `Micro ↑ Mid` in amber. Overage rows carry `+1 over`.
- An open slot offers **Send batch k**, which opens the send sheet pre-filled with the remaining ask and the candidate list filtered to that platform × tier, and **Add by hand**, which opens the roster picker filtered the same way and adds the fill as `confirmed`.
- **Sent batches** sit below, collapsed by default: the existing batch table with status per channel rather than per creator, the answer bar, the client link and client view. The pax-per-tier boxes on a batch are removed, since the ask is on the campaign now and the batch shows the ask it was sent with.
- A campaign with no requirement shows one card: *No ask yet — set what you need from the client* with *Set the ask* opening the form on step 2, and the sent batches beneath if any.

### Deliverables

One section per confirmed creator on the roster, headed by name, avatar and channel badges, with a table of that creator's deliverables: kind, due date, link and caption, status (a badge menu across the five states), client approval (a badge menu), internal note, client note. *Add deliverable* per creator, defaulting to the channel they are confirmed for. A creator with nothing planned shows an inline empty row with the add button. The header ring and the Next-up strip read from this list. Nobody confirmed yet shows the existing empty state pointing at Selection.

### Documents

Unchanged this round. It continues to read the roster.

### Activity

A single stream, newest first. Each entry: a small icon per type, the text, and *by · relative time*. A composer at the top, *Add a note*, appends a `note` entry. Auto entries are neutral; notes carry a pale earth tint so a person's words stand apart from the machine's. A filter row of chips: All, Notes, Client, Stage.

---

## Shared pieces

| Piece | File | Used by |
|---|---|---|
| Stepped campaign form | `shared/campaign-form.js` (rewritten) | list, campaign page |
| Send sheet | `shared/send-sheet.js` (exists) | roster page, campaign page |
| Slot maths | `shared/campaign-model.js` (exists, add `nextUp(c)` and `deliverableCounts(c)`) | list card cue, campaign page |
| Activity writes | `shared/campaign-store.js` | every page that writes |
| Stage track, ghost lead node | page-local CSS, same recipe on both pages | list, campaign page |

---

## Delivery

Each phase is verified in the browser before the next starts, and committed on its own.

1. **Form and list.** Stepped form with the lead switch and the ask step; ghost lead on pipeline and board; card badge, slots stat and ask cues; store derives pax and platforms on save; activity log written by the store (no UI yet).
2. **Campaign page frame.** Next-up strip and `nextUp(c)`; tabs renamed and rerouted; Overview's ask row; ghost lead on the track; marking a lead won.
3. **Selection board.** The slot board, confirm and unavailable, substitution and overage, Send batch k pre-fill, Add by hand, sent batches collapsed. Retires the roster picker's batch mode and the per-batch pax boxes.
4. **Activity.** The stream, the composer, filters, and the auto entries surfacing.
5. **Deliverables.** The list shape, per-creator sections, status and approval menus, the ring and Next up reading from it.

## Out of scope

- Any change to `share.html` beyond reading the same data.
- Real users, permissions or authentication. `by` is a constant.
- Pricing per slot or per deliverable.
- Documents beyond the roster feeding it.
- The Influencers page, beyond what the send sheet already does there.

## Constraints

- `shared/influencers-data.js` holds real personal data. Nothing that leaves this machine may carry it.
- No build step, no dependencies. Plain HTML, CSS and JS served statically.
- Styling comes from the vendored `collabrium-dls/`, which is not edited. Page-local CSS composes its tokens only.
- Bump the `?v=` of every shared file touched, on every page that loads it. The pages cache hard.
- Pure logic lives in `shared/campaign-model.js` and is covered by `node --test "tests/**/*.test.mjs"`.
