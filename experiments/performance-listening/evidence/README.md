# Real evidence — first four bars

Preparation record, 2026-09-25. **No real golden is frozen and no candidate has run.**
The user selected The Winner Takes It All first, then Dust in the Wind, four performed
bars each, expanding only after measured success. Both pieces and every later crop
remain development evidence. This replaces the earlier five-title shortlist for the
next batch; it does not rewrite the historical R1 inventory.

## Ready to review

The private packet is `/home/williao/dev/mnx-listening-data/real-evidence-01/index.html`.
It contains two playable four-bar WAVs, original score links and first-window anchor
checks. Media, converted scores, full anchors and review placeholders remain in that
private directory. [The committed preflight](initial-four-bars-preflight.json) contains
only identities, aggregate diagnostics, crop boundaries and hashes.

| Piece | Source identity | Provisional source window | Decoded crop |
|---|---|---|---|
| The Winner Takes It All | F2msc / 1872366 / K643ZIiG-18 | 2.464–11.970958333 s | 456334 samples at 48 kHz; 9.506958333 s |
| Dust in the Wind | qrpHc / 1702681 / 6caUN3HLJSI | 9.032–14.111895833 s | 243835 samples at 48 kHz; 5.079895833 s |

Windows come from cached bar boundaries rounded to the nearest decoded output sample.
That rounding does not establish annotation precision. Each WAV is mono PCM16; the
sample count was checked after decoding/resampling and trimming. The encoded sources
and WAVs have separate SHA-256 identities. Decoder time zero has not yet been independently
reconciled with video/sync time zero, so these remain review crops rather than bench inputs.

## Technical findings

Both selected scores import and compile without performance diagnostics. Their first
four performed bars have a structural anchor mapping. Winner's complete route has
91 performed bars. Dust's current route has 154; cached anchors also reference bars
155 and 156. That later mismatch remains a hold. It does not prove that the first
four bars are wrong, nor that any later bar can be admitted without checking it.

The two first-window anchor spans imply approximately 101 and 189 quarter-note BPM,
respectively. Those are boundary-derived averages, not verified beat-tempo labels.
Do not use them as an unexamined listener handoff or assume local variation is bounded.

Initial audio requests with yt-dlp 2026.07.04 returned HTTP 403. Following the user's
suggestion, `uv tool upgrade yt-dlp` installed 2026.08.19 and both downloads succeeded.
No cookies or credentials were used. Full encoded source media is retained privately
for provenance; the review and proposed assessment window are limited to the first
four bars. This is private evaluation at the user's request, not a redistribution
licence or proof of recording conditions.

## Human evidence still needed

For each four-bar excerpt, record who checked it, when, and the exact source hashes.
Confirm that it is solo guitar, that the intended score and performed route match,
and that the crop begins/ends at the intended bar boundaries. Check every beat or
other landmark needed for the labelled trajectory; supply independently observed
bounds rather than simply accepting the cached decimal timestamps. Check the initial
wrong-score control against the other piece and mark its first distinguishing evidence.
Unresolved interiors remain unknown. A high-level “sounds right” is not a precision bound.

The private `review.json` keeps these facts as null. It does not write approvals.
Preserve the cached sidecars. Record corrections separately with their evidence and
source identities; a later accepted label set will be a new version. No pitch/onset
assessment labels are being inferred from the score.

The draft [research contract 1](../contracts/research-contract-1-draft.md) proposes the
numerical gates and the progression 4 → 8 → 12 bars. Confirmation of the sources and
intended use is already recorded; contract approval, source review and set freezing
are separate acts. The current v1 instrument also needs a versioned real-audio and
annotation-uncertainty extension before it can evaluate these clips honestly.

## Reproduce the private preparation

Build the existing converter CLI with `npm -w @mnx-editor/guitarpro-mnx run build`.
Convert each selected GP into an external private directory as `<piece-id>.mnx.json`
using `npx --no -- guitarpro-mnx --import <source.gp> --output <private/id.mnx.json>`.
The preflight imports only the model/audio layers; it does not add a converter dependency.

A private `media-map.json` maps recording ID strings to objects with `path`, `sourceUrl`,
`sha256` and `downloadTool`. The tool checks the URL against the sidecar and hashes the
actual media bytes; supplying a different recording does not silently reuse labels.
Use `-` instead of the map path for metadata-only preparation.

```sh
npx tsx experiments/performance-listening/bench/src/evidence/prepare-review.ts   /home/williao/dev/soundslice-cli/gp/files   /home/williao/dev/mnx-listening-data/real-evidence-01   /home/williao/dev/mnx-listening-data/real-evidence-01   /home/williao/dev/mnx-listening-data/real-evidence-01/media-map.json   F2msc qrpHc
```

The output directory must be outside a git checkout. Node, the existing tsx development
runner, ffprobe and ffmpeg are used; no runtime package was added. Every preparation
outputs `review.json`, `preflight-summary.json` and `index.html`; available media also
produces canonical review WAVs. The packet is regenerated from source evidence, not a
listener. Treat `preflight-summary.json` as a new preparation snapshot if its inputs
change; do not replace frozen experiment evidence with it.

## Stage status

Contracts, instrument-v1 and synthetic pipeline remain complete. Real evidence is now
at **selected sources and playable review crops**, awaiting independent label checks.
The research contract is a concrete draft awaiting approval. The uncertainty-aware
instrument, real goldens, retention rule and audio-driven candidate have not been
implemented or run in this preparation step. Experiment 002 is not assigned until
there is an actual new assessment; this review packet is not an experiment result.
