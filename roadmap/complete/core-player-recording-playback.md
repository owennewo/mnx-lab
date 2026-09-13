# Switch between synth and recorded audio

> **Status: complete 2026-09-13.** Implementation loop. Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 16.
> Needs [recording sync](../complete/core-player-recording-sync.md), item 15, and the existing player.

## Agreement block (campaign contract)

- **Pure before audible.** Position mapping and switching policy are pure/testable;
  browser audio owns media playback. Retain the existing synth Transport and Sink.
- **Rational time and identity.** Handoff uses performed ordinal plus metric offset,
  bridged through the source map, never seconds copied from one recording to another.
- **Proof.** Fake backend lifecycle tests and browser media tests, plus both embed
  formats and the existing synth smoke. Existing scenario goldens stay unchanged.
- **Dependencies.** Native HTML audio, no new runtime library; browser code stays out
  of pure audio imports. Studio storage enters through the host, not `elements/`.
- **Gain.** Listen to an existing recording while the same score follows and seeks.

## Existing seams

`src/elements/Player.ts` directly owns Transport and NativeSink. Its public controls,
`playback-state-changed` and `bar` events already feed occurrence-aware score follow
through `playbackHost.ts` and `mnxContext.ts`. Performance measures carry performed
ordinals and partial-entry bounds. Storage already holds recording rows and raw sync
JSON; the piece snapshot includes them. `LibraryClient` needs typed recording access,
and uploaded media needs an authenticated read route: storage alone is not playback.

## Work and user behavior

Introduce a small backend interface over play, pause, stop, seek, rate, volume,
position/state, capabilities and disposal. Wrap the synth transport; add HTML audio.
Keep the musical position and score-follow contract shared, without pretending a media
backend has scheduled synth onsets. Preserve existing public event semantics or make
any new media-position event explicit. Do not fabricate synth audio-time evidence.

A source selector lists **Synth** and named recordings. Synth instrument/preset choice
stays within Synth. Switching captures the current musical position, pauses the old
source, invalidates pending callbacks, readies and seeks the new source, then resumes
only if previously playing and browser permissions allow. A rejected play request
leaves an actionable paused state. Only one backend may sound. Paused switches remain
paused; rapid switches, document replacement and disconnect cannot revive old media.
An unmappable handoff reports why and offers an explicit start position; it never
silently jumps to another repeat occurrence.

The media clock is authoritative. Poll/render position from actual media time and
respond to seeking, waiting, ratechange and ended events. Do not run a silent synth
transport beside the recording. Keep view/inspection/selection independent. At bar-only
resolution, highlights are estimated from the map; hidden intervals suppress follow
ink as defined by item 15. Buffering freezes progress instead of advancing a wall clock.

Support volume, rate and basic seek using backend capabilities; show the effective
rate. Keep existing loop API behavior explicit, including seek-based media loop gaps.
Practice automation belongs to item 13. Mute/solo of score parts is a synth capability,
not something an ordinary recording can supply.

Wire existing library recordings into Studio's piece page and shared score frame.
Provide owner-checked media delivery with correct MIME, byte ranges (206/416), length
and cache/auth behavior so seeking does not require downloading the entire file first.
Expose portable source descriptors to embed hosts; workbench remains static and may
use host/local fixtures. Browser-local Files may use revocable object URLs. Adjust CSP
for local media as needed without admitting YouTube until item 17.

## Done when

An ingested audio recording follows both written and unrolled score views; score seek
selects the exact repeat visit. Synth ↔ audio and audio ↔ audio handoffs preserve mapped
musical position, pause state and effective controls. Fixtures exercise rate changes,
buffering, intro/outro, loops, stale callbacks, blocked play and disposal. API checks
cover ownership and range reads; browser checks exercise a real seekable audio fixture.
No real account or private media is needed for routine tests.

Persistent attachment creation is [item 18](../complete/studio-recording-management.md).
YouTube is [item 17](../complete/core-player-youtube.md); neither is required to play existing audio.

## Implementation agreement — 2026-09-13

The shared backend snapshot reports a written score position, source-clock state and
capabilities. A pure session owns source selection, readiness, musical-position
handoff and cancellation. Native adapters own Transport/NativeSink or HTML audio;
there is only one active adapter. Media emits position updates, never synth onsets.
The existing `snapshot`/`position` getters retain their synth-only meaning; a new
`playback` snapshot and `scorePosition` serve all sources. The shared frame uses the
new position label rather than interpreting media seconds as expanded synth time.

An unmappable handoff selects the target paused and requires an explicit start action;
well-shaped recordings without usable sync can play with score-follow/seek disabled.
Source switches clear loops; the existing expanded-position loop API maps endpoints
to score positions for recordings and diagnoses ambiguous holds or missing coverage.
Media loops are seek-based, with possible gaps. Typed host descriptors may use an
HTTP/blob URL or a Blob whose object URL the adapter owns. Studio consumes existing
audio rows; YouTube and attachment authoring remain items 17 and 18.

## Implementation and evidence — 2026-09-13

Implemented the pure backend/session contract, NativeSink/Transport adapter, HTML
media adapter, common score-position bridge, source selector, portable descriptors,
Studio row wiring and owner-checked R2 audio route. The host/API and behavioral
contract is [docs/player-recordings.md](../../docs/player-recordings.md).

Lifecycle and real D1/R2 tests cover cancellation, media clocks, explicit unmapped
starts, authorization and ranges. Both embed formats exercise generated PCM and
source handoffs, including repeat visits and Blob cleanup. Production Studio's
fixture smoke covers HTTP seeking and navigation while audio is playing. Existing
synth smoke and 188 regenerated corpus goldens remain unchanged. All 1,803 tests, scenario checks and the production build passed after rebase.
Both embed formats, the Studio HTTP smoke and workbench/review synth smoke passed.
Implementation commits `c19e538` and `24eca08` were fast-forwarded and pushed to
`main`; the implementation worktree was removed before this document moved to
`complete/`. No golden changes or human verification debt were added.
