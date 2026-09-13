# <Technique name>

[Back to fusion log](../fusion-log.md)

- **ID:** <stable filename/id; use it in trial and recipe records>
- **Role:** <acoustic evidence / temporal tracking / musical events / fusion policy>
- **Implementation:** <proposed / implemented; source link>
- **Evidence:** <untried / measured standalone or in a pipeline / ablation-tested>
- **Disposition:** <candidate / adopted in named recipe / reference-only / parked / removed>

## Purpose and fit

State the problem and why this could improve the listener. Describe inputs and outputs,
where it sits, what consumes its output, and what it replaces or complements. Name
required upstream/downstream techniques, ordering assumptions and incompatible settings.
Do not assume two agreeing detectors supply independent evidence.

## Configuration

| Parameter | Units / allowed values | Availability | Tried value(s) / proposed range | Why it matters / interactions |
|---|---|---|---|---|
| <name> | <units, bounds> | <existing config key / fixed in code / proposed knob> | <exact values or explicitly unchosen> | <effect and dependencies> |

Distinguish implemented knobs from ideas. Link the immutable run configuration; a mutable
current config file is only a navigation aid. Include model/template versions and shared
frontend/event settings. Explain which combinations are required for the technique to work.

## Timing and cost contract

Record frame/window/context sizes, required future audio, invocation rate/trigger,
state carried between chunks, reset behaviour, provisional versus final output, and
fallback when evidence or compute is unavailable. Distinguish event time, evidence
availability and actual decision emission. Record target hardware, runtime, startup versus
steady-state processing, tail latency/backlog and the budget used for acceptance. Use
"unmeasured" where appropriate; no guessed CPU savings.

## Trial history

One row per configuration tested; retain negative/inconclusive outcomes. Use stable IDs
such as `<technique>-001`; expand only trials whose detail cannot fit in a row.

| Trial / date | Parent recipe + exact configuration | Input/evaluation identity | Observation: accuracy AND cost | Decision / scope / evidence |
|---|---|---|---|---|
| <id> | <recipe, enabled components, ordering, triggers, model/code hash, settings> | <audio/run hash, split, evaluator version/tolerances> | <counts/deltas, precision/recall/unassessed, latency, processing/backlog> | <keep/revise/remove/inconclusive; links> |

A linked archived manifest may supply shared details; do not duplicate large run data.
For sweeps, record every tried setting in a linked artifact and summarise the useful
region here. Compare against the same parent recipe/input/evaluator/hardware. Report
whether measured gains isolate this technique or also include other changes. Final-event
confidence must not be paired with an earlier latency as a live acceptance claim.

## What works, what does not, what is unknown

State bounded conclusions: configuration, context and conditions. Distinguish a measured
failure from an unimplemented feature or an untested hypothesis. Explain parameter
sensitivity and interactions. Do not promote a tested setting to a universal default.

## Next experiment and acceptance question

Name the smallest useful change, parameter sweep or removal test; required control;
held-out cases; accuracy improvement sought; processing/latency budget; and stop condition.
An idea remains untried until a linked run exists. Budgets may be unchosen now but must
be settled before claiming an accepted fused configuration.
