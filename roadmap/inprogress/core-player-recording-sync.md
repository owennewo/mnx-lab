# Recording sync — media seconds to performed score positions

> **Status: in progress 2026-09-13.** Implementation loop. Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 15.
> Needs the existing traversal and performance source map (items 1, 3 and 5).

## Agreement block (campaign contract)

- **Pure before audible.** A Node-safe tuple decoder in `model/`, shared with Worker
  validation, and bidirectional score sync in `audio/`; no media objects, network,
  DOM or storage imports. This promotion avoids a Worker → audio boundary violation.
- **Rational time.** Score positions remain rational. Recording seconds are measured
  external input, preserved as such under the campaign's recording addendum. They do
  not replace the synth tempo map or enter existing performance goldens.
- **Identities.** A sync bar addresses a performed ordinal, never a written bar label,
  occurrence count or iteration. The editor and inspection state remain untouched.
- **Proof.** Hand-stated conformance fixtures for decoding, interpolation, inverse
  seeking and diagnostics; no new scenario golden or approval mechanism is planned.
- **Dependencies.** No new runtime dependency. Reviewer gain: expose sync mismatches
  against our traversal; practice gain: follow real expressive performances.

## Established format and evidence

The [Soundslice data API](https://www.soundslice.com/help/data-api/#syncpoint-data-format)
was checked 2026-09-13. A point is `[bar, seconds, offset?, hidePlayhead?]`:

- Bar is zero-based in the order obtained by expanding repeats and jumps.
- Seconds address the recording; offset defaults to zero and spans 0–480 across the
  **whole bar**, regardless of meter. It may be fractional; 240 means halfway.
- The fourth value is 0 or 1 and controls hiding the playhead from that point.
- Sparse bars are allowed. An anchor at ordinal N can mark the end of N played bars.

The local `~/dev/soundslice-cli/gp/files/` inspection found 84 exports, 103 recordings,
9,375 two-value points, 15 three-value points and two four-value points. Romanza has
five inner-bar anchors in performed bar 62, including fractional offsets; Jesse has
an offset-360 anchor in each of two recordings. These are discovery evidence, not
portable test dependencies: commit minimal attributed timing fixtures or hand-stated
counterparts, never require the private cache or redistribute its media.

## Work

Preserve raw syncpoints and decode a typed normalized map. Use piecewise interpolation
in performed-bar coordinates (`ordinal + offset / 480`) between anchors, then resolve
into the score's metric position. Provide the reverse map for seek and source switching.
Within-bar motion without additional anchors is inferred, not event-accurate evidence.
Additional anchors refine the interpolation and naturally express a last-bar slowdown.
They locate musical positions, not note IDs.

Specify the bridge from bar fractions through partial performed entries and the
performance source map. Cover variable meters, pickups, swing, grace insertion and
fermata holds: recorded timing must not receive a second layer of synth expression.
If a Soundslice bar cannot be aligned with our partial-entry traversal, diagnose it;
never silently reinterpret the anchor. Resolve this with a small fixture before
committing the mapping API.

Replace the count-equality rule in `docs/studio-storage.md`: point count is neither
bar count nor compatibility proof. Validate finite ordered times, bar bounds, offsets,
flags, coverage and optional end markers. Sparse anchors cannot prove that an
unobserved repeat structure matches; report the scope of validation honestly.
Strengthen the existing storage validator without dropping optional fields or
silently rewriting imported data.

Define behavior for intro time before the first anchor, missing final anchors, outro,
exact bar boundaries, duplicate positions/times and hidden-playhead intervals. Do not
invent a final-bar duration from total media length when an outro may follow. A seek
into an ambiguous or unmapped region returns a reason. Soundslice also documents
[nonsequential sync](https://www.soundslice.com/help/en/creating/syncing/276/nonsequential-syncpoints/);
first delivery may diagnose it as unsupported, preserving raw data. No backwards bar
maps occurred in the inspected cache. Freeze the initial support policy in tests.

## Done when

Decoder and both mapping directions pass fixtures covering straight and repeated bars,
sparse anchors, meter changes, partial entries, fractional offsets, final-bar slowdown,
end markers, invalid data, hidden intervals and ambiguous seeks. Boundary and
round-trip tolerances are declared. Existing synth performance and engraving goldens
remain byte-identical. Documentation distinguishes validated, partial and unsupported
sync instead of claiming a match from counts alone.

Next: [audio playback and source switching](../proposed/core-player-recording-playback.md).

## Implementation agreement — 2026-09-13

The first map accepts the compilation result (Performance plus nonserialized full
written bar durations) and its matching PassModel. Actual partial-stop bounds or
nonzero partial-start bounds are diagnosed as unsupported:
Soundslice's whole-bar fraction does not establish correspondence with our partial
visits. Full-bar jumps and pickups use their resolved written span. The compiler
returns full written durations beside the performance, leaving serialized goldens
unchanged; this avoids duplicating its duration walker. Compiled
source segments bridge metric offsets to synth positions only for handoff; no synth
tempo, swing or inserted hold duration drives media-time interpolation. Seeking from
inside a synthetic insertion is ambiguous; seeking to its metric anchor requires an
explicit before/after edge when crossing to synth.

Storage validates tuple shape only and retains valid but unsupported maps. Playback
requires strictly increasing times and musical coordinates (no sorting or deduping),
a first anchor at bar zero, and explicit coverage. Outside the anchored interval there
is no extrapolation. Full coverage means the final boundary is anchored, not that a
recording's unseen structure has been proved identical to this score.

## Implementation and validation

Implemented API and boundary policies are documented in
[docs/player-recording-sync.md](../../docs/player-recording-sync.md). The targeted
sync suite has 25 passing tests; storage conformance preserves optional fields and
unsupported source evidence while refusing malformed numeric values. Regeneration
passed all 188 primitive/performance/unrolled checks with a clean scenario diff.
No human verification record or scenario golden changed. Full landing gates and
worktree retirement precede moving this item to `complete/`.
