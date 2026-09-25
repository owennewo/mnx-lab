# Performance listening: a fresh approach

## Objective and scope

Develop a listener that is given an intended score and assesses how an audio
performance relates to it. It should follow the performer's position and timing,
identify supported matches and discrepancies, and acknowledge uncertainty.
The immediate focus is score following and performance assessment. Extracting a
score from audio without being given the score is outside this experiment's scope.

Start with deliberately simple, labelled examples. Increase difficulty as measured
results justify it. The eventual destination is Studio, using the internal MNX model
to represent scores, guiding a player while they play. The listener that matters is
therefore causal and prompt; offline results can help diagnose the cost of that
constraint, but are not the goal or proof of an acoustic ceiling. This document
defines objectives, not an implementation or permission to integrate an experimental
listener into the product.

The first useful milestone is supported following: locate the performer, follow
permitted timing variation, recognise when the evidence no longer supports following,
and recover within a declared scope. A musician can be following the score while
making mistakes. Detailed note and timing assessment is a separate capability with
separate acceptance criteria; neither capability's success implies the other's.

The research should be runnable by an LLM with little ongoing human judgement.
That requires independent evidence and explicit decision rules, not just permission
to keep trying algorithms. This document specifies the research obligations; algorithm
families, representations and software structure remain choices for experiments.

The [previous experiment](archive/ARCHIVED.md) is historical evidence. This restart
does not inherit its algorithms, event contracts, thresholds or acceptance budgets.

## Inputs: generators and sources

A **generator** creates audio from a known musical description. It may produce pure
sine tones, richer synthesised tones, or use instrument samples. Generators declare
which complexity dimensions they can control and the ranges they support.

A **source** is a particular audio clip, paired with an aligned description of what
sounds in it. The score may come first and drive a generator, or the recording may
come first and receive human annotations. Both produce labelled examples. Record
how the labels were obtained and where their precision is limited.

Hand-annotating onsets to the precision a timing judgement needs is slow and itself
uncertain. Seek sources that reduce annotation effort without confusing intended
events with observed events:

- **Re-amplified** generator output, played through a speaker and recorded through a
  microphone, preserves the generated musical events while the room, microphone,
  noise and level vary. Recording delay, clock drift and changed audible boundaries
  need calibration or declared uncertainty. This tests recording transfer, not all
  the behaviour of a real instrument and player.
- A **click-guided** human performance establishes intended timing, not actual note
  timing or pitch. For following, intended timing at bar and beat resolution within a
  declared tolerance is adequate ground truth. For assessment, actual performance
  labels still require independent evidence; small deviations cannot be assumed.
- Existing independently annotated recordings can bring real performances into the
  loop early. Check annotation methods, precision, population, licence and fitness
  for the judgement being tested. A transcription dataset need not establish what
  score the musician intended to follow.
- **Library recordings with sync points.** Studio's library holds about ninety Guitar
  Pro scores, each synced to a recording, usually a YouTube video, as a list of
  performed-bar start times with repeats unrolled. Roughly one in seven is a solo
  guitar performance that follows the score closely; the rest have vocals or other
  instruments. The audio is extractable with a little effort. This is following ground
  truth at bar resolution, route included, from real players on real instruments in
  real recording conditions, and it costs no new annotation. Its limits are declared,
  not assumed: sync points were placed by hand or by import, so their precision is
  bar-level and uneven; scores may carry transcription mistakes; and a solo recording
  is not guaranteed note-for-note. It says nothing about note onsets or actual pitch,
  so it serves following, not assessment. The mixed recordings are a harder profile,
  other instruments and voices alongside the performer, and remain following evidence
  for later. A label is corrected only when a failure has been traced to it with
  independent evidence, such as listening or a second annotator, and the correction is
  a new version of the set, never a route to a pass. The fetched audio is for local
  research and stays uncommitted, like the archived recordings.

Real human performances are necessary evidence, including free timing as that enters
scope. Neither unlimited synthetic examples nor repeated transformations of a few
recordings substitute for independent players and recording sessions.

The aligned description includes pitch or frequency, note start and duration, and
may include loudness, articulation and pitch or amplitude changes through time.
Use MNX as the musical score representation, with the timing and acoustic annotations
needed to judge a performance. The exact representation of those annotations is a
later decision. Score duration and audible decay are distinct: a released note may
continue sounding, and annotations must state what their boundaries mean.

## Complexity dimensions

Describe each source with a profile across independent dimensions. A single overall
level would hide which challenge an algorithm can or cannot handle. The generator's
capabilities and the complexity actually present in a source are separate facts.

| Dimension | What varies | Starting profile: level 1 |
|---|---|---|
| Melodic | Pitch range, intervals, chromatic notes, tuning and microtones | C-major notes within C4–B4, around A4 = 440 Hz |
| Polyphonic | Simultaneous notes and overlap between successive notes, including release tails | One note at a time with clear silent gaps |
| Harmonic | Partial content and timbre, from pure tones to instrument-like spectra and recorded samples | Sine tones with no added harmonics |
| Expressive dynamics | Loudness changes, vibrato, tremolo and other expressive modulation | Constant note level; no expressive modulation |
| Note duration and rhythm | Note lengths, rhythmic patterns, articulation and attack, sustain and release shapes | One note each beat, sounding for half a beat, with a simple consistent envelope |
| Tempo / BPM | Absolute speed and changes in speed | Constant 60 BPM |
| Structural ambiguity | Repeated notes or phrases, similar passages, rests and score length | Short, distinguishable phrases without repeated sections |
| Navigation | Starting position, pauses, restarts, repeats and skips | Known start; continuous traversal from beginning to end |

This defines the first profile, not a universal ladder of difficulty. Later levels
must describe their actual contents and ranges. Initially vary one dimension at a
time to understand failures; later combine dimensions to expose interactions.
For example, complex timbre need not imply complex rhythm. Sample-based generators
may eventually use instrument collections such as nbrosowsky/tonejs-instruments.

Level 1 in every dimension is a check of the harness, not of listening: a single
spectral peak passes it. Its value is that the golden format, the evaluator and the
reports exist and agree before any real challenge arrives. Passing further synthetic
levels says little about the destination on its own.

For the following milestone, difficulty concentrates in the tempo, structural
ambiguity and navigation rows and in the recording conditions below. The melodic,
polyphonic and harmonic rows mostly govern how hard the notes are to hear, which
matters more to assessment. Rank following failures accordingly.

Recording conditions are additional declared factors: microphone, room, background
noise, recording level, and other instruments or voices sounding alongside the
performer. Success on generated audio does not establish success on
recordings of real instruments. The previous experiment's largest measured loss was
timbre and recording transfer, not musical complexity, so raise the harmonic dimension
and the recording conditions **early**, as a parallel track with every other dimension
still at level 1, rather than after the synthetic ladder is exhausted. A real
instrument playing one note per beat into a microphone is a level-1 source with a
hard harmonic profile, and it is where the destination's difficulty actually lives.

## Goldens and the meaning of a correct assessment

A **golden set** is a fixed collection of labelled audio–score examples with declared
complexity and provenance. Generators can create candidate sets for a requested
profile. Reference labels must come from generation or independent annotation,
never from the listener being evaluated. Once used for comparison, a set stays fixed;
changing its audio or labels produces a new version.

Assessment tests need three distinguishable facts:

- **Intended score:** what the performer was supposed to play, given to the listener.
- **Actual performance labels:** what sounded and when, available to the evaluator.
- **Expected assessment:** the matches and discrepancies between those two, including
  known uncertainty in the labels.

For correct playback, intended and actual notes agree. For a deliberately altered
performance, preserve both descriptions. A missing note, extra note, substitution or
shifted onset then has a known answer. An unrelated audio–score pair is also a useful
control: the listener should report mismatch or failure to follow, rather than force
an alignment that makes the performance appear correct.

Golden sets therefore include correct performances and controlled discrepancies,
even at the simplest musical complexity. Define how each discrepancy is counted so
that, for example, a substitution is not accidentally counted differently by each run.
As scope grows, include plausible negative controls: matching rhythm with wrong
pitches, notes in the wrong order, initially matching playing that diverges, silence,
and background music or metronome bleed. Advancing through a score is not itself
evidence of following.

Controlled discrepancies do not require new recordings. Keeping a real recording's
audio and altering the score given to the listener yields exact labels on real audio:
removing a score note makes the performed note extra, changing a pitch makes a
substitution, adding or removing a repeat makes a navigation control, and handing
over a different piece makes an unrelated pair. The perturbation recipe is part of
the golden's provenance and is hidden from the listener like any other label.

Following labels include the performed route through the score, including repeat
occurrences, where that route is known. Distinguish hindsight truth from what the
audio available at a decision time can establish. Identical phrases may support
several positions until a distinguishing event arrives. Expected assessments must
allow that ambiguity rather than reward unsupported certainty.

The golden format, the counting rules and the evaluator are the **first deliverable**,
fixed before any listener is written and versioned like the sets themselves. Otherwise
the first algorithm's convenient output becomes the contract by default, and every
later algorithm is measured on the first one's terms. The evaluator needs an oracle
of its own: a small set of hand-checked assessments with expected metrics, versioned
with it, so that a change in a measured result can be traced to the candidate rather
than to the measuring instrument. A candidate is never that oracle.

Separate examples used for development, reserved checks used to decide whether to
retain a candidate, and final acceptance evidence. Split by the independence relevant
to the claim: for example, performer, piece, session or instrument/sample source.
Keep variants of one recording together. New random seeds from the same generator
do not demonstrate transfer to a new source.

Limit and record access to reserved checks. Once their failures inform revisions,
they are development evidence; subsequent confirmation needs fresh checks. Keep final
acceptance evidence unconsulted during candidate selection. If independent evidence
is exhausted, report that limit rather than relabel reused examples as fresh.

## What an algorithm does

The listener receives the audio and intended score. It estimates where the performance
is in the score and assesses correspondence: supported matches, missing or extra notes,
wrong pitches and timing errors. It may report insufficient evidence. It cannot read
actual-performance labels, the recipe for an injected error, or the expected verdict.

Following and judging are related but distinct objectives. A deliberate local timing
error must remain detectable, while an allowed change in performance tempo should be
followed. Each experiment declares the permitted timing freedom and what counts as an
error, so flexible alignment cannot silently explain away every mistake. A missing
note, a late note and a pause may be indistinguishable for a time; define when a
judgement becomes answerable and how unresolved cases are counted.

Real-time following uses only audio available at the moment of a decision. Experiments
that use the complete clip declare that access separately. A listener may be accurate
with hindsight and still be too late to guide a player.

Algorithms are hypotheses to test and replace. There is no requirement to preserve an
older algorithm's detections or to select a particular signal-processing family.

## Outputs and evaluation

Use **assessment** for the listener's account of a performance, and **evaluation** for
the independent measurement of how correct that account is. Results should explain
concrete successes and failures before collapsing them into any summary score.

Evaluate at least:

- **Following:** position and timing accuracy, loss of position, and recovery when
  following resumes. Measure false claims of following and time spent confidently
  at the wrong position, including on negative controls. Include appropriate tests
  of pauses, restarts or tempo changes as those capabilities enter scope.
- **Assessment accuracy:** correct and missed discrepancies, false accusations against
  correct playing, and correct recognition of matching notes. Report error types
  separately, with counts and their denominators.
- **Coverage and uncertainty:** how much of the performance received a supported
  judgement and how much remained unassessed. Abstention is not a correct verdict.
  Report justified ambiguity separately from failure on answerable cases; test
  whether claimed confidence agrees with observed correctness.
- **Timeliness:** when a useful decision became available, distinct from the musical
  time it refers to. Count missed decision deadlines, not just latency on successful
  detections. Include revisions and how long an incorrect judgement was exposed.
- **Practical cost:** processing demand and whether the listener keeps up with the
  declared audio delivery conditions and device. "Keeps up" needs a denominator:
  name the target device and a decision-latency budget before measuring, provisional
  until Studio names its own, and mark every cost result provisional against them.
  Name a rough target now rather than leaving it blank, since the loop will optimise
  toward whatever it is given.
  Measure sustained backlog and tail latency as well as average processing demand;
  distinguish algorithm timing from microphone-to-feedback timing.

Pitch, onset and duration tolerances must be stated before judging a run. Assess
additional qualities such as dynamics only when their labels and success criteria
are defined. Report results by complexity profile and example, so aggregate success
does not conceal a failing case or error category. Avoid a single player grade at this
stage.

Verify causality, rather than relying on an algorithm's description. For example,
under identical run conditions, two inputs with the same audio prefix and different
futures must yield the same decisions up to that prefix. Later revisions do not
erase the original decisions from evaluation.

Compare candidates on the same examples and report uncertainty in their differences.
Use independent performances or sources as the unit of evidence where appropriate;
correlated audio frames are not independent demonstrations of reliability. State how
repeated candidate selection is handled before treating small gains as evidence.

## Research to guide experiments

Web-based research is a recurring part of the loop: before the first experiment,
when choosing among explanations for a failure, when expanding scope, and when
progress stalls. Use bounded searches with a concrete question. Relevant evidence
includes primary research papers, dataset documentation, reproducible evaluations
and official descriptions of existing systems. Research can inform hypotheses,
comparison methods, label quality, evaluation measures and stopping decisions as
well as algorithm selection.

Record the source URL, date or version, relevant claim, conditions tested, limitations
and the local experiment it motivates. Distinguish reported findings from the LLM's
inference. Check whether the evidence concerns audio or symbolic input, causal or
offline access, the relevant instrument and recording conditions, and comparable
latency and errors. A result in another setting is a hypothesis here, not a pass.
External methods may be experimental comparators without becoming product choices.

Search should include alternative explanations and negative results, not only support
for the current candidate. Reuse recorded findings when still applicable; refresh
them when the question or evidence changes. An unsuccessful search is a recorded
outcome, not a reason to invent a citation or postpone a well-founded local test.

## The iterative experiment

Before a batch of experiments, record a **research contract** sufficient for another
run to make the same selection decisions:

- The bounded capability, target source and complexity profile; permitted timing and
  navigation freedom; and which judgements are answerable.
- Dataset and evaluator versions, partition rules, tolerances, numerical acceptance
  thresholds, minimum coverage and uncertainty requirements.
- The target device, audio delivery conditions, decision deadlines and resource budget.
- The planned supply of real evidence: which library recordings, re-amplified sets
  and player sessions, and the partition each belongs to.
- The current best candidate or initial comparator, the priority among outcomes,
  minimum worthwhile improvement and permitted regressions by relevant category.
- Limits on candidate trials, compute, web research and reserved-check access; and
  what counts as a plateau, insufficient evidence or completion.

These are experimental choices, not unspecified decisions to revisit after seeing
results. Initial choices may be provisional, but must be explicit before comparison.
The LLM may draft a contract, but the first contract of each milestone, and any later
change that loosens a threshold, tolerance, freedom or budget, is approved by a human
before use; tightening within an approved contract is not. This is where human
judgement is spent: after approval the loop's honesty rests on the contract, not on
the LLM's restraint.
For example, a following experiment could prioritise reducing confidently wrong
position time subject to coverage and latency limits. An assessment experiment needs
its own trade-off between false accusations and missed discrepancies. Neither requires
a single player grade or a prescribed algorithm.

1. **Select the question.** Begin with the harness profile and, as soon as it stands,
   a real-timbre or recorded variant. Subsequently rank measured failures by the
   contract's priorities, frequency and uncertainty. Consult relevant web evidence
   and the experiment history before selecting a bounded hypothesis. State its
   predicted benefit, possible regressions and evidence that would contradict it.
2. **Establish the evidence.** Freeze matching examples, controlled discrepancies and
   negative controls under the declared partition rules. Confirm that the labels and
   evaluator can answer the question. Choose informative comparators; lack of a
   previous local algorithm is not a reason to omit comparison altogether.
3. **Develop within budget.** Propose or revise candidates on development examples.
   Diagnose concrete failures as acoustic ambiguity, incorrect alignment, incorrect
   judgement or uncertain labels. Diagnostic experiments may remove one uncertainty
   to test another: for example, supplying known alignment to isolate assessment
   quality. Such privileged-input results do not count as end-to-end success.
4. **Check the frozen candidate.** Select it using development evidence, then compare
   it with the current best under reserved conditions. Evaluate the whole capability,
   including real-source performance, negative controls, uncertainty, causality and
   cost. A component improvement alone does not establish a listener improvement.
5. **Retain or reject by rule.** Apply the declared improvement and regression limits,
   accounting for evidence uncertainty. Record the decision and retain reproducible
   versions of both candidates. An inconclusive result is not a pass; gather additional
   evidence only within the declared budget. Rejected ideas remain in the history.
6. **Choose the next action.** Continue against the highest-priority unresolved failure,
   or expand a dimension/source after the capability passes independent checks.
   Retain earlier profiles as regression evidence and add combinations to test
   interactions. At a plateau, revisit the explanation and external research within
   budget, then change the question or report the limit. Do not repeat indefinitely
   until a favourable result appears.

Each experiment leaves a concise record: hypothesis and research sources, parent and
candidate versions, data and evaluator versions, conditions, results by category,
uncertainty, resource use, decision and next action. Preserve unsuccessful approaches
and enough detail to reproduce comparisons. Improvement means a retained gain under
these rules, not merely another algorithm or a better development score.

## Autonomy, stopping and the destination

Within the research contract, an LLM can research, select experiments, develop and
compare candidates, diagnose failures and apply retention rules without routine human
approval. No architectural or algorithm family is prescribed by this approach. The
loop should be able to conclude that a hypothesis failed or that available evidence
does not justify another iteration.

Reference labels, evaluator rules and acceptance criteria are independent of candidate
development. The LLM must not obtain a pass by changing them. A suspected defect is
reported with independent evidence; a justified correction is a separately recorded,
versioned experimental change followed by a new comparison of affected candidates.
It cannot retroactively convert the old result into a pass.

Human effort is concentrated on establishing the intended use and acceptable
trade-offs, obtaining or resolving evidence that automation cannot independently
validate, and the eventual product decision. Ask for input when those matters block
progress; report the precise missing evidence or decision. A plateau under fixed
conditions can be reported without asking a human to select the next algorithm.
Low ongoing effort depends on a suitable supply of independently labelled real
performances. The library's synced recordings and re-amplified sets are the planned
supply for following; new player sessions remain necessary for assessment and for
free timing. Cleaning a label the loop has traced to a defect is one of the human
tasks, done on the evidence the loop presents rather than on the candidate's account.
More synthetic data cannot remove that dependency, and the loop cannot promise
indefinite improvement.

Passing a profile establishes a capability only under the conditions tested. Before
algorithm development starts, give the first useful milestone a concrete acceptance
contract and record what a separate Studio integration decision would require:

- A real instrument through a microphone at minimum, the intended player population
  and recording conditions, and the musical complexity supported.
- Starting-position knowledge, allowed tempo variation and navigation behaviour.
- Numerical limits for following error, false following, coverage, recovery and,
  where included, assessment errors and false accusations.
- Causal decision deadlines and sustained processing limits on a named device.
- Independent final acceptance evidence and how its uncertainty affects the decision.

Detailed assessment may remain outside the first following milestone. Any provisional
integration targets and later revisions must be explicit; passing an easier milestone
does not silently redefine the destination. Progress is evidence toward those targets,
with a recorded stop when they are met, a budget is exhausted or necessary evidence
is unavailable. This gives the loop a direction and an honest stopping point without
dictating how the listener should be implemented.
