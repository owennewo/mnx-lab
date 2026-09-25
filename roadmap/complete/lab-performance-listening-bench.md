# Performance listening bench — earn the limits before Studio integration

> **Status: complete 2026-09-13.** Implementation loop: evidence about our audio
> analysis, not a change to MNX. An isolated experimental unit in this repository,
> serving future Studio tracking, assessment and guitar control. Not an item in the
> existing player campaign; consumes its audio apparatus without expanding its contract.

## Purpose and first outcome

Studio could listen to a performer and follow their position in a score, assess notes
and timing, and recognise deliberate guitar gestures as commands. These are separate
consumers of audio evidence with different certainty requirements. Moving a cursor may
be justified when grading an inner chord tone is not; a command needs particularly
strong evidence of intention.

Begin by establishing what audio detection can actually support. The first deliverable
is a reproducible comparison of detection strategies on digitally rendered audio, with
measured failure cases and an accuracy-versus-delay report. It is not a Studio feature.
A finding that no strategy meets a useful operating point is a valid outcome.

Synthetic recordings bypass microphone, room and performer variability and provide known
performed events. The existing player supplies varied sounds, including guitar and piano.
Success here establishes a controlled baseline, not evidence of microphone readiness.

## Isolation and ownership

Create a bench package/unit at `experiments/performance-listening/`, with its own commands,
dependencies, fixtures and results. Stay in this repository to consume and version the
existing player alongside experiments. Independent publishing and a separate repository
have no current consumer.

Suggested structure (final package wiring is an implementation decision):

```text
experiments/performance-listening/
  README.md          questions, commands, current conclusions
  fixtures/          explicit event sequences and MNX examples
  rendering/         adapter to the existing audio renderer
  detectors/         interchangeable strategy adapters
  evaluation/        event matching, metrics, causal replay
  experiments/       named, reproducible configurations
  findings/          conclusions with supporting run references
  inspector/         optional local inspection app
```

Production layers and shells must not import the experiment. The bench may consume
model/audio interfaces; it must not import workbench or entry leaves. Its heavy models,
Python dependencies or alternative runtimes must not enter production bundles. Enforce
the boundary when wiring the package. An experimental runtime is not a commitment to
use that runtime in the browser.

The automated runner is the core artifact. Add a small local inspector only when it
helps review failures: select a run, listen, overlay expected/detected notes, jump to
mismatches and compare strategies. It consumes the same saved results as the CLI.
No deployed app, Studio route, account, storage API or production UI is required.

This bench owns its evaluation fixtures. It does not extend scenario metadata or write
scenario statuses, verification records or engraving goldens. Existing corpus approval
rules remain unchanged.

## Evidence loop and ground truth

```text
Target score ──→ actual performed events ──→ audio renderer ──→ PCM recording
                       │                                         │
                       └── actual-event labels                   └── detector
                                  │                                    │
                                  └──────── detection comparison ───────┘
Target score ─────────────────────────────── future assessment comparison
```

Capture digital output before speakers/microphones, preferably through offline rendering
using the existing native sink's host-owned `BaseAudioContext` seam. Confirm the adapter
covers the same sound path before relying on it; do not create a separate synthesizer
and describe its results as tests of our player.

Preserve three distinct artifacts: intended target, actual scheduled performance, and
rendered audio. A wrong-note fixture might target C–E–G but render C–F–G. The detector
receives audio only; a declared score-informed strategy may additionally receive the
original target, never the actual-event labels or mutation recipe.

Scheduled attacks/releases are precise control labels, not automatically precise acoustic
boundaries: sample attacks, release tails and masking matter. Document matching tolerances,
render pre-roll/tail and any measured offset convention. Expose quiet or masked cases;
do not silently remove them to improve accuracy. Separate active-pitch, attack and release
results so sample tails do not masquerade as missed key releases.

Compiler output can provide event identities and repeat occurrences, but a compiler that
both drives rendering and supplies expectations is not an independent MNX correctness
oracle. Include a few independently specified event sequences and manually inspected
recordings to validate the evaluator and rendering adapter. Existing performance evidence
continues to judge MNX interpretation.

## Strategies to compare

| Family | Baseline role | Failure questions |
|---|---|---|
| Spectral peaks and harmonic matching | Understandable acoustic baseline | Octave errors, shared harmonics, weak fundamentals |
| Note-template matching / non-negative decomposition | Explain audio using isolated-note spectra | Dependence on the sample source, dynamics and attack stage |
| Pretrained neural multipitch transcription | Learned baseline; Basic Pitch is a candidate | Domain dependence, timing, model context and confidence |
| Score-informed matching | Later comparison using the known target | Benefit of context versus explaining away wrong notes |

Initial comparison covers the first three. Record exact algorithms, versions, licenses,
preprocessing and parameter choices; candidate names are not claims of suitability.
Onset estimation and temporal event grouping may be shared, but document that sharing
so the benchmark reveals what actually differs.

Template experiments explicitly distinguish same-pack templates/tests from held-out
sound sources. Hold out a second guitar sound as well as testing piano versus guitar.
Split before tuning: test fixtures or packs must not select detection thresholds.
A score-informed detector must allow unexpected pitches; expected notes are not evidence
that those notes were heard.

## Fixture matrix

Build a small diagnostic corpus first, then expand through parameterised cases:

- Silence and isolated notes across the supported range and several velocities.
- Repeated attacks and alternating notes, with varying gaps and sustain overlap.
- Dyads including octaves, fifths and close intervals; three- through six-note chords.
- One quiet note among loud notes, including quiet wrong and missing inner tones.
- Strums, arpeggios and ringing overlap; bends where the renderer supports them.
- Correct performances and explicit wrong, extra, missing, early and late events.
- Later following probes: tempo changes, pauses, repeated passages and restarts.

Record actual simultaneous pitch count separately from scheduled voice/string count.
A six-string chord need not contain six distinct pitches. Detecting pitches cannot prove
which strings sounded or that every intended string was struck.

Run the same musical cases with multiple sound sources. Seed generated variations and
retain exact event labels. More realistic noise, reverberation and real recordings are
later challenges, not substitutes for understanding clean-input failures.

## Evaluation and reproducibility

Keep audio generation independent of detector runs. Pin reference audio by content hash;
regeneration creates an explicitly versioned input, rather than silently changing the
benchmark when the player changes. Commit small fixtures, configurations, manifests and
compact reference reports. Keep bulky generated PCM/model outputs in ignored output or
explicit artifact storage; record retrieval/regeneration instructions, licenses and hashes.

Each run records repository revision, fixture/audio hashes, sample-pack identity, renderer
settings, detector/model version, parameters, seed, sample rate and execution mode.
Performance measurements identify runtime and hardware. Do not promise byte-identical
rendering or inference across platforms without measuring it.

Report at least:

- Pitch precision/recall and octave confusions; attack precision/recall with explicit
  pitch/time tolerances and one-to-one event matching.
- Exact chord-pitch-set recovery, alongside partial credit and per-note results.
- Latency from relevant input audio to emitted decision, sustained compute cost and
  backlog, not inference speed alone.
- Accuracy broken down by pitch range, polyphony, relative level and sound source.
- Confidence calibration and accuracy-versus-coverage when abstaining; raw neural
  activations are not automatically probabilities.
- For assessment probes, false accusations, missed errors and unassessed events.

Unit-check the evaluator with fabricated predictions: perfect match, duplicate detection,
octave error, missed event and timing-boundary cases. A detector must not gain credit by
emitting several candidates for one event. Missing/skipped strategy runs are explicit,
not zeros folded into an aggregate. Freeze evaluation conventions before comparing runs.

Replay each recording both whole-file and as causal chunks. A streaming adapter may use
only audio that has arrived; record required lookahead, warm-up and buffering. Distinguish
the estimated event time from the time the decision became available. Compare several
bounded delay settings, including a too-slow/unavailable result where appropriate.
An offline-only model is still a useful baseline but is never labelled live-ready simply
because it processes a file faster than its duration.

## Stages and completion

1. **Trust the bench.** Render tiny explicit sequences, inspect recordings and prove
   evaluator behaviour independently of detectors.
2. **Compare acoustic strategies.** Run the three baselines on isolated notes through
   dense chords, correct and altered events, with shared inputs and metrics.
3. **Test transfer and delay.** Evaluate held-out sounds and causal replay. Publish
   per-condition findings, representative audible failures and reproducible commands.

These three stages are this proposal's bounded implementation scope. Completion requires
an evidence-backed capability/limitation table and a recommendation to continue, narrow
scope or stop—not a prescribed accuracy threshold invented before measurements. Record
confidence limitations, unavailable strategies and remaining uncertainty honestly.

Possible subsequent experiments, requiring a new decision after these findings:

- Score-informed following and assessment, including loss/recovery of position.
- Small labelled real-guitar recordings through the same evaluator, then microphone
  capture and device/room variability. GuitarSet is an external starting point.
- Command gestures evaluated against ordinary practice, measuring accidental commands
  per hour. A wrong note or silence alone is not sufficient evidence of intention.

Do not create those follow-up proposals automatically. Preserve a running findings log
inside the bench so subsequent work inherits the failures as well as the successes.

## Product principles retained for later

Uncertain remains unassessed; it is neither correct nor wrong. Recognising a chord can
justify cursor movement without proving every inner note. Offline context can resolve
ambiguity but cannot recover information absent from the recording. Assessment must name
its practice target: steady tempo, swing and expressive rubato have different criteria.
Following may adapt to timing without the assessor explaining every error away. Observed
time stays distinct from the player's scheduled clock; reuse score identities deliberately.

Promote the smallest proven capability into a reviewed production layer only when evidence
supports a concrete consumer. Keep this bench to evaluate future changes. No production
promotion, microphone integration, automated grading UI, guitar command execution, schema
extension or new roadmap campaign is authorised by implementing this bench.

## Context and starting references

- [Performance compiler](../../docs/player-performance.md) and
  [native playback](../../docs/player-transport.md): existing rendering and identities.
- [Studio practice proposal](../proposed/studio-player-practice.md): related consumer work, explicitly
  excluding recording/detection; neither proposal silently expands the other.
- [Basic Pitch](https://github.com/spotify/basic-pitch): candidate polyphonic baseline,
  not a guarantee of causal low-latency behaviour.
- [GuitarSet](https://guitarset.weebly.com/): later external guitar-recording evidence.
- [IRCAM score-following documentation](https://support.ircam.fr/docs/Antescofo/manuals/UserGuide/workflow_rehearsal/):
  precedent for score-informed following, not proof of our target operating conditions.


## Implementation outcome — 2026-09-13

The three bounded stages are implemented in
[`experiments/performance-listening/`](../../experiments/performance-listening/archive/README.md).
The [findings](../../experiments/performance-listening/archive/findings/README.md) retain the
initial measurement, limitations and a recommendation to continue the isolated bench.
There are 151 player-rendered recordings (102 evaluation cases and 49 templates), three
detector adapters, independent evaluator/causality tests, a read-only local inspector,
and committed audio hashes and reference reports. Of 918 requested outcomes, 714 are
measured and 204 explicitly unavailable neural-stream modes; no execution failures.

The template method loses accuracy on held-out sounds; the neural baseline is stronger
on attack recovery but its CPU implementation is slower than real time. Pitch presence
and attack recognition diverge sharply on re-strikes. No production promotion, microphone
integration or score following is implied. The original implementation worktree was retired before this document moved to
complete. All 1,763 repository tests, 14 bench tests, scenario checks, build and
boundary checks passed; re-earned existing goldens remained byte-identical. No goldens or approval records moved,
so there is no verification batch to register.
