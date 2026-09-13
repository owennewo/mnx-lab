# Findings — initial synthetic baseline

**2026-09-13 · implementation loop.** Recommendation: continue the isolated bench,
with attack/re-strike grouping and conservative error evidence as the next questions.
Do not promote these baselines into Studio grading. No follow-up proposal is filed.

## Evidence

34 evaluation cases × archtop guitar, held-out nylon guitar and held-out upright piano:
102 recordings, plus 49 isolated archtop templates. Each evaluation requests three
strategies in whole-file and two streamed modes: **714 measured outcomes, 204 explicitly
unavailable neural-stream outcomes, zero execution failures**. Each preset contains 81
observable reference attacks after simultaneous unison collapse.

[Full measurement table](reference-v1/table.md), [counts and provenance](reference-v1/summary.json),
[per-case outcomes](reference-v1/cases.jsonl), [condition breakdowns](reference-v1/breakdowns.jsonl)
and [pinned audio manifest](reference-v1/audio-manifest.json) are committed. Full predictions
and WAVs are under ignored `output/run-v1` and `output/audio-v1`; see the bench README to
regenerate and inspect. The archived report is a measurement, not an approval or a CI
accuracy gate. Reference rendering used Chrome 153 (exact version in the audio manifest),
Node 22.22.1 and an Intel i7-8750H; timing is machine-specific.

The run began before the implementation commit; exact detector/evaluator hashes identify
the measured source, preserved in the initial implementation commit. Subsequent changes
format that source, add reporting/tests and improve artifact writes/inspection without
changing the detector algorithm or thresholds. Keep input hashes when comparing reruns.

## What we learned

| Baseline | Archtop attack F1 | Nylon attack F1 | Piano attack F1 | What the evidence supports |
|---|---:|---:|---:|---|
| Harmonic matching | 30.2% | 25.0% | 28.8% | Fast enough to experiment with causal following, but noisy event output |
| Archtop templates | 56.6% | 30.3% | 34.4% | Same-source advantage; poor transfer to the held-out sounds |
| Basic Pitch, CPU/offline | 69.5% | 75.2% | 79.0% | Stronger attack recovery, with substantial false/delayed/fragmented events remaining |

These are deliberately untuned operating points, not rankings of the best possible
implementations of each family. Attack F1 requires the right pitch within 100 ms of the
scheduled attack; a correctly named pitch detected too late is both a missed reference
attack and an unmatched predicted attack. It is not necessarily an invented pitch.

1. **Pitch presence and attacks really are different layers.** Active-pitch F1 is
   88.0–88.4% for the neural baseline despite its lower attack F1. On archtop
   `restrike-no-gap`, templates recover the active pitch set for all active frames but
   match only one of three attacks. The neural method matches all three but emits six
   additional unmatched attacks. Our two DSP baselines have no independent re-strike
   detector; this is evidence about that implementation limit.
2. **Six-note identification is not a binary yes/no.** For archtop `chord-6`, Basic Pitch
   names all six expected pitches, but two arrive outside the attack tolerance. Four
   attacks match; exact pitch-set recovery covers 54.3% of active frames. The two DSP
   baselines never recover the entire six-pitch set on this case. This does not establish
   string identity or general six-string completeness.
3. **A quiet wrong note can disappear.** For archtop `quiet-wrong-inner`, both DSP
   baselines miss the quiet F while finding the outer notes. The neural baseline matches
   all three actual attacks but adds an unmatched event. Correct broad harmony is not
   evidence of a correct inner voice, and no detected wrong note is not a pass.
4. **Timbre transfer is a material risk.** Template active-pitch F1 falls from 79.6%
   on archtop to 53.0% on nylon and 41.2% on piano. Its exact active-set recovery falls
   from 69.4% to 25.5% and 18.1%. Same-pack performance is an optimistic baseline;
   the held-out nylon guitar is a necessary separate result.
5. **Live DSP has a measurable, imperfect operating point.** With 256-sample chunks,
   p95 availability-plus-processing latency for matched attacks is 99–147 ms for
   harmonic matching and 146–192 ms for templates across these sounds. With 2048-sample
   chunks it increases to 148–223 ms and 224–229 ms. These times apply only to matched
   attacks, with the recall and false events above; no microphone/browser/UI costs are
   included. Chunking changes availability, not these detectors' musical output.
6. **This neural runtime is an offline baseline.** Pure TensorFlow.js CPU processing
   costs 2.55–2.92 times audio duration in this run; whole-file matched-attack p95
   latency is about 8 seconds. A faster backend may change processing cost; it would
   not itself prove causal operation. Neural streaming was not implemented or measured.
7. **Conservative thresholds trade coverage for fewer accusations.** At the prespecified
   score threshold 0.5, archtop templates retain 95.6% attack precision but only 53.1%
   recall; on nylon this becomes 81.8% / 33.3%. Basic Pitch at that threshold reaches
   91.0% / 87.7% on archtop and 82.8% / 88.9% on nylon. These exploratory curves are
   evidence to investigate, not permission to select a test-set threshold and claim
   general reliability. Scores are not calibrated probabilities.

## Repeat-render finding

A second render with identical fixture identities, unchanged `src/audio` hashes and
Chrome 153.0.8010.36 reproduced 123/151 audio hashes exactly. The other 28 recordings
are polyphonic and differ by at most **2.9802322387695312e-8** per float sample; RMS
difference over those recordings is **1.5488826323646576e-9**. This is consistent with
floating-point mixing-order effects, but the underlying cause has not been isolated.
See [repeat comparison](reference-v1/render-repeat.json) for every changed hash.

The frozen input files were not replaced, and the full detector comparison still refers
to their original hashes. No claim is made that detector results are invariant to every
small input change. This validates separating rendering from comparison: re-rendering
creates a new input version even when the source and browser version are unchanged.
The five files exported by `report` reproduce byte-identically from the saved full
run; the repeat-render diagnostic is exported separately by `compare:renders`.

## Reproduce and review a failure

From the repository root, after rendering and comparison:

```bash
npm --prefix experiments/performance-listening run inspect
```

Choose `guitar` and one of `single-40-0.3`, `chord-6`, `restrike-no-gap`,
`quiet-wrong-inner` or `wrong-inner`. Compare strategies, use the mismatch jump, and
listen to the same WAV. The inspector was checked in headless Chrome for rendering,
recording playback and absence of script errors. That is a tooling check, not a human
assertion that every acoustic attack boundary has been heard and labelled.

The native adapter verifies every scheduled attack created a sample source, silence is
zero, nonempty fixtures are audible and no fixture clips. The compiled MNX example is
checked against an independently specified two-note schedule. Fourteen independent
unit tests cover evaluator edge cases, a known sinusoid, a known template mixture and
causal-prefix/chunk invariance. The benchmark uses no existing scenario verification
records and changes no goldens.

## Limits and next decision

This establishes an automated bench and useful failure evidence on synthetic audio.
It has not established a production accuracy requirement, microphone transfer, calibrated
confidence, real-guitar timing labels, score-following recovery or deliberate command
recognition. Native note releases and sample envelopes are only scheduled/acoustic
proxies; the reports keep release error separate. Bend cases are stress probes: the
neural adapter does not yet consume Basic Pitch's contour output, so its note decoder
can split a bend into separate pitches.

The highest-value next experiment is to distinguish attacks from sustained pitch and
release transients, then test conservative error evidence on a newly held-out set. Keep
these 102 recordings as regression evidence; they are no longer an unseen test set once
we use these results to choose improvements. After that, compare score-informed following
and a small real-guitar recording set before choosing a Studio integration. None of those
follow-ups has been implemented or automatically filed.
