# The performance timeline — the compiler, its golden, and the MIDI file

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 4. Needs item 1. This is
> where an excellent player is won or lost, and none of it makes a sound.

## Agreement block (campaign contract)

- **Pure before audible (§1).** `src/audio/performance.ts`:
  `compilePerformance(doc, traversal): Performance`. Node-importable, no Tone, no DOM.
- **Ticks (§2).** PPQ **960** (divisible by 3, 5, 7 and 64 — covers every tuplet and
  note value the model has). A tempo map in quarter-note BPM at tick positions; a time
  map for bar arithmetic. Seconds appear nowhere in this item.
- **Identity (§3).** Every note event carries `noteKey` and `pass`.
- **Proof (§4).** `expected.performance.json`, **opt-in** per scenario (a `performance`
  flag in meta, like the tab opt-in), hashed separately as `performanceHash`; approved
  through `/verify` like any golden, with the review page showing the note table. Until
  item 7 lets the reviewer listen, the verdict is by reading — which the tick format is
  designed to make possible. The batch is registered in
  [lab-verify.md](../inprogress/lab-verify.md). A second, narrower proof: the MIDI
  writer is round-tripped through a tiny reader in the harness (byte-stable, type 1).
- **Dependencies (§5).** None. The MIDI writer is ~150 lines of variable-length
  quantities and running status; there is nothing to import.
- **Spec findings (§6).** The grace and fermata conventions below; recorded on landing.
- **Reviewer gain (§7).** The note table: onset, duration, sounding pitch, written
  source, pass — the first artifact that says what a scenario *means* rather than how it
  is drawn. And a `.mid` download, so a reviewer can open it in anything.

## The output

```ts
interface Performance {
  ppq: 960;
  tempo:   { tick: number; bpm: number }[];            // quarter-note BPM; default 120 if the score says nothing
  time:    { tick: number; count: number; unit: number }[];
  measures:{ tick: number; ordinal: number; measureIndex: number; pass: number }[];   // the traversal, in ticks
  tracks:  { partIndex: number; strings?: number }[];  // strings → item 6 allocates one voice per string
  notes:   {
    tick: number; duration: number;                    // ticks
    midi: number;                                      // SOUNDING pitch
    velocity: number;                                  // fixed 80 in this item; item 8 owns it
    noteKey: string; pass: number; partIndex: number;
    string?: number;                                   // the authoritative choice, when the part declares strings
    bend?: { tick: number; cents: number }[];          // empty here; item 8
  }[];
  diagnostics: PerformanceDiagnostic[];
}
```

## The stages

1. **Measure ticks.** Walk the traversal; each `PerformedMeasure` gets a start tick from
   the time signature in force; `from`/`until` slice the measure's content by metric
   fraction.
2. **Event ticks.** `model/durations.ts` is the one duration table; dots; **nested
   tuplets** scale by `outer/inner` recursively; **tremolo** subdivides by `marks`
   within the container's performed value; **grace** takes a fixed short value
   (a 32nd at the prevailing tempo) and `stealPrevious`/`stealFollowing`/`makeTime`
   say whose time it is — a convention, recorded; **fermata** multiplies the event (or
   the bar's closing barline gap) by 1.5 — likewise.
3. **Ties.** A tie target extends the source note's duration and suppresses the target's
   attack; `lv` rings for a fixed maximum (a whole note) — `targetType: crossJump`
   resolves across the traversal, which is why ties are compiled after unrolling, not
   before.
4. **Sounding pitch.** MNX pitches are **written** (spec: `part.transposition.interval`
   "transforms a sounding pitch into a written pitch"), so the compiler **inverts** the
   interval; clef `octave` shifts and `ottava` spans apply; a fretted part's pitch is
   already sounding and `capo` moves the fret, not the pitch. Percussion kit notes use
   `sound.midiNumber` when the document declares it, else a diagnostic and silence —
   consistent with [core-percussion-kit.md](low-priority/core-percussion-kit.md).
5. **Tempo.** `tempos[]` with `value` normalised to quarter BPM; mid-bar `location`
   honoured (`lab/40-navigation/04-tempo-change-mid-bar` is the case).
6. **MIDI file.** `audio/midiFile.ts` writes SMF type 1: one tempo/meta track, one
   track per part, and for a part with strings one **channel per string** (channel 10
   reserved for kit). Bend range RPN set to ±2 semitones per channel so item 8's curves
   have a fixed scale. Deterministic bytes: the test pins a hash per opt-in scenario.

## Done bar

- Opt-in goldens for every tempo, repeat, tie, tuplet, grace and tremolo scenario in the
  corpus (~25), queued and registered.
- The old `mnxToAudio.ts` **retires**; `mnx-lab/audio` exports the compiler and the
  writer instead. Its one behaviour worth keeping (the duration-table lesson in its
  comment) is now a test.
- Nothing under `src/engine/` changes; `update:primitives` clean.
