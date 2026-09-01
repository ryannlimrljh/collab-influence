---
name: collabrium-dls
description: Design Language System reference for Collabrium (Astro Digital Growth OS) — brand colors, typography, spacing, iconography, and component tokens. Use whenever designing, mocking up, or building UI screens, dashboards, marketing pages, decks, or any other visual asset for Collabrium, to stay visually consistent with the brand.
---

# Collabrium DLS

Quick-reference cheat sheet for building Collabrium surfaces. Full token
detail, rationale, and open gaps live in `DESIGN-SYSTEM.md` in this same
folder — read it before building anything beyond a trivial mockup.
Paste-able CSS custom properties are in `tokens.css`; the actual
component CSS (every `.c-btn`/`.c-card`/`.c-badge`/etc. rule) is in
`components.css` — this is the real portable copy,
not `preview.html`'s markup alone. **To use this system in another
project, you need both files plus the Phosphor Icons and Google Fonts
`<link>` tags** — see DESIGN-SYSTEM.md's Technical Implementation
section for the exact snippet and load order; skipping any of them is
why a real integration attempt broke (colors/pills/icons not
rendering). `preview.html` is a browsable brand overview microsite
(writeup, real logo, color palette, typography, fonts, spacing & shape,
guidelines) — open it directly, it links `tokens.css`, `components.css`,
and embeds `logo.html`. `logo.html` is the real,
corrected animated Collabrium wordmark — the canonical *live* asset, embed
it wherever the mark can animate rather than screenshotting it. Its "O"
cycles through a fixed 5-frame sequence — **Gold → Water → Wood → Fire →
Earth**, no decorative extras — with `SVG/coin.svg` as the Gold frame's
artwork (not `gold.svg`, which is a separate icon used elsewhere in this
system).
`logo-lockups/` holds combined, non-animated wordmark lockups for
contexts that can't run the animation (favicons, print, email, static
deck slides) — `collabrium-default-logo.svg` is the **default** mark
whenever no department/element context applies; the other 4 element-colored variants
(Fire, Wood, Water, Earth) don't exist yet. `SVG/`
holds the confirmed true vector source for every letter and element icon
individually — use those files (not a screenshot, not a hand-traced
copy) if you need a piece of the mark on its own. `fonts/` has real,
installable variable-font files for both typefaces (sourced from
Google's official repo, not the web-embed subsets) — point people there
instead of them hunting Google Fonts themselves. `preview.html` also has
a live **Components** section — the 7 basics (Button, Input, Card,
Badge & Tag, Table, Modal, Empty state), 8 more
transcribed from the teammate's real component source (SidebarNav,
Tabs, Checkbox, Radio, Switch, Toast, Tooltip,
ElementBadge), 4 more **designed from scratch** (Stat/KPI
card, Filters, Pagination, Date picker, flagged red in the gallery)
plus a Chart color mapping guideline, 3 more folded into Button/Input
field (Button's Icon-only variant, plus Input field's
Textarea/Password field siblings), and
**App Shell**, the page-level composition layer
(Sidebar placement, Content region, Page header — no separate Top bar,
Page header is the shell's only top-of-screen chrome) covering how
everything else actually gets framed into a real screen. Each has
copy-able markup. Use it as the reference implementation when building
real screens, not just the spec tables. The Stat/KPI card batch and App Shell
have no source in either the brand deck or the teammate's build, so
treat them as more provisional than everything transcribed above them —
a first design pass, not yet reviewed.

**Standing rule:** any change to this skill's files (preview.html,
logo.html, logo-lockups/, tokens.css, components.css, SVG/, fonts/, new
components) must be reflected back into `DESIGN-SYSTEM.md` in the same
pass, not as a follow-up: update the relevant spec section to describe
the **current state only**, and add a dated entry to `DESIGN-SYSTEM.md`'s
Changelog section describing what changed and why. Don't inline version
numbers, dates, or "added/changed/corrected on [date]" language into a
spec section itself — that information belongs in the Changelog, not
scattered through the spec (see the Changelog's own note on this). A new
or changed component needs the matching edit in **both**
`preview.html` (live demo) **and** `components.css` (the portable
copy) — they must never diverge from each other any more than either
may diverge from `DESIGN-SYSTEM.md`.

**Standing rule — component ordering in preview.html:** the sidebar
nav's Components child list and the `.comp-block` demo sections in
`<section id="components">` must both stay sorted alphabetically by
component name, in lockstep with each other. When adding a new
component (or splitting an existing demo into standalone pieces, e.g.
Checkbox/Radio/Switch each getting their own block), insert its nav
button and its `.comp-block` at the alphabetically correct position in
both lists — never append to the end — and make sure the nav button's
`data-nav-target` matches the block's `id`. Both lists carry an inline
`RULE:` HTML comment at their start restating this.

**Standing rule — component ordering in DESIGN-SYSTEM.md:** the same
alphabetical-by-name ordering applies to the Components section's `###`
subsections and its own table-of-contents list right above them —
insert a new component's `###` heading and its ToC entry at the
alphabetically correct position, never appended to the end, so the doc
stays in lockstep with preview.html's nav/demo order.

**Reference point:** `~/Desktop/Collabrium Design System/` is a second,
independently built Collabrium system from the same source deck, with
production React components, an app UI kit, and deck templates this
skill doesn't have. The token values here were reconciled
against it — see DESIGN-SYSTEM.md's Reconciliation section for exactly
what changed and why before treating either system as more current.

## Brand in one line

Warm, collaborative, quietly confident. Talks like a colleague, not a
control panel. Voice favors human verbs (see, share, meet in the middle)
over mechanical ones (sync, deploy, restore).

## Core tokens (cheat sheet)

- **Primary font — Mulish:** all UI text — body, buttons, nav, tables,
  labels, captions — **and every heading**, weight 800, letter-spacing 0.
- **Secondary font — Source Serif 4:** *not* a heading token. A deliberate
  overlay for brand-statement moments only (deck ledes, pull quotes, hero
  numerals), never below ~18–20px, never mixed mid-sentence.
- **Icons — Phosphor** primary, **Remix** fallback when Phosphor lacks the
  icon, in **two weights by tier, not taste**: Regular for functional/control
  icons (buttons, toolbars, chevrons, sort/filter), Fill for expressive/status
  icons (nav, status indicators, card headers, empty states). Never mix
  Phosphor with Remix within the same component instance. Icons inherit
  surrounding text color; don't hardcode elemental colors outside a
  department-specific surface.
- **Primary action color:** Obsidian `#2B2B2C` — all main CTA buttons.
- **Neutrals:** `#080808` (primary text) → `#ffffff` (canvas), full 9-step
  ramp in DESIGN-SYSTEM.md. Plus **warm canvas** (`#FCFAF5`/`#FAF7F2`) —
  **the default page background everywhere**,
  product UI included, not just brand/editorial. Component fills (cards,
  inputs, sidebar) keep their own documented values, mostly `Neutral-1`
  white, which now reads as a deliberate figure-ground contrast against
  the warmer canvas.
- **Brand accents (all confirmed canonical):** Orange `#FF5825`, Salmon
  Pink `#FF7A90`, Green `#00C26E`, Navy Blue `#1473E6`, Amber `#FFA425`.
  Each has an 8%/16% background-tint pair (`-bg`/`-bg-strong`) — the only
  permitted colored backgrounds, and only for the element that owns the
  content.
- **5-element system:** each brand color maps to an element and a
  department cluster (Fire/Orange = Marketing·PR·Sales, Wood/Salmon Pink =
  Strategy·R&D·Product, Earth/Green = HR·CS·Admin, Water/Navy =
  Data·Logistics, Gold/Amber = Finance·Legal·Compliance). Use this mapping
  when color-coding anything department-specific.
- **Radius is soft and per-surface:** 12px inputs/small buttons, 16px
  standard buttons, 20px cards/modals/nav, pill for badges/tags/avatars.
  Never below 12px on an interactive surface.
- **Elevation is real, not "flat by default":** cards carry `shadow-1` at
  rest. Every shadow is Neutral-4-based (soft grey), never black.
- **Motion settles, never bounces:** one easing curve per element
  (`--ease-flow` for Water, `--ease-flare` for Fire, etc.), `--ease-standard`
  otherwise. Durations 80–900ms.

## Before you build

1. Check the **Needs Input** list at the top of `DESIGN-SYSTEM.md`. Most
   token gaps (type scale, spacing, radius) are now resolved and sourced,
   not guessed — what's left (accessibility targets, a clear-space rule,
   minimum size, monochrome/reverse versions, and 4 of 5 department logo
   lockups) still needs a placeholder flagged in your output.
2. Keep Source Serif 4 out of anything dense or functional — body copy,
   forms, tables, dense numeric columns always stay in Mulish.
3. Don't invent new brand colors, background tints, shadows, or easing
   curves — pull from DESIGN-SYSTEM.md's token tables.
4. For the logo: use `logo.html` (embed it live, e.g. via iframe) wherever
   the mark can animate. Where it can't, use a static lockup from
   `logo-lockups/` instead of a screenshot —
   `collabrium-default-logo.svg` by default, or the matching element's
   variant if the surface is already
   department-specific (see DESIGN-SYSTEM.md's Logo section for the
   full rule). Never extract a still frame from `logo.html` as a
   substitute lockup.

## Version

Drafted from the Collabrium brand deck (Google Slides); token values
reconciled against a teammate's independent build of the same deck.
Full version history lives in `DESIGN-SYSTEM.md`'s Changelog section —
also browsable as its own page in `preview.html` via the Changelog
button next to the version flag in the top bar.
