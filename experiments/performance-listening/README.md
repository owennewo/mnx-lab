# Performance listening bench

Implementation-loop experiment for future Studio tracking, assessment and guitar control.
This unit measures detection on digitally rendered player audio. It neither listens to a
microphone nor claims to grade a real performer. Production cannot import it.

The [fused algorithm log](fusion-log.md) is the living index of techniques, configurations
tried, decisions and possible next experiments. Detailed records use the
[technique template](fusion-techniques/_template.md). The bench includes separate detector baselines and an optional fused attack experiment;
no fused configuration has been adopted as the default.

## Run

Requires Node >=22.12, the root development dependencies, and installed Chrome
(`CHROME_BIN=/absolute/path/to/chrome` overrides discovery). From the repository root:

```bash
npm ci
npm --prefix experiments/performance-listening ci
npm --prefix experiments/performance-listening test
npm --prefix experiments/performance-listening run check:boundaries
npm --prefix experiments/performance-listening run render
npm --prefix experiments/performance-listening run compare
npm --prefix experiments/performance-listening run inspect
```

Open the printed localhost URL. Choose a sound/case/strategy/mode, listen, inspect the
piano roll, and jump to the first unmatched attack. The inspector is read-only and serves
only its selected run and recording files. Nothing is deployed.

Rendering creates `output/audio-v1`; comparison creates `output/run-v1`. Both refuse to
overwrite an existing directory. npm runs these scripts from the bench directory;
use absolute paths for explicit input/output arguments. To create a new version:

```bash
npm --prefix experiments/performance-listening run render -- /absolute/path/audio-v2
npm --prefix experiments/performance-listening run compare -- /absolute/path/audio-v2 /absolute/path/run-v2
npm --prefix experiments/performance-listening run inspect -- /absolute/path/run-v2
```

A quick adapter check can use `compare -- AUDIO RUN --limit=2`. The limit is recorded;
that subset is not the reference comparison. Whole-file neural CPU inference takes several
minutes for the full matrix. No paid service, native TensorFlow binary or model download
is used: the pinned Basic Pitch npm distribution includes its model weights.

## First fused iteration

The [F-001 protocol](experiments/fusion-attack-protocol.md) freezes a 12-setting attack
sweep around the unchanged harmonic parent. From the bench directory, with original
`output/audio-v1` and `output/run-v1/results.json` preserved:

```bash
node rendering/render.mjs output/audio-fusion-heldout-v1 --fusion-heldout
npm run fusion:attack -- output/fusion-attack-v1
npm run fusion:export -- output/fusion-attack-v1 findings/fusion-attack-v1
```

All three commands refuse existing destinations. Set `FUSION_PARENT_RESULTS` to an
absolute archived baseline results path if it lives elsewhere. The runner checks all
102 parent musical outputs and decision samples against that archive. It measures three
counterbalanced processing passes, writes a selection lock, then evaluates only the
locked candidate and parent on held-out audio. The held-out set tests new schedules and
pitches using existing sample packs; it is not an unseen-instrument or microphone test.
After the first run, keep both audio directories for later ablations; rerendering creates
a new input version. Use a fresh run/export destination for every subsequent run.

Full `development-results.json` / `heldout-results.json` retain events and evaluator
outputs. To use the existing inspector, copy one split file into a fresh directory named
`results.json`, updating `audioDirectory` to its relative audio path. The committed export
retains all configuration summaries and parent/selected per-case evidence; ignored full
outputs retain all settings. Read the [fusion log](fusion-log.md) for the decision.

## What is independent

`rendering/browser.mjs` imports the production NativeSink and sample loader. A supplied
OfflineAudioContext renders the real sample path; the adapter counts buffer sources and
checks silence, nonzero output and clipping. Three sample packs are evaluated: archtop
(the template source), held-out nylon, and held-out upright piano. The bench does not
implement its own synthesizer. Sound decoding is shared across contexts, while each
fixture gets a fresh sink and deterministic attack counter.

`fixtures/cases.mjs` supplies explicit schedules, including errors. A separate two-note
MNX example passes through the performance compiler and is checked against an independently
specified 120 BPM schedule. This checks the adapter, not the compiler's general musical
correctness. Those responsibilities remain with the existing corpus.

Actual events, target events and recorded PCM remain separate. Acoustic detectors receive
only PCM and fixed configurations. Templates receive only the isolated training recordings.
No detector sees target labels, actual labels, fixture ids or the mutation recipe.

All configurations were fixed before the reference evaluation; v1 is an intentionally
simple baseline, not tuned for the test set. There are no random variations in v1 (`seed=0`).
After reviewing these findings, these cases are a regression set, not an unseen test set.
Future tuning needs newly held-out fixtures/sounds for independent transfer claims.

## Detector contracts

- **Harmonic:** Hann-window FFT magnitudes; 12 harmonics weighted 1/h, a Gaussian bin
  kernel, greedy matching pursuit capped at six pitches. An interpretable baseline;
  no trained parameters.
- **Template:** mean isolated archtop spectra over .45–.75 seconds, unit-norm columns,
  fixed-iteration nonnegative coordinate descent. Same-source and held-out results
  are labelled separately by preset. It is not trained on test chords.
- **Neural:** Basic Pitch 1.0.1 on TensorFlow.js CPU, model/weight hashes recorded.
  Uses upstream note decoding, fixed onset/frame thresholds, no confidence calibration.
  The adapter is whole-file only. Every requested neural stream mode is explicitly
  `unavailable`, with a reason; it is never counted as zero accuracy or live-ready.

Both DSP baselines share an activity gate and event grouping, with two qualifying frames
and no separate re-strike onset detector. This is a known limit on repeated notes, not a
claim that the spectral family cannot recognise them. All pitches MIDI 40–88 are searched;
Basic Pitch emits its native range, and out-of-range false positives still count.

StreamingDetector owns a ring buffer and receives only chunks, never the original file.
A 4096-sample trailing window at 22050 Hz spans 185.8 ms; frames arrive every 256 samples.
Event positions use the window centre. Availability uses the full input chunk end;
simulated delivery additionally includes measured serial compute and carried backlog.
Chunk sizes 256 and 2048 compare buffering delay. Whole-file DSP uses the identical
algorithm but withholds all decisions until the whole file arrives. No end padding is
invented; the recording includes release tail. Timing uses audio samples, not timer sleeps.

These replay measurements are algorithmic availability plus measured compute on the
recorded machine. They exclude microphone, browser scheduling and display latency, and
do not establish browser real-time performance. Neural latency is whole-file wait plus
inference/postprocessing time. Startup/model load and dictionary construction are excluded from steady-state compute
and are not benchmarked in v1. The output field `cpuMs` is wall-clock elapsed processing
time, including GC and runtime overhead, not operating-system CPU accounting.

## Evaluation conventions

- One-to-one maximum-cardinality attack matching: pitch within 0.5 semitone, onset
  within 100 ms (inclusive). Duplicate detections create false positives. Simultaneous
  unison voices collapse to one observable pitch attack; string completeness is unknown.
- Active-pitch sets sampled every 20 ms, including bends' continuous expected pitch.
  Silence has its own false-active-frame count. Exact chord recovery is the fraction of
  **active** frames with the complete pitch set; silence cannot inflate it.
- Scheduled release is the reference for release error; sample attacks and tails need
  not match it exactly. Release error is reported separately from attack matching. The
  audible envelope has no human-labelled ground truth yet.
- Raw counts accompany precision/recall/F1. Undefined ratios are `null`, not perfect
  scores. Category, preset and instantaneous pitch-count breakdowns expose weak cases.
- Quantiles use the sorted observation at `floor(q * (n - 1))`; small per-case
  populations have coarse quantiles. Aggregate latency pools matched attacks.
- Latency only covers successfully matched attacks, so always read it with recall.
  Available time and emitted time are retained separately from estimated musical time.
- Scores are uncalibrated coefficients/activations. Score bins expose empirical hit rates;
  threshold curves report retained detections, precision and recall. They do not claim
  calibrated probabilities or that discarded target notes were assessed. These curves
  use finalized event peak scores (DSP) or mean activations (neural), which may require
  later audio than the initial attack decision. Do not combine threshold-filtered
  precision with the unfiltered first-emission latency as a live acceptance guarantee.
  Event ends and peak scores can grow with subsequent chunks; initial pitch, start and
  decision-sample records do not change.
- The conservative assessment probe only accuses unexpected observed attacks. A target
  attack without a match stays unassessed. Known missing-target errors are counted as
  such in ground truth but this policy cannot diagnose them. Wrong substitutions can
  create an unexpected attack and an absent target. No overall player grade is produced.

Evaluator tests independently cover duplicates, silence, octave errors, tolerance edges,
ambiguous bipartite matching, abstention and accusations. Detector tests cover a known
sinusoid and causal-prefix/chunk-boundary invariance. They are not an accuracy threshold
on the experimental detectors: disappointing measured accuracy remains a valid result.

## Artifacts and provenance

`manifest.json` pins audio and fixture hashes, sample files, source-pack attribution,
Chrome version and renderer source hashes. `results.json` retains actual/target labels,
predictions, metrics, unavailable/failed outcomes and the input manifest. `summary.json`
aggregates by strategy, mode, preset and case category. `npm --prefix
experiments/performance-listening run report -- RUN NEW_REFERENCE_DIRECTORY` creates a
compact reference export with pitch-range, relative-level and confidence breakdowns;
it refuses to overwrite the committed reference directory. Changed or corrupted audio refuses
comparison. A partially failed run remains inspectable and exits nonzero; missing strategy
support is explicit.

The exact npm dependency tree is locked here, separate from root dependencies. Input
manifests and compact measured reports are committed under `findings/`; bulky audio and
full runs live under ignored `output/`. Preserve an output directory to reproduce identical
PCM. Re-rendering may differ across browser/codec/platform versions: verify hashes rather
than assuming equivalence. A new render is a new input version. The initial repeat-render check found 28/151
polyphonic recordings differed at floating-point roundoff scale even with the same
Chrome and renderer source. Preserve the original WAVs for exact input identity.
Compare two generated sets without changing either:

```bash
npm --prefix experiments/performance-listening run compare:renders -- AUDIO_A AUDIO_B NEW_REPORT.json
```

Sample pack licenses and origins are retained from `public/samples/*/manifest.json` and
in the audio manifest. Basic Pitch/model distribution: Apache-2.0; TensorFlow.js: Apache-2.0;
fft.js and Puppeteer: MIT/Apache-2.0 respectively (see installed licenses). No third-party
source or weights are copied into this repository.

## Boundaries and next decisions

Root dependency-cruiser forbids production imports of experiments and restricts this bench
to audio/model. The bench's boundary command includes its own graph in addition to root
sources. It has no dependency on Studio, elements, workbench, Worker, storage or corpus
status writers. No existing production package dependency or audio implementation changes.

Read `findings/README.md` for measured capabilities and the next experiment justified by
evidence. Score-informed following, real recordings, microphone capture, command gestures
and production promotion need a subsequent decision; they are not implemented here.
