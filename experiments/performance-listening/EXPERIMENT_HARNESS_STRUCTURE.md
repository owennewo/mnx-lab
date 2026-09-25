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
change is an event that invalidates earlier comparisons. **Contents** are everything
that grows: golden sets, generators, sources, candidates, profiles, research notes and
experiment records. A content change is a new row in a ledger.

The ordering below follows from one rule: no content is produced until the contract it
depends on is fixed. Otherwise the first convenient output becomes the contract by
default.

## The pieces

### 1. Assessment vocabulary and listener interface

**Owns:** the words a listener may use and the shape of the exchange with it.

A listener receives the intended score and audio delivered in timed chunks under
declared delivery conditions. It emits decisions, each stamped with the moment it was
made as well as the musical time it refers to. The first milestone needs three kinds of
statement: an estimated position with a confidence, a declaration that following is not
supported, and, later, a note-level verdict (match, missing, extra, substitution,
timing error). Abstention is a statement, not silence.

Two properties are built in from the start because they cannot be retrofitted:

- **Chunked, clocked delivery.** Causality is verified by running the same prefix with
  different futures, which is only possible if the listener never sees more than the
  clock has released.
- **Revisable decisions that never erase.** A later decision may supersede an earlier
  one, but the earlier one stays in the record so exposure time of a wrong judgement
  can be counted.

The golden format is this same contract seen from the label side, so the two are
written together.

### 2. Golden format and corpus store

**Owns:** what a labelled example contains and how sets of them are kept.

Each golden carries the intended score, the actual-performance labels, the expected
assessment, a complexity profile across the declared dimensions, recording conditions,
provenance (how each label was obtained and its stated precision), and a partition
(development, reserved, acceptance). Following labels include the performed route.
Where the score has repeated material, the expected assessment lists the set of
positions the audio so far supports rather than a single one, so justified ambiguity
is rewarded and unsupported certainty is not.

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

- **Library recordings.** Studio's synced scores give performed-bar start times, route
  included, against real recordings. Ingestion extracts the audio, converts the sync
  points into bar-level following labels with their stated precision, partitions by
  piece and performer, and marks the solo-guitar subset apart from the mixed one. The
  fetched audio stays uncommitted.
- **Score perturbation.** Keeping a real recording's audio and altering the score the
  listener is given yields exact discrepancy and navigation labels on real audio: a
  removed score note, a changed pitch, an added or removed repeat, an unrelated piece.
  The recipe is provenance, hidden from the listener.
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
set, evaluator and conditions into the result. Two runs with the same pins produce the
same record.

### 8. Candidates and comparators

**Owns:** the hypotheses under test.

Every candidate is a versioned, reproducible artefact behind the listener interface.
The first is a **null follower**: it assumes the score's tempo and advances a clock.
It exists to prove the pipeline end to end and to be the floor every later candidate
must clear. The second is an established method from the literature as a comparator.
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

### 10. Research notes

**Owns:** what was read and what it motivated.

Each note records the source, its date or version, the claim, the conditions it was
tested under, its limitations, whether the LLM is reporting or inferring, and the local
experiment it motivates. Unsuccessful searches are notes too.

## Order of construction

| Step | Pieces | Done when |
|---|---|---|
| Contracts | 1, 2 | The vocabulary, interface and golden format are written and versioned |
| Instrument | 3, 4 | The evaluator passes its oracle and a report renders from an oracle case |
| Pipeline | 5 (harness profile), 7, 8 (null follower) | A run over the harness set produces a report the evaluator and oracle agree with, and the causality check passes |
| Real evidence | 6 (library recordings, score perturbation) | Solo library recordings are goldens with declared precision; a few are hand-checked; negative controls exist on real audio |
| Loop | 9, 10 | The first contract is approved; the retention rule runs on two recorded runs |
| Candidates | 8 | The first real hypothesis and a comparator are compared under the contract |

Steps three and four run in parallel. Everything after the last step is the loop
itself. Re-amplification, sample-based generators, the assessment milestone and a live
microphone rig arrive once a candidate has been retained on real evidence.

## How the pieces mature

Inputs climb two ladders at once: the synthetic profile ladder, one dimension at a
time and then in combination, and a real-source track that starts hard on timbre and
recording conditions while every other dimension stays at level one. Candidates mature
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
