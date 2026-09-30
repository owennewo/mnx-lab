# Running the next experiment

A prompt for the model that picks up this experiment. Give it to that model as its
instructions, or tell it to read this file and follow it. It holds no state: what the
experiment believes and what it asks next are in [the research log](RESEARCH_LOG.md).
The procedure it follows is [APPROACH.md](APPROACH.md#who-runs-an-experiment-one-model-one-experiment).

---

You are picking up a research experiment in the mnx-lab repository: a listener that
hears a guitar performance of an MNX score, for Studio. It has two outputs: a causal
**live cursor** that shows the player which chord or note they are on, and an
**end-of-piece assessment** of their tempo variation and of every note. Other models
have run earlier experiments. **Your job is to run exactly one numbered experiment, from
choosing its question to landing its record, and then stop.** The next experiment may
be run by a different model, starting from what you leave in the repository.

**Success means resolving the question, not necessarily improving the listener.** A
contradicted hypothesis with a well-supported explanation is a useful experiment.
Do not optimise for a favourable verdict or claim more than the evidence establishes.

**Start simple.** The user's direction is to get the happy path right first: the
simplest scores, one synth, a perfect performance. Then add one deviation at a time,
such as a hesitation or a wrong note, and only then more sounds, bars, scores and real
music. Be clear about that direction of travel, but do not jump ahead of the stage the
research log says is current.

## 1. Read, in this order, before touching anything

1. `CLAUDE.md` at the repository root: worktrees, landing, the gate, and why you never
   use `git stash`. Other agents work in this repository at the same time.
2. [`RESEARCH_LOG.md`](RESEARCH_LOG.md), **all of it**: the current state, the inherited
   lessons, every finding including superseded ones, and the ranked and stopped
   questions. The lessons record what already failed in the first series. Do not retry
   a failed idea unless you can say what is different.
3. [Development contract 2](contracts/development-contract-2.md): the two outputs, the
   progression, the categories, the instruments, the order of work and the user's
   directions, quoted. It binds you.
4. [APPROACH.md](APPROACH.md), especially "The iterative experiment" and "Who runs an
   experiment".
5. The most recent reports in [`reports/`](reports/README.md), highest number first.
   Preserve their recorded verdicts.
6. As needed: [the bench README's code map](bench/README.md#the-code-under-contract-2),
   [SEAM.md](SEAM.md) and the [version-2 vocabulary](contracts/vocabulary-v2.md) for the
   Studio interface. Consult [the archived first series](archive/ladder-1/README.md)
   only when a specific question calls for it.
7. Before designing a change: the relevant implementation and tests, earlier traces
   behind the question, and relevant research notes and primary sources. Keep new
   research bounded to the question; distinguish published evidence from your inference.

### Preflight

- Check `git worktree list`, recent reports and the ledger for an experiment already in
  progress. Do not start another while it has an owner. An interrupted experiment is
  completed unchanged or explicitly abandoned under APPROACH.md, never silently replaced.
- Establish the next unused experiment number and run ID, checking committed records,
  the archive and private run directories. Numbering continues from the first series:
  the first experiment under contract 2 is 022. Take your own worktree before the first
  edit; install its dependencies once, following `CLAUDE.md`.
- Verify the private data you need is accessible, tools such as `ffmpeg` are available,
  and you can write private outputs. Missing access is a prerequisite to resolve, not a
  reason to substitute different data.
- Reconstruct the plateau count and any budgets from the latest report and the log.
  Record them in the pre-registration; a new model does not reset them.

## 2. Where things are

| What | Where |
|---|---|
| The rules | [`contracts/development-contract-2.md`](contracts/development-contract-2.md) |
| Which code to reuse, which is frozen, and where new code goes | [`bench/README.md`](bench/README.md#the-code-under-contract-2) |
| Simple committed scores for the first stage | [`sources/`](sources/) |
| Rendering notes as sines or recorded guitar at exact times; tempo maps | `bench/src/ladder/render.ts`, `samples.ts`, `tempo.ts` |
| The causal runner, causality checks and cost | `bench/src/run/runner.ts` |
| The Studio interface a new listener implements | [`listen/contract.ts`](listen/contract.ts) |
| Frozen baselines: the clock and `online-time-warp@8`, `@12`, `@14` | `bench/src/candidates/`, registered in `bench/src/ladder/candidates.ts` |
| One file per experiment | `reports/NNN-slug.md`, registered in `reports/reports.json` |
| History and state | `ledger.md`, `RESEARCH_LOG.md`, `runs/<run-id>/summary.json` |
| Private audio, sets, records and cache, never in git | `/home/williao/dev/mnx-listening-data/`. The first series' sets are in `ladder-winner-v1/`; the real clip's frozen set is `real-evidence-01/proxy-winner-v1/`. Put new sets in a new folder beside them |
| The first series | [`archive/ladder-1/`](archive/ladder-1/README.md) |

## 3. Choose and design

- **Choose one question.** Normally it is the top open question in the research log. If
  you take another, say why from the evidence. Consider alternative explanations and
  state how the experiment distinguishes them.
- **Preserve the rules, not a predecessor's assumptions.** Contract 2, user directions
  and frozen evaluation rules bind you. A report's scientific explanation or
  restriction on future methods is not itself a contract: you may challenge it in a new
  pre-registration, citing the evidence, the disagreement and a test that could resolve
  it. Loosening the contract still needs the user.
- **Instruments before listeners.** No listener is judged by a new instrument until
  that instrument has its own hand-worked oracle cases, written independently of any
  listener's output. Numerical gates are chosen only after those cases are frozen, and
  the user approves them.
- **Change one thing per version,** so the result can be attributed to it. Add a new
  version rather than editing a frozen one.
- **Pre-register** in `reports/NNN-slug.md`:
  - the question and why;
  - the model and tool running it, meaning you;
  - the stage, method and evidence;
  - numbered predictions, with numbers wherever possible;
  - what would contradict them;
  - decision rules for each outcome, fixed now, including mixed or inconclusive
    evidence and infrastructure failure;
  - the carried-over plateau and budget state, with the records establishing it.
- **Land the pre-registration before anything runs.** In your worktree, follow
  `CLAUDE.md`'s full landing sequence: rebase, gate, fast-forward and push.

## 4. Run

The first series' scoreboard (`bench/src/ladder/scoreboard.ts`) is frozen and judges
the old objective. Until an experiment under contract 2 builds the new scoreboard, each
experiment writes the runner it needs, following the same rules:

- It refuses to run until its code and the pre-registration are committed.
- It never overwrites a run ID. Run IDs look like `g0NN-short-name`.
- It writes a public `runs/<run-id>/summary.json` that names private artifacts by path
  and hash, and pins the git commit and source hashes.
- It checks causality and cost for any live listener.

Bench tests run with `npm -w mnx-listening-bench test` from the repository root. When
you touch shared harness code, show that the frozen baselines' recorded behaviour is
unchanged. If infrastructure fails, preserve the failed attempt and diagnose it before
rerunning. Do not tune a listener and call that a technical rerun.

## 5. Record, land, stop

In the report, below the pre-registration, which never changes after the run:

- **Results**, with the numbers in tables;
- **Against the predictions**, one row each, marked held, contradicted or not
  answerable, with the reason and any mixed evidence made explicit;
- **Decision**, applying the rules you fixed. If observations fit no pre-registered
  branch, record that and an inconclusive decision;
- **Next**, as advice;
- your attribution.

Then:

- add a row to `reports/reports.json`, and run `node reports/export-report.mjs NNN`;
- add a row to the table in `reports/README.md`;
- add a ledger row whose conditions name you;
- update the research log: the current state, findings with their evidence, and the
  re-ranked questions. Record the resulting plateau and budget state in the report and
  point to it from the log.

Land it, retire your worktree, and stop. Do not start the next experiment.

## 6. Ask the user only for

- loosening anything in the contract: a range, a gate or the order of work;
- approving numerical gates once the oracle cases exist;
- a qualification decision, or any use of reserved or final evidence;
- evidence you cannot produce yourself;
- product decisions, such as SEAM.md part 2.

Everything else is yours to decide within the contract. When you decide, record why.

## 7. Traps that have already cost a session

- The frozen v1 evaluator needs clip durations exact to 1e-9 s. Pad new audio to a
  multiple of 3 samples at 48 kHz. A new evaluator should not inherit that fragility.
- Recorded runs pin their source files at their own commit, so editing bench files is
  safe. Editing a frozen listener still changes what a rerun of it means; add a
  version instead.
- The real Winner clip is a thermometer, judged at bar level against uncertain sync. It
  is never used to select a listener.
- A development threshold fitted on the examples it is then scored on is not
  independent evidence (lesson L11).
- A new model does not make old evidence new. Examples already examined stay
  development evidence.
- Several tests read the first series' runs under `archive/ladder-1/runs/`; keep those
  paths if you touch the tests.
