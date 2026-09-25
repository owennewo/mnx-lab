# Listening vocabulary, version 2 — the Studio seam

Version 2, 2026-09-25. The listener interface Studio will drive, planned in
[SEAM.md](../SEAM.md). It lives in code in [`listen/contract.ts`](../listen/contract.ts)
and is validated by [`listen/validate.ts`](../listen/validate.ts). Version 1
([vocabulary.md](vocabulary.md)) stays frozen: every run recorded under it remains valid
under it, and its records are translated by pure functions, never rewritten.

**Approval.** SEAM.md part 1 needs this version written and approved, and assumes the
recommended answer to each of its owner decisions: Studio's `ScorePosition` on the wire,
no accompaniment at first, the widened note shape fixed now, and a held rather than
extrapolated cursor. On 2026-09-25 the user set the session goal "implement part 1 of
SEAM.md". That is recorded here as approval of this version with those answers. A
different answer to any of them is a change to this contract.

## The handoff

```
start(score: MNX document, handoff, delivery) → { ok: true } | { ok: false, refused: reason }
feed(chunk: Float32Array, clock: seconds released so far) → Emission[]
finish() → Emission[]

handoff  = { from: ScorePosition, parts: part ids, tempo: { quartersPerMinute: Rational }, rate }
delivery = { sampleRate, chunkSamples }
```

- `from` is where the player starts: the top of the score, a seek, a restart or a loop
  start. `parts` names what the performer plays; other parts are accompaniment the
  listener may use or ignore but never expects to hear. A part without an `id` is named
  `#` and its index. Tempo is the score's tempo at `from` times Studio's `rate`, exact.
- `delivery` declares what the device gives. It is not a requirement.
- A listener that cannot honour any part of the handoff **refuses at `start`** with a
  reason. Refusing is a valid answer. Silently assuming the top of the score is not.

## Statements

A decision is one of three statements, stamped with `refersTo`, the audio time it is
about, and `madeAt`, the delivery clock when it was made:

- `position` — `{ candidates: [{ at, weight }], confidence }`, where `at` is Studio's
  `ScorePosition`: a performed visit `ordinal` and a written `metricOffset` in whole
  notes. The ordinal says which pass of a repeat, so version 1's `route` is retired.
  Weights are positive and sum to one; the heaviest candidate is what Studio draws.
- `unsupported` — following is not supported at `refersTo`; optional `reason`.
- `note` — the issue shape for the note-assessment milestone, fixed now and scored
  later. The evaluator ignores it.

```
note = { verdict: 'match' | 'missing' | 'extra' | 'substitution' | 'timing' | 'duration',
         at: ScorePosition,                    // required, including for an extra note
         noteKey: string | null,               // Studio's key; null exactly for an extra note
         observed: { onset, end, midi, string } | null,   // each field nullable
         timingErrorSeconds: number | null,    // signed: negative is early
         durationErrorSeconds: number | null,  // signed: negative is short
         confidence }
```

A revision repeats `refersTo` and may name the decision it `supersedes`. Studio shows the
latest; the record keeps every version, so a `missing` that later becomes a late `match`
stays visible in hindsight.

## The display rule

Version 1's four rules are unchanged, and version 2 names the function that applies
them: `liveView(record, clock)`. Among decisions made by `clock` about times up to
`clock`, the one about the latest time stands; between decisions about the same time,
the one made last. A statement stands until replaced: the cursor is **held, never
extrapolated**. Note verdicts never move the cursor. Studio decides what to draw with
this function alone, and an agreement test holds it to the evaluator.

## Wire details

Times are finite seconds with `0 ≤ refersTo ≤ madeAt`, and `madeAt` never decreases.
Ids are unique. Positions must lie within the performed score; the final boundary is
`{ ordinal: number of performed measures, metricOffset: 0 }`. In JSON, a rational is
`{ num, den }` with both as decimal strings, as Studio stores it.

## Translation from version 1

Version-1 positions are performed quarters from the start of the performance, route 1.
A legacy candidate runs unchanged inside an adapter that converts each position with
Studio's `scorePositionAt`, and refuses at `start` whatever the candidate cannot honour.
For the frozen evaluator, version-2 records are converted back with
`performancePositionAt`. The conversion is exact everywhere inside the performed score.
A version-1 claim past the end, which only the audio-ignoring clock makes, is held at the
final boundary and counted.
