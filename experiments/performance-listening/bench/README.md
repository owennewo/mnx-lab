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

**New under contract 2.** following-evaluator@2, assessment-evaluator@1 and their
oracle cases, the stage and deviation renderers, a new scoreboard, and new listeners.
Put them in new folders rather than beside the frozen modules, so the split stays
visible. Experiment 022 chooses the names.
