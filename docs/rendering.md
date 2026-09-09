<!-- Split out of CLAUDE.md; CLAUDE.md links here and keeps the rules that
     must hold in every session. Paths in prose are repo-root-relative. -->

# Rendering (custom SMuFL/SVG engine)

Pipeline: layout → primitives → SVG. `src/engine/layout/{notation,tab}.ts` are pure
functions emitting staff-space primitives; `src/engine/render/svg.ts` is the dumb
emitter. **All horizontal spacing** lives in `src/engine/layout/spacing.ts` (springs-
and-rods; tune the named knobs, never per-renderer grid math) — both layouts consume one
plan so notation and tab stay column-aligned. The `both` view is **one native system**:
`layoutNotation({includeTabStaves: true})` (seam: `src/engine/layout/bothSystem.ts`)
draws each tab-bearing part's tab staff inside the same system walk — shared barlines,
interleaved multi-system wrap, columns aligned by shared plan slots. Tab-staff emission
(lines/clef/timesig/frets) lives ONCE in `src/engine/layout/tabStaff.ts`, used by both
the standalone tab layout and the native staff — extend it there, never fork it. See
[roadmap/complete/core-both-view-single-system.md](../roadmap/complete/core-both-view-single-system.md). Tuplets and grace notes draw on tab
too: containers are walked from `spacing.ts`'s own column widths so both staves stay in
column, grace digits are small (0.6), and a tuplet bracket is drawn **once per system** —
the standalone tab view draws its own, the `both` view lets the notation staff carry it
(`showTupletBrackets`). Fret/string assignment uses
the derivation ladder in `src/engine/tab/guitarPositions.ts` (MNX pitch is
sounding): an annotated `_x.mnxLab.string` derives its fret against the declared
`strings[]` + capo (a stored `fret` is validation-only — a mismatch renders the
derived fret plus a red badge), bare notes get the lowest-playable-fret
assignment, and unplayable notes draw nothing plus a red `scope: 'tab'` badge —
never a silent clamp. **No instrument is assumed**: absent `strings[]` means no
fingerboard (the shim materializes standard into older tab documents); a viewer
override (`TabSetup`) may supply strings/capo as presentation. Layouts render **forgivingly**:
unsupported content degrades to a placeholder and per-measure "!" badges
(`src/engine/layout/diagnostics.ts`) — red = user-fixable error, blue = warning, amber =
renderer gap. `ValidationIssue.scope: 'tab'` marks fingerboard-only constraints (the
notation renderer drops them; severity matters — a warning must not read as "you made a
mistake", and the schema validators must never see these). Everything renders into
shadow DOM. Do **not** reintroduce VexFlow or any notation library. The note↔JSON
cross-highlight depends on `model/noteKeys.ts` and `model/jsonView.ts` mirroring the
same traversal — keep them in lockstep.


Score display controls enter each layout as `display: DisplayOptions` and
are normalized in `src/engine/displayOptions.ts`. Lyrics are filtered before
horizontal measurement and row allocation; hiding clefs also hides key signatures,
including changes and cancellations. Hidden clefs/key signatures/time signatures lose
their prefix slots while the effective pitch/rhythm state remains unchanged.
Part-name gutters may differ between the first and subsequent systems, and
`PackingInput` carries both widths so the density ladder uses the same breaks.

For explicit display options, standalone Tab composes the visible, known-string
part/staff sources of each score job with one shared horizontal plan. The staff
emitter remains `tabStaff.ts`; per-staff ink bounds determine vertical stacking.
Unknown instruments are not inferred. Both uses the existing native system walk
and draws lyrics on notation only. Omitted options preserve the historical
first-part Tab path and the corpus's byte-identical default output. Public
bindings and the workbench's explicit defaults are documented in
[core-viewer-surface.md](core-viewer-surface.md#score-display-preferences).

Section headings, the swing marking and capo advice share the measure-start tempo
anchor, including when no tempo is printed. Section/rehearsal pairs stay together;
a standalone rehearsal mark retains its barline inset. Tuning letters stay beside
the strings.

`measureHeadingX` places that shared anchor, and what it leads depends on what the
bar actually draws. A time signature: lead its centre, since the numerals are the
widest thing in the prefix. A clef or key signature: lead the content, which is
just past them. **Nothing at all** — the prefix hidden by `display`, or simply
absent as in every mid-piece bar — lead the **first onset**. That last arm is the
one that used to be wrong: it led `contentStartX`, which is the start of the
stretched leading spring rather than the first ink, so the mark floated in the
empty left of the bar, and where the spring was short it crossed the barline and
read as belonging to the bar before. `m.x` is a floor, never a placement: a
heading mark cannot precede its own barline whatever the geometry.
`harness/conformance/heading-marks.test.ts` asserts both arms over the corpus
under every combination of the two display switches.

When a system opens with a repeat and no visible clef or signature, the repeat
starts at the staff's left edge and replaces the separate system-start line.
Packing and placement both omit the empty prefix padding.

At a forward repeat, the shared section/tempo/capo heading anchor is the music
content start, clearing the complete repeat cluster including its dots.

Inferred beams use render positions (measure, staff, voice and event), so an event
needs no authored `id` to beam. Explicit MNX beam references still resolve through
authored IDs before joining that same positional map. `support.useBeams: true`
and measures with explicit beam groups retain their encoded behavior. Rendering
never writes IDs back into the document; reference-creating editor operations mint
them when needed. The initial correction's two engraving changes are registered in
[the verification ledger](../roadmap/inprogress/lab-verify.md#beaming-events-without-ids-2026-09-08).

The paired notation-to-tab gap has a 3sp line-to-line minimum and keeps 2sp
clear between content on either side (one space tighter than independent
staves). The existing per-system ink measurement still expands the gap for low
notes, downward stems, lyrics, capo advice and other markings. All measures in
a system share the resulting staff position. Gaps to other instruments and
between systems retain their existing clearance.
The affected Both-view engravings are recorded in the
[verification ledger](../roadmap/inprogress/lab-verify.md#tighter-paired-notationtab-spacing-2026-09-08).

`DisplayOptions.clearance` coordinates discretionary whitespace on a nine-level
0–4 scale. Level 2 preserves those historical values and all default goldens;
0 is the tightest collision-safe layout and 4 is deliberately generous. The
policy covers notation/tab and independent staff gaps, inter-system gaps,
horizontal and vertical score margins, air after clef/signature groups, and
bar-boundary padding. It does not resize glyphs, change staff-line spacing, or
scale rhythmic springs. Every relationship has its own anchors so paired
staves remain paired and independent systems remain distinct. An explicitly
supplied legacy `densityPad` overrides the clearance policy wholesale.

## The swing marking

`emitSwingMark` in `src/engine/layout/scoreText.ts` draws `_x.mnxLab.swing` in
the tempo band, above the metronome mark, on **every** staff kind — notation,
standalone tab and the `both` walk all call it, because a feel describes the bar
and not a notation staff.

A feel is a rhythmic equation, so the mark draws one rather than naming it: the
written pair, an `=`, and the realisation the ratio implies, under a tuplet
bracket when the realisation needs one. The pair spans two units and is
redivided into `first + second` parts, so the parts are notatable exactly when
that total is **3** (a triplet — the parts are units, bracketed `3`) or **4**
(dyadic — the parts are half-units, and three of them is a dotted unit). 2:1 on
the eighth therefore draws `♪♪ = ⌐3¬ ♩♪`, which is what Guitar Pro prints; 3:1
draws a dotted eighth and a sixteenth with no bracket. A ratio with no rhythmic
spelling (5:3 is a real feel) prints its ratio as words instead of a wrong
rhythm, and a declaration's own `text` overrides the equation entirely.

It prints only where the feel **changes** — `resolveSwingTimeline` in
`src/model/swing.ts` makes that decision once and both layouts read it, so the
engraver and the performance compiler cannot disagree about where a feel starts.
A bar restating what it inherited draws nothing, which is why a Guitar Pro
import that stamps all 72 bars still engraves the marking once. A cancellation
(`[1, 1]`) is still a marking: it prints `Straight`.

Known polish: the written pair is drawn as two adjacent `met*` glyphs rather
than a beamed pair — SMuFL has no beamed-pair glyph and faking the beam off
glyph bounding boxes is not worth the fragility.

## Beam geometry

A beamed group's primary beam is placed by one shared rule, `placeBeamLine` in
`src/engine/layout/notation.ts`, used by principal, grace and tuplet beams alike
([roadmap/complete/core-beam-geometry.md](../roadmap/complete/core-beam-geometry.md)):
every stem's ideal tip is the normal length (`STEM_LENGTH_SP`, one octave) from its
head; the slant (`beamSlant`) is **flat** when the outer heads match, when the heads form a
repeating pattern, or when the head nearest the beam is an inner one, and otherwise rises
`BEAM_SLANT_PER_STEP_SP` (a quarter space) per staff step of the outer interval, capped at
`BEAM_MAX_SLANT_SP` (0.75); the stem
that would come out **shortest** is the anchor and lands on `BEAMED_STEM_MIN_SP` (2.5,
whatever the beam count — `BEAMED_STEM_MIN_STEP_SP` is 0) so every other stem grows from
there rather than the shortest being pushed out to the octave; and the beam then nudges
**outward only** until it sits
on, straddles or hangs from a staff line instead of floating mid-space (at most
1 − 2 × the shared half-thickness, about 0.37sp; a beam clear of the staff is left
alone). Flagged stems are untouched. `display.beams: 'flat'` sets the slant cap to zero —
a viewer's house-style choice, never a document field and never taught to the assist loop.
Multi-note tremolos are not beamed groups: their stems are flagged stems of normal
length with the tremolo bars floating between them.


## Performed-order presentation

The [unrolled engraving](player-unrolled.md) adds optional performed entries to
the shared horizontal plan. Written measure indexes remain document addresses;
plan indexes address occurrence geometry. Its SVG source IDs and JSON-line
mapping carry both identities. Omission is the byte-identical written path.
