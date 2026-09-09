# Performance compiler and bounded MIDI export

Implementation loop; player campaign item 5. `mnx-lab/audio` exports
`compilePerformance`, `serializePerformance`, `parsePerformance`, exact time helpers,
performance types and `exportMidi`. The former `mnxToAudioEvents` approximation is
retired. The [transport and native sink](player-transport.md) consume this result; the [player element](player-element.md) provides controls and written-score review.

`compilePerformance(document, passModel?)` returns `{ ok: true, performance }` or
`{ ok: false, diagnostics }`. It uses the existing traversal by default. Fatal
invalid-time/resource errors never return a partial performance. Unsupported sequence
items and missing kit sounds diagnose silence. The compiler is DOM-free.

## Identities and time

- `written[]` contains each performed written note (including silent grace/kit
  occurrences), with its note key, ordinal, clipped metric span, expanded span and
  sounding-event links. `sounding[]` contains voice attacks, linked back to written
  occurrences. Ties merge after traversal; tremolos have several attacks per written
  occurrence. A string re-strike may truncate a linked sounding span without erasing
  the written occurrence.
- `voices[]` adds explicit part index/optional part id, optional declared string and
  kit flag to version 1, before any performance evidence has been approved. The MIDI
  writer reads this metadata rather than parsing voice-id strings. Unassigned notes
  have independent logical voices; string numbers are declarations, not array indexes.
  Simultaneous conflicts on one string fall back independently and diagnose.
- Actual sequence spans determine bar lengths; an empty bar uses inherited meter.
  Authored spaces use their fraction arrays. Partial traversal bounds clip events and
  preserve written offsets. Nested tuplets multiply ratios recursively; a mismatch
  between child span and declared outer span diagnoses. The outer span determines
  where the following item starts.
- [Swing](player-time.md#swing) warps the metric axis before anything else reads a
  position, bar-locally and without changing bar length, so the transport, the MIDI
  writer and the cursor inherit the feel with no code of their own. A swung source
  segment carries a `scale`; a straight document emits none.
- [Timing conventions](player-time.md) remain the source for grace budgets and holds.
  Default grace is stealFollowing. Stealing requires an adjacent pitched/kit event
  in the same performed voice; a rest-only gap or unrelated jump cannot supply it.
  Fermata spans/releases resolve after stealing and before holds, so a following
  stealPrevious group does not inherit its neighbour's fermata. Make-time/fermata
  insertions combine score-wide, by maximum per resolved point/kind. Measure
  boundaries include closing fermatas and assign opening make-time to the next bar.
  Tempo uses written-state lookup on every visit, then maps marks after insertions;
  holds retain the preceding tempo. The source map splits metric spans at insertions.
- Tremolo attacks use `1 / 2^(marks+2)` whole-note spacing, scaled by enclosing
  tuplets; multi-note groups alternate their written children. A partial-measure
  return retains the original subdivision phase. The final attack clips to the span.
- Pitched notes use sounded MNX pitch directly; kit components resolve their named
  global sound's `midiNumber`. Velocity is 80. Expression curves remain item 8 work.

Exact fractions serialize as canonical decimal numerator/denominator strings. No
seconds or ticks enter `expected.performance.json`. The existing arithmetic budgets
apply, with 32 container levels, 100,000 compiler events/attacks and at most 16 tremolo
marks. These are resource limits, not alternate musical interpretations.

## Recursive address compatibility

The canonical walker descends recursively. A shallow `containerIndex` remains a
number for compatibility; deeper children carry the full index array. The key grammar
adds repeated `.c<n>` segments: `@m0.v0.e0.c1.c2.n0`. Zero/one-level keys are unchanged.
`containerPath`, `sameContainerIndex`, `eventAtContainer` and
`containerEventsWithPaths` keep lookup and equality consistent across editor, JSON,
reference and selection consumers. Nested layout is not implemented: it emits a
renderer diagnostic, with no invented child geometry. Existing engravings must remain
byte-identical through this migration.

## MIDI contract

`exportMidi(performance)` returns bytes, diagnostics and the channel allocation, or
`ok: false` with diagnostics and no bytes. It writes SMF type 1 with a conductor tempo
track and a track per sounding part, using PPQ 960. The format follows the
[MIDI Association SMF specification](https://midi.org/standard-midi-files); the
pitch-bend range is RPN 0, set to ±12 semitones.

Absolute start/end/curve boundaries round half-up at export only. Positive notes whose
rounded end does not exceed their start are omitted and diagnosed, even if their exact
duration is more than half a tick. Releases precede controller resets/setup and attacks
at equal ticks. Curves combine bend and vibrato, are sampled at MIDI ticks (bend) or
32 points per vibrato period, and diagnose collapsed distinct points and clipping.
A million MIDI events, 100,000 sampled ticks per bend segment, 100,000 samples per
vibrato, four-byte delta VLQs and 24-bit tempo values bound the writer. Out-of-range
file timing refuses export; pitches outside 0–127 are omitted with a diagnostic.

Channel 10 (index 9) is reserved for kits. Reserve one channel per melodic part,
then grant full independent allocation in part order when the remaining budget fits.
Declared strings own groups; independent fallback voices reuse channels only when
their spans do not overlap. A part denied its full grant keeps its reserved channel
and omits **all** independent curves, including fractional pitch, with diagnostics.
More than 15 melodic parts refuses the file. Browser compilation is unaffected.
A text meta event states that written identities, continuous curves and articulation/
timbre semantics do not survive this bounded export. MIDI is not the performance golden.

The test reader validates byte structure, tempo/RPN bytes, event ordering and note
counts. A writer and reader authored together are not an independent musical oracle;
item 9 remains necessary.

## Evidence and review

`performance: true` in scenario metadata opts into two generated files:
`expected.performance.json` and `expected.midi.json` (byte SHA-256, allocation and
loss/refusal diagnostics). `npm run update:primitives` regenerates both along with
engravings. `performanceHash` hashes their names and contents separately from the
frozen engraving hashes. New output never inherits an engraving approval.

The checker blocks absent files and an approved obligation whose flag was removed.
The harness queue calls a missing approval unseen and a changed approved hash stale;
older engraving provenance survives. The workbench follows the same opt-in/availability
rules and uses the updater's status demotion for changed approved output.

`node harness/verify/performance-review.mjs --output dist/review/performance.html`
builds the static review page and its `.receipt.json`; optional scenario ids narrow
it. It embeds every available engraving projection and the Bravura font, complete
written/sounding/voice/measure/tempo/source tables, diagnostics and regenerated MIDI
bytes matching the committed byte hash. It makes no network requests and grants no
approval. `/verify` presents the page before passing the receipt to the approval
writer. A changed receipt hash is refused; engraving-only approval cannot stamp a
performance hash. Performance-only approval preserves unrelated hashes and their
original date, recording `performanceAt` separately.

Mirrored opt-ins are enrolled through the owning sync script's `--performance-only`
mode, which reads committed mirrors without an upstream checkout. Normal spec sync
preserves opt-ins. The initial 32-scenario batch is registered in
[the verification ledger](../roadmap/inprogress/lab-verify.md#player-performance--2026-09-09).
These generated tables and MIDI verdicts await human review.
