# The selection ladder — progressive selection as the input-mode system

> **Status: in progress (proposed and started 2026-08-09).** Phase 1 built: the
> vertical ladder as session state (`src/edit/selection.ts` — presence rule,
> relax/tighten intents on Escape/Enter, level-scaled horizontal arrows incl.
> section jumps, level-aware `selectedNoteKeys` feeding the existing note-keys
> overlay, level shown in the edit strip), pinned by
> `harness/conformance/selection.test.ts`. **Phase 2 (same day): the enclosure
> vocabulary** — `src/elements/enclosure.ts` draws cell/slice/run/panel/
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
> **The navigation pass is underway — NOTE LEVEL BUILT 2026-08-10, awaiting
> its hands-on review.** Shipped: the navigation playground scenario
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
> spelling) and the hollow dashed **ghost cell** overlay
> (`drawCursorGhost`; known gap: columns with no ink anywhere can't anchor
> an x). Pinned by `harness/conformance/navigation.test.ts`. NOT in this
> slice: advance mode + the stage-1 digit debounce, the letter accelerator
> layer, event level and above.
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
> After the note-level review, continue the per-level pass (event next), then:
> lateral extension + closures
> (Shift+arrows/Ctrl+A), the relax/tighten shape TWEEN (each level currently
> re-renders statically), primary/echo asymmetry (both projections draw at
> full strength), ghost cells beyond the existing entry ghosts, container
> rungs (the cursor still treats containers as opaque), and trace fixtures
> asserting selection. Builds directly on the complete
> input layer ([core-editor-input-layer.md](../complete/core-editor-input-layer.md)), which
> already decided the load-bearing substrate: the cursor is a **rhythmic
> position, not a note id**; selection is a **first-class output** of the intent
> state machine; the cursor/selection render as an **overlay keyed by
> `model/noteKeys.ts`**, so the renderer and the goldens never learn about
> session state. Entry ghosts exist. This doc is the next storey: what
> "selection" *is* when it can be wider than one position, and how input modes
> fall out of it. The section rung leans on
> [spec-score-text.md](spec-score-text.md)'s proposed `section` field.

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
| [section] | label/color, boundaries, select-the-range (proposed field — [spec-score-text.md](spec-score-text.md)) |
| score | layouts, system breaks, multimeasure rests, title |

Schema facts this design rests on (verified against the pinned schema):
**articulations and slurs are event-only** — `note` has exactly `pitch`,
`accidentalDisplay`, `ties`, `perform`, `staff`, `written`. Ties are note-level
(they connect pitches); slurs are event-level but may pin endpoints to chord
members via `startNote`/`endNote`. "Voice" is a *label* on a sequence, not a
document object — voice-measure is the selectable thing; voice continuity is
emergent by name-matching, so there is nothing above it to select.

**Part is deliberately not a rung** — see the closure move below. Part config
(strings/capo/staffKind/name) is a properties surface reached from the
closure selection, consistent with the instrument selector already being
viewer-level presentation.

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
  **Shift+End** to the end of the run; **Ctrl+A is the closure**. The closure
  at each rung *is* the horizontal axis-mate the ladder can't hold: Ctrl+A at
  voice-measure = the whole voice, Ctrl+A at part-measure = **the part**,
  Ctrl+A at measure = the whole timeline. Nothing relational in MNX needs a
  "pick target" second gesture except the exotic spans (cross-voice slur,
  cross-jump tie), which get exactly that as the fallback.
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

**The cursor has no voice, and that loses notes.** `EditorCursor` is
`{measureIndex, onset, line}`, so `slotAt` returns whichever slot matches the
line first: when two voices put a note on the same string at the same onset
(twelve-bar-blues m10 — melody over the alternating bass), the address is
ambiguous and Delete removes *the other voice's* note. Found 2026-08-14 by the
destructibility sweep, which now reports 48 of that scenario's notes as
unaddressable ([core-element-ops-destruct-sweep.md](core-element-ops-destruct-sweep.md),
campaign item 2). The per-level pass owns the decision — a voice component in
the cursor, or a disambiguating gesture at the note rung — and the sweep's
report is the regression surface for whichever lands. Note the asymmetry it
also exposed: the same chord can be ambiguous in tab (two members derived onto
one string) and perfectly addressable in notation, so the fix has to name which
projection's address it fixes.

**A measureless part draws nothing** — observed 2026-08-12 walking a construct
op queue backward ([core-element-ops-exemplar.md](../complete/core-element-ops-exemplar.md),
campaign item 1): the first two positions of a from-`{}` build (`{}` and
part-added) are identical in the score pane, distinguishable only in the ops
queue and the json tab. The ghost vocabulary is where the fix belongs — an
empty part is a *place for a bar*, exactly the solid/ghost distinction one
level up from the cell — and it is corpus-neutral (no scenario is measureless),
so it costs no goldens.

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

## The bare-arrow navigation map (draft 2026-08-10 — review level by level)

The matrix is selection level × projection (notation vs tab). Forcing it flat
surfaced two regularities: **the projections agree at every level except
note**, the one rung where they have genuinely different substrates — and at
note level they diverge on BOTH axes, along one principle (below). Bare
arrows never mutate (survey §3.2), at every level.

| Level | ← → notation | ← → tab | ↑ ↓ notation | ↑ ↓ tab |
|---|---|---|---|---|
| note | prev/next position in this voice — landing rule parked: keep the staff position (pure space) vs snap to the voice's nearest-pitch ink | prev/next grid column, ghosts included, staying on the string — **space** | prev/next **staff position** (line/space), occupied or not — **space** | neighbouring string, occupied or not — **space** |
| event | prev/next event in this voice (rests included) | same | same instant, neighbouring **voice**'s event | same |
| voice-measure | same voice, prev/next bar | same | neighbouring **voice** in this bar | same |
| part-measure | prev/next bar, same part | same | neighbouring **part/staff** | same |
| measure | prev/next bar column | same | nearest bar in the neighbouring **system** (text-editor line navigation over the bar-wrap grid) | same |
| section | prev/next section | same | *(unbound)* | same |
| score | *(unbound)* | same | **escalates to the host**: the element emits a navigate event (prev/next document) | same |

Why the rows are what they are:

- **Note level navigates SPACE in both projections** (revised again
  2026-08-10, settled through the entry/chords discussion). Tab's space is
  the fingerboard — (string × beat) cells, Guitar Pro's box cursor, digits
  type frets. Notation's space is the staff — (staff position × beat) cells:
  ↑↓ steps lines and spaces whether occupied or not, an **entry action key
  toggles a notehead** at the cell (binding parked — Space collides with the
  play/pause convention; it may BE Enter's bottom-rung "begin input" job),
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
  **letter accelerator layer** comes later, with two candidate semantics:
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
  cannot know, so it emits a navigate event (e.g. `score-navigate` with a
  direction) from the component. The workbench binds it to prev/next
  scenario in the rail; studio will bind it to prev/next score. This is part
  of the element's public surface — record it in
  [core-viewer-surface.md](core-viewer-surface.md)'s event contract when
  that lands. Emitted ONLY at score level, so arrows stay inert everywhere
  they lack meaning.

### Ctrl+direction — climb to the first meaning change (decided 2026-08-10)

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

- **The note-level ←→ outcome is coupled to the parked landing rule**: only
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

### Advance mode (on | off) — an orthogonal entry mode

Whether entry auto-advances the cursor is **not a property of the entry
keys** — it is an orthogonal session mode, **advance mode: on | off**
(named 2026-08-10; "insert/append" was rejected because Dorico's *Insert
mode* names a different axis — entry shifting subsequent music vs
overwriting — which this repo will meet later against the full-bar
invariant). It works identically in both panes. The reframe *explains* the
incumbents: Dorico's Q chord mode is an advance-off toggle, MuseScore's
Shift+letter is advance-off for one keystroke — patches needed only because
advancement was baked into the letter keys. Here, any entry action
materializes ink and the mode decides whether the cursor then steps (by the
pending entry duration).

- **Digit debounce — decided 2026-08-10, needed in BOTH modes.** Advance-on
  needs a window so the second digit can combine before the cursor steps;
  advance-off needs it too, because today's timer-free combining has a
  hidden ambiguity — `1` then `2` ALWAYS combines, so fret 1 can never be
  corrected to fret 2 in place. The window resolves both: within it a digit
  combines, after it a digit replaces. **Determinism is preserved by
  placement**: the debounce lives in stage 1 (the keymap/mount layer, which
  already owns environment-dependent interpretation) and emits the RESOLVED
  intent — the session stays timer-free and traces record what the debounce
  resolved, never the timing. Commit happens at window expiry OR immediately
  on any non-digit intent (navigation never waits); with advance on, the
  cursor step is deferred to the commit. The window duration is a named
  tunable; the session's current in-place combining retires when this lands.
- **Removal never advances**: the mode applies to additions only; toggling a
  head off stays put.
- **Per-pane defaults, parked**: GP muscle memory says tab defaults to
  advance-off (GP never auto-advances); incumbent muscle memory says
  notation defaults to advance-on. Different defaults are defensible because
  the axis is orthogonal; whether they FEEL consistent is for the review.
- Mode changes are session state set through a recorded intent (like the
  pending entry duration), so traces replay them.

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
echoes) with declared `strings[]`. Note the implementation gap this exposes
on purpose: the cursor currently addresses parts[0] staff 1 only — the
part-measure rung's vertical needs the cursor to grow a part axis.

Parked for the hands-on reviews (feel decisions): whether voice-switching ↑↓
**stops or wraps** at the outermost voice; the notation note-level ←→
**landing rule** (keep the staff position — pure space, symmetric with tab's
string-stickiness — vs snap to the voice's nearest-pitch ink, which suits
walking existing melodies); the entry action key's **binding** (Space vs
Enter-at-bottom-rung vs other — Space collides with the play/pause
convention); the **debounce window duration**; and whether per-pane advance
defaults feel consistent.

## Design questions this item owns

- **The per-level navigation map** — phase 1 only scaled the horizontal
  arrows; every key deserves per-level thinking. **The bare-arrow map and
  the Ctrl climb rule are drafted below** (their own sections); Delete,
  digits, transpose and the palette's command set still need the same
  treatment (Delete at measure = clear the bar? at section = ?). **Process,
  agreed 2026-08-10: work ONE level at a time, hands-on review after each
  level to check it feels natural before starting the next** — the map is a
  feel decision, not a derivation, so it gets the same review-first
  treatment as the corpus.
- **Escape precedence** — popovers and the palette already consume Escape;
  overlay-first ordering needs stating once in the keymap layer.
- **The voice hull in dense two-voice writing** and **cell size in dense tab**
  are the two visuals most likely to fail; prototype first.
- **Selection in the state machine** — today selection is a single position.
  The ladder makes it `{level, anchor, extent}`; intents (`relax`, `tighten`,
  `extend`, `closure`) and trace fixtures asserting the expected selection are
  the natural extension of the intents+traces design already in place.
- **The section rung is spec-loop evidence.** It is built on a
  proposed-schema field; if section-nav proves out, that experience belongs in
  `spec/proposals/` as an implementation argument for adoption
  ([spec-score-text.md](spec-score-text.md)).
- **Interaction with the full-bar invariant** — unentered positions ARE beat
  rests; ghost cells and the rest/note-rung skipping must agree with that
  model, not fight it.

## Not this

- **Not a renderer change.** Enclosures are the existing overlay pattern,
  grown; `expected.primitives.json` and every golden are untouched by design.
- **Not the `elements/` promotion** — the ladder lands in the workbench mount
  first ([core-editor-element-promotion.md](core-editor-element-promotion.md) keeps its
  own trigger).
- **Not discontiguous multi-select** (Ctrl+click collections) — the ladder is
  one contiguous selection at one level; overlap lives in the document's
  spanners, never in the selection.
- **Not the properties panels themselves** (part tuning/capo, score layout) —
  this doc only decides how they are *reached* (closures); their contents sit
  with [core-viewer-surface.md](core-viewer-surface.md) and the editor work that needs
  them.
