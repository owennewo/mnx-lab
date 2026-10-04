# 036 — The incumbent on the challenger's guitar renders

## Pre-registration

2026-10-04. **Claude Opus 5.5 in Claude Code.** Experiment 036, main track, run by the
user's direct instruction; no batch is open. This session also wrote process review
[R11](../reviews.md#r11-after-the-challenger-batch-035-and-the-observation-seam-audit),
which recommended this run, so the review of 036 must come from another session,
preferably another model.

### Question and why

**Question 28.** On the frozen `contract2-challenger-guitar-v1` set (the stage-1 and
silent-hesitation performances of s1 and s2, rendered by 035 with `sample-render@1`
from the four development guitars, each with its digital-silence and `w2` controls:
576 examples), what do the **unchanged incumbent event-chain@3**'s live cursor and
end-of-piece assessment do under the current audited instruments, and how does each
example compare with 035's challenger assessment of the same audio?

The user's direction, given on 2026-10-04 in reply to R11's first escalation:

> yep - lets run teh incumbent against same guitar samples.

R11 asked for this run because the challenger's promotion rule can't be applied without
it. Clause two of that rule turns on what the incumbent can't do, and nobody has
measured the incumbent on guitar. It is also R10's third escalation as R10 wrote it:
event-chain@3 unchanged on the stage-4 sound, both outputs, controls included. It
departs from the main track's order of work, whose next question is 23 (one wrong
note), on the user's authority; question 23 keeps its rank behind it.

### Alternatives, and how the run separates them

The incumbent's front end is `sinePitch` (`bench/src/listeners/eventChain1.ts`):
positive-going zero crossings over a 20 ms window every 10 ms, a pitch only when the
estimate is within a quarter-tone of an integer MIDI note, and silence below RMS 0.002.
A plucked string's harmonics can add zero crossings per period, so the expectation is
that this front end, not the chain, is what breaks. Three explanations for any failure:

1. **Front end:** the window estimate is wrong or withheld while a note sounds.
2. **Acquisition timing:** the estimate is right, but only after the attack's
   harmonics decay, so tokens come late and the 200 ms deadline or interval
   durations fail.
3. **Chain or reporting:** correct tokens are mis-sequenced or mis-reported.

035's privileged-input diagnostic already passed all 32 clean guitar assessments
through the unchanged chain with exact stimulus tokens, which makes the third unlikely.
To separate the first two, a **front-end diagnostic** runs the exported `sinePitch` on
every 20 ms window at 10 ms hops (the listener's own windowing) and classifies each
window whose span lies wholly inside one rendered note as: exact pitch; an octave away
(±12 or ±24); another pitch; unpitched but not silent; or silent. It reports the
fractions per guitar and the time from each note's onset to its first window of
two consecutive exact estimates. It reads the labels, so it is diagnostic only and
never a listener input.

### Method

1. No listener, instrument, stimulus or gate is created or changed. The set is read as
   035 froze it: manifest SHA-256
   `7c0537d08b57333b3df4c9ac82cc4f26678dcaebbf48ac72d3a72e2dca502055`, the freeze
   record's hash, and every one of its 387 assets by hash.
2. Every one of the 576 examples runs fresh through `executeSeam` at 48 kHz in
   480-sample chunks, with the handoff 035 used (top of score, 90 quarters per minute,
   rate 1). Each is judged by following-evaluator@2, assessment-evaluator@3 and
   stage-gates@2 (`cursorGates`, `assessmentGates2`, `pooledGates2`), with six prefix
   causality checks and the runner's cost, exactly as 033 and 034 judged the sine sets.
   Event-oracle@4 is checked on load. Nothing is retired, re-chosen or rerun from the
   sine suite: the listener and every producer of its sine records are unchanged since
   g034, so the runner checks event-chain@3's and the instruments' source hashes against
   g034's and cites g034 by hash. No suite state changes. This is a thermometer, not a
   routine run or a full sweep.
3. The approved gates are for the sine stages. On guitar they are **comparisons**,
   reported per example and pooled per guitar and per part (clean, hesitation); no
   stage, substage or stage-4 claim is made, and the recorded-guitar gates still await
   the user.
4. **Comparison with 035.** g035's private `results.json` is verified by the hash its
   summary records, and each example's challenger assessment failures are set beside
   the incumbent's. The headline comparison is 035's own continuation criterion: the
   assessment gates, controls included, on each guitar's clean stage-1 examples (8
   performances and 16 controls). The challenger met it on 3 of 4 guitars (all but
   Martin).
5. Each private record is written with its hash as it is measured; the public summary's
   shape is checked on a dry assembly before measuring; the runner refuses to run
   unless its code and this pre-registration are committed, the pre-registration is on
   `origin/main` with its text a prefix of the file, the run ID is new, and the HEAD is
   tagged `<run-id>-source`. Run ID **g036-incumbent-guitar**; one technical rerun,
   **g036a-incumbent-guitar**, only for infrastructure, after diagnosis.
6. Expected time: about a minute for the listener at 033's rate, plus the diagnostic.

### Predictions

1. **Silence:** all 192 digital-silence controls pass both outputs (they're exact
   zeros, below the silence threshold).
2. **Wrong score:** at least 180 of 192 `w2` controls pass both outputs. A failure needs
   a mis-estimate landing exactly on a `w2` pitch, then being aligned.
3. **The 035 criterion:** the incumbent meets it on **at most two** of the four guitars,
   fewer than the challenger's three.
4. **Performances:** fewer than half of the 192 guitar performances (under 96) pass the
   assessment comparison, and fewer than half pass the cursor comparison.
5. **Front end:** on at least two guitars, under 80% of in-note windows estimate the
   exact pitch, and the shortfall is mostly unpitched or octave windows rather than
   other pitches.
6. **Causality and cost:** all 3,456 prefix checks pass, and every example is within the
   cost comparisons (sustained ratio ≤ 0.25, chunk p99 ≤ 10 ms), as on the sines.

What would contradict them: three or four guitars meeting the 035 criterion (3); half
or more of the performances passing either output (4); exact estimates at 80% or more
on three or more guitars (5); any control failing beyond the bounds in 1 and 2.

### Decision rules, fixed now

These read the assessment output, the only output the two tracks have both measured
formally (035's cursor numbers are exploratory until question 27 is resolved). The
incumbent's cursor results are reported beside them and carry no decision weight here.

- **E1, no separation:** the incumbent meets 035's continuation criterion on three or
  four guitars. This set does not separate the two front ends on assessment, and the
  challenger cannot claim promotion on it under clause two; recorded for the user's
  promotion-rule decision. The main track's next question stays 23.
- **E2, separation:** it meets the criterion on two or fewer. This set separates the
  front ends on assessment in the challenger's favour, with the front-end diagnostic
  attributing the incumbent's failures among the three explanations above; recorded
  as evidence for the user's promotion-rule and recorded-guitar decisions. No
  promotion follows: promotion needs the user's reading of clause two, and gates for
  a guitar substage. The main track's next question stays 23.
- **Mixed or unattributed:** if the diagnostic can't attribute a failure to one of the
  three explanations, the report says so, and the E1/E2 reading still stands on the
  measured counts.
- **Infrastructure:** a failure before measuring preserves the attempt and its error
  with zero measurements, and is diagnosed before the one technical rerun. A failure
  during measuring preserves every completed hashed record. A failure only in writing
  the record afterwards preserves the measurements without a verdict until the writer
  is repaired, which is not a rerun. Unresolved infrastructure, or evidence fitting no
  branch, is inconclusive and changes nothing.

Neither branch creates a listener version, changes the stopping count, retires or
re-chooses anything, or touches a suite state. The new set is not added to any suite.

### Carried-over stopping count, budgets and evidence access

Unchanged since [035's resulting state](035-challenger-basic-pitch.md#resulting-stopping-count-budgets-and-evidence-access):
main track **0** consecutive failing versions, three development versions, nine
completed comparisons; challenger track 0, one version, one comparison; qualification's
six versions and twelve slots, reserved and final evidence, held-out guitars and Winner
bars 5–8 all unused. Latest fresh incumbent sweep g034, next due no later than 039.
This run adds one comparison to the main track and no version.

## Results

**E2: the guitar renders separate the two front ends.** The unchanged incumbent meets
035's continuation criterion on **none** of the four development guitars; the
challenger met it on three. The incumbent rejects every control, but it also fails
182 of 192 performances on the assessment and all 192 on the cursor. The front-end
diagnostic places the failure in `sinePitch`. Each guitar defeats it on different
notes, and the electric guitar defeats it almost everywhere. No stage, substage or
promotion claim follows, and no gate is a verdict here.

### Both outputs, beside 035's challenger assessment

Counts are examples passing the approved sine-stage gates, used as comparisons. A
guitar's clean part is the 8 stage-1 performances and their 16 controls; its
hesitation part is the 40 silent-hesitation performances and their 80 controls.

| Guitar, part | Incumbent assessment: performances; controls | Incumbent cursor: performances; controls | Challenger assessment (g035): performances; controls | Events reached within 0.2 s | Intervals within tolerance / reported | False findings |
|---|---|---|---|---|---|---|
| Tone.js acoustic, clean | 0/8; 16/16 | 0/8; 16/16 | 8/8; 16/16 | 12/48 | 17/40 | 0 |
| Tone.js acoustic, hesitation | 0/40; 80/80 | 0/40; 80/80 | 40/40; 80/80 | 60/240 | 85/200 | 0 |
| Martin, clean | 0/8; 16/16 | 0/8; 16/16 | 8/8; 12/16 | 0/48 | 15/31 | 6 |
| Martin, hesitation | 4/40; 80/80 | 0/40; 80/80 | 40/40; 60/80 | 0/240 | 85/155 | 30 |
| Spanish, clean | 1/8; 16/16 | 0/8; 16/16 | 8/8; 16/16 | 24/48 | 15/26 | 8 |
| Spanish, hesitation | 5/40; 80/80 | 0/40; 80/80 | 40/40; 80/80 | 120/240 | 77/130 | 40 |
| Fender, clean | 0/8; 16/16 | 0/8; 16/16 | 8/8; 16/16 | 0/48 | 6/9 | 33 |
| Fender, hesitation | 0/40; 80/80 | 0/40; 80/80 | 40/40; 80/80 | 0/240 | 30/45 | 165 |
| **All** | **10/192; 384/384** | **0/192; 384/384** | **192/192; 360/384** | **216/1152** | **330/636** | **282** |

All 282 false findings are played notes reported missing; the pooled missing-note false
alarm rate is 282/1152 against the 5% gate. Of the 182 failing performance assessments,
97 fail the overall tempo, 181 the intervals and 47 the no-false-finding rule (an example
can fail several). The intervals that are reported miss by up to 768 ms. The ten
performances that pass are all of s1: four Martin hesitations at tempo 63, and the
Spanish clean s1 performance at tempo 90 with its five hesitations.

The two listeners disagree on 206 examples: 182 performances that only the challenger
passes, and Martin's 24 wrong-score controls that only the incumbent passes. None
goes the other way. The incumbent's clean controls are cheap: a listener that hears few
notes correctly rejects a wrong score easily (lesson L8), so its 384/384 controls say
nothing in its favour beside 10/192 performances.

**Causality and cost:** all 3,456 prefix checks pass; maximum sustained ratio 0.0017,
maximum chunk p99 0.11 ms.

### The front-end diagnostic

`sinePitch` on the listener's own 20 ms windows at 10 ms hops, each window wholly inside
one rendered note, classified against that note (25,098 windows per guitar).

| Guitar | Exact | Octave | Other pitch | Unpitched | Silent | Notes acquired (2 exact windows) | Within 0.2 s of onset | Median / max acquisition |
|---|---|---|---|---|---|---|---|---|
| Tone.js acoustic | 57.3% | 12.3% | 14.6% | 15.8% | 0.1% | 288/288 | 72 | 253 / 393 ms |
| Martin | 37.4% | 9.1% | 26.5% | 26.3% | 0.6% | 252/288 | 0 | 356 / 1,307 ms |
| Spanish | 47.8% | 22.1% | 12.1% | 17.1% | 0.9% | 240/288 | 216 | 100 / 870 ms |
| Fender | 2.7% | 10.1% | 44.4% | 42.8% | 0% | 90/288 | 0 | 805 / 997 ms |

Exact fraction by written pitch, in s1/s2's range:

| Guitar | C4 | D4 | E4 | F4 | G4 | A4 | B4 | C5 |
|---|---|---|---|---|---|---|---|---|
| Tone.js acoustic | .45 | .31 | .45 | .74 | .74 | .68 | .76 | .78 |
| Martin | .57 | .61 | .41 | .41 | .01 | .05 | .21 | .22 |
| Spanish | .02 | .02 | .88 | .89 | .17 | .22 | .88 | .86 |
| Fender | .00 | .05 | .04 | .03 | .00 | .00 | .03 | .03 |

The three explanations, as the evidence sorts them:

1. **The front end is wrong or withholds**, on every guitar. Where a sample has strong
   harmonics, a 20 ms zero-crossing count gives no estimate, a wrong one or an
   octave. It isn't one systematic error: each sample defeats it on different notes.
   Spanish's C4 and D4 are nearly never exact, while its E4 and F4 are; Martin's G4
   and A4 are nearly never exact. The Fender electric guitar is unreadable throughout.
2. **Late acquisition** decides the Tone.js acoustic. Every note is eventually read,
   but at a median of 253 ms after its onset, and the delay varies from note to note,
   so intervals drift by hundreds of milliseconds and the cursor misses its deadlines.
   Nothing produces a false finding there.
3. **The chain** is not implicated: 035's privileged-input check passed all 32 clean
   guitar assessments through the same chain logic given exact tokens.

The incumbent's whole guitar result therefore rests on the zero-crossing estimator,
which every report since 024 has said would not survive recorded guitar.

### Execution and reproducibility

[g036-incumbent-guitar](../runs/g036-incumbent-guitar/summary.json) ran once at
`g036-incumbent-guitar-source`, 2026-10-04 20:27:54–20:28:24 UTC, **29.9 s**. No failed
attempt and no rerun. Before measuring, the runner checked that the pre-registration,
on `origin/main` since `b6a71999`, is an unchanged prefix of this file. It also checked
event-chain@3's, the instruments' and the seam runner's sources against g034's pinned
hashes (all equal), the guitar manifest, its freeze record and all 387 assets, and
035's results by the hash its summary records. The public summary is 108,803 bytes;
576 per-example private records were written with their hashes as measured, after a
dry assembly.

| Artifact | Path / SHA-256 |
|---|---|
| Public summary | `runs/g036-incumbent-guitar/summary.json`; `3e29772dc3a907bf6dc6b5dde43be36098e6c236fe5cd67fb1287d56b726ff3d` |
| Per-example index | `/home/williao/dev/mnx-listening-data/diagnostic-runs/g036-incumbent-guitar/results.json`; `22d329d8861aa7486f0b00140121f3ef7ecbfac7725f06be31ed95509b4051df` |
| Aggregates and diagnostic | same directory, `aggregate-details.json`; `4cf6a6468a19f1406926914ceb359d8e1afb87e1d53750735d240ec24fbb7ab7` |
| Validation and citations | same directory, `validation.json`; `188c22e9a3d893ea3f9411c913cd3cd447ecc1dbe32d3373903c6556cf225563` |

## Against the predictions

| # | Prediction | Outcome | Evidence |
|---|---|---|---|
| 1 | All 192 silence controls pass both outputs | Held | 192/192 |
| 2 | At least 180 of 192 `w2` controls pass both outputs | Held | 192/192; cheap, as above |
| 3 | The 035 criterion on at most two guitars | Held | None of four |
| 4 | Under 96 of 192 performances pass each output | Held | Assessment 10, cursor 0 |
| 5 | Under 80% exact windows on at least two guitars, the shortfall mostly octave or unpitched | Held, narrowly in its second half | All four under 58%. Octave plus unpitched is 54–75% of each guitar's shortfall (Fender 54%, Martin 57%), so other pitches are a larger share than expected |
| 6 | Every prefix check and cost comparison passes | Held | 3,456 prefixes; cost two orders of magnitude inside both gates |

## Decision

**E2 applies.** On the assessment output, the guitar renders separate the two front
ends in the challenger's favour: 0 of 4 guitars for the incumbent against 3 of 4. The
diagnostic attributes the incumbent's failure to its front end, both explanation 1 and,
on the Tone.js acoustic, explanation 2. This is evidence for the user's promotion-rule
and recorded-guitar decisions. It is not a promotion: clause two still needs the user's
reading, and a guitar substage needs approved gates. The challenger's cursor numbers
remain exploratory until question 27 is resolved. Nothing in the incumbent, the suite,
the sentinels or the stopping count changes. The main track's next question stays 23.

### Resulting stopping count, budgets and evidence access

Main track: **0** consecutive failing versions, three development versions, **ten**
completed comparisons (this unchanged-version thermometer added one). Challenger track
unchanged: 0, one version, one comparison. Qualification's six versions and twelve
slots, reserved and final evidence, held-out guitars and Winner bars 5–8 all unused.
Latest fresh incumbent sweep g034, next due no later than 039. The guitar set joins no
suite.

## Next

For the user, now with both listeners measured on the same audio:

1. **The promotion rule.** If "cannot attempt" (the contract's wording) or "has
   failed" (proposal 1's) is read to cover a guitar substage, this set is where the
   incumbent fails and the challenger, on assessment, does not. The challenger's
   cursor and cost are still unsettled (question 27; 035's compute failure), so any
   guitar-based promotion would rest on one output.
2. **Recorded-guitar gates.** Both listeners have now been measured on the same 576
   renders; the gate proposal before stage 4 can cite both. The digital-silence
   control was passed by both and tells neither apart.

For the main track: question 23 (one wrong note with `w1`) is next on sines. But every
further sine substage now builds on a front end that this run shows can't hear a
sampled guitar. A main-track listener version that replaced `sinePitch` while keeping
the chain would be the incumbent's answer to the challenger; whether to spend main-track
experiments on that or on the remaining sine deviations is an order-of-work question
for the user.

**Direction of travel.** The chain is the part that survives: its stay-and-skip
states, offline alignment, interval accounting and other-bars flags work unchanged
behind either front end, given correct tokens (035's privileged check). The
zero-crossing front end does not survive recorded guitar, as predicted since 024 and
now measured: under 58% exact on every sampled guitar, 3% on the electric.

## Attribution

Pre-registered, implemented, run and recorded by **Claude Opus 5.5 in Claude Code**,
which also wrote process review R11. The review of this experiment should come from
another session, preferably another model.
