# Fused algorithm log

Living experiment index · implementation loop · started 2026-09-13.

**Aim:** improve one ongoing listener's accuracy without excessive processing demand or
decision delay. Techniques earn their place through measured contribution to the whole
listener. They may be combined, conditional, replaced or removed.

**Current state:** F-000 remains default. **F-003 is the preferred experimental candidate**:
neighbour competition removes most F-002 extra false attacks with minimal loss of correct
attacks and exact parent pitch coverage. It still fails the no-extra-accusations gate.
F-004 lower-harmonic competition is parked: one regression false attack removed, no new
held-out benefit. These two iterations stop here; octave attribution needs further evidence.
[Latest comparison](findings/fusion-harmonic-attribution-v1/README.md). Local budgets remain
25% extra processing and 25 ms pooled/common-match p95 increase; target device unselected.

Two agreed next experiments are **partial spectral whitening** and **flexible harmonic modelling**.
Both are unimplemented and untried; measure separately before trying a combination.

## Technique index

| Technique | Evidence / disposition | Current lesson or question |
|---|---|---|
| [Partial spectral whitening](fusion-techniques/spectral-whitening.md) | Agreed experiment; untried | Reduce timbre dependence through a smooth spectral envelope, with bounded gain |
| [Flexible harmonic model](fusion-techniques/flexible-harmonic-model.md) | Agreed experiment; untried | Tolerate weak fundamentals while preserving genuinely played higher notes |
| [Harmonic evidence](fusion-techniques/harmonic-evidence.md) | Measured baseline; candidate | Cheap, noisy attacks; retain as an analytical baseline |
| [Recorded templates](fusion-techniques/recorded-templates.md) | Measured baseline; parked for general use | Large timbre-transfer loss; reconsider for an explicit personalisation experiment |
| [Neural evidence](fusion-techniques/neural-evidence.md) | Measured offline baseline; candidate | Stronger attack recovery; current CPU path is slower than real time |
| [Temporal event tracking](fusion-techniques/temporal-events.md) | Implemented in DSP baselines; not isolated by ablation | Stable pitch presence does not establish re-strikes |
| [Attack and re-strike evidence](fusion-techniques/attack-restrike.md) | F-001…F-004 measured; revise | Exact coverage retained; additional octave errors still block acceptance |
| [Pitch attribution](fusion-techniques/pitch-attribution.md) | F-003 useful candidate; F-004 parked | Neighbour competition helps; lower-harmonic score competition adds little |
| [Confidence gating](fusion-techniques/confidence-gating.md) | Final-event threshold curves measured; live policy untried | Precision costs coverage; final confidence is not available at initial emission |
| [Selective extra analysis](fusion-techniques/selective-analysis.md) | Proposed; untried | Can additional evidence pay for itself only when needed? |

## Iteration log

Keep each entry to one line; detailed configurations, failed trials and results live in
technique documents. Entries record history, including removals; do not erase an earlier
failure when a later configuration works.

| ID / date | Change or experiment | Result / decision |
|---|---|---|
| FL-001 · 2026-09-13 | Retrospective: [reference-v1 separate pipelines](findings/README.md) | 714 measured outcomes, 204 unsupported neural-stream outcomes; technique histories below retain their exact scope |
| FL-002 · 2026-09-13 | Adopt fused-listener development direction | Optimise whole-system accuracy/cost; component comparisons become diagnostics; no combined run yet |
| FL-003 · 2026-09-13 | Start this log and structured technique records | Capture configurations and interactions so a bad setting is not mistaken for a bad technique |
| FL-004 · 2026-09-13 | [F-001 attack association: AR-001/002](fusion-techniques/attack-restrike.md) | 12 settings + locked held-out run; ~5% cost, improved repeats, unacceptable pitch/strum regressions. Revise; keep F-000 default |
| FL-005 · 2026-09-13 | [F-002 re-strike-only: AR-003/004](fusion-techniques/attack-restrike.md) | 132 regression + 36 fresh cases; exact parent coverage; repeat gains at ~5–6% cost, but +14/+9 false accusations. Revise pitch attribution |
| FL-006 · 2026-09-13 | [F-003 neighbour attribution: PA-001/002](fusion-techniques/pitch-attribution.md) | 168 regression + 42 fresh cases; removes 16/23 and 10/11 F-002 added false attacks; selected ratio 1, still revise |
| FL-007 · 2026-09-13 | [F-004 lower-harmonic competition: PA-003/004](fusion-techniques/pitch-attribution.md) | 210 regression + 42 fresh cases; one regression false removed, identical held-out TP/FP/FN; park and stop this batch |
| FL-008 · 2026-09-13 | Agree [whitening](fusion-techniques/spectral-whitening.md) and [flexible harmonic modelling](fusion-techniques/flexible-harmonic-model.md) experiments after private four-bar diagnosis | No implementation or trial yet; isolate each contribution, then consider combination; F-003 and defaults unchanged |

## Candidate next experiments

The two experiments above are agreed work. The remaining questions below are unscheduled ideas, not new roadmap proposals.

- Seek independent evidence for remaining octave attribution errors, preserving the F-002 pitch-coverage contract; consider conditional spectral-change scoring as an untried hypothesis.
- Isolate duplicate re-strike suppression on a played pitch if attribution alone is insufficient.
- Select a target device before treating the provisional local processing budget as a production budget.
- Test [confidence gating](fusion-techniques/confidence-gating.md) using evidence available at decision time.
- Investigate [neural runtime/decoding](fusion-techniques/neural-evidence.md) and
  [selective analysis](fusion-techniques/selective-analysis.md) if their marginal cost fits.

## Updating this log

Use the [technique document template](fusion-techniques/_template.md). A technique's
implementation, measured evidence and current disposition are separate facts. Never
label a whole family successful/failed based on one configuration.

For each iteration: record the parent recipe, component versions, exact configuration
and trigger policy; change one thing where practical; link the run and the relevant
technique trial IDs here. Measure with/without the component, and configuration sweeps
when justified. If several things change together, record that attribution is unresolved.

Keep a technique only when the observed accuracy benefit justifies its marginal processing
cost, tail latency and backlog on the target device. Track false detections, missed attacks
and unassessed events together; accepting fewer events is not free accuracy. If budgets or
evidence are missing, mark the decision provisional. Record removals as well as additions.

The existing fixtures are now regression evidence. Freeze new evaluation splits before
using them to choose parameters. Reuse pinned WAVs; regeneration is a new input version.
[Benchmark conventions and commands](README.md) remain the executable source of truth.
