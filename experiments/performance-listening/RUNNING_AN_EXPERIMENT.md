# Running the next experiment

A prompt for the model that picks up this experiment. Give it to that model as its
instructions, or tell it to read this file and follow it. It holds no state: what the
experiment believes and what it asks next are in [the research log](RESEARCH_LOG.md).
The procedure it follows is [APPROACH.md](APPROACH.md#who-runs-an-experiment-one-model-one-experiment).

---

You are picking up a research experiment in the mnx-lab repository: a causal listener
that follows a guitar performance against its MNX score, developed toward Studio. Other
models have run earlier experiments. **Your job is to run exactly one numbered
experiment, from choosing its question to landing its record, and then stop.** The next
experiment may be run by a different model, starting from what you leave in the
repository.

**Success means resolving the question, not necessarily improving the incumbent.** A
contradicted hypothesis with a well-supported explanation is a useful experiment.
Do not optimise for a favourable verdict or claim more than the evidence establishes.

## 1. Read, in this order, before touching anything

1. `CLAUDE.md` at the repository root: worktrees, landing, the gate, and why you never
   use `git stash`. Other agents work in this repository at the same time.
2. `experiments/performance-listening/RESEARCH_LOG.md`, **all of it**: the current state,
   every finding including superseded ones, the ranked open questions, and the stopped
   ones. The findings record what has already failed. Do not retry a failed idea unless
   you can say what is different.
3. `APPROACH.md`, especially "The iterative experiment" and "Who runs an experiment".
4. `contracts/development-contract-1.md`: the synthetic ladder, the active suite, the
   pass bar, the plateau rule and the user's directions, quoted.
5. The most recent reports in `reports/`, highest number first. Preserve their recorded
   verdicts. Contracts and user directions remain binding; scientific explanations and
   restrictions on future methods may be challenged as described in section 3.
6. As needed: `EXPERIMENT_HARNESS_STRUCTURE.md` for the pieces, `SEAM.md` for the Studio
   interface, `contracts/vocabulary-v2.md` for the listener contract.
7. Before designing a change: the incumbent's implementation and relevant tests, the
   reports and diagnostic traces behind the chosen question, and relevant research notes
   and their primary sources. Understand the mechanism, not only its summary. Keep new
   research bounded to the question; distinguish published evidence from your inference.

### Preflight

- Check `git worktree list`, recent reports and the ledger for an experiment already in
  progress. Do not start another while it has an owner. An interrupted experiment is
  completed unchanged or explicitly abandoned under `APPROACH.md`, never silently replaced.
- Establish the next unused experiment number and run ID, checking both committed records
  and private run directories. Take your own worktree before the first edit; install its
  dependencies once, following `CLAUDE.md`. Recheck ownership and numbering before landing.
- Verify the required frozen sets and private artifacts are accessible, dependencies and
  tools such as `ffmpeg` are available, and you have permission to write private outputs.
  Missing access is a prerequisite to resolve, not a reason to substitute different data.
- Reconstruct the applicable plateau count and any remaining budgets or evidence-access
  limits from the ledger and contracts. Record that state and its evidence in the
  pre-registration; a new model does not reset it. If a stopping rule already applies,
  follow it instead of launching another candidate variation.

## 2. Where things are

| What | Where |
|---|---|
| Candidates, one frozen file per version | `bench/src/candidates/`; `onlineTimeWarpConfigurable.ts` makes one-change versions of the online time warping |
| The candidate registry | `bench/src/ladder/candidates.ts` |
| The active suite: which entries and examples run | `bench/src/ladder/suite.json` |
| The scoreboard | `bench/src/ladder/scoreboard.ts` |
| Diagnostics, as patterns to copy | `bench/src/ladder/supportDiagnostic.ts`, `burstDiagnostic.ts` |
| Renderers and rung builders | `bench/src/ladder/render.ts`, `tempo.ts`, `samples.ts`, `prepareRung*.ts` |
| The Studio seam | `listen/`, and `bench/src/seam/` for the adapters |
| One file per experiment | `reports/NNN-slug.md`, registered in `reports/reports.json` |
| History and state | `ledger.md`, `RESEARCH_LOG.md`, `runs/<run-id>/summary.json` |
| Private audio, scores, sets, records and cache, never in git | `/home/williao/dev/mnx-listening-data/`: `ladder-winner-v1/` holds the rungs, runs and cache; `real-evidence-01/proxy-winner-v1/` holds the real clip's frozen set |

## 3. Choose and design

- **Choose one question.** Normally it is the top open question in the research log. If
  you take another, say why from the evidence. Consider alternative explanations and
  state how the experiment distinguishes them.
- **Preserve the rules, not a predecessor's assumptions.** Approved contracts, user
  directions and frozen evaluation rules bind you. Apply a pre-registration's decision
  rules to that experiment without rewriting its verdict. A report's scientific
  explanation or restriction on future methods is not itself a contract: you may
  challenge it in a new pre-registration, citing the evidence, the disagreement and
  the test that could resolve it. This does not permit loosening a contract or ignoring
  a user direction; those still need approval.
- **Change one thing per version,** so the result can be attributed to it. Add a new
  version rather than editing a frozen candidate or a recorded run. A diagnostic is
  often the right first step when the cause of a failure is unclear.
- **Pre-register** in `reports/NNN-slug.md`, with NNN the next number:
  - the question and why;
  - the model and tool running it, meaning you;
  - the method and evidence;
  - numbered predictions, with numbers wherever possible;
  - what would contradict them;
  - decision rules for each outcome, fixed now for this experiment, including mixed or
    inconclusive evidence and infrastructure failure where relevant;
  - the carried-over plateau and budget state, with the records establishing it.
- **Land the pre-registration before anything runs.** In your worktree, follow
  `CLAUDE.md`'s full landing sequence, including rebase, gate, fast-forward and push. The scoreboard
  refuses to run until the code and the pre-registration are committed.

## 4. Run

From `experiments/performance-listening/bench`:

```sh
npx tsx src/ladder/scoreboard.ts <run-id> <NNN-slug> \
  /home/williao/dev/mnx-listening-data/ladder-winner-v1 \
  /home/williao/dev/mnx-listening-data/real-evidence-01/proxy-winner-v1 \
  [--reproduce <previous-run-id>] [--full]
```

- To add an entry, register it in `candidates.ts` and list it in `suite.json`. Run IDs
  look like `g0NN-short-name`.
- A cold run with a few new entries takes a few minutes. Run anything longer in the
  background.
- When you touch shared code, such as the runner, the evaluator, the seam or the
  scoreboard, use `--reproduce` against the previous run. Every shared result must stay
  identical.
- Every run also checks the Studio seam: the display rule, the replay, the navigation
  fixtures and the deliveries. Those must keep passing.
- Bench tests: `npm -w mnx-listening-bench test` from the repository root.
- If infrastructure fails, preserve the failed attempt and diagnose it before rerunning;
  follow the contract's technical-rerun rules. Do not tune a candidate and call that a
  technical rerun, or overwrite a run ID.

## 5. Record, land, stop

In the report, below the pre-registration, which never changes after the run:

- **Results**, with the numbers in tables;
- **Against the predictions**, one row each, marked held, contradicted or not answerable,
  with the reason and any mixed evidence made explicit;
- **Decision**, applying the rules you fixed. If observations fit no pre-registered
  branch, record that limitation and an inconclusive decision rather than inventing a
  favourable rule after seeing the result;
- **Next**, as advice;
- your attribution.

Then:

- add a row to `reports/reports.json`, and run `node reports/export-report.mjs NNN`;
- add a row to the table in `reports/README.md`;
- add a ledger row whose conditions name you;
- update the research log. Rewrite the current state, add findings with their evidence,
  and re-rank the open questions. Write the questions so they state what the evidence
  demands, not a method. Record the resulting plateau and budget state with its evidence
  in the report and point to it from the log, so the next model need not infer a reset.

Land it, retire your worktree, and stop. Do not start the next experiment.

## 6. Ask the user only for

- loosening anything in a contract: a range, a pass bar or the exit rule;
- a qualification decision, or any use of reserved or final evidence;
- evidence you cannot produce yourself;
- product decisions, such as SEAM.md part 2.

Everything else is yours to decide within the contract. When you decide, record why.

## 7. Traps that have already cost a session

- The frozen evaluator needs clip durations exact to 1e-9 s. Pad new audio to a multiple
  of 3 samples at 48 kHz.
- Recorded runs pin their source files at their own commit, so editing bench files is
  safe. Editing a frozen candidate still changes what a rerun of it means; add a version
  instead.
- The scoreboard's cache is keyed by each candidate's code fingerprint and the frozen rung
  set. It spot-checks one example per candidate per rung, and a failed spot check stops
  the run.
- The real Winner clip is a thermometer. It is recorded on every run and never used to
  select a candidate.
- A new model does not make old evidence new. Examples already examined stay development
  evidence.
