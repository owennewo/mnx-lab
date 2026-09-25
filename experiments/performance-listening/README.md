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

The first real-audio development loop is complete. Open
[002 — Winner with sync interpolation](reports/002-winner-sync-proxy.html) for its
results and a link to private embedded playback with timing traces. Two causal
spectral followers were compared with the clock on the same four-bar Winner clip,
wrong-score probe and silence. Neither passes: control rejection improves, but
positive following regresses. Winner stays at four bars; positive Dust is next only
after Winner passes. No candidate is retained or microphone-qualified.

The user directed us to use `sync.json` with interpolation for this initial development
work. [That direction and the bounded plan](contracts/sync-proxy-development-1.md)
are recorded separately from the unchanged approved contract 1. Manual beat marking
is not a prerequisite for this approximate-development experiment. The next question
is to diagnose score-template discrimination at a supplied alignment before another
end-to-end tracking trial; see [the research log](RESEARCH_LOG.md).

[001 — Initial two-scale assessment](reports/001-initial-two-scale.html) remains the
frozen synthetic instrument check and approved R1 inventory. Its matching clock
predictions establish harness behavior, not listening. The separate uncertainty-aware
[v2 instrument](contracts/instrument-v2.md) remains available for independently bounded
labels and formal comparisons.

[Report names and regeneration](reports/README.md) explain the numbered HTML reports.
[The ledger](ledger.md) preserves each run; [evidence preparation](evidence/README.md)
records private source provenance. [The readiness page](reports/loop-readiness.html)
now points to the completed development loop and distinguishes later qualification.

Earlier work is retained in [archive/](archive/ARCHIVED.md) for reference when a
specific question calls for it.
