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

**Your model and tool.** Usually nobody tells you; name yourself in this format:
`<model> (<reasoning effort, if known>) in <tool>`, using the model name your runtime
or system prompt gives you, for example "Sol 6.1 (high) in Codex" or "Claude Opus 5.5
(1M context) in Claude Code". If you can see only a family, not an exact version,
write what you can see and add "(version unverified)", for example "GPT-6 in Codex
(version unverified)". If the person or parent session that launched you stated a
model and tool, use theirs. Use the same string in the pre-registration, the ledger
row, the attribution and your commit bodies. The reviewer confirms it from the tool's
session log where one exists.

**Start simple.** The user's direction is to get the happy path right first: the
simplest scores, one sound, a perfect performance. Since 2026-10-04 that sound is
sampled guitar, not a synth ([the contract's amendment](contracts/development-contract-2.md#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule)). Then add one deviation at a time,
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
- Reconstruct the stopping count ([contract 2, Stopping](contracts/development-contract-2.md#stopping))
  and any budgets from the latest report and the log.
  Record them in the pre-registration; a new model does not reset them. Where nothing
  has changed since the latest report, one line saying so, linking it, is enough.

## 2. Where things are

| What | Where |
|---|---|
| The rules | [`contracts/development-contract-2.md`](contracts/development-contract-2.md) |
| A challenger track's terms | [TRACK_PROPOSALS.md](TRACK_PROPOSALS.md) proposal 1 and [the contract's challenger section](contracts/development-contract-2.md#the-challenger-track-basic-pitch-observations) |
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
  you take another, say why from the evidence. If the log has a **current batch**, your
  experiment is one of its runs: choose the question that best serves the batch's goal
  within the contract and the approved gates, and say how it does. Consider alternative explanations and
  state how the experiment distinguishes them.
- **A challenger experiment** belongs to a track opened under
  [TRACK_PROPOSALS.md](TRACK_PROPOSALS.md) proposal 1 and recorded in
  [the contract's challenger section](contracts/development-contract-2.md#the-challenger-track-basic-pitch-observations),
  which binds it: its first experiment pre-registers an exploration budget in place of
  numbered predictions; it runs every example of every set it claims, not the incumbent's
  sentinels; its report slug and run IDs carry `challenger-` after the number; it may add
  `contracts/observation-seam-N.md`, whose hand-worked cases go in a file of their own
  beside it, as an event oracle's do, so that its auditor can work from the rules before
  seeing the answers. Its cases state model-produced values as float32, compared to a stated
  tolerance, not as decimals, so that representation is never an audit ambiguity. While a challenger track is open, "the top open question" means the
  top of your own track's questions. Everything else here applies unchanged.
- **Preserve the rules, not a predecessor's assumptions.** Contract 2, user directions
  and frozen evaluation rules bind you. A report's scientific explanation or
  restriction on future methods is not itself a contract: you may challenge it in a new
  pre-registration, citing the evidence, the disagreement and a test that could resolve
  it. Loosening the contract still needs the user.
- **Instruments before listeners.** No listener is judged by a new instrument until
  that instrument has its own hand-worked oracle cases, written independently of any
  listener's output, and **a different session has audited them**
  ([the audit rule](contracts/development-contract-2.md#auditing-an-oracle)). If you
  write or re-version an oracle, you do not audit it; the log's next question is then
  the audit, which follows [AUDITING_AN_ORACLE.md](AUDITING_AN_ORACLE.md).
  Numerical gates are chosen only after the oracle cases are frozen, and the user
  approves them.
- **Instrument definitions are versioned contracts.** An experiment that defines or
  changes an instrument writes `contracts/event-instruments-N.md` as a new version,
  never editing an earlier one. That is the one contract file an experiment may add.
- **Every stage has its controls.** Silence and a wrong score run beside every stage's
  examples; a listener that passes a stage without its controls has not passed it.
- **Change one thing per version,** so the result can be attributed to it. Add a new
  version rather than editing a frozen one.
- **Pre-register** in `reports/NNN-slug.md`:
  - the question and why;
  - the model and tool running it, meaning you, in the format above;
  - the stage, method and evidence;
  - numbered predictions, with numbers wherever possible;
  - what would contradict them;
  - decision rules for each outcome, fixed now, including mixed or inconclusive
    evidence and infrastructure failure, which say separately what happens when a run
    fails before measuring and when it fails only in writing its record afterwards;
  - the carried-over stopping count and budget state, with the records establishing it.
- **Land the pre-registration before anything runs.** In your worktree, follow
  `CLAUDE.md`'s full landing sequence: rebase, gate, fast-forward and push.

## 4. Run

The first series' scoreboard (`bench/src/ladder/scoreboard.ts`) is frozen and judges
the old objective. Until an experiment under contract 2 builds the new scoreboard, each
experiment writes the runner it needs, following the same rules:

- It refuses to run until its code and the pre-registration are committed.
- It never overwrites a run ID. Run IDs look like `g0NN-short-name`.
- It writes a public `runs/<run-id>/summary.json` that names private artifacts by path
  and hash, and pins the git commit and source hashes. Keep it small, a few hundred KB
  at most: provenance, per-example gate results and aggregates. Per-decision, per-frame
  and per-note detail belongs in the private records, named there by path and hash.
  The size is a target the next review reads, not a check the runner enforces: a
  runner that has measured writes its record and reports the excess, never refuses
  (031's one rerun measured a 26-minute sweep and then refused its own summary for
  size). It writes each private record, with its hash, as that example is measured,
  and checks the public record's shape on a dry assembly before measuring, so a
  defect in the record writer cannot discard a completed measurement. Tag that commit
  `<run-id>-source` and push the tag when you land: if `main` moved meanwhile, the
  landing rebase rewrites the commit and only the tag keeps the pinned source reachable.
- It checks causality and cost for any live listener.

**Run only the active suite.** A routine run evaluates the substages you attempt, the
sentinels of every passed substage and their controls, as
[the rising tide](contracts/development-contract-2.md#keeping-the-suite-lean-the-rising-tide)
defines them; retired sets and the frozen baselines run only in a full sweep, which is
due when you claim a stage passed, at the end of a batch, and at least every fifth
experiment. Say in the pre-registration which you are running and why. A routine
evaluation should take about two minutes.

Run time grows with every regression set, and the user wants fast iterations. A
listener need not be rerun on inputs it already has records for, if nothing that
produced those records has changed: the listener's sources, the runner, the adapter and
the input files, all by hash. Cite the records by hash instead. If any of them changed,
rerun: that rerun is the regression check.

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
- **Next**, as advice, including one line on the direction of travel: which parts of the
  listener you expect to survive the next stages (chords, recorded guitar, real music)
  and which will need replacing;
- your attribution.

Then:

- add a row to `reports/reports.json`, and run `node reports/export-report.mjs NNN`;
- add a row to the table in `reports/README.md`;
- add a ledger row whose conditions name you;
- update the research log: the current state, findings with their evidence, and the
  re-ranked questions. Record the resulting stopping count and budget state in the report (one
  line if unchanged) and point to it from the log.

If your experiment created or re-versioned an oracle, or an observation seam, make its
audit the top open question of your track, naming the version.

Every commit you make has a short body saying what changed and why, and names your
model and tool; `git log` should be readable without opening the report.

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

## 8. Running through a parent session (optional)

A user may start one session that runs the next step through subagents, or through
separate agent sessions it can message (herdr, for example), each with a fresh
context, instead of starting each session by hand. "Subagent" below means either. The
rules are unchanged: each subagent is one session, one model runs each experiment, and
an audit is done by a session that did not write the oracle. If you were asked to act as the parent, this is
your whole job:

1. **Do no work yourself.** Do not edit files, design, run or interpret. Read `CLAUDE.md`
   and the research log's current state and top question, only to check facts. The one
   exception: if the user asked for a batch, first land the research log's **Current
   batch** section (section 9), quoting their request and goal verbatim, and nothing
   else.
2. **Run the next experiment.** Launch one general-purpose subagent with exactly this
   prompt, adding nothing, since any summary or hint of yours would pass your
   interpretation on:

   > Read experiments/performance-listening/PROMPT_EXPERIMENTER.md and follow it. You
   > cannot ask the user questions: record anything that needs them in your report and
   > the research log. When you have landed and retired your worktree, stop, and reply
   > with what you did, what it showed, and anything awaiting the user.

   The one addition allowed is a final line naming the subagent's model and tool, for
   example "Your model and tool: Claude Fable 5.1 in Claude Code." If the log's top
   question is itself an oracle audit, skip to step 4.
3. **Check the facts** from git and the files, not from the subagent's reply. The report
   landed with its pre-registration section unchanged since the pre-registration commit,
   which reached `main` before the results; the ledger, the report registry and the
   research log were updated; no worktree of the experiment remains. If a check fails,
   or the experiment recorded an inconclusive or infrastructure outcome, stop and
   report.
4. **Run the audit, if one is due**: when the experiment created or re-versioned an
   oracle, or the log's top question is an audit. Launch a second general-purpose
   subagent **on a different model** from the experiment's, choosing a capable one
   (`fable` or `sonnet`, for example), with exactly this prompt:

   > Read experiments/performance-listening/AUDITING_AN_ORACLE.md and follow it. When you
   > have landed and retired your worktree, stop, and reply with your verdict case by
   > case.

   Give it nothing about the experiment except the same final line naming its model
   and tool. When the research log asks for an **implementation review** of an
   experiment, launch it the same way, on a model other than the experiment's, with:

   > Read experiments/performance-listening/REVIEWING_AN_IMPLEMENTATION.md and follow
   > it. When you have landed and retired your worktree, stop, and reply with your
   > verdict check by check.
 Then check that the audit file landed and the
   research log's audit question links it.
5. **Stop** before any further experiment, even if the audit agrees, unless the user
   asked for a batch: then return to step 2 for the next run, until the count is reached
   or the batch ends early under section 9. Do not run the process review yourself;
   after a batch, launch it as one more session (section 9). At the end, report to the
   user:
   what the experiment did and showed, anything awaiting their approval, and the audit's
   verdict case by case, quoting every disagreement or ambiguity in full. Subagents'
   replies are not shown to the user, so what matters must be in your report.

## 9. Batches

The user may ask for several experiments in a row, often five, without a review in
between, and may give the batch a goal, such as "start introducing different
instruments slowly whilst working to pass existing quality gates". The batch's goal is
a user direction, so it lives in the repository before the first run: a **Current
batch** section at the top of the research log's current state quotes the user's
request, gives the count, and is updated by each experiment ("run 2 of 5").

- A goal steers the choice of question; it never loosens the contract, the gates or a
  rule here. Earlier stages and controls must keep passing while the goal is pursued.
- Where the goal needs something only the user can grant, such as gates for a new
  stage, a wider range or a product decision, record the proposal in the report and the
  log, and either continue with work that does not need it or end the batch there,
  saying which. Never proceed on your own authority.
- An inconclusive or infrastructure outcome ends the batch. The user may reopen it:
  the parent quotes their words in the Current batch section, and the count continues
  from where it stopped (the batch of 030–034 was reopened at run 2 of 5).
- The last experiment of a batch, or the one that ends it early, closes the Current
  batch section: how far the goal got, and why it stopped. A process review of the
  whole batch follows ([PROMPT_REVIEWER.md](PROMPT_REVIEWER.md)). A parent session
  launches it as a separate session, on a model that ran none of the batch's
  experiments where one is available, with exactly this prompt plus the model line:

  > Read experiments/performance-listening/PROMPT_REVIEWER.md and follow it. You cannot
  > ask the user questions: record anything that needs them in your review entry and
  > the research log. When you have landed and retired your worktree, stop, and reply
  > with your verdict, what you fixed directly, and what you escalated to the user.
