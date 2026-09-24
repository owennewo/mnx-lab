# MusicXML direction fidelity — timing, compounds and signs

> **Status: proposed, 2026-09-24.** MusicXML campaign item 33, from the
> [31-series render assessment](../../docs/musicxml-directions-assessment.md).
> Serves the implementation loop. [Campaign contract](../inprogress/core-campaign-musicxml.md).

## Agreement

1. **Oracle:** the five unchanged pinned `31a`, `31b`, `31c`, `31d`, `31f` MusicXML originals, their manifest descriptions, source-derived direction IDs, exact source-to-imported-MNX checks and retained complete Workbench/Studio captures. The [machine report](../../harness/reports/musicxml-directions-assessment.json) records 86 features, 357 source variants and 172 feature × shell × Notation verdicts. Lyric labels under notes are source annotations, not replacement direction marks.
2. **MNX verdict:** use existing tempo, dynamic, text-direction, rehearsal, ottava and segno carriers where they express the source. Published tempo has `bpm`, `value` and `location`, but no metric-relation or parentheses field; current `MnxDirection` has one text/glyph run without per-fragment styles, enclosures, line layout or attached spanners. A spec-loop decision must name `tempo-metric-relation`, `direction-compound-run` and any needed sign carrier before adding vocabulary. No standard MNX field or ad hoc `_x` is created by this item.
3. **Dependencies:** no new runtime dependency, notation library, second editor or touch surface. Work through the MusicXML importer and shared renderer used by both shells.
4. **Matrix:** regenerate converter support observations if import/export behavior changes. Current screenshots do not hand-upgrade support cells.
5. **Losslessness:** preserve all 84 source pitches/written values, all 101 lyric reference labels and unaffected directions while addressing selected failures. Unsupported source types get source-located diagnostics. Model/engine changes re-earn primitives and register moved goldens in [lab-verify](../inprogress/lab-verify.md); scenario verification remains human-owned.

## P0: place retained timed directions and above dynamics

In `31b`, `Lento` and a parenthesized quarter=56 carry distinct horizontal positions; the tempo imports without its positive offset and stacks below the text. In its second bar, a diminuendo imports with a start and final-barline end but draws no line. Its `8.1`-division start is also truncated to `8` by the importer's integer offset reader. In `31a` bars 4–5 and `31f`, `orient: above` survives on dynamics but the renderer draws those marks below. The `31d` boxed `molto f` and `meno f` show the same split above/below behavior when text and dynamics share a source direction.

Acceptance: keep rational decimal offsets exact through import, use MNX tempo `location` where sufficient, and draw a wedge whose end is the final barline. A minimal independently authored MNX above-dynamic probe must draw above, including an `f` combined with an above text direction. Reopen `31a`, `31b`, `31d` and `31f` through both desktop shells; check source-to-MNX positions, SVG geometry and complete scroll coverage. Preserve item 17's already-correct ordinary dynamics/hairpins. If a display request still cannot be represented, diagnose its source location instead of silently approximating it.

## P0: preserve successive and compound marks

`31c` keeps only the first tempo in bar 1 and drops both metric modulation relations. `31d` loses `Adagio` with long=100 because the importer skips words beside a metronome while the global pass reads only the first `direction-type`. Text and dynamic fragments in `31d` overprint or split vertically. In `31f`, raw text newlines reach MNX and SVG, but paint as one line; the preserved separator space, rectangle and middle alignment disappear. `31a` keeps only the first of four bar-1 rehearsal marks; `31d` loses the second `bis` text.

Acceptance: walk **all** direction-type children in source order, retaining distinguishable timing/attachment and fragment grouping. Assert multiple directions at one beat and multiple tempos in one measure. Draw `31f`'s p, space and three-line boxed text as one above-staff compound with a box around the requested lines; retain the no-space bold/italic contrast in `31d`. Render `31c`'s two metric relations and parentheses after a `tempo-metric-relation` carrier decision, while keeping the two already-correct dotted numeric marks intact. The first `molto` in `31d` omits `xml:space`: test grouping and font differences, but do not pin its exact gap. Model and importer tests should assert source order and unrelated note/lyric preservation; both editor captures should judge the ink.

## P1: support or diagnose direction signs and line types

`31a` loses coda, scordatura, SMuFL symbol, dashes, bracket, pedal line, harp/damp, accordion, string-mute, eyeglasses, percussion, staff-divide and principal-voice controls. `31d` repeats the missing coda/dashes cases. These controls differ in value and frequency; this item first requires an inventory of which have existing MNX or `_x.mnxLab` carriers, with an explicit source-located unsupported diagnostic for every remaining kind. Add bounded rendering support for coda, the source SMuFL glyph, dashes/bracket and pedal start/change/stop before considering specialist instrument symbols. Keep the latter visible as diagnosed gaps until a carrier and a meaningful product use case are established.

Acceptance: the original-file report must distinguish supported ink from each diagnosed omission. Minimal independent MNX probes test line start/stop and coda/symbol placement so importer loss cannot conceal a renderer defect. Re-import `31a` and `31d`, inspect warnings by source measure/direction and compare both shell captures; do not claim that a generic placeholder is correct rendering.

## P1: retain positioned-word styling in `32b`

[The seven-word current capture](../../docs/musicxml-notations-assessment.md) extends this direction item. All texts and above/below sides survive, but the source `default-x`/`default-y`, CSS-sized fonts, bold weight and red color are absent from imported MNX. Both SVGs print one 12.5px italic style. The last two below-staff texts run past the visible score card despite the checked scroll host. Preserve source placement and styling where a deliberate carrier exists; otherwise diagnose each omitted attribute at its direction. An independent text-direction probe and both original-file captures must check distinct vertical and horizontal positions, three sizes, bold versus normal, red versus default, barline association and full legibility. The standing [score-text spec proposal](low-priority/spec-score-text.md) informs the carrier decision; this is the measured MusicXML implementation case.

## Boundaries and existing ownership

`31a` references `nestedboxes.png`, absent from the pinned suite. Its image ink is blocked until the resource is available; a source-located missing-resource diagnostic remains testable. `31b`'s bold `Lento` is visibly correct but the importer stores it as a section label rather than a tempo word, so future edits/export must not rely on that classification. [Completed item 17](../inprogress/core-musicxml-dynamics.md) owns the already working ordinary dynamics and hairpin import. [Completed item 22](../complete/core-musicxml-render-gaps.md) covers ordinary meter/clef containment; [item 23](../complete/core-musicxml-write-gaps.md) covers Studio's editable XML version, not directions or GP fidelity. [Proposed item 32](core-musicxml-grace-fidelity.md) owns zero-time grace anchoring, not timed offsets. [The standing score-text spec proposal](low-priority/spec-score-text.md) concerns general placement and may inform the compound carrier; this item does not replace its upstream argument.

[Write assessment item 19](../inprogress/core-musicxml-write-assessment.md) still needs real create/inspect/change/remove, undo/redo and separate save/reopen tasks for these same feature IDs. No direct editor control is credited by this render assessment.
