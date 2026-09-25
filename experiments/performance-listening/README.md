# Performance listening

Develop a causal listener that receives an intended MNX score and follows a
performance from audio, reporting supported positions, discrepancies and uncertainty.
The first milestone is supported following; detailed note assessment comes later.
The eventual destination is Studio, with integration subject to its own acceptance
criteria.

**Start with [the research log](RESEARCH_LOG.md).** It is the only document that
states what the experiment currently believes, on what evidence, and what it asks
next. This README does not repeat it.

Then read, in this order:

1. [APPROACH.md](APPROACH.md) defines the objectives, evidence requirements,
   evaluation principles and rules for the research loop.
2. [EXPERIMENT_HARNESS_STRUCTURE.md](EXPERIMENT_HARNESS_STRUCTURE.md) defines the
   contracts, components and responsibilities that implement that approach.
3. [Development contract 1](contracts/development-contract-1.md) governs how the loop
   develops candidates: the synthetic ladder, the scoreboard and when real audio returns.
4. [Research contract 1](contracts/research-contract-1.md) governs qualification:
   reserved evidence, retention and final acceptance.

Records:

- [The ledger](ledger.md) holds one append-only row per run.
- [The report index](reports/README.md) lists the numbered experiments and how to
  rebuild their readable pages.
- [Evidence preparation](evidence/README.md) records private real-source provenance.
- [Research notes](research/README.md) hold one note per source read.
- [FIRST_STEP.md](FIRST_STEP.md) is the completed plan that built the contracts,
  instrument and pipeline.
- [archive/](archive/ARCHIVED.md) keeps the earlier experiment for reference when a
  specific question calls for it.
