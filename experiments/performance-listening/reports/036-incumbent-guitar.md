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
