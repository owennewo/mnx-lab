# The sync bar — making a recording's sync in the tray

Implementation loop, player campaign item 21
([roadmap/inprogress/studio-sync-bar.md](../roadmap/inprogress/studio-sync-bar.md)).
Recording playback is [player-recordings.md](player-recordings.md); the tuple format and
the sync map are [player-recording-sync.md](player-recording-sync.md).

The tray's bar is the **rail**: one column per written bar. Where a host opts in, a
two-state toggle beside the readout swaps it for the **sync bar**: the recording's whole
length in the same slot at the same size, divided by **cut lines** into **segments** of
whole beats. It exists to author a Soundslice-format sync from nothing.

## The model (`src/model/syncSegments.ts`)

`SyncSegments` is `cuts` (media seconds, strictly increasing), a `closed` flag, one
`segments` entry per span and the `beat` unit as a fraction of a whole note. It knows
nothing of the score. Pure, Node-safe and shared with the Worker.

- `cuts[0]` is the **start handle**; with `closed`, the last cut is the **end handle**.
  Everything outside them is unsynced — pre-roll and post-roll, the same words the
  bookends use.
- A segment with a cut at both ends stores a **whole beat count**; its tempo is derived and
  never stored. The **open** segment (the last one, before the end handle is placed) has no
  far end to count to, so it alone stores a `bpm`.
- `placeStart`, `placeEnd`, `splitAt`, `moveCut`, `removeCut`, `setBeats`, `setBpm`,
  `renameSegment` each return a new value, or the same value when the request makes no
  sense. `splitAt` lands on the nearest beat and both halves keep the tempo, so a split moves
  no beat. `moveCut` re-counts each closed neighbour at its old tempo, so a nudge never
  changes a count and a long drag does.
- `beatTimes(doc, from, to, mediaEnd)` lists every cut and every beat in a window — what the
  click sounds and the zoomed bar draws.
- `syncpointsFromSegments(doc, barBeats, mediaEnd)` derives the tuples: one point per
  performed bar start the beats reach, plus an inner-bar point where they end. **Never a
  sparse pair** — the sync map gives sparse bars equal time, which is wrong across a pickup
  or a meter change. Beats stop at the first segment without a tempo. No bars, no tempo or
  fewer than two points derives `null`.
- `decodeSyncSegments` validates stored or received values; `defaultBeatUnit` gives a dotted
  quarter in compound meters and the signature's unit otherwise. There is no control for the
  beat unit yet.

## The element (`src/elements/SyncBar.ts`, `<mnx-sync-bar>`)

It edits a `segments` value and owns nothing else. Properties: `segments`, `duration`,
`time`, `rate`. Events: `sync-change` `{ segments, commit }` (`commit: false` while a drag
is still moving), `sync-seek` `{ seconds }`, `sync-loop` `{ start, end } | null`.

- A click on the bar seeks; a double-click splits there. A segment's **label** selects it.
  A split keeps the zoomed window it was made in; selecting a segment by its label zooms out.
- The two trim handles are parked at the bar's ends until placed. A handle or cut is
  dragged, or selected and sent to the playhead. There is no cut button.
- Beat ticks are drawn whenever the window holds 160 or fewer, zoomed or not — past that they
  would be a grey wash, so a whole song shows none until it is zoomed. A mouse over the track
  shows a card over the label strip: the segment, the beat within it and its count, the time,
  and the tempo (or the unsynced region's name and the time). A finger never shows it.
- Selecting a placed cut **zooms** the bar to a 16-second window around it; a hairline under
  the bar shows where the window sits. There is no zoom button. A
  drag is measured as a delta in the window the cut will be shown in, so selecting and
  dragging in one gesture does not jump.
- The selection's controls are one row above the tray. Cut: time, ±1 and ±10 ms, To
  playhead, Loop (1.5 s before to 1 s after), Remove. Segment: name, the count or the tempo
  with minus and plus, Tap, Split at playhead. A tapped tempo is divided by the playback
  rate, so tapping against a slowed recording gives the recording's own tempo.
- Keys, while focus is in the bar: arrows nudge 25 ms (Shift 100 ms), Enter sends the cut or
  handle to the playhead, Delete removes, S splits at the playhead, T taps, L loops, Escape
  lets go. Space plays or pauses — the player's binding, which holds anywhere in the tray. Nothing
  is bound globally.

## The player

`syncEditable` (off by default; the workbench never sets it) offers the toggle while a
recording is the source. In sync mode the readout prints recording time and one button is
added: the click. The player:

- seeks and loops the recording in **media seconds** (`RecordingBackend.seekMedia`,
  `setMediaLoop`) — score positions cannot be used while the map is what is being made;
- derives the tuples on every committed change from the segments and
  `writtenBarDurations`, and swaps the live backend's map in place
  (`RecordingBackend.replaceSync`), so the score follows the edit without the source being
  torn down. A loop is held in media seconds and survives the swap;
- emits **`sync-edit`** `{ sourceId, segments, syncpoints }` for the host to store. When the
  host's save comes back through `recordings` with the syncpoints already applied, the
  source is **not** reselected;
- warns before an imported sync, which has no segments to reopen, is replaced.

`BackendSnapshot.mediaDuration` reports the decoded length with or without a sync, and
`RecordingSource.syncSegments` carries stored segments in.

## The click

`src/audio/clickSchedule.ts` is the arithmetic, under Node: `MediaClockEstimate` fits a line
through the media clock's readings (jitter is absorbed at 10% a reading; a disagreement over
120 ms, a rate change or a pause re-anchors), and `ClickWindow` hands each beat in a 200 ms
lookahead to the audio clock exactly once, re-arming after a seek backwards.
`src/audio/native/click.ts` is the oscillator: it samples the estimate only when the reading
changes, so a port that refreshes ten times a second is not mistaken for a stalled one. Cuts
click higher than beats. A constant offset between a source's reported and audible time is
harmless, because score following reads the same clock.

## Storage

Studio saves through the existing recording route with
`rawSync: { format: 'studio-sync-segments', segments, syncpoints }`. `attachmentSync`
validates both halves; the segments become the row's `provenance` (format
`studio-sync-segments`) and the tuples its `syncpoints`, so every reader of a sync is
unchanged and **no migration** was needed. `storedSyncSegments(provenance)` reads them back.
A score with no bars yet saves `syncpoints: null` and keeps its segments. Saves are debounced
700 ms and serial; a revision conflict is retried once on the fresh revision, because the
segments are still the reader's latest intent.

**The segments are the sync; the tuples are a cache** (2026-09-17,
[studio-sync-rederive](../roadmap/inprogress/studio-sync-rederive.md)). The tuples were
derived against the bars the score had when the sync was last touched, so bars written since
— or a meter changed, or a repeat added — leave them stale. Whenever a source has segments,
the player ignores its stored tuples and derives them again from the segments and the bars
as they are now (`playingSyncpoints`, `src/model/syncSegments.ts`): when it builds the
source's sync map, which it does again for every new performance, and once more when the
media's length is known, because an open last segment runs to the media's end. No bars yet
is *not synchronised*, never yesterday's tuples. When what plays is not what is stored, the
player emits **`sync-refresh`** — the same detail as `sync-edit` — and Studio writes it back
through the same debounced path, so the row stays honest for a reader that has the recording
and not the score. Playback never waits for that write.

**An imported sync cannot be re-derived** — Soundslice tuples address performed bars by
index — so it carries the *shape* it was last known good for instead: each performed bar's
length, run-length encoded (`performedShape`, `src/audio/scoreShape.ts`; a 12-bar blues with
a 2/4 turnaround is `11x1/1,1x1/2`), kept as `scoreShape` in the recording's provenance
beside whatever else is there. Nothing stamps it on the way in — the operator ingest knows no
score — so Studio does on first sight (`PUT …/recordings/:id` with `scoreShape`, which
touches neither the tuples nor the rest of the provenance; a new sync forgets the stamp).
From then on a bar inserted, a repeat added or a re-export with different bars shows in the
Source sheet as *may be out of date*, with the way out: make a new sync in the sync bar. The
stored evidence is never rewritten.

## Evidence

- `harness/conformance/sync-segments.test.ts`, `click-schedule.test.ts`, and the added cases
  in `recording-playback.test.ts` and `recording-management.test.ts`.
- After `npm run build`, `npm run smoke:sync-bar` (`harness/verify/sync-bar-smoke.mjs`):
  production Studio, a fixture client and real PCM; `SYNC_BAR_SHOT=<file.png>` writes a
  screenshot.

Not checked by any of these: the click against a real YouTube clock, and the bar on touch.
