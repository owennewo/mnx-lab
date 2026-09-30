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
- The handed tempo is the tempo the player chose in Studio: a hint, not a truth.

**Batch: the assessment.** Made once the piece ends, with full hindsight. The listener may
re-align the whole recording offline. Reported per bar, or per phrase where the score
marks phrases.

- **Tempo** is the player's overall tempo beside the handed tempo. It is reported, and
  never counts against timing.
- **Tempo variation** is the main timing judgement. It is the local tempo at each event,
  from the interval to the next sounded event against its written duration, relative to
  the player's own overall tempo. A hesitation is not a separate category: it is the
  local tempo falling towards zero. Per bar, the report gives the slowest and fastest
  local tempo and flags bars well below the player's own tempo, such as "slowed in bar
  4", as practice cues. Uneven rhythm within a bar shows as event-to-event variation in
  the same measure.
- **Sequence** says, per event, whether it was heard, missing or dead. The summary is
  whether all events were played in order.

A player who plays perfectly but slowly therefore gets a low tempo figure, no
variation flags and a complete sequence.

## Evidence

The synthetic ladder stays: it gives exact labels. A new **performer axis** renders
Winner bars 1–4 with deviations whose truth is known exactly. Ranges are *provisional*:

| Deviation | Range |
|---|---|
| Overall tempo | 40–120% of the handed tempo |
| Local slowing | One or two bars at 50–80% of the player's own tempo |
| Hesitation | 0.5–2 s added before an event, at chord changes and elsewhere |
| Rushing | One bar at 110–130% of the player's own tempo |
| Missing event | One to three events omitted, never the first |
| Dead note | One to three events replaced by a muted percussive onset |

Each is rendered on sine and recorded-guitar timbres, one deviation at a time and then
combined. The wrong-score and silence controls stay. The real Winner clip is judged
only at bar level, the resolution its sync anchors support. The batch assessment never
uses sync.

## Instruments

Contract 1's rule stands: no candidate is judged by a new instrument until it has its
own hand-worked oracle cases.

- **following-evaluator@2** judges the live cursor on events, with the as-decided and
  hindsight views of version 1. Measures, *provisional* gates:
  - on the true event for at least 95% of answerable time, allowing the decision
    deadline after each onset;
  - **ahead** (on an event not yet sounded) reported separately, at most 1% of time;
  - wrong or false-following exposure at most 5%, no episode over 0.5 s;
  - after a missing event, on the next sounded event within the deadline in at least
    90% of cases;
  - deadline, causality and cost as contract 1.
- **assessment-evaluator@1** judges the batch report. *Provisional* gates:
  - overall tempo within ±5% of truth;
  - each bar's local-tempo profile within ±10% of truth;
  - every hesitation of 0.5 s or more flagged at the right event;
  - missing and dead events found in at least 90% of cases, with at most 5% of played
    events wrongly reported missing.

## Effect on existing records

- Contract 1's experiments, runs and ladder stay as they are and remain regression
  evidence under following-evaluator@1. `online-time-warp@14` stays the incumbent under
  contract 1. Under this contract it is first measured as a baseline, its positions
  mapped to events.
- APPROACH.md's statement that the listener that matters is causal and prompt applies
  to the live cursor. Offline alignment becomes permitted for the batch assessment.
- [Research contract 1](research-contract-1.md), the qualification contract, is
  unchanged. Any future qualification under the new measures needs its own approval.
- Bars 5–8 stay the fresh check for development, now under both instruments.

## First experiments, if approved

1. Build following-evaluator@2 and assessment-evaluator@1 with their oracle cases.
2. Render the performer axis, then measure `online-time-warp@14`'s live cursor on it
   as the baseline. Its forward-only path and 0.5–2× tempo clamp predict failures on
   hesitations and slow play.
3. Build a first batch assessor from an offline alignment of the whole recording.

## Still open for the user

- The provisional ranges and gates above.
- What counts as a phrase where the score marks none (default: the bar).
- Whether extra and wrong notes enter now or with a later assessment milestone. They
  are left out here.
