# Player element and host wiring

Implementation loop, player campaign item 7. `<mnx-player>` is registered by both
embed formats and `mnx-lab/elements`. It consumes item 5's exact `Performance` and
uses item 6's transport and native sink. There is no backend service or new runtime
dependency. It does not own the viewer's context or the editor selection.

The element supplies Play/Pause, Stop, rate (0.5–1.5), master volume and a scrollable
performed-order table. Table visits are displayed from 1; API ordinals and `at=`
links are zero-based. Each row identifies its written bar number and iteration.
The current row follows playback. The position readout uses a pure helper, including
inherited meter, authored bar numbers, and explicit hold/grace labels. Tenths of a
beat are display formatting only; the readout is not an incessant live-region announcement.

## Public contract

- `performance: Performance | null`, `documentId: string`, and optional
  `document: MnxStructure` (meter/bar-number formatting). Replacing the performance
  or document identity disposes the old transport and sources before installing new ones.
- `play(): Promise<void>`, `pause()`, `stop()`, `seek(ordinal): boolean`,
  `setLoop(region?)`, plus read-only `position` and `snapshot`. Seek selects the start
  of that performed measure; an absent ordinal returns false. Natural completion can
  be restarted with Play. The loop API is the seam for item 13, with no practice UI yet.
- `playback-state-changed` carries `{documentId, ordinal, highlight, playing}`;
  highlights are `{noteKey, ordinal}` written occurrences. Identical context updates
  are suppressed. `seek`, `onset` and `bar` are bubbling, composed events;
  onsets include the transport's scheduled audio time and written occurrence id.
- Audio creation/unlock happens on Play. Errors appear in an alert. Rate and volume
  are the only localStorage preferences. Volume is a smoothed master gain owned by
  `NativeSink.setVolume()`, independent of note velocities. No AudioContext or audio
  nodes are created by importing or constructing the player.
- Disconnect invalidates callbacks, clears live state, stops sources and disposes the
  owned sink/context. Reconnection installs a fresh transport; it never resumes itself.

## A plain-DOM host

```js
// ESM artifact; the IIFE exposes the same exports on window.MnxLab.
import { bindPlayback } from './mnx-lab.esm.js';
const playback = bindPlayback(commonAncestor, viewer, player);
playback.setDocument({ id: 'score', name: 'Study', lastUpdated: 0, mnxJson });
// Explicit inspection keeps its own identity while sound continues:
playback.inspect(2);
playback.follow();
// On document replacement, call setDocument again. On host teardown:
playback.dispose();
```

`bindPlayback` creates a `ContextProvider` on the supplied common ancestor and wires
sibling events. Its public provider subscription also handles an already-connected
viewer, which emitted its initial context request before the host installed the
provider. Disposal removes its event listeners and subscriptions. Both `embed.html`
and `apps/viewer-embedded/` demonstrate this wiring without workbench/edit imports.

The helper stops playback and clears context before compiling a replacement document.
It preserves inspection preference, not old ordinals or highlights. The workbench
performs the same lifecycle when an edit creates a new score revision. Stale asynchronous
player callbacks cannot stamp a replacement document.

A viewer `note-selected` event maps its key to performed candidates using item 2's
`chooseOrdinal`. The first click keeps the current candidate or chooses the next;
repeated clicks cycle, including multiple visits on the same iteration. This seeks
playback to a bar visit; it never programmatically changes editor selection. The
editor's own response to a user's click remains independent.

## Written view and review

The viewer consumes the ancestor's context. Playback ink uses `--mnx-playback`, with
a default blue from `light-dark()`, alongside the selection's enclosure/accent.
Playback changes toggle ink classes rather than recomputing layout. A repaint for
view, width, document or verse reapplies those classes. This works in notation, tab
and combined views. `revealOccurrence({noteKey, ordinal})` is public; it shares the
selection reveal's scroll calculation but never changes selection. Follow controls
viewer reveal and verse choice; inspection retains its separate value.

The scenario page mounts controls/table at the top of its existing side panel,
beside the engraving. It does not add an editor tray command or overlay the score.
`#/scenario/<id>?view=notation|tab|both&at=<ordinal>` seeks without autoplay; query
parameter order does not matter. An explicit later `at` navigation seeks again;
edits do not reuse an already-consumed old route ordinal.

The static `/verify` performance review generator embeds a self-contained player
bundle, the exact presented performance JSON and document formatting data. Listen
highlights the committed SVG projections and supports click-to-seek and optional
Follow. Starting another review player pauses the previous one. Receipt hashes and
MIDI downloads retain the original evidence contract; sound is not an approval.

## Proof

- Pure formatting tests and the element census pin registration on both build faces.
- `npm run smoke:embed` now exercises **both ESM and IIFE**: live playback, sibling
  context, inspection/Follow, repeated-click candidates, all three views, distinct
  selected/playback ink, stable SVG on clock ticks, public reveal, pause/rate,
  replacement and disposal.
- `npm run smoke:player` builds the workbench/review artifact and checks ordinal
  routing (including reordered parameters and later same-score navigation), unchanged
  editor selection, an actual edit stopping playback, a timed D.S. return, and Listen
  highlighting on the static review page.
- `smoke:audio` measures master-volume attenuation in the offline buffer as well as
  the existing onset/pitch/cancellation checks. `smoke:lib` remains Node-safe.
- Existing engraving and performance goldens remain unchanged. The 32-scenario
  performance/MIDI batch still awaits human review in the standing verification ledger.


## Unrolled presentation

The viewer now accepts `unrolled` independently of its notation/tab/both view.
Occurrence click events add `ordinal` while retaining the written `noteId`;
the host seeks that exact visit. `revealOccurrence` and playback paint address
only that occurrence when unrolled, and reject excluded partial-bar ink.
See [the unrolled contract](player-unrolled.md).

The Sound selector adds an explicit Guitar preset with lazy static samples.
See [sample packs](player-sample-packs.md) for the pack, host loader/base URL,
loading/error behavior and recorded-articulation limits.
