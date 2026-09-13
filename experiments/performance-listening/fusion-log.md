# Fused algorithm log

Living experiment index · implementation loop · started 2026-09-13.

**Aim:** improve one ongoing listener's accuracy without excessive processing demand or
decision delay. Techniques earn their place through measured contribution to the whole
listener. They may be combined, conditional, replaced or removed.

**Current state:** no fused implementation or selected fusion recipe yet. The existing
bench measures three separate detector pipelines. Those runs are starting evidence, not
proof that combining them improves accuracy. Historical technique entries refer to that
same reference run, not newly executed experiments or isolated component gains. CPU/latency budgets and target devices for
accepting a fused version remain to be chosen and recorded before its acceptance run.

## Technique index

| Technique | Evidence / disposition | Current lesson or question |
|---|---|---|
| [Harmonic evidence](fusion-techniques/harmonic-evidence.md) | Measured baseline; candidate | Cheap, noisy attacks; retain as an analytical baseline |
| [Recorded templates](fusion-techniques/recorded-templates.md) | Measured baseline; parked for general use | Large timbre-transfer loss; reconsider for an explicit personalisation experiment |
| [Neural evidence](fusion-techniques/neural-evidence.md) | Measured offline baseline; candidate | Stronger attack recovery; current CPU path is slower than real time |
| [Temporal event tracking](fusion-techniques/temporal-events.md) | Implemented in DSP baselines; not isolated by ablation | Stable pitch presence does not establish re-strikes |
| [Attack and re-strike evidence](fusion-techniques/attack-restrike.md) | Proposed; untried | First candidate question: distinguish new strikes from resonance |
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

## Candidate next experiments

These are questions, not scheduled work or new roadmap proposals.

- Establish an explicit fusion recipe and target-device budget; measure its unchanged baseline.
- Add [attack/re-strike evidence](fusion-techniques/attack-restrike.md), holding the pitch estimator fixed.
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
