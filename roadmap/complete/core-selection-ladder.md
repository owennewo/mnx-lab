# The selection ladder — progressive selection as the input-mode system

> **Status: complete 2026-08-16 (proposed and started 2026-08-09).** Phase 1 built: the
> vertical ladder as session state (`src/edit/selection.ts` — presence rule,
> relax/tighten intents on Escape/Enter, level-scaled horizontal arrows incl.
> section jumps, level-aware `selectedNoteKeys` feeding the existing note-keys
> overlay, level shown in the edit strip), pinned by
> `harness/conformance/selection.test.ts`. **Phase 2 (same day): the enclosure
> vocabulary** — `src/elements/enclosure.ts` draws cell/slice/lasso/run/panel/
> panel-wide/frame from the rendered SVG's own geometry (staff-line bands,
> shared-barline system join, baseline-anchored glyph ink boxes — `getBBox` on
> a Bravura `<text>` is the font line box, not ink), with the fill-fades/
> border-firms gradient in `ScoreViewer` CSS and the level→shape map in the
> workbench (`elements/` never imports `edit/`). Verified by driving headless
> Chrome through the full ladder in notation and both views: the part-measure
> panel spans the notation+tab pair as ONE rect via the barline join, exactly
> the "echoes merge" moment the design predicted. Same-day revisions from
> using it: voice-measure is a single **run hull**, not beads (one shape
> morphs; beads read as clutter); part-measure/measure refined to the
> **ink/space principle** (panel = staff band + ledger ink inside the
> barlines, all four sides visible; panel-wide = the system's full vertical
> slot through the barlines, clamped inside the viewBox); a first-paint font
> race fixed (enclosures measured fallback-font glyph boxes before Bravura
> loaded — one-shot redraw on `document.fonts.ready`).
>
> **The navigation pass is COMPLETE — every rung, both axes, 2026-08-15.** The
> vertical arrows had never consulted the rung (`lineUp`/`lineDown` always
> walked the staff line, `jumpUp`/`jumpDown` returned false above note), so at
> event level ↑ crawled up empty staff positions while the slice never moved.
> Now the axis coarsens as the selection widens: **line → voice → staff**, with
> the Ctrl climb one rung ahead of it, and the bar rungs' Ctrl+←→ reaching the
> **section**. Three decisions closed with it:
>
> - **The voice step STOPS at the outermost voice** (the parked stop-or-wrap
>   question). A wrap across the stack is indistinguishable from a failed press
>   in dense writing, and the doc's own rule already says an arrow that does
>   nothing beats one that does something arbitrary.
> - **The measure rung's ↑↓ and part-measure's Ctrl+↑↓ are resolved by the
>   MOUNT**, which reads the viewer's system packing and emits the existing
>   `goToMeasure` — the same stage-1 pattern already chosen for the pending
>   digit debounce. `edit/` may import only `model/`, so "the nearest bar in
>   the neighbouring system" is
>   a fact it structurally cannot see; delivering it as an already-resolved
>   intent keeps the session deterministic and the trace replayable (a trace
>   records a bar, never a paint). The geometry lives with the packing that
>   decided it — `packedRowMeasures` and `neighbourSystemMeasure` in
>   `engine/layout/spacing.ts`, reading `packSystems` rather than restating the
>   wrap — surfaced by `ScoreViewer.systemRows()` beside `densitySteps()`, which
>   is the accessor this rung waited on
>   ([core-render-density-zoom.md](../complete/core-render-density-zoom.md)).
>   The column is PRESERVED across the step and clamps onto a shorter row: text-
>   editor line navigation over the bar-wrap grid, which is what the rung means.
> - **The score rung's ↑↓ escalates in the workbench mount** (prev/next scenario
>   in the rail's topic order), not yet as the element's `score-navigate` event —
>   that belongs with the `elements/` promotion and
>   [core-viewer-surface.md](../complete/core-viewer-surface.md)'s event contract.
>
> **Consistency refresh 2026-08-16.** The later element-ops/addressing work is
> now folded back into the ladder instead of merely cited from it. Grid
> positions carry the event they mean (including rests and tuplet/grace/
> tremolo children), so `presentLevels`, the HUD and mutations no longer
> re-derive an event with different top-level-only walks. Selection footprints
> use the canonical `model/noteWalk.ts` enumeration: container ink participates
> in every ancestor, and global measure/section/score rungs cover every part and
> staff rather than tinting only the cursor's staff under a whole-score frame.
> Delete is RUNG-FIRST — a note under a measure enclosure can no longer steal
> Del from the bar — and score-level removal addresses the cursor's empty part,
> not `parts[0]`. The HUD reads and marks that same part/staff. Focused
> selection/navigation/edit-op/registry tests pin the join.
>
> **Horizontal state foundation complete 2026-08-16.** `EditorSession` now
> owns the specified `SelectionState`; a point is represented by equal cursor
> edges and ordinary navigation keeps the session cursor as the active edge.
> The DOM-free resolver evaluates concrete intervals and live closures afresh
> against the document, returning typed structural members alongside canonical
> note/kit keys. Rests and empty multi-staff bar copies therefore remain honest
> members without fake ink ids. Reversal, sparse voices, container children,
> multi-part/staff scope, edits, endpoint clamping and projection invariance are
> pinned in the focused selection suite, and edit-trace fixtures now assert the
> final selection state beside document and cursor. No new binding landed in
> this slice: **gestures as data are next**.
>
> **Horizontal gestures complete 2026-08-16.** `extendSelection` records
> previous/next/end movement and `closeSelection` records the rung-preserving
> live closure. Shift+←/→, Shift+End, Ctrl+A and Meta+A are declarative
> bindings with `KEY_DOCS` meanings at every applicable rung. The anchor stays
> fixed while the active cursor reverses through it; note extension skips
> ghosts, event extension retains rests, bare ←/→ collapses before navigating,
> and projection changes remap both concrete endpoints. A committed edit trace
> replays both new intent kinds and asserts its final closure.
>
> **Range presentation complete 2026-08-16.** `SelectionContext` now carries a
> presentation-only structural span beside the note-key footprint: normalized
> moments for note/event members and full bar cells for voice/part/global
> measure members. `drawEnclosure` joins those units into one continuous shape
> per rendered system/projection, uses the paint's own packing rows plus live
> staff/barline geometry, and breaks honestly at wraps. Rest-only events and
> empty voice/part bar copies therefore have visible selection geometry without
> inventing note ids or changing a primitive/SVG golden. Hands-on review in the
> navigation playground covered notation and both views, closures at event,
> voice-measure, part-measure and measure, and a note range crossing three
> systems. It also settled the wide-range tray shaft: the command tray follows
> the active edge's system segment (and flips there), rather than anchoring to
> the bounding box of the whole multi-system range and drifting below it.
>
> **Range commands complete 2026-08-16.** Registry reads now aggregate the
> resolved structural members: articulation and direct bar-attribute tiles
> report all/none/`mixed`, and mixed fires the apply-to-all intent. The tray's
> meta line leads with the live member count. Unary note properties,
> articulations (including rest events), transposition and direct bar
> attributes execute through one batch `EditOp`, producing one undo/log entry
> while retaining the concrete range or live closure through apply, undo and
> redo. The section-range tile turns a derived section into its concrete
> measure interval; the part-scope tile commits the existing live whole-part
> closure. Spanners keep the established press–navigate–press anchor for an
> endpoint outside the selected scope. Focused registry/selection tests pin
> mixed→active, rest membership, history shape, undo and both scope tiles.
>
> Two bugs fell out of building it, both the same shape — **an address
> re-derived instead of carried**. The selection read its voice off the ink
> under the cursor, so stepping onto an empty cell repainted the OTHER voice's
> event while the cursor still said voice 1 (the mirror of the ink-walk bug
> below, one layer up); and the footprint walked `parts[0]` regardless of where
> the cursor was, which no bare arrow could reach until part-measure's ↑↓
> existed. Both now read the cursor. `initialCursor` carries the landed slot's
> voice for the same reason, and `moveMeasure` delegates to `moveToMeasure` so
> the bar jump and the go-to grammar resolve a missing voice by ONE rule.
> Pinned by eleven new cases in `harness/conformance/navigation.test.ts` and the
> rung mirrors in `keymap-docs.test.ts`; the cheatsheet
> ([core-keymap-cheatsheet.md](../complete/core-keymap-cheatsheet.md)) states the new
> meanings per rung, including which two rungs are the mount's.
>
> **Note level built 2026-08-10; its hands-on review same day.** Shipped: the navigation playground scenario
> (`lab/document/navigation-playground` — 8 bars, two sections, two voices,
> chords, rest/empty bars, deep ledgers, two parts, tab-opting Lead); the
> spatial notation cursor (`src/edit/staffSpace.ts` — clef-aware staff
> position ↔ pitch with key-signature entry defaults; `cursor.ts` grows
> per-slot staff positions, per-position voice sets and the `Projection`
> type); snap-to-ink ←→ with nearest-pitch landing (`movePositionInk`,
> voice-sticky, ghosts included); staff-position ↑↓; the `setProjection`
> intent (the workbench follows the pane; refuses tab on fingerboard-less
> docs); the Ctrl climb at note level (`jump*` intents — bar jump in BOTH
> projections per the review's first verdict, voice jump vertically; other
> rungs keep the legacy bar jump until their own pass); the entry toggle (Space →
> `toggleNote` → `insertPitchNote` op, voice-0 entry surface, key-default
> spelling) and the hollow dashed **ghost cell** overlay (`drawCursorGhost`).
> Generalized silent-column and structural ghosts closed its original ink-
> anchor limitation on 2026-08-16; see the completion note below. Pinned by
> `harness/conformance/navigation.test.ts`. NOT in this slice: the orthogonal
> advance/digit/letter work, now graduated to
> [core-entry-mode.md](../proposed/core-entry-mode.md), or event level and above.
>
> **Review findings folded in same-day**: (1) Ctrl+←→ = bar jump in BOTH
> projections — tab's event-skip read as bare → in single-voice music
> (degeneracy is FELT, not structural); (2) tighten from event level now
> descends via the nearest-child fallback when the carried line hits an
> empty cell; (3) the voice jump targets the event SOUNDING at the cursor's
> instant, not only same-beat onsets — an alternating bass against a melody
> almost never aligns. A second, REALISTIC review instrument shipped for the
> feel work: `lab/document/twelve-bar-blues` (E-minor-pentatonic melody over
> an alternating root–fifth bass in two real guitar voices, bass guitar
> underneath, Head/Turnaround sections, one sharp) — the synthetic
> playground keeps the presence-rule bars; the rail groups both under
> "Editor test beds".
>
> **Container + rung meanings complete 2026-08-16.** `container` is now a
> presence-governed `SelectionLevel` between event and voice-measure, with
> point/range/voice-closure membership, sibling navigation, HUD/tray rows and
> a snug lasso enclosure. Delete now has an explicit anti-retiming meaning at
> every remaining rung: event clears to an equal-duration rest; container,
> voice-measure and part-measure remove only when their owned ink is empty;
> section removes the boundary label, never its bars. Destructive range
> commands remain one batch/history entry and repair a vanished rung to its
> surviving ancestor. Focused tests pin container identity/ranges, reference
> cleanup, every guard and section preservation.
>
> **Relax/tighten shape tween complete 2026-08-16.** Before the viewer replaces
> its SVG, it snapshots the visible enclosure — including the live geometry of
> an interrupted transition — then morphs that shape into the newly rendered
> rung over 180 ms. Fragment pairing explicitly handles one→many duplication
> and many→one convergence, so the both-view notation/tab echoes visibly merge
> at part-measure and split again on tightening. The trigger compares geometry,
> not only enclosure names: measure and section both use `panel-wide`, but their
> extent change still teaches containment. A rapid Escape/Enter reversal starts
> from the shape actually on screen, and `prefers-reduced-motion` keeps the
> final redraw static. Pure topology/equality tests pin the morph contract;
> hands-on review covered every rung in the both-view navigation playground,
> the same-kind measure→section transition, rapid reversal and clean settling.
>
> **Primary/echo asymmetry complete 2026-08-16.** The session's active
> projection now reaches `SelectionContext`, so the combined viewer presents
> one model selection in two strengths: the active input dialect's ink and
> fine-rung enclosure stay full strength while the other projection remains a
> visible 40% echo. Activating notation or tab ink records the existing
> `setProjection` intent without forking or moving selection membership; the
> source bridge uses pointer-down so a focus repaint cannot swallow the
> activation, with a deduped click fallback for keyboard/synthetic input. At
> part-measure and above the two enclosure fragments become the one untagged,
> full-strength panel the shape vocabulary already draws. Projection/echo
> metadata follows one↔many tween fragments, so the merge and split do not
> flash back to equal weight. Pure classification tests pin the dialect rule;
> hands-on review in the both-view navigation playground covered both active
> projections, the two→one part-measure merge, the one→two tightening tween
> and clean settling without console errors.
>
> **Generalized ghosts complete 2026-08-16.** A ghost is now placed from the
> cursor's structural address, not only from coincident rendered ink. Silent
> and rest-only moments therefore use the same packed system row, measure-cell
> boundaries and inset onset geometry as structural range endpoints; the
> cursor's part/staff address and active projection choose the correct rendered
> band in notation, tab and both views. The earlier construct-op finding is
> closed one level up as well: a part with no measures receives one larger
> dashed vacancy — a place for a bar — and materializing its first measure
> returns to the ordinary cell ghost. Both remain cursor-only potential
> addresses: neither becomes a selection member or projection echo. Pure
> geometry tests pin the fallback, and hands-on review covered a rest-only bar,
> both projections across wrapped systems, the measureless-part panel and its
> first-measure transition without console errors. The overlay remains corpus-
> neutral, so no renderer golden changes.
>
> **Scrub alias 2026-08-20.** Hands-on use found Esc/Enter right in meaning
> but wrong in feel for *bouncing* between rungs: they are terminal keys on
> opposite corners of the keyboard, Esc sits fourth in a precedence cascade,
> and Enter will grow an input cliff at the note rung. **Shift+↑/↓ is now the
> fluency alias** — the `-`/`=` pattern applied to the ladder: the identical
> relax/tighten intents, so traces, the mount's deselect-past-score and the
> armed-anchor drop are shared, not forked. It completes both families:
> Shift+arrows reshape the selection (laterally along the rung, vertically
> across rungs — widening to the parent IS vertical extension in a containment
> model), and every modifier on ↑↓ now does something vertical (bare = line,
> Ctrl = climb, Alt = transpose, Shift = rung). Esc/Enter keep the endpoints'
> semantic story — Escape widens until it cancels, Enter narrows until it
> acts. Polarity (up widens) matches Helix's expand/shrink and is pinned in
> `keymap-docs.test.ts`.
>
> **Enclosure geometry revised 2026-08-20** by
> [workbench-rung-legibility.md](../inprogress/workbench-rung-legibility.md):
> the run/panel/panel-wide shapes described below are superseded by the
> **extent ladder on both axes** — the voice hull hugs the notehead contour
> (no staff-band floor), the part-bar panel owns its music's horizontal span
> rather than the bar cell, and the bar is the first full-width rung. That
> doc also planted the level chip this one promised, as the tray's collapsed
> handle. The vocabulary's principles (one shape family, geometry over
> styling, fill fades as the level widens) stand.
>
> **The selection ladder is complete.** Its orthogonal entry-mode axis —
> advance mode, stage-1 digit resolution and letter accelerators — graduated
> on 2026-08-16 to
> [core-entry-mode.md](../proposed/core-entry-mode.md). It shares the cursor but
> no selection membership or rung state with this item. The ladder builds
> directly on the complete
> input layer ([core-editor-input-layer.md](../complete/core-editor-input-layer.md)), which
> already decided the load-bearing substrate: the cursor is a **rhythmic
> position, not a note id**; selection is a **first-class output** of the intent
> state machine; the cursor/selection render as an **overlay keyed by
> `model/noteKeys.ts`**, so the renderer and the goldens never learn about
> session state. Entry ghosts exist. This doc is the next storey: what
> "selection" *is* when it can be wider than one position, and how input modes
> fall out of it. The section rung leans on
> [spec-score-text.md](../proposed/spec-score-text.md)'s proposed `section` field.

## The idea

Input modes are not a mode switch beside the selection — they **are** the
selection. Every selection has a level, every level owns exactly the properties
that live at that level of the MNX document, and the options offered at the
cursor are that level's options and nothing else. A bar selection offers bar
adornments because the global measure is the thing that *has* barlines, repeats
and tempo; a note selection offers string/fret/fingering because the note is
the thing that has them. The data model already made these decisions — the
editor just surfaces them.

## The ladder

Levels follow the document's containment chain. Brackets = present only when
the document has one (skipped otherwise — the **presence rule**).

| Rung | Owns (published schema + `_x.mnxLab` v5) |
|---|---|
| note | pitch, accidental display, ties; `string`, `fret`, `fingering`, `tab.technique` |
| event | duration, markings (articulations, fermata, tremolo), lyrics, slurs, rest, stem direction |
| [container] | tuplet ratio/bracket/number, grace slash/steal, two-note tremolo marks |
| voice-measure (= one `sequence`) | `fullMeasure` rest, staff assignment, voice ops (delete/swap/move) |
| part-measure | clefs, beams, dynamics, ottavas (stored here in MNX) |
| measure (global) | key, time, barline, repeats, volta, segno/fine/jump, tempo, rehearsal/section, harmonies; insert/delete measure |
| [section] | label/color, boundaries, select-the-range (proposed field — [spec-score-text.md](../proposed/spec-score-text.md)) |
| score | layouts, system breaks, multimeasure rests, title |

Schema facts this design rests on (verified against the pinned schema):
**articulations and slurs are event-only** — `note` has exactly `pitch`,
`accidentalDisplay`, `ties`, `perform`, `staff`, `written`. Ties are note-level
(they connect pitches); slurs are event-level but may pin endpoints to chord
members via `startNote`/`endNote`. "Voice" is a *label* on a sequence, not a
document object — voice-measure is the selectable thing; voice continuity is
emergent by name-matching, so there is nothing above it to select.

**Part is deliberately not a rung** — see the closure move below. Part config
(strings/capo/staffKind/name) belongs on the part row/scope. The HUD already
exposes presentation-only strings/capo overrides there without pretending a
closure exists; the closure is what will make whole-part document selection
and bulk commands honest, not a prerequisite for displaying the row.

## Two axes, two gesture families

The containment chain forks above part-measure (vertical parent = the measure
column; horizontal parent = the part), and the same fork exists in miniature at
every level. Resolution: **Escape/Enter own the vertical axis only; a second
family owns the horizontal.**

- **Escape relaxes** one rung up; past score it deselects (Escape never loses
  its universal meaning — it just becomes gradual). **Enter tightens** one rung
  down, descending by breadcrumb. The breadcrumb stores **relative addresses**
  (voice 2, second event, top note), re-resolved against the current bar —
  never absolute ids, which would teleport. Fallback order: history → nearest
  in viewport → first child. Enter at the bottom rung begins input: Escape
  widens until it cancels, Enter narrows until it *does*.
- **Shift+←→ extends laterally** at the current rung (events → slur/tuplet/
  beam/hairpin material; measures → volta/repeat/multirest material);
  **Shift+End** reaches the last sibling in that rung's closure.
  **Ctrl+A (Meta+A on macOS) is the closure** — “select all in this horizontal
  scope,” while KEEPING the rung so its property vocabulary does not change.
  The full table and state rules are below. Nothing relational in MNX needs a
  "pick target" second gesture except spans that cross the selected scope
  (cross-voice slur, cross-jump tie); the existing press–navigate–press anchor
  remains their fallback.
- **Bare arrows navigate by the rung's unit** — notes at note level, bars at
  bar level, sections at section level (Intro → Verse → Chorus: the way
  musicians actually skim, and the reason the section rung earns its place
  despite being a derived range over labels rather than a container).

**Selection addresses what is; the cursor may address what could be.** The
presence rule governs selection (no note rung under a rest, no container rung
outside one, no section rung in an unlabelled document). The *input cursor* is
allowed to occupy potential positions, shown **ghost** (hollow/dashed — the
existing entry ghosts generalized): Enter into a rest drops a ghost cell on a
staff line or string; typing materializes the note. Solid = a thing, ghost = a
place for a thing.

### Horizontal selection state — refreshed contract (2026-08-16)

The old shorthand `{level, anchor, extent}` was directionally right but too
small: a closure such as “the whole part” is a live model scope, not merely the
last bar that happened to exist when Ctrl+A was pressed. The session state is:

```ts
interface SelectionState {
  level: SelectionLevel;
  anchor: EditorCursor;
  extent:
    | { kind: 'cursor'; cursor: EditorCursor }
    | { kind: 'closure'; scope: 'voice' | 'part' | 'timeline' | 'score' };
}
```

The ordinary session cursor is the ACTIVE edge and mirrors `extent.cursor`;
`anchor` is captured on the first Shift gesture. Endpoints are full cursor
addresses (part, staff, voice, bar, onset, line, coincidence ordinal), never
note ids. Membership is resolved afresh from the document at `level`, through
the canonical event/note enumeration; an edit cannot leave a stored list of
ids masquerading as a current range. A closure is also resolved live, so an
appended bar joins “whole part/timeline” without rewriting selection state.

| Rung kept by Ctrl+A | Closure membership |
|---|---|
| note | every existing note in the active staff/voice across its part timeline |
| event | every event (rests included) in the active staff/voice timeline |
| container | every rhythm container in the active staff/voice timeline |
| voice-measure | every measure-copy belonging to the active staff/voice |
| part-measure | the whole active part, all its staves and measures |
| measure | the global timeline — every part's copy of every measure |
| section | the labelled timeline (all declared section ranges) |
| score | the score (idempotent; already the limit) |

Range extension follows the current rung's BARE horizontal unit but selects
only things that exist: note extension is the active voice's ink walk (tab
ghost columns remain cursor-only), event walks events, voice/part/measure walk
bar copies, and section walks labelled ranges. Container gets the sibling
container walk when that rung lands. Score has no lateral extension.

State transitions are fixed before implementation:

- First Shift+←→ captures `anchor`; later Shift presses move only the active
  extent. Reversing through the anchor grows out the other side, text-editor
  style. Shift+End resolves the closure's last concrete member.
- Bare ←/→ collapses a non-closure range to its left/right edge respectively;
  the next press navigates. A closure collapses to its current cursor because
  it has no honest geometric edge in a sparse voice.
- Escape/Enter map BOTH concrete endpoints through relax/tighten, preserving
  the time span and breadcrumbs. At the part-measure→measure fork, part scope
  becomes the corresponding global measure range; tightening uses the stored
  part breadcrumb. A closure changes scope by the table's nearest valid row.
- Projection changes never change model membership. They only choose the
  active endpoint's spatial landing and which projection is primary.
- Bulk mutations preserve the range so mixed/active command state can show the
  result. Entry into a ghost is the exception: it materializes one thing and
  re-anchors there. If an edit removes an endpoint, re-resolution uses the same
  nearest-survivor rule as cursor clamping; if nothing at that rung survives,
  the presence rule relaxes to the first valid ancestor.
- Traces record `extendSelection` / `closeSelection` intents, not resolved id
  lists. Fixtures assert the final `SelectionState` alongside doc and cursor.

**The ink walk re-anchored, and a shared line handed it to the wrong voice —
decided 2026-08-15: THE CURSOR CARRIES ITS VOICE.** `movePositionInk` took its
anchor from `slotAt` — whichever slot came first on the cursor's line — so when
two voices put a note on one line at one onset, a ←→ step could silently
continue in the OTHER voice, skipping the rest of the one being read. Found by
the destructibility sweep, which could not reach three notes of
`lab/edge-cases/bar-duration-mismatch` (a bar that deliberately does not sum)
or one of `spec/tie-targets` for exactly this reason.

The decision reads off the containment: MNX nests part → measure → sequence
(**voice**) → event → note, and `EditorCursor` had grown `partIndex` and
`staffIndex` but never the voice — the one component of a note's address that
was re-derived from ink instead of held. So it is held: `voiceIndex?`, absent
meaning the first, so every cursor and recorded trace written before this stays
valid.

Three rules fall out, and each is a test in `harness/conformance/navigation.test.ts`:

- **Horizontal movement stays in one voice; vertical movement crosses.** ←→
  walks the anchor's ink and never re-derives. Stepping the line onto ink that
  belongs to another voice *adopts* it — otherwise the selection would show one
  voice while the walk continued in another, the same incoherence mirrored.
  The **voice jump** stays the explicit form, for when a line step cannot say
  it (both voices on one line, or the wanted voice silent here).
- **`slotIndex` disambiguates within the voice, not across it.** The ordinal is
  position-local — it names a slot among *these* coincident slots and means
  nothing at the next position, which is why every move drops it. Voice is
  where you are; the ordinal is what you found there.
- **A bar without the anchor voice falls back** to the nearest voice at or
  below it, never persisting a voice that is not there and leaving the cursor
  addressing nothing.

Entry still targets voice 0 — a stated boundary, not an oversight: a typed note
following the cursor's voice is the entry surface's question
([core-element-ops-part-addressing.md](../complete/core-element-ops-part-addressing.md),
campaign item 13c).

The sweep's `no-op` column is now **empty**: 1,441 of 1,460 elements removed,
19 refused on purpose, **zero unaddressable**. Its drive aims at the target's
voice with the jump before it walks, which is the route a player takes.

Two smaller navigation findings closed alongside it: the line clamp was a hard
±16 staff positions, so an 8va note at position 17 (`spec/ottavas-8va`) was ink
the cursor could not reach — now ±24; and the sweep learned to use the **voice
jump** to reach a second voice's unshared onsets, which is what a player does,
since ←→ is voice-sticky by design.

**The cursor had no voice, and that lost notes — closed by the same decision.**
`EditorCursor` was `{measureIndex, onset, line}`, so `slotAt` returned whichever
slot matched the line first: when two voices put a note on the same string at the
same onset (twelve-bar-blues m10 — melody over the alternating bass), the address
was ambiguous and Delete removed *the other voice's* note. Found 2026-08-14 by the
destructibility sweep, which reported 48 of that scenario's notes as unaddressable
([core-element-ops-destruct-sweep.md](../complete/core-element-ops-destruct-sweep.md),
campaign item 2). It took **both** halves of the answer, which is why it read as
one problem and was two: the disambiguating gesture at the note rung
(`slotIndex` + `Alt+V`, core-note-address.md move 2) for coincidence *within* a
voice, and the anchor above for coincidence *across* voices. Note the asymmetry it
also exposed: the same chord can be ambiguous in tab (two members derived onto
one string) and perfectly addressable in notation, so the fix has to name which
projection's address it fixes.

**A measureless part drew nothing — closed 2026-08-16** — observed 2026-08-12 walking a construct
op queue backward ([core-element-ops-exemplar.md](../complete/core-element-ops-exemplar.md),
campaign item 1): the first two positions of a from-`{}` build (`{}` and
part-added) are identical in the score pane, distinguishable only in the ops
queue and the json tab. The ghost vocabulary is where the fix belongs — an
empty part is a *place for a bar*, exactly the solid/ghost distinction one
level up from the cell. It now draws one larger dashed vacancy until its first
measure materializes, and it is corpus-neutral (no scenario is measureless), so
it costs no goldens.

## One visual vocabulary: the enclosure

Every rung is an enclosure; differentiation is geometry, not styling systems —
which is what makes the Escape/Enter animation a single shape tween, and the
tween is the containment teacher (the old selection is *visibly inside* the
new one).

- **note** — a snug **square cell** (~1.2sp) on the notehead / fret number. An
  address, not an ink claim (it does not chase the accidental). Works at
  zero-ink positions as a ghost — this is Guitar Pro's cursor, and the reason
  note is an enclosure rather than recolored ink.
- **event** — a **column slice** spanning the staff. Aspect-categorical vs the
  cell (a square around a whole note can never be confused with a staff-height
  slice through it), and it depicts the meaning: note is a *place*, event is a
  *moment*. Also normalizes chords vs lone notes.
- **[container]** — lasso around member events + its own artifact (bracket,
  number, slash) tinted.
- **voice-measure** — **one hull around the voice's run of events**, first to
  last. (Revised 2026-08-09 from the original beads-on-a-string design: a
  single shape morphs cleanly in the future relax/tighten tween where N beads
  would pop in and out, and in practice the beads read as clutter. Accepted
  cost: in interleaved two-voice writing the hull can contain the other
  voice's ink — the ink tint still marks which notes are actually selected,
  and beads remain the fallback if that proves confusing.)
- **part-measure** — the hull grows into one filled rect, barline to barline.
  Refined 2026-08-10 to a principle: part-measure owns the staff's **ink** —
  the staff band plus any ledger notes, none of the space around it — drawn
  *inside* the barlines so all four sides read as the enclosure's own.
- **measure** — owns the **space**: the system's full vertical slot (to the
  midpoint of the neighbouring system, or the page crop edge) and *through*
  the barlines, clamped just inside the viewBox so no side is ever clipped.
  This subsumes the original margins rule — the slot naturally covers the
  strip where tempo/rehearsal/harmonies sit, because that space belongs to
  the measure column.
- **[section]** — the band stretches over the range, label chip lit, tinted
  with the section's own `color`; outside dims.
- **score** — fill fades to zero, border only: the frame is the enclosure's
  limit case, and one more Escape removes it (deselect).

Two parameters carry the rung identity: **extent** (monotonically growing) and
**fill/border ratio** (strong fill + hairline at event → translucent wash at
bar levels → border-only at score). No two adjacent rungs share both. A
persistent **level chip** ("Verse 2 · Bar 12 · Voice 2 · note") is the
redundant, colorblind-safe, screen-reader channel.

## The both view: primary + echo

Selection is model state; the both view has two projections of one model, so
the selection shows on **both staves** — full-strength on the **active
projection** (where the user clicked/types), a dimmed echo on the other. The
active-projection bit is required anyway, because input dialect differs: ↑↓ at
note level means *pitch* on the notation staff and *string* on the tab staff.
The asymmetry resolves itself up the ladder: from part-measure the enclosure is
one rect spanning the staff pair — the morph where two echoes merge is the
visual statement that they were always one bar. Same idiom as the existing
note↔JSON cross-highlight: one selection, echoed across representations.

## The bare-arrow navigation map (drafted 2026-08-10, BUILT 2026-08-15)

> Every row below is implemented. Most of it is `session.moveHorizontal` and
> the level switch beside it (`stepVoice`, `stepStaff`, `sectionStep`); the
> measure row's ↑↓ and the score row's are resolved in the mount and arrive as
> `goToMeasure` or as a rail navigation. The cheatsheet carries the same table
> as data (`src/edit/keymapDocs.ts`) and states what the READER gets, so those
> two rows are in it even though the session refuses them —
> `keymap-docs.test.ts` names exactly that pair, so a third rung going quietly
> inert cannot pass as documented.


The matrix is selection level × projection (notation vs tab). Forcing it flat
surfaced two regularities: **the projections agree at every level except
note**, the one rung where they have genuinely different substrates — and at
note level they diverge on BOTH axes, along one principle (below). Bare
arrows never mutate (survey §3.2), at every level.

| Level | ← → notation | ← → tab | ↑ ↓ notation | ↑ ↓ tab |
|---|---|---|---|---|
| note | prev/next position in this voice, snapping to its nearest-pitch ink | prev/next grid column, ghosts included, staying on the string — **space** | prev/next **staff position** (line/space), occupied or not — **space** | neighbouring string, occupied or not — **space** |
| event | prev/next event in this voice (rests included) | same | same instant, neighbouring **voice**'s event | same |
| voice-measure | same voice, prev/next bar | same | neighbouring **voice** in this bar | same |
| part-measure | prev/next bar, same part | same | neighbouring **part/staff** | same |
| measure | prev/next bar column | same | nearest bar in the neighbouring **system** (text-editor line navigation over the bar-wrap grid) | same |
| section | prev/next section | same | *(unbound)* | same |
| score | *(unbound)* | same | **escalates to the host**: currently the workbench mount navigates the rail; the promoted element will emit the public event | same |

Why the rows are what they are:

- **Note level navigates SPACE in both projections** (revised again
  2026-08-10, settled through the entry/chords discussion). Tab's space is
  the fingerboard — (string × beat) cells, Guitar Pro's box cursor, digits
  type frets. Notation's space is the staff — (staff position × beat) cells:
  ↑↓ steps lines and spaces whether occupied or not, an **entry action key
  toggles a notehead** at the cell (Space is the current, still-reviewable
  binding; it collides with the common play/pause convention),
  and Alt+↑↓ — the existing polymorphic transpose verb — supplies the
  chromatic alteration over the position's diatonic default. **The chord
  argument decided this**: the incumbents (MuseScore/Sibelius/Dorico) enter
  pitch by letter name, which conflates pitch with time-advancement — so all
  three ship a patch for chords (Shift+letter, interval keys, Dorico's Q
  chord mode). The spatial cursor has no such wound: the address is (beat,
  position), the action key touches only pitch, → is the only thing that
  advances time — chords need no mode, and entering vs editing a chord is
  one gesture, exactly like tab. Costs, accepted: leap fatigue (an octave is
  seven presses until the letter layer lands) and a diluted ink-walk (empty
  positions between chord members). Cross-voice movement at an instant stays
  Ctrl+↑↓'s job (event-level voice jump) — which the spatial model makes
  genuinely distinct in notation, repairing a degenerate Ctrl cell. A
  **letter accelerator layer** is owned by
  [core-entry-mode.md](../proposed/core-entry-mode.md), with two candidate semantics:
  letters-as-entry (incumbent-style, re-imports the chord patch) vs
  **letters-as-navigation** (letter jumps the cursor to the nearest matching
  staff position; the action key stays the only mutator) — lean: navigation.
- **Event**: widening past note stops addressing *within* the stack, so the
  vertical axis coarsens to the stack's next unit — the **voice**. The same
  meaning carries through voice-measure (continuity: only the horizontal
  grain changes, events → bars).
- **Part-measure**: ↑↓ walks the system's parts/staves. Stated rule: in the
  both view the notation+tab pair is ONE part-measure — **arrows never switch
  projection**; vertical arrows move in the model, never between views of the
  same model (projection switching is the active-projection gesture).
- **Measure**: the score at this rung is bars wrapped into systems — a text
  editor's characters wrapped into lines. ←→ walks bars through the wrap, ↑↓
  is line navigation to the nearest bar in the neighbouring system.
- **Section**: ↑↓ has no honest referent, so it stays unbound — an arrow
  that does nothing beats one that does something arbitrary.
- **Score**: ←→ stays unbound, but ↑↓ **hands off** — the ladder does not end
  at the document, it continues into the host: at score level the vertical
  neighbour is the next document in the HOST's collection, which the element
  cannot know. **Today the workbench mount handles it directly**, binding
  prev/next to scenario order in the rail. Promotion turns that already-built
  host escalation into an element event (e.g. `score-navigate`) for studio to
  bind to its own collection; [core-viewer-surface.md](../complete/core-viewer-surface.md)
  owns that public contract. It fires ONLY at score level, so arrows stay inert
  everywhere they lack meaning.

### Ctrl+direction — climb to the first meaning change (decided 2026-08-10, BUILT 2026-08-15)

**Ctrl+dir = relax until dir's meaning changes, apply it there, descend
back** — the Esc-dir-Enter composition with degenerate hops removed (a hop
is degenerate when the ancestor's arrow would produce the move you already
have). Defined operationally over the bare map, so it tracks whatever the
bare map settles into. What it yields today:

| Level | Ctrl+←→ | Ctrl+↑↓ |
|---|---|---|
| note | **bar jump** (both projections — see rider) | **voice jump** |
| event | **bar jump**, voice kept | **part jump** (voice-measure degenerate) |
| voice-measure | **section jump** (bar-step rungs all degenerate; dead without sections) | **part jump** |
| part-measure | **section jump** (dead without sections) | **system jump** |
| measure | **section jump** | dead (boundary rule) |
| section | dead | dead |
| score | dead | bare ↑↓ already escalates |

Two riders:

- **The note-level ←→ outcome is coupled to the settled nearest-ink landing**:
  *snap-to-ink* makes note's walk degenerate with event's, letting the climb
  reach bar jump — the "Ctrl+→ at a note must jump a bar" requirement is an
  argument FOR snap-to-ink. **Tab's event-skip: RESOLVED by the note-level
  hands-on review (2026-08-10)** — the pure rule stopped tab's climb at
  event-skip (its grid walk differs from the event walk on paper), but in
  single-voice music the grid IS the voice's events plus the ghost, so
  event-skip read as bare → in practice. Verdict: degeneracy is judged by
  FELT sameness, not structural sameness — Ctrl+←→ is the bar jump in both
  projections.
- **The climb never crosses the component boundary**: score's ↑↓ is the host
  escalation, reachable only as bare arrows at score level — a climb that
  gets there dies instead (no Ctrl+↓-on-a-bar jumping documents).

### Orthogonal entry mode — graduated 2026-08-16

Advance on/off, stage-1 fret-digit resolution, the provisional Space binding
and letter accelerators are now one standalone implementation proposal:
[core-entry-mode.md](../proposed/core-entry-mode.md). The split preserves this
item's settled claim: advance is session state, **not** a selection rung or a
projection property. The new item owns timing, bindings and post-addition cursor
movement; this completed ladder continues to own the cursor address those actions
start from.

### The navigation playground scenario

Build alongside the note-level implementation: ONE lab scenario rich enough
to exercise every cell of the matrix, serving all the hands-on reviews as
the standing test bed. Content checklist: enough bars to wrap into **two or
more systems** (measure-level ↑↓ line navigation), **two sections** (section
rung + section jumps), at least one **two-voice bar** (voice switching, run
hull honesty), **chords** (landing rules, stack walking), a **rest-only
bar** and an **empty bar** (presence skipping), **deep-ledger notes**
(enclosure stretch, staff-assignment), **two parts** with one tab-opting
part (part-measure ↑↓, the both view's pair-vs-part distinction, projection
echoes) with declared `strings[]`. The gap this originally exposed is closed:
the cursor now carries part and staff, and the part-measure vertical walks the
system's actual staff order.

Still parked in [core-entry-mode.md](../proposed/core-entry-mode.md)'s hands-on
entry review: whether Space remains the entry action key, the digit window and
the single session default. The notation note-level ←→ landing
is no longer parked: the review chose nearest-pitch ink. **Decided 2026-08-15
with the per-level pass**:
voice-switching ↑↓ **stops** at the outermost voice — a wrap across the stack
reads as a failed press in dense writing, and the rung's own rule is that an
arrow doing nothing beats one doing something arbitrary.

## Design questions this item owns

- ~~**The per-level navigation map**~~ — **complete and mirrored in
  `keymapDocs.ts`**. The element-ops pass also made digits note-only,
  transpose footprint-scaled, and the command set scope-filtered. Delete is
  rung-first and pinned at every rung: equal-duration clearing at event,
  guarded structural removal through the bar scopes, boundary-only removal at
  section, and guarded part removal at score.
- ~~**Escape precedence**~~ — **answered** in `src/edit/keymap.ts`
  (`ESCAPE_PRECEDENCE`): innermost open thing first — popover, then tray or
  palette, then `relaxSelection`, then the mount's deselect. Stated once, in the
  only module that interprets KeyboardEvents, and enforced by the DOM rather
  than by consultation (overlays `preventDefault()` before the page listener
  runs), which is why the ORDER is the whole contract and nothing branches on it.
- ~~**The voice hull in dense two-voice writing and cell size in dense tab**~~
  — prototyped and reviewed in the enclosure pass; one run hull won over beads.
- ~~**Selection in the state machine**~~ — built as `SelectionState` plus the
  live membership resolver, then completed with replayable
  `extendSelection`/`closeSelection` intents and final-state trace assertions.
  The command registry already reserves `mixed`, and the tray
  residue ledger names the UI joins that wake when range membership exists.
- **The section rung is spec-loop evidence.** It is built on a
  proposed-schema field; if section-nav proves out, that experience belongs in
  `spec/proposals/` as an implementation argument for adoption
  ([spec-score-text.md](../proposed/spec-score-text.md)).
- **Interaction with the full-bar invariant** — unentered positions ARE beat
  rests; ghost cells and the rest/note-rung skipping must agree with that
  model, not fight it.

## Remaining implementation sequence

1. **Complete 2026-08-16 — state + membership resolver.** `SelectionState`,
   active-edge point synchronization, concrete range/live-closure resolution,
   structural members, note/kit keys and final trace state are built and pinned.
2. **Complete 2026-08-16 — gestures as data.** `extendSelection`
   (previous/next/end), `closeSelection`, Shift+←→, Shift+End, Ctrl+A/Meta+A,
   `KEY_DOCS`, collapse and projection-preservation rules are built and pinned.
   Future mouse drag/click parity must emit these intents — no second path.
3. **Complete 2026-08-16 — range presentation.** `SelectionContext`/
   `drawEnclosure` consume the resolved structural span as one continuous shape
   per system/projection, with wrap breaks and rest/empty bar-cell fallbacks.
   Hands-on review settled wide selections, and the tray shaft now follows the
   active edge's system segment. Overlay only; primitive/SVG goldens stayed
   byte-identical.
4. **Complete 2026-08-16 — commands.** Registry `mixed`, member counts and the
   section-range/part-scope tiles are live. Bulk unary verbs apply one batch
   op/log entry to resolved structural membership and preserve the selection;
   the existing spanner anchor remains for out-of-scope endpoints.
5. **Complete 2026-08-16 — container + remaining rung meanings.** The container
   rung uses the parent event identity already carried by the grid and is wired
   through navigation, closures, HUD/tray and the lasso presentation. Delete is
   explicit and pinned at event, container, voice-measure, part-measure and
   section, including post-removal ancestor repair.
6. **Complete 2026-08-16 — relax/tighten shape tween.** The viewer snapshots
   the outgoing enclosure before its full SVG redraw and morphs from that live
   geometry into the new rung. Ordered fragment pairing covers one↔many echo
   topology, same-kind extent changes still animate, interrupted reversals do
   not snap back, and reduced-motion readers get the final static shape.
7. **Complete 2026-08-16 — primary/echo asymmetry.** The active projection is
   carried into the combined viewer and source activation switches it through
   the existing recorded intent. Fine-rung ink and enclosure fragments on the
   other projection are quiet echoes; wide rungs resolve to one full-strength
   enclosure at the existing part-measure merge boundary, and tween fragments
   retain their destination role through one↔many topology changes.
8. **Complete 2026-08-16 — generalized ghosts.** Empty/rest-only cursor moments
   derive their x from packed row and bar-cell geometry when no note/fret can
   anchor it, while model part/staff and projection choose the rendered band.
   A measureless part draws a larger panel-shaped vacancy until its first bar
   materializes. Ghosts remain cursor-only potential addresses and do not enter
   range membership, closures or the primary/echo selection contract.

## Not this

- **Not a renderer change.** Enclosures are the existing overlay pattern,
  grown; `expected.primitives.json` and every golden are untouched by design.
- **Not the `elements/` promotion** — the ladder lands in the workbench mount
  first ([core-editor-element-promotion.md](../proposed/core-editor-element-promotion.md) keeps its
  own trigger).
- **Not discontiguous multi-select** (Ctrl+click collections) — the ladder is
  one ordered interval or one derived closure at one level, never an arbitrary
  bag. Sparse voices may contain silence between members; that is still one
  logical closure. Overlap lives in document spanners, never in selection.
- **Not new properties panels.** The HUD/tray now provide the existing surfaces
  (including per-part presentation overrides); this doc supplies honest range
  and closure membership for their bulk/document commands. New properties stay
  with [core-viewer-surface.md](../complete/core-viewer-surface.md) and the editor
  proposals that need them.
