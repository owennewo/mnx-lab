# F-006: explicit fundamental support

Implementation loop. **Result: useful bass recovery at negligible measured incremental cost;
revise, keep optional.** Extra detections and development re-strike regression block adoption.
F-000 remains default; F-003 remains the experimental reference. Whitening is bypassed.

## What changed

Protect a candidate's original harmonic evidence when its fundamental has a local spectral
peak distinct from nearby background, even if greedy upper-pitch allocation reduced its
score. Apply the same rule across MIDI 40–88. Missing fundamentals do not veto existing
hypotheses. This is a positive evidence term, not a complete flexible harmonic model.
See [mechanism and parameters](../../fusion-techniques/fundamental-evidence.md).

The E2/E3/B3 controls informed the design: they are diagnostic development evidence,
not independent confirmation. Freeze the implementation and [plan](../../experiments/fusion-fundamental.json),
then select strength 0.75 from 0.5/0.75/1 using pooled development onset F1. Strength zero
is the bypass reference, not a candidate for this selection; selection is not acceptance.
No thresholds were retuned after observing fresh results.

## Whole-listener results

A correct attack requires the right pitch and onset within the existing 100 ms tolerance.
Extra detections include transient, harmonic and repeated events, not just unique pitches.
Active F1 measures pitch presence over time. These are detector scores against correct
synthesised playback, not grades for a musician.

| Evidence | F-003 bypass | Fundamental support 0.75 |
|---|---:|---:|
| Development: correct attacks / 777 | 605 | 669 |
| Development: extra detections | 3027 | 3086 |
| Development: attack precision / recall | 16.7% / 77.9% | 17.8% / 86.1% |
| Development: attack F1 / active F1 | 27.4% / 55.9% | 29.5% / 64.6% |
| Fresh: correct attacks / 96 | 66 | 77 |
| Fresh: extra detections | 423 | 427 |
| Fresh: attack precision / recall | 13.5% / 68.8% | 15.3% / 80.2% |
| Fresh: attack F1 / active F1 | 22.6% / 51.8% | 25.7% / 63.4% |
| Private Gymnopedie bars 5–8: correct / 21 | 16 | 20 |
| Private passage: extras / attack F1 | 27 / 50.0% | 29 / 57.1% |

Development covers 294 archived cases across the original set and v1–v5 confirmation
sets. The fixed sweep's attack F1 values were 27.44%, 28.85%, 29.52%, 29.40% for
strengths 0, 0.5, 0.75, 1. Fresh v6 contains 14 musical patterns across guitar, guitar2
and piano, plus three seeded broadband-noise cases: 45 cases total. All 66 previously
matched fresh truth identities survive; 11 are gained, none lost.

Three counterbalanced fresh streaming-cost passes give a ratio of **1.0007** using the
ratio of median totals: effectively unchanged at this measurement precision. Individual
ratios are approximately 0.983, 1.012, 1.018. This is local elapsed processing measurement,
not a target-device guarantee. Construction is outside streaming timing. Common-match
p95 emission latency is 171.685 → 171.745 ms across 66 matches (+0.061 ms), including
processing simulation. No extra FFT, audio lookahead or temporal state was introduced.

## Bass and negative controls

| Guitar diagnostic | Bypass | Support 0.75 |
|---|---|---|
| E2 alone | Missed | Correct attack |
| A2 alone | Missed | Correct attack |
| E2 + A4 | Both missed | E2 recovered; A4 still missed |
| E2 + E3 + B3 | 2/3 attacks | 3/3 attacks |
| E3 alone, B3 alone, E3 + B3 | No invented E2 | No invented E2 |

In the private four-bar passage all four missing bass attacks are recovered; A4 in bar 6
remains the sole missed attack. This does not solve attribution of higher pitches.
The isolated E2 and E2/E3/B3 detections are timestamped 86.7 ms after the real attack,
with enough audio available to emit them 191.2 ms after it (processing adds about 1 ms).
Passing a 100 ms onset match is therefore not the same as emitting within 100 ms.

Fresh quiet E2 is recovered for both guitar presets, but remains missed for piano.
The transposed higher-only F#3+C#4 controls invent no F#2 on any preset. All six genuine
octave attacks are recovered, versus five before; piano octave extras increase 13→16.
All three noise-only controls emit zero notes with either recipe. These controls do not
establish robustness to microphone noise, distortion, room response or real playing.

## Acceptance and next question

Fresh precision, recall, F1, active/category F1, CPU and common-latency gates pass.
The no-extra-false-accusations gate fails: 423→427 fresh and 3025→3084 development.
Development re-strike category F1 also falls 51.9%→46.7%, exceeding the two-point budget.
The private passage adds two extras. Keep this component available for experiments;
do not promote it as the default or equate improved recall with solved assessment.

The next useful question is whether explicit lower-note evidence can help allocate shared
harmonics and remove false upper-note events while preserving genuine octaves and melody.
That requires a separately frozen experiment. A whitening combination is also unmeasured.

## Reproduction and artifacts

[summary.json](summary.json) records configuration and source hashes, selection, all
aggregate results and fresh gates. [cases.jsonl](cases.jsonl) contains public per-case
metrics; [audio-manifest.json](audio-manifest.json) pins fresh inputs. The recorded local
pre-rebase revision identifies the measured checkout; content hashes remain the evidence
identity after landing. Private note schedules and audio remain in ignored local output.

From the repo root, use `LISTENING_PLAN=fusion-fundamental.json` with the shared
`experiments/performance-listening/experiments/fusion-whitening.mjs` runner. Pass the
explicit output directory `experiments/performance-listening/output/fusion-fundamental-v1`
(the runner's legacy default is the whitening directory). Execute `development`, then
`heldout` with the v6 audio directory as its fourth argument, then `diagnostics`, then
`export` with a new findings directory. Existing frozen results refuse overwrite.
`LISTENING_ARCHIVE_ROOT` may point to the primary checkout's archived output.
Render fresh inputs before evaluating, from the repo root:

```sh
node experiments/performance-listening/rendering/render.mjs experiments/performance-listening/output/audio-fusion-heldout-v6 --fusion-heldout-v6
node experiments/performance-listening/experiments/fundamental-noise-controls.mjs experiments/performance-listening/output/audio-fusion-heldout-v6
```

Rendering needs the bench browser dependencies. Frozen WAV hashes must match; regeneration
creates a new input version if they differ.

Validation: 29 bench tests passed, including bypass, scale invariance, lower-harmonic
guard, causal prefix and replay chunk-size checks. Repository landing gates are required
separately. The full experiment remains isolated from Studio production code.
