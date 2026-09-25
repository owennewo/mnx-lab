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
therefore causal and prompt; offline accuracy locates the acoustic ceiling and is a
diagnostic, not the goal. This document defines objectives, not an implementation or
permission to integrate an experimental listener into the product.

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
uncertain, so prefer routes that keep labels exact while the audio becomes real:
**re-amplified** generator output, played through a speaker and recorded through a
microphone, keeps the generator's labels while the room, microphone, noise and level
vary; a **click-guided** human performance keeps the intended timing known and makes
the deviations small enough to measure. Free human performances remain necessary
evidence, but they come after these, not instead of them.

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

This defines the first profile, not a universal ladder of difficulty. Later levels
must describe their actual contents and ranges. Initially vary one dimension at a
time to understand failures; later combine dimensions to expose interactions.
For example, complex timbre need not imply complex rhythm. Sample-based generators
may eventually use instrument collections such as nbrosowsky/tonejs-instruments.

Level 1 in every dimension is a check of the harness, not of listening: a single
spectral peak passes it. Its value is that the golden format, the evaluator and the
reports exist and agree before any real challenge arrives. Passing further synthetic
levels says little about the destination on its own.

Recording conditions are additional declared factors: microphone, room, background
noise and recording level. Success on generated audio does not establish success on
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

The golden format, the counting rules and the evaluator are the **first deliverable**,
fixed before any listener is written and versioned like the sets themselves. Otherwise
the first algorithm's convenient output becomes the contract by default, and every
later algorithm is measured on the first one's terms.

## What an algorithm does

The listener receives the audio and intended score. It estimates where the performance
is in the score and assesses correspondence: supported matches, missing or extra notes,
wrong pitches and timing errors. It may report insufficient evidence. It cannot read
actual-performance labels, the recipe for an injected error, or the expected verdict.

Following and judging are related but distinct objectives. A deliberate local timing
error must remain detectable, while an allowed change in performance tempo should be
followed. Each experiment declares the permitted timing freedom and what counts as an
error, so flexible alignment cannot silently explain away every mistake.

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
  following resumes. Include appropriate tests of pauses, restarts or tempo changes
  as those capabilities enter scope.
- **Assessment accuracy:** correct and missed discrepancies, false accusations against
  correct playing, and correct recognition of matching notes. Report error types
  separately, with counts and their denominators.
- **Coverage and uncertainty:** how much of the performance received a supported
  judgement and how much remained unassessed. Abstention is not a correct verdict.
- **Timeliness:** when a useful decision became available, distinct from the musical
  time it refers to. Include revisions where a listener changes an earlier judgement.
- **Practical cost:** processing demand and whether the listener keeps up with the
  declared audio delivery conditions and device. "Keeps up" needs a denominator:
  name the target device and a decision-latency budget before measuring, provisional
  until Studio names its own, and mark every cost result provisional against them.

Pitch, onset and duration tolerances must be stated before judging a run. Assess
additional qualities such as dynamics only when their labels and success criteria
are defined. Report results by complexity profile and example, so aggregate success
does not conceal a failing case or error category. Avoid a single player grade at this
stage.

## The iterative experiment

1. Choose a bounded capability and complexity profile, beginning with level 1 and,
   as soon as the harness stands, a real-timbre or recorded variant of it. State
   a hypothesis, success criteria and the evidence that would contradict it.
2. Establish fixed golden examples: matching performances, controlled errors and
   relevant negative controls. Keep development examples separate from fresh checks.
3. Propose or revise an algorithm, then evaluate it against those examples using the
   declared conditions and independent reference labels.
4. Inspect concrete failures. Distinguish acoustic ambiguity, incorrect alignment,
   incorrect judgement and uncertain labels. Form the next testable hypothesis.
5. Repeat until the stated criteria pass, then check fresh examples of the same
   profile. Once examples inform revisions, they become development evidence.
6. Increase one dimension or change source, then repeat. Retain earlier levels as
   regression checks; introduce combinations once the individual challenges are
   understood.

An LLM can propose algorithms, run experiments, inspect evidence and iterate. It must
not obtain a pass by changing the golden labels or quietly relaxing the criteria.
A justified correction to a reference or criterion is a recorded experimental change
requiring a new comparison. Keep a concise account of each hypothesis, what changed,
results and the next decision, including unsuccessful approaches.

Passing a level establishes a capability only under the conditions tested. Progress
means a growing, understandable body of evidence across sources and complexity
profiles, eventually including real performances, sufficient to justify a separate
Studio integration decision.

State now what that decision would need to see, and revise it only as a recorded
change: which source (a real instrument through a microphone, at minimum), which
complexity profile, which assessment error rates and coverage, following which
timing freedom, causally, within the declared budget on the declared device. This
is not the single player grade avoided above; it is the experiment's exit criterion.
Without one, a growing body of evidence has no direction to grow in, and the
previous experiment's fusion log shows what an open-ended iteration looks like.
