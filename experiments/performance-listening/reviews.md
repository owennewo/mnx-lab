# Process reviews

One entry per process review, appended after each experiment, audit or batch, following
[PROMPT_REVIEWER.md](PROMPT_REVIEWER.md), formerly `REVIEWING_THE_PROCESS.md`. The table is the index; each review
has a short section below it. Append-only: a later review that disagrees with an earlier
one says so in its own entry.

**Rules ±** counts the process rules a review added and removed or relaxed, so the trend
is visible: a process that gains rules every time is getting heavier, not better.

| # | Date | Reviewed | Reviewer | Verdict | Fixed directly | Escalated to the user | Rules ± |
|---|---|---|---|---|---|---|---|
| R1 | 2026-09-30 | [022](reports/022-event-instruments.md) | Claude Opus 5.5 (1M context) in Claude Code | Held; two weaknesses | [1ed5e911](#r1-after-experiment-022) | Gates; flag reference tempo; dead-note verdict (decided) | +3 −1 |
| R2 | 2026-09-30 | [023](reports/023-instruments-decisions.md) and [audit 2](bench/oracle-events/audit-2.md) | Claude Opus 5.5 (1M context) in Claude Code | Held; four small fixes | [743f2b92](#r2-after-experiment-023-and-audit-2) | Control-assessment gate; the near-miss wrong score (decided) | +2 −1 |
| R3 | 2026-09-30 | [024](reports/024-event-chain-stage1.md) | Claude Opus 5.5 (1M context) in Claude Code | Held; cleanest run yet | [de3ef9cb](#r3-after-experiment-024) | None | +3 −0 |
| R4 | 2026-09-30 | [025](reports/025-single-hesitation.md) | Claude Opus 5.5 (1M context) in Claude Code | Held; model identity vague again | [Landed with this entry](#r4-after-experiment-025) | Outside review; several deviations per experiment; report weight | +2 −2 |
| R5 | 2026-09-30 | [026](reports/026-single-slowed-bar.md), post-R4 process changes and outside process check | Sol 6.1 (high) in Codex | Held; failure supported | [Landed with this entry](#r5-after-experiment-026-and-the-post-r4-process-changes) | Multiple substages still pending; no new decision needed for 027 | +0 −0 |

Reviews R1–R3 were given in conversation with the user and recorded here when this file
was created. The same reviewer wrote contract 2 and most of the process it reviewed.

## R1, after experiment 022

**Held.** The pre-registration landed before any evaluator code, with the hand-worked
oracle frozen in it; the pre-registration and every frozen file were unchanged
afterwards. The baselines' position-to-event mapping was fixed before they ran, with a
second, unscored mapping measuring how much the choice decides (40–45 points). A
contradicted prediction was recorded plainly, and a disclosed miscount (26 against 28
records). The oracle test was shown to bite by breaking two rules deliberately.

**Weaknesses.** The oracle and the evaluators had one author, so a shared misreading of
the rules would have been invisible: independent in procedure, not authorship. And the
final contract text had dropped the negative controls, the reviewer's own omission,
so stage 1 had no stretch where "not following" was the right answer.

**Fixed** in 1ed5e911 and the follow-up d23f27b3: the oracle audit
rule and [AUDITING_AN_ORACLE.md](AUDITING_AN_ORACLE.md); controls restored to every
stage; versioned instrument definitions allowed as contract files (a relaxation); the
optional parent-session runner. **Decided by the user:** gates approved for stages 1–3
with a duration floor and zero false findings on clean examples; variation judged
against the typical tempo; a distinct dead-note verdict.

## R2, after experiment 023 and audit 2

**Held.** Order, freezing and versioning were all correct; version-1 instruments and
oracle untouched; seven deliberate faults each failed the new oracle test. The audit ran
on a different model (Claude Fable 5.1), after 023 landed, checked all 66 records, and
recorded one honest ambiguity rather than choosing a reading. The parent session stopped
before 024.

**Findings.** The audit left the research log's current state stale, a gap in the audit
prompt. The wrong score `w1` was a semitone near miss, not unrelated: a hard control on
the happy-path stage, which 023 found and put to the user itself. The audit's ambiguity
needed settling without an oracle change, to avoid a re-audit loop. 023 edited 022's
label module in place (version 1 still reproduced) and the audit touched one README cell.

**Fixed** in 743f2b92: the audit prompt now updates the current state and may fill in the
oracle README's audit entry (a relaxation); the ambiguity settled by a clarification in
event instruments 2 that changes no number; stage 1's wrong score must be distant, by a
checkable rule. **Decided by the user:** the control-assessment gate approved; `w1`
moved to stage 2.

## R3, after experiment 024

**Held, the cleanest run yet**, by a different tool: Sol 6.1 (high) in Codex followed the
repository's procedure unaided. Order, integrity and reuse checks were all correct, with
baseline records byte-identical to 023's. The listener's unit tests used ideal tones and
hand-made sequences, not the stage-1 material, so its predictions were real ones. It
disclosed its own departure (set builder and listener written before the freeze, with
no listener run), flagged its vacuous pooled gates and easy control, and stopped before
stage 2.

**Findings.** Model identity was recorded vaguely, because a model often cannot verify
its own version. Its commits had subject lines only. Each stage passed by the simplest
possible listener risks a string of throwaway designs (this one's pitch detector works
only on pure sines).

**Fixed** in de3ef9cb: whoever launches a session states its model and tool, recorded as
stated; commits carry a short body naming them; each report's Next names what should
survive the coming stages; 024's attribution corrected. **Trend:** R1–R3 added eight rules
and relaxed two. The next reviews should add fewer, and look for any not earning their
place.

## R4, after experiment 025

The first review run from [REVIEWING_THE_PROCESS.md](REVIEWING_THE_PROCESS.md). Light
review, sections 3.1–3.3 and 3.5, with a look at direction.

**Held.** The pre-registration landed at 17:30:55, before the set builder, the freeze
or the runner. Codex's session log shows the order the report claims: builder, freeze
(`freeze.json` 17:33:14), then the runner, derived from 024's by substitution, then the
run one second after its commit. No lines were removed from the pre-registration. The
only bench files that changed are two new ones. Recomputed hashes match: the
`contract2-hesitation-v1` manifest (`acf11389…`) and all 99 of its assets, and the
stage-1 v1–v3 manifests and v3's 19 assets. `export-report --check` passes for
022–025. The worktree and branch are gone. The report is candid: it measures the
10–20 ms abstention when sound resumes even though the gate passes, and it does not
credit the pause for baseline failures whose parents already failed. It calls the new
examples correlated transformations of two scores and makes no generalisation claim.

**Findings.**

- **Model identity is vague again, after R3's fix.** The record says "GPT-6 in Codex
  (exact version unverified)". Codex's session record says `gpt-6.1-sol`, effort
  `high`: Sol 6.1 (high), the same as 024. The user launched a Codex parent without
  naming a model, and the parent passed on what its instructions told it ("based on
  GPT-6"). Asking the launcher did not fix this, because the launcher could not see the
  answer either. The tool's own log could.
- **A run's pinned commit can be orphaned.** 02237d15 landed during 025, so the
  landing rebase rewrote the commit the run had pinned (`ed842e7e`). The experimenter
  noticed and pushed an annotated tag, `g025-single-hesitation-source`. Without the
  tag, the exporter would have fallen back to the working tree and failed once those
  files were next edited. 024 was spared only because `main` did not move while it ran.
- **Runs and records are getting heavier.** Wall time went 30, 74, 75, then 365 s from
  022 to 025. The HTML report went 0.15, 0.47, 0.87, then 5.0 MB, and the run summary
  0.09, 0.33, 0.64, then 3.8 MB. The exporter embeds the whole summary in the HTML, so
  every run is committed twice. Most of the time goes to the frozen time warpers
  (sustained ratio about 0.2, against event-chain's 0.002). They reran all 24 stage-1
  regressions only to reproduce their g024 records byte for byte.
- **Budget restatement is heavy.** The pre-registration, results and log each restate
  qualification budgets that have not moved since 022.
- **Direction.** The loop measures what the user asked for: 025 reports the user's own
  example (s2 at 45 with a 1 s pause) as a slow overall tempo with only bar 2 flagged.
  But 025's prediction came from reading unchanged code, and every prediction held. The
  pause was digital silence after the note's written end, the easiest hesitation there
  is. A hesitation on a held note, which is what a guitarist does, remains untested. The
  report's limits come close to saying so ("no claim for … ringing guitar"). Stage 2 has
  eight more single deviations on pure sines. Several, the slowed and rushed bar for
  a start, look passable by construction. At one experiment each, with regressions
  growing, the loop risks slow confirmation, not discovery. No real-music thermometer
  has run under contract 2; with a sine-only pitch front end it would say nothing yet.

**Fixed** directly: [RUNNING_AN_EXPERIMENT.md](RUNNING_AN_EXPERIMENT.md) now has a run
tag its pinned commit `<run-id>-source` and push the tag (+1). It lets an unchanged
listener, such as a frozen baseline, cite its earlier records by hash instead of
rerunning them (a relaxation, −1). It lets unchanged budgets be one line (a relaxation,
−1). [REVIEWING_THE_PROCESS.md](REVIEWING_THE_PROCESS.md) now checks model identity
against the tool's session log, and has the reviewer update the research log's
"review due" sentence (+1; the audit prompt had the same gap in R2). 025's attribution
and ledger row now carry the session record's identification, added beside the
original.

**Escalated to the user:**

1. **An outside review of the process by a different model.** This is the fourth review.
   All four were by Claude Opus 5.5, which also drafted contract 2 and most of the
   process. Section 4 asks for one every third review.
2. **Several single-deviation substages in one experiment.** Each example would still
   carry exactly one deviation. A listener change would still get an experiment of its
   own. This changes the order of work, so it is the user's call. Recommended for
   deviations the unchanged listener is predicted to pass.
3. **Report weight.** Recommended: the exporter links the run summary instead of
   embedding it, and summaries keep per-example detail in the private records, named by
   hash. This is tooling, not a contract, but it changes what a reader of a report can
   see without the private data.

**Could not check:** whether the parent's prompt to the subagent named a model. Codex
stores that message encrypted.

**Trend:** R1–R4 added ten rules and relaxed four. This review added as many as it
relaxed.

## After R4: decisions

The user took escalation 3, lighter reports: the exporter now links each run summary
instead of embedding it, and a run summary stays a few hundred KB at most, with detail in
the private records. Report pages for 022–025 went from up to 5 MB to about 30 KB.
Escalations 1 (an outside review of the process) and 2 (several single-deviation
substages per experiment) remain with the user. At the user's request the prompts were
renamed `PROMPT_EXPERIMENTER.md` and `PROMPT_REVIEWER.md`; the old names are pointers.


## R5, after experiment 026 and the post-R4 process changes

**Held: the failed substage is the correct verdict.** Reviewed all landed work since
R4 (`3800fef5`): identity/reuse clarifications, prompt renames and lighter reports,
then 026. No experiment or audit was mid-flight; 026's worktree and branch are gone.
This also supplies R4's requested outside process review: Sol 6.1 (high) in Codex,
confirmed by this review session `01a0f367-ce53-7131-9438-73181c74c0b3`, differs from
Claude Opus 5.5, which authored the process and R1–R4. It is a separate session from
026, but the same model as its experimenter, so it adds process-author independence,
not a different-model replication or a new oracle audit.

**Integrity.** Main's reflog puts pre-registration `23508443` on main at 18:46:53 BST.
The experimenter's session log confirms generation completed at 18:49:13, before
writing the runner at 18:53:33; execution started at 18:54:27 and completed at
19:01:21. Results landed at 19:13:46. The report starts with the exact bytes of its
pre-registration. Git's changed paths leave old listeners, baselines, instruments,
contracts, oracles and archive untouched. Both source tags resolve to their reported
commits and exist on origin.

Recomputed all five current-series manifest hashes and their asset hashes, resolving
022's retired absolute score paths to the same committed source bytes. Checked 026's
600 fresh detailed records, five regression detail bundles, validation and diagnosis
artifacts, all 864 reused private artifacts, and the 153 producer files against their
recorded hashes. The checker covered 1,818 distinct files. Independently re-evaluated
720 reused and 600 fresh records with the unchanged instruments: following,
assessment, per-example gates and combined pools match. No listener ran. The report
exporter reproduces 022–026 and checks every pinned source hash. Attribution is now
corrected beside 026's original report/ledger identification, preserving the frozen
text.

**Rules and claims.** One deviation, both placements, controls and prior substages;
no changed listener, tuning, gate relaxation or new oracle. The two missed F4 events
fail the pre-registered per-example gates despite 318/320 aggregate reaches. All
40 assessments, 80 controls and 144 earlier event-chain examples pass. The measured
mixed-window G4 observations support the live-state diagnosis; phase versus frame
placement remains explicitly an inference. The committed post-run component trace
explains existing failures without a repair or another comparison. The 19 one-sample
note-length differences are disclosed and fall within the pre-registered rounding
allowance. Reused timing/causality is honestly cited as old evidence. Plateau 0→1,
unchanged qualification access and the stop before rushed bars follow the recorded
rules; no audit is due.

**Direction and the process as a whole.** The loop now separates cursor correctness
from the player's timing/note assessment, and a contradicted happy-path prediction
has exposed a real acoustic/state failure instead of being explained away. This is
useful progress toward the user's objective. Nevertheless, all results remain short,
distinct-pitch sine development transformations. Ringing hesitation, missing/wrong/dead
notes, chords and real guitar are still untested; no real-music thermometer has run
under contract 2. The report credits none of them. The median's short-piece asymmetry
can flag the unchanged bar as fast; that follows the approved rules but remains a
practice-cue limitation to examine before a product decision. No contract change is
justified by this review.

The lightening worked: report pages are now 23–31 KB and 026's public summary is
366 KB, with detail linked by hash. Historical large summaries were preserved.
Regression reuse avoided rerunning unchanged evidence, but 026 still took 414 s
against 025's 365 s: 40 new slowed performances contain 354.6 s of audio, plus
controls and comparator runs. This is continuing iteration cost, not evidence that
the listener got slower. Use the existing unchanged-record reuse allowance in future
runs where eligible; new listener versions still need their regressions.

**Fixed directly.** APPROACH still said variation uses overall tempo, demanded a
real thermometer every run, and said timbre enters early despite contract 2's ordered
sine/guitar stages. Aligned those stale passages with the already approved contract.
Updated the research log's review-due sentence and recorded the attribution correction;
regenerated only 026's HTML. No gates, verdicts, rankings or frozen evidence changed.

**Recommendation.** Continue the existing question for 027 under unchanged gates.
R4's multiple-single-deviation-substage proposal still needs the user's decision;
it does not authorise skipping this failed substage. Its outside-review request is
addressed here, and its report-weight decision is implemented. No new user decision
is needed for the bounded investigation already ranked by 026.

**Could not check.** No independent listener execution or real-player replication;
no complete re-audit of the frozen oracle's arithmetic or archived private sets.
Repository hashes and the session log establish recorded access and execution, not
proof that no unrecorded private-data access occurred. No microphone/mobile latency
or transfer claim can be checked from this evidence.

**Trend:** +0 −0. These are corrections to stale descriptions of existing approved
rules. R1–R4 added ten rules and relaxed four; this review adds none. The independent
oracle audit, frozen pre-registration, separate outputs and explicit stops are earning
their place. Further procedural weight is unwarranted on this evidence.
