# The score panel — five bands, five tabs

> **Status: BUILT 2026-08-15**, same day as proposed — except two halves that belong to
> other items: the JSON gutter / three inks / selection scoping (all read
> `buildJsonView`, so they ride [core-json-view.md](core-json-view.md)) and compare's
> live render + overlay. The tab retirement went through its sequence intact: the
> popover was rehomed to a page-level overlay first, the palette's four-of-nine gap
> closed from one shared table, then `actions` was deleted with `tsc` catching every
> stale branch. Two design cells were **refused as drawn** because the corpus does not
> hold the fact they ask for — EDITED (no backend, no mtime → APPROVED from real
> provenance) and KEY-as-a-name (MNX stores `fifths` and no mode, so "G major" was
> literally wrong on the first document it rendered → the signature, `1♯`). Verified
> hands-on over CDP across all five tabs, a live two-op queue with a redo branch, and a
> keyboard-opened popover. Goldens byte-identical; 625 tests green.
>
> **Status: proposed 2026-08-15.** Item 5 of
> [core-campaign-modernist.md](core-campaign-modernist.md) — the campaign's structure half and
> its showcase. Blocks on [core-modernist-tokens.md](core-modernist-tokens.md); the JSON tab's
> below-the-boundary half is [core-json-view.md](core-json-view.md).
>
> `workbench-` because `src/workbench/ScenarioPage.ts` is a **leaf** — nothing imports it
> and nothing will; this is not promotion-track work. (The campaign's contract items are
> `core-` because they live in `src/elements/`.)

## The problem

The side panel was created in a same-day consolidation recorded in
[core-score-hud.md](../inprogress/core-score-hud.md): all page chrome swept into one tabbed
right rail so the head could shrink to the score-view tabs. It worked, and it accreted.
The panel now has **seven** tabs — `description | tags | actions | ops | hud | compare |
json` — which is two more than the consolidation designed (`ops` arrived later with the
element-ops exemplar) and one more than CLAUDE.md documents. At the default 320px they
wrap onto two rows.

More to the point, the seven are not one idea. Two of them (`description`, `tags`) are
the same idea split; one (`actions`) is a command surface that the selection tray was
built to replace; and the four that remain have no shared frame — each renderer decides
its own padding, its own header, whether it scrolls.

The design supplies both halves of the fix: a frame, and a tab set.

## The design

`Score Panel.dc.html`, from the same Claude Design project as the tray, drawn
deliberately *"in the tray's own language"*. Its own summary of the tab change: **seven
become five** — `description · ops · hud · compare · json`, framed as *authored,
changed, current, expected, raw*. As with the tray, the file is not in this repo; its
rulings are transcribed here.

### The five-band frame

Every tab is the same five bands, and this is the mock's best idea:

1. a 2px ink border around the panel
2. the **tab strip** — flush left, 10px/600 uppercase letterspaced, active tab in the
   accent with a 2px inset underline
3. a **context bar** naming what you are looking at (`--bg-context` ground, 2px rule
   under it)
4. **exactly one scrolling body**
5. a 2px-topped **footer** holding search or status

Cheap to build — `.panel` is already a flex column and `.panel-body` is already the
single scroller — and worth building as *structure* rather than as per-tab discipline. A
`panelFrame(tab, {context, body, footer})` helper makes "only the body scrolls" a
property of the panel instead of a convention each renderer has to remember.

The context bar is the part that earns its place. Four of the five tabs currently open
with some improvised header inside the scroll area, which means the answer to "what am I
looking at" scrolls away. Pinning it is the difference between a panel and a stack of
pages.

### The tab set

- **`tags` folds into `description`** as a ruled second half, regrouped into three named
  groups — **STATUS**, **BUILD**, **SCHEMA COVERAGE** — because, in the design's words,
  *"a flat cloud of fourteen hides the two that matter"*. Hash tags print the key in ink
  and the hash in grey; `verified` is the only filled tag in the panel. Description also
  gains a copyable id line and a small stat strip.
- **`actions` retires.** Scope-specific commands belong to the selection tray at `/`;
  document-level ones to the global palette at Ctrl+Shift+K. *"If a document-level action
  has no home, it goes in a menu on the panel header, not a tab."* (The mock and the
  tray docs both say Ctrl+K — the tray was **rebound to `/` on 2026-08-15**, after those
  were written. Read every "Ctrl+K" in the design as "the tray key".)
- **`ops`** becomes the undo ladder proper: op name in mono, plain-English consequence
  beneath it, shortcut flush right, head row current-styled, rows past head at 45% as
  the redo branch.
- **`hud`** keeps the ladder as the panel's spine and gains a "keys at this level"
  second half that is *reference only*, with a dark footer handing editing back to
  `/`.
- **`compare`** stacks the spec engraving over our render of the same bars.
- **`json`** gains a gutter, three inks, and a selection/whole-score scope toggle.

### One rule, worth adopting verbatim

> **The tray edits, the HUD explains.**

The HUD's keys half is reference and never clickable; its footer points at the tray key (`/`). The
single exception is the part rung, where string set and capo are per-part overrides with
*values* rather than toggles, so they stay live controls in the HUD and are absent from
the tray. Selection state is shared: clicking a ladder rung moves the selection, and the
tray re-anchors and re-scopes to match.

This is a better statement of a boundary the repo already drew.
[core-score-hud.md](../inprogress/core-score-hud.md)'s "two kinds of edit, one visible
boundary" says the same thing in terms of mechanism — *content* edits flow through
intents and ops and dirty the session; *presentation* edits (strings, capo) flow to
viewer props and leave the document untouched. The mock's sentence is the user-facing
half of that. Adopt both.

## The PART rung: a conflict that turns out to be vocabulary

The mock draws PART as a rung of the ladder with inline controls. `core-score-hud.md`
says **"part is deliberately not a rung."** These read as a direct contradiction and are
not one.

`hudRows.ts:30-38` (`LEVEL_BY_ROW`) already emits a `part` row mapped to the
`partMeasure` level, and `core-score-hud.md`'s own mapping table lists it. The controls
the mock draws already exist, in `ScoreHud.partLine()`. What the HUD doc means by "not a
rung" is a statement about `SELECTION_LADDER` in `src/edit/selection.ts` — the *vertical
containment axis* that Escape and Enter walk — which the mock never proposes changing.
The HUD's own module header draws the distinction: **rows are the address chain, the
highlight is the rung.**

So: **no decision to reverse, and no code conflict.** The mock's "PART rung" is the
HUD's existing part row, and the deltas are cosmetic (a 62px rung-label column against
today's 58px, and the shared row-state classes). Both docs should normalize to one
vocabulary so the next reader doesn't have to rediscover this.

One real consequence does fall out, and it should be made explicitly rather than left
implicit: **`core-score-hud.md`'s stage 4 — rung property edits through ops — is cut,
not parked, and redirected to the tray.** The mock's rule that the keys half is reference
and never clickable is incompatible with the HUD growing content edits. Adopting the
mock means the HUD is permanently a *read* surface plus the one presentation exception.
That closes a parked stage with a reason instead of leaving it open forever, and it
makes the HUD doc completable.

## Sequencing: never remove a working surface before its replacement exists

The `actions` retirement is the only ordering hazard in the campaign, because that tab
currently *hosts* the nine setup popovers — the real working surface for clef, key,
time, tuning, part, bar, adornment, lyric and rhythm. Deleting the tab naively deletes
where they render.

It is cheaper than it looks, though: `WorkbenchApp.commandItems()` already duplicates
undo, redo, copy trace and revert, plus four of the nine popovers. **The blocker is where
the popover renders, not what invokes it.**

- **A. Rehome the popover.** `openPopover()` (`ScenarioPage.ts:981`) force-switches
  `panelTab = 'actions'` so a keyboard-opened popover is visible, and the `.popover`
  block renders inside `panelActions()`. Move it to a page-level overlay inside `.main`
  (already `position: relative` for the tray) and drop the tab switch. **Worth doing on
  its own merits, independent of this campaign** — today a keyboard-opened popover yanks
  the panel away from whatever you were reading.
- **B. Let the tray mechanism land.**
  [core-selection-tray-mechanism.md](../inprogress/core-selection-tray-mechanism.md) is in flight;
  its popover-tier tiles are the replacement for scope-specific commands. Don't
  front-run it.
- **C. Close the palette's gap.** Generate all nine palette entries from the existing
  `POPOVER_ACTIONS` table rather than the hard-coded four (gate `tuning` on
  `entry.hasTab`, as `openPopover()` already does). `WorkbenchApp` and `ScenarioPage` are
  siblings in the same leaf, so this is a plain import — no promotion. After C, every
  document-level action is palette-reachable.
- **D. Move undo/redo into the ops context bar**, where the mock draws them, with the
  dirty op count. Send `revert` to the panel-header menu (destructive, wants a visible
  home) and `copy trace` to palette-only (a fixture-authoring tool, not a user action).
- **E. Delete `actions`.** Remove from the `PanelTab` union and `panelTabs()`; delete
  `panelActions()`. Keep the `.actions` / `.action-row` / `.hint` CSS — `panelOps()`'s
  empty state reuses those classes.
- **F. Fold `tags` into `description`** as the three named groups.

Resulting `panelTabs()`: `['description']` → if `session`, push `'ops'`, `'hud'` → push
`'compare'`, `'json'`. Default stays `hud`; the existing "if the current tab isn't
available, fall back to description" guard still covers invalid-by-design scenarios,
which have no session.

**TypeScript is the safety net for E and F.** Narrowing the `PanelTab` union makes `tsc`
(inside `npm run build`) flag every stale branch, including the ternary chain in
`sidePanel()` and the assignment in `openPopover()`. That is the whole coverage story
here, and it is adequate.

### The deep links stay exactly as they are

`?view=compare|json` is **kept, unchanged, and not extended.** Three reasons: it is a
documented CLAUDE.md contract rather than vestigial; it is actively *produced* by
`commandItems()` via `scenarioHref()`; and both target tabs survive the cut, so
`willUpdate()`'s branch needs zero change. Nobody could ever have deep-linked `tags` or
`actions` — the URL never accepted them.

Explicitly **do not** put `panelTab` in the URL as part of this work. It is a separate
proposal with its own questions (history entries? back-button semantics? does `hud`
deserve a link at all?) and the mock does not ask for it.

## Per-tab work

### description
Merge `panelDescription()` and `panelTags()`. Title, copyable id line (reuse the
`copied`-flag pattern from `copyTrace()`), prose; then a 2px rule; then the three groups.
STATUS carries `classify()`'s state and detail, `meta.status`, the mirrored/local and
source provenance, `proposed schema`, and the spec/issue links. BUILD carries the golden
hashes — key in ink, hash in grey mono — and `render not witnessed`. SCHEMA COVERAGE is
today's `featureDefs` chips with the existing `DEF_PREVIEW` cap. Footer: a tag filter,
the same shape as the existing `+N more` toggle.

**The stat strip has one hole worth naming.** BARS and PARTS are already computed inside
`buildHudRows()` — extract a shared `scoreFacts(doc)` so the HUD and the strip cannot
disagree, with `meta.bars` as the no-session fallback. KEY needs a small `keyAt(doc, 0)`
beside the existing `timeAt()`. **EDITED has no source**: there is no backend and no
mtime, and the corpus is git. Do not invent a date — use `meta.verification.at`
relabelled **APPROVED** (honest, provenance-backed, already displayed elsewhere), plus an
**EDITS** cell from the session's applied-op count when dirty.

### ops
Context bar: `N ops · at head` (or `N behind head`), with UNDO / REDO moved in from
`panelActions()`. Rows gain the plain-English consequence line — `opLabel()` in
`opRows.ts` already computes most of what is needed; reformat into *subject · where ·
change*. Only the two ops carrying a delta (`transposeSelection`, `nudgeRest`) need a
before/after pair, and `EditHistory` already holds `before` snapshots, so this is an
accessor rather than a feature. **Do not build a document differ** — everything else
prints its absolute value. Footer: "Click any row to travel to that state". The row
states are already implemented; they just move onto the shared classes.

**Grouping consecutive same-op edits is answered "no"** — see the campaign doc.

### hud
The smallest item. `ScoreHud` already includes `designTokens`, so the restyle carries it
automatically; the work is the 62px rung column, the shared row-state classes, and the
dark footer. That footer is **the one intentionally dark element in a light app** —
comment it, or someone will "fix" it. The context bar (the address at the cursor) is
owned by the panel frame, not the component.

### compare
Adopt: the reference engraving above with the grayscale treatment and the existing CG
attribution; a footer naming the pinned spec release; the context bar. Adopt **OVERLAY**
— two absolutely-positioned layers with our render tinted, plus an opacity slider; cheap,
and a genuinely better review aid than side-by-side at 420px.

Adopt *with care*: "this score's live render, same bars, same width" means mounting a
**second `<mnx-score-viewer>`** in the panel — a second layout pass on every render. Gate
it behind the overlay control so it only mounts when asked.

**Reject the DIFFERENCES list and the "1 DIFFERENCE" chip** — argued in full in the
campaign doc. No data source exists, and computing one would create a second, unowned
verdict channel competing with `status: verified` and the attention queue.

### json
The UI half of [core-json-view.md](core-json-view.md): gutter, three inks (the
`--json-string/number/boolean` tokens already exist and are referenced nowhere), the
SELECTION / WHOLE SCORE toggle, COPY, and a find-in-JSON footer with the line count.
Also **restore the pinned-error highlight** — `showErrorInJson()` sets `errorPointer` and
the exhibit row still advertises "· highlighted in document →", but `panelJson()` never
reads it. The consolidation lost it; this puts it back and makes the existing claim true
again.

## Widths

`PANEL_MIN 240 → 360`, `PANEL_MAX 640 → 560`, `PANEL_DEFAULT 320 → 420`.

**No migration is needed** — `storedPanelWidth()` already rejects out-of-range values, so
a stored 320 falls back to the new default. But change reset to **clamp**: someone who
deliberately dragged to 600 should land on 560, not be thrown back to 420. One line. **Do
not bump the localStorage key** — a new key silently discards every stored preference for
no benefit.

The width and the tab cut are interdependent, which is worth saying out loud: the tab
strip currently needs `flex-wrap` because seven tabs do not fit at 320px. Five tabs at
420px fit on one line, and that is what lets the design's flush-left strip work at all.

**The `<360px` drawer mode is deferred** to an undrafted campaign row. It needs a
viewport breakpoint (a ResizeObserver on `.body`, since dragging cannot go below
`PANEL_MIN`), an absolutely-positioned panel — and **a panel open/close control that does
not exist**. The rail has Ctrl+B; the panel has nothing, and the mock specifies neither
the control nor its keystroke. Cheap to add once someone decides what it is.

## Not this

- **Not `panelTab` in the URL.**
- **Not the tray's business.** Commands live in the tray (`/`); this panel explains and reports.
- **Not a new verdict channel** — the compare rejection above.
- **Not promotion.** The panel is workbench-leaf and stays there.

## Verification

- Goldens unaffected, per the campaign's standing argument; assert with
  `npm run update:primitives` and a clean `git diff -- scenarios/` anyway.
- `npm run build` — and specifically **`tsc` against the narrowed `PanelTab` union**,
  which is the coverage for steps E and F.
- **No panel-tab conformance test.** It would require the tab table to live below the
  harness boundary, but `workbench/` is a leaf that nothing may import and
  `check:boundaries` enforces it. Promoting a UI table into `elements/` purely to test it
  is the wrong trade — CLAUDE.md calls promotion "a deliberate, reviewed move". `tsc`
  plus the hands-on pass is the honest answer here.
- **Hands-on, headless Chrome over CDP, zero console errors**, per stage boundary, over a
  fixed list:
  - `lab/document/twelve-bar-blues` — multi-part HUD, the part row's controls, `both`
    view, ops rows with real consequences
  - an invalid-by-design scenario (`lab/24-tab-spec-gaps/*`) — the **no-session tab set**
    (description / compare / json only), plus the exhibit → JSON pointer highlight
  - any `spec/` scenario — compare's reference pane, attribution, overlay
  - the largest score in the corpus — the JSON tab's gutter cost at full length
  - the panel dragged to both extremes, and reloaded, to confirm the clamp
