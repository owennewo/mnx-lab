# Research loop: instrument ready, real comparison awaiting timing evidence

Research contract 1 is approved. The user confirmed that both selected clips are solo
guitar and contain four bars, and reiterated that Winner is easier. Winner remains
first; Dust follows only after the applicable Winner gates pass.

The next measuring apparatus and decision procedure are implemented and checked.
**We have not completed a real-performance research loop or qualified a listener.**
There is no new audio-driven candidate result, no retained candidate and no experiment
002 yet. This is an instrument/readiness checkpoint, not a numbered assessment.

## What is now implemented

- A separate v2 real-evidence format with source hashes, independent review provenance,
  bounded position uncertainty, acoustic alternatives and explicit unknown regions.
- Conservative correctness, rejection, coverage and deadline bounds, plus continuous
  wrong/false exposure that a late correction cannot erase.
- A paired development runner that checks reviewed score/audio/review hashes before
  candidate creation, measures processing costs and checks both silent and non-silent
  futures for complete-record prefix invariance.
- The approved decision rule: provisional development selection, reject or inconclusive;
  formal retention additionally requires independent reserved evidence and access history.
- A loop driver that reports the next action and remaining budget without extending it.

The [v2 contract](../contracts/instrument-v2.md) states exact semantics and limitations.
The [oracle](../bench/oracle-v2/README.md) contains hand-worked arithmetic.
The [recorded checkpoint](../bench/oracle-v2/recorded/checkpoint.json) pins sources and
records five evaluator cases and three decision-rule cases. Those decision-rule inputs
stipulate cost and causality; they are not measurements of a listener. Separate tests
exercise actual paired chunk delivery and reject altered or unreviewed inputs.
Experiment 001 and every frozen v1 source/contract remain unchanged.

## Why four bars are not yet precise following labels

The [source confirmation](../evidence/source-review-1.json) establishes solo guitar
and four bars. It does not establish every beat time, exact score/route correspondence,
or when the other piece becomes audibly distinguishable as a wrong-score control.

The [anchor sensitivity calculation](../evidence/bar-anchor-precision-1.json) asks an
optimistic question: suppose cached bar endpoints were exact and continuous local
speed were known to stay within 80–120% of the nominal tempo. How much of each clip
could the bar endpoints alone locate within a ±0.125-quarter uncertainty envelope?

| Source | Optimistic answerable fraction | Contract requires |
|---|---|---|
| Winner, four bars | 31.25% | At least 80% |
| Dust, four bars | 31.25% | At least 80% |

Neither assumption is independently established, so 31.25% is an assumption result,
not accepted label coverage. Even that optimistic calculation is insufficient. A
candidate's own alignment cannot fill the missing truth; doing so would make it judge
itself. The next action is independent beat/landmark review, starting with Winner.

## Private review tools

The private directory is `/home/williao/dev/mnx-listening-data/real-evidence-01/`.
`listen.html` embeds the two WAVs and works without a server. `beat-review.html` embeds
them alongside waveform seeking, slower playback, separate suggested and observed beat
times, and a draft JSON export. Observations start blank. Saving a draft does not approve
labels, change cached anchors or freeze a golden. The original `index.html` and
`review.json` preserve source/anchor provenance.

Playback over localhost was verified in Chrome at 9.506958 and 5.079896 seconds.
Both offline exports embed those same clip hashes. Browser automation blocks `file://`
navigation, so their offline UI was checked structurally and for script syntax, but
was not interactively verified through that browser tool.

Rebuild the private offline pages from the repository root:

```sh
node experiments/performance-listening/reports/export-private-listening.mjs /home/williao/dev/mnx-listening-data/real-evidence-01
node experiments/performance-listening/reports/export-beat-review.mjs /home/williao/dev/mnx-listening-data/real-evidence-01
```

For an ordinary browser over HTTP, start the local-only review server and open its
printed URL; stop it with Ctrl+C when finished:

```sh
node experiments/performance-listening/reports/serve-private-review.mjs /home/williao/dev/mnx-listening-data/real-evidence-01
```

No audio, scores or raw private annotations are committed.

## Remaining work and budget

Independent observed beat bounds, interpolation justification, exact score/crop/time
origin, nominal tempo/envelope and wrong-score distinguishing evidence are still needed.
After that, freeze the Winner development manifest, record a bounded candidate
hypothesis and version, and compare it with clock-follower@1. Apply the same frozen
candidate to reviewed Dust only when Winner passes; extend bar count only under the
approved progression. The replay adapter currently requires an independently supplied
integer nominal BPM for the unchanged clock floor; it never silently rounds a handoff.

The candidate batch remains unused: zero new candidate versions, zero candidate/set
assessments and zero candidate-run CPU time charged. Instrument tests are construction
checks. Annotation-practice research used two of six sources and one of two bounded
questions. No reserved or final-acceptance set has been allocated or inspected.

Formal retention and live-microphone qualification cannot be claimed from these two
development recordings. They still need their separately reviewed disjoint groups,
interruption/noise evidence and physical microphone latency measurements.
