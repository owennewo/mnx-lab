# Development contract 2 — a live cursor on events, and an end-of-piece assessment

**Status: in force from 2026-09-30,** adopted by the user's direction quoted below
("yes. please and also prepare for imminent implementation"). It supersedes
[development contract 1](development-contract-1.md) for development; contract 1 and its
experiments are archived in [archive/ladder-1/](../archive/ladder-1/README.md).
Drafted by Claude Opus 5.5 (1M context) in Claude Code. As before, tightening needs no
approval; loosening a range, a gate or the exit rule needs the user. **The numerical
gates below are placeholders** until the oracle cases exist and the user approves
numbers chosen from them.

**Amended 2026-10-04** by the user's direction: the sines are dropped, the progression
is rebased onto sampled guitar, and the promotion rule is rewritten. See
[the amendment](#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule).
**Amended 2026-10-05** on host stalls, guitar sweeps, sentinels and the outside review:
see [the second amendment](#amendment-2026-10-05-host-stalls-guitar-sweeps-sentinels-and-the-outside-review).

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

After experiment 023 and the audit of its oracle, the author recommended approving the
control-assessment gate, moving the near-miss wrong score `w1` to stage 2 and giving
stage 1 a distant one, and settling the audit's one ambiguity by a clarification that
changes no number. The user wrote:

> yes can you make those changes, including recommendations and 024 tweak

After experiment 026 and review R5, the author recommended a stopping rule, bar flags
that need enough other bars, cheaper comparators and grouped substages. The user wrote:

> can you make improvements to the above decisions and also suggest a way to reduce the
> continued test bloat. The way I see it is "as the tide rises" (we get compforatble
> with harder things) we test only the harder things dropping things that are gimmes
> (using golfing metephor) e.g. once we've got a guitar sample reliable we no longer
> need sine wave (unless we do a full/thorough sweep occasionally)

That adopts the four decisions below as improved, and the rising-tide rule in
[Keeping the suite lean](#keeping-the-suite-lean-the-rising-tide).

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
- **A bar is judged against the other bars**, and only when there are enough of them.
  Each bar's reference is the typical tempo of the *other* bars, so a slowed bar cannot
  set its own reference. A bar is flagged only when at least three other bars supply
  intervals; otherwise the report gives its local tempo and ratio without a verdict.
  With two bars no rule can know which bar was the normal one: experiment 026 showed
  the whole-piece median flag the unchanged bar of a two-bar scale "fast" when the
  other was slowed. Implemented as a new instruments and oracle version, with its
  audit, before any listener is judged by it (see the order of work).
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
before the next begins. Earlier stages stay as regression evidence, under the
[rising-tide rule](#keeping-the-suite-lean-the-rising-tide): their hardest examples keep
running, and all of them run in a full sweep at milestones.

| Stage | Score | Sound | Performance |
|---|---|---|---|
| 1 | The simple committed scores: [one bar, C4–F4](../sources/s1-one-bar-c4-f4.mnx.json), then [a two-bar scale](../sources/s2-two-bar-scale.mnx.json) | One synth (sine) | Perfect, at the handed tempo, then steady at other tempi |
| 2 | The same | The same | One deviation at a time, in the order below |
| 3 | Winner bars 1–4, the first score with chords | The same | Perfect, then one deviation at a time, now including partial chords |
| 4 | The same | One recorded guitar sample set | Perfect, then one deviation at a time |
| 5 | The same | The same | The category bundles: advanced, then intermediate, then beginner |

**Every stage carries two negative controls**, like contract 1's ladder: digital
silence of the same length, and the stage's audio handed a **wrong score**. The cursor
must not claim a position in either, and the assessment must not report a control's
notes as played. A perfect-performance stage without controls cannot tell a listener
that hears from one that always follows (lesson L8).

- **Stage 1's wrong score is distant**: a different register and a different rhythm
  from the performed scores, and no three consecutive notes whose intervals match
  three consecutive notes of a performed score, at any transposition. Leaps rather than
  steps make that easy.
  Stage 1 is the happy path, so its control must be plainly unrelated.
- **The near-miss wrong score `w1`** ([`sources/w1-two-bar-black-keys.mnx.json`](../sources/w1-two-bar-black-keys.mnx.json))
  moves to **stage 2**, beside the wrong-note deviations. Its first bar is the two-bar
  scale's second bar a semitone away, in the same rhythm, so it asks the harder
  question: accept one neighbouring wrong note, but reject a bar of them. Experiment 023
  found the frozen time warpers follow it. Its examples in `contract2-stage1-v2` are
  judged as stage 2 evidence, not stage 1.

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

Since 2026-10-04 the sound of stages 1–3 is sampled guitar and stage 4 is microphone
recordings: see [the amendment](#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule).

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

## Keeping the suite lean: the rising tide

As the loop gets comfortable with harder things, routine runs test the harder things
and drop the gimmes. Everything still runs in a full sweep from time to time. A run that
repeats what is already known costs time the user would rather spend learning.

- **The active suite** of a routine experiment is every example of the substages it
  attempts, plus the **sentinels** of every substage already passed, plus their
  controls. Nothing else runs routinely.
- **Sentinels** are chosen when a substage passes, by rule rather than by hand: the
  three examples with the least margin on any gate in its passing evaluation, plus one
  silence and one wrong-score control per score. They are frozen with the substage and
  re-chosen only at a full sweep. A sentinel that fails reopens its substage.
- **A gimme retires to sweep-only** when two things hold: the incumbent listener has
  passed it in its last three evaluations, and harder active evidence exercises the
  same capability. A deviation on recorded guitar makes the same deviation on sines a
  gimme; a category bundle makes its single deviations gimmes; a longer score makes a
  shorter one a gimme. Its sentinels keep running until the harder evidence is itself
  retired or replaced. Retirement is recorded, with the evidence, in the suite record.
- **The frozen baselines are sweep-only now.** The clock and `online-time-warp@8`, `@12`
  and `@14` fail every new example and take nearly all of a routine run's time (about
  0.13 of real time each, against the event chain's 0.002). Their existing records stay
  cited by hash.
- **A full sweep** runs everything, retired sets and baselines included: when a stage
  is claimed passed, before new gates are proposed, at the end of a batch, and at least
  every fifth experiment. A stage is **passed** when its own examples and every
  sentinel pass; it is **confirmed** at the next full sweep, and a failure in the sweep
  reopens it.
- **Reuse still applies.** Evidence whose producers are unchanged by hash is cited, not
  rerun, in routine runs and sweeps alike.
- **A time budget.** A routine experiment's evaluation should take about two minutes.
  If one takes more than five, the next review proposes retirements.
- **The suite record** is a committed file listing each substage's status (open,
  passed, confirmed), its sentinels, and each retired set with the date and evidence,
  so the reviewer can check that nothing was retired to hide a failure.

This loosens contract 2's first rule that every example of every earlier stage runs
each time, at the user's direction. The evidence standard is kept by the sentinels, the
retirement conditions and the sweeps.

## Stopping

Count **listener versions that fail to clear the lowest open substage**, in a row. After
three, the next experiment is a bounded research refresh on that failure: primary
sources, recorded as research notes, before any further version. After three more
without clearing it, stop, and report the limit to the user with the evidence. A
version that clears the substage resets the count to zero. Diagnostics and instrument
work add no versions. This replaces contract 1's plateau rule, which contract 2 had
not restated; experiment 026's "plateau 1" counts under it as one failed attempt, not
yet a version.

## Grouping substages

Several single-deviation substages may share one experiment when the unchanged
listener is predicted to pass them all: each example still carries exactly one
deviation, and each substage gets its own verdict. Any change to the listener gets an
experiment of its own. A failed substage is repaired before later substages are
grouped past it: the lowest open substage comes first.

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
| Controls, per example | Contract 1's approved control gates, unchanged: correct rejection ≥ 95% of answerable time, false-following exposure ≤ 5%, no episode over 0.5 s. The assessment of a control claims no score note played and reports no tempo, overall, interval or flag; controls are excluded from the pooled finding rates. Proposed by experiment 023, approved by the user on 2026-09-30 |
| Live cursor, pooled over a stage | Recovery after a missing event ≥ 90%; extra notes held ≥ 90% |
| Causality and cost | Every prefix check; sustained cost ratio ≤ 0.25; chunk p99 ≤ 10 ms |
| Assessment, per example | Overall tempo within ±5%; every expected interval reported, each **duration within ±10% or ±30 ms, whichever is larger** (changed from ±10% of tempo, which is ill-conditioned near a hesitation and tighter than onset precision on short notes); every score note assessed; **no false finding at all on a clean example** (changed from a pooled rate, which could hide one) |
| Assessment, pooled over a stage | For each kind of finding: at least 90% found and false alarms at most 5% of negatives |
| Bar-flag threshold θ | 0.10, as defined in the instruments, against the other bars' typical tempo, and only with at least three other bars |

On the guitar stages these gates apply with two changes, a quiet-noise silence control
and a compute-inclusive deadline in place of the chunk p99: see
[the amendment](#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule).

### Auditing an oracle

A new or re-versioned oracle is audited before any listener is judged by it. A session
that did not write it, ideally a different model, re-derives a sample of its expected
numbers by hand from the contract and the instrument definitions alone, without
reading the evaluator code: at least one case per rule, and every case the version
added or changed. It records each case checked, its own arithmetic, and agree or
disagree, in `bench/oracle-events/audit-N.md`.
[AUDITING_AN_ORACLE.md](../AUDITING_AN_ORACLE.md) is the prompt for that session. The audit runs no listener and is not a
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

1. **Experiments 022–023 and audit 2: the instruments.** Done.
2. **Experiment 024: stage 1.** Passed by `event-chain@1`.
3. **Experiments 025–026: stage 2 begins.** The hesitation (silence) passed; the slowed
   bar failed on two examples, a transient pitch skip in the live cursor.
4. **Experiment 027: repair the live cursor.** A new listener version that passes both
   failed slowed-bar examples without losing anything else. The frozen baselines no
   longer run; their records are cited. Stage 1, the hesitation and the slowed bar run
   in full, since no sentinels have been chosen yet and the event chain is cheap.
5. **Experiment 028: event instruments 3 and the suite record.** Bar flags against the
   other bars, only with three other bars; a four-bar sine score committed to
   `sources/`, so stage 2's tempo substages can still test flags; `stage-gates@2` with
   the rising tide's passed and confirmed states; the suite record, with sentinels chosen
   for the substages already passed; a new oracle version, frozen before implementing.
   No listener is developed.
6. **The oracle audit** of 028's oracle, by a different session.
7. **Then stage 2's remaining deviations**, grouped where the unchanged listener is
   predicted to pass: a held-note hesitation (the previous note ringing through the
   pause), a rushed bar, a missing event, a wrong note with `w1`, a dead note, an extra
   note, onset jitter and a frequency offset. Then stages 3–5, each passed stage
   retiring its gimmes under the rising tide.

## The challenger track: Basic Pitch observations

Added 2026-10-02 by the user's direction. [TRACK_PROPOSALS.md](../TRACK_PROPOSALS.md#proposal-1-a-challenger-track-under-the-same-contract)'s
proposal 1 is adopted for one challenger, [avenue A2](../TRACK_PROPOSALS.md#a2-basic-pitch-observations-through-the-event-chain):
a listener whose pitch front end is Spotify's Basic Pitch (the pinned ICASSP 2022 ONNX
model shipped in `basic-pitch` 0.4.0) and whose live chain, offline alignment and
assessment are the incumbent's, unchanged. Nothing above changes: the two outputs, the
instruments, the gates, the controls and the stages judge the challenger exactly as they
judge the incumbent.

The user's direction, after a comparison of this loop with the score-blind transcription
work in `~/dev/guitar-nn`:

> Lets suppose that Basic Pitch is promising. Perhaps we should consider a new contract
> that is more "midi" based wdyt?

> ok - can you plan the basic pitch challenger

> I'm happy for you to decide on those decisions (I allow all the options)

The decisions the user delegated, taken by the parent session (Claude Fable 5.1 in
Claude Code) and binding on the challenger:

1. **The track is open** under proposal 1's terms: shared instruments, frozen sets,
   controls, ledger, numbering and landing sequence; its own stopping count, not started
   until the exploration budget is spent; evaluation by full sweep of every set it claims,
   since the sentinels are the incumbent's; its own stage order, stated in its first
   pre-registration; report slugs and run IDs carry `challenger-` after the number
   (`reports/035-challenger-<slug>.md`, `g035-challenger-<slug>`).
2. **Exploration budget, once.** The first challenger experiment pre-registers what it
   builds, the sets it runs and this budget in place of numbered predictions: one
   experimenter session, with the one technical rerun the contract already allows. A
   second challenger experiment follows only if the assessment output passes its approved
   gates, controls included, on the guitar stage-1 performances of at least three of the
   four development guitar sample sets, or if a failure is attributed to one component
   with a stated repair. Otherwise the track records what it saw and stops. Numbered
   predictions begin with the second experiment.
3. **Stage order.** The challenger takes the stage-4 sound first: the stage-1 and stage-2
   scores rendered with `sample-render@1` from the **development** guitar sample sets
   only, beside the frozen sine sets. The held-out guitars stay unused until a promotion
   claim (lesson L11). Pure sines are out of distribution for a model trained on real
   instruments, so a sine failure is reported as that and is not the challenger's
   verdict; the guitar renders are.
4. **Promotion, fixed now.** The challenger becomes the incumbent when it passes every
   substage the incumbent has passed, or passes one the incumbent cannot attempt, in
   each case under the shared gates with controls. The loser freezes as a comparator and
   is never developed further. *Replaced on 2026-10-04 by
   [the amendment's decision 5](#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule).*
5. **The observation seam.** The challenger introduces a versioned contract file,
   `contracts/observation-seam-N.md`, the second kind of contract file an experiment may
   add. It defines what passes from the front end to the chain: per-frame activations
   (Basic Pitch's onset, note and contour maps) and decoded events, every frame and event
   carrying two times, the audio time it describes and the time it became available,
   with confidence, a representation for a pitchless onset, and hashes and model
   provenance. The seam's timing arithmetic is audited like an oracle, by a different
   session, before any live-cursor verdict is claimed from it; the first experiment's
   cursor measurements are exploratory. Whether the seam becomes an amendment to this
   contract's progression is decided on that experiment's evidence.
6. **Tooling.** The listening bench may take `onnxruntime-node` as a development
   dependency so the model runs in process and the unchanged runner measures causality
   and cost. The pinned Python environment in `~/dev/guitar-nn`
   (`environments/basic-pitch/`, model SHA-256
   `2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec`) may produce
   offline observations, cited by output hash; the experiment puts that repository under
   version control so a source commit can be cited, and changes nothing else in it. Any
   decoder threshold the challenger uses is fitted on the development guitars only,
   never on evidence it is scored on.

The incumbent track continues unchanged and its questions keep their rank. Its next
full sweep is still due no later than experiment 039, counting both tracks' numbers.

## Amendment, 2026-10-04: sampled guitar replaces the sines, and the promotion rule

Added 2026-10-04 by the user's direction, after experiment 036 measured the incumbent
on the challenger's guitar renders. Where it differs from a section above, this section
governs; those sections carry a pointer here and are otherwise left as they were.

The user's direction, in order:

> I'm prepared to promote, but before I do - I'd like to dot the i's and cross the t's.  Also tell me about the lag

> lets drop the sine wave - its not useful.  what do you recommend we do on your decisions

> yes - write them in and set up the batch - slight preference of sol 6.1 (Dave) or astra 6 (new agent eric)  as I have more openai tokens left.

The decisions below are the recommendations the user accepted with that "yes", drafted
by Claude Opus 5.5 in Claude Code.

1. **The sines are dropped.** Every sine set is retired: frozen and cited as history,
   never run again, in a routine run or a sweep. The sine passes of event-chain@1–@3
   stand as historical records. The full-sweep obligation now applies to the guitar sets
   below, from the first experiment that claims a guitar stage.
2. **The progression is rebased onto sampled guitar.** The sound of stages 1–3 is
   `sample-render@1` from the four development guitar sample sets (`tonejs-acoustic`,
   `martin`, `spanish`, `fender`). Exact note schedules keep lesson L1. Stage 1 is s1 and
   s2, perfect, at the four tempi; stage 2 adds the deviations one at a time, in the
   order of [the progression](#the-progression-start-simple-one-change-at-a-time),
   re-rendered from the frozen sine schedules; stage 3 is Winner bars 1–4 with chords.
   Stage 4, which was one recorded guitar sample set, becomes **recordings through a
   microphone**, with its own gates proposed from evidence before it starts. Stage 5 is
   unchanged.
3. **Gates for the guitar stages.** [The approved gates](#the-gates-approved-for-stages-13)
   apply unchanged, with two changes:
   - **The silence control is quiet noise, not digital zero:** pink noise at −60 dBFS
     RMS, the length of the performance, from a fixed, recorded generator and seed. The
     level is fixed here and never tuned. Digital zero tells no listener apart: both
     passed it in 035 and 036, and Basic Pitch's per-window normalisation is untested
     without it. The wrong-score control stays `w2`.
   - **Cost and delay:** the sustained cost ratio stays at most 0.25. The chunk p99 of at
     most 10 ms is replaced by the cursor deadline (every event within 0.2 s, or 95%
     where an example has 20 or more) measured on a clock that **includes the
     listener's measured compute time**: a decision is made no earlier than the delivery
     clock plus the wall time spent producing it. The p99 gate was written for listeners
     that work every chunk and would forbid a batched model that meets its deadline;
     the replacement tightens the deadline to count real compute and drops the jitter
     limit. Cost stays provisional to the measuring host.
4. **Passing a guitar stage means all four development guitars,** both outputs and
   controls, under these gates. A guitar or a part is never chosen after its results
   are seen.
5. **Promotion, replacing [challenger decision 4](#the-challenger-track-basic-pitch-observations).**
   The challenger becomes the incumbent when (a) it passes guitar stage 1 and the
   silent-hesitation substage (the sets 035 and 036 measured, with the quiet-noise
   control added), both outputs and controls, on all four development guitars; (b) the
   incumbent fails that stage on the same examples (036 records its assessment failure;
   its cursor and noise controls are measured beside the challenger's); and (c) it passes
   the **held-out confirmation**. "Cannot attempt" and "every substage the incumbent has
   passed" are withdrawn: the first was undefined, and the second referred to the
   sines. The loser still freezes as a comparator and is never developed further.
6. **The held-out confirmation, once.** The same schedules, controls included, are
   rendered from the three held-out sample sets (`tonejs-nylon`, `tonejs-electric`,
   `shinyguitar`; the last two share the Karoryfer origin, so this is two independent
   sources, not three). The experiment first checks that none of them has been examined
   under contract 2. The candidate, its configuration and the criterion are fixed in a
   pre-registration before rendering. It passes only if every held-out guitar passes
   both outputs and controls. It runs once. If it fails, there is no promotion, and the
   held-out sets become development evidence (lesson L11): a later claim needs fresh
   held-out guitars.
7. **The user promotes.** When (a)–(c) hold, the batch stops; a process review by a
   model that ran none of its experiments checks the evidence, and the user makes the
   promotion. On promotion, event-chain@3 freezes as a comparator, the new incumbent's
   sentinels are chosen by the rising-tide rule from its own guitar evidence, and a full
   sweep of the guitar sets is run as the new incumbent.
8. **The main track is paused.** No further event-chain version is developed. Question
   23 (one wrong note) returns as a guitar deviation in stage 2.

The [observation seam](#the-challenger-track-basic-pitch-observations)'s timing must be
settled before any cursor verdict (question 27), and decision 3's compute-inclusive clock
is part of that settlement: the next seam version states how measured compute enters
`availableAt` and `madeAt`, and its audit covers it.

## Amendment, 2026-10-05: host stalls, guitar sweeps, sentinels and the outside review

Added 2026-10-05 by the user's direction, after [process review R12](../reviews.md)
escalated four questions on experiment 043's evidence. Where it differs from a section
above, this section governs. The user, in order:

> Happy with you fixing ledger and recording the breach, but first can I get some recommendations on r12s escalations

> I agree to these propoposal, lets get started

The proposals they agreed to, drafted by the parent session (Claude Opus 5.5 in Claude
Code):

1. **The gates stand, and a stall is diagnosed before anything else.** 043 failed one
   cost comparison and one event deadline on feeds that ran no inference. No gate
   changes; no best-of-N, median or re-measurement rule is adopted, because a cursor
   that is late once on stage is late for the player. A pre-registered diagnosis with
   CPU, runtime-collection and scheduler tracing, and with evidence writing isolated
   from the measured process, comes first, and its outcome decides what follows:
   - **a cause in the measuring harness** (evidence writing, harness allocations or
     host load the listener does not create): the harness is fixed and the full
     formal stage claim is run again, once, under the same gates. That is a fresh
     measurement with the cause removed, not a favourable redraw;
   - **a cause in the listener's own path** (for example collection driven by its
     allocations): the stall is real, the gate stands, and the next step is a listener
     version that removes it;
   - **no attribution:** the batch stops and the evidence goes to the user.
   Formal timing runs are made with no other agent working on the host, and record the
   host's load while they run.
2. **Baselines in guitar sweeps.** The incumbent runs on every guitar example of a full
   sweep, since [promotion condition (b)](#amendment-2026-10-04-sampled-guitar-replaces-the-sines-and-the-promotion-rule)
   needs its result on the same examples. The frozen clock and time-warp baselines
   (`clock-follower@1`, `online-time-warp@8`, `@12`, `@14`) run only on guitar stage 1's
   clean examples, so the comparison stays visible; on guitar they fail 210 to 564 of
   576 cursor checks (043). This settles R10's escalation for the guitar stages.
3. **Sentinels.** R10's recommendation is adopted: a substage's sentinels are drawn from
   its deviation examples only (clean parents are stage 1's), and ties on margin are
   broken by severity in the direction of difficulty (slowest tempo, longest pause,
   most extreme bar factor) before by name. The chooser is part of an instrument, so it
   is implemented as a new stage-gates version with hand-worked cases and an
   independent audit before its first use, which is the sentinel selection that
   promotion triggers.
4. **An outside review at promotion.** The closing review before the user decides on
   promotion is done, once, by a model that has never worked in this loop, and covers
   both the promotion evidence and the process's auditing regime, including what the
   five seam versions cost against what they caught.

## Still open for the user

- New gates before stage 4, now microphone recordings, from the evidence of stages 1–3.
- The category figures, if experience says the estimates are wrong.
