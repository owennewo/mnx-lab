# Development contract 2 — draft: a live cursor on events, and a batch assessment

**Status: draft, not in force.** Drafted 2026-09-30 by Claude Opus 5.5 (1M context) in
Claude Code, from the user's directions below. [Development contract 1](development-contract-1.md)
governs every experiment until the user approves this text. It loosens contract 1's
tempo range, replaces its cursor measure and widens [APPROACH.md](../APPROACH.md)'s
scope, so approval is required. The numbers marked *provisional* are proposals for that
approval, not decisions.

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
piece, and its report locates what it finds by bar or phrase, as answer 1's "slows down
in bar 4" needs.

The same day they directed a reset of the experimental record:

> I was thinking that we should reset the EXPERIMENT_LOG by moving all the items in it
> to EXPERIMENT_LOG_ARCHIVE and also move the experiments themselves into a new folder.
> I want a fresh experimental context that follows these new objectives and am prepared
> to lose some progress because of it.
> I'm wondering whether to go further and start the algorithm (delete the current code)
> or just use it as the baseline and modify from there.

A review of this draft by another model was then given to the author. The user asked
for only its high-value points to be taken; those are folded into the sections below.

## Why

Contract 1 measures one thing: whether the live cursor is within ±¼ quarter of the
true position. That measure grades the listener, never the player. It was only ever
tested at 80–120% of the handed tempo with smooth changes, and experiments 017–021
improved it by adding steady-tempo assumptions. That serves a professional at tempo
and fails the Studio beginner the user describes. The real-clip thermometer also
cannot separate listener error from sync error at ±¼ quarter
([report 021](../reports/021-stability-calibration.md#resulting-plateau-budgets-and-evidence-access)).

## Two outputs, judged separately

**Live: the cursor.** Causal and prompt, as now. Its only job is to show the player
where they are, at event resolution.

- An **event** is the set of score notes sharing one onset: a chord, or a single note.
- The **true cursor** at time t is the latest event the player has sounded by t. During
  a hesitation it stays on the last sounded event; it never interpolates ahead at the
  handed tempo.
- **Missing events.** If event 2 is not played, the true cursor goes from event 1 to
  event 3 when event 3 sounds. The listener must recover there; a missed event never
  stops it.
- **Dead notes.** A muted or percussive note sounds an onset without its pitch. While it
  is the latest event, the cursor may show it or its predecessor; both count as correct.
- **Answerable only when the audio can tell.** A label records what happened and
  which events the audio so far supports. Where the audio cannot yet distinguish them,
  as with repeated identical chords, consecutive dead notes, or an omission before a
  similar event, any supported event counts as correct. The decision deadline starts
  when a distinguishing event sounds, not at the first onset. Honest uncertainty is not
  punished, and a lucky guess is not rewarded.
- The handed tempo is the tempo the player chose in Studio: a hint, not a truth.

**Batch: the assessment.** Made once, at the end of the piece, with full hindsight. The
listener may re-align the whole recording offline. What it finds is located by bar, or
by phrase where the score marks phrases.

- **Local tempo** at each sounded event is `60 × score distance to the next sounded
  event, in quarters ÷ elapsed seconds between their onsets`. It is measured between
  matched onsets, never from a note's written duration. So an omitted event, a rest or
  an overlapping note is not mistaken for slowing.
- **Overall tempo** is the same ratio from the first sounded event to the last: every
  pause is included, and the final ringing is excluded. It is reported beside the handed
  tempo and never counts against timing.
- **Tempo variation** is the main timing judgement: local tempo relative to the player's
  overall tempo. A hesitation is not a separate category; it is the local tempo falling
  towards zero. The report flags bars well below or above the player's own tempo, such
  as "slowed in bar 4", as practice cues.
- **Sequence** says, per event, whether it was heard, missing or dead. Its claim is
  bounded: *the expected event sequence was followed*. Wrong pitches, partial chords and
  extra notes are not assessed, so the report must not say the notes were played
  correctly.
- **Same audio, same assessment.** The expected assessment depends only on what sounded
  and when, never on how the generator recipe named the deviation. Two recipes that
  produce the same onsets have the same expected report.

A player who plays every event in order, slowly and steadily, gets a low overall tempo,
no variation flags and a complete sequence.

## Evidence

The synthetic ladder stays: it gives exact labels. A new **performer axis** renders
Winner bars 1–4 with deviations whose truth is known exactly. Ranges are *provisional*:

| Deviation | Range |
|---|---|
| Overall tempo | 40–120% of the handed tempo, steady |
| Local slowing | One or two bars at 50–80% of the player's own tempo |
| Hesitation | 0.5–2 s added before an event, at chord changes and elsewhere |
| Rushing | One bar at 110–130% of the player's own tempo |
| Missing event | One to three events omitted, never the first |
| Dead note | One to three events replaced by a muted percussive onset |

Each is rendered on sine and recorded-guitar timbres, one deviation at a time and then
combined. **Clean examples are mandatory**: steady playing at several overall tempi,
including half speed, must produce a complete sequence and no variation flags. The
wrong-score and silence controls stay.

**The real Winner clip.** Its sync anchors are uncertain, so it is judged at bar level,
with an uncertainty band around each anchor and an *indeterminate* result where the
band prevents a judgement. The batch assessment never reads sync. That keeps the
candidate honest, but it does not make sync evidence of the player's timing. The real
clip cannot establish small tempo faults until independent timing evidence exists.

## Instruments

Contract 1's rule stands: no candidate is judged by a new instrument until it has its
own hand-worked oracle cases. **The oracle cases are frozen before any numerical gate is
chosen**; the gates below are placeholders until then.

- **following-evaluator@2** judges the live cursor, with version 1's as-decided and
  hindsight views. It measures:
  - by time: on a supported event, with **ahead** (on an event not yet sounded)
    reported separately, plus wrong or false-following exposure and the longest episode;
  - **by event**: the fraction of distinguishable events the cursor reaches within the
    deadline. A long hesitation waited out correctly must not hide short events that
    were missed;
  - recovery after a missing event; deadline, causality and cost as contract 1.

  Placeholders: on a supported event for 95% of answerable time and 95% of events;
  ahead at most 1%; exposure at most 5%, with no episode over 0.5 s; recovery in 90% of
  cases.
- **assessment-evaluator@1** judges the batch report, per event interval and per bar:
  - local tempo compared interval by interval, and overall tempo;
  - **detections and false alarms for every kind of flag**: variation flags,
    missing-event and dead-note reports. An assessor that flags everything must fail.

  Placeholders: overall tempo within ±5%; interval tempo within ±10%; every flag type at
  least 90% found and at most 5% false.
- **An oracle case for bad sync.** The audio is unchanged while the anchors move by
  100–400 ms. The musical assessment must not change; only the reference's
  uncertainty grows, and more of the real-clip cursor result becomes indeterminate.

## A fresh experimental context

At the user's direction, adopting this contract starts a new series of experiments.

- **Archive the record.** The research log, ledger, reports and run summaries move
  together into `archive/ladder-1/`, beside the existing `archive/`, keeping their
  internal layout so their links still work. Private audio and runs in
  `mnx-listening-data/` stay where they are.
- **Carry the lessons, not the progress.** The fresh research log starts with a short
  list of inherited lessons, each linked to its archived evidence. They are the findings
  that survive the change of objective: one decoy comparison is a coin flip on unrelated
  audio; timbre breaks naive support calibration; a faster-reacting path makes alignment
  errors worse; sync interpolation cannot grade anything finer than a bar; clip lengths
  must be exact to 1e-9 s at 48 kHz. Versions, limits and ranks stay in the archive.
- **Update the procedure.** APPROACH.md and RUNNING_AN_EXPERIMENT.md are revised to the
  new objectives before the first new experiment.
- **Split the code three ways.**

| Part | Decision | Why |
|---|---|---|
| Harness: renderers, guitar samples, tempo maps, the causal runner and its prefix check, cost measurement, set freezing, the report exporter | **Keep** | The performer axis needs exactly these, and they encode none of the old objectives |
| Studio interface (`listen/`: the vocabulary, the display rule, delivery checks) | **Keep** | Still the Studio contract; an event cursor still emits a score position |
| Evaluator, scoreboard, active suite | **Replace** | They are the old objective |
| Listeners: the clock, `online-time-warp@8`, `@12` and `@14` | **Freeze as baselines** in a baseline folder, runnable, no further development | Cheap, and they test the new instruments. The evaluators are wrong if they do not show the forward-only, tempo-clamped path failing on hesitations and slow play. Comparing v8 with v12 and v14 also shows whether the new measures stop rewarding the smoothing experiments 017–021 added |
| New listener | **Start fresh**; do not evolve the old family | Its skeleton contradicts the new objectives: it must always advance, it aligns frames to a rendering at the handed tempo rather than tracking events, and its steady-tempo history smooths through the stalls the assessment must report |

Event-based score followers with explicit "stay" and "skip" transitions, such as
hidden-Markov models, are the published family that matches hesitations and missing
events. The first design experiment researches that literature rather than assuming
it. The batch assessment can start from a whole-recording offline alignment.

Moving the bench will break tests that read the old runs and reports. They are
re-pointed or retired with the archive, and the gate shows which.

## Effect on existing records

- Contract 1's experiments, runs and ladder stay intact in the archive and remain
  regression evidence under following-evaluator@1. `online-time-warp@14` stays the
  incumbent under contract 1 until this contract is adopted.
- APPROACH.md's statement that the listener that matters is causal and prompt applies
  to the live cursor. Offline alignment becomes permitted for the batch assessment.
- [Research contract 1](research-contract-1.md), the qualification contract, is
  unchanged. Any future qualification under the new measures needs its own approval.
- Bars 5–8 stay unexamined, the fresh check for the new series.

## Suggested order

1. The user approves or amends this draft.
2. The reset, as its first act: archive the record, start the fresh log with inherited
   lessons, update APPROACH.md and RUNNING_AN_EXPERIMENT.md, and freeze the baselines.
3. New experiment 1: build following-evaluator@2 and assessment-evaluator@1, and write
   and freeze their oracle cases, including the bad-sync case. Render the performer
   axis with its clean examples. Measure the clock and versions 8, 12 and 14 as
   baselines. Then propose numerical gates from that evidence, for the user's approval.
4. New experiment 2: research event-based following, then build the new live listener.
5. New experiment 3: a first batch assessor from whole-recording alignment.

## Still open for the user

- The provisional ranges above, and the numerical gates once the oracle cases exist.
- What counts as a phrase where the score marks none (default: the bar).
- Whether wrong notes, partial chords and extra notes enter now or with a later
  milestone. They are left out here, and the sequence claim is bounded accordingly.
