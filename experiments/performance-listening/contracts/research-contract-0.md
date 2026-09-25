Version 0; PROVISIONAL, NOT HUMAN-APPROVED. Never frozen by item G.

# Provisional research contract (`contracts/research-contract-0.md`)

Provisional because no comparison happens in this step; the first contract of the
milestone that governs a retain-or-reject decision is a separate, human-approved
document. This one exists so the other pieces have numbers to be built against:

- **Capability**: supported following at the harness profile; a known start; zero
  tempo freedom (the tempo handed is the tempo played), so t1 is a probe and not a
  capability claim.
- **Tolerances**: position ±0.25 quarter; detection allowance 150 ms; pitch and onset
  tolerances reserved (±50 cents, ±50 ms) and unused.
- **Delivery conditions**: 48 kHz mono, chunks of 480 samples (10 ms), released on a
  clock the runner controls.
- **Decision deadline**: 200 ms after the audio time a decision refers to.
- **Device and budget**: the development machine, named in the run record with its
  CPU; sustained processing ≤ 25 % of real time, p99 per-chunk processing ≤ 10 ms.
  Provisional until Studio names its device, and every cost result is marked so.
- **Evidence**: `harness-v1`, all development.
- **Comparator**: none yet; the clock follower is the floor.
- **Budget for this step**: no candidate trials beyond the floor; web research is
  bounded to the two questions in §10.


Related: [vocabulary](vocabulary.md), [golden format](golden-format.md),
[counting rules](evaluator-rules.md), [provisional research contract](research-contract-0.md).
