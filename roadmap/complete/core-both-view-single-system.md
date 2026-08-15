# The `both` view as one system — tab as a staff, not a second render

> **Status: COMPLETE (2026-08-08 — phase 3 shipped and the 13 both goldens human-approved,
> `bothHash` stamped on every tab scenario).** Direction set in
> conversation: the notation+tab view should read as **one engraved system** (connected
> barlines, one coordinate space), the way published guitar music prints it — not two
> stacked SVGs. Phase 1 built a composer that stacked and stitched the two standalone
> layouts; phase 2 replaced the stitch with the real thing: **tab is a display staff
> inside the notation layout's system walk** (`includeTabStaves`), with native shared
> barlines and interleaved multi-system wrap (verified 27 systems on the Vestapol
> fixture, every one a notation+tab pair). Phase 3 (below) settled the golden decision
> (**`expected.both.svg`**, SVG-only, `bothHash` provenance — zero demotions), made the
> compare pane prefer the combined system for tab-preferring documents, and cleared two
> recorded limitations (tab repeat dots, content-driven lyrics gap). All goldens
> byte-identical throughout every phase. Remaining: the human `/verify` sweep of the 13
> new both goldens, and the deferred items below.

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

### Recorded limitations — status after phase 3

- ✔ **Lyrics between the staves** (2026-08-08): the gap above an injected tab staff is
  now **content-driven** — it grows to clear the verse-row block
  (`gapAboveSp`/`TAB_LYRIC_CLEARANCE_SP` in `notation.ts`), and the bottom lyric pad is
  dropped when a tab staff sits below the verses instead. Constant 6sp everywhere else,
  so notation goldens couldn't move; verified 1.8sp minimum clearance on the
  Sun-did-glide fixture (2 verses, which previously collided). Where the gap *knob* is
  exposed still belongs to [core-render-density-zoom.md](../inprogress/core-render-density-zoom.md) /
  [core-viewer-surface.md](core-viewer-surface.md).
- ✔ **Repeat dots on tab** (2026-08-08): native tab staves now carry their own dots at
  the six-line staff's middle (`TAB_REPEAT_DOT_YS`), forward and backward. Both-view
  only — the standalone tab layout still draws no repeat furniture, so its goldens
  didn't move.
- Documents declaring `scores` skip tab-staff injection (their layout trees aren't
  expanded); no such tab-bearing document exists in corpus or fixtures today —
  **deferred until one does** (building it now would be speculation with no evidence to
  pin it).
- Grace notes / tremolos still aren't drawn on tab (columns reserved, staves aligned —
  same as the standalone view; parity is owned by the tab renderer, not this effort).

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

## Phase 3 — SHIPPED (2026-08-08): the golden decision + polish

**The both view earns its own golden, as SVG only: `expected.both.svg`.** Decided
against a third `RenderedSystem` in `expected.primitives.json`: the combined system
reads the same plan slots as the standalone projections, so its staff-space layout is
already pinned twice over — what it *adds* (vertical composition, spanning barlines,
interleaved wrap) is exactly what the emitted SVG text shows. And a new key in the
primitives JSON would have rewritten all 13 committed tab-scenario goldens, demoting
every approval — the mass-demotion the provenance record exists to avoid.

- `computeBothSystem` (`src/engine/headless.ts`) drives it through the
  `layoutBothSystem` seam; emitted for every tab-opting scenario, including the
  honestly-degraded case (tab wanted, no strings declared ⇒ both == notation — the
  golden pins instrument neutrality too).
- Provenance mirrors the `renderHash` precedent exactly: a new **optional `bothHash`**
  in the verification record; absence is grandfathered, never staleness.
  `renderHash`'s file set is **frozen** at the two standalone SVGs (folding
  `expected.both.svg` in would have moved every committed digest). **No backfill** for
  `bothHash` — nobody approved a both view before the golden existed, so it is earned
  only through a real `/verify` approval; the backfill commands explicitly skip it.
- The 13 tab scenarios stayed `verified`+current with a queue note ("approved before
  the both golden"); the `/verify` review page now shows every projection a scenario
  pins, so the next sweep collects the hashes honestly.
- **Compare** prefers the combined system for the "our render" pane when the
  *document* declares a tab preference — not when only a viewer override makes tab
  possible, so a notation-only spec scenario under an override still compares
  notation-to-notation with the reference engraving.

## Order of work

1. ✔ **Phase 1** — one render, joined barlines for the bench's single-system
   scenarios, fallback elsewhere. Shipped 2026-08-07.
2. ✔ **Phase 2** — tab staff native to `renderSegment`; stretch trick deleted
   (`layoutBothSystem` remains as the API seam); interleaved wrap. Shipped
   2026-08-07: 27 interleaved systems verified on the Vestapol fixture; all
   corpus goldens byte-identical; `tab.ts` refactored onto the shared
   `tabStaff.ts` with zero golden movement.
3. ✔ **Phase 3** — `expected.both.svg` + `bothHash` (zero demotions), compare-pane
   preference, tab repeat dots, content-driven lyrics gap. Shipped 2026-08-08.
4. ✔ **The `/verify` sweep** — all 13 combined systems human-reviewed and approved
   2026-08-08; `bothHash` stamped on every tab scenario (two also picked up their
   first `renderHash`). The sweep surfaced and fixed an approval-path gap: a
   grandfathered record must be *completed* by an explicit approval, not
   short-circuited as already-current. **This effort is done** — the deferred items
   (scores-doc injection awaiting a real fixture; grace/tremolo tab parity) live with
   their owning components.
