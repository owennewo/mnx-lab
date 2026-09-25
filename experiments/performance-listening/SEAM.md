# The Studio seam

2026-09-25, revised the same day. A plan for where the listener meets Studio, in two
parts. **Part 1** changes only this experiment, so every run exercises the seam Studio
will eventually use, without disturbing the evidence already recorded. **Part 2**, the
promotion, moves that seam into `src/` and changes Studio to match. Studio code is not
touched until part 2, and part 2 needs the owner's go-ahead.

This is a plan, like [FIRST_STEP.md](FIRST_STEP.md), and its details may change as long
as its goal holds: a listener Studio can drive through the same socket as its other
playback sources. It does not state what the experiment believes; the
[research log](RESEARCH_LOG.md) does.

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

Three principles shape part 1:

- **Wrap, don't rewrite.** The frozen apparatus stays byte-identical: the v1
  vocabulary ([freeze.json](contracts/freeze.json)), the candidates, the runner and the
  evaluator. The seam arrives as a new contract in `listen/` and reaches them through
  adapters. Recorded runs stay valid under the version they ran on, and their decision
  records are translated by pure functions, never rewritten.
- **Reproduction is the seam's regression test.** Run through the adapters, the current
  scoreboard must reproduce its latest recorded results exactly. Any difference is a
  seam defect, found before it can reach Studio.
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

One apparent gap is not one. Every run keeps its candidates' complete decision records:
`g001` in the repository, and every run from 002 onward privately beside its audio, at
2–93 MB per run. Replaying recorded streams through the seam is possible from the start.

## Part 1 — make the experiment seam-ready

Each step says when it is done. None of them changes a listening result, and all of them
hold for the clock follower as much as for the best candidate. Seam work runs alongside
the ladder; a candidate's ladder standing never waits on it.

**Where the work may touch.** `listen/`, new adapter files in the bench, the three test
files in S0, the scoreboard's registration of wrapped entries, and the dependency rules.
It never edits a frozen candidate, the runner, the evaluator, `bench/src/types.ts` or a
recorded run. That keeps it out of the way of ladder work in the same experiment, and
keeps every recorded result reproducible.

### S0. Old evidence is verified at the commit that made it

Three bench tests check that working-tree files still match hashes recorded by runs
`g001`, `g002a/b` and `g003`, so any edit to those files fails them, whatever the edit
is for. Each of those runs records its commit. The tests verify the pinned files at
that commit instead, as the report exporter already does. The v2 oracle checkpoint pins
only `bench/src/v2/` and is left as it is.

*Done when* the three tests pass against recorded commits, and a deliberate edit to a
pinned file in a scratch branch no longer fails them.

### S1. `listen/`, a module that can move by `git mv`

Create `experiments/performance-listening/listen/`, a sibling of `bench/`, named after
what it becomes: `src/listen/`. It holds the listener contract, the position conversions,
`liveView` and `ListeningBackend`. It is not part of the bench, because the bench is the
measuring apparatus and this is the interface of what is measured. It is not named for
Studio either: it lands in `src/` as a library layer that `elements` can import, and
Studio is its first consumer, not its owner.

`listen/` imports only `src/audio` and `src/model`, which the existing
`listening-bench-consumes-audio-and-model-only` rule already enforces for the whole
experiment. One new dependency-cruiser rule adds that `listen/` imports nothing from
`bench/`, so promotion is a move, not a rewrite. The bench's `tsconfig` and vitest
includes gain `../listen`. The bench imports `listen/` only from new files: the
adapters of S3 and S4, the replay of S6 and the scoreboard's registrations.

*Done when* the boundary rule is in the gate, and `listen/` compiles and its tests run
under the bench suite, reaching only `src/audio` and `src/model`.

### S2. One display rule

Built early, because everything after it is checked against it. `listen/` provides
`liveView(record, clock)`: the effective decision at a clock under the vocabulary's four
rules. It is the only function Studio will use to decide what to draw. The evaluator
stays as it is. An **agreement test** asserts that `liveView` equals the evaluator's
effective decision at every grid point: in the bench suite on `g001`'s committed records
and the oracle fixtures, and in the scoreboard on every private record of the run. The
rule is **held, not extrapolated**. If the owner later wants a smoothly moving cursor,
extrapolation becomes part of the contract and the evaluator scores it; Studio never
adds it by itself.

*Done when* the agreement test passes on the committed records and in a scoreboard run.

### S3. Positions in Studio's coordinate

The wire position of the new contract is Studio's `ScorePosition`: performed `ordinal`
plus `metricOffset` in whole notes, imported from `src/audio/scorePosition.ts`, not
redeclared. `route` is retired, because the ordinal already says which pass. The
conversions already exist there: `scorePositionAt` maps a performed position, which is
quarters divided by four, to a `ScorePosition`, and `performancePositionAt` maps back.
`listen/` wraps them as the translation between the two vocabularies.

Two adapters in the bench carry it:

- **Legacy listener adapter.** Wraps any existing candidate as a seam listener. The
  candidate runs unchanged; the adapter converts each emitted position to
  `ScorePosition`.
- **Record adapter.** Translates a seam record back into v1 positions, so the frozen
  evaluator judges it unchanged.

*Done when* the new vocabulary version is written and approved, the conversion
round-trips on every performed boundary of a score with repeats, a volta and a D.S.,
and the slim suite run through both adapters reproduces the latest recorded
scoreboard's results exactly.

### S4. A start handoff Studio can supply

```
start(score, handoff, delivery)
handoff = { from: ScorePosition, parts: part ids, tempo: { quartersPerMinute: Rational }, rate: number }
```

`from` covers Studio's seek, restart and loop. `parts` names what the performer plays;
other parts are accompaniment the listener may use or ignore, but never expects to hear.
Tuning and capo come from the score. Tempo is the score's tempo at `from`, times
Studio's rate: rational, never rounded. A listener that cannot honour a handoff
**refuses at `start`** with a reason. A refusal is a valid seam answer; silently assuming
the top of the score and `route: 1` is not.

The legacy adapter refuses on behalf of the wrapped candidate whatever it cannot honour:
a start other than the top of the score, a route with repeats inside the candidate's
window, a tempo the candidate cannot represent, or a part list it cannot use. New
candidates implement the seam contract directly and may honour more.

*Done when* every scoreboard entry either honours or refuses each field, and a test
shows the refusal path.

### S5. `ListeningBackend implements PlaybackBackend`

This goes in `listen/`, DOM-free, and implements Studio's interface exactly. It is fed
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

S6's replay is written against this backend's interface first and needs the backend to
pass, so the two land together.

*Done when* the backend runs inside the real `PlaybackSession`
(`src/audio/playbackSession.ts`, DOM-free) in Node, select, seek, pause and resume
behave as Studio expects, and S6's replay passes through it.

### S6. Replay every run through the seam

A **seam replay** runs each decision record through `ListeningBackend` inside
`PlaybackSession` and asserts three things:

- at every grid point the cursor Studio would draw equals `liveView`;
- `scorePosition` is `null` exactly where the record is unsupported or uncovered;
- no snapshot shows a position the evaluator did not score.

It runs in the scoreboard on the run's private records, and in the bench suite on
`g001`'s committed records. It is a pass/fail check on the seam and never a candidate
metric; a candidate cannot fail the ladder because of it. It adds seconds to a run.

*Done when* the replay passes in a scoreboard run and in the bench suite.

### S7. Routes and starts are exercised

Add a seam fixture, not a ladder rung, with one repeat and a volta, and one start from
mid-score. Every scoreboard entry either follows it on the correct ordinal or refuses at
`start`. Wrapped legacy candidates will refuse, and that is their recorded answer. This
fixture is what stops "route 1 only" from reaching Studio unnoticed.

*Done when* every scoreboard entry has a recorded answer, following or refusing, for
both fixtures.

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

*Done when* the schema is in the new vocabulary version, validated like positions, and
at least one oracle fixture carries each verdict.

### S9. Delivery at whatever the device gives

Last among the required steps, because it is the only one that changes the audio a
candidate hears. The delivery settings become declarations (`sampleRate`,
`chunkSamples`), not requirements. `listen/` provides a causal adapter that rechunks and
resamples to what a candidate wants internally, so candidates keep their fixed 48 kHz /
480 internals. The adapter's own added delay is measured and reported.

*Done when* the scoreboard can deliver the same clip at 48 kHz/480, 48 kHz/128 and
44.1 kHz/128; each run passes the prefix checks; 48 kHz/128 reproduces 48 kHz/480
exactly; and 44.1 kHz positions agree within the ±0.25-quarter tolerance.

### S10. A capture adapter, outside Studio (optional)

A standalone page under the experiment, like `archive/microphone/`, runs AudioWorklet
capture → S9's adapter → a worker running a `Listener` → `ListeningBackend`. Feeding a
WAV file as a fake microphone first measures the capture chain's delay without a
guitar. This is evidence toward the latency limits proposed in the
[research contract 1 draft](contracts/research-contract-1-draft.md) (p95 ≤ 250 ms,
p99 ≤ 400 ms), not a pass of them; that needs Studio's own display chain.

### Order

| Step | Why here |
|---|---|
| S0 | Unblocks everything else without touching evidence |
| S1 | The module and its boundary exist before anything goes in them |
| S2 | The display rule every later check is measured against |
| S3 | The coordinate; its adapters make reproduction the regression test |
| S4 | The handoff, with refusals for what legacy candidates cannot do |
| S5, S6 | The backend and its replay land together |
| S7 | Exercises routes and starts once the handoff and backend exist |
| S8 | Shape only; needs the vocabulary approval S3 already asked for |
| S9 | The only step that changes the audio a candidate hears |
| S10 | Optional |

The steps are numbered in the order they are built.

### Seam-ready means

S0–S9 done, and S10 done or deliberately deferred. The seam replay and the agreement
test pass on every current run, the slim suite reproduces through the adapters, and the
promotion deltas below are complete.

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

1. **Move** `experiments/performance-listening/listen/` to `src/listen/` with `git mv`;
   the name does not change. The legacy adapters stay in the bench: they exist to
   measure old candidates, not to ship. It becomes a layer over `model` and `audio`, which
   `elements` may import, and the layer order in `.dependency-cruiser.cjs` and
   `CLAUDE.md` gains it. The bench's imports change by path only, its includes drop
   `../listen`, and the `listen/`-to-`bench/` rule is deleted. The experiment's rule
   widens from `src/(audio|model)` to include `src/listen`.
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
| Wire position | Studio's `ScorePosition` | S3 |
| Accompaniment while listening | None at first: the listener is the only source, and no speaker bleeds into the microphone | S4's `parts`, S5 |
| Widen the note shape now | Yes, shape only | S8 |
| Promote plumbing before a listener is accepted | Yes, behind the clock follower | part 2 |
| Approve the new vocabulary version | Yes, with S3's positions and S8's issue shape together | S3, S8 |
| Who builds part 1 | One implementer at a time, in its own worktree, touching only what part 1 lists | all |
| Smooth cursor (extrapolated) or held | Held, until the evaluator scores extrapolation | S2 |
