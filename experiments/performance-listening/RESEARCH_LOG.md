# Research log

The entry point to the performance-listening experiment. It answers three questions
for a person or a resuming loop driver: what do we currently believe, on what evidence,
and what is the next question. It is the only file in the experiment that is rewritten
in place. No other document restates the current state: the README, the report index
and the evidence records link here instead. `ledger.md` holds the history, one
append-only row per run; `research/` holds one note per source read; a run's report
holds its numbers. This file points at all three and repeats none of them.

This log began on 2026-09-30 with [development contract 2](contracts/development-contract-2.md).
The first series, experiments 001–021 under contract 1, is archived in
[archive/ladder-1/](archive/ladder-1/README.md), with its own
[research log](archive/ladder-1/RESEARCH_LOG.md). Only the lessons below carry over.

How to maintain it:

- **Current state** is a few sentences, rewritten whenever an experiment lands. It says
  where the work stands, which listener is current, and what the last result changed.
  No figures.
- **Findings** are one row each. A finding states a belief and cites the evidence that
  supports it: a research note, a ledger row, or a per-experiment write-up. A row
  without evidence is a hypothesis and belongs under open questions instead. When
  later evidence contradicts a finding, its status becomes `superseded` and the row
  gains the evidence that did it; the row is never deleted or reworded to fit.
- **Open questions** are ranked by the contract's order of work first, then by how much
  uncertainty an answer would remove. The top row is the next question. While a
  challenger track is open, each track's highest open row is that track's next
  question, as the contract's challenger section keeps the incumbent's questions in
  their rank; which track runs next is the user's call or a batch's goal. A question
  that becomes a finding moves down with its evidence; one that a budget closes is
  marked `stopped`, with the reason.
- A finding's numbers stay in the report it cites.
- Every commit that adds a ledger row updates this file in the same commit, even if
  the update is only to the current-state paragraph.
- **This file is the handover.** Each experiment may be run by a different model, and
  the incoming model reads this whole file, including the inherited lessons, before
  choosing its question. A model's private memory is not handover state.
  [APPROACH.md](APPROACH.md#who-runs-an-experiment-one-model-one-experiment) sets out
  the procedure.

## Current state

<a id="current-batch-one-formal-claim-of-5-then-held-out-050051"></a>

### Current batch: one formal claim of @5, then held-out, 050–051 (closed at 2 of 2)

Opened 2026-10-05 by the user, after the allocation batch's closing review. Parent:
Claude Opus 5.5 in Claude Code; experimenter: Dave, GPT-6.1-Sol (high) in Codex, a
fresh session per run. The parent's summary of the position: the untraced formal
sweeps 043 and 045 each stalled (about 280–340 ms on feeds with no inference) while all
four traced arms of 044 and 046, one at full length, ran clean; `basic-pitch-chain@5`
is output-identical to the challenger 045 judged and cuts explicit model-window and
output-copy allocation by 98% and 80%. It recommended one fresh formal stage claim with
@5 on a quiet host under unchanged gates, and if that stalls again, running the same
claim on a second machine instead of pursuing the stall on this laptop. The user:

> Lets do your recommendation

So: **050** is the formal guitar stage-1 and silent-hesitation claim of @5, both outputs
and every control on all four development guitars, on a quiet host as
[the second amendment](contracts/development-contract-2.md#amendment-2026-10-05-host-stalls-guitar-sweeps-sentinels-and-the-outside-review) defines it, with the incumbent on every example and the
frozen baselines on stage 1's clean examples (question 54). If it passes, **051** is the
held-out run, once (question 32); then the sentinel instrument and its audit (question
43), the outside review at promotion by a model new to the loop (GPT-6-Sol has now
reviewed in it, so not that one), and the user's decision. If 050 fails on a stall,
the batch stops: the next step is the same claim on a second machine, which only the
user can provide. **Count: two.** The `guitar-faust` agent stays paused while a formal
run measures.


**Run 1 complete: [050 formal @5 claim](reports/050-challenger-optimized-stage.md),
GPT-6.1-Sol (high) in Codex, D1.** The retained optimized listener passes both outputs
and every control on all development guitars on a valid quiet host, with frozen live
payloads and fresh assessments reproduced. The incumbent fails each corresponding
substage. Conditions (a)/(b) hold; (c) remains untouched. Historical 043/045 failures
and 046 no attribution stand: this pass does not establish a historical stall repair.
Two reader-only corrections preserve their failed checks and change no measurement.

**Run 2 complete: [051 one-shot held-out confirmation](reports/051-challenger-heldout-confirmation.md),
GPT-6.1-Sol (high) in Codex, D1.** The unchanged challenger passes both outputs and
every control on every held-out guitar on a valid quiet host. First read-only verification
agrees with saved evidence; development sweep evidence from 050 is reused only after
producer/input/artifact hash checks. Condition (c) now holds alongside 050's (a)/(b).
No tuning, repeat, listener version, instrument, incumbent or sentinel change.

**Closed at 2 of 2.** The one-shot confirmation budget is consumed. The three sounds
are now examined confirmation evidence, not untouched evidence for another claim.
Question 43, the sentinel instrument and its independent audit, is next before its first
selection. The closing outside review by a model new to this loop remains due before
the user's promotion decision; this experimenter supplies neither. Historical stalls
remain unattributed. [051 resulting state](reports/051-challenger-heldout-confirmation.md#resulting-stopping-count-budgets-and-evidence-access)
records unchanged stage stopping/version/development comparison counts and unused
qualification/reserved/final evidence. Event-chain@3 and the historical suite remain
unchanged. The standing guitar-faust pause/release decision remains with user/parent now
that batch timing is finished; microphone gates, qualification and Studio decisions are
future user work. No user question was asked. This author lands, retires and stops.

<a id="current-batch-allocation-optimizations-at-most-3-experiments"></a>

### Latest batch: allocation optimizations, closed at 3 of 3

Opened after 046 and its independent reviews by the user's direction:

> ill follow your recommendations

This accepts the preceding recommendation:

> My recommendation is to evaluate the buffer reuse and unused-output copies first, each separately with output-parity and allocation measurements. Full DSP caching is the more involved follow-up. That would require reopening the stopped continuation.

**Goal and order:** reopen for the identified allocation/work reductions: first input/window
buffer reuse; then eliminating copies of unused onset/contour outputs; then the more
involved full-DSP caching follow-up, only if the unchanged normalization and numerical
contracts can be preserved. At most three numbered experiments, one change per new
version, beginning with the next unused number (047 if still unused). Each experiment
chooses and pre-registers its own bounded method and measures output parity and
allocation/work savings independently. Preserve frozen predecessors and compare with
the appropriate unchanged version; do not combine unmeasured changes.

This is a new optimization goal after the closed attribution continuation. Historical
stall reproduction is not a prerequisite for evaluating avoidable allocations, and a
resource reduction is not a claim to have repaired the historical stalls. 043/045's
formal failures and 046's D3 stand. The accepted work does not authorize a new formal
stage claim, held-out confirmation, promotion, new numerical gates, microphone or
Studio work. The 200-ms deadline, existing gates, normalization/output contracts and
protected-evidence restrictions remain unchanged.

**Bound and stops:** complete the three candidates in order where the evidence and
contract permit it, retaining only demonstrated improvements with the required parity.
An inconclusive/infrastructure outcome, output-parity failure that cannot be resolved
within the frozen pre-registration, unsupported contract change, or a contract stopping
condition ends the batch and records what awaits the user. A valid negative result is
recorded honestly under its fixed decision rule, without a favorable redraw. DSP caching
that needs changed semantics is deferred rather than adopted. Existing stopping counts
and budgets carry over; reopening never resets them. Any new oracle requires its
independent audit before judgment. After the last experiment or an early stop, an
independent process review closes the batch. Each experiment lands and retires before
the next begins; the final gate must finish successfully before any merge/push.

**Roles and status:** GPT-6.1-Sol (high) in Codex coordinates only and lands this Current
batch record. Fresh GPT-6.1-Sol (high) in Codex sessions run one numbered experiment each;
audits and the closing review use independent sessions/models.

**Run 1 complete: [047 input buffers](reports/047-challenger-input-buffers.md), D1 resource variant.**
The separately named live storage variant preserves complete development-corpus tensors,
outputs and causal prefixes while removing recurring explicit window/raw-slice allocation.
It becomes the development parent for the next independent unused-output-copy experiment;
event-chain@3 remains incumbent. This is no historical stall repair or formal stage pass.
[047's resulting state](reports/047-challenger-input-buffers.md#resulting-stopping-count-budgets-and-evidence-access)
carries stage stopping counts unchanged and records the new resource version/comparison,
unused technical repeat and untouched protected evidence. Record-only path/reader repairs
preserve the raw writer and failed read-only verification; no inference was repeated.
The batch remains open at **2 of at most 3**, closing process review due at its end.
This current direction answers the prior reopening decision (question 48); the
experimenter updates the ranked questions when its record lands. The standing
`guitar-faust` pause/release decision is unchanged; timing sessions verify the required
host conditions rather than assuming exclusivity. Any user-dependent work is recorded
in the report and research log without asking questions.

**Run 2 complete: [048 unused output copies](reports/048-challenger-output-copies.md), D1 resource variant.**
The additive note-only live bridge preserves complete fresh request note tensors, inputs,
live payloads and causal prefixes while removing copies of unused onset/contour outputs.
The graph still computes all outputs and full normalized DSP; offline @2 remains unchanged.
This variant becomes the development parent for the third approved, independently
pre-registered contract-preserving DSP-cache question. Event-chain@3 stays incumbent;
no speed, historical-stall repair or formal stage claim. [048 resulting state](reports/048-challenger-output-copies.md#resulting-stopping-count-budgets-and-evidence-access)
carries unchanged stage stopping and protected access, one resource version/comparison
and unused technical repeat. First read-only verification passes without record repair.
Batch open at **2 of at most 3**; independent closing process review follows its final
experiment or early stop. No new user decision blocks the authorized resource question;
the standing guitar-faust release and future formal/protected/product decisions remain theirs.

**Run 3 complete: [049 DSP-cache eligibility](reports/049-challenger-dsp-cache.md), D2 bounded negative.**
Complete request traces match the fresh parent evidence, but neither consecutive whole-input
memoization nor prior same-grid CQT-column reuse has an eligible hit on the development
inputs. The moving CQT stride phase explains why ordinary audio overlap cannot supply
that reuse. No cache or listener version was adopted; broader primitive-content or
multi-phase methods remain untested, not ruled out. Retained development parent is
`basic-pitch-chain@5-note-output`; event-chain@3 stays incumbent. No new native timing,
historical-stall repair, stage pass or protected access is claimed.

**Closed at 3 of 3.** Input/window reuse and unused-output-copy savings were retained;
the two tested ordinary DSP-cache methods were rejected. Independent closing process
review [R17](reviews.md#r17-after-the-allocation-batch-047049) holds the bounded D1/D1/D2
results. The user's direction on fresh formal evaluation or broader resource work is next;
no 050 is authorized automatically. The standing guitar-faust
pause/release decision remains with the user/parent now that batch work has finished.
[049 resulting state](reports/049-challenger-dsp-cache.md#resulting-stopping-count-budgets-and-evidence-access)
carries unchanged stage stopping and protected access, no new version, one resource
comparison and unused technical repeat. The author lands, retires and stops.

### Latest continuation: closed at 1 of at most 3, full-workload no attribution

Opened 2026-10-05 after 045, by the user's direction:

> ok - lets do this in your preferred order

This accepts the preceding recommendation, whose preferred order was:

> independent review → full-workload tracing → fix the demonstrated cause → fresh formal claim

**Goal:** explain the rare no-inference service stalls with a full-workload traced
comparison, fix only the demonstrated cause, and measure the repaired path in a fresh
formal guitar claim under unchanged gates. The recommendation also keeps the 200-ms
deadline and held-out guitars unchanged. 045's D2 and all earlier verdicts stand;
no historical stall attribution is presumed.

**Order and bound:** first an independent process review of landed 045. Then at most
three numbered experiments, beginning with the next unused number: one pre-registered
full-workload diagnosis; a separate listener version if the evidence attributes the
cause to listener work; and a fresh formal claim after a demonstrated repair. A
harness repair can be carried by its diagnostic experiment without a listener version.
Each experimenter chooses and pre-registers its own bounded method from the evidence;
the accepted diagnostic recommendation is to reuse 044's tracing over the full
576-example workload/memory accumulation, compare the original harness with a
separate listener process and bounded evidence storage, and record phase timings,
GC/memory, thread CPU and scheduler evidence. Instrumentation overhead is diagnostic;
formal timing is measured afterwards. No inference-frequency change is assumed.

**Stopping:** an inconclusive/infrastructure outcome, no attribution, unsupported
repair, or valid failed formal claim ends this continuation and records the need for
the user. A successful formal claim also ends it: held-out confirmation, promotion,
sentinel selection and the outside promotion review are not performed in this batch.
Existing contract rules, oracle audits, quiet-host conditions, budgets and one-experiment
per session still apply. No gate or evidence standard is loosened.

**Roles:** this parent, GPT-6.1-Sol (high) in Codex, coordinates and records this direction
but performs no experiment or independent review in the continuation. The opening
process reviewer is a separate GPT-6-Sol (high) in Codex session; experimenters are
fresh GPT-6.1-Sol (high) in Codex sessions, one per numbered run. Any oracle audit and
the closing process review use independent sessions/models under the existing rules.

**Closed at 1 of at most 3:** [046 full-workload diagnosis](reports/046-challenger-full-workload-trace.md),
**GPT-6.1-Sol (high) in Codex**, **D3 no attribution**. Both complete accumulated-evidence
and bounded isolated listener workloads preserve every payload, fresh assessment and
prefix, but neither reproduces a no-inference attribution target. Storage isolation is
observed; no stall cause or demonstrated repair is established. The continuation ends
under its fixed rule, with no fresh formal claim or held-out use. 043 D2, 044 D3 and
045 D2 remain unchanged. The still-running measurement was recovered by a fresh session
of the same model, without restarting or changing its pre-registration; a read-only
verifier count bug was repaired after measurement, never a listener rerun.

**Process correction:** [R16](reviews.md#r16-correction-to-046s-pre-registration-landing)
records that the 046 pre-registration was fast-forwarded and pushed while its landing
gate was still running. The gate later passed before the source commit and measurement.
This breached the required landing order; it does not change 046's D3 result or the
continuation's stop. R15's unqualified process verdict is corrected there.

**Next:** independent closing process review and its process correction are complete
([R15](reviews.md#r15-after-experiment-046-and-the-bounded-continuation),
[R16](reviews.md#r16-correction-to-046s-pre-registration-landing)); the user
decides reopening or redirection. No 047 or protected evidence is authorized by
046's outcome. The parent/user's standing guitar-faust release decision is pending now
that timing work is finished; this author stops after landing and retirement. Promotion,
future microphone gates, qualification and Studio decisions stay with the user.
[046's resulting state](reports/046-challenger-full-workload-trace.md#resulting-stopping-count-budgets-and-evidence-access)
carries unchanged stopping counts, version/comparison totals and untouched protected
evidence; its technical repeat remains unused. The independent opening
[R14 review](reviews.md#r14-after-experiment-045-and-the-approved-continuation) remains
complete. Closing review is independent-session work, not supplied by this experimenter.

### Previous batch: closed at 9 of 10, quiet-host claim fails, 037–045

**Latest result: [045](reports/045-challenger-quiet-host-stage.md),
GPT-6.1-Sol (high) in Codex, D2 on a valid quiet host.** The unchanged challenger
passes every clean stage-1, assessment and cost gate, but Martin silent-hesitation
cursor deadlines fail. Both largest feeds emit no model frames; their cause remains
unattributed. Quiet-host sampling meets the amended rule and does not remove this
failure class. Frozen payloads/reports and all prefixes agree; incumbent still fails
every guitar/substage. Promotion condition (a) fails, (b) holds, and (c) stays untouched.
The batch closes at 9 of 10. No repeat, new listener, instrument, incumbent or sentinel.

**Next:** independent closing process review of this resumed continuation; no 046
or held-out access. After review, the user decides whether to reopen for attributable
full-sweep stall tracing or redirect. The standing guitar-faust pause until 046 lands
also needs the user/parent's release decision now that 046 is blocked; this experiment's
timing work is finished. No user question was asked. Promotion, microphone gates,
qualification and Studio choices remain future decisions.
[045's resulting state](reports/045-challenger-quiet-host-stage.md#resulting-stopping-count-budgets-and-evidence-access)
carries unchanged stopping counts, no version, one additional valid comparison,
unused 045 repeat and untouched protected evidence. Earlier verdicts stand. Historical
batch directions/closures below are preserved; the latest 045 result governs pickup.

Opened 2026-10-04 by the user, after 036. Their words, in order:

> I'm prepared to promote, but before I do - I'd like to dot the i's and cross the t's.  Also tell me about the lag

> lets drop the sine wave - its not useful.  what do you recommend we do on your decisions

> yes - write them in and set up the batch - slight preference of sol 6.1 (Dave) or astra 6 (new agent eric)  as I have more openai tokens left.

The decisions are in [the contract's 2026-10-04 amendment](contracts/development-contract-2.md#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule): the sines are
retired, the progression is rebased onto sampled guitar, the silence control becomes
pink noise at −60 dBFS, the chunk p99 gate gives way to a compute-inclusive cursor
deadline, a stage passes only on all four development guitars, and the promotion rule
is rewritten around a one-shot held-out confirmation, after which the user promotes.

**Goal.** Bring the challenger to the point where the user can promote it, or show why
it can't be: every condition of the amendment's decision 5 met and checked, or the
first one that fails found and reported. Work in rank order: question 27 (the seam's
timing and the compute-inclusive clock, then its audit), question 29 (the quiet-noise
controls), question 26 (Martin's wrong-score claims), question 30 (a streaming live
path within the cost gate and the deadline), question 31 (the guitar stage claim), and
question 32 (the held-out confirmation, once, and only after 31 passes). Each
experiment changes one thing; a listener change gets its own experiment. The main
track is paused.

**Count:** eight numbered experiments, 037 onwards (six until the user extended it on
2026-10-05, below); audits and the review are not
counted. The batch ends early under
[section 9 of the experimenter prompt](PROMPT_EXPERIMENTER.md#9-batches), and in any
case **stops before promotion**: the promotion itself is the user's.

**Roles,** following the user's preference for the OpenAI sessions:

- **Experimenter: Dave** (herdr `dave`), **GPT-6.1-Sol (high) in Codex**, a fresh
  session for every numbered run.
- **Seam audit (question 27's) and any other oracle audit: Eric** (herdr `eric`),
  **GPT-6-Astra (high) in Codex** (moved from medium by the user on 2026-10-04, before
  any audit), a different model from the author, as the audit rule requires.
- **Closing process review:** a model that ran none of the experiments and wrote none of
  the audits, so not Dave or Eric. Claude Fable 5.1 or Claude Opus 5.5; Opus 5.5 wrote
  this amendment, R11 and 036, so **Fable 5.1** is preferred.

The parent is this session, Claude Opus 5.5 in Claude Code, which wrote the amendment
and does no experiment, audit or review work. It launches each with the exact prompts of
[PROMPT_EXPERIMENTER.md section 8](PROMPT_EXPERIMENTER.md#8-running-through-a-parent-session-optional),
adding only the model line. Each launch line states the model and tool as the session
reports them.

**Order, set by the user on 2026-10-04 after the seam-2 audit.** The parent proposed
taking the quiet-noise controls next and folding the audit's coverage gaps (question 34)
into the streaming experiment (question 30), whose producer those live and cost rules
govern; cursor verdicts stay blocked until that seam version is audited. The user:

> Happy to do it in your recommended order

So the order is 29, 26, 30 (with 34), 31, 32.

**Extended by the user on 2026-10-05, after the seam-3 audit.** Seam versions 2 and 3
each closed the previous audit's gaps and drew new ones, mostly wording and float32
precision, while incremental inference and its measured cost and lag were still
unbuilt with four runs spent. The parent recommended: one experiment writes
observation-seam@4 to resolve question 36 **and** builds incremental neural inference,
measuring cost and compute-inclusive lag on every development-guitar example as
exploratory evidence, with Eric auditing seam 4 against that implementation; hand cases
compare model-produced values as float32 to a stated tolerance; and the batch grows to
eight runs: 041 seam 4 and streaming, 042 the guitar stage claim with the formal cursor
verdict, 043 the held-out run, one spare. The user:

> Happy with your reecommendations. 8 runs (or more) is fine

So the order is 30 with 36, then 31, then 32. **The count is now eight**, and the user
allows more if the work needs it; the parent reports to the user at the eighth run
rather than running past it unasked.

**After the seam-4 audit, 2026-10-05.** The audit agreed on all 90 cases but left
two scalar rules without a frozen case (finish must not flush; an offline length must
be a safe integer) and said that 041's native code and measurements, which its prompt
forbids it to read, had no independent check. The parent recommended: **042** freezes
the two missing cases, adding no seam rules unless they are needed, for Eric to audit;
**alongside it**, Eric reviews 041's native implementation and evidence in a separate
session under a new brief, [REVIEWING_AN_IMPLEMENTATION.md](REVIEWING_AN_IMPLEMENTATION.md),
which allows reading the code and records and re-executing a sample; **043** is the
formal guitar stage claim; **044** the held-out run; then the closing review and the
user's decision. The faster alternative, ruling the two cases non-blocking and leaving
the code to the closing review, was declined. The user:

> yes please

**After 041's implementation review and the seam-5 audit, 2026-10-05.** The review
held on every check but one: 041's timer counted diagnostic hashing and snapshot
copying as listener work, so its cost and lag overstate, never understate (question
39). Seam 5's audit agreed on all 95 cases, closing the scalar prerequisites. The
parent recommended combining question 39 with the formal stage claim (question 31) in
**043**: the claim re-measures everything fresh anyway, and the timer scope is the
measuring harness, not the listener, so one listener version is still judged. The
user:

> lets do the combined

So **043** fixes the timer attribution and makes the formal guitar stage-1 and
silent-hesitation claim, both outputs and every control on all four development
guitars, with the incumbent's results on the same examples beside it; **044** is the
held-out run, once, only if 043 passes. Then the closing review and the user's
decision.

**Reopened by the user on 2026-10-05, after R12.** The parent recommended, and the
user accepted, the decisions now in
[the contract's second amendment](contracts/development-contract-2.md#amendment-2026-10-05-host-stalls-guitar-sweeps-sentinels-and-the-outside-review),
and reopening this batch small and bounded. The user:

> Happy with you fixing ledger and recording the breach, but first can I get some recommendations on r12s escalations

> I agree to these propoposal, lets get started

So the count is **ten**, and the remaining runs are: **044**, a pre-registered, traced
diagnosis of 043's no-inference stalls (question 41), run with no other agent working
on the host; **045**, the formal stage claim again, only if 044 attributes the stalls
to the harness and fixes it (question 42); **046**, the held-out run, once (question 32).
If 044 cannot attribute the stalls, or attributes them to the listener's own path, the
batch stops and reports to the user. The outside review at promotion and the new
sentinel version follow the amendment.

**Revised by the user on 2026-10-05, after R13.** R13 showed both premises below were
overstated: the `guitar-faust` agent was idle from 11:35 to 11:56 UTC, so nothing of it
ran at either stall, and 043's clean Fender cost peaked at .211 (median .158). The
parent withdrew the cost-margin version; the user:

> you have my ok

So the count is **ten**: **045** is the fresh formal stage claim (question 42) on a quiet
host as [the second amendment now defines it](contracts/development-contract-2.md#amendment-2026-10-05-host-stalls-guitar-sweeps-sentinels-and-the-outside-review)
(no other herdr agent working, load below 2.0 at start, sampled every 30 s, a violation
voids the run, one repeat); **046** is the held-out run (question 32). A listener version
for cost is spent only if 045 fails on cost. `guitar-faust` stays paused until 046 lands.

**Reopened again by the user on 2026-10-05, after 044 (superseded by the revision above).** 044 found no attribution;
no stall recurred on a quiet host, and the parent found in the Codex logs that an
agent working in `~/dev/guitar-faust` was active from 11:30 to 12:04 UTC, the window in
which 043 measured both failing examples (11:38 and 11:48 UTC), though no command of
its was logged at those moments (R13: the session logged no command at all from 11:25 to
12:04 and nothing between 11:34 and 12:00, so the claim is weaker than this sentence reads). 044's isolated arm also measured a Fender noise
control at a cost of .291, so the margin is thin without stalls. The parent
recommended: **045**, a listener version that widens the cost margin (for example
running inference less often or on a smaller crop, the experimenter's choice,
pre-registered); **046**, one fresh formal stage claim on a quiet host, load recorded;
**047**, the held-out run; a short closing review of 044 first. The user:

> I agree with your recommendation - lets get started.  Let me know when its safe to start guitar-faust again

The count is **eleven**. No other agent works on the host until 047 lands: the
`guitar-faust` agent stays paused, and the parent tells the user when it may restart.
If 045 cannot widen the margin, or 046 fails a gate, the batch stops and reports.

**Was closed again at 8 of 10:** [044](reports/044-challenger-stall-diagnosis.md),
**GPT-6.1-Sol (high) in Codex**, **D3 no attribution**. The fixed traced panel preserves
043's payloads in both evidence harnesses but does not reproduce its no-inference
stalls. The isolated arm also has an inference cost failure. Quiet non-reproduction
cannot identify the original cause or meet the amendment's harness-attribution branch;
045 and held-out confirmation stay blocked. The batch stops under its fixed rule.
A broader memory-accumulation or quiet-host trace is advice awaiting reopening, not an
extra run authorized here. Independent process review of this continuation is done ([R13](reviews.md#r13-after-experiment-044-and-the-reopening)).
[044's resulting state](reports/044-challenger-stall-diagnosis.md#resulting-stopping-count-budgets-and-evidence-access)
carries unchanged stopping counts and budgets. No listener, oracle, stage, incumbent
or sentinel change; protected evidence remains untouched. This author lands, retires
and stops after exactly 044.

**Was closed at 7 of 8:** [043](reports/043-challenger-guitar-stage.md),
**GPT-6.1-Sol (high) in Codex**, **D2 resolved development limitation**. The direct
hash/snapshot timer issue is repaired in a separate harness with unchanged listener
payloads and offline reports, but fresh compute-inclusive service stalls fail a Martin
control's cost gate and a Fender hesitation's event deadline. The formal all-guitar
stage claim fails condition (a), so the batch stops at the first failed promotion
condition as its goal required. The incumbent still fails the same performances.
No held-out confirmation, promotion or new incumbent sentinels; no 044 is started.

The independent [seam-5 audit](bench/oracle-events/audit-observation-seam-5.md) and
[041 native implementation review](bench/oracle-events/implementation-review-041.md)
keep their verdicts. **Question 39 is answered at the direct timer boundary by 043**;
its remaining runtime attribution uncertainty opens **question 41**, before any new
formal stage claim. **Question 31 is answered D2**; question 32 stays blocked.
No-inference feed stalls are measured facts, not an established GC/scheduling or
acoustic diagnosis. Their wall times remain in the cost and completion clocks.

**Next: the closing process review of 037–043 is done** ([R12](reviews.md#r12-after-the-sampled-guitar-batch-036-043),
Claude Sonnet 5.5 in Claude Code; it covered the audits, the native review and 036).
The user reopened the batch for 044; its no-attribution result closes it again.
A new diagnosis now needs another reopening or redirection. This author runs no review
or further experiment.

[043's resulting state](reports/043-challenger-guitar-stage.md#resulting-stopping-count-budgets-and-evidence-access)
carries stopping counts and budgets. No new listener version, no qualification or
protected-evidence expenditure; held-out/reserved/final and Winner 5–8 untouched,
sines retired. Earlier [037](reports/037-challenger-observation-seam.md),
[038](reports/038-challenger-quiet-noise.md), [039](reports/039-challenger-dominant-pitch.md),
[040](reports/040-challenger-streaming-state.md), [041](reports/041-challenger-incremental-neural.md)
and [042](reports/042-challenger-finish-length.md) preserve their verdicts.

**Awaiting the user:** whether to reopen or redirect the batch after 044's no-attribution
result. The second amendment already settled the stall gate, baseline sweeps, sentinel
rule and outside review: no gate change or formal redraw is assumed. The sentinel
instrument and its audit remain pending before promotion. Promotion, microphone gates,
qualification and Studio choices remain the user's. Main stays paused and event-chain@3
remains incumbent. Independent process review of 044 is done ([R13](reviews.md#r13-after-experiment-044-and-the-reopening)), which also questions the premises of the reopening: see its escalations.

### Experiment 036, by the user's direction

On 2026-10-04 the user took up R11's first escalation:

> yep - lets run teh incumbent against same guitar samples.

[036](reports/036-incumbent-guitar.md) runs the unchanged event-chain@3 on 035's frozen
guitar renders, controls included, as a thermometer beside 035's challenger
assessment (question 28). Claude Opus 5.5 in Claude Code; no batch is open.
**Done: E2.** On the same audio, the incumbent meets 035's continuation criterion on
none of the four development guitars, where the challenger met three. It rejects every
control but fails almost every performance on both outputs. Its zero-crossing front end
is wrong or late on every guitar (finding 29); the chain is not implicated. No
promotion, version, suite or stopping-count change; event-chain@3 remains incumbent and
the main track's next question was 23 again, until the amendment paused it. Process review
[R12](reviews.md#r12-after-the-sampled-guitar-batch-036-043) reviewed 036 with the batch.

### Previous batch, closed: the challenger track, experiment 035

Opened 2026-10-02 by the user, run through a parent session (Claude Fable 5.1 in Claude
Code) that launches the experimenter, the seam auditor and the reviewer as separate
herdr sessions: GPT-6.1-Sol (high) in Codex, Claude Fable 5.1 in Claude Code and Claude
Opus 5.5 in Claude Code. The user's request, in order:

> I've done more research - some of this points towards me training a "better than basic
> pitch" model

> Lets suppose that Basic Pitch is promising. Perhaps we should consider a new contract
> that is more "midi" based wdyt?

> ok - can you plan the basic pitch challenger

> I'm happy for you to decide on those decisions (I allow all the options)

> you are running in herdr and there are other agents in your space including alice
> (Opus 5.5), bob (Fable 5.1) and Dave (codex opus 6.1). Can you use these agents to
> complete this plan

**Goal.** One challenger experiment, 035, under
[the contract's challenger section](contracts/development-contract-2.md#the-challenger-track-basic-pitch-observations)
and [avenue A2](TRACK_PROPOSALS.md#a2-basic-pitch-observations-through-the-event-chain):
Basic Pitch observations through the unchanged event chain, judged by the unchanged
instruments and controls on the frozen sine sets and on new `sample-render@1` renders of
the stage-1 and stage-2 scores from the development guitars, assessment output first,
with an in-process live spike that measures parity with the offline model, look-ahead
and cost. It carries an exploration budget, not predictions; the rule for a second
experiment is in the contract. It also takes up R10's third escalation, the guitar
thermometer. The main track is not run in this batch and its questions keep their rank.

**Roles.** Experimenter: the Codex session. Audit of the observation seam's timing, after
the seam and its producer land: the Fable session, which writes none of it. Process
review of the batch: the Opus session, which writes none of it and is not the model of
R9 and R10. The count is one numbered experiment; the audit and the review are not
counted.

**Closed at 1 of 1:** [035](reports/035-challenger-basic-pitch.md), GPT-6.1-Sol (high) in Codex, D1 continuation. Its assessment clears the fixed three-source criterion; Martin controls fail. The live spike has useful untrimmed observations but fails compute, and trimming misses deadlines. The independent [observation-seam@1 audit](bench/oracle-events/audit-observation-seam-1.md) agrees on all eight timing cases and lists two rule ambiguities and the uncovered rules (question 27); process review [R11](reviews.md#r11-after-the-challenger-batch-035-and-the-observation-seam-audit) covers the batch. No promotion or incumbent change.

### Previous batch, closed: 030–034

Opened 2026-10-01 by the user: **five numbered experiments on the main track**, 030
onwards, run through a parent session (Claude Fable 5.1 in Claude Code) that launches
the experimenters, auditors and the reviewer as separate sessions in herdr. Three
sessions are available to it: Claude Opus 5.5 in Claude Code, Claude Fable 5.1 in
Claude Code, and Sol 6.1 in Codex; each run's ledger row names which ran it. The
user's request:

> you are running in herdr and can use it to contact and instruct different agents.
> you have bob (claude opus 5.5) and carol (claude Fable 5.1) and dave (codex sol 6.1)
> at your disposal. You can chose which you want to be reviewer or experimentor, etc.
> We won't start a new track. Lets continue our main track. Can you continue. I want
> you to run 5 experiments (happy for you to also do related things (e.g. full test,
> oracle tweaks). Is it clear what your scope is?

**Goal.** Continue the main track under [contract 2](contracts/development-contract-2.md)'s
order of work. No new track is opened and nothing in [TRACK_PROPOSALS.md](TRACK_PROPOSALS.md)
is adopted. Related work the loop already owes is in scope: the full sweep due by 031,
oracle corrections and the audits they require, and revalidation of historical passes
under the current instruments. The count is five numbered experiments; audits and the
process review are not counted. The batch ends early under
[section 9 of the experimenter prompt](PROMPT_EXPERIMENTER.md#9-batches); the
contract, the gates and the rules of the loop are unchanged by it.

**Progress. Reopened by the user at run 2 of 5; three runs remain.** Run 1:
[030](reports/030-current-instruments.md), Sol 6.1 (high) in Codex: a resolved
reporting failure. Run 2: [031](reports/031-other-bars-reporting.md), Claude Opus 5.5
in Claude Code: an **unresolved infrastructure outcome**, which closed the batch under
[section 9](PROMPT_EXPERIMENTER.md#9-batches). The parent reported the closure and
031's two routes to the user, who answered on 2026-10-01:

> claude usage is back. Can you get things spinning again

> g031b is fine

So the overdue sweep is completed as **`g031b-reporting-sweep` under 031's frozen
pre-registration**, by the user's authority (open question 20), and the batch continues
with its remaining three numbered experiments, 032–034, under the unchanged goal. The
completion run's verdict is recorded against 031; it adds no run to the count. Process
review R9 covers 030–031 as closed; the batch's remaining runs get their own review.

**Run 3 done: [032](reports/032-held-note-hesitation.md), Sol 6.1 (high) in Codex, D1.**
**Run 4 done: [033](reports/033-rushed-bar.md), Claude Opus 5.5 in Claude Code, D1.**
**Run 5 done: [034](reports/034-missing-event-sweep.md), Sol 6.1 (high) in Codex, D1.**
**Closed at 5 of 5.** The resumed batch passed held-note hesitation, rushed bar and
one missing interior event on simple sines; its final full sweep confirms every
previously passed substage, with earlier outputs preserved. Stage 2 remains incomplete.
Process review [R10](reviews.md#r10-after-the-resumed-batch-g031b-and-032034-with-the-direction-review)
covers g031b and 032–034, and carries the different-model direction review of the whole
process that had been due since R5; R9's original 030–031 review stays recorded.

2026-10-02. [Contract 2](contracts/development-contract-2.md) remains in force and
**event-chain@3 remains incumbent**. [035](reports/035-challenger-basic-pitch.md#results)
opens a usable Basic Pitch assessment path on development guitars, while exposing a
repeatable Martin wrong-score false claim. Its exploratory live policies separate
recent-frame accuracy from trimmed-frame lateness; both exceed compute gates.
The observation timing convention has its independent audit: all eight hand cases
agree; the availability clock is nominal input time, a lower bound on real latency,
and first-window parity is unreachable by rule, so both stay measured limits.
No guitar stage, live qualification or promotion is claimed.

The incumbent's [034 sweep](reports/034-missing-event-sweep.md#results) remains valid
and is cited by verified hash at this challenger batch end. Its suite states and
sentinels are unchanged; the main track's next question remains one wrong note with
near-miss w1. The challenger has spent its one exploration budget and meets the fixed
criterion for a second experiment, after the timing audit and batch review. Its lowest
unresolved guitar assessment failure is Martin's control claims; live cost is separate.

[035's resulting state](reports/035-challenger-basic-pitch.md#resulting-stopping-count-budgets-and-evidence-access)
carries both stopping counts, version/comparison totals and unused qualification
budgets/access. Held-out guitars remain unused and Winner bars 5–8 unexamined.
Latest fresh incumbent sweep is g034, next due no later than 039, with both tracks'
numbers counting. No set is retired. *(Superseded 2026-10-04: the amendment retires every
sine set and pauses the main track; see the current batch.)* [Audit 4](bench/oracle-events/audit-4.md) remains
the current evaluator audit; the **observation-seam@1** timing audit is done
([audit](bench/oracle-events/audit-observation-seam-1.md): 8 agree, 0 disagree, 0
ambiguous), and its two rule ambiguities and uncovered rules are the challenger
track's top question. Process review
[R11](reviews.md#r11-after-the-challenger-batch-035-and-the-observation-seam-audit)
covers this closed one-run batch; no review is due until the next experiment lands.

**Awaiting the user:** whether the observation seam becomes a progression amendment,
and recorded-guitar numerical gates before a formal stage-4 claim. R11 adds three: the
incumbent on the challenger's guitar set, the promotion rule's wording, and whether the
challenger's continuation must carry its live path. R10's standing
sentinel tie-break/pool and baseline-sweep decisions remain open. The guitar-sound
thermometer now has both listeners on the same renders (035, 036), with no microphone
claim. 036 adds one more: whether the main track keeps building sine substages on a
front end that can't hear a sampled guitar, or versions that front end first. Qualification and Studio product choices remain future decisions.
The audit/review are independent-session work, not approvals supplied by this author.
This session's direction is preserved:

> You cannot ask the user questions: record anything that needs them in your report and the research log.

## Inherited lessons

What the first series established that still applies. Each is evidence about sound,
alignment or measurement, not about the old objective. The archive holds the details.

| # | Lesson | Evidence |
|---|---|---|
| L1 | Develop on audio with an exact answer first. On a real recording, a tracking defect and an acoustic limit produce the same failure. | [Report 004](archive/ladder-1/reports/004-rung0-clean-winner.md), archived findings 20–21 |
| L2 | Matching the current sound against static templates ties with nearby positions in repeated harmony; the order of events is what disambiguates. | [Report 003](archive/ladder-1/reports/003-recognition-at-sync.md), [report 005](archive/ladder-1/reports/005-online-time-warp-rung0.md), archived findings 18, 22, 26 |
| L3 | Support judged from the current sound alone accepts a different piece that shares sustained notes. | [Report 005](archive/ladder-1/reports/005-online-time-warp-rung0.md), archived finding 25 |
| L4 | Recorded guitar against a sine reference shifts every absolute match threshold, in both directions depending on the guitar. A threshold is only meaningful per timbre, or relative to the performance itself. | [Report 008](archive/ladder-1/reports/008-rung2-guitar-samples.md), [report 009](archive/ladder-1/reports/009-plucked-reference.md), archived findings 28, 31, 34 |
| L5 | Frame alignment on recorded guitar fails in short bursts while sustained bass notes decay, even where the features prefer the true position. | [Report 008](archive/ladder-1/reports/008-rung2-guitar-samples.md), [report 010](archive/ladder-1/reports/010-slim-suite-and-burst-features.md), archived findings 32, 37 |
| L6 | Steady-tempo assumptions help exactly timed synthetic audio and hurt real playing: a four-second tempo history improved the synthetic guitars while real-clip agreement fell sharply. Making the path react faster made its bursts worse. | [Report 011](archive/ladder-1/reports/011-path-and-support.md), [report 021](archive/ladder-1/reports/021-stability-calibration.md), archived findings 38, 53, 54 |
| L7 | Comparing against one rearranged copy of the score is a coin flip on unrelated audio; a family of them is correlated and expensive. | [Report 015](archive/ladder-1/reports/015-decoy-null.md), archived findings 44, 46 |
| L8 | Rejection of a wrong score means nothing without acceptance of the right one; read them together. | [Report 004](archive/ladder-1/reports/004-rung0-clean-winner.md), archived finding 23 |
| L9 | The real clip's sync anchors are bar-level and of unmeasured precision. Interpolated positions cannot grade anything finer than a bar, and an audio-ignoring clock scores highly on a steady professional. | [Report 002](archive/ladder-1/reports/002-winner-sync-proxy.md), [anchor precision](evidence/bar-anchor-precision-1.json), archived findings 13, 15 |
| L10 | The frozen v1 evaluator needs clip durations exact to 1e-9 s: pad audio to a multiple of 3 samples at 48 kHz. | [Report 007](archive/ladder-1/reports/007-rung1-tempo.md), archived finding 30 |
| L11 | A development limit fitted on the examples it is scored on, against one wrong piece, is not independent evidence. Fresh bars, pieces or sounds are. | [Report 016](archive/ladder-1/reports/016-windowed-rank.md), archived finding 47 |

## Findings

Status is `holds`, `superseded` or `withdrawn`.

| # | Finding | Evidence | Status | Since | Notes |
|---|---|---|---|---|---|
| 1 | following-evaluator@2 and assessment-evaluator@1 reproduce every number of the hand-worked event-oracle@1, which covers every rule named in contract 2, and the oracle catches deliberate evaluator faults | [Report 022](reports/022-event-instruments.md#the-instruments-against-their-oracle), [oracle](bench/oracle-events/README.md) | holds | 022 | The oracle was frozen before the evaluators existed |
| 2 | On stage 1, the frozen time warpers' only failure is running ahead: at half speed all three reach events 0.15–0.9 s before they sound, and v12 and v14 are also ahead at 70% and 110% | [Report 022](reports/022-event-instruments.md#the-baselines-on-stage-1); superseded by [report 023](reports/023-instruments-decisions.md#the-baselines-on-the-controls) | superseded | 022 | Supports the contract's forward-only, tempo-clamped prediction; no deviation yet, so nothing about smoothing is concluded. Stage 1 had no controls; with them, running ahead is not their only failure (finding 8) |
| 3 | At the handed tempo, stage 1 cannot tell any listener from the clock: the sine audio is the time warpers' own reference, and their event timelines equal the clock's | [Report 022](reports/022-event-instruments.md#the-baselines-on-stage-1) | holds | 022 | The off-tempo examples carry stage 1 |
| 4 | How a continuous position maps to an event decides a baseline's score: under a nearest-onset mapping the clock at the handed tempo falls from 100% to 55–60% on event | [Report 022](reports/022-event-instruments.md#the-baselines-on-stage-1) | holds | 022 | The scored rule (the last onset reached) was fixed before any run |
| 5 | Under the contract's definition of variation, a single long hesitation in a short piece lowers the overall tempo enough that steady bars must be flagged fast | Oracle case A3, [report 022](reports/022-event-instruments.md#for-the-user-three-decisions-the-evidence-raises); superseded by the user's decision and [event-oracle@2's A3](reports/023-instruments-decisions.md#the-instruments-against-their-oracle) | superseded | 022 | A definitional question for the user, not a listener result. The user chose the typical (median) tempo; against it the steady bar is no longer flagged |
| 6 | assessment-evaluator@2 and stage-gates@1, with the unchanged following-evaluator@2, reproduce every number and gate verdict of the hand-worked event-oracle@2, which implements every decision the user made on 022; event-oracle@1 still passes, and seven injected faults are each caught | [Report 023](reports/023-instruments-decisions.md#the-instruments-against-their-oracle), [oracle](bench/oracle-events/README.md) | holds | 023 | Pending the audit (question 6): author and oracle agree by construction until an independent reading does |
| 7 | Stage 1's controls separate following from listening: the clock falsely follows every silence and wrong-score control for their whole answerable time, and the frozen time warpers reject every silence control | [Report 023](reports/023-instruments-decisions.md#the-baselines-on-the-controls), [g023](runs/g023-stage1-controls/summary.json) | holds | 023 | Qualifies finding 3, which is about the performances alone |
| 8 | The frozen time warpers follow a wrong score whose notes lie a semitone from the audio's in the same rhythm: `w1` against s2's second bar at 90 and 99, for 0.41–1.65 s (correct rejection 64.5–91.9%), with the path two and a half to four quarters behind; where `w1`'s notes are a tritone or more away, or the audio is at 45 or 63, they reject it | [Report 023](reports/023-instruments-decisions.md#the-baselines-on-the-controls) | holds | 023 | Same family as lesson L3; the mechanism (semitone leakage, a two-second rank window) is inferred from the code, not tested |
| 9 | In a two-bar piece the bar with more intervals sets the typical tempo, so a second bar that drags throughout makes a steady first bar read fast | Oracle case A7, [report 023](reports/023-instruments-decisions.md#for-the-user-two-decisions-and-one-observation) | holds | 023 | A consequence of the approved definition, reported to the user; not a listener result |
| 10 | event-chain@1 passes stage 1 with both outputs, at every tested steady tempo, with no false findings and rejection of both controls | [Report 024](reports/024-event-chain-stage1.md#new-listener-the-eight-performances), [g024](runs/g024-event-chain-stage1/summary.json) | holds | 024 | Restricted to distinct-pitch monophonic sines on s1/s2; finding recall/recovery/extra-note gates have no positives here |
| 11 | Replacing w1 with the approved distant w2 makes every frozen time warper pass all stage-1 cursor controls without changing its performance records | [Report 024](reports/024-event-chain-stage1.md#comparators-causality-and-cost) | holds | 024 | A change to the control's difficulty, not an algorithm improvement; the original w1 failure remains |
| 12 | event-chain@1 holds through a single silent hesitation and passes its cursor, interval and bar-flag gates without losing stage 1; short resumption abstention stays within the gates | [Report 025](reports/025-single-hesitation.md#both-outputs-on-the-40-hesitations), [g025](runs/g025-single-hesitation/summary.json) | holds | 025 | Two distinct-pitch sine scores, fixed pause locations; no claim for chords, ringing guitar or other deviations |
| 13 | All four frozen comparators run ahead and fail every tested hesitation cursor example; the time warpers still reject the distant controls | [Report 025](reports/025-single-hesitation.md#controls-regressions-causality-and-cost) | holds | 025 | Some slow parents already fail, so not every failure is attributable solely to the pause; none assesses |
| 14 | On a single slowed bar, event-chain@1 assesses every note and interval and reproduces the approved typical-tempo flags, but its live cursor skips two correctly played F4 events after overlapping windows falsely identify G4 | [Report 026](reports/026-single-slowed-bar.md#diagnosis-a-transient-pitch-skip-inside-the-slowed-bar), [g026](runs/g026-single-slowed-bar/summary.json) | holds | 026 | Frozen listener, two short sine-scale transformations; other 38 performances and all controls pass; transient phase/frame explanation is inferred, not isolated |
| 15 | With the approved interval-end attribution, slowing the first bar of the two-bar scale can make the unchanged second bar read fast, while slowing the second bar makes it read slow; event-chain@1 reproduces this asymmetry | [Report 026](reports/026-single-slowed-bar.md#the-approved-typical-tempo-asymmetry) | holds | 026 | End-to-end evidence for the median-reference limitation; no instrument change |
| 16 | Three-window live pitch confirmation in event-chain@2 prevents the two observed slowed-bar skips without changing any musical assessment, while adding one hop to ordinary acquisitions and hesitation resumption abstention | [Report 027](reports/027-live-confirmation.md#both-outputs-including-earlier-regressions), [g027a](runs/g027a-live-confirmation/summary.json) | holds | 027 | All frozen earlier substages/controls pass; prevention on these sine transients, not recovery after commitment or evidence for other sounds/errors |
| 17 | Instruments3 reproduce all new assessment hand cases except frozen B1: endpoint attribution contradicts its frozen first other-bars reference and ratio | [028 discrepancy](reports/028-other-bars-suite.md#instruments-against-the-frozen-oracle), [g028](runs/g028-other-bars-suite/summary.json) | holds | 028 | Author diagnosis at 028; [audit 3](bench/oracle-events/audit-3.md) independently confirms B1; no frozen answer changed and no listener judged |
| 18 | Historical instruments2 passing evidence gives deterministic margin-ranked sentinels and a smaller routine regression set, with no justified performance retirement yet | [028 suite](reports/028-other-bars-suite.md#suite-record-and-rising-tide), [suite record](bench/suite-record.json) | holds | 028 | One incumbent@2 evaluation; no new confirmation, transfer or version3 listener verdict |
| 19 | Corrected event-oracle@4 agrees with existing instruments on the bar arithmetic, report accounting and added suite rules; old oracle/instrument/listener bytes remain unchanged | [029](reports/029-oracle-coverage.md#results), [g029](runs/g029-oracle-coverage/summary.json) | holds | 029 | Implementation agreement; [audit 4](bench/oracle-events/audit-4.md) independently agrees on every case. Synthetic adapters and vacuous retirement-record checks have explicit limits |
| 20 | Under audited current instruments, event-chain@2 retains every historical cursor/note/interval/control result, but obsolete short-score bar flags reopen hesitation and slowedBar | [030 results](reports/030-current-instruments.md#each-attempted-substage-with-its-controls), [g030](runs/g030-current-instruments/summary.json) | holds | 030 | A reporting-policy compatibility failure; earlier instruments2 passes remain historical |
| 21 | The unchanged event chain passes its own four-bar clean/slowed measurements, including repeated nonadjacent pitches; boundary estimates miss two required slow flags within approved pooled recall | [030 four-bar diagnosis](reports/030-current-instruments.md#diagnosis-obsolete-flag-policy-with-boundary-misses-on-four-bars) | holds | 030 | Earlier sentinel failures prevent a substage pass; no chords, guitar, missing/wrong/dead or transfer claim |
| 22 | The one permitted technical rerun can fail after measuring everything, which leaves complete private evidence with no recorded verdict: 031's g031a measured all 516 @3 examples and every baseline, then failed its own public-summary size check | [031 results](reports/031-other-bars-reporting.md#the-two-attempts), [g031a](runs/g031a-reporting-sweep/summary.json) | holds | 031 | A process fact, not a listening result. g031a's observations (@3 identical to @2 apart from flags; no false findings; four-bar slow 89/91) are diagnostic only |
| 23 | event-chain@3, @2 with flags only on eligible bars against the other bars, passes the full sweep. Live records and musical output are identical to @2 on 516/516 examples. It raises no flag on one- and two-bar scores, has no false findings anywhere, and finds 89/91 four-bar slow bars, the two misses at a true ratio of exactly 0.90 | [031 completion](reports/031-other-bars-reporting.md#completion-g031b-by-the-users-authority), [g031b](runs/g031b-reporting-sweep/summary.json) | holds | 031 (g031b) | Monophonic sine scores only. Missing/wrong/dead/extra have no positives. Boundary recall rests on millisecond onset estimates |
| 24 | event-chain@3 holds through a single hesitation with the previous sine sustained, passes both outputs and controls, and preserves every active earlier regression output; resumption estimates shift by up to two hops from silent counterparts within the approved gates | [032](reports/032-held-note-hesitation.md#both-outputs-controls-and-regressions), [g032](runs/g032-held-note-hesitation/summary.json) | holds | 032 | Two short monophonic scores, constant sustain with no overlap/decay; no bar-flag positives or new wrong/missing/dead/extra capability |
| 25 | event-chain@3 passes a single rushed bar at 1.05–1.30 of base tempo on s2 and s3: every event, note and interval, and 64/66 expected fast flags with no false alarm; both misses are bars whose true ratio is 1.10 to within 3e-6 | [033](reports/033-rushed-bar.md#results), [g033](runs/g033-rushed-bar/summary.json) | holds | 033 | Monophonic sine scores only; the first fast-flag positives. With g031b's slowed bars, four of five exact-threshold positives are missed, all on the side of 1.0: a near coin flip at 10 ms onset resolution, too few cases to establish a bias |
| 26 | event-chain@3 recovers after every single interior omission on s1/s2, identifies all missing notes, and preserves spanning-interval tempo; the batch-end sweep confirms earlier substages and reproduces all earlier outputs | [034](reports/034-missing-event-sweep.md#results), [g034](runs/g034-missing-event-sweep/summary.json) | holds | 034 | Distinct-pitch monophonic sines, one silent beat per example; no first/last or multiple omission, repeated-pitch ambiguity, wrong/dead note or guitar claim |
| 33 | Does an independent session rederive observation-seam@2 from its rules alone, agree on every new frozen hand case, and identify any uncovered rule, especially sample-index existence, strict watermark, shared frame availability, serial compute/backlog/start/finish, null semantics and offline endpoint/grid arithmetic? | Answered: all 36 new cases and inherited T3/T8 agree; index/count and strict-watermark ambiguities are settled. Prefix equality with variable wall time, cost accounting, start/decision lifecycle and other uncovered rules, plus cost-denominator wording, go to question 34; no adopting producer or listener was judged | answered: 38 agree, 0 disagree, 0 ambiguous at case level; rule coverage incomplete | [Audit](bench/oracle-events/audit-observation-seam-2.md), GPT-6-Astra (high) in Codex |
| 27 | Basic Pitch through the unchanged offline aligner/assessor clears clean and silent-hesitation assessment comparisons on three development guitars; Martin correctly matches performances but makes isolated low-G2 claims on the distant wrong score; all frozen sine assessments also clear the shared thresholds | [035 assessment](reports/035-challenger-basic-pitch.md#assessment-including-controls), [g035](runs/g035-challenger-basic-pitch/summary.json) | holds | 035 | D1 permits continuation; no guitar-stage approval, held-out transfer or microphone claim; offline frontend uses the prescribed 11-frame decoder, not an extra sine-token filter |
| 28 | In an exploratory in-process spike, untrimmed recent frames reach every clean-guitar event within nominal runner deadlines, withholding 15 frames makes every performance miss a deadline, and both policies exceed CPU cost gates; every future-prefix and sampled same-tensor runtime comparison agrees | [035 live](reports/035-challenger-basic-pitch.md#live-spike-observations-deadlines-and-cost) | holds | 035 | Nominal input-delivery timestamps, not physical feedback latency; observation-seam@1 audit pending; no formal live verdict |
| 29 | On 035's frozen guitar renders, the unchanged event-chain@3 meets 035's continuation criterion on none of four development guitars (the challenger met three): assessment passes 10 of 192 performances and the cursor none, while all 384 controls pass. Its zero-crossing front end reads 2.7–57.3% of in-note windows exactly, failing on different notes per guitar, and acquires notes late where it reads them | [036](reports/036-incumbent-guitar.md#results), [g036](runs/g036-incumbent-guitar/summary.json) | holds | 036 | Thermometer, sine-stage gates as comparisons; sampled monophonic renders with digital silence. The controls are cheap for a listener that hears little (L8). Chain not implicated, by 035's privileged-input check |
| 30 | Explicit sample-index/watermark rules and a serial compute-inclusive completion clock in observation-seam@2 reproduce its independently hand-written arithmetic; distinguishing probes separate the ambiguous/nominal alternatives without changing frozen producers | [037](reports/037-challenger-observation-seam.md#results), [g037](runs/g037-challenger-observation-seam/summary.json) | holds | 037 | Implementation agreement only; independent audit pending (question 33). No native inference, live causality/cost or guitar latency measured; future versioned producer adoption required |
| 31 | On the fixed −60 dBFS pink-noise controls, both unchanged listeners reject every s1/s2 assessment and nominal cursor comparison, although Basic Pitch decodes low pitches on every clip; none reaches the score register, so exact pitch matching rather than model-level silence rejection explains these particular controls | [038](reports/038-challenger-quiet-noise.md#results), [g038](runs/g038-challenger-quiet-noise/summary.json) | holds | 038 | One seed and correlated length prefixes; no lower-register, microphone or noise-distribution claim. Live nominal/exploratory, cost still over target; seam@3/audit prerequisite unchanged |
| 32 | Fixed frame-local strongest-pitch masking before the official decoder removes Martin's false low-G2 wrong-score claims while preserving all clean/hesitation assessment gates and quiet-noise rejection on the four development guitars | [039](reports/039-challenger-dominant-pitch.md#results), [g039](runs/g039-challenger-dominant-pitch/summary.json) | holds | 039 | Offline monophonic component only; timing fields change within gates. No fitted threshold, live/stage pass or independent transfer claim; genuine chord tones would be suppressed |
| 34 | The separately versioned streaming input/state kernel preserves frozen float32 model inputs and coordinates on regular/irregular synthetic delivery, while seam 3 reproduces new lifecycle/cost/prefix hand arithmetic; global normalization can alter retained features | [040](reports/040-challenger-streaming-state.md#results), [g040](runs/g040-challenger-streaming-state/summary.json) | holds | 040 | Implementation agreement pending independent seam 3 audit; injected maps/costs only, no neural incremental inference, native speed, live cursor or guitar-stage claim |
| 35 | Cropping neural time computation after recomputing full global normalization preserves sampled selected float32 maps and brings every measured development-guitar live cost/deadline/control comparison within the current thresholds | [041](reports/041-challenger-incremental-neural.md#results), [g041a](runs/g041a-challenger-incremental-neural/summary.json) | holds | 041 | Exploratory author evidence; independent seam 4 audit next, no formal stage claim. Full DSP recomputed; monophonic sampled development only. Invalid first-attempt setup timing preserved, technical rerun repaired it |
| 36 | Observable pre/post finish state and nonempty returned decisions reproduce inherited no-flush/stamp/history rules; unsafe integral and nonfinite offline lengths are rejected while all declared earlier cases remain unchanged | [042](reports/042-challenger-finish-length.md#results), [g042](runs/g042-challenger-finish-length/summary.json) | holds | 042 | Author agreement only; independent seam-5 audit next. Injected state/service, no native or stage verdict |
| 37 | Separating direct diagnostic hashes/snapshots preserves frozen challenger outputs, but fresh no-inference service stalls fail the formal guitar cost/deadline gates | [043 results](reports/043-challenger-guitar-stage.md#results), [g043](runs/g043-challenger-guitar-stage/summary.json) | holds | 043 | All development guitars measured; stall cause unresolved; no stage/promotion or held-out use |
| 38 | A fixed traced panel preserves the frozen payloads with original and isolated evidence harnesses but does not reproduce the original no-inference stalls; historical cause remains unresolved | [044 results](reports/044-challenger-stall-diagnosis.md#results), [g044](runs/g044-challenger-stall-diagnosis/summary.json) | holds | 044 | B also has an inference cost failure; no harness attribution, stage pass or held-out authorization |
| 39 | The frozen challenger passes all development-guitar assessments and costs on a contract-valid quiet host, but two Martin silent-hesitation events miss compute-inclusive deadlines after no-inference feed stalls | [045](reports/045-challenger-quiet-host-stage.md#results), [g045](runs/g045-challenger-quiet-host-stage/summary.json) | holds | 045 | No cause attributed, redraw, stage-2 pass or held-out use; all clean stage-1 gates and frozen identities agree |
| 40 | A complete accumulated-evidence workload and a bounded isolated listener process preserve every development-guitar payload, assessment and prefix but reproduce no no-inference stall; storage isolation alone supplies no demonstrated repair | [046](reports/046-challenger-full-workload-trace.md#results), [g046](runs/g046-challenger-full-workload-trace/summary.json) | holds | 046 | Full fixed A-then-B traced workloads; historical cause remains unresolved, no formal claim or held-out use |
| 41 | Reusable raw-input capacity and one borrowed model window preserve complete development-corpus tensors, native outputs and prefixes while removing recurring explicit allocations at those storage sites | [047](reports/047-challenger-input-buffers.md#results), [g047](runs/g047-challenger-input-buffers/summary.json) | holds | 047 | Exact targeted allocation counts, not total V8/native allocation, speed, historical stall ownership or stage approval; synchronous consumer lifecycle |
| 42 | Copying only the consumed live note map preserves complete fresh development-corpus tensors, payloads and prefixes while removing explicit unused onset/contour bridge copy work and destination allocations | [048](reports/048-challenger-output-copies.md#results), [g048](runs/g048-challenger-output-copies/summary.json) | holds | 048 | Targeted bridge savings only; graph still computes all outputs/full DSP, offline unchanged; no tail-speed, stall ownership or stage claim |
| 43 | Complete current-cadence development inputs provide no consecutive full-window memo hits or overlapping prior requests on the same native CQT stride phase | [049](reports/049-challenger-dsp-cache.md#results), [g049](runs/g049-challenger-dsp-cache/summary.json) | holds | 049 | Necessary eligibility for two ordinary cache methods only; no new native cache, broader impossibility, speed or formal stage claim |
| 44 | The retained @5 passes the fresh formal development-guitar stage-1 and silent-hesitation claim, both outputs and every control on all four guitars, while the incumbent fails each corresponding substage | [050](reports/050-challenger-optimized-stage.md#results), [g050](runs/g050-challenger-optimized-stage/summary.json) | holds | 050 | One valid quiet-host short monophonic development sweep; no historical stall attribution, held-out transfer or promotion |
| 45 | The unchanged @5 passes the one-shot held-out stage-1 and silent-hesitation confirmation on every approved guitar, both outputs and controls, with the incumbent failing each corresponding substage | [051](reports/051-challenger-heldout-confirmation.md#results), [g051](runs/g051-challenger-heldout-confirmation/summary.json) | holds | 051 | Three sample sets/two origins, short monophonic schedules on one valid quiet host; no tuning, historical stall attribution, microphone or promotion claim |

## Open questions

Ranked by row order; the top row is the next question. The number is an identifier
given when a question opens and never reused. Since the 2026-10-04 amendment the main
track is paused, so the open rows are the challenger's, in the current batch's order.
Questions 1–23 and 28 are the main track's.

| Rank | Question | Why it is ranked here | Status | Owner item |
|---|---|---|---|---|
| 43 | Does a new stage-gates version implement R10's sentinel rule (deviation examples only; ties by severity in the direction of difficulty before name), with hand-worked cases and an independent audit, before promotion's sentinel selection uses it? | Adopted by the user on 2026-10-05; needed only at promotion | open: next, instrument/audit before selection and promotion | [Second amendment](contracts/development-contract-2.md#amendment-2026-10-05-host-stalls-guitar-sweeps-sentinels-and-the-outside-review), [R10](reviews.md#r10-after-the-resumed-batch-g031b-and-032034-with-the-direction-review) |
| 55 | Does a model that has never worked in this loop independently review 050–051 promotion evidence and the auditing regime before the user decides? | The batch is complete and the second amendment requires an outside review; the experimenter cannot supply it | open: closing outside review due, with sentinel instrument/audit before promotion | [051 next](reports/051-challenger-heldout-confirmation.md#next), [Second amendment](contracts/development-contract-2.md#amendment-2026-10-05-host-stalls-guitar-sweeps-sentinels-and-the-outside-review) |
| 56 | After the sentinel instrument/audit and outside review, does the user promote the confirmed challenger? | Conditions (a)–(c) hold, but promotion belongs to the user | awaiting user after prerequisites; no automatic promotion | [051](reports/051-challenger-heldout-confirmation.md#next) |
| 32 | Does the challenger, fixed in a pre-registration before rendering, pass the same schedules and controls rendered from the three held-out guitar sets (`tonejs-nylon`, `tonejs-electric`, `shinyguitar`; two independent origins), every guitar on both outputs, in one run? | Condition (c), the last before the user promotes; one shot, and a failure turns the held-out sets into development evidence | answered D1 by 051; one-shot spent, (c) holds; no promotion | [Amendment](contracts/development-contract-2.md#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule) |
| 54 | Does `basic-pitch-chain@5-note-output` pass the formal guitar stage-1 and silent-hesitation claim, both outputs and every control on all four development guitars under unchanged gates, measured once on a quiet host as the second amendment defines it, with the incumbent on every example and the frozen baselines on stage 1's clean examples? | Promotion condition (a), with the retained allocation reductions; the user's direction of 2026-10-05 | answered D1 by 050; both outputs/controls pass, (a)/(b) hold | [050](reports/050-challenger-optimized-stage.md) |
| 52 | Does an independent process session check 047–049's retained resource changes, complete parity evidence and bounded DSP-cache rejection, before further work? | Required closing review of the completed allocation batch; experimenters do not review their own batch | answered: R17 holds the bounded D1/D1/D2 results; no formal stage or stall-repair claim | [R17](reviews.md#r17-after-the-allocation-batch-047049), [Current batch](#latest-batch-allocation-optimizations-closed-at-3-of-3) |
| 53 | After the closing review, does the user authorize fresh formal evaluation of retained @5 or redirect to a broader contract-preserving DSP/resource method? | Allocation savings do not repair historical stalls or authorize a formal/held-out claim; the three approved candidates are complete | answered by the user (2026-10-05): a fresh formal claim of @5 (question 54), then held-out | [049 next](reports/049-challenger-dsp-cache.md#next) |
| 51 | Can full-DSP caching reduce measured work while preserving current global normalization, complete numerical/live output and causal prefixes? | Third candidate in the approved allocation batch; 048 supplies the parity-preserving note-output parent; changed semantics must be deferred | answered D2 bounded negative by 049 for ordinary whole-window/same-grid reuse; broader methods untested | [Current batch](#current-batch-allocation-optimizations-at-most-3-experiments), [048 next](reports/048-challenger-output-copies.md#next) |
| 50 | Can eliminating copies of unused onset/contour maps, independently of input-buffer reuse, preserve complete numerical/live/prefix output while reducing measured allocation/work? | Second candidate in the approved allocation batch; 047 supplies the storage parent | answered D1 resource variant by 048; no stage or stall-repair claim | [048](reports/048-challenger-output-copies.md) |
| 49 | Can reusable raw-input and model-window storage preserve exact corpus inputs/outputs and causal prefixes while removing recurring explicit allocations? | First candidate in the approved allocation batch; does not depend on historical stall reproduction | answered D1 resource variant by 047; no stage claim or stall attribution | [047](reports/047-challenger-input-buffers.md) |
| 48 | Does the user reopen for further attributable stall evidence or redirect after 046's complete full-workload non-reproduction, following the independent closing review? | The accepted attribution continuation stops on no attribution; storage isolation is not a demonstrated stall repair | answered by the user: reopen for independent input/window reuse, unused-output-copy and contract-preserving DSP-cache resource experiments; no formal claim authorized | [Current batch](#current-batch-allocation-optimizations-at-most-3-experiments) |
| 47 | Can the complete 576-example challenger workload reproduce a no-inference stall with evidence/GC/CPU/scheduler ownership and distinguish accumulated harness evidence from isolated listener work? | Approved diagnosis follows R14; attribution precedes any repair or fresh formal claim | answered D3 no attribution by 046; no target in either arm | [046](reports/046-challenger-full-workload-trace.md) |
| 46 | Does the user reopen for attributable full-sweep no-inference-stall diagnosis or redirect after 045's valid quiet-host deadline failures, following independent review? | Failed promotion condition (a) stops the batch; quiet state supplies no allocation/runtime attribution | answered by the user: review, full-workload diagnosis, demonstrated fix, then formal claim; current batch above | [045 next](reports/045-challenger-quiet-host-stage.md#next) |
| 42 | Does the challenger pass the formal guitar stage-1 and silent-hesitation claim, both outputs and every control on all four development guitars under unchanged gates, measured once on a quiet host as the second amendment defines it, with the incumbent on every example and the frozen baselines on stage 1's clean examples? | Condition (a), freshly authorized by the user after R13 without assuming stall attribution | answered D2 by 045: two Martin hesitation deadlines fail on a valid quiet host | [Second amendment](contracts/development-contract-2.md#amendment-2026-10-05-host-stalls-guitar-sweeps-sentinels-and-the-outside-review) |
| 45 | Can one listener version reduce the challenger's live inference cost enough to leave a clear margin under .25 on every development guitar, Fender included, without changing any assessment or failing any cursor deadline or control? | 043 measured up to .2578 with a stall and 041 .2355 on Fender; 044's isolated arm .291 on a Fender noise control. A formal claim on that margin would not hold on a slower device | withdrawn by the user (2026-10-05) on R13's evidence: 043's clean Fender cost peaked at .211; spent only if 045 fails on cost | [044](reports/044-challenger-stall-diagnosis.md), [Second amendment](contracts/development-contract-2.md#amendment-2026-10-05-host-stalls-guitar-sweeps-sentinels-and-the-outside-review) |
| 44 | Does the user reopen or redirect the stopped batch to obtain attributable evidence beyond 044's quiet fixed panel? | D3 stops the batch; historical stalls remain unresolved and no harness-cause branch authorizes 045 | answered by the user (2026-10-05): latest revision reopened at 8 of 10 for fresh quiet-host 045 then held-out 046; cost-margin version withdrawn unless 045 fails on cost | [044 next](reports/044-challenger-stall-diagnosis.md#next) |
| 41 | Can a separately pre-registered diagnosis distinguish native/input work, runtime collection, scheduler stalls and indirect evidence-memory pressure behind 043's no-inference service outliers? | Original failures remain; fixed panel did not reproduce an attributable target | answered D3 no attribution by 044; batch stops at 8 of 10 | [044](reports/044-challenger-stall-diagnosis.md) |
| 39 | Can the next numbered experiment resolve 041's candidate-only timer attribution, with diagnostic tensor hashing and parity-snapshot copying separated from measured listener work, retaining fresh complete setup/feed/finish evidence before a formal claim? | Independent implementation review found conservative diagnostic work inside service; the saved durations cannot isolate it. Resolve attribution without rewriting 041 or changing gates | answered by 043 at the direct timer boundary; indirect runtime stall attribution is question 41 | [Implementation review 041: timers](bench/oracle-events/implementation-review-041.md#1-timers--does-not-hold-for-strict-candidate-only-scope) |
| 40 | Does an independent session rederive observation-seam@5's pending/populated finish snapshots, nonempty returned decision stamps and immutable history, and unsafe/nonfinite length refusals, agree on all five new cases and sample inherited rules in their declared layers? | Independent audit closes the scalar finish and safe-length gaps; native timer attribution remains question 39 | answered: 95 agree, 0 disagree, 0 ambiguous (5 new, 90 inherited); native obligations remain separate | [Audit 5](bench/oracle-events/audit-observation-seam-5.md), GPT-6-Astra (high) in Codex |
| 38 | Can the next numbered challenger resolution freeze and independently audit the remaining seam-4 scalar finish-state/nonempty-finish-emission and safe-length cases, and explicitly arrange independent native context/map/timer/provenance/prefix review with the implementation/results access that the oracle-audit prompt prohibits? | Audit 4 agrees on all 90 checked cases but lists uncovered rules and cannot grant native adoption approval; resolve these before formal cursor judgment | scalar fixtures frozen by 042 and agreed by audit 40; native review holds except strict timer attribution, separately resolved by 39 | [Audit 4: uncovered rules](bench/oracle-events/audit-observation-seam-4.md#rules-i-could-not-exercise), [resolution](bench/oracle-events/audit-observation-seam-4.md#resolution-and-verdict) |
| 37 | Does an independent session rederive observation-seam@4's physical representation and complete state/cost fixtures, agree on every added/reworked case and inherited samples in their declared layers, and assess native adoption/context/timer/prefix evidence before any formal cursor judgment? | New seam/oracle needs independent adequacy audit; author agreement and native parity cannot supply it | answered: 90 agree, 0 disagree, 0 ambiguous; remaining coverage and native adoption review are question 38 | [Audit 4](bench/oracle-events/audit-observation-seam-4.md), GPT-6-Astra (high) in Codex |
| 30 | Can a streaming Basic Pitch live path compute only new neural frames plus context, meeting sustained cost .25 and every .2-second compute-inclusive event deadline on clean/hesitation development guitars and all controls? | Original whole-model spike was too expensive; seam/native implementation and audit precede formal judgment | answered by 041 as exploratory comparisons; formal stage verdict is 31 after audit 37 | [041](reports/041-challenger-incremental-neural.md), [035](reports/035-challenger-basic-pitch.md#live-spike-observations-deadlines-and-cost) |
| 36 | Can the next numbered challenger experiment resolve seam-3 audit I3's float32 discrepancy, S5's missing lifecycle/reset inputs, O11's irregular-delivery scheduling, N1/N2's unstated normalization formula and P1/P2/P3/P5's physical-versus-abstract confidence layer, freeze the remaining gate-relevant state/cost cases, and obtain independent audit before native cursor judgment? | Challenger instrument resolution precedes question 30's listener verdict; the audit's full uncovered-rule table is the checklist, with pinned DSP/procedural obligations retained for native adoption | 041 versions seam 4/cases and builds/measures incremental neural inference; independent adequacy audit is 37, before formal cursor judgment | [041](reports/041-challenger-incremental-neural.md), [audit 3](bench/oracle-events/audit-observation-seam-3.md#resolution-and-verdict) |
| 35 | Does an independent session rederive observation-seam@3's 28 added cases and inherited samples, agree on all answers and assess the explicit remaining DSP/procedural coverage boundaries, before any native cursor verdict? | Instrument audit precedes listener judgment; implementation agreement cannot establish independent adequacy | answered: 66 cases, 57 agree, 1 disagree, 8 ambiguous; coverage incomplete; resolution is question 36 | [Audit 3](bench/oracle-events/audit-observation-seam-3.md), GPT-6-Astra (high) in Codex |
| 34 | Can the next numbered challenger experiment resolve seam-2 audit coverage gaps, explicitly define the sustained-cost numerator and denominator, and freeze cases for the remaining gate-relevant rules (including variable-wall-time prefix equality, refersTo/backdating, start/finish and empty-call cost accounting, cadence/window/watermark lifecycle and fractional interpolation), with explicit boundaries for pinned DSP/procedural obligations and an independent audit before listener judgment? | The audit agrees on all supplied numbers but agreement is not complete rule coverage; the full uncovered-rule table is the resolution checklist. This precedes quiet-noise controls and any seam-2 cursor verdict | 040 specification/state implementation agreement; independent seam 3 adequacy audit is question 35; folded into question 30 by the user (2026-10-04), no cursor verdict before audit | [Audit: uncovered rules](bench/oracle-events/audit-observation-seam-2.md#rules-i-could-not-exercise), [cost wording](bench/oracle-events/audit-observation-seam-2.md#cost-wording-needs-clarification) |
| 31 | Does the challenger pass guitar stage 1 and the silent-hesitation substage, both outputs and all controls, on all four development guitars under the amended gates, with the incumbent measured on the same examples and controls? | Conditions (a) and (b) of the amendment's decision 5; a full run of every example, since the sentinels are the incumbent's | answered D2 by 043: cost and deadline failures block the formal claim | [043](reports/043-challenger-guitar-stage.md), [Amendment](contracts/development-contract-2.md#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule) |
| 26 | Can a bounded Basic Pitch front-end/decoder repair reject Martin's spurious low-pitch wrong-score claims while preserving every passing development-guitar assessment and the quiet-noise controls? | Promotion needs all four development guitars; any fitted threshold is calibrated on separate development examples, never on what it is scored on | answered: 039 D1 component repair (finding 32); no live/stage claim | [039](reports/039-challenger-dominant-pitch.md) |
| 29 | With the quiet-noise silence control frozen (pink noise at −60 dBFS RMS, each performance's length, fixed generator and seed, beside every guitar example), do the current challenger and the incumbent reject it on both outputs, or does Basic Pitch's per-window normalisation invent notes in it? | The amendment makes it every guitar stage's silence control; digital zero told neither listener apart, and every later repair must be judged with it | answered: 038 D1 on fixed controls; front end invents low pitches but no score claim (finding 31) | [038](reports/038-challenger-quiet-noise.md), [Amendment](contracts/development-contract-2.md#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule) |
| 27 | Does a re-versioned observation-seam@2, which also states how measured compute enters `availableAt` and `madeAt` under [the amendment's compute-inclusive deadline](contracts/development-contract-2.md#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule), settle the two ambiguities the audit found, by stating whether `floor(p)+1` is an index or a count and whether "times already emitted" means equal times or times at or before the last emitted, and freeze hand cases for them and for the rules the audit could not exercise (a second run's emitted set and its shared availableAt, the reduction above threshold and its tie-break, the offline trim count, a stitched frame at i ≥ 344, the bin-to-MIDI map), with the audit's note on the stitched-time offset carried into any offline-versus-live comparison, and does an independent audit agree? | The audit rule makes this a prerequisite to any live-cursor verdict from the seam: ambiguity B changes which frames reach the three-frame confirmation and so the cursor's timing; the assessment path is unaffected | answered: 037 D1 and independent audit question 33 agree on supplied cases; remaining coverage and wording go to question 34 | [037](reports/037-challenger-observation-seam.md), [Audit](bench/oracle-events/audit-observation-seam-1.md#rules-i-could-not-exercise), [observation seam 1](contracts/observation-seam-1.md) |
| 28 | On 035's frozen guitar renders (576 examples, controls included), what do the unchanged event-chain@3's two outputs do under the current instruments, and how does each example compare with 035's challenger assessment? | The user's direction of 2026-10-04, after R11: the challenger's promotion rule needs the incumbent's guitar result, and R10's guitar thermometer asked for exactly this | answered: E2, the renders separate the front ends; incumbent 0/4 guitars on 035's criterion (finding 29) | [036](reports/036-incumbent-guitar.md) |
| 25 | Does an independent session rederive observation-seam@1's timing cases and producer arithmetic, checking resampling, padding, nominal availability versus CPU/wall time, and the limits of first-window runtime parity? | Answered: T1–T8 re-derived, 8 agree, 0 disagree, 0 ambiguous; availableAt is the nominal input clock and so a lower bound on physical latency; exact first-window parity is unreachable under the rules (layouts match only at N = 40004, not a run boundary, with different resamplers); the upstream stitched time sits up to about 8.5 ms off the seam's own grid; two rule ambiguities (the existence rule's `floor(p)+1`, and "times already emitted") and the uncovered rules go to question 27 | answered | [Audit](bench/oracle-events/audit-observation-seam-1.md), Claude Fable 5.1 |
| 24 | With Basic Pitch observations as its front end and the incumbent's chain unchanged, does the challenger pass the assessment gates, controls included, on `sample-render@1` renders of the stage-1 scores from the development guitars, what does it do on the frozen sine sets, and what look-ahead and cost does an in-process live path need against the 200 ms cursor gate? | The user opened the challenger track on 2026-10-02 (current batch); the first experiment carries an exploration budget, so this is the question it explores rather than predicts | answered: D1 continuation, three sources; Martin controls fail; live exploratory (findings 27–28) | [Contract 2, challenger track](contracts/development-contract-2.md#the-challenger-track-basic-pitch-observations), [avenue A2](TRACK_PROPOSALS.md#a2-basic-pitch-observations-through-the-event-chain) |
| 23 | Does the incumbent follow and identify a single wrong note, while rejecting near-miss w1 and retaining every confirmed substage and the passed omission sentinels? | Next deviation in contract 2 after missing-event passes; exact-pitch deletion success does not establish wrong-note following/assessment | paused by the [2026-10-04 amendment](contracts/development-contract-2.md#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule): the sines are retired; returns as a guitar deviation in stage 2 | [034 next](reports/034-missing-event-sweep.md#next), [contract 2 order](contracts/development-contract-2.md#order-of-work) |
| 22 | Does the unchanged incumbent recover after a single missing event (cursor recovery, `missing` findings, the spanning interval) while retaining every passed substage, and does the full sweep due at batch end 034 confirm the substages passed since g031b? | Next deviation in contract 2's order; rushed bar now passed (finding 25); the sweep is due at the batch's end | answered: yes, D1 (finding 26) | [Contract 2 order](contracts/development-contract-2.md#order-of-work), [034](reports/034-missing-event-sweep.md) |
| 21 | Does the unchanged incumbent pass one rushed bar, retaining the held-note and earlier substages under current gates? | Answered by 033: all 479 active examples pass; fast flags 64/66, misses only at the exact threshold | answered: yes, D1 (finding 25) | [033](reports/033-rushed-bar.md) |
| 19 | After reporting repair, does the incumbent hold a hesitation while the previous note keeps ringing, before rushed/missing/wrong/dead/extra deviations? | Answered by 032 on constant non-overlapping sine sustain; ringing/overlapping guitar remains outside this stage | answered: yes, D1 (finding 24) | [032](reports/032-held-note-hesitation.md) |
| 20 | Does a completion of 031's frozen pre-registration (event-chain@3 in the full sweep, with the repaired summary writer) record D1: stage 1 confirmed, hesitation/slowedBar/four-bar passed, sentinels re-chosen? | Answered by g031b: all 516 examples, pools, sentinels, causality and cost pass | answered: yes, D1 (finding 23); route chosen by the user, "g031b is fine" | [031 completion](reports/031-other-bars-reporting.md#completion-g031b-by-the-users-authority) |
| 17 | Can a new listener change only its offline bar-reporting policy to the approved other-bars reference/eligibility, clearing reopened hesitation and slowedBar and four-bar revalidation while preserving live/note/interval behavior? | Lowest reopened substage comes first;030 isolates obsolete flags with all other components passing | answered by g031b: yes (finding 23); g031/g031a's D3 stays recorded | [031](reports/031-other-bars-reporting.md) |
| 18 | Does the full sweep due by031 preserve all historical/current evidence and controls, with frozen baselines reused only where producers and inputs remain unchanged? | Required by the rising tide, independent of routine component passes; combine with031's repair evaluation | answered by g031b: yes, the sweep passes; baselines cited by hash where unchanged and fresh on four bars | [030 resulting state](reports/030-current-instruments.md#resulting-stopping-count-budgets-and-evidence-access) |
| 16 | Does unchanged event-chain@2 pass current-instrument historical and frozen four-bar revalidation? | Answered: stage1 passes; short-score reporting fails and reopens hesitation/slowedBar; four-bar own measures pass but earlier sentinels prevent promotion | answered: resolved failure | [030](reports/030-current-instruments.md) |
| 15 | Does an independent session rederive event-oracle@4's corrected B1/B11 and every added report/null/omission/state/selection/headroom/plan case, agreeing with the frozen answers and checking the explicit adapter/procedural limits? | Answered: 138 cases re-derived (89 in oracle 4, 49 inherited samples from oracle 2), 138 agree, 0 disagree, 0 ambiguous; B1's corrected reference and ratio and B11's exact `either` boundary confirmed; two places where the rule text is thinner than the case (S13, X4/X5) noted without changing a verdict; rules still uncovered listed, none gate-read on the stages in hand | answered | [Audit 4](bench/oracle-events/audit-4.md), Claude Fable 5.1 |
| 14 | Does a corrected event-oracle@4 carry B1's bar 0 reference as 30 (ratio 1), settle B11's boundary (state the comparison arithmetic or reshape the case so its 1.05 ratio is exact), and freeze hand cases for the rules audit 3 found uncovered — report-level bar measures (ineligible and `either` bars in the false-alarm denominators, summaries matched by ordinal, local/reference/ratio errors), a bar whose reference is null, reopening a `passed` substage, a routine pass preserving `confirmed`, the `rejection` and interval headroom formulas — and does an independent audit agree with it? | The audit rule makes this a prerequisite to any listener judgement under instruments3; B1 changes informational reference/ratio fields without changing its verdict or `clean`; B11's ambiguity changes `clean` and whether a bar-3 flag is a false alarm | answered: corrected; implementation and [audit 4](bench/oracle-events/audit-4.md) agree | [029](reports/029-oracle-coverage.md), [Audit 3](bench/oracle-events/audit-3.md), [audit rule](contracts/development-contract-2.md#auditing-an-oracle) |
| 13 | Does an independent session rederive event-oracle@3, including B1's preserved disagreement and every new other-bar/suite rule? | Answered: 34 cases re-derived, 32 agree, 1 disagree (B1's bar 0 reference and ratio, as the freeze recorded), 1 ambiguous (B11's decimal onsets); uncovered rules listed for question 14 | answered | [Audit 3](bench/oracle-events/audit-3.md), Claude Fable 5.1 |
| 12 | Do new event instruments and stage states implement the approved other-bars reference and rising tide, with a frozen hand-worked oracle and deterministic suite record? | Implemented but mixed: B1 frozen hand arithmetic disagrees; suite/bootstrap/data checks hold, independent audit next | answered: mixed, pending audit | [028](reports/028-other-bars-suite.md) |
| 11 | Can a new listener reject transient pitch skips or recover from premature live-state commitment, passing the frozen slowed-bar set and all earlier regressions/controls? | Answered: event-chain@2 prevents both skips; all 264 examples and earlier pools pass, musical assessment unchanged, +10 ms ordinary live latency (finding 16) | answered | [Report 027](reports/027-live-confirmation.md) |
| 10 | Does event-chain@1 follow a single slowed bar and assess its variation correctly, preserving stage 1 and the hesitation substage? | Answered: no as a complete substage; assessment/controls pass but two cursor examples fail. Earlier substages preserved (findings 14–15) | answered | [Report 026](reports/026-single-slowed-bar.md) |
| 9 | Does event-chain@1 hold its cursor through a single hesitation and report the resulting tempo variation, without losing stage 1? | Answered: both outputs and controls pass; exact regression records and assessments preserved (finding 12) | answered | [Report 025](reports/025-single-hesitation.md) |
| 4 | Can the simplest event-based live cursor and end-of-piece assessor pass stage 1, controls included, with stage 1's wrong score replaced by a distant one? | Answered: event-chain@1 passes both outputs and all controls (finding 10) | answered | [Report 024](reports/024-event-chain-stage1.md) |
| 6 | Does an independent session, re-deriving **event-oracle@2** by hand from [event instruments 2](contracts/event-instruments-2.md), agree with it? | Answered: yes on every number a gate reads. 66 records and reports re-derived, all 13 derived blocks included: 63 agree, 0 disagree, 3 ambiguous (F9's `indeterminate` figure only, question 8) | answered | [Audit 2](bench/oracle-events/audit-2.md), Claude Fable 5.1 |
| 5 | Do the instruments, versioned for the user's decisions (typical-tempo reference, interval durations with a floor, clean examples, the dead verdict, the controls), reproduce a re-worked hand oracle, and what do the frozen baselines do on stage 1's new controls? | Answered: yes, exactly (finding 6); the clock fails every control and the time warpers fail two wrong-score controls (findings 7, 8) | answered | [Report 023](reports/023-instruments-decisions.md) |
| 1 | Do following-evaluator@2 and assessment-evaluator@1 reproduce independently hand-worked oracle cases? | Answered: yes, exactly (finding 1) | answered | Experiment 022 |
| 2 | On stage 1, where do the clock and the frozen versions 8, 12 and 14 fail, and do the failures show the forward-only, tempo-clamped design? | Answered: ahead of a slow player; indistinguishable at the handed tempo (findings 2–3) | answered | Experiment 022 |
| 3 | Which numerical gates, flag reference tempo and dead-note verdict does the user approve? | Decided by the user after 022 | answered: gates approved for stages 1–3 with two changes; typical tempo; a dead verdict | [Report 022](reports/022-event-instruments.md#proposed-gates-awaiting-the-users-approval) |
| 7 | Does the user approve the proposed control-assessment gates and the exclusion of controls from the pooled finding rates, and does `w1` stay as stage 1's wrong score? | Decided by the user after 023 | answered: gates approved; `w1` moves to stage 2, and stage 1 gets a distant wrong score | [Contract 2](contracts/development-contract-2.md#the-progression-start-simple-one-change-at-a-time) |
| 8 | Which figure owns the excluded time that is both pending and indeterminate? | The audit's one ambiguity | answered: once, as pending, by the [clarification](contracts/event-instruments-2.md#clarification-2026-09-30); no oracle number changes | [Audit 2](bench/oracle-events/audit-2.md) |

## Superseded and stopped

| # or rank | Was | Superseded or stopped by | Date |
|---|---|---|---|
| Finding 2 | The time warpers' only stage-1 failure is running ahead | Finding 8: with controls, they also follow a semitone-neighbour wrong score ([report 023](reports/023-instruments-decisions.md)) | 2026-09-30 |
| Finding 5 | A hesitation makes steady bars read fast | The user's typical-tempo decision, implemented in event instruments 2 ([report 023](reports/023-instruments-decisions.md)) | 2026-09-30 |
