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

The latest completed experiment is
[003 — Recognition at supplied sync](reports/003-recognition-at-sync.html).
Giving the existing spectral representations the approximate position still leaves
weak positive recognition and frequent ties with nearby wrong positions. A scalar
confidence cutoff cannot separate these cases reliably. The next hypothesis is to
use attack-sensitive features and short sequence evidence; no new listener was tried
in this diagnostic.

[002 — Winner with sync interpolation](reports/002-winner-sync-proxy.html) preserves
the preceding two failed end-to-end candidates. Winner stays at four bars; positive
Dust is next only after Winner passes. No candidate is retained or microphone-qualified.
Both reports link to private embedded playback with their saved traces.

The user directed us to use `sync.json` with interpolation for initial development.
[That direction](contracts/sync-proxy-development-1.md) and the subsequently authorized
[diagnostic plan](contracts/recognition-diagnostic-1.md) are recorded separately from
the unchanged approved contract 1. Manual beat marking is not a prerequisite for this
approximate-development work. [The research log](RESEARCH_LOG.md) records current
findings and the next question.

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
