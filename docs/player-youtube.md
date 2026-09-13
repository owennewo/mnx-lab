# YouTube recordings

Implementation loop, player campaign item 17. YouTube uses the official IFrame API
and the same recording sync map and session as audio. There is no download, proxy,
audio extraction, separate synth clock or YouTube account authorization.

## Hosts and source selection

```ts
player.recordings = [{
  id: 'reference', kind: 'youtube', name: 'Reference performance',
  video: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
  syncpoints: [[0, 1], [1, 6], [1, 9, 240], [2, 14]],
}];
await player.selectSource('reference');
```

`RecordingSource` is the audio/YouTube union; existing `AudioRecordingSource` hosts
remain compatible. `video` accepts an eleven-character ID or an allowlisted watch,
short, shorts or embed URL. Playlist and `/live` links are rejected. URL time offsets
are ignored: supplied sync anchors determine the recording's musical position.
Studio supplies existing `youtube` rows using `external_id`; adding links is item 18.

Before the first YouTube load in a player session, the component displays its YouTube
terms/privacy notice and requires **Agree and load YouTube**. No API script or iframe
loads before that action. Acceptance stays in memory, not localStorage. The notice
explains Google/YouTube requests, ads/cookies, local rate/volume preferences, the
host's source data and Studio library records; it links YouTube's terms and Google's
privacy policy and remains accessible beside the iframe. Integrators must cover
their own additional collection/sharing and deletion practices in their host policy.

Selecting YouTube cues at the mapped position and requires explicit Play, even when
the previous source was playing. This is a deliberate stricter autoplay policy.
Leaving YouTube uses the ordinary mapped handoff to synth/audio. Unmapped positions
retain the session's explicit-start behavior. Retry video replaces a failed adapter
while retaining the intended handoff position. Native YouTube Play/Pause controls
also update the shared playback state.

`ScoreFrame` now ships in both embed formats as well as the library. A frame opens its
player strip when a YouTube source/notice is selected. The video lives in a separate pane to the left of the score,
outside the score's scroll container. Drag its divider to resize from 200 pixels to
75% of the frame width. The focused divider also accepts Left/Right (20-pixel steps)
and Home/End (minimum/maximum). The iframe stays mounted while resizing, with a
minimum 200 × 200 viewport. Pointer dragging pauses playback and temporarily releases
the iframe pointer target, so crossing the video cannot swallow the drag. Releasing
the divider restores native interaction; Play resumes from the same position. Very narrow hosts below 267 pixels cannot satisfy both
limits; the 200-pixel minimum takes precedence, and visibility checks still apply.
Standalone players retain their inline video region. Collapsing pauses video; pressing Play from the
collapsed grip first opens the strip. Standalone hosts must supply enough visible
space and avoid clipping/covering the iframe. Small viewports with insufficient space
cannot start playback until the entire minimum viewport can be shown.

## Visibility, clock and capabilities

The frame initially reserves 320 pixels for video; a standalone player uses up to
480 × 270 CSS pixels. Both layouts keep each iframe dimension at least 200. Its native controls, branding, ads and fullscreen controls remain enabled.
Our controls are outside the iframe. Browser visibility checks include document
visibility, composed ancestors, full viewport bounds and hit-testing for obscuring
content. Hidden tabs, collapsed trays, offscreen/clipped frames or overlays pause
playback. Becoming visible does not resume automatically. Native iframe fullscreen
is recognized through shadow-root fullscreen state. Hosts still must not place
visual overlays over YouTube; the visibility guard is not permission to do so.

The adapter waits for API readiness and cue confirmation separately. Some getters
are unavailable until the SDK populates metadata, even after `onReady`; neutral
values are used until actual values arrive. A cued/paused target remains a usable
score position. During playback, actual `getCurrentTime()` samples drive the map;
buffering freezes the last sample, and seeking suspends following until confirmation.
Clock ticks never emit synth onsets or replace score SVGs.

Available rates come from `getAvailablePlaybackRates()`. Requests snap to that list;
the accepted playback-rate event controls the displayed value. Volume conversion
between 0–1 and 0–100 stays inside the adapter. Loop capability is seek-based, with
native latency and possible gaps. Nothing claims sample-accurate YouTube loops.

The official API exposes no documented ad-start/ad-end flag. We do not inspect
undocumented internals or derive timing from ad duration. Sync uses only reported
video seconds. A changing duration disables score following as unreliable (including
watch URLs which turn out to be live); `/live` URLs are rejected up front. This is a
conservative guard, not a complete live/ad classifier. Interruptions without a
separate API signal remain dependent on YouTube's reported content clock. The live
check below did not receive an ad, so it does not establish ad-specific behavior.

## CSP and policy review

Reviewed 2026-09-13 against the official
[minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality),
[developer policies](https://developers.google.com/youtube/terms/developer-policies) and
[IFrame API](https://developers.google.com/youtube/iframe_api_reference).
The implementation retains native presentation, requires visible playback, supplies
origin/referrer identity, and provides terms/privacy acceptance before loading.
This records the engineering review; external hosts remain responsible for their
own terms, privacy practices and layout.

`public/_headers` adds only these parent-page sources to the existing CSP:

- `script-src`: `https://www.youtube.com/iframe_api`,
  `https://www.youtube.com/s/player/`, `https://s.ytimg.com/yts/jsbin/`.
- `frame-src`: `https://www.youtube.com`.

The official script is an explicit trusted third-party script in the host origin.
There is no `unsafe-eval`, wildcard Google domain, extra parent `connect-src`, or
media-fetch permission. YouTube's cross-origin iframe owns its internal resources.
Embed hosts must supply equivalent CSP permissions and retain an identifying
Referer; the iframe and script use `strict-origin-when-cross-origin`, and the iframe
URL supplies the host `origin`. A host-wide `no-referrer` policy may still prevent
identification. API error 153 explains this; unavailable/private/embedding-disabled
videos and blocked/script-timeout states have separate actionable messages.

## Verification

`harness/conformance/youtube.test.ts` covers URL validation, unavailable initial
metadata, accepted rates, native pause, blocked play, disposal, readiness cancellation,
clock changes and event-level sync at a repeated bar. Existing recording tests cover
the shared handoff/session logic.

After `npm run build:embed`, run:

```sh
node harness/verify/youtube-smoke.mjs
MNX_EMBED_FORMAT=iife node harness/verify/youtube-smoke.mjs
node harness/verify/youtube-smoke.mjs --live
```

The deterministic browser runs intercept only YouTube requests with a small official-
API stand-in. They exercise script failure/retry, loading races, one script per page,
iframe geometry, source changes, confirmed seeking, hidden-tab pause, native
fullscreen, host occlusion and disposal under the production CSP. No real recording
is needed. `--live` performs no network substitution and must stay separate from
corpus verdicts. Existing `smoke:embed` still checks synth/audio in both formats;
`recording-studio-smoke.mjs` checks Studio source rows and HTTP audio playback.

Live check on 2026-09-13 used the official API example `M7lc1UVf-VE` on loopback under
the deployed header policy. Native Play advanced from the mapped second visit at
6 seconds to about 7.6 seconds with score ink; a score seek returned to 1 second.
Desktop viewport was 480 × 270, narrow viewport 276 × 202.5 (360px screen). Collapse
paused, and reopening through Play resumed. The API advertised rates from 0.25 to 2
in quarter steps. The test first exposed premature reads and gestures before cue
presentation; getters are now guarded and cue confirmation is awaited. No ad was
observed. Buffering, API rejection and rate negotiation also have deterministic tests.

Embed measurement (2026-09-13, including the newly exported shared frame; bytes):

| Artifact | Raw | Gzip |
|---|---:|---:|
| mnx-lab.js | 408,883 | 126,199 |
| mnx-lab.esm.js | 504,306 | 140,716 |

No wrapper dependency or media asset was added. The frame and its existing control
pads are included in both artifacts rather than relying on an unregistered host
element.
