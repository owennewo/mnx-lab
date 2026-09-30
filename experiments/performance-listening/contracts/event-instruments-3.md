# Event instruments, version 3 — other bars and the rising tide

2026-09-30, **Sol 6.1 (high) in Codex**, for [028](../reports/028-other-bars-suite.md). Frozen before implementation. Implements [development contract 2](development-contract-2.md); no numerical gate changes. Earlier versions retain their historical meanings. Oracle: `bench/oracle-events/oracle-3.json`, independently audited before any listener evaluation.

## Assessment

`performance-label@2` and `following-evaluator@2` are unchanged. `assessment-report@3` keeps report@2's notes, overall, intervals and flags, and adds `tempo.bars`: `{ ordinal, quartersPerMinute, reference, ratio, otherBars, eligible }[]`. These are informational estimates derived from the assessor's own reported intervals and score positions, never performance labels. `reference` and `ratio` may be null. No verdict is emitted for an ineligible bar. No new numerical gate judges these informational fields; evaluation reports coverage and errors for auditability.

`assessment-evaluator@3` keeps all note, overall, interval, control, and finding rules of version 2. It derives sounded-event intervals and overall/whole-piece typical tempo exactly as before. The whole-piece typical tempo remains informational.

For each score bar ordinal:

1. Assign each interval wholly to the bar of its **ending** sounded event, including an interval crossing a boundary or an omission. Bar tempo remains 60 times summed score distance divided by summed seconds.
2. Exclude **every interval ending in that bar** from its reference. Reference is version 2's score-distance-weighted median of the remaining local tempi, including the exact-half mean rule. Count distinct ending ordinals among these remaining intervals as `otherBars`. Count actual contributors, not score bars or intervals.
3. `eligible` requires a non-null local tempo/reference and **at least three other contributing bars**. With fewer, still report the available reference and ratio, but expect `none`: no slow/fast verdict is justified. No intervals gives local tempo/ratio null; no other intervals gives reference null.
4. On an eligible bar ratio r = local/reference, expect slow for r <= .90, fast for r >= 1.10, none for |r-1| < .05, and either in between. Boundaries are included as in version 2. A flag on an ineligible bar is a false alarm (negative for each direction); optional either bars remain excluded from both denominators. This prevents an abstention rule from licensing arbitrary flags.
5. Clean requires all notes matched, no extras, and no informative bar ratio outside the central none band (|r-1| < .05). Bars with null ratio cannot establish variation. Ineligibility alone does not turn a known varied example clean. Zero findings is still required on clean examples. Controls retain their own zero-claim gates and stay excluded from pools.

Reported bar summaries are matched by ordinal; duplicate/unknown ordinals are counted unexpected, omitted ordinals unreported. Local/reference/ratio errors are reported, without inventing new approved acceptance thresholds. Flag counts, not summary presence, feed the unchanged finding gates.

## stage-gates@2

Per-example cursor/assessment, pooled, causality and cost thresholds are exactly stage-gates@1's approved values. Version 3 evaluations have the same numeric fields those gate functions read. This version adds suite state/selection, not a gate relaxation.

A substage is `open`, `passed`, or `confirmed`. An attempted open substage moves to passed only when all its examples and controls, all earlier sentinels, pooled gates, causality and cost pass. A first passing full sweep establishes passed; a **later** full sweep confirms it. Routine passes preserve passed/confirmed. Any sentinel failure or full-sweep failure reopens its owning substage, even when it was not attempted. An unattempted open substage stays open. Missing required evidence is failure, never a pass. A successful routine evaluation does not confirm anything.

### Deterministic sentinels

Choose three **performances per substage**, globally, with the smallest minimum normalized headroom, then one silence and one wrong-score control per **performed score**, chosen the same way. For a control, performed score is its parent performance's score, not the unrelated handed score. Fail on duplicate IDs, nonfinite/negative margins, failed evidence, or missing performance/paired controls. Fewer than three performances means all. Ties resolve by ascending ASCII example ID; no randomness or manual preference. Selection is independent of input ordering.

Normalize a numerical gate's remaining headroom by its allowed error budget: onEvent `(fraction-.95)/.05`; ahead `(.01-fraction)/.01`; exposure `(.05-fraction)/.05`; episode `(.5-longest)/.5`; rejection `(fraction-.95)/.05`; overall `(.05-|error|)/.05`; each interval `(max(.1*expected,.03)-|errorSeconds|)/max(.1*expected,.03)`; event deadline `(.2-delay)/.2`; cost `(.25-ratio)/.25`, `(10-p99)/10`. Min over every applicable entry. Zero denominator follows the gates' failure rule. Binary completeness/clean/causality gates contribute 1 when passed, 0 when failed. No-positive pooled recall is inapplicable; pool-level gates must pass but do not rank individual examples. Deadline headroom is used even where the by-event fraction would allow an omission; an unreached event gives 0. Clamping numerical noise within 1e-12 to zero is allowed; larger negative values are failure. Margins rank examples, not new acceptance thresholds. The delay measure makes the existing event deadline visible when all event counts pass.

Freeze sentinels at pass; rechoose only at full sweep. A failing sentinel reopens rather than being replaced. The committed suite record pins originating summary/manifest/artifacts, listener and instrument versions, ID/margin choices, passed/confirmed provenance, open substages, baseline sweep policy, and retired sets. A bootstrap from existing passing evidence does not judge a listener using this new evaluator: keep the old verdict/version, and mark version-3 revalidation pending.

### Retirement and run plans

Routine plan = all examples of attempted open substages + frozen sentinels of passed/confirmed substages + their controls, deduplicated and sorted. A full sweep includes every set including retired sets and frozen baselines; unchanged producer/input records can be cited by hash. Retiring a set requires three successive passing incumbent evaluations **and** named harder active evidence exercising its capability. Keep its sentinels until that replacement retires/is replaced; reopening restores its full set. Retirement records date/evidence/replacement. Baselines are sweep-only by the explicit user direction; this is not the three-evaluation performance retirement rule.

No performance set is eligible to retire at 028: event-chain@2 has one evaluation. Existing passes are imported from g027a as instruments-2 evidence, none confirmed. Later bar-flag evidence must use the committed four-bar s3 and audited instruments 3; existing s1/s2 sets cannot positively test the new flag recall. Stage 2 stays incomplete. A full sweep is due at stage completion, new gate proposals, batch end, or by experiment 031 after 026's full comparison.
