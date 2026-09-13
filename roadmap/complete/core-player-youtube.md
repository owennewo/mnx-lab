# YouTube recordings — visible embedded playback with score sync

> **Status: complete 2026-09-13.** Implementation loop. Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 17.
> Needs [shared recording playback](../complete/core-player-recording-playback.md), item 16.

## Agreement block (campaign contract)

- **Pure before audible.** Reuse item 15's sync map and item 16's switching policy.
  YouTube's player time is authoritative; no second synth clock.
- **Time and identity.** Media seconds map to performed musical positions; navigation
  and score highlights keep their existing occurrence identities.
- **Proof.** Fake IFrame API adapter tests, browser layout/lifecycle checks and a
  separately documented live-embed check. Network-dependent checks do not become
  deterministic corpus verdicts. No engraving or performance golden changes.
- **Dependencies.** Official IFrame API, loaded lazily only for a selected YouTube
  source. No wrapper library, downloader, extracted audio or copied video asset.
  Measure both embed formats and document host CSP requirements.
- **Gain.** Use linked reference performances with the same score controls.

## Policy and layout contract

Recheck these primary sources at implementation and record the review date:
[minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality),
[developer policies](https://developers.google.com/youtube/terms/developer-policies),
[IFrame API](https://developers.google.com/youtube/iframe_api_reference).
Research on 2026-09-13 established:

- The player viewport must be at least 200 × 200 CSS pixels and accommodate controls;
  YouTube recommends 480 × 270 for 16:9. A narrow 16:9 box below 200px high fails.
- Keep the iframe visible and unobscured, including native controls, branding and ads.
  Put our score controls outside it. No overlays or background/audio-only player.
- Provide the identifying HTTP Referer and embed origin. The current
  `strict-origin-when-cross-origin` header is suitable; do not suppress it.
- Do not initiate automatic playback before visibility requirements are met. Source
  selection cues the video; initial playback requires user action. A playing handoff
  must also satisfy player visibility and browser autoplay rules.

Integrate a video region with the shared score frame that stays visible during score
follow on desktop and small screens. Pause when the document is hidden or the video
region is dismissed/hidden; do not shrink below the minimum to fit a collapsed tray.
Test scrolling, fullscreen, responsive layout and return from a hidden tab. Final
integration must also review applicable privacy disclosures, YouTube attribution and
site terms requirements; a 200px box alone is not the entire policy obligation.

## Adapter and failures

Parse supported YouTube URL forms into a video ID with an explicit host allowlist;
reject unrelated URLs and unsupported playlist/live cases with a useful reason.
Handle readiness, cued/playing/paused/buffering/ended states, API errors and blocked
playback. Follow actual `getCurrentTime()` and resample after seeks or resumed
visibility. Cancel stale callbacks on source/document change. Never derive score
progress from ad duration or assume a wall clock tracks content during interruptions;
verify actual API behavior in the live check and document its limits.

Use `getAvailablePlaybackRates()` and the accepted playback-rate event. Correct
Player.ts's existing claim that YouTube supports a universal 0.05 speed grid.
Keep volume units behind the adapter. Seek/loop latency and buffering mean YouTube
loops are best effort, not sample-accurate; show capabilities honestly to practice UI.

Extend CSP narrowly for the official API script and iframe origins; retain referrer
identity. Handle embedding disabled, removed/private content, network failures and
identity errors without falling back to extraction or an invisible player.

## Done when

A linked recording can switch with synth/audio at a mapped repeat occurrence, follow
inner-bar slowdown and seek from the score. Automated checks cover script load races,
state changes, rate negotiation, unavailable videos, disposal, minimum viewport,
unobscured layout and visibility pause. A live eligible embed is checked under the
production CSP with buffering/seeking and responsive behavior documented. Existing
synth/audio checks pass. No YouTube media is downloaded, proxied or stored.

Adding new links in Studio is [item 18](../inprogress/studio-recording-management.md).

## Implementation agreement and findings — 2026-09-13

YouTube selection is cue-only; Play is explicit. First use requires acceptance of the
component's displayed terms/privacy notice before loading any YouTube resource.
The shared frame opens a video-bearing strip; collapse/hidden-tab/offscreen/obscured
states pause and never automatically resume. Hosts get the frame in both embed
formats and must preserve visibility and their own privacy obligations.

The injected official-API port reuses RecordingBackend. It handles asynchronous cue
confirmation and accepted rates, and guards SDK getters which can be unpopulated
immediately after onReady. A cued target is usable for a paused handoff; playing time
comes from the API. Changing duration disables following rather than deriving a new
timeline. The documented API has no ad-state signal, and the live run received no ad;
that limitation is explicit in [the runtime contract](../../docs/player-youtube.md).

The real official example played, followed the repeated visit, sought from the score,
and retained valid desktop/narrow geometry under production CSP. Automated API/browser
checks cover loading races, retry, rates, buffering, hidden tabs and disposal. The implementation landed through `04b80ba`; 1,815 tests, scenario checks and the
production build passed. Both embed formats, Studio and workbench/review browser
checks passed, including an unmodified live YouTube embed. All 188 regenerated
goldens were unchanged, with no approval debt. The implementation worktree was
retired before this closeout. Final embed sizes are in the runtime contract.
