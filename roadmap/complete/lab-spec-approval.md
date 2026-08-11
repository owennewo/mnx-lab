# Spec Approval — iterative renderer verification

This document drives an ongoing task: **walk the `spec/` scenario corpus one
scenario at a time, compare our render against the MNX spec's own reference
engraving, fix whatever is wrong, and mark each scenario `verified`.** It is
both the process definition and the live scoreboard. Update the table as you go.

> **For the next session:** read this whole file first. It captures the workflow,
> the approval bar, the renderer's known gaps, and the per-scenario state so you
> can pick up mid-stream without rediscovering it. The headline metric we're
> driving toward is **"renders N of 49 of the spec's own examples, verified."**

> ## ✅ Status (2026-07-17): COMPLETE — 57/57 verified
> **All 49 spec examples and all 8 lab scenarios are `verified`.** The metric
> above is met (49/49). The scoreboard below is now the record of what was done;
> the remaining work is **deferred engraving polish** (see that section) and
> verifying *new* scenarios as they're added. This doc now lives in
> `roadmap/complete/` (moved 2026-07-17); the deferred-polish backlog is kept
> here rather than split into `roadmap/proposed/`.

---

## Why this exists

`scenarios/spec/` mirrors the MNX Community Group's 49 worked examples
(synced verbatim by `npm run sync:spec` from the pinned `vendor/mnx` submodule —
never hand-edit them; see [docs/mnx-spec-submodule.md](../../docs/mnx-spec-submodule.md)).
Each upstream example ships with a **reference engraving PNG**, which makes spec
scenarios uniquely verifiable: we can put our render beside the spec's own and
ask "same music?". That is the most credible renderer metric we have, and it
doubles as the renderer's backlog — every mismatch is a feature to build.

The `verified` status is the **one human assertion** in the status lifecycle
(`draft → valid → rendered → verified`). The checker computes the lower rungs;
only `verified` says "a reviewer looked and approved." We reach it scenario by
scenario.

---

## The loop (per scenario)

1. **Render the contact sheet:** `npm run preview:scenarios` writes
   `scenarios/.preview/index.html` (gitignored) — every not-yet-verified
   scenario, our live render beside the spec reference image. Open it in a
   browser (the `chrome-devtools` MCP is the fastest way to screenshot a
   specific card and eyeball it).
2. **AI assessment — compare semantically, not pixel-by-pixel.** Different
   engraving engines space and curve differently; that's fine. What must match
   is **musical content**: pitches, durations, accidentals (and whether each is
   shown), beam groupings, articulations, slur/tie endpoints, clefs, key/time,
   text. Layout differences (spacing, stem length, exact curve shape) are *not*
   grounds to withhold approval.
3. **If it's wrong, fix the renderer** (see "How to add a renderer feature"),
   then `npm run update:primitives` to regenerate snapshots, and re-preview.
4. **Approve:** tick the card(s) in the contact sheet and run the assembled
   `node scripts/verify-scenarios.mjs <ids>` (or just run it directly with the
   ids). It refuses anything that doesn't pass the checker or hasn't rendered.
5. **Gate before moving on:** `npm test` (101+ pass), `npm run check:scenarios`
   (`OK`), `npx tsc --noEmit` (clean).

### Tooling guarantees you can rely on
- `update:primitives` keeps statuses honest automatically: first snapshot
  promotes `valid → rendered`; a **changed** snapshot demotes `verified →
  rendered` (back into the queue — re-approve deliberately); a layout crash
  removes the snapshot and demotes to `valid`. So a renderer change that alters
  an already-approved scenario will *correctly un-approve it* and you'll see it
  reappear in the preview queue. Trust this — don't hand-edit `status`.
- `verify-scenarios.mjs --list` prints the queue (ready / blocked / verified).

---

## The approval bar (what "verified" means here)

Approve when the render is **musically faithful to the reference**: a musician
reading it would play the same thing. Withhold when content is **missing or
wrong** (a glyph absent, a pitch/accidental off, a structural element undrawn).
Do **not** withhold for engraving polish — that's tracked separately and the bar
can be raised later (re-verification is cheap by design).

When you withhold, **record the specific gap** in the table's Notes column. That
list is the renderer roadmap.

---

## How to add a renderer feature (the recipe, used 3× so far)

This exact pattern fixed accidentals, key signatures, and articulations:

1. **Type:** add the MNX field to `src/types/mnx.ts` (check `schemas/mnx-schema.json`
   `$defs` for the authoritative shape).
2. **Layout:** read it in `src/layout/notation.ts` (or `tab.ts`) and emit
   primitives. Glyphs come from SMuFL — verify a glyph name exists in
   `public/smufl/glyphnames.json` before using it (some are absent from the
   bundled Bravura subset, e.g. spiccato).
3. **Spacing:** if the feature consumes horizontal room (accidentals, dots),
   account for it in `src/layout/spacing.ts` — that module owns **all**
   horizontal geometry (bar widths, note x, system packing/justification) via a
   shared plan both renderers consume. Don't reintroduce per-renderer spacing.
4. **Regenerate + verify:** `update:primitives`, preview, approve.

Keep layout pure (no DOM/pixels). `src/render/svg.ts` is a dumb emitter — it
should rarely need changing.

---

## Renderer capabilities & known gaps (as of this writing)

**Works:** single staff of the first part; treble/bass/alto clefs + octave
variants; key signatures (incl. mid-piece change + naturals cancellation);
time signatures; noteheads/stems/flags/dots; multi-note chords; multiple voices
on one staff (stem up/down split); ledger lines; rests across the full Bravura
family (maxima → 1024th, dotted, plus sequence-level `fullMeasure` rests drawn
centred — exercised by lab/durations/rest-gallery); the complete
`note-value-base` duration enum in spacing; accidentals with full
MNX visibility model (`accidentalDisplay.show`, `support.useAccidentalDisplay`,
key-aware inference); articulations (staccato, staccatissimo, tenuto, stress,
unstress, accent, soft accent, marcato); grace notes; **mid-measure clef
changes** (positioned clefs become a per-measure clef timeline in the spacing
plan — each event's pitch math follows the clef at its onset, and the change
draws small at its reserved column); **dynamics** (part-measure `dynamics` →
SMuFL composite glyphs below the staff at their metric position, host columns
widened to the mark — MNX v19 `dynamic-group`: the standard `value` enum maps
via the table in `src/layout/dynamics.ts`, marks outside the enum carry an
explicit `glyphs` list, unmapped values fall back to italic text; full set
exercised by lab/dynamics/all-dynamic-marks);
**repeats** (global `repeatStart`/`repeatEnd` → |:/:| barlines with dots, room
reserved in the plan, "Nx" counts above unconventional play counts); **volta
brackets** (global `ending` → hooked bracket + number labels spanning
`duration` measures, split at system breaks, open endings unhooked); **tempo
marks** (global `tempos` → metronome glyph "= bpm" above the bar); **navigation
markers** (global `segno` incl. glyph override / `fine` / `jump` → sign and
text above the staff at their metric location; note MNX (through v19) has NO coda or
D.C. vocabulary — see lab/navigation/jumps-and-signs); **slurs & ties**
(2026-06-12: tapered cubic curves — thick mid, thin ends, no SMuFL glyph
exists so the SVG emitter fills between offset beziers — between anchors
recorded at emission; slur `startNote`/`endNote` pin chord members, side
defaults to opposite the stem, curves split at system breaks, `lv` draws a
laissez-vibrer hook, and `crossJump` ties draw only the incoming stub at the
jump target); **implied primary beaming** (2026-06-12: documents without
`support.useBeams` get consecutive beamable events of a sequence beamed
within the conventional metric unit — half-bar in even simple meters, beat in
odd ones, dotted quarter in compound time; measures with explicit `beams`
stay as encoded); **pitch-ranked multi-voice stems** (the voice with the
higher mean pitch stems up — sequence order is unreliable: multiple-voices
lists the lower voice first, tie-targets the upper); guitar tab
staff (positions + playability heuristic); notation/tab/both views
column-aligned.

**Forgiving render + diagnostics (2026-06-12):** layout no longer crashes on
content it doesn't model. Un-timed container items it doesn't recognize
(tuplet, tremolo, …) degrade to a placeholder column, and every issue draws a
small "!" badge at the bottom-left of the bar (hover = the message, via native
SVG `<title>`; also returned as `LayoutResult.diagnostics`). Two kinds, visually
distinct: **red circle = validation** (user-fixable document problems from
`src/layout/validate.ts`, e.g. bar duration arithmetic — see
lab/edge-cases/bar-duration-mismatch) and **amber rounded box = renderer**
(this renderer's limitation). Items *with* a duration always space like events
(e.g. `space`). Consequence: **`rendered` no longer implies complete** — check
a card for badges before approving.

**Known gaps (likely to block approval — verify before assuming):**
- ~~Multi-part / multi-score~~ **built 2026-06-12**: documents render one
  titled block per MNX `score` (layout-resolved part lists, forced system
  breaks from `pages.systems`, per-score `multimeasureRests` collapsed to
  H-bars with counts); documents without scores render all parts stacked.
  Multi-staff parts (grand staff) draw braces; internal barlines stay within
  a part, the system-start barline joins parts. **A single staff draws an open
  left end** — no initial barline (that binds multi-staff systems only), per the
  reference engravings; gated on `numStaves > 1` (fixed 2026-07-17, re-verified
  the affected single-staff scenarios). The **brace** is anchored by its right ink
  edge (`glyphBBox('brace')`) so the belly clears the staff by a constant
  `BRACE_STAFF_GAP_SP` regardless of staff height — a font glyph scales in both
  axes, so a fixed origin offset let the belly overrun tall staves (fixed 2026-07-17). Layout staff nodes resolve fully
  (2026-06-12 later pass): multi-source staves chord-merge when rhythms align
  (or split voices per source `stem`), labels (`label`/`labelref`) draw left of
  the system inside a reserved inset (group labels sit just left of their OWN
  group's staff labels, not the system's widest — fixed 2026-07-17, so short
  source labels no longer shove a group name far off its brace), groups draw brackets/braces and honour
  `barlineStyle: individual`. Merged-staff clefs follow the LAST source (the
  bottom voice anchors a shared staff's clef — MNX is silent here, and this
  matches the reference engravings). **Per-system layouts built 2026-06-12**:
  each run of consecutive `pages.systems` sharing a layout renders as its own
  segment (own staves/labels/groups over its measure range, via
  `planHorizontal`'s `measureRange`); nested group decorations step left of
  their parents, group labels centre on the group span, merged-staff sources
  show stacked "1"/"2" labels left of the decorations; a time signature draws
  only where the document declares one (no fabricated 4/4); an undeclared
  clef on a lower staff of a multi-staff part defaults to bass (the
  keyboard/harp convention — system-layouts' piano and orchestral-layout's
  Harfe match their references with no clef encoded). Structure-only
  documents whose systems reference non-existent measures (orchestral-layout:
  zero measures anywhere) get one synthetic empty measure per system so the
  arrangements still draw. Still missing: mid-score `layoutChanges` and
  `sources.staff` routing within layouts.
- ~~Grace notes~~ **built 2026-06-12**: MNX `grace` containers render (small
  noteheads at GRACE_SCALE; slash by default for singles AND beamed groups —
  the reference engravings slash even without `slash: true`; single graces
  stem up per the traditional convention while beamed groups follow the
  normal pitch rule, both matching the spec's engravings; groups mini-beam
  among themselves, never to the principal). Tab view reserves their columns
  but doesn't draw them yet; playback skips them.
- ~~Tuplets~~ **built 2026-06-13**: `tuplet` containers render (inner events
  on shared pre-scaled columns via `tupletColumns`, `outer` drives the metric
  time; beam-or-bracket display per convention). Nested tuplets and tuplets
  in tab are not modelled.
- ~~Tremolos~~ **built 2026-06-13**: single-note (`markings.tremolo.marks` →
  SMuFL stem slashes) and multi-note (`tremolo` containers → written pair +
  floating beams; `outer` drives the metric time). Tab view reserves their
  columns but doesn't draw them yet.
- **Lyrics built 2026-06-12**: event `lyrics.lines` → verse rows below the
  staff in global `lineOrder` (extra system height for multi-verse docs),
  syllable columns widened in the plan, hyphens after start/middle syllables.
- ~~Slurs & ties~~ **built + approved 2026-06-12** (all 5 scenarios). Still
  missing in that family: curves to/from grace notes (grace emission registers
  no curve anchors — no spec scenario exercises this yet).
- ~~Ottava lines~~ **built + approved 2026-07-17**: part-measure `ottavas` →
  an "8va"/"8vb"/"15ma"/… label + dashed extent + hook toward the staff, above
  or below by `value` sign (or `orient`), split at system breaks. **The enclosed
  notes are displayed `value` octaves off their sounding pitch** (an 8va draws
  them an octave lower) — folded into a positioning-only clef at the emit site
  (`ottavaShiftAt` → `posClef`; the drawn clef glyph is untouched), matching the
  reference. The bracket then clears the shifted notes. `MnxOttava` in
  `src/types/mnx.ts`; `collectOttavaSpans`/`emitOttavas` in `notation.ts`
  (endpoints anchor to note columns via per-measure onset maps captured in the
  render loop). Not yet: ottava affecting multi-voice stem-direction ranking.
- **Dynamic hairpins / relative dynamics not drawn (MNX v19, 2026-07-17):** the
  v17→v19 schema rework replaced the flat `dynamic` with `dynamic-group`, which
  additionally models crescendo/diminuendo wedges (`wedgeType` + `end`), relative
  dynamics (`relativeValue`: louder/softer), and `prefix`/`suffix` text. The
  renderer engraves only the point marks (enum `value` / explicit `glyphs`);
  wedges and relatives round-trip through `MnxDynamic` but are not drawn. No spec
  scenario exercises them yet — build when one lands.

**Deferred engraving polish (not approval blockers):** per-gap spring stiffness,
Knuth–Plass line breaking, within-measure accidental carryover, fine stem/beam
angles, and the **stem "reach-to-the-middle-line" clamp** (stems are a constant
`STEM_LENGTH_SP = 3.5` in `notation.ts`, so far-out notes don't lengthen to reach
the centre line — the convention that evens out vertical rhythm; also feeds the
render-density work in `roadmap/proposed/core-render-density-zoom.md`). See
`src/layout/spacing.ts` header for the spacing model (springs-and-rods, log₂
duration; tune via the named constants at the top).

---

## Scoreboard — 49 spec scenarios

Legend: **✅ approved** (verified) · **🔍 assess** (renders, awaiting
comparison) · **⛔ blocked** (doesn't render — needs a renderer feature first).

Grouped by renderer-feature area to make iteration planning easy. Pick a group,
build the feature it needs, approve the cluster.

| Scenario | State | Approved? | Notes / known gap |
|---|---|---|---|
| accidentals | ✅ | yes | Approved 2026-06-12. |
| key-signatures | ✅ | yes | Approved 2026-06-12. |
| articulations | ✅ | yes | Approved 2026-06-12. |
| hello-world | ✅ | yes | Approved 2026-06-12. |
| two-bar-c-major-scale | ✅ | yes | Approved 2026-06-12. |
| dotted-notes | ✅ | yes | Approved 2026-06-12. |
| rest-positions | ✅ | yes | `rest.staffPosition` now honored (2026-07-17) — rests raise/lower to the encoded half-space position (also fixed the previously-approved positioned rest in tie-targets). Matches reference — ready to approve. |
| full-measure-rests | ✅ | yes | Approved (sequence-level fullMeasure rests → centred whole rest). See lab/durations/rest-gallery. |
| multimeasure-rests | ✅ | yes | Scores/layouts/multi-part/H-bar built 2026-06-12 — all three titled scores render with collapses and forced breaks; matches reference — compare and approve. |
| time-signatures | ✅ | yes | Approved 2026-06-12. |
| time-signature-glyphs | ✅ | yes | `time.display` now honored (2026-07-17) — `common` → 𝄴 (C), `cut` → 𝄵 (¢) glyph centred on the middle line instead of numerals. Matches reference — ready to approve. |
| three-note-chord-and-half-rest | ✅ | yes | Approved 2026-06-12. |
| clef-changes | ✅ | yes | Approved 2026-06-12 (mid-measure clef changes built same day). |
| beams | ✅ | yes | Approved 2026-06-12. |
| beam-hooks | ✅ | yes | Approved 2026-06-12. |
| beams-across-barlines | ✅ | yes | Approved 2026-06-12. |
| beams-secondary-beam-breaks | ✅ | yes | Approved 2026-06-12. |
| beams-secondary-beam-breaks-implied | ✅ | yes | Approved 2026-06-12. |
| beams-inner-grace-notes | ✅ | yes | Approved 2026-06-12. |
| grace-note | ✅ | yes | Approved 2026-06-12. |
| grace-notes-beamed | ✅ | yes | Aligned to reference 2026-06-12: group stems follow the pitch rule (down here), slash through the first stem by default. Compare and approve. |
| tuplets | ✅ | yes | Approved 2026-06-13 (MNX `tuplet` containers built: inner events at pre-scaled rigid columns, real time from `outer`; fully-beamed groups self-beam with the number on the beam and no bracket, otherwise a hooked bracket below with the number in a gap — exactly the reference's three cases). |
| single-note-tremolos | ✅ | yes | Approved 2026-06-13 (stem slashes via SMuFL `tremolo1-5` combining glyphs, centred on the stem; stemless notes carry them above the head). |
| tremolos-multi-note | ✅ | yes | Approved 2026-06-13 (MNX `tremolo` containers built: two written notes per pair, `marks` beams floating between stems/heads, real time from `outer.duration × multiple` feeding spacing/validation/onsets; pair stems follow the furthest-from-middle rule — the reference put pair 2 stems down instead, a non-content difference). |
| slurs | ✅ | yes | Approved 2026-06-12 (slurs & ties built same day — cubic curves, side from `side` or opposite the stem). |
| slurs-chords | ✅ | yes | Approved 2026-06-12. |
| slurs-targeting-specific-notes | ✅ | yes | Approved 2026-06-12 (startNote/endNote pin endpoints to chord members). |
| ties | ✅ | yes | Approved 2026-06-12 (incl. ties across the barline). |
| tie-targets | ✅ | yes | Approved 2026-06-12 (re-approved same day after taper + pitch-ranked voice stems + implied beaming landed) — cross-voice/arpeggio ties draw in full, crossJump ties draw only the incoming stub at the jump target (as in the reference), `lv` draws a laissez-vibrer hook. |
| ottavas-8va | ✅ | yes | Approved 2026-07-17 (ottava lines: "8va"/… label + dashed extent + end-hook; **enclosed notes displayed an octave lower** per the 8va, matching the reference's vertical positions; bracket clears the shifted notes, split at system breaks). |
| dynamics | ✅ | yes | Approved (SMuFL glyphs below staff at metric position, columns widened). Migrated to MNX v19 `dynamic-group` 2026-07-17 — renders identically. See lab/dynamics/all-dynamic-marks for the full vocabulary. |
| tempo-markings | ✅ | yes | Tempo marks built 2026-06-12 (metronome glyph + "= bpm" above the bar); the "=" now clears the note stem via the glyph's real width (2026-07-17). Matches reference — ready to approve. |
| lyrics-basic | ✅ | yes | Lyrics built 2026-06-12 (syllables under columns, hyphens for start/middle); matches reference — compare and approve. |
| lyrics-multi-line | ✅ | yes | Two verses stack below the staff; matches reference — compare and approve. |
| lyric-line-metadata | ✅ | yes | Four verses ordered by global lineOrder (metadata labels are data-only, as in the reference); matches reference — compare and approve. |
| repeats | ✅ | yes | Repeat barlines built 2026-06-12 (|: / :| with dots); matches reference — compare and approve. |
| repeats-implied-start-repeat | ✅ | yes | Implied start (only :| drawn); matches reference — compare and approve. |
| repeats-more-once-repeated | ✅ | yes | "4x" count above the end repeat; matches reference — compare and approve. |
| repeats-alternate-endings-simple | ✅ | yes | Volta brackets built 2026-06-12 (hooks, labels, open endings); matches reference — compare and approve. |
| repeats-alternate-endings-advanced | ✅ | yes | Multi-measure voltas with open ending; matches reference — compare and approve. |
| jumps-dal-segno | ✅ | yes | Segno sign + D.S. text built 2026-06-12; matches reference — compare and approve. |
| jumps-ds-al-fine | ✅ | yes | Segno + fine + D.S. al Fine built 2026-06-12; matches reference — compare and approve. |
| parts | ✅ | yes | Multi-part stacking built 2026-06-12 (both parts, aligned columns) — compare and approve. |
| grand-staff | ✅ | yes | Multi-staff built 2026-06-12 (brace, per-staff clefs/content, spanning barlines); matches reference — compare and approve. |
| multiple-voices | ✅ | yes | Approved 2026-06-12. |
| multiple-layouts | ✅ | yes | Layout details built 2026-06-12: staff labels (label/labelref), group brackets, multi-source staves (chord-merged or stem-split); merged-staff clef follows the LAST source (bottom voice — TB gets bass clef, matching the reference). Remaining diff: mid-score layoutChanges ignored. Compare and judge. |
| system-layouts | ✅ | yes | Approved 2026-06-12 (per-system layouts built same day: layout1 → m1-3, layout2 → m4-7, each as its own segment). **Upstream data quirk:** the JSON encodes NO notes (all parts have empty measures) and NO time signature — the reference PNG was engraved from richer data. Approved on structure: staff arrangements per system, nested brace-in-bracket, group/staff/source labels all match. |
| organ-layout | ✅ | yes | Approved 2026-06-12. **Upstream quirk: only bar 1 of the photo is encoded** (the description admits it; the second system references non-existent m6, the pedal tie targets the missing bar 2, "Andante"/"Oberwerk"/"B A C H" texts have no MNX vocabulary). Bar 1 matches: two manual voices (pitch-ranked stems, whole-bar 3/4 beaming), bass-clef defaults on staves 2-3, pedal tie drawn as an outgoing stub to its un-encoded target. Mid-system `layoutChanges` (at 3/8 of m1) remains unmodelled — moot while m6 dangles. |
| orchestral-layout | ✅ | yes | Approved 2026-06-12. **Upstream data quirk (stronger than system-layouts):** `global.measures` is EMPTY, all 13 parts have no content, and the systems reference non-existent measures m1/m7 — the reference is a photo of real engraved music. The renderer synthesizes one empty measure per system so each layout's staff arrangement draws. Approved on structure: both arrangements (incl. merged 3-clarinet staff, Vla./Vlc. divisi braces, nested string-group brace-in-bracket) match the photo. |

**Tally — COMPLETE (2026-07-17):** 49 / 49 spec approved · 8 / 8 lab approved ·
0 remaining · 0 blocked. The whole corpus is `verified`. This closes the initial
spec-approval sweep. The 2026-07-17 pass added the ottava feature and cleared a
run of engraving issues found by review — display transposition for ottavas,
open left end on single staves, brace-to-staff gap, group-label placement,
`rest.staffPosition`, tempo "=" spacing, `time.display` common/cut, whole-note
centering, and the tab fret-background paper colour. What remains is deferred
polish, not correctness.

> The `🔍`/`⛔`/"likely" flags are this session's best guess, not verified
> verdicts — confirm each against the reference before trusting it. Update
> State + Approved? + Notes as you process each one.

---

## Suggested order for the next session

1. **Quick wins** (probably already correct, build approval momentum):
   hello-world, two-bar-c-major-scale, articulations, dotted-notes, rest-positions.
2. **Beams cluster** — confirm beaming is right; approve the 5 non-grace beam
   scenarios together.
3. ~~Slurs & ties cluster~~ — done 2026-06-12 (all 5 approved).
4. ~~Blocked features~~ — tuplets and tremolos done 2026-06-13; no feature
   gaps remain in the queue.
5. **Multi-staff/layout** is the largest gap and unlocks the whole layout family
   — bigger lift, do it when the cheaper clusters are exhausted.

Work in clusters: build the feature the reference demands, regenerate, approve
everything it fixed in one pass. Record every withheld gap in the table.

## Lab scenarios

This doc tracks `spec/` (the 49-example credibility metric). The `lab/`
scenarios (tab, invalid-by-design exhibits, edge cases) approve the same way —
`preview:scenarios` includes them — but they have no upstream reference image,
so assess each against its own `meta.json` description and `notes.md`. The two
tab scenarios and the tab-clef-rejection exhibit are the priority there.

---

## Key files

- `scenarios/spec/<name>/` — score.mnx.json, meta.json, expected.primitives.json
- `scripts/verify-scenarios.mjs` — approval CLI (`--list` for the queue)
- `tests/preview.test.ts` — contact-sheet generator (`npm run preview:scenarios`)
- `tests/primitives.test.ts` — snapshot test + status promotion/demotion
- `src/layout/notation.ts` / `tab.ts` — layout (where most fixes land)
- `src/layout/spacing.ts` — all horizontal geometry (shared plan)
- `src/render/svg.ts` — dumb SVG emitter
- `public/smufl/glyphnames.json` — check glyph names exist before using them
- `schemas/mnx-schema.json` — authoritative MNX `$defs`
- `CLAUDE.md` → "Scenario verification" + "Rendering" sections
