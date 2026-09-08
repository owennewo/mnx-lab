# Playback and inspection context

`model/playback.ts` resolves written measures and repeat iterations to **all**
performed ordinals. A D.S. may produce several candidates for the same iteration.
`chooseOrdinal` retains the current candidate, then chooses the next; wrapping
requires `explicitSeek`, and repeated clicks use `cycle`. Occurrence identifies
one visit to a written measure; iteration identifies its repeat context.

`elements/mnxContext.ts` exports `playbackStateContext`, `initialPlaybackState`,
`PlaybackState` and `PlaybackUpdate` through `mnx-lab/elements`. The pure helpers
and traversal are exported through `mnx-lab/model`. A common ancestor is the sole
context provider for viewer and player. The source `embed.html` demonstrates a
plain DOM host using Lit's `ContextProvider` and its explicit `hostConnected()`.

The host maintains live `ordinal` and derived `playbackIteration` separately from
`inspectionIteration`. Stopped playback uses null for both live fields and an
empty highlight list. Highlights carry `{ noteKey, ordinal }`; they never write
selection. `followPlayback` defaults true. Choosing inspection switches it off;
Follow restores it without seeking. While following live playback, the viewer
reveals highlighted ink; the later player element owns the public position reveal
API, including rests. The host sets `selectedVerse` from `verseForIteration` and
must assign undefined when the verse index is absent, clearing stale selection.

The workbench owns the provider and listens for `playback-state-change` with a
`PlaybackUpdate` detail. The later player must emit bubbling, composed events at
the audio-clock playhead, never at lookahead scheduling time. The host checks the
document id and ordinal and discards highlights for other ordinals. Document edits
clear live state; the player must invalidate its compiled revision before emitting
again. This seam does not implement transport or sound.

The selection chip shows inspection iteration on repeat documents only. Click to
cycle the current strain's declared iterations, or type `iteration N` in the rung
inspector. Written-order navigation never clamps that choice: skipped bars say
“not performed.” Live playback has its own label. Inspection is transient and does
not enter edit history, selection, or persisted display preferences.
