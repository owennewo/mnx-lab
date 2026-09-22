# MusicXML short durations — divisions must represent every written value

> **Status: built, 2026-09-22.** Campaign item 21.
> [MusicXML campaign](core-campaign-musicxml.md).

## Agreement before implementation

1. **Oracle:** MusicXML 4.0 XSD prohibits zero metric duration. Independent music21
   note tables compare exported durations with the input MNX; targeted rational timing
   assertions fail on old output. Grace notes remain un-timed, not zero-duration notes.
2. **MNX verdict:** existing note values and tuplets; no vocabulary change.
3. **Dependency budget:** none.
4. **Matrix:** regenerate after behavior changes; explain any moved evidence. The core
   layout goldens stay unchanged because converter output divisions do not affect them.
5. **Losslessness bar:** 64th/128th and dotted short events export positive exact durations,
   including inside tuplets and beside longer events. Existing reference byte outputs and
   round trips remain unchanged unless a fixture actually needed finer divisions.

Finite scope: make divisions account for the denominators of supported written durations
as well as tuplet ratios. Do not silently add support for previously unrecognized note
value names or change import policy for quantized source durations in this item.

## Result

Both regression cases fail with zero durations on the old exporter and pass after the
fix: a dotted 128th and plain 128ths in a representable triplet. XSD validity moves
336 → 340 of 344. Three external export comparisons improve from different to match;
the rest-gallery mismatch shrinks but still contains unsupported longer/shorter values.
No semantic verdict regresses; the converter matrix is unchanged.

A dotted-128th tuplet whose common unit is smaller than 128th exceeds the existing
`tupletUnits` normal-type vocabulary. That separate limitation was exposed while drafting
the test and is not represented as solved by this divisions fix. Zero-duration failures
in all four measured cases are gone; empty parts and rootless harmony remain XSD failures.
