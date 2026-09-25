# 003 — Can the features recognize the right passage?

**Supplying alignment did not rescue either representation.** Their fixed confidence
test rejects much of the intended passage, while nearby wrong positions often look
just as convincing. This identifies a weakness in the current frame-by-frame
features/templates and confidence test. It does not rule out sequence-based alignment
resolving ambiguities that an isolated spectrum cannot.

The diagnostic is complete. No listener was changed or retained. Winner stays at
four bars; the next useful experiment is to use attacks and short note sequences to
distinguish passages, before another confidence-cutoff adjustment.

## The controlled question

Experiment 002 could not tell whether a poor match came from choosing the wrong
position or failing to recognize the right one. Here we supplied the position from
the unchanged `sync.json` interpolation and measured both frozen representations.
This is privileged-input component diagnosis, not an end-to-end following test.

We used the same 9.507-second Winner clip, score and frozen set as 002. A 170.7 ms
past-only audio window supplies each spectrum; the expected score position is taken
at its center. There are 467 analysis frames per representation, ending at audio
times 0.19–9.506958 seconds. An optimistic local score picks the best template within
±0.25 quarter of the supplied position. Competitors are the strongest same-piece
match outside that band but inside the original tempo search corridor, and the
strongest Dust-score match inside that corridor. Silence is also checked.

The interpolation remains approximate. A score outside the tolerance band can still
sound identical to one inside it. These are competing template scores, not verified
musician mistakes or counts of actual false-following decisions. Frames from this
one reused recording are not independent trials.

## Recognition with alignment supplied

| Diagnostic at the existing 0.65 cutoff | Pitch-class version 1 | Register/harmonic version 2 |
|---|---|---|
| Nearest supplied-position template accepted | 47.54% (222/467) | 16.27% (76/467) |
| Best template within ±0.25 quarter accepted | 57.82% (270/467) | 20.34% (95/467) |
| Strongest nearby wrong-position template accepted | 64.03% (299/467) | 19.91% (93/467) |
| Strongest Dust-score template accepted | 5.78% (27/467) | 0% |
| Digital silence rejected | 100% | 100% |

Version 2 separates this other piece more strongly, but also rejects much of Winner.
Neither representation's optimistic correct-position score reliably beats nearby
wrong positions:

| Local correct match versus strongest nearby competitor | Version 1 | Version 2 |
|---|---|---|
| Strictly stronger | 34/467 (7.28%) | 35/467 (7.49%) |
| Tied within 1e-9 | 278/467 (59.53%) | 308/467 (65.95%) |
| Weaker | 155/467 (33.19%) | 124/467 (26.55%) |

Across all four bars, unrestricted wrong-position templates are stronger still:
version 1 wins only 22/467 comparisons and version 2 wins 30/467. The complete
aggregate evidence includes both global and corridor-limited margin distributions.

These percentages do not replace the 46% and 18% following results from 002. This
experiment uses analysis frames and window-center alignment, while 002 judged emitted
positions on a 50 ms grid. There is no claimed following improvement.

## Would changing the confidence cutoff fix it?

We predeclared a descriptive sweep over every distinct observed similarity and the
next representable cutoff above it. Require each competing-control acceptance rate
to stay at or below 5%. Among those cutoffs, maximize optimistic local positive
acceptance. The result is an in-sample diagnostic bound for this specific scalar rule,
not a retained threshold or a bound on all possible sequence-based listeners.

| Best qualifying scalar cutoff | Version 1 | Version 2 |
|---|---|---|
| Cutoff, approximately | 0.79923 | 0.70011 |
| Optimistic local positive acceptance | 6.00% (28/467) | 6.21% (29/467) |
| Nearby wrong-position acceptance | 4.93% (23/467) | 4.93% (23/467) |
| Dust acceptance | 0% | 0% |
| Distinct cutoffs examined | 2252 | 2273 |

This is far from 95% positive acceptance. Lowering the cutoff to accept Winner also
admits nearby competing templates. A scalar cutoff alone does not resolve the
ambiguity; no candidate threshold was changed after this sweep.

## Is the reference simply early or late?

The fixed sensitivity probe shifted the reference lookup by −200, −100, 0, +100 and
+200 ms. All offsets use the same 456 eligible frames, so the denominator is stable.
Positive offsets look later in the score; they do not shift the audio.

| Reference offset | Version 1 nearest-template acceptance | Version 2 |
|---|---|---|
| −200 ms | 38.82% | 14.04% |
| −100 ms | 50.44% | 19.08% |
| 0 ms | 48.03% | 16.67% |
| +100 ms | 29.61% | 9.65% |
| +200 ms | 10.53% | 1.54% |

The best tested offset gains only 2.41 percentage points for either representation,
below the predeclared 10-point investigation trigger. A simple constant offset in
this range does not rescue recognition. This does not establish precise sync accuracy
or exclude local timing differences; the original anchors remain unchanged.

## What explains the ties, and what to try next

The template code gives every active score note the same exponential decay constant,
then normalizes the combined vector. While the active-note set is unchanged, advancing
time multiplies every component by the same factor; normalization cancels that factor.
The normalized template therefore carries no changing decay cue within that interval.
The measured ties are consistent with that structural limitation, although this
experiment does not assign every tie to a unique cause.

The next bounded hypothesis should test **attack-sensitive features plus evidence
across a short sequence**, rather than static snapshot similarity alone. The existing
[alignment research note](../research/dixon-2005-online-alignment.md) already motivates
onset emphasis; it does not prove it will work for this guitar recording. Keep the
same four-bar reference and controls, compare against the frozen versions, and judge
any new listener end to end. The diagnostic's privileged alignment must not enter
that listener. This next candidate has not been implemented or assessed here.

## Verification, resources and stopping

The independent diagnostic reconstruction exactly matches saved original confidence
values on all available unclamped emitted analysis frames: 312 comparisons for
version 1 and 108 for version 2, with maximum absolute difference zero. Synthetic
checks cover the original analysis cadence, window center, future-audio independence,
known-tone recognition, silence and tied-score handling. Thus this is a measurement
of the existing representations, not a subtly rewritten candidate.

The plan was committed before the run at `3f10140e`. The run consumed 2.947644 CPU
seconds. Conservatively charging two feature/set assessments brings contract 1 to
six of twelve assessments, two of six candidate versions and 37.533150 CPU seconds
of its two-hour budget. No new candidate version, reserved access or web search was
used. The separately authorized diagnostic is now closed; experiment 002's original
two-version sub-batch remains closed as well.

No formal retention, microphone qualification, positive Dust advancement or bar
expansion follows from this result.

## Evidence and reproduction

- [Pre-run plan](../contracts/recognition-diagnostic-1.md).
- [Complete aggregate run](../runs/g003-recognition-at-sync/summary.json), including source hashes, distributions, audit and resource records.
- [Experiment 002](002-winner-sync-proxy.html), the unchanged parent results.

Set: `winner-four-bars-sync-proxy-v1`, SHA-256
`80c8a6358751f356e164f75389dd50d49a2a0da6ad094f95847bd304eb5c5b8b`.
Private frame evidence lives under
`/home/williao/dev/mnx-listening-data/real-evidence-01/g003-recognition-at-sync/`.
The private `003-recognition-at-sync.html` embeds Winner audio and clickable similarity
traces. No private frames, audio, score or raw sync anchors are committed.

The diagnostic refuses an existing output and verifies all original assets and
candidate hashes. Reproduction uses the recorded source commit, a fresh private
parent containing a copy of the frozen set (including experiment 002 records), and a
reconstructed copy of the pre-diagnostic budget history (the first two entries of
the preserved history, four assessments and 34.585506 CPU seconds). Preserve the original absolute asset paths
or document a separately relocated manifest identity; do not erase original history.
Public output must also be absent in that isolated reproduction checkout.

```sh
npx tsx experiments/performance-listening/bench/src/diagnostic/run.ts /private/reproduction/proxy-winner-v1
```

Exact diagnostic values should reproduce; CPU timing can vary. HTML exporters only
render saved evidence and never rerun the diagnostic.
