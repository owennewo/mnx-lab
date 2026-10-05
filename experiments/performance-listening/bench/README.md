# Listening bench

Private npm workspace. Zero runtime dependencies; TypeScript runs with development
`tsx`, tests with the root Vitest installation. From the repository root:

```
npm -w mnx-listening-bench test
npm -w mnx-listening-bench run generate -- harness-v1
npm -w mnx-listening-bench run freeze -- harness-v1
npm -w mnx-listening-bench run run -- harness-v1 <new-run-id>
npm -w mnx-listening-bench run report -- <run-id>
```

All commands are implemented. `run` requires a frozen set and committed code,
checks audio hashes and refuses to overwrite a run id. `report` renders recorded
counts without rerunning a candidate. Freeze is exercised only on temporary copies until G.
The committed oracle reports regenerate byte-identically.
Start with [the research log](../RESEARCH_LOG.md). No product build imports this bench.

## The code under contract 2

[Development contract 2](../contracts/development-contract-2.md#the-fresh-experimental-context)
splits this bench three ways. Nothing frozen is edited: a change is a new module.

**Keep and reuse: the harness.**

- `generate/`: sine synthesis, WAV I/O, set generation.
- `ladder/render.ts`, `ladder/samples.ts`, `ladder/tempo.ts`, `ladder/decay.ts`,
  `ladder/prepare*.ts`, `ladder/privateSets.ts`, `ladder/sources.ts`: rendering a score's
  notes as sines or recorded guitar samples at exact times, tempo maps, and frozen
  private sets. The contract's stages and deviations are built on these.
- `run/runner.ts`: causal chunk delivery, prefix-invariance causality checks and cost
  measurement.
- `seam/` and [`../listen/`](../listen/): the version-2 vocabulary, the display rule and
  the delivery checks. New listeners implement the version-2 `Listener` of
  `listen/contract.ts` directly; the `seam/legacy.ts` adapter exists for the frozen ones.
- `io.ts`, `validate.ts`, `types.ts`.

**Frozen baselines: runnable, never developed.**

- `candidates/clockFollower.ts`: the audio-ignoring floor.
- `online-time-warp@8`, `@12` and `@14`: `candidates/onlineTimeWarp8.ts`, `…12.ts`,
  `…14.ts` and what they import (`onlineTimeWarp1.ts`, `onlineTimeWarp2.ts`,
  `onlineTimeWarpConfigurable.ts`). The registry is `ladder/candidates.ts`.

**Frozen, to be replaced: the first series' objective.**

- `evaluate/`, `oracle/`: following-evaluator@1 and its oracle, judging ±¼ quarter.
- `ladder/scoreboard.ts`, `ladder/suite.json`, `ladder/goldens.ts`,
  `ladder/recognition.ts`, `ladder/cache.ts`, `ladder/seedCache.ts` and the
  `*Diagnostic.ts` files.
- `proxy/`: the sync-proxy evaluator for the real clip.
- The other `candidates/`: retired versions, kept so their recorded runs stay
  reproducible.
- `v2/`, `oracle-v2/`: the qualification instrument of research contract 1, which is
  unchanged.

Their tests keep passing; the archived runs they read are under
`../archive/ladder-1/runs/`.

**New under contract 2.** Kept in new folders, so the split stays visible:

- `src/events/`: the instruments of [event instruments 1](../contracts/event-instruments-1.md)
  and [2](../contracts/event-instruments-2.md): `label.ts` (performance-label@1 and @2,
  the perfect-performance labeller and the control labeller), `following.ts`
  (following-evaluator@2, unchanged by version 2), `assessment.ts` (assessment-report@1
  and assessment-evaluator@1, frozen), `assessment2.ts` (assessment-report@2 and
  assessment-evaluator@2), `gates.ts` (stage-gates@1: the approved gates, and the
  approved control-assessment gates) and `oracle.ts` (reads both oracles' shorthand).
- `oracle-events/`: event-oracle@1 and @2, hand-worked and frozen;
  `test/event-oracle.test.ts` and `test/event-oracle-2.test.ts` hold the evaluators and
  gates to them. Use version 2 and the version-2 evaluators for anything new.
- `src/stages/`: `stage1.ts` rendered `contract2-stage1-v1`; `stage1v2.ts` renders
  `contract2-stage1-v2`, the same eight performances with a silence and a wrong-score
  control beside each; `run.ts` (022) and `run023.ts` (023) measure frozen listeners on a
  frozen stage set. Later deviation renderers and listener runners are mapped below.
  `contract2-stage1-v1`'s manifest names its score files by absolute path in a worktree
  that no longer exists, so `readStageSet` cannot re-verify it; v2 names scores relative
  to the experiment (`assetPath`).

- `src/listeners/eventChain1.ts`: experiment 024's `event-chain@1`, a monophonic
  hard pitch-emission event chain with a separate offline token alignment. It implements
  the version-2 Listener directly; later changes get a new version. Its behavioral
  tests are in `test/event-chain-1.test.ts`.
- `src/stages/stage1v3.ts`: freezes `contract2-stage1-v3` with v2's unchanged WAVs and
  the approved distant `w2` wrong-score controls. `run024.ts` runs the fresh listener
  and all four frozen baselines, writes private assessments as well as records and
  uses the audited evaluators and approved gates unchanged.

- `src/listeners/eventChain2.ts`: experiment 027's `event-chain@2`, separating
  three-window live pitch confirmation from unchanged two-window offline tokens.
  It reuses @1's pitch estimator and offline aligner; its behavioral tests are in
  `test/event-chain-2.test.ts`.
- `src/stages/hesitation1.ts` and `slowedBar1.ts`: the frozen silent-hesitation and
  single-slowed-bar set builders. `run025.ts` and `run026.ts` compare the listener and
  frozen baselines on those sets. `run027.ts` evaluates @2 over the complete frozen
  slowed-bar set, re-evaluates @1's verified records, and cites the sweep-only baseline
  evidence. Its failed provenance preflight and technical rerun have separate run IDs.

The legacy bar flags above are instruments-2 evidence. Contract 2's approved
other-bars reference, instruments 3, and the rising-tide suite record follow its
[order of work](../contracts/development-contract-2.md#order-of-work); no existing
module or historical verdict is silently reinterpreted as that new version.


**Experiment 028 instrument work (pending oracle@3 audit).** `src/events/assessment3.ts`
implements other-bars references and informational report@3 bar summaries;
`src/events/gates2.ts` reuses approved numerical gates and adds deterministic sentinel
selection, suite states, retirement eligibility and routine/sweep plans. `oracle3.ts`
loads the frozen hand cases; `test/event-oracle-3.test.ts` preserves B1's recorded
arithmetic disagreement and checks unchanged handwritten report rules. No listener has
been evaluated under version3. [The suite record](suite-record.json) bootstraps historical
instruments-2 passes and sentinels without claiming confirmation or retiring a set.
`src/stages/fourBarTempo1.ts` prepares the new private four-bar evidence without running
a listener; `run028.ts` records validation, provenance and the oracle disagreement.
Use audited instruments2 until oracle3 has been independently resolved; do not mistake
a green regression test preserving the counterexample for an oracle approval.

**Experiment029, corrected oracle coverage (pending independent audit4).**
`oracle-events/oracle-4.json` and its freeze resolve audit3's B1/B11 and add missing
hand cases without editing instruments3 or any listener. `src/events/oracle4.ts`
loads the frozen inputs; `validateOracle4.ts` checks hand reports, states, selection,
headroom and plans; `src/stages/run029.ts` records provenance and historical suite
integrity. `test/event-oracle-4.test.ts` pins all110 checks and8 wrong-answer probes.
The [version4 definitions](../contracts/event-instruments-4.md) state adapter and
procedural limits. Use the research log for the current audit prerequisite; these
checks never constitute an independent audit or a listener approval.

**Experiment 031, other-bars reporting (D1 at g031b; @3 is the incumbent).** `src/listeners/eventChain3.ts`
is `event-chain@3`: @2's live chain, tokens, notes and intervals, with bar flags from
the other-bars reference and three-other-bar eligibility (`assessment-report@3`).
Its tests are in `test/event-chain-3.test.ts`. `src/stages/run031.ts` is the full-sweep
runner: @3 fresh, identity checks against @2, and baselines cited or run fresh.
g031 and g031a failed in the runner; g031b, authorised by the user, recorded D1. `compare031.ts` is the read-only comparison of bar
summaries with 030.

**Experiment 035, Basic Pitch challenger.** `src/challenger/observations.py` runs the
pinned official score-blind offline model/decoder in the existing guitar-nn environment.
`guitars.ts` freezes sample-render@1 versions of the simple clean/hesitation schedules
from development sources only. `chain.ts` preserves the incumbent's score-event,
stay/skip, exact-pitch alignment and reporting logic behind new observation inputs.
`native.ts`, `nativeWorker.mjs` and `live.ts` implement the in-process CPU spike;
`parity.py` compares identical model tensors across Python and Node. `run035.ts`
records complete-set assessments and exploratory live timing/cost/prefix checks, with
prior incumbent/baseline evidence verified by hash. Behavioral adapter checks are in
`test/challenger-035.test.ts`. The new [observation seam](../contracts/observation-seam-1.md)
needs its independent timing audit; consult [the research log](../RESEARCH_LOG.md) for
results, authority to continue, and what remains open.

**Experiment 039, offline monophonic decoder variant.** `src/challenger/dominantPitch.py`
keeps each frame's strongest note bin (lowest-bin tie), masks losing note/onset entries,
and applies the pinned official decoder unchanged. `chain2.ts` inherits the frozen
chain/report logic. `run039.ts` verifies and reuses guitar/noise model maps, freshly
decodes and assesses every frozen example, retaining per-input/per-example artifacts.
It does not implement a new live producer or change the observation timing seam;
see the research log for the next streaming/audit prerequisite.

**Experiment 041, native new-frame neural producer.** `src/challenger/buildIncremental041.py`
inserts a temporal slice after full-window normalization, preserving weights and
adding dynamic neural time reshapes. `incremental041.ts`/`incrementalWorker041.mjs`
run the score-blind backend. `seam4.ts` checks separately frozen physical/state hand
cases; `run041.ts` times allocation/setup/feed/finish and retains complete private
native/parity/prefix evidence. Its corrected technical run is exploratory until the
independent observation-seam 4 audit; no existing producer or evaluator is changed.
`postStats041.py` verifies saved-record hashes, selected map bytes and serial
clock recurrences, then aggregates existing records without inference. See the
[research log](../RESEARCH_LOG.md) for state, counts and next required audit.
