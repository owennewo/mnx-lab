# Player element and host wiring

Implementation loop, player campaign item 7. `<mnx-player>` is registered by both
embed formats and `mnx-lab/elements`. It consumes item 5's exact `Performance` and
uses item 6's transport and native sink. There is no backend service or new runtime
dependency. It does not own the viewer's context or the editor selection.

The element supplies Play/Pause, Stop, a rail over the written bars, rate
(0.25×–2× in 0.05 steps), and master volume. API ordinals and `at=` links are
zero-based. The position readout prints the place as one dotted number — `# 21.4` is
bar 21 beat 4, `# 21.4.5` half a beat in, so bar, beat and sub-beat read together — plus
an explicit hold/grace label when the playhead is inside one. The readout uses a pure
helper, including inherited meter and authored bar numbers. Tenths of a beat are display
formatting only; the readout is not an incessant live-region announcement; its accessible
name carries the full label, pass included.

**The rail** (locked on the *Playback Tray* canvas, 2026-09-13) replaces the range slider:
one column per written bar, one lane per visit to it, so the rail reads left to right like
the page and a repeated bar stacks its passes. The lit lane is the playhead, played lanes
carry the accent dimmed into the ground, and a click on any lane seeks to that visit —
which is what the pass menu and, before it, the performed-order table were for. Hovering
or focusing a lane shows its card: `Verse · # 10 · pass 1 of 2`. Lanes are keyed on the
visit's `occurrence`, which counts from 1 and never repeats; the strain `iteration` resets
when a jump fires, so a D.S. return would otherwise read `pass 2 of 2` twice. Under a jump
a column simply gains lanes, and a lane reached by the jump carries a thin inner outline;
a bar the walk never reaches keeps its column, empty; a visit that covers part of a bar
(a jump or Fine mid-bar) draws a shorter lane when the host supplies `writtenBarDurations`.
Section labels come from the global measures' `section` labels, with a hairline at each
section's first bar.
The lane column's height follows the piece's deepest stack of visits — 6px per lane plus
2px gaps, from 14px for a piece without repeats up to a 38px cap (five passes) — so the
tray thickens only when the piece demands it; past the cap the lanes share the height and
the hover card carries the count. Below the score frame's ~1000px breakpoint the tray stacks: transport
and readout, the rail on a line of its own without labels, then the settings.

Rate and volume are value buttons — a glyph and the current value — and each
control opens in an overlay above the tray: rate has preset chips (`0.25×` … `2×`, or the
backend's own discrete rates) and the fine slider; volume has a mute toggle and the slider.
The overlays close on click-away or Escape. **Space plays or pauses** whenever focus is inside the
player — after a click on the rail (it takes focus), in the sync bar, or on any tray button — except
in a text field. It overrides a focused button's own Space activation on purpose (Enter still presses
the button). Focus in the SCORE plays too, by the same rule and for the same reason: the viewer
reports the keystroke as `transport-toggle` — the two-finger tap's event — and the host calls
`toggle()`. The two scopes are disjoint, so nothing fires twice, and the editor keeps `N` for
note entry rather than Space (`src/edit/keymap.ts`). The Sound selector sits beside them unless the
host sets `soundControl = false` — studio does, because its Instruments sheet chooses a
sound per part, and the rail gets the room. Likewise the Source select (and the host's
`source-tools` slot beside it) shows unless `sourceControl = false`; studio chooses what
plays in its Source sheet and calls `selectSource()`, which behaves the same either way.

## The part mix

`partMix` (src/audio/partMix.ts) is a per-part level, mute and sound keyed by part index,
beneath the master volume: the tray's volume stays the whole mix, a part's level sits
under it. The native sink routes each voice through its part's bus (`voiceBus`, a gain
per part, smoothed like the master), so a level or mute change is live and never pauses;
a sound change pauses, loads the packs the parts now use and resumes, as the Sound
selector always did. A part with no entry plays at full level in `voicePreset`; kit voices
stay on the synth whatever the part chooses. Synth only — a recording has no parts
(`capabilities.parts`), so a host disables its mix controls while one plays. Hiding a part
from the score is the viewer's `hiddenParts`, and never silences it.

## Public contract

- `performance: Performance | null`, `documentId: string`, and optional
  `document: MnxStructure` (meter/bar-number formatting). A new performance for the **same**
  `documentId` is an edit and keeps the session (below); a new `documentId`, a performance
  appearing or vanishing, or new sample options dispose the old transport and sources
  before installing new ones.
- `play(): Promise<void>`, `pause()`, `stop()`, `seek(ordinal, metricOffset?): boolean`,
  `setLoop(region?)`, plus read-only `position` and `snapshot`. Seek selects a BEAT of
  that performed measure — `metricOffset` is where in the written bar to land, clamped
  to the visit's own `from…until` so a mid-bar segno cannot be seeked outside of.
  Omitted, it selects the measure's start, which is what every seek did before presses
  began naming the moment they landed on. An absent ordinal returns false. Natural completion can
  be restarted with Play. The loop API is the seam for item 13, with no practice UI yet.
- `playback-state-changed` carries `{documentId, ordinal, highlight, playing}`;
  highlights are `{noteKey, ordinal}`. Most are written occurrences — one per visit to
  a note. RESTS are in the list too and are not: a rest sounds nothing, so it is absent
  from the compiled performance, and the player intersects the written position it
  already reports with the document's rests (`model/restSpans.ts`) so the playhead can
  stand in a silence. A rest's key is the one the layouts stamp on its glyph, so the
  same paint lights it, in its own voice's colour. The TAB staff draws no rest by
  convention, so it would have nothing to light: the layout puts an invisible pill on
  its centre band spanning the rest's duration, drawn hollow and dashed by the viewer's
  stylesheet only while the playhead is inside it. The pill carries `data-playback-id`
  rather than `data-source-id` — it exists for the playhead alone, joins no selection
  and answers no click — and is emitted under `durationSpans`, the flag the viewer
  passes and the goldens never do, so the committed engraving is untouched.
  Identical context updates
  are suppressed. `seek`, `onset` and `bar` are bubbling, composed events;
  onsets include the transport's scheduled audio time and written occurrence id.
- `voicePreset`, `partMix` and `soundControl` — the sound every unmixed part plays, the
  per-part mix above, and whether the tray offers the Sound selector.
- Audio creation/unlock happens on Play. Errors appear in an alert. Rate and volume
  are the only localStorage preferences. Volume is a smoothed master gain owned by
  `NativeSink.setVolume()`, independent of note velocities. No AudioContext or audio
  nodes are created by importing or constructing the player.
- Disconnect invalidates callbacks, clears live state, stops sources and disposes the
  owned sink/context. Reconnection installs a fresh transport; it never resumes itself.

## An edit keeps the session

[core-player-live-edit](../roadmap/complete/core-player-live-edit.md). Every edit hands the
player a new performance. Until 2026-09-19 that took the same path as opening another file:
the session was disposed and a fresh one started on the synth — the AudioContext closed and
its sample packs refetched, the audio element or YouTube iframe removed, the source silently
reset. Now the player tells an edit (same `documentId`) from a new document and, for an edit,
keeps the session and hands the live backend the performance in place.

**A host must not stop it on the host's side either.** Only `playbackHost.ts` was converted
in 2026-09-19; the workbench's scenario page kept its own pre-item-22 path and went on
calling `stop()` and nulling the ordinal on every keystroke, so a workbench edit silently
ended playback. It was also self-defeating: the stop published its own frame after the clear
and put the ordinal straight back, so the state that path asked for never survived its own
call. Fixed 2026-09-20 — both shells now re-resolve the ordinal and leave the transport
alone.

The backends:

- `RecordingBackend.replacePerformance` rebuilds the written index and swaps the sync map.
  The media port is untouched and position is media time, so nothing moves. The player
  derives the sync again against the bars as they are now — the sync bar's live segments,
  the stored segments, or an imported sync's tuples — as the factory does on first
  selection, and emits `sync-refresh` when the stored tuples no longer match.
- `SynthBackend.replacePerformance` rebuilds the transport (pure derivation) over the same
  sink, keeping the context and the sample banks. The place carries over by score position,
  bar and offset, and the state with it: playing plays on, paused stays. A place the new
  performance no longer has, or a stopped transport, starts at the beginning, stopped. A
  loop is not carried.
- The session's factory reads the player's performance when it is called, so a later
  source change sees the score as it is now. Source, rate, volume, sync mode and live
  segments are untouched.

The playback host (`bindPlayback`'s `setDocument`) makes the same distinction: an edit no
longer stops the player or nulls its performance, and re-derives the playback ordinal's
iteration against the new traversal.

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
playback to the pressed note's own BEAT within that visit, not to the bar's first —
landing on the barline reads as the scrubber ignoring a press that was already inside
the bar it is playing. A press that is not on a note seeks the same way through
`position-selected`, whose `columnKey` names the nearest drawn moment: that is how a
press on a REST seeks, since a rest is not in the layout's activation index and never
becomes a `note-selected` at all. Both paths resolve the beat through one helper,
`elements/scoreSeek.ts`. Neither ever programmatically changes editor selection; the
editor's own response to a user's click remains independent.

## Written view and review

The viewer consumes the ancestor's context. Playback ink uses `--mnx-playback`, with
a default blue from `light-dark()`, alongside the selection's enclosure/accent.
Playback changes toggle ink classes rather than recomputing layout. A repaint for
view, width, document or verse reapplies those classes. This works in notation, tab
and combined views.

Two things ride on that paint (`src/engine/render/playbackInk.ts`):

- **One colour per voice.** Every lit node carries `data-playback-voice`, the note's
  sequence index within its staff (1-based, cycling past four). Voice 1 is
  `--mnx-playback`; voices 2–4 default to green, amber and magenta at the same
  lightness and chroma, overridable with `--mnx-playback-2` … `-4`. A single-voice
  part therefore looks as it always did.
- **A fret mask as long as its note.** On a tab staff the digit's paper mask is the
  lamp: the paint stretches it to the note's release, tinted with the voice colour,
  and the digit sits on it in full colour. The layout records where each mask's note
  ends only when asked (`durationSpans`, which the viewer sets and the goldens never
  do — `RectPrim.spanEndX`, emitted as `data-span-end` in px); the paint stashes the
  emitter's geometry on the element and restores it when the note stops. A held bass
  under a moving melody shows each string's own length. The stretched mask is padded
  (0.3× its height on the left, 0.1× above and below — enough that a chord's masks on
  adjacent strings meet, an accepted trade), and its tint is stronger on dark paper
  (40%) than on white (22%), where a lighter mix already reads. `revealOccurrence({noteKey, ordinal})` is public; it shares the
selection reveal's scroll calculation but never changes selection. Follow controls
viewer reveal and verse choice; inspection retains its separate value.

The scenario page mounts controls/table at the top of its existing side panel,
beside the engraving. It does not add an editor tray command or overlay the score.
`#/scenario/<id>?at=<ordinal>` seeks without autoplay; query
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

Recorded audio sources, musical-position handoffs, media delivery and the common
`playback` snapshot are documented in [player-recordings.md](player-recordings.md).
The rail seeks performed visits in either backend.
