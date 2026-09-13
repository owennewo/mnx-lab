# Performance listening bench

Implementation-loop experiment for future Studio tracking, assessment and guitar control.
This unit measures detection on digitally rendered player audio. It neither listens to a
microphone nor claims to grade a real performer. Production cannot import it.

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
overwrite an existing directory. To create a new version:

```bash
npm --prefix experiments/performance-listening run render -- /absolute/path/audio-v2
npm --prefix experiments/performance-listening run compare -- /absolute/path/audio-v2 /absolute/path/run-v2
npm --prefix experiments/performance-listening run inspect -- /absolute/path/run-v2
```

A quick adapter check can use `compare -- AUDIO RUN --limit=2`. The limit is recorded;
that subset is not the reference comparison. Whole-file neural CPU inference takes several
minutes for the full matrix. No paid service, native TensorFlow binary or model download
is used: the pinned Basic Pitch npm distribution includes its model weights.

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
inference/postprocessing time. Startup/model load and dictionary construction are reported
separately where measured, and excluded from steady-state compute.

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
- Latency only covers successfully matched attacks, so always read it with recall.
  Available time and emitted time are retained separately from estimated musical time.
- Scores are uncalibrated coefficients/activations. Score bins expose empirical hit rates;
  threshold curves report retained detections, precision and recall. They do not claim
  calibrated probabilities or that discarded target notes were assessed.
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
aggregates by strategy, mode, preset and case category. Changed or corrupted audio refuses
comparison. A partially failed run remains inspectable and exits nonzero; missing strategy
support is explicit.

The exact npm dependency tree is locked here, separate from root dependencies. Input
manifests and compact measured reports are committed under `findings/`; bulky audio and
full runs live under ignored `output/`. Preserve an output directory to reproduce identical
PCM. Re-rendering may differ across browser/codec/platform versions: verify hashes rather
than assuming equivalence. A new render is a new input version.

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
