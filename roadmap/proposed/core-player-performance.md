# The performance compiler and the MIDI export

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 5. Needs items 1 and 3.
> None of it makes a sound, and it is where the player is won or lost.

## Agreement block (campaign contract)

- **Pure before audible (§1).** `src/audio/performance.ts`:
  `compilePerformance(doc, passModel): Performance`. Node-only.
- **Rational time (§2).** Every position and duration is a `{ num, den }` fraction
  from item 3. Ticks appear only inside `audio/midiFile.ts`.
- **Identities (§3).** Two linked lists (decision 2): `written[]` — one entry per
  written note per **ordinal** it is performed at — and `sounding[]` — one per voice
  attack. A tie: two written entries, one sounding event, links both ways. A tremolo:
  one written entry, several sounding events. The cursor walks `written`; the sink
  plays `sounding`.
- **Proof (§4) — the path owned.** `expected.performance.json` (item 3's format),
  **opt-in** per scenario via a meta flag, hashed as `performanceHash` in the
  verification record. This item makes the changes that make the golden real:
  `meta.schema.json` gains the flag and the hash; `verify-scenarios.mjs` treats a
  changed `performanceHash` as **stale** (an absent one is grandfathered, like
  `bothHash`); the approval writer stamps it; the `/verify` review page renders the
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
   change** and gets its own conformance test over the corpus before anything else
   in this item lands; keys without nesting stay byte-identical.
3. **Grace, tremolo, fermata** per item 3's table, including the cross-part shifts
   `makeTime` and fermatas impose (compiled score-wide, not per voice).
4. **Ties**, merged **after** unrolling — `targetType: crossJump` only resolves on the
   performed order. Both written entries kept.
5. **Pitch.** `midiOf(note.pitch)`. Nothing else. Kit notes use `sound.midiNumber`
   when declared, else a diagnostic and silence.
6. **Velocity** fixed at 80; item 8 owns it.
7. **Voices.** A fretted part (declares `strings[]`) gets voices `string:1..n`; a
   sounding event on string 3 names voice 3. Unfretted parts get a pool the sink
   allocates.

## MIDI — a bounded export

`audio/midiFile.ts` writes SMF type 1 and says what it cannot carry:

- **PPQ 960; absolute boundaries quantised** (round half up) at export — positions
  are exact until this line, so no drift. Anything under half a tick (a 4096th is
  0.94 ticks) is reported in the writer's diagnostics, not silently merged.
- **Channel allocation.** 16 channels, 10 reserved for kits. Fretted parts request
  one channel per string in part order; when the request exceeds 15, later parts
  **fall back to one channel per part** with a diagnostic naming which. Written
  identities do not survive; that is stated in the file's text meta event.
- **Bend range** set by RPN per channel to **±12 semitones**, so an octave slide fits;
  a curve beyond it is clipped with a diagnostic.
- Determinism: the harness pins a byte hash per opt-in scenario and round-trips
  through a small reader — **but a writer and reader authored together share their
  mistakes**, which is why item 9 exists and why its first experiment is scheduled as
  soon as a tool is chosen.

## Done bar

- Opt-in goldens for every tempo, repeat, tie, tuplet, grace and tremolo scenario
  (~25), queued and registered; the verify path handles them end to end.
- `mnxToAudio.ts` retired; `mnx-lab/audio` exports the compiler, time and writer.
- The nested-container identity test green over the corpus with no existing key
  changed.
