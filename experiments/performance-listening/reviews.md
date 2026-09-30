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
| R6 | 2026-09-30 | [027](reports/027-live-confirmation.md) and post-R5 user decisions | Sol 6.1 (high) in Codex | Held; bounded repair supported | [Landed with this entry](#r6-after-experiment-027-and-the-post-r5-decisions) | Different-model milestone review remains due; no new decision for 028 | +0 −0 |
| R7 | 2026-09-30 | [028](reports/028-other-bars-suite.md) | Sol 6.1 (high) in Codex | Held; mixed verdict supported, oracle coverage incomplete | [Landed with this entry](#r7-after-experiment-028) | No new decision; different-model milestone review remains due | +1 −0 |
| R8 | 2026-09-30 | [audit 3](bench/oracle-events/audit-3.md) and [029](reports/029-oracle-coverage.md) | Sol 6.1 (high) in Codex | Held; audit procedure needed clarification | [Landed with this entry](#r8-after-audit-3-and-experiment-029) | No new decision; different-model milestone review remains due | +0 −1 |

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

## After R5: decisions

The user adopted four decisions and a new rule, recorded in
[contract 2](contracts/development-contract-2.md): a stopping rule counting listener
versions that fail the lowest open substage; bar flags judged against the other bars,
only with at least three of them (026 showed the whole-piece median flag the unchanged
bar of a two-bar piece); grouping of single-deviation substages the unchanged listener
is predicted to pass; and **the rising tide**, which keeps routine runs lean: the open
substages, sentinels chosen by rule from passed ones, gimmes retired to sweep-only once
harder evidence covers the same capability, and full sweeps at milestones. The frozen
baselines, nearly all of 026's run time, are now sweep-only. R5 counted itself as R4's
outside process review; it was a different model from the process's author, but a
light review of 026 rather than a milestone review of the series, and the same model as
026's experimenter. A milestone review by a different model remains due at the next
stage passed.

## R6, after experiment 027 and the post-R5 decisions

**Held: the bounded repair passes under its frozen rules.** Reviewed everything
landed since R5 (`48c7c750`): the user's approved rising tide, stopping rule,
other-bars reference and grouped substages (`c86bc723`), then 027. No experiment or
audit was mid-flight and no batch was active. Experiment 027's worktree and branch
are retired. Reviewer: **Sol 6.1 (high) in Codex**, session
`01a0f3e4-0795-73f0-9f94-7befc84ce4b4`. Experimenter's separate session
`01a0f3e3-8399-7123-bbdd-4cac5d5ec481` records `gpt-6.1-sol`, effort `high`, matching
its report, ledger and commit bodies. This is session independence, not a
different-model replication.

**Integrity and procedure.** Main's reflog puts pre-registration `4ebc3cad` on main
at 21:05:26 BST; the session log puts candidate creation after it, at 21:07:39.
The initial frozen runner executed at 21:14:14, the technical rerun at 21:14:58,
and results landed at 21:21:44. The report still begins with the exact
pre-registration bytes. The sole post-freeze code change normalizes one Git
provenance lookup path; candidate bytes are identical across both execution commits.
The failed attempt, private log and failure artifact agree that zero candidate
examples ran before that repair. D1 explicitly permits this technical rerun with a
new ID. Both source tags resolve to the reported commits and exist on origin.
No tuning, changed gates, new oracle or unauthorized contract change occurred.

Recomputed all five current-series manifests and their assets, resolving 022's
retired worktree paths to the committed source bytes. Checked the successful and
failed attempts, fresh detail/comparison bundles, and recursively cited private
artifacts: **2,365 distinct files**, plus **468 pinned source-hash checks** across
022–027. The comparator's 155 current producer files, 165 historical source pins
and 986 private artifacts match their records. Earlier instruments, oracles,
listeners, archive and product files are untouched by 027. The contract amendment
is the user's recorded policy change, explicitly excluded from claims of unchanged
producer bytes.

Independently re-evaluated **264 old and 264 fresh examples**, without running a
listener. Following, assessment, per-example gates, substage pools, combined pool
and fresh cost gates reproduce. The old two cursor failures remain failures; all
264 new examples pass. Counts reproduce: 608 event reaches/notes, 520 intervals,
176 controls, 1,584 recorded fresh prefix checks, 264 identical musical reports and
evaluations, and only two ID-only report differences. All 606 shared reaches add
10 ms; every hesitation adds 10 ms of resumption abstention. Report 027's exporter
reproduces and verifies both runs' pinned sources. The sandbox blocked its Git
subprocess reads on the first check; the permitted unsandboxed check passed.

**Claims and direction.** The experiment repairs prevention on two known sine
transients; it does not claim recovery after commitment, a stronger pitch detector
or independent generalisation. It honestly names the longer hesitation abstention,
200 ms scoring allowance, easy distant controls, vacuous omission/extra-note and
wrong/dead/missing recall gates, and reused comparator timing. Assessment still
uses instruments 2's legacy flags, exactly as the user's explicit order for 027
allows; it is not presented as the new other-bars rule. Stage 2 remains incomplete.
The failing-version count stays zero, qualification access is unchanged, and the
stop before 028's instrument work and audit is correct.

The rising tide has already paid: evaluation takes **19.480 s**, down from 026's
414.245 s, with the complete 264-example repair/regression set still present.
The speedup comes from sweep-only baselines and verified reuse, not an algorithm
speed claim. No passed set or failing example was retired, no sentinel was selected
by hand, and no full sweep is overdue: 026 is the last complete comparison. The
ordered progression still serves the user's cursor and end-of-piece judgement;
ringing hesitation, omissions, note errors, chords and recorded guitar remain
unmeasured, as the report says.

**Fixed directly.** APPROACH still demanded the whole historical scoreboard despite
the rising tide and omitted the approved other-bars reference. The harness overview
still prescribed early timbre, an every-run real thermometer, two sequential output
milestones, and a handover bound only by a predecessor's report. Aligned those
passages with the existing contract and APPROACH. Updated the bench code map through
027 and its already-approved control gates, and the log's review-due sentence.
No frozen report, verdict, data, code, instrument or contract was edited.

**Recommendation.** Continue the approved 028 instrument/suite step, followed by
its independent oracle audit. Its operational definitions should make cross-gate
sentinel margins, ties and sweep cadence reproducible; the two repaired examples
must receive the same selection rule as every other example. This is work within
the existing contract, not a request for new gates or a change of question. No new
user decision is needed now. R6 is every third review: the different-model review
of the whole process remains recommended at the next stage-completion milestone,
as already recorded after R5.

**Could not check.** No independent listener execution, oracle arithmetic re-audit,
archived private-set sweep, real-player transfer or microphone/mobile latency.
Recorded prefix checks were verified, not independently rerun. Git, hashes and the
session log do not establish absence of unrecorded private-data access.

**Trend:** +0 −0; these are stale-description and bookkeeping corrections to already
approved rules. R1–R4 added ten rules and relaxed four; R5–R6 add none. The evidence
supports continuing the lighter process rather than adding procedure.


## R7, after experiment 028

**Held: the mixed result is the correct stop.** Reviewed all three commits since R6
(`78f3339f`), through `db0cddb4`. No experiment or audit is mid-flight, no batch is
active, and 028's worktree and branch are retired. Reviewer: **Sol 6.1 (high) in
Codex**, session `01a0f41f-58f2-7012-8d70-80ae53ee6224`. The separate experimenter
session `01a0f406-46ce-7632-8cd6-6aed506ef84a` records `gpt-6.1-sol`, effort
`high`, matching its report, ledger and commit bodies. This is session independence,
not a different-model oracle audit.

**Integrity and scope.** Main's reflog places pre-registration `309c845e` on main
at 21:42:46 BST; the session records instrument implementation after that, at
21:45:31. Execution starts at 21:53:50 and ends at 21:54:14; results land at
22:00:39. The report begins with the exact pre-registration bytes. Instruments 3,
s3, oracle 3 and its freeze remain byte-identical to their pre-registration commit.
Changed paths leave earlier definitions, oracles, listeners, baselines, archive and
product code untouched. The execution tag resolves to `ef679158` locally and on
origin. One instrument run, no listener execution, no tuning or technical rerun,
no new gates, and unchanged stopping/qualification state follow the frozen scope.

Recomputed all six current-series manifests and their assets, resolving retired
absolute score paths to the same committed bytes. Checked all cited current-series
private artifacts and 028's validation/suite artifacts: **2,382 distinct hashed
files**, plus **670 pinned source-hash checks** across 022–028. Independently summed
per-beat durations for all 84 new performances: all **5,376** label/boundary checks
match, and all 84 silence and 84 wrong-score pairs have the stated length/content.
The committed suite record is byte-identical to its private artifact. Report exports
022–028 reproduce with pinned sources; the initial sandboxed exporter could not
read Git subprocess streams, and the permitted unsandboxed check passed. No listener
or experimental runner was executed by this review.

**Claims and the rising tide.** D2 is supported: the recorded validation preserves
B1's disagreement rather than calling green implementation tests oracle agreement.
The report expressly leaves independent arithmetic resolution to the audit and
claims no listener pass under version 3. I recomputed normalized headroom from all
264 historical detailed measurements without invoking an evaluator or listener;
all 19 sentinel IDs and margins reproduce under the declared selection rule.
Neither repaired F4 example was inserted by hand or retired to conceal its former
failure. Historical passes remain instruments-2 evidence, confirmation is absent,
and one incumbent evaluation cannot justify any performance retirement. The
three-evaluation rule and sweep-only baseline exception remain distinct. The full
sweep stays due by 031, earlier at stage completion, new gates or batch end.

**Finding: frozen oracle coverage is incomplete.** As 028 itself discloses, routine
and sweep plans and missing-control/duplicate-ID refusals have only post-freeze
behavioral tests; report@3 summary-error/null handling lacks a frozen bad-report
case. These tests cannot supply the independent hand-worked answers required by
the contract. B1 is therefore not the only work the audit/correction handoff must
carry. This does not justify changing 028's mixed verdict or frozen oracle, and
no listener has yet been judged by the incomplete instrument.

**Fixed directly.** Clarified the existing audit coverage obligation in
[AUDITING_AN_ORACLE.md](AUDITING_AN_ORACLE.md): a rule without a frozen hand case
is uncovered, not agreement, and joins disagreements/ambiguities in the next
numbered resolution question. An auditor must not invent the missing oracle or
substitute implementation tests for it. Updated the research log with this review
and restored its findings to one Markdown table. No verdict, pre-registration,
contract, definition, code or frozen evidence was edited.

**Direction and recommendation.** The instrument work pursues the user's approved
other-bars assessment and cheaper regression suite; it neither trades gates for
speed nor presents data preparation as listener progress. The recorded 24.482 s
is preparation/validation time; the 26,731-byte public summary stays small. The
other-bars reference still has endpoint and multiple-deviating-bar limitations,
which B4 and B7 expose openly. All evidence remains short monophonic sine development
material; missing-note recovery, ringing hesitation, chords, recorded guitar and
real players remain untested. Continue the already-ranked independent oracle@3
audit, preferably on a different model, then a numbered correction addressing its
findings and missing frozen coverage, followed by audit before listener evaluation.
No new user decision is needed. The different-model milestone review of the whole
process remains recommended at the next stage completion.

**Could not check.** This is not a complete independent oracle arithmetic audit,
listener replication, archived private-set sweep, real-player transfer test or
microphone/mobile latency check. File hashes and session records establish the
recorded provenance, not absence of unrecorded private-data access. Historical
cost and causality are verified records, not fresh measurements.

**Trend:** +1 −0, one explicit tightening of the audit handoff for uncovered rules;
R5–R6 added none. R1–R4 added ten rules and relaxed four. The frozen counterexample
shows that independence and preserving failures earn their place; no additional
run stage, approval request or recurring checklist was added.


## R8, after audit 3 and experiment 029

**Held: oracle correction and implementation agreement are supported; audit 4 is
still required.** Reviewed all four commits since R7 (`da8eea6e`), through
`d166fe5b`. No experiment or audit was mid-flight, no batch was active, and both
worktrees and branches are retired. Reviewer: **Sol 6.1 (high) in Codex**, session
`01a0f44b-5209-7793-9ad5-0f8319d5122d`. Experimenter session
`01a0f43c-3f67-76e1-9b00-cac85a7434b0` records `gpt-6.1-sol`, effort `high`,
matching 029's report, ledger and commits. Audit3's separate Claude Code session
records `claude-fable-5-1`, effort `high`: different-session and different-model
independence from the oracle author. This review is a separate session from 029,
not a different-model replication or oracle audit.

**Integrity and claims.** Main's reflog places audit 3 on main at 22:26:56 BST and
029's pre-registration/oracle freeze `9cba7778` at 22:39:34. The experimenter's log
places loader/validation creation at 22:41:29, runner creation at 22:43:33 and the
committed run at 22:44:22–23; results landed at 22:49:03. The report begins with the
exact pre-registration bytes. The oracle4, freeze and instruments4 files still
match their pre-registration bytes. Changed paths preserve earlier definitions,
evaluators, listeners, baselines, archive, scores and product code. The source tag
resolves to `65376fbf` locally and on origin. The failed pre-run git-add command
never executed the runner; no instrument attempt failed or reran.

Verified **242 source pins** against the execution commit, **214 inherited files**
against the pre-registration tree, and **2,537 distinct files** through current-series
hash citations, including all six manifests and **496 asset entries**. Retired
worktree score paths and inherited parent-set references resolve to the same hashed
bytes. The private attempt, oracle comparison and historical validation match their
public citations. All 110 stored checks and eight wrong-answer probes have the
reported outcome and group counts. Report 029 reproduces with every pinned source
hash; the initial sandboxed exporter could not read Git subprocess streams, and
the permitted unsandboxed check passed. No numbered runner or listener was executed
by this review.

The B1 correction preserves endpoint attribution and changes its informational
reference/ratio, not its verdict or clean status. B11's new exact inputs avoid the
old rounded-onset ambiguity without rewriting it. Author agreement is correctly
labelled pending independent audit; wrong-answer perturbations establish assertion
sensitivity, not independent arithmetic or evaluator-mutation coverage. The
missing-evidence and parent-score adapters are openly synthetic, and retirement
record validation is openly vacuous because no performance set retired. These
limits qualify the claim rather than contradict D1. No gates, scope, contract,
listener version, stopping count or qualification access changed.

**Audit process findings and direct fixes.** Audit3's tools read no evaluator code
or tests during re-derivation, and ran only arithmetic calculators then. After the
audit commit, its mandatory repository gate ran 369 bench tests and static checks.
Thus its “nothing was run” wording and the prompt's absolute test prohibition
conflicted with the required landing procedure. Clarified the prompt: the mandatory
gate may run only after the completed audit is committed, its output supplies no
audit evidence, and recorded arithmetic/verdicts cannot be rewritten from it.
Added a provenance note beside the audit's original wording, preserving its verdicts.

Audit3 checks every new oracle 3 case, but does not freshly sample inherited cursor,
note and control rules. Audit2 remains historical evidence; it is not a fresh
inherited-rule audit by audit 3. The prompt now makes explicit that inherited samples
may come from earlier oracle files and belong in the audit table. It also clarifies
that research-log reading identifies the current oracle rather than consulting
findings or completed run results: audit 3 read the whole log, including reported
findings, an avoidable exposure to the author's interpretation. B1's disagreement
was already disclosed in the allowed oracle README; B11 and the coverage gaps were
independent findings, but the recorded reading cannot establish complete isolation
from author results. Audit4 must follow the narrower reading boundary. Corrected
question14's stale implication that B1 changes gate-read verdicts, updated finding17's
audit bookkeeping, and recorded this review in the current state.

**Direction and the rising tide.** Instrument work addresses the user's other-bars
assessment and cheaper regression suite, without substituting arithmetic agreement
for listener progress. Independently recomputed normalized headroom for all 264
historical event-chain@2 examples and reproduced all 19 sentinel IDs and margins.
No weak example was retired or manually avoided; historical instruments2 passes
remain unconfirmed and await revalidation. The 1.086 s validation and 28,791-byte
summary are small, but are not fresh listener cost measurements. The full sweep
remains due by 031 after 026, earlier at stage completion, new gates or batch end.
The loop still has no contract 2 evidence for ringing hesitation, missing-note
recovery, wrong/dead notes, chords or recorded guitar; 029 claims none.

**Recommendation.** Continue the already-ranked independent audit 4, including
changed/new cases and inherited-rule samples. Do not treat 110 implementation checks
as 110 independent hand cases: some are adapter expansions or reversed-order repeats.
Record any absent inherited case, including the README's known ≥20-event by-event
branch, as uncovered rather than assuming earlier audit agreement supplies it.
Resolve any audit finding in a numbered experiment before listener judgment. No new
user decision is needed now. The already-recommended different-model milestone
review of the whole process remains due at the next stage completion.

**Could not check.** This is not a complete oracle arithmetic re-audit, listener
replication, archived private-set sweep, real-player transfer or device-latency test.
Historical cost/causality are records, not fresh measurements. Session logs establish
recorded tool use and attribution, not absence of unrecorded evidence access.

**Trend:** +0 −1. The conditional landing-gate exception relaxes an absolute
procedural prohibition without reducing independent evidence. Inherited sampling,
reading boundaries and bookkeeping clarify existing obligations. R7 added one rule;
R5–R6 added none, and this review removes a conflict rather than adding a new stage
or approval flow. Independence and preserving counterexamples still earn their place.
