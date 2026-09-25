# Performance listening

Develop a causal listener that receives an intended MNX score and follows a
performance from audio, reporting supported positions, discrepancies and uncertainty.
The first milestone is supported following; detailed note assessment comes later.
The eventual destination is Studio, with integration subject to its own acceptance
criteria.

Two documents govern the work. Read them in this order:

1. [APPROACH.md](APPROACH.md) defines the objectives, evidence requirements,
   evaluation principles and rules for the research loop.
2. [EXPERIMENT_HARNESS_STRUCTURE.md](EXPERIMENT_HARNESS_STRUCTURE.md) defines the
   contracts, components, responsibilities and construction order that implement
   that approach.

Implementation is the next phase, planned in [FIRST_STEP.md](FIRST_STEP.md). Start
with the assessment vocabulary, golden format and evaluator counting rules, then
prove the evaluator against hand-worked oracle
cases and render the first report. A frozen synthetic set, chunked audio runner and
trivial clock follower establish the first end-to-end pipeline. Its result should
show that the instrument measures both correct following and false claims of
following. Real-source preparation begins alongside the pipeline; audio-driven
candidates and retention comparisons follow under an approved research contract.

The first-step plan supplies the concrete work items and completion checks.
[RESEARCH_LOG.md](RESEARCH_LOG.md) is where the experiment's current state lives: what
is believed, on what evidence, and which question comes next. Read it before any
ledger row or report, and read a report only when the log points you at it.

Earlier work is retained in [archive/](archive/ARCHIVED.md) for reference when a
specific question calls for it.
