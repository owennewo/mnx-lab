# The `both` view as one system — tab as a staff, not a second render

> **Status: in progress — phases 1 AND 2 SHIPPED (2026-08-07).** Direction set in
> conversation: the notation+tab view should read as **one engraved system** (connected
> barlines, one coordinate space), the way published guitar music prints it — not two
> stacked SVGs. Phase 1 built a composer that stacked and stitched the two standalone
> layouts; phase 2 replaced the stitch with the real thing: **tab is a display staff
> inside the notation layout's system walk** (`includeTabStaves`), with native shared
> barlines and interleaved multi-system wrap (verified 27 systems on the Vestapol
> fixture, every one a notation+tab pair). All goldens byte-identical throughout.
> Remaining: the phase-3 golden decision below, plus the recorded limitations.

## Where we are

`viewMode: 'both'` is currently **two independent renders**: `ScoreViewer` stacks a
notation SVG and a tab SVG with a CSS gap between them. Column alignment holds only
because both layouts call the same pure `planHorizontal` with the same inputs — an
invariant **by convention, not construction**. Consequences:

- No cross-staff engraving is possible: barlines stop at each staff's edge, there is no
  system-start barline binding the pair, no bracket can span them.
- The horizontal plan (and validation) is computed twice per render.
- With multi-system wrap, the stacking order is wrong: all notation systems, then all
  tab systems — published engraving interleaves them (notation ↔ tab per system).
- Cross-highlight/cursor work spans two SVG coordinate spaces.

Meanwhile the notation layout already assembles true multi-staff systems (grand staff):
staff slots (`PlanStaff`), brace/bracket groups, `INTER_STAFF_GAP_SP`, system barlines
spanning `staffTops[0] → staffBottoms[n-1]`. The missing concept is only that a staff
slot cannot yet say *"I am a tab staff"* (different line count/height, fret digits
instead of noteheads, no key signature).

## Phase 2 — SHIPPED: tab as a display staff in the system walk

Built as a **display-staff overlay** inside `renderSegment`
(`src/engine/layout/notation.ts`): the horizontal plan and every plan-indexed
subsystem (beams, curves, ottavas, dynamics, lyrics, labels) stay blind to tab staves;
the overlay owns vertical geometry (per-staff heights via integer prefix sums —
byte-identical for all-notation systems) and the extra emission. Key pieces:

- `layoutNotation({ includeTabStaves: true })` appends each tab-bearing part's tab
  staff (staffKind `both`/`tab`; parts[0] fallback mirrors the standalone tab layout)
  after its notation staves. `layoutBothSystem` is now a one-line seam over this.
- **Shared emission module `src/engine/layout/tabStaff.ts`** — staff lines, TAB clef,
  tab time signature, fret digits — used verbatim by BOTH the standalone tab layout
  and the native tab staff, so the two projections cannot drift; the tab goldens pin
  the module through `tab.ts`.
- The tab staff reads the **same plan slots** (`m.staves[planStaff]`) as its notation
  sibling — columns align by construction, not convention.
- Barlines (regular, final, repeats, system-start) span notation top → tab bottom as
  **single native primitives** with notation's engraving weights — the phase-1
  stretch/snap stitch is deleted.
- Multi-system wrap interleaves naturally: every system is a notation+tab pair.
- `scope: 'tab'` validation issues badge on the system when it draws the fingerboard.

### Recorded limitations (phase-3 candidates)

- Documents declaring `scores` skip tab-staff injection (their layout trees aren't
  expanded); no such tab-bearing document exists in corpus or fixtures today.
- Lyrics between the staves: 2+ verse rows can collide with the tab staff (the
  inter-staff gap is a constant 6sp, not content-driven — the gap knob belongs to
  [render-density-zoom.md](../proposed/render-density-zoom.md) /
  [viewer-surface.md](../proposed/viewer-surface.md)).
- Repeat dots draw on notation staves only (barlines span both; the standalone tab
  layout draws no repeat furniture at all).
- Grace notes / tremolos still aren't drawn on tab (columns reserved, staves aligned —
  same as the standalone view).

**Goldens/corpus impact:** none forced. `expected.primitives.json` pins the standalone
notation and tab projections, which both remain (`viewMode: 'notation' | 'tab'`, and
`staffKind` still means what it means). A combined-system golden would be a *new,
deliberate* addition with its own `/verify` sweep, not a demotion.

## Phase 1 — SHIPPED, then superseded by phase 2: the system composer

A composed layout that produces **one `LayoutResult` — one SVG — for the both view**,
without touching the notation walk:

- `src/engine/layout/bothSystem.ts`: runs `layoutNotation` + `layoutTab`, stacks tab
  below notation **by content bounds** (no fixed dead band), merges indexes and
  diagnostics.
- Layouts additionally report `rows: {staffTop, staffBottom}[]` on `LayoutResult`
  (metadata only — the goldens serialize `{widthSp, heightSp, primitives}` and are
  untouched).
- **Joined barlines** in the single-system case: the tab staff's barline primitives
  (`className` carries `barline`) are stretched up to the notation staff's bottom line —
  collinear with the notation barlines at the same plan x, so each barline reads as one
  continuous stroke through both staves. The system-start barline comes for free (tab
  always draws one; stretched, it binds the pair, matching the multi-staff convention).
- **Honest fallback**: multi-system documents (and multi-score/layout documents) stack
  the two blocks unjoined inside the one SVG — today's visual, minus the CSS seam —
  until phase 2 interleaves properly.
- `ScoreViewer`'s both branch renders **one pane** via `renderMnxToSvgBoth`
  (`src/engine/both/bothRenderer.ts`), same fit + bounds-crop path as the other views.

Phase 1 deliberately does not: touch `spacing.ts`, change any layout constant, alter
either standalone view's output, or add a combined golden.

## Order of work

1. ✔ **Phase 1** — one render, joined barlines for the bench's single-system
   scenarios, fallback elsewhere. Shipped 2026-08-07.
2. ✔ **Phase 2** — tab staff native to `renderSegment`; stretch trick deleted
   (`layoutBothSystem` remains as the API seam); interleaved wrap. Shipped
   2026-08-07: 27 interleaved systems verified on the Vestapol fixture; all
   corpus goldens byte-identical; `tab.ts` refactored onto the shared
   `tabStaff.ts` with zero golden movement.
3. **Next**: decide whether the both view earns its own golden (new
   `expected.both.svg` or a third `RenderedSystem`), whether `compare` view should
   prefer the combined system for tab-part scenarios, and the recorded limitations
   above (lyrics gap, repeat dots on tab, scores-document injection).
