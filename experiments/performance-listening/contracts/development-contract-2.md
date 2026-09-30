# Development contract 2 — a live cursor on events, and an end-of-piece assessment

**Status: in force from 2026-09-30,** adopted by the user's direction quoted below
("yes. please and also prepare for imminent implementation"). It supersedes
[development contract 1](development-contract-1.md) for development; contract 1 and its
experiments are archived in [archive/ladder-1/](../archive/ladder-1/README.md).
Drafted by Claude Opus 5.5 (1M context) in Claude Code. As before, tightening needs no
approval; loosening a range, a gate or the exit rule needs the user. **The numerical
gates below are placeholders** until the oracle cases exist and the user approves
numbers chosen from them.

## The user's direction

After experiment 021, the user questioned the measurement itself (2026-09-30):

> I want to step back and examine our measurement approach. Lets postulate a person
> playing this piece, they are a beginner and this is out of their comfort zone. The
> piece calls for, say 90bm. They play at an average of 45bpm. There is also wild
> variance in the beat interval e.g. a chord change in the 2nd bar cause a full 1second
> of delay. They do get through it (eventually) and played all of the notes in the right
> order. I would argue that this passes a "did they follow the notation" bar from a
> melodic/chordal perspective but not a rhythmic perspective. I'd collapse that into a
> statement of "the music was followed, but there were extreme tempo variations".
> Separately the real music is played really well (by a professional) but the sync data
> may be incorrect e.g. 100-400ms out for each bar. I would expect this to come through
> as "the music was played well with minor tempo issues". […] From my perspective we
> have a problem of measurement/tests and thus we may be optimising for and converging
> on the wrong thing

Then:

> I'd perhaps argue that some of this might be ok to be assessed in batches (not
> realtime) e.g. I would say that if we reach the end of the piece and find that the bpm
> is 45bpm when music calls for 90bpm then our rhythm assessment should be based on 45
> bpm. Putting it another way a person who played perfectly but slowly would be
> complemented on their "timing" (because it rhythm is consistent with overall bpm)
> rather than be punished because tempo is too slow.

Asked four questions, they answered:

> 1. The tempo matters somewhat - the user should try to follow the tempo (they can
> control the tempo) but it is orthogonal concern. Variation in tempo matters far more.
> e.g. the user slows down in bar 4 suggests physical/mental overload because they find
> that bit harder (and need to practice more)
> 2. Hesitation and tempo changes don't have to be separate, hesitation is just the most
> extreme form of tempo change (a singularity with bpm of zero!!)
> 3. I think we should postpone lag for now and just do per bar or phrase
> 4. I think the cursor needs to be at the event (i.e. chord or note). However some
> thought needs to be given to "dead or missing notes" e.g. listener doesn't hear event
> 2, shouldn't mean the cursor can't "recover" when event 3 is heard.

They then corrected answer 3:

> sorry I meant to say "postpone the lag assessment for now, just do end of piece
> assessment"

So there is no lagged tier for now. The assessment is made once, at the end of the
piece, and its report locates what it finds by bar and by event, as answer 1's "slows
down in bar 4" needs.

The same day they directed a reset of the experimental record:

> I was thinking that we should reset the EXPERIMENT_LOG by moving all the items in it
> to EXPERIMENT_LOG_ARCHIVE and also move the experiments themselves into a new folder.
> I want a fresh experimental context that follows these new objectives and am prepared
> to lose some progress because of it.
> I'm wondering whether to go further and start the algorithm (delete the current code)
> or just use it as the baseline and modify from there.

A review of the draft by another model was then given to the author. The user asked
for only its high-value points to be taken; those are folded into the sections below.

Asked about the draft's open items, they wrote:

> For ranges I'd probably go with beginner, intermediate, advanced categories - but
> these also need numeric values
> Where has this "what counts as a phrase" come from - why was this introduced?
> Wrong notes and prartial chords should come in now

"Phrase" had come from answer 3's "per bar or phrase"; after the correction to answer 3
it is dropped, and findings are located by bar and event. On the author's suggested
categories, wrong-note handling and extra notes, they wrote:

> yes. please and also prepare for imminent implementation, remember it is ok to move
> old work well aside and refocus. One area of learning is to start simple, aiming for
> good results on the happy path e.g. few bars, single synth/sample. The experiment
> should be clear of the direction of travel (generalising to many synth/samples + real
> music, more bars, more scores) but should try to clear up the basics first e.g. start
> with simple scores, and perfect synthesized performance before adding "jitter" such as
> hesitation, frequency variation and when adding jitter do it one at a time. Its ok to
> occasionally test "real music" but I'm expecting the real progress to be made by
> synthesizing beginner performance initially

That message adopts this contract. The numerical gates are still proposals: they are
chosen only after the oracle cases are frozen, and the user approves them then.

After experiment 022 proposed gates and raised two definitional questions, the author
recommended approving the gates for the sine stages with two changes, judging variation
against the player's typical tempo, and a distinct dead-note verdict. The user wrote:

> Can you make the necessary updates to the docs and experiment to make the process
> improvements. How do you propose to do the small experiment? Perhaps we should simply
> delete the next experiment and replace it with your small experiment

That accepts the recommendations recorded below under the gates, tempo variation and
notes, and makes experiment 023 the small experiment that implements them.

## Why

Contract 1 measures one thing: whether the live cursor is within ±¼ quarter of the
true position. That measure grades the listener, never the player. It was only ever
tested at 80–120% of the handed tempo with smooth changes, and experiments 017–021
improved it by adding steady-tempo assumptions. That serves a professional at tempo
and fails the Studio beginner the user describes. The real-clip thermometer also
cannot separate listener error from sync error at ±¼ quarter
([report 021](../archive/ladder-1/reports/021-stability-calibration.md#resulting-plateau-budgets-and-evidence-access)).

## Two outputs, judged separately

**Live: the cursor.** Causal and prompt. Its only job is to show the player where they
are, at event resolution.

- An **event** is the set of score notes sharing one onset: a chord, or a single note.
- The **true cursor** at time t is the latest event the player has sounded by t. During
  a hesitation it stays on the last sounded event; it never interpolates ahead at the
  handed tempo.
- **Missing events.** If event 2 is not played, the true cursor goes from event 1 to
  event 3 when event 3 sounds. The listener must recover there; a missed event never
  stops it.
- **Dead notes.** A muted or percussive note sounds an onset without its pitch. While it
  is the latest event, the cursor may show it or its predecessor; both count as correct.
- **Wrong notes and partial chords** still sound the event: the cursor should move to
  it.
- **Extra notes**, such as a stray open string between events, must not move the
  cursor. They are tested here, and not yet assessed.
- **Answerable only when the audio can tell.** A label records what happened and
  which events the audio so far supports. Where the audio cannot yet distinguish them,
  as with repeated identical chords, consecutive dead notes, or an omission before a
  similar event, any supported event counts as correct. The decision deadline starts
  when a distinguishing event sounds. Honest uncertainty is not punished, and a lucky
  guess is not rewarded.
- The handed tempo is the tempo the player chose in Studio: a hint, not a truth.

**End of piece: the assessment.** Made once, when the piece ends, with full hindsight.
The listener may re-align the whole recording offline. Findings are located by bar and
by event.

- **Local tempo** at each sounded event is `60 × score distance to the next sounded
  event, in quarters ÷ elapsed seconds between their onsets`. It is measured between
  matched onsets, never from a note's written duration, so an omitted event, a rest or
  an overlapping note is not mistaken for slowing.
- **Overall tempo** is the same ratio from the first sounded event to the last. Every
  pause is included, and the final ringing is excluded. It is reported beside the handed
  tempo and never counts against timing.
- **Tempo variation** is the main timing judgement: local tempo relative to the player's
  **typical tempo**, the median of their local tempi weighted by score distance. A
  hesitation is not a separate category; it is the local tempo falling towards zero.
  The report flags bars well below or above the player's typical tempo, such as "slowed
  in bar 4", as practice cues. The overall tempo is not the reference: one long
  hesitation drags it down until steady bars read fast (experiment 022, oracle case
  A3), whereas a median barely moves.
- **Notes.** Every score note in every event is marked **matched**, **missing**,
  **wrong pitch** (with the pitch heard instead) or **dead**. A dead note where the score
  itself writes one (`technique.dead`, as Guitar Pro scores carry) is **matched**; only
  an unintended dead note is a finding. Studio's vocabulary gains a distinct `dead`
  verdict (version 2.1, additive), rather than reading a pitchless substitution as dead:
  a note heard but not identified is not the same finding as a muted one. A partial chord is an
  event with one or more missing notes. The summary says which notes and chords were
  played in order, and what differed. Extra notes are not assessed yet, so the report
  does not claim the performance contained nothing else. The shape already exists as
  the `note` statement of the [version-2 vocabulary](vocabulary-v2.md), with the `dead`
  verdict above added.
- **Same audio, same assessment.** The expected assessment depends only on what sounded
  and when, never on how the generator recipe named the deviation.

A player who plays every note in order, slowly and steadily, gets a low overall tempo,
no variation flags and every note matched.

## The progression: start simple, one change at a time

Progress is made first on synthesized performances, starting from the happy path and
adding one difficulty at a time. Each stage must work, cursor and assessment both,
before the next begins. Earlier stages stay as regression evidence.

| Stage | Score | Sound | Performance |
|---|---|---|---|
| 1 | The simple committed scores: [one bar, C4–F4](../sources/s1-one-bar-c4-f4.mnx.json), then [a two-bar scale](../sources/s2-two-bar-scale.mnx.json) | One synth (sine) | Perfect, at the handed tempo, then steady at other tempi |
| 2 | The same | The same | One deviation at a time, in the order below |
| 3 | Winner bars 1–4, the first score with chords | The same | Perfect, then one deviation at a time, now including partial chords |
| 4 | The same | One recorded guitar sample set | Perfect, then one deviation at a time |
| 5 | The same | The same | The category bundles: advanced, then intermediate, then beginner |

**Every stage carries two negative controls**, like contract 1's ladder: digital
silence of the same length, and the stage's audio handed a **wrong score**, an unrelated
simple score that shares no opening with the performed one. The cursor must not claim a
position in either, and the assessment must not report a control's notes as played.
A perfect-performance stage without controls cannot tell a listener that hears from one
that always follows (lesson L8).

Deviations, added one at a time in this order: steady tempo away from the handed one;
a hesitation; a slowed bar; a rushed bar; a missing event; a wrong note; a dead note;
an extra note; onset jitter and strum spread; a frequency offset. Partial chords join at
stage 3.

**Direction of travel.** After stage 5: more sample sets and synths, more bars (Winner
bars 5–8, still unexamined), more scores (Dust, then others), and real recordings.
Real music is tested occasionally along the way as a thermometer. It never selects a
listener, and its sync anchors are uncertain. It is judged at bar level with an
uncertainty band around each anchor, and *indeterminate* where the band prevents a
judgement. The assessment never reads sync.

### The categories

Each category is a bundle of settings for synthetic performances, not a grade for a
player. Counts are per four bars and scale with length. The single-deviation stages
draw each deviation's range from the whole table. **Clean examples are mandatory in
every stage**: steady, with every note right, at several tempi including half speed.
They must produce no flags.

| | Advanced | Intermediate | Beginner |
|---|---|---|---|
| Overall tempo, of the handed tempo | 90–110% | 70–100% | 40–80% |
| Event-to-event tempo wobble, of the player's own tempo | ±5% | ±15% | ±30% |
| Slowed bars | none | one at 80–90% | 1–2 at 50–70% |
| Rushed bars | none | one at 105–115% | one at 110–130% |
| Hesitations | none | up to 1, 0.3–0.7 s | 1–3, 0.5–2 s, mostly at chord changes |
| Missing events | none | up to 1 | 1–3 |
| Dead notes | up to 1 | 1–2 | 2–4 |
| Wrong notes, usually a neighbouring fret or string | none | up to 1 | 1–3 |
| Partial chords | up to 1 | 1–3 | 2–5 |
| Extra notes, for the cursor only | none | up to 1 | 1–3 |
| Strum spread within a chord | ≤20 ms | ≤40 ms | ≤60 ms |

The intermediate and beginner figures are the author's estimates; the user may revise
them from experience.

## Instruments

No listener is judged by an instrument until it has its own hand-worked oracle cases,
and **a different session has audited them** (below). Numerical gates are chosen only
after the oracle cases are frozen, and the user approves them.

- **following-evaluator** judges the live cursor, with the as-decided and hindsight
  views. It measures:
  - by time: on a supported event, with **ahead** (on an event not yet sounded)
    reported separately, plus wrong or false-following exposure and the longest
    episode, including false following on the controls;
  - **by event**: the fraction of distinguishable events the cursor reaches within the
    deadline, so a long hesitation waited out correctly cannot hide short events that
    were missed;
  - recovery after a missing event; no movement on an extra note; deadline, causality
    and cost, as contract 1 defined them.
- **assessment-evaluator** judges the end-of-piece report:
  - overall tempo, and each interval's **duration** between sounded events;
  - **detections and false alarms for every kind of finding**: tempo-variation flags,
    missing, wrong-pitch and dead notes. An assessor that flags everything must fail.
- **An oracle case for bad sync.** The audio is unchanged while the anchors move by
  100–400 ms. The musical assessment must not change; only the reference's
  uncertainty grows, and more of the real-clip cursor result becomes indeterminate.

Experiment 022 built version 1 of both, [event instruments 1](event-instruments-1.md),
with [event-oracle@1](../bench/oracle-events/README.md). Experiment 023 versions them for
the decisions above.

### The gates, approved for stages 1–3

The gates [proposed in experiment 022](../reports/022-event-instruments.md#proposed-gates-awaiting-the-users-approval)
are approved **for the sine stages, 1–3 only**, with two changes. Before stage 4,
recorded guitar, a new proposal is made from evidence and approved again, rather than
loosened under pressure once a stage proves them unreachable.

| Measure | Gate |
|---|---|
| Live cursor, per example | On event ≥ 95% of supported answerable time; ahead ≤ 1%; exposure ≤ 5% with no episode over 0.5 s; every event reached within 0.2 s where an example has fewer than 20, otherwise ≥ 95% |
| Controls, per example | Contract 1's approved control gates, unchanged: correct rejection ≥ 95% of answerable time, false-following exposure ≤ 5%, no episode over 0.5 s. How the assessment of a control is judged is proposed by experiment 023 for approval |
| Live cursor, pooled over a stage | Recovery after a missing event ≥ 90%; extra notes held ≥ 90% |
| Causality and cost | Every prefix check; sustained cost ratio ≤ 0.25; chunk p99 ≤ 10 ms |
| Assessment, per example | Overall tempo within ±5%; every expected interval reported, each **duration within ±10% or ±30 ms, whichever is larger** (changed from ±10% of tempo, which is ill-conditioned near a hesitation and tighter than onset precision on short notes); every score note assessed; **no false finding at all on a clean example** (changed from a pooled rate, which could hide one) |
| Assessment, pooled over a stage | For each kind of finding: at least 90% found and false alarms at most 5% of negatives |
| Bar-flag threshold θ | 0.10, as defined in the instruments, now against the typical tempo |

### Auditing an oracle

A new or re-versioned oracle is audited before any listener is judged by it. A session
that did not write it, ideally a different model, re-derives a sample of its expected
numbers by hand from the contract and the instrument definitions alone, without
reading the evaluator code: at least one case per rule, and every case the version
added or changed. It records each case checked, its own arithmetic, and agree or
disagree, in `bench/oracle-events/audit-N.md`. The audit runs no listener and is not a
numbered experiment. A disagreement is resolved by the next numbered experiment,
which either versions the oracle with the corrected arithmetic or shows why the audit
misread the rule. The audit exists because one author writing both the oracle and the
evaluator makes a shared misreading invisible: they agree by construction.

## The fresh experimental context

At the user's direction, this contract starts a new series.

- **The record is archived.** Contract 1's research log, ledger, reports, run summaries
  and first-step plan are in [archive/ladder-1/](../archive/ladder-1/README.md), with
  their links intact. Private audio and runs in `mnx-listening-data/` are unchanged.
  Experiment numbers continue from 022, so every report and run ID stays unique.
- **The lessons carry over, not the progress.** The fresh [research log](../RESEARCH_LOG.md)
  starts with the inherited lessons, each linked to its archived evidence.
- **The code splits three ways.** The [bench README](../bench/README.md#the-code-under-contract-2)
  maps it:

| Part | Decision | Why |
|---|---|---|
| Harness: renderers, guitar samples, tempo maps, the causal runner and its prefix check, cost measurement, set freezing, the report exporter | **Keep** | The new stages need exactly these, and they encode none of the old objectives |
| Studio interface (`listen/`: the vocabulary, the display rule, delivery checks) | **Keep** | Still the Studio contract; an event cursor still emits a score position |
| Evaluator v1, the ladder scoreboard, the active suite, the old diagnostics | **Frozen, to be replaced** | They are the old objective. New modules replace them; they are not edited |
| Listeners: the clock, `online-time-warp@8`, `@12` and `@14` | **Frozen baselines**, runnable, never developed | Cheap, and they test the new instruments: the evaluators are wrong if they do not show the forward-only, tempo-clamped path failing on hesitations and slow play. Comparing v8 with v12 and v14 shows whether the new measures stop rewarding the smoothing experiments 017–021 added |
| New listener | **Start fresh** | The old family's skeleton contradicts the new objectives: it must always advance, it aligns frames to a rendering at the handed tempo rather than tracking events, and its steady-tempo history smooths through the stalls the assessment must report |

Event-based score followers with explicit "stay" and "skip" transitions, such as
hidden-Markov models, are the published family that matches hesitations and missing
events. The first listener experiment researches that literature rather than assuming
it. The assessment can start from a whole-recording offline alignment.

## Effect on existing records

- Contract 1's experiments, runs and ladder sets stay intact and remain regression
  evidence under following-evaluator@1.
- The listener that must be causal and prompt is the live cursor. Offline alignment is
  permitted for the end-of-piece assessment. [APPROACH.md](../APPROACH.md) says so.
- [Research contract 1](research-contract-1.md), the qualification contract, is
  unchanged. Any future qualification under the new measures needs its own approval.

## Order of work

1. **Experiment 022: the instruments.** Done: version 1 of both evaluators, their
   oracle, stage 1 and the baselines; gates proposed.
2. **Experiment 023: the decisions, implemented.** Version the instruments and the
   oracle for the typical-tempo reference, interval durations with their floor, zero
   findings on clean examples, the `dead` verdict with intended dead notes matched, and
   the controls' scoring. Add the `dead` verdict to the vocabulary and `listen/`. Add
   the silence and wrong-score controls to stage 1 as a new frozen set, committing the
   unrelated wrong score to `sources/`. Remeasure the frozen baselines on it. No
   listener is developed.
3. **The oracle audit** of 023's oracle, by a different session.
4. **Experiment 024: the first new listener, on stage 1.** Research event-based
   following first, then build the simplest live cursor and end-of-piece assessor that
   pass stage 1 under the approved gates.
5. **Then the stages in order,** one deviation at a time. A stage is done when the
   cursor and the assessment meet the approved gates on every example of it, its
   controls and every earlier stage.

## Still open for the user

- New gates before stage 4, recorded guitar, from the evidence of stages 1–3.
- The category figures, if experience says the estimates are wrong.
