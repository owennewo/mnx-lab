Version v1; draft instrument contract. Freeze only after item G.

# Assessment vocabulary and listener interface (`contracts/vocabulary.md`)

The handoff to a listener:

```
start(intendedScore: MNX document, tempo, delivery: { sampleRate, chunkSamples })
feed(chunk: Float32Array, clock: seconds released so far) → Decision[]
finish() → Decision[]
```

A decision is one of three statements, each stamped with `madeAt` (the clock at the
moment of the decision) and `refersTo` (the audio time it describes):

- `position` — `{ candidates: [{ position, weight }], confidence }`. Position is a
  rational score offset in quarter notes from the score start, plus a `route` index
  (always pass 1 at level 1). More than one candidate expresses unresolved ambiguity;
  weights sum to one; `confidence` is the listener's belief that the true position is
  in the set at all.
- `unsupported` — following is not supported at `refersTo`; optional `reason`.
- `note` — reserved; the shape is fixed (`match | missing | extra | substitution | timing`,
  note id, observed onset and pitch) and the evaluator ignores it at this milestone.

The record is append-only, and the two views it feeds (§5.3) obey four rules:

- **The live estimate persists until replaced.** What the player was shown at `madeAt`
  stays shown until a later decision with a later or equal `refersTo` arrives. A stale
  confident claim therefore keeps accruing exposure for as long as it stands.
- **A historical correction never rewrites what was shown.** A later decision with an
  earlier `refersTo` appends to the record and changes the hindsight view; it does not
  remove the earlier decision and it does not touch the live estimate unless it also
  supplies a decision for the current time.
- **Revisions stop future exposure, never erase past exposure.** Live correctness and
  retrospective correctness are reported apart and never netted.
- **Silence is not a statement.** An audio interval with no decision referring to it is
  **uncovered**, never an implicit correct abstention.

Chunked, clocked delivery is the runner's job (§7.2), but the interface is shaped so a
listener cannot ask for more than has been released.


Related: [vocabulary](vocabulary.md), [golden format](golden-format.md),
[counting rules](evaluator-rules.md), [provisional research contract](research-contract-0.md).

## Wire details

Times are finite seconds. Every decision has a unique `id`, `kind`, `refersTo`
and runner-stamped `madeAt`; `0 ≤ refersTo ≤ madeAt`. Append order breaks exact
timestamp ties. Revisions repeat `refersTo`, optionally naming `supersedes` (an
existing decision at that time); no record is removed. Note statements are ignored
by following views and never displace a following statement.

A position is `{ quarters: { num, den }, route }`: safe integers, positive denominator,
nonnegative offset and positive route occurrence. A candidate has `position` and
`weight`. Weights are positive and sum to one (floating tolerance 1e-9); confidence
is in [0,1]. A note statement has `verdict`, `noteId` (string or null),
`observedOnset` (seconds or null), `observedPitch` (MIDI or null).

`start` and `finish` return no privileged labels. `finish` may emit decisions stamped
at the final released clock. Listeners emit decisions without `madeAt`; the runner
owns it. A fresh instance is required for each execution. Only the intended score,
tempo, delivery settings, current chunk and released clock cross the interface.

Machine shape: [decisions.schema.json](decisions.schema.json). Cross-record timestamp,
id, supersession and weight-sum invariants also require semantic validation.
