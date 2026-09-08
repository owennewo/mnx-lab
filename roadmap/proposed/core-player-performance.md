# The performance compiler and the MIDI export

> **Status: implemented 2026-09-09; landing checks in progress.** Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 5. Needs items 1 and 3.
> None of it makes a sound, and it is where the player is won or lost.

## Agreement block (campaign contract)

- **Pure before audible (§1).** `src/audio/performance.ts`:
  `compilePerformance(doc, passModel): Performance`. Pure and Node-importable.
- **Rational time (§2).** Every position and duration is a `{ num, den }` fraction
  from item 3. Ticks appear only inside `audio/midiFile.ts`.
- **Identities (§3).** Two linked lists (decision 2): `written[]` — one entry per
  written note per **ordinal** it is performed at — and `sounding[]` — one per voice
  attack. A tie: two written entries, one sounding event, links both ways. A tremolo:
  one written entry, several sounding events. The cursor walks `written`; the sink
  plays `sounding`. Item 8 extends the latter with no-reattack transitions; stable IDs
  and links identify logical sound spans independently of physical source allocation.
- **Proof (§4) — the path owned.** `expected.performance.json` (item 3's format),
  **opt-in** per scenario via a meta flag, hashed as `performanceHash` in the
  verification record. This item makes the changes that make the golden real:
  `meta.schema.json` gains the flag and the hash; `verify-scenarios.mjs` treats a
  changed `performanceHash` as **stale**. An opt-in golden without its hash is
  **unseen performance evidence** in the attention queue even when engraving approval
  remains current; preserve that older approval and never infer performance approval
  from it. Missing opt-in output is blocked. The approval writer stamps the hash only
  after that evidence was actually presented; the `/verify` review page renders the
  written/sounding tables beside the engraving. `update:primitives` regenerates it.
  The batch registers in [lab-verify.md](../inprogress/lab-verify.md).
- **Dependencies (§5).** None; the MIDI writer is hand-rolled.
- **Reviewer gain (§7).** The tables: what a scenario *means*, bar by bar, in a form a
  reviewer reads. And a `.mid` download.

## The stages

1. **Measure positions.** Walk `entries` from item 1; each performed bar starts where
   the previous ended; `from`/`until` slice content by fraction.
2. **Event positions.** `model/durations.ts`; dots; **nested tuplets** scale by
   `outer/inner` recursively — which needs `noteWalk.ts` to descend more than one
   container level, so `NoteAddress.containerIndex` becomes a path and the
   positional-key grammar gains a repeated `.c<n>` segment. **That is an identity
   change**: `MnxTuplet.content` currently holds `MnxEvent[]`, so the recursive types,
   walker, address consumers in edit/JSON/layout, and reference resolution must migrate
   together. Retain the existing key spelling at zero and one container levels; append
   segments only for deeper paths. Test nested fixtures as well as the existing corpus,
   and require existing primitives/SVGs byte-identical. Unsupported nested layout still
   diagnoses rather than pretending a note has geometry.
3. **Grace, tremolo, fermata** per item 3's table, including the cross-part shifts
   `makeTime` and fermatas impose (compiled score-wide, not per voice).
4. **Ties**, merged **after** unrolling — `targetType: crossJump` only resolves on the
   performed order. Both written entries kept.
5. **Pitch.** `midiOf(note.pitch)`. Nothing else. Kit notes use `sound.midiNumber`
   when declared, else a diagnostic and silence.
6. **Velocity** fixed at 80; item 8 owns it.
7. **Voices.** Voice IDs include part identity and the declared string number,
   not an assumed contiguous `1..n`. An explicitly assigned valid string owns its voice;
   absent string assignments use independent pitch-only voices, with a diagnostic for
   string-specific techniques that cannot be honoured. Invalid assignments diagnose
   and use that fallback too; playback does not silently choose a fingering. A later
   attack on an occupied string releases the previous sound at that onset. Simultaneous
   conflicting attacks on one string diagnose and use independent fallback voices
   rather than dropping pitches. Unfretted parts use independent logical voices; the
   sink allocates physical sources without changing musical identity. Allocation and
   release decisions are pure compiler output, including `lv` truncation.

## MIDI — a bounded export

`audio/midiFile.ts` writes SMF type 1 and says what it cannot carry:

- **PPQ 960; absolute boundaries quantised** (round half up) at export — positions
  are exact until this line, so rounding error does not accumulate. Check the actual
  rounded boundaries: any positive note with `endTick <= startTick` is omitted with
  a diagnostic, regardless of its original duration (even 0.6 ticks can collapse).
  At equal ticks, release old notes before new attacks; order controller setup before
  attacks. Quantize curve boundaries consistently and diagnose lost distinct points.
- **Channel allocation.** 16 channels, 10 reserved for kits. Fretted parts request
  one channel per independently controlled voice group, including pitch-only
  fallback voices that overlap with independent bends. Preflight the whole document;
  reserve one channel per melodic part first, then grant full independent allocation
  to parts in document order where the remaining budget permits. Parts without a full
  grant keep one channel and **omit all independent pitch curves**, with a diagnostic;
  keep note pitches/timing/velocity and reset bend to centre. If even one channel per
  melodic part exceeds 15, fail export with an allocation diagnostic and produce no
  partial file. Browser playback is unaffected. Written identities do not survive;
  that is stated in the file's text meta event.
- **Bend range** set by RPN per channel to **±12 semitones**, so an octave slide fits;
  a curve beyond it is clipped with a diagnostic.
- Determinism: the harness pins a byte hash per opt-in scenario and round-trips
  through a small reader — **but a writer and reader authored together share their
  mistakes**, which is why item 9 exists and why its first experiment is scheduled as
  soon as a tool is chosen.

## Evidence lifecycle tests

Pin: existing engraving approval plus newly added performance output enters the unseen
queue; changed approved performance becomes stale; absent required output is blocked;
an engraving-only approval cannot stamp `performanceHash`; a performance approval
preserves existing unrelated evidence. Removing an opt-in flag must not silently erase
an approved performance obligation: the checker reports the mismatch for explicit
retirement. These rules also form item 10's unrolled-evidence precedent.

## Done bar

- Opt-in goldens for every tempo, repeat, tie, tuplet, grace and tremolo scenario
  (~25), queued and registered; the verify path handles them end to end.
- `mnxToAudio.ts` retired; `mnx-lab/audio` exports the compiler, time and writer.
- The nested-container identity test green over the corpus with no existing key
  changed.

## Implementation and review

The [compiler/API documentation](../../docs/player-performance.md) records the exact
stages, resource bounds, recursive key compatibility and bounded MIDI conventions.
32 scenarios opt in to rational performance tables and MIDI byte verdicts. Their
[new-evidence batch](../inprogress/lab-verify.md#player-performance--2026-09-09) is
registered; existing engraving keys/goldens and approval records are unchanged.
`voices[]` adds explicit allocation metadata to the previously unapproved v1 shape.
No audio dependency, transport, expression implementation or human approval is added.
