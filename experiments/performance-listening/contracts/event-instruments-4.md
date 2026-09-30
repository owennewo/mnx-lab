# Event instruments, version 4 — corrected and completed oracle coverage

2026-09-30, **Sol 6.1 (high) in Codex**, for experiment 029. This version freezes
**event-oracle@4**, correcting audit 3's arithmetic and supplying missing cases.
It inherits [event instruments 3](event-instruments-3.md) without changing a musical
rule, instrument implementation, or approved numerical gate. The implementation
names remain assessment-evaluator@3 and stage-gates@2. The oracle number changes
because answers change; historical oracle3 and its mixed verdict remain intact.

## Corrections

B1 excludes only the interval ending in bar0. The other intervals are weight3 at30
and weight1 at60; their median is30 and bar0's ratio is1. B11 uses quarters
0,8,16,24,31 and exact integer onsets0,6,12,18,23. Three intervals at80 carry weight24;
the final interval at84 carries weight7. Each other-bars reference is80, so the
last ratio is exactly21/20 in decimal arithmetic: either and unclean. This reshapes
the ambiguous case instead of declaring rounded old onsets to be unrecorded rationals.
The existing representational slack is checked, not a newly loosened tolerance.

## Reading oracle4

All inherited cases except B1/B11 retain their answers. B13 has one contributing bar
and no reference; B14 has no intervals; B15 omits an event and attributes the spanning
interval to its ending bar. `onsets: null` means the event and its note are missing.
The other events each contain one matched note. The cursor is irrelevant to these
hand assessments and does not provide their truth.

`reports` name a hand case, literal informational bar summaries and flags. Notes,
overall and sounded intervals are otherwise correct from the case's hand inputs.
Their expected fields pin counts, false findings, clean, per-example gate pass and
coverage/deltas. Deltas are reported minus truth; if either operand is null, delta
is null. The first summary for a known ordinal is matched; subsequent duplicates
and unknown ordinals are unexpected. Optional either bars are outside both flag
denominators; ineligible bars are negative in both. Summary errors alone create
no finding or new gate. `pools` list the failed pooled flag gates for those reports.

`requiredEvidence` independently marks examples, controls, pools, causality or cost
absent: that makes `passed` false before the state transition. State cases and run
plans exercise routines, first/later sweeps, reopening and restoring the full set.
Selection cases exercise fewer than3, every performed score even when absent from
the top3, invalid margins/IDs and missing evidence. `parentScoreCase` groups a
wrong-score control through its parent's performed score. Strings NaN/Infinity
represent nonfinite test inputs only; they are never expected answers.

`intervalMargins` applies (max(.1*expected,.03)-abs(error))/max(...), after the
ordinary interval gate: an outside-tolerance interval is failed evidence, not a
zero-ranked passing interval. `exampleMargins` expands synthetic fractions,
delays, interval errors, costs, gates and prefix checks into the existing margin
function. Unreached events contribute0. Failed binary evidence and zero answerable
time are refused, not ranked. Individual margin cases pin rejection, boundary0,
1e-12 clamping and rejection outside it. Retirement uses the last three evaluations,
including a longer history with an earlier failure.

## Coverage and procedural limits

Oracle4 covers every numeric/data rule added in instruments3 that audit3 found
uncovered. Historical oracle1/2 still covers unchanged following/note/control rules.
The suite record's required date, evidence, replacement, source hashes and baseline
policy are checked structurally in the recorded validation. Retired sentinels stay
in routine plans; a reopened substage's full set is attempted. All sets return in a
sweep; baseline records are cited by hash, and unchanged producers permit reuse.
These procedural checks use the historical record, rather than inventing listener
observations or claiming a new confirmation. No performance set retires here.

An independent session must audit oracle4, including every added/changed case and
at least one case per inherited rule, before any listener judgment by instruments3.
This experiment neither audits itself nor evaluates a listener. Stage2 remains open.
