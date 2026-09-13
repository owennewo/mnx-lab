# Recording sync maps

Implementation loop, player campaign item 15. `createRecordingSync` maps external
Soundslice timings to performed score positions. It is pure and Node-safe; this item
adds no player UI, media playback, upload route or automatic alignment.

## Source data and validation

The [Soundslice format](https://www.soundslice.com/help/data-api/#syncpoint-data-format)
(accessed 2026-09-13) is an array of `[bar, seconds, offset?, hidePlayhead?]` tuples.
Bar is zero-based in performed order. Offset is a number from 0 to 480 across the
**entire written bar**, not a tick count or an event ID. It defaults to 0. The optional
flag is 0 or 1, defaults to 0, and applies from that anchor until the next anchor.

`model/recordingSync.ts` owns `decodeRecordingSync`, shared with the Worker. It
validates finite nonnegative seconds, safe nonnegative integer bars, offsets, flags
and tuple arity. It accepts at most 100,000 points. Its result contains frozen copies
of the original tuples and normalized points; it never sorts, deduplicates or rewrites
source data. An empty array is valid stored data, but cannot produce a playback map.
The Worker rejects malformed data before serializing it, including NaN/infinity that
JSON would otherwise turn into null. Optional fields and valid unsupported navigation
remain intact in storage. No storage migration is required.

`audio/recordingSync.ts` binds these points to a compilation and traversal. It requires
at least two anchors, beginning at performed bar 0 / offset 0, and strictly increasing
media times and musical coordinates. Duplicate time or position is ambiguous, including
`[k, t, 480]` followed by `[k+1, u]`. Backwards times/positions are unsupported. Both
cases return a diagnostic rather than repairing or discarding evidence. Soundslice's
nonsequential playback remains outside this initial support policy.

## Public API

The compiler now returns `writtenBarDurations` alongside `performance` on success.
These are the full written spans already resolved by its duration walker, including
pickups, tuplets, inherited-meter empty bars and tremolos. This metadata is not part
of `Performance` or its serialized evidence. Pass the compilation and the **same**
PassModel into the recording map; rebuild when the document changes.

```ts
import { linearizePasses } from 'mnx-lab/model';
import { compilePerformance, createRecordingSync } from 'mnx-lab/audio';

const passes = linearizePasses(document);
const compiled = compilePerformance(document, passes);
if (compiled.ok) {
  const result = createRecordingSync(rawSyncpoints, compiled, passes);
  if (result.ok) {
    const map = result.value;
    const location = map.positionAt(media.currentTime);
    // location.value = { position: { ordinal, metricOffset },
    //                    hidePlayhead, atAnchor } on success.
    // map.secondsAt({ ordinal, metricOffset }) gives the inverse seek.
  }
}
```

Every public lookup returns `{ok: true, value}` or `{ok: false, diagnostic}`.
Diagnostics carry a code, explanation and optional zero-based tuple index. Validated
raw data remains available on `map.source`; `bounds` reports the anchored media interval
and final mapped score position. Musical offsets are rational whole notes. Media
seconds retain their input number precision.

`coverage: 'full'` means the final boundary of this supplied traversal is anchored.
`'partial'` means some ending interval is unanchored. Neither proves that the recording
and score have identical repeat structures. Missing anchors can conceal differences;
point-count equality cannot validate correspondence. Out-of-range bar references are
rejected. True partial navigation visits are unsupported, with an explicit reason,
until correspondence to Soundslice's whole-bar coordinates is established. Full-bar
D.S./Fine boundaries are accepted because compiler metadata distinguishes them from
partial stops. The caller must not pair an unrelated compilation and traversal.

## Timing and boundaries

Interpolation uses `bar + offset / 480`. Sparse bars divide time evenly in that
coordinate system, then each fraction is multiplied by its resolved written bar span.
This deliberately gives two sparse bars equal time even when their meters differ.
Additional anchors refine the map inside a bar, including final-bar slowdowns.
`atAnchor` distinguishes a measured timestamp from an interpolated location; it does
not claim that missing note-level timings were measured.

Queries before the first or after the last anchor return `outside-coverage`. There is
no extrapolation into an intro, an unanchored final bar or an outro, and no media-duration
parameter that could accidentally stretch a final bar across trailing audio. The exact
last anchor remains queryable even when coverage is partial. End-of-bar positions
canonicalize to the next ordinal at offset zero; the score end is ordinal N / offset 0
for N performed bars. An offset-480 anchor in the last bar also denotes that end.
Hidden-playhead intervals still map and seek; callers suppress playback ink/follow
without deleting the timing data or changing editor selection.

All interpolation arithmetic interprets a number's decimal spelling exactly with the
existing rational arithmetic budget (512-bit canonical values). There is no tick grid,
clock quantization or accumulated floating cursor. Only `secondsAt` converts back to a
number. Source anchors round-trip exactly; the conformance suite bounds ordinary
interpolated media round trips to less than 1 nanosecond. Extreme decimal precision
beyond the arithmetic budget produces `resource-limit`, never a silent approximation.
Anchor lookup is logarithmic; build work is linear in anchors and source segments.

## Crossing to and from synth

Recording interpolation does not consult synth tempo, swing, grace allocation or
fermata duration. `positionAt` returns written metric offsets directly. In particular,
a bar-only map estimates straight within-bar movement; it does not claim to know the
recording's swing or grace onsets. Richer source anchors refine that estimate.

`toPerformance(scorePosition, edge?)` and `fromPerformance(expandedPosition)` bridge
through the compiler's source map **only for handoff**. Swing scales are applied or
removed there, never reapplied to media interpolation. Metric positions at a synthetic
hold/make-time insertion require an explicit `before` or `after` edge when seeking into
synth. A seek from within such an insertion returns `ambiguous-insertion`: a synthetic
hold fraction cannot reveal the corresponding recorded instant. At its ending edge,
normal metric mapping resumes. Barline insertions are recognized across the preceding
bar's end and next bar's start. Stealing grace has no separate inserted metric span;
this map cannot supply independently measured grace timing that the source lacks.

## Proof and next consumer

`harness/conformance/recording-sync.test.ts` uses hand-stated fixtures, no private audio
or Soundslice account. It covers sparse bars, pickups, meter changes, repeats, full and
partial D.S./Fine, fractional anchors, slowdown, hidden intervals, coverage, invalid
fields, ambiguous maps, resource limits, source snapshots and synth handoff. Storage
conformance proves invalid input leaves rows/revision unchanged and valid optional
fields/nonsequential data survive. Existing engraving and performance goldens remain
byte-identical; no verification record or approval obligation is added.

[Item 16](../roadmap/complete/core-player-recording-playback.md) consumes this map for
HTML media playback and source switching. A real media clock must drive `positionAt`;
running the synth clock silently beside it would violate this contract.
