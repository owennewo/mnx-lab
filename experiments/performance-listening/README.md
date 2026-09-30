# Performance listening

Develop a listener that receives an intended MNX score and hears a performance of it,
for Studio. It has two outputs, judged separately: a **live cursor** that shows the
player which chord or note they are on, and an **end-of-piece assessment** of their
tempo variation and of every note. Progress is made first on synthesized
performances, from the simplest score and a perfect performance, adding one deviation
at a time. Studio integration is subject to its own acceptance criteria.

**Start with [the research log](RESEARCH_LOG.md).** It is the only document that
states what the experiment currently believes, on what evidence, and what it asks
next. This README does not repeat it.

Experiments are run one at a time, each by one model from pre-registration to landed
record; a different model may run the next. [APPROACH.md](APPROACH.md#who-runs-an-experiment-one-model-one-experiment)
describes the handover, and [RUNNING_AN_EXPERIMENT.md](RUNNING_AN_EXPERIMENT.md) is the
prompt to give the model that runs the next one.

Then read, in this order:

1. [APPROACH.md](APPROACH.md) defines the objectives, evidence requirements,
   evaluation principles and rules for the research loop.
2. [EXPERIMENT_HARNESS_STRUCTURE.md](EXPERIMENT_HARNESS_STRUCTURE.md) defines the
   contracts, components and responsibilities that implement that approach.
3. [Development contract 2](contracts/development-contract-2.md) governs development:
   the two outputs, the start-simple progression, the categories and the instruments.
4. [Research contract 1](contracts/research-contract-1.md) governs qualification:
   reserved evidence, retention and final acceptance.

Records:

- [The ledger](ledger.md) holds one append-only row per run.
- [The report index](reports/README.md) lists the numbered experiments and how to
  rebuild their readable pages.
- [Evidence preparation](evidence/README.md) records private real-source provenance.
- [Research notes](research/README.md) hold one note per source read.
- [SEAM.md](SEAM.md) plans where the listener meets Studio. Part 1 is done: `listen/`
  holds the [version-2 listener contract](contracts/vocabulary-v2.md) and the backend
  Studio will drive. Part 2, promotion into
  `src/`, waits for the owner.
- [archive/ladder-1/](archive/ladder-1/README.md) holds the first series, experiments
  001–021 under [development contract 1](contracts/development-contract-1.md), with its
  own log, ledger, reports and runs. Its lessons are in the research log.
- [archive/](archive/ARCHIVED.md) also keeps the experiment before that, for reference
  when a specific question calls for it.
