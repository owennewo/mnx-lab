# The Studio seam

2026-09-25. A plan for where the listener meets Studio, in two parts. **Part 1** changes
only this experiment, so every run exercises the seam Studio will eventually use.
**Part 2**, the promotion, moves that seam into `src/` and changes Studio to match.
Studio code is not touched until part 2, and part 2 needs the owner's go-ahead.

This is a plan, like [FIRST_STEP.md](FIRST_STEP.md). It does not state what the
experiment believes; the [research log](RESEARCH_LOG.md) does.

## The destination

Studio's cursor already follows one of two clocks: the synth's transport, or a
recording's media time mapped through its sync. The destination adds a third. A guitar
played into a microphone is streamed to the listener, and the listener's decisions
move the cursor and report issues: wrong, missing, extra, early, late or short notes.

On the Studio side the socket already exists. `PlaybackBackend`
(`src/audio/playbackBackend.ts`) is what `PlaybackSession` owns, and everything
downstream reads its `snapshot.scorePosition`: the single cursor
(`src/elements/cursorPlayback.ts`), note highlight, pass lanes, park-on-pause and
"pause to edit". A listening source is a third `PlaybackBackend` beside `SynthBackend`
and `RecordingBackend`, and those behaviours come with it unchanged.

## Why agree the seam here first

The dependency rules make this the natural order. `.dependency-cruiser.cjs` forbids
production code from importing `experiments/` (`production-does-not-import-experiments`),
but the experiment may import `src/`, as the bench already does for `src/model/mnx.ts`
and `src/audio/performance.ts`. Part 1 therefore builds against Studio's real types
and interfaces, not copies of them. If Studio changes one of them, the bench stops
compiling, and that failure is the tripwire that keeps the two sides agreed.

Two caveats shape part 1:

- **The v1 vocabulary is frozen** ([freeze.json](contracts/freeze.json)). The seam
  changes the listener interface, so it arrives as a new contract version. Earlier
  runs stay valid under the version they ran on, and older decision records are
  translated by a pure function, never rewritten.
- **Some of the seam can only be declared here, not exercised.** Studio's source
  kinds, the microphone permission flow, the issue overlay and the real
  microphone-to-screen latency live in Studio. Part 1 records each of these as a
  *promotion delta* (below), so part 2 is a known list, not a discovery.

## What already agrees

| Concern | Experiment | Studio |
|---|---|---|
| Streaming shape | `start` → `feed(chunk, clock)` → `finish`; the runner stamps `madeAt`; prefix checks prove causality | none yet, but `PlaybackBackend` is a push/subscribe socket that suits it |
| Score compilation | `compilePerformance` from `src/audio/performance.ts` | the same function, in `bindPlayback` and `Player` |
| Note identity | ladder labels use `noteKey` as `scoreNoteId` | highlight and selection use `noteKey` (`src/model/noteKeys.ts`) |
| Live versus hindsight | an append-only record, revisions that supersede without erasing, and a held live estimate | the cursor shows one live position; history is nobody's job yet |

## Where the two sides disagree

1. **Position coordinate.** The experiment uses `{ quarters from score start, route }`.
   Every candidate hardcodes `route: 1` and throws on any repeat, and which occurrence
   `route` counts is never defined. Studio uses `ScorePosition { ordinal, metricOffset }`:
   a performed visit from the pass model plus a written offset in **whole notes**.
2. **Start handoff.** `start` receives the score and an integer BPM, and the start is
   always the top of the score. Studio seeks, restarts, loops and changes rate as a
   matter of course. Its documents are multi-part, and the listener cannot be told
   which part the player plays.
3. **Delivery.** Candidates throw unless audio arrives as 48 kHz mono in 480-sample
   chunks. A browser gives 44.1 or 48 kHz in 128-frame render blocks.
4. **Display rule.** The evaluator scores a held live estimate: it persists until
   replaced and is never extrapolated. Studio pulls the cursor every frame. If Studio
   smooths or extrapolates, it shows something the evaluator never scored.
5. **Uncertainty.** A decision carries weighted candidates, a confidence, or an explicit
   `unsupported`. A snapshot carries one `scorePosition` or `null`. It has no "lost"
   phase and no `'live'` source kind.
6. **Issues.** The `note` statement is reserved and too small for the destination. It
   has no duration verdict and no signed timing error. It has no repeat pass for a
   note in a repeated bar, and no string (on guitar the string is the authoritative
   choice). It gives no position for an extra note and no confidence.
7. **Records.** Only `g001` kept its decision records. Ladder runs keep summaries,
   so no candidate's stream can be replayed through anything.

## Part 1 — make the experiment seam-ready

Each step says when it is done. Steps 1–7 are independent of listening quality: they
hold for the clock follower as much as for the best candidate. Seam work sits
alongside the ladder, and a candidate's ladder standing never waits on it.

### S1. A seam module that can move by `git mv`

Create `bench/src/seam/`. It holds the listener contract and the adapters below, and it
imports **only** from `src/` and from itself, never from the rest of the bench. A
dependency-cruiser rule enforces this, so promotion is a move, not a rewrite.
Candidates, the runner and the evaluator import the contract from `seam/`;
`bench/src/types.ts` re-exports it for the existing code.

*Done when* the boundary rule is in the gate and `seam/` compiles against `src/`
alone.

### S2. Positions in Studio's coordinate

The wire position becomes Studio's `ScorePosition`: performed `ordinal` plus
`metricOffset` in whole notes, imported from `src/audio/scorePosition.ts`, not
redeclared. `route` is retired from the wire, because the ordinal already says which
pass. The evaluator keeps its affine trajectories in a performed coordinate: the
compiler's `PerformanceMeasure.metricPosition` is monotone along the route and maps
one-to-one to a `ScorePosition`. A pure function in `seam/` converts between the two,
and another translates v1 records (`quarters`, `route: 1`) for comparison with
history.

*Done when* the new vocabulary version is written and approved, every candidate emits
`ScorePosition`, and the conversion round-trips on every performed boundary of a score
with repeats, a volta and a D.S.

### S3. A start handoff Studio can supply

```
start(score, handoff, delivery)
handoff = { from: ScorePosition, parts: part ids, tempo: { quartersPerMinute: Rational }, rate: number }
```

`from` covers Studio's seek, restart and loop. `parts` names what the performer
plays; other parts are accompaniment the listener may use or ignore, but never
expects to hear. Tuning and capo come from the score. Tempo is the score's tempo at
`from`, times Studio's rate: rational, never rounded to an integer. A listener that
cannot honour a handoff **refuses at `start`** with a reason. A refusal is a valid
seam answer; silently assuming the top of the score and `route: 1` is not.

*Done when* every candidate either honours or refuses each field, and a test shows
the refusal path.

### S4. Delivery at whatever the device gives

The delivery settings become declarations (`sampleRate`, `chunkSamples`), not
requirements. `seam/` provides the adapter that rechunks and resamples to what a
candidate wants internally, so candidates keep their fixed 48 kHz / 480 internals.
The adapter's own added delay is measured and reported.

*Done when* the runner can deliver the same clip at 48 kHz/480, 48 kHz/128 and
44.1 kHz/128, each run passes the prefix checks, and positions agree within tolerance.

### S5. One display rule

`seam/` provides `liveView(record, clock)`: the effective decision at a clock under
the vocabulary's four rules. It is the only function Studio will use to decide what to
draw. The evaluator stays as it is; changing it would be a new instrument. An
**agreement test** asserts that `liveView` equals the evaluator's effective decision
at every grid point of every recorded run. The rule is **held, not extrapolated**. If
the owner later wants a smoothly moving cursor, extrapolation becomes part of the
contract and the evaluator scores it; Studio never adds it by itself.

*Done when* the agreement test passes on every retained record.

### S6. `ListeningBackend implements PlaybackBackend`

This goes in `seam/`, DOM-free, and implements Studio's interface exactly. It is fed
decisions and never audio, so it runs identically in a Node replay and live. The
mapping:

| Studio asks | The backend answers |
|---|---|
| `snapshot.scorePosition` | the heaviest candidate of `liveView` at the current clock, or `null` |
| `snapshot.highlight` | derived from `performance.written` at that position, as `RecordingBackend` does |
| `play` / `pause` / `stop` | open, suspend or end the listening session; pause stops feeding and never guesses |
| `seek(position)` | a fresh listener with `handoff.from = position`, or `canSeek`'s refusal reason |
| rate, volume, loop | capabilities declare none; a loop is a practice concern for later |
| `unsupported`, `confidence`, alternatives | an extension object on the snapshot (below) |

Studio's `BackendSnapshot.kind` has no `'live'`, and `mediaPhase` has no "lost". Part 1
reports `kind: 'audio'` and carries the rest in a `listening` field
(`{ phase: 'warming' | 'following' | 'lost', confidence, alternatives }`). The type
change is a promotion delta.

*Done when* the backend runs inside the real `PlaybackSession`
(`src/audio/playbackSession.ts`, DOM-free) in Node, and select, seek, pause and resume
behave as Studio expects.

### S7. Keep every decision record, and replay it through the seam

Every run keeps its candidates' decision records. They contain positions, ids and
times, not score content or audio, so they follow the run's existing privacy policy.
A **seam replay** runs each record through `ListeningBackend` inside `PlaybackSession`
and asserts three things:

- at every grid point the cursor Studio would draw equals `liveView`;
- `scorePosition` is `null` exactly where the record is unsupported or uncovered;
- no snapshot shows a position the evaluator did not score.

The replay is a pass/fail check on the seam and never a candidate metric; a candidate
cannot fail the ladder because of it. It joins the scoreboard's run so it runs every
time, and `g001`'s committed records are its first fixtures.

*Done when* the replay passes on every run from the first run after S5.

### S8. The issue shape, fixed now and still unscored

Note assessment remains a later milestone. Its shape is fixed now, so the milestone
designs to it rather than around the v1 placeholder. The evaluator keeps ignoring it.

```
note = { id, kind: 'note', refersTo, supersedes?,
  verdict: 'match' | 'missing' | 'extra' | 'substitution' | 'timing' | 'duration',
  at: ScorePosition,                      // required, including for extra notes
  noteKey: string | null,                 // Studio's key; null for an extra note
  observed: { onset, end, midi, string } | null,   // each field nullable
  timingErrorSeconds: number | null,      // signed: negative is early
  durationErrorSeconds: number | null,    // signed: negative is short
  confidence }
```

A revision supersedes by `id`, and Studio shows the latest. The record keeps every
version, so a `missing` that becomes a late `match` stays visible in hindsight.

*Done when* the schema is in the new vocabulary version, validated like positions,
and at least one oracle fixture carries each verdict.

### S9. Routes and starts are exercised

Add a seam fixture, not a ladder rung, with one repeat and a volta, and one start from
mid-score. Candidates either follow it on the correct ordinal or refuse at `start`.
This fixture is what stops "route 1 only" from reaching Studio unnoticed.

*Done when* every candidate on the scoreboard has a recorded answer, following or
refusing, for both fixtures.

### S10. A capture adapter, outside Studio (optional)

A standalone page under the experiment, like `archive/microphone/`, runs AudioWorklet
capture → S4's adapter → a worker running a `Listener` → `ListeningBackend`. Feeding a
WAV file as a fake microphone first measures the capture chain's delay without a
guitar. This is evidence toward the latency limits proposed in the
[research contract 1 draft](contracts/research-contract-1-draft.md) (p95 ≤ 250 ms,
p99 ≤ 400 ms), not a pass of them; that needs Studio's own display chain.

### Seam-ready means

S1–S9 done, and S10 done or deliberately deferred. The seam replay passes on every
current run, and the promotion deltas below are complete.

## Promotion deltas

What part 1 cannot do, recorded as it is found. Part 2 is this list.

| Delta | Why part 1 cannot do it |
|---|---|
| `BackendSnapshot.kind` gains `'live'`; a lost phase replaces the `listening` extension | Studio's type |
| A source named for listening in the Source sheet and `Player`'s backend factory | Studio UI |
| Microphone permission, capture lifecycle, no monitoring through the speakers | Studio shell |
| An overlay for note verdicts, keyed by `noteKey` and ordinal | the viewer; a design item for the owner |
| Measured microphone-to-visible-feedback latency in the real browser chain | only Studio has the display chain |

## Part 2 — promotion

Promoting the seam and shipping a listener are separate decisions. The plumbing can be
promoted with the clock follower behind it, before any candidate is accepted. A
listener reaches players only through the Studio integration decision that
[APPROACH.md](APPROACH.md) and research contract 1 already require.

1. **Move** `bench/src/seam/` to `src/listen/` with `git mv`. It becomes a layer over
   `model` and `audio`, which `elements` may import, and the layer order in
   `.dependency-cruiser.cjs` and `CLAUDE.md` gains it. The bench switches its imports
   to `src/listen/`, and its boundary rule is deleted.
2. **Apply the deltas**, one reviewed change each: the snapshot type, the source, the
   capture path, and the overlay.
3. **Prove it in a browser.** A smoke drives Chrome with a WAV as a fake microphone
   (`--use-fake-device-for-media-stream --use-file-for-fake-audio-capture`) and asserts
   that the drawn cursor matches `liveView` of the record the page produced. The same
   run measures microphone-to-screen latency.
4. **Then the product questions**, with the owner: touch devices (Studio plays and
   does not edit on them, and listening does not edit), storing a take as a library
   recording with its decision record, and practice loops.

## Decisions for the owner

Part 1 assumes the recommended answer to each question. A different answer changes
the step named.

| Decision | Recommended | Changes |
|---|---|---|
| Wire position | Studio's `ScorePosition` | S2 |
| Accompaniment while listening | None at first: the listener is the only source, and no speaker bleeds into the microphone | S3's `parts`, S6 |
| Widen the note shape now | Yes, shape only | S8 |
| Promote plumbing before a listener is accepted | Yes, behind the clock follower | part 2 |
| Smooth cursor (extrapolated) or held | Held, until the evaluator scores extrapolation | S5 |
