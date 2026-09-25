# Experiment harness: the shape of the pieces

[APPROACH.md](APPROACH.md) states the research obligations. This document names the
structural pieces that discharge them, what each one owns, and the order in which they
have to exist. It describes shape and responsibility, not technology: no file format,
language, library or algorithm is chosen here. Where an example is given it is an
example, not a decision.

## Contracts and contents

The harness has two kinds of piece. **Contracts** are the few things every other piece
is measured against: the assessment vocabulary, the golden format and the evaluator's
counting rules. They are written first, changed rarely, and versioned; a contract
change is an event after which earlier comparisons stand as history but are no
longer comparable with new ones. **Contents** are everything
that grows: golden sets, generators, sources, candidates, profiles, research notes and
experiment records. A content change is a new row in a ledger. One piece is neither:
the **research log** (piece 11) is the single file that is rewritten in place, because
it states what is currently believed rather than what happened.

The ordering below follows from one rule: exploratory examples may inform a draft
contract, but a comparison used to retain a candidate requires a frozen one. Otherwise
the first convenient output becomes the contract by default.

## The pieces

### 1. Assessment vocabulary and listener interface

**Owns:** the words a listener may use and the shape of the exchange with it.

A listener receives the intended score and audio delivered in timed chunks under
declared delivery conditions. It emits decisions, each stamped with the moment it was
made as well as the musical time it refers to. The first milestone needs three kinds of
statement: an estimated position with a confidence, which must be able to express
unresolved ambiguity between positions rather than forcing one; a declaration that
following is not supported; and, later, a note-level verdict (match, missing, extra,
substitution, timing error). Abstention is a statement, not silence.

Two properties are built in from the start because they cannot be retrofitted:

- **Chunked, clocked delivery.** Causality is verified by running the same prefix with
  different futures, which is only possible if the listener never sees more than the
  clock has released.
- **Revisable decisions that never erase.** A later decision may supersede an earlier
  one, but the earlier one stays in the record so exposure time of a wrong judgement
  can be counted.

The golden format shares this vocabulary's meanings, so the two are written together,
but they are not the same contract: reference evidence may be richer, coarser or more
uncertain than a listener's decision record.

### 2. Golden format and corpus store

**Owns:** what a labelled example contains and how sets of them are kept.

Each golden carries the intended score, the actual-performance labels, the expected
assessment, a complexity profile across the declared dimensions, recording conditions,
provenance (how each label was obtained and its stated precision), and a partition
(development, reserved, acceptance). Following labels include the performed route where it is known.

Labels are allowed to be partial. A label may be exact, bounded by a stated
uncertainty, a set of positions the audio so far cannot distinguish, or explicitly
unknown for a region. Where the score has repeated material the expected assessment
names the equivalent positions rather than one, so justified ambiguity is rewarded and
unsupported certainty is not. Exhaustive annotation is not required; the evaluator
measures only the claims the labels can support, and unknown regions count as
unassessed evidence, not as either success or failure.

A set is frozen once used for comparison; any change to audio or labels is a new
version. The store also keeps the **partition registry** and a log of every access to
reserved sets, since a reserved set becomes development evidence the moment its
failures inform a revision.

Fields for note-level assessment are reserved in the format now even though the first
milestone does not populate them.

### 3. Evaluator and its oracle

**Owns:** the independent measurement of how correct an assessment was.

The evaluator reads a listener's decision record and a golden, and produces counts by
category with their denominators: position and timing error over time, loss and
recovery of following, false following (including on negative controls), coverage and
abstention, agreement between claimed confidence and observed correctness, decision
timeliness and missed deadlines, exposure time of wrong decisions, and the causality
check. Assessment-accuracy categories are added at the second milestone and nowhere
else.

The evaluator has an **oracle of its own**: a small set of hand-written decision
records against hand-written goldens, with the expected counts worked out by hand and
versioned with the evaluator. This is how the evaluator is built and trusted before
any listener exists, and how a changed number is later traced to the candidate rather
than to the instrument. No candidate is ever that oracle.

### 4. Reports

**Owns:** the view of results that the loop reads failures from.

A report breaks results down by profile, by example and by error category before any
summary appears, and compares two candidates on the same examples with the uncertainty
of their difference. It exists before the first run, because the loop's next question
is selected from it. Aggregates that would hide a failing case or category are not a
report.

### 5. Generators

**Owns:** audio with exact labels from a known musical description.

A generator declares which complexity dimensions it controls and over what ranges, and
emits goldens directly, since it knows every event it produced. The first generator is
the harness profile: sine tones, one note per beat, constant tempo. Later generators
add richer tones, instrument samples, expressive modulation and rhythmic variety, one
dimension at a time and then in combination. New seeds from the same generator are
not new sources.

### 6. Source ingestion

**Owns:** turning recordings that already exist into goldens, with honest provenance.

Three ingestion routes are foreseen, each recording how its labels were obtained and
where their precision ends:

- **Library recordings.** Studio's synced scores anchor performed bars to seconds in
  real recordings. The anchors reference no particular score version, may be sparse,
  and may fall inside bars, so ingestion begins with an eligibility check: which score
  the anchors describe, whether its repeat structure matches the recording's route,
  which regions are anchored and at what precision. Observed anchors stay
  distinguishable from positions interpolated between them, and unanchored regions
  stay unlabelled. Each recording gets its actual complexity profile recorded rather
  than an assumed one. Ingestion partitions by piece and performer and marks the
  solo-guitar subset apart from the mixed one. The fetched audio stays uncommitted.
- **Score perturbation.** Keeping a real recording's audio and altering the score the
  listener is given produces a controlled change to the intended score. The expected
  discrepancy is exact only where independent performance labels establish the affected
  events: an unrelated piece or a changed repeat structure is a following control on
  any bar-labelled recording, but a removed or altered score note is an exact
  note-level discrepancy only where the recording is independently known to contain
  that note. Otherwise the example supports a coarser judgement or is partially
  labelled. The recipe is provenance, hidden from the listener.
- **Re-amplification.** Generator output played through a speaker and recorded through
  a microphone, with the delay and drift calibrated or declared. This tests recording
  transfer without a player.

Human annotation of new recordings is a fourth route, reserved for what the others
cannot supply: actual note timing for the assessment milestone and free-timing
performances.

### 7. Runner

**Owns:** executing a candidate over a set reproducibly.

The runner delivers audio to a candidate under the declared conditions, records every
decision with its clock time, measures processing cost including sustained backlog and
tail latency, performs the prefix-invariance test, and pins the versions of candidate,
set, evaluator, conditions and any randomness into the result. Two runs with the same
pins produce the same logical decision record. Timing and cost measurements are
repeatable rather than identical: they carry their execution conditions and declared
variability, and a busier machine is not a reproducibility failure.

### 8. Candidates and comparators

**Owns:** the hypotheses under test.

Every candidate is a versioned, reproducible artefact behind the listener interface.
The first is a **trivial baseline** that proves the pipeline end to end and sets the
floor every later candidate must clear; a follower that assumes the score's tempo and
advances a clock is one example. An **informative external comparator** follows, so
that the first real hypothesis is measured against something other than the floor.
From then on, candidates are whatever the loop proposes; no family is preferred.

### 9. Research contract and ledger

**Owns:** the decision rules and the history.

The **research contract** is written before a batch and is sufficient for another run
to make the same retain-or-reject decisions: capability, profile, freedoms, tolerances,
thresholds, budgets, partitions, evidence supply, comparator, priorities and stopping
conditions. The first contract of each milestone, and any later loosening, is
human-approved. The **retention rule** is a procedure, not a judgement: given two runs
and the contract, it says retain, reject or inconclusive, accounting for uncertainty.
The **ledger** records every experiment: hypothesis, sources, parent and candidate,
data and evaluator versions, results by category, resource use, decision and next
action. Rejected ideas stay in it.

### 9a. Loop driver

**Owns:** deciding what happens next, traceably.

The runner executes, the reports explain, the ledger remembers and the retention rule
chooses between two candidates. None of them chooses the next question. That
responsibility is the loop driver: it selects the next question from measured failures
ranked by the contract's priorities, initiates and applies web research, allocates
experiment and evidence budgets, freezes a candidate before reserved evaluation,
decides whether to continue, change direction or stop, and resumes an interrupted
session from the research log (piece 11), which points it at the ledger rows that
matter. It is a procedure the LLM executes with its state in the log and its history
in the ledger, not necessarily a separate component. Its defining requirement is that
every next action is traceable to the contract, the measured results and the recorded
research, so that nobody has to read a report and decide.

### 10. Research notes

**Owns:** what was read and what it motivated.

Each note records the source, its date or version, the claim, the conditions it was
tested under, its limitations, whether the LLM is reporting or inferring, and the local
experiment it motivates. Unsuccessful searches are notes too.

### 11. Research log

**Owns:** what is currently believed, and where a reader starts.

The notes say what was read, the ledger says what was run and decided, and neither
says what the experiment now knows. The research log does. It is one file at the top
of the experiment, read first by a person or a resuming driver, and it holds three
things: a **current state** of a few sentences, rewritten whenever an experiment
lands; a **findings index**, one line per finding, each citing the note, ledger row or
per-experiment write-up that supports it; and the **open questions**, ranked as the
driver ranks them, so the next question is visible without reading a report.

Three rules keep it honest. A finding cites its evidence or it is not a finding. A
finding that later evidence contradicts is marked superseded, with the row that did
it, and is never deleted, so the log carries the same history the ledger does.
Numbers stay in the write-ups the findings cite; the log names the finding and points
at the measurement, because a figure copied into a summary goes stale within days.
The previous experiment's technique log is the precedent, and its header repeating
figures that no longer held is the failure this rule prevents.

## Order of construction

| Step | Pieces | Done when |
|---|---|---|
| Contracts | 1, 2, 9 (provisional contract), 10, 11 | The vocabulary, interface and golden format are written and versioned; a provisional research contract names the labels, tolerances and delivery conditions the other pieces must support; provenance and research records exist; the research log exists with its structure and no findings |
| Instrument | 3, 4 | The evaluator passes its oracle and a report renders from an oracle case |
| Pipeline | 5 (harness profile), 7, 8 (trivial baseline) | A run over the harness set produces a report the evaluator and oracle agree with, and the causality check passes |
| Real evidence | 6 (library recordings, score perturbation) | Eligible solo library recordings are goldens with declared precision and unknown regions; a few are hand-checked; following controls exist on real audio |
| Loop | 9 (retention rule), 9a | The first contract is human-approved; the retention rule runs on two recorded runs; the driver's next action is traceable |
| Candidates | 8 | The first real hypothesis and a comparator are compared under the contract |

Steps three and four run in parallel. Everything after the last step is the loop
itself. Further evidence arrives according to the question being tested, not on a fixed
sequence: re-amplified or microphone evidence may be needed to achieve the first
retention on real audio, not only after it. Sample-based generators, the assessment
milestone and a live microphone rig follow the same rule.

## How the pieces mature

Inputs climb two ladders at once: the synthetic profile ladder, one dimension at a
time and then in combination, and a real-source track that starts hard on timbre and
recording conditions. Re-amplified sets hold every other dimension at level one by
construction; real performances arrive with whatever profile they actually have, which
is recorded rather than assumed. Candidates mature
only by retained comparisons, so their pace is set by the supply of independent
evidence, not by the supply of ideas. Assessments mature in two steps, following then
note-level judgement, with the evaluator's categories widening at the milestone
boundary and nowhere else. Timeliness and cost are measured from the first run against
a provisional budget, because they are cheap to measure and they shape what candidates
get proposed.

## What stays outside

This harness measures; it does not integrate. The live microphone path, the browser,
Studio's model and the product decision each have their own record, and a result here
is evidence toward them, not a pass.
