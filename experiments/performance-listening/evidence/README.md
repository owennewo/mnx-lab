# Real evidence — first four bars

Preparation record and subsequent outcome, 2026-09-25. **Experiment 002 completed
on a frozen approximate sync-reference set; neither candidate passed.**
[The report](../reports/002-winner-sync-proxy.html) records the full result. The user
instructed us to interpolate `sync.json`; [the amendment](../contracts/sync-proxy-development-1.md)
removes manual beat annotation as a prerequisite for initial development.
The user selected The Winner Takes It All first, then Dust in the Wind, four performed
bars each, expanding only after measured success. Both pieces and every later crop
remain development evidence. This replaces the earlier five-title shortlist for the
next batch; it does not rewrite the historical R1 inventory.

## Reviewed sources

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
and WAVs have separate SHA-256 identities. Decoder time zero has not been independently
reconciled with video/sync time zero. Experiment 002 uses the fixed reviewed crop and
sidecar origin as an explicitly approximate development reference; it does not
claim independently calibrated timing.

## Technical findings

Both selected scores import and compile without performance diagnostics. Their first
four performed bars have a structural anchor mapping. Winner's complete route has
91 performed bars. Dust's current route has 154; cached anchors also reference bars
155 and 156. That later mismatch remains a hold. It does not prove that the first
four bars are wrong, nor that any later bar can be admitted without checking it.

The two first-window anchor spans imply approximately 101 and 189 quarter-note BPM,
respectively. Those are boundary-derived averages, not verified beat-tempo labels.
Experiment 002 explicitly supplies 101 BPM to both listeners and controls, computed
by rounding Winner's anchor average before either run. Local tempo bounds are not
independently verified by this average.

Initial audio requests with yt-dlp 2026.07.04 returned HTTP 403. Following the user's
suggestion, `uv tool upgrade yt-dlp` installed 2026.08.19 and both downloads succeeded.
No cookies or credentials were used. Full encoded source media is retained privately
for provenance; the review and proposed assessment window are limited to the first
four bars. This is private evaluation at the user's request, not a redistribution
licence or proof of recording conditions.

## Human review and subsequent development direction

The user confirmed solo guitar and four bars for both clips;
[source-review-1.json](source-review-1.json) pins that exact statement to the clip
hashes. Winner is easier and goes first. The statement does not assert every beat's
precision. The original private `review.json` retains its preparation-time null
review placeholders; these are not silently rewritten as approvals.

After approving [research contract 1](../contracts/research-contract-1.md), the user
instructed us to use the existing sync with interpolation as good enough. The
[development amendment](../contracts/sync-proxy-development-1.md) records that instruction.
A separate private set pins the crop, score, original sync and approximate reference.
Manual beat review is not required for that set. Both candidate versions use it
unchanged; neither receives the sync anchors. No note-level assessment labels are
inferred from the score.

Independent precision, exact score/crop correspondence and wrong-score distinguishing
evidence remain relevant to stronger qualification claims. The separate
[v2 instrument](../contracts/instrument-v2.md) handles bounded labels when supplied;
it is not the proxy evaluator used in experiment 002. Preserve cached sidecars and
record any independently justified correction as a new set version, never a way to
retroactively turn a failed run into a pass.

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

[003 — Recognition at supplied sync](../reports/003-recognition-at-sync.html) completed
the subsequent component diagnostic on the same frozen set. Both representations
remain weak and ambiguous with alignment supplied; no new listener was tried.
[Experiment 002](../reports/002-winner-sync-proxy.html) remains the completed pair of
failed following comparisons. There is no retained candidate or positive Dust expansion.
The [bar-anchor sensitivity calculation](bar-anchor-precision-1.json) is historical
analysis of guaranteed precision, not measured sync error or a proxy eligibility gate.

## Playback and optional independent beat review

The private `003-recognition-at-sync.html` embeds Winner and similarity traces;
`002-winner-sync-proxy.html` retains the recorded following traces.
`listen.html` embeds both reviewed WAVs. `beat-review.html` offers waveform seeking,
playback speed and blank independent beat bounds for later precision work; it is not
a requirement for current development. Commands and UI-check limitations are in the
[readiness report](../reports/loop-readiness.md#private-playback-and-optional-precision-review).
