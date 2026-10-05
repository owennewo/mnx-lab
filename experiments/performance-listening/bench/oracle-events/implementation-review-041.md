# Implementation review — experiment 041

2026-10-05. **GPT-6-Astra (high) in Codex**. Independent review under
[REVIEWING_AN_IMPLEMENTATION.md](../../REVIEWING_AN_IMPLEMENTATION.md), answering
question 38's native-adoption half. I did not write 041. This is neither an oracle
audit nor a numbered experiment, stage verdict or promotion.

**Summary: the native implementation and recorded musical evidence hold on the
checks below; the strict candidate-only timer scope does not hold because diagnostic
hashing and snapshot copying are inside it.** This is conservative contamination,
not evidence of an omitted listener cost or a failed cost/deadline comparison.
The next numbered experiment must resolve that attribution before claiming clean
candidate-only measurements. No original code, report, result or verdict is changed.

## Scope and method

Read the development contract, its challenger section and 2026-10-04 amendment,
observation seams 2–4, [audit 4's uncovered-rule table](audit-observation-seam-4.md#rules-i-could-not-exercise),
041's report, public summaries, native/state/chain/runner code, relevant tests and
cited private records. Reviewed corrected source
`g041a-challenger-incremental-neural-source` (`1549385f`) in a detached worktree;
compared the original `g041-challenger-incremental-neural-source` (`c196fe03`).
The source checkout had its own fresh `npm ci`. All review outputs went to
`/tmp/lab-review-041/`, never to `runs/` or either original private run directory.
No numbered runner was invoked, no new run ID was created, and no listener was tuned.

An independent Python reader verified source/artifact hashes, compared map bytes,
recomputed costs and both live/prefix clock recurrences, and compared prefix payloads
without calling the experiment's equality helper. A separate TypeScript reader
re-evaluated the saved decisions with the frozen following evaluator and gates; it
performed no inference. Native sample replays extracted the tagged `execute` body
unchanged into a scratch harness, with imports resolved to that checkout. The body
SHA-256 is `68618d22f3c1e25544a5645585b072a974d2a34c0da634e449b13903d39e0afa`.

## Check-by-check verdicts

### 1. Timers — does not hold for strict candidate-only scope

The corrected [runner](../src/challenger/run041.ts), lines 36–67 at the source tag,
starts setup before state/chain allocation, clones, score compilation in `chain.start`
and reset. Each feed timer begins before the bounded audio slice and includes
resampling, window construction, worker input/output copies, waiting, full DSP,
new neural computation, pitch reduction and chain transitions. Emission-free feeds
also count. The measured live finish is `StreamingInput3.finish`, an empty no-flush
operation; the separate offline assessment is explicitly reused, so omitting
`BasicPitchChain.finish`'s offline alignment here does not omit live work. Runner
stamping/serialization, disk writes, evaluation and whole-model reference inference
are outside service. Shared candidate load (0.201060380 s) and reference load
(0.149695182 s) are separately recorded; shared workers survive example reset.

However, line 50 computes SHA-256 of the 43,844-sample tensor **inside every one of
34,848 inference-bearing feed timers**. Line 56 copies that tensor and selected
indices into a parity snapshot **inside 702 measured calls**, before line 59 stops
the timer. These values are used only by later evidence/comparison code, not by the
listener. The snapshot is an in-memory evidence write even though the eventual file
write and reference inference are outside the timer. The report's candidate-only
attribution therefore is stronger than the implementation establishes.

All required listener work identified above is included once; I found no omitted
listener operation or reference inference charged to it. The defect adds diagnostic
work, so the recorded figures still show this instrumented path clearing the stated
thresholds on that host. It does not demonstrate an optimistic cost or lag bias.
The records contain no separate diagnostic durations, so they cannot establish the
exact listener-only work or justify subtracting an estimated correction. Resolve the
timer boundary in the next numbered experiment, preserving 041's evidence; do not
rewrite its elapsed services. This review neither changes a gate nor awards a stage.

### 2. Native normalization, context and slicing — holds

Rebuilt the derived ONNX model from the tagged builder into scratch. Its SHA-256 is
exactly `e286fa3337dbcfb7513b08d83e21d078b9cbd189b066b78b2e4e7c8189a1f91d`, matching
the retained graph. Compared both graphs: original nodes 0–212 are byte-identical;
the only changed original initializers are the three declared reshape constants;
all learned weights are identical; downstream nodes differ only by replacing the
normalized boundary input with the inserted slice. No inference value/cache is reused.

The native graph computes the square/epsilon/log-power sequence, reduces its minimum
and maximum across axes 1 and 2 (time and frequency), and completes normalization
before the slice after node 212. The frozen zero-divisor handling is retained. The
harmonic shifts/padding after that boundary act on frequency, not time. In the
original graph's convolution indices, temporal radii are:

- Contour: nodes 231 and 233, radii 1 + 2 = **3**.
- Note: contour followed by nodes 238 and 240, 3 + 3 + 3 = **9**.
- Onset: maximum of the note branch (9) and direct branch at node 230 (2),
  followed by node 245 (1), giving **10**.

Temporal strides/dilations are one; pointwise operations and the channel
concatenation add no radius. `begin=max(0,min(indices)-10)` therefore retains the
required left context. The crop always ends at original frame 172, retaining all
available right context and the original right padding. Clipping at zero retains
the original left boundary. Only requested indices are reduced/emitted; the first
ten context frames of an ordinary 19-frame crop are suppressed. This independently
supports the dependency claim; toy normalization cases are not used as native proof.

### 3. Equivalence claims and coverage — holds, within the stated sampled claim

Verified all **702** retained same-tensor comparisons over **234** unique audio hashes:
all three maps have the correct float32 byte lengths, and all **2,779,920** selected
values are byte-identical, not merely within 1e-6. The diagnostic tolerance conceals
no discrepancy in these records. Inputs are 43,844 float32 samples; reference maps
are 172×88/88/264 and crop maps have the recorded shorter time dimension.

Re-executed four examples, sharing the model across fresh example state, and compared
**every** inference window with the frozen whole model, rather than just the original
first/middle/last sample. All **215 windows / 851,400 selected values** are exactly
equal; every input-tensor hash and ordered live payload reproduces its recorded
counterpart. This exercises clip start padding, last eligible inference, ordinary
window boundaries, ring eviction, note attacks, a long silent hesitation, quiet
noise, and consecutive-example reset. It does not claim exhaustive equivalence over
arbitrary audio or newly introduce native irregular-delivery evidence; the graph
argument supplies the context rationale that sparse first/middle/last checks alone
could not establish.

### 4. Causality and prefix checks — holds

The live loop copies only `audio.slice(from,until)` into `feed`. The streaming kernel
generates an interpolated sample only when both global source indices exist, retains
the needed neighbor and bounded chronological ring, and constructs only the current
window. The native worker receives that tensor and crop start; neither score, labels,
future audio nor completion time reaches it. The score reaches only the chain.

Independently compared all **3,456** recorded replay payloads against their original
prefixes, selecting by emitting delivery index and excluding only the documented
wall-time fields. They agree. The original replays alter the backing buffer's future
then pass `future.subarray(0,cutoff)` to the same live function; each feed further
copies its bounded chunk. Thus they exercise real native processing of a bounded
view, not two full-length altered-future executions. The zero/alternating tail values
cannot enter the listener through those copies. This scope is adequate in conjunction
with the inspected access path, but six comparisons per example are not six distinct
future exposures to the backend.

For additional direct coverage, the four scratch examples each ran to the end with
both entire modified futures supplied to `execute`, at a half-duration chunk-aligned
cutoff. All **eight** common-prefix comparisons agree. These are sample checks, not
another full experiment or a replacement cost measurement.

### 5. Delivery/completion clocks and numerical results — holds

`chain.feed(chunk,deliveryAt)` and `chain.observe({...frame,availableAt:deliveryAt})`
use delivery time for support/transition logic and `refersTo`. Only after the measured
call does the runner set every frame's `availableAt` and decision's `madeAt` to
`max(deliveryAt,previousCompletion)+elapsed`. It never feeds that later completion
back into the chain as delivered audio. The evaluator uses madeAt for live decisions
and distinguishing onset for delay. No backdating or audio-time shift was found.

Recomputed **352,008** live and **1,057,248** prefix setup/feed/finish recurrences,
including owned frame/decision stamps and nonnegative finite services. Checked
**313,632** live frame coordinates and strict watermark order. Re-evaluation of all
576 saved decision records reproduces their complete following evaluations and gate
objects exactly, including **1,152** reached performance events and every control.
The independently summed figures reproduce the report:

| Figure | Recomputed value |
|---|---:|
| Work / audio | 548.517701111 s / 3506.493 s |
| Weighted work/audio | 0.156429145 |
| Example cost min / median / max | 0.136080815 / 0.152664876 / 0.235509211 |
| Event delay median / p95 / p99 / max | 110.214110 / 149.501835 / 153.573094 / 156.323971 ms |

These are the measured instrumented-path clocks, with check 1's conservative
contamination. They are not microphone, audio-driver, UI, cold-start or target-device
latencies. Replayed wall times vary and are not substituted for the recorded ones.

### 6. Provenance and reuse — holds

All **378** corrected-summary source hashes match the source-tag checkout. Verified
**11,958 distinct artifact paths** in the review's evidence traversal, including the
retained validation inventory, all live/prefix/case/parity artifacts, model and graph,
input audio/scores, and reused offline masked/raw/decoded evidence. The original and
corrected public summaries match the report's SHA-256 values. Absolute paths into
041's retired worktree were relocated to the same repository-relative file in the
source checkout (or the committed run summary in main), then verified by hash;
private evidence paths were read in place.

Relevant 039 and 036 producer/adapter/model/audio source hashes match the corrected
checkout; 038's cited control records also verify. All 576 reused assessment labels
hash identically, and their recorded assessment gates are clear. The external
`guitar-nn` commit/clean state, lock/config, installed package versions and official
source hashes verify against the retained identity/validation. The rebuilt graph
matches as above. Comparing the two 041 source tags confirms the reported timer,
validation, grouping and type-annotation repair, with no neural/weight/policy change.
This checks accessible recorded provenance, not an independent attestation of the
historical host's wall timer.

### 7. Pinned HQ resampler, decoder and offline physical representation — holds

Inspected the unchanged official-inference and dominant-pitch adapter paths. Whole-clip
loading uses the pinned float32 mono 22,050 Hz `soxr_hq` path; native live linear
interpolation is not mislabeled as HQ parity. Official windowing/stitching and endpoint
times are retained. The @2 mask retains the frame-local strongest note/onset bin,
lowest bin on ties, preserves contour, and then calls the official decoder with
onset .5, frame .3, minimum 11 frames, inferred onsets and Melodia. No score or label
filters those observations.

For `martin-h-s2-90-2000` and `noise-tonejs-acoustic-s1-45`, re-executed the pinned
whole-clip inference, the tagged dominant mask and official decoding. Original raw
and masked note/onset/contour arrays reproduce **byte-for-byte**; decoded event JSON
also reproduces exactly (630 frames / eight events, and 458 frames / three events).
The noise events illustrate why uncertainty/noise is not universal silence detection.
No fresh offline-cost claim follows from these diagnostic replays or 041's reuse.

### 8. Frozen listener behavior and scope — holds

The unchanged chain refuses non-monophonic scores, written dead notes and adjacent
identical pitches. Inspection confirms three agreeing frames before pitch transition,
the inherited stay/skip costs, and holding through a null-pitch observation. Null
reduction is not converted to a decoded pitchless onset or a dead-note assertion.
Existing focused tests `challenger-035`, `challenger-039` and `observation-seam-4`
pass: **three files, six tests**, the seam tests checking all their frozen cases.
This is implementation validation, not a new independent hand-oracle audit. The
sample's long hesitation and controls exercise the existing behavior; no chord,
dead-note, repeated-pitch, held-out, qualification or promotion capability is inferred.

## Sample selection and scratch evidence

| Example | Why selected | Windows | Live frames / decisions |
|---|---|---:|---:|
| tonejs-acoustic-s1-45 | Slow clean score, initial acquisition and all attacks | 53 | 477 / 5 |
| martin-h-s2-90-2000 | Longer score and longest frozen silent hesitation; offline repair source | 73 | 657 / 12 |
| fender-w2-h-s1-90-1000 | Highest recorded cost example and wrong-score rejection | 36 | 324 / 1 |
| noise-tonejs-acoustic-s1-45 | Quiet-noise negative control with native low-pitch activity | 53 | 477 / 1 |

Scratch replays capture every window for comparison, so their wall times intentionally
include more diagnostics than 041 and are not new gate evidence. Output paths below
are scratch, not a permanent run record; this review preserves the methods and results.

| Scratch result under `/tmp/lab-review-041/` | SHA-256 |
|---|---|
| `verification.json` | `761fe1fc856fafc79cc89ce3adb1334b04d6c1e9ec02d83438fddf301ce5ce73` |
| `sample-results.json` | `15c47b7aa67fcfe260a014c79aec7f2edfed148c75aaf0cbe393ab87d1603be7` |
| `offline-results.json` | `d0f0ca76d35df7f595d2e1d2ef6c931ae7711836ee3d5db3e4d9eb7ece666356` |
| `reevaluation.json` | `86f44fc4e6ef5a273b0532b6ce949f9c5be9ea6cc7041eae8a368c21974fdd75` |

The detached replay worktree was removed after these checks. The two missing scalar
case obligations remain with 042 and its independent auditor; this review does not
replace them. Question 38's native review is answered, with the narrow timer finding
carried as the new top question. Only this review and the research log are changed;
no ledger row is added. Land through the repository gate and retire the review
worktree, then stop.
