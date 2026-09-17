# Recorded audio playback

Implementation loop, player campaign item 16. The shared player can switch between
Synth and audio recordings supplied by a host. Studio lists existing audio rows in
the piece snapshot. Attaching recordings remains campaign item 18. YouTube playback is described in
[player-youtube.md](player-youtube.md).

## Host API

Use `bindPlayback(host, viewer, player).setDocument(document)` to supply both the
compiled performance and its written bar durations. Hosts compiling themselves must
set `performance`, `document`, `documentId` and `writtenBarDurations` together.

```ts
player.recordings = [{
  id: 'take-1', // unique within this document; "synth" is reserved
  kind: 'audio',
  name: 'First take',
  media: file, // Blob/File, or an HTTP(S)/blob URL owned by the host
  syncpoints: [[0, 1.2], [1, 5.4], [2, 9.8]],
}];
await player.selectSource('take-1');
await player.play();
player.pause();
await player.seekScorePosition({ ordinal: 1, metricOffset: { num: 0n, den: 1n } });
await player.selectSource('synth');
```

The adapter creates and revokes object URLs for Blobs; URLs supplied as strings stay
the host's responsibility. HTTP media must be browser-decodable and accessible to
that browser. Source descriptors and private audio are never written to localStorage.
Changing the document or disconnecting the player disposes the active source.
Changing descriptors while a recording is selected replaces that source through the
same guarded handoff. Removed selections fall back to Synth through that handoff.

`playback` is the common snapshot: source ID/kind, state, capabilities, effective
rate/volume, `scorePosition`, `mediaTime` for audio, readiness and actionable errors.
`scorePosition` uses performed ordinal and rational written metric offset. The older
`snapshot` and `position` remain synth views: audio has no Transport snapshot, and
legacy `position` returns zero. Hosts following recordings should use the common
snapshot or `scorePosition`, as the shared score frame does.

`playback-state-changed` retains the score-follow contract, including performed visit
identity and written-note highlights. The new `playback-position` event carries
`documentId`, `sourceId`, `kind`, `scorePosition`, optional `mediaTime`, `mediaPhase`
and anchored media bounds at clock updates. Audio never emits a synth `onset` event. Inspection and editing selection
remain independent of the playback context; clock updates repaint ink without
replacing the score SVG.

## Switching and timing

`PlaybackSession` owns one backend and invalidates obsolete selection/play operations.
It captures the musical position, disposes the old backend, prepares and seeks the
new one, and resumes only if playback was wanted. Rapid changes retain the original
handoff position; Pause, Stop and a new seek during preparation supersede that intent
or position. A rejected browser Play leaves a paused source with a retry message.

A handoff without a usable musical position, or within an ambiguous synth hold/grace,
does not invent one. The selected source stays paused and offers **Start this source**.
That explicit action starts audio and Synth at media/performance time zero. A recording
switched while its current clock is still in pre-roll likewise starts the new source at
zero and preserves playing intent. Unsynced audio is playable with following and score
seek disabled. Sync extending beyond the decoded file duration is treated as unusable.
An ordinary Play at natural completion restarts the source at zero.

The media clock is authoritative; no silent synth transport accompanies audio.
HTML media events and a 40 ms playing poll read `currentTime`. Buffering does not
advance an independent clock. Intro/outro outside anchor coverage is normal
**pre-roll/post-roll**, has no score position or highlights, and never becomes a sync
warning. The selected recording shows fixed-width, duration-labelled bookends before
the first and after the last system in notation, tab and combined views; the current
bookend is highlighted. Hidden intervals suppress score-follow ink. Bar-only
sync estimates note highlights by interpolation; event-level anchors refine it.
See [player-recording-sync.md](player-recording-sync.md) for tuple semantics,
performed bar numbering, coverage and insertion diagnostics.

Explicit bar seeks include synth grace/holds at the visit start. Handoffs require a
unique mapped position. A paused mapped seek updates the score without starting audio.
Source changes clear loops. `setScoreLoop({start, end})` takes score positions; the
older expanded-time `setLoop` bridges endpoints through the score map for recordings
and rejects ambiguous endpoints. Audio loops seek at the end and can have gaps;
Synth retains exact scheduling. Both expose rate and volume; part controls are a
Synth capability. Effective values returned by the backend drive the controls.

## Library media delivery

`LibraryClient.recordingUrl(id)` returns the same-origin authenticated route
`GET /api/library/recordings/:id/audio`. Every GET and HEAD checks current membership
and piece ownership before accessing R2. Only audio rows with stored blobs qualify;
YouTube/video rows and another owner's recordings return 404.

Single byte ranges support explicit ends, open ends and suffixes (206); unsatisfiable
ranges return 416 with `Content-Range: bytes */size`. Multiple ranges and unknown
units receive the full representation. HEAD returns full metadata without a body.
If-Range receives the full response because this endpoint advertises no validators.
Responses carry length, safe stored audio MIME (otherwise octet-stream), byte-range
support, `nosniff`, and private/no-store cache policy. R2 reads stream the requested
range instead of buffering the full file. CSP admits same-origin and Blob media;
YouTube policy changes belong to its own item.

## Evidence

- `harness/conformance/recording-playback.test.ts`: injected media lifecycle, clock
  mapping, hidden intervals, loops, rejected play, switching and cancellation.
- `harness/conformance/library-access.test.ts`: actual local D1/R2, signed identities,
  ownership/membership, response metadata, ranges and HEAD.
- `npm run smoke:embed`: both shipped embed formats, real generated PCM, repeat
  visits, source handoffs, rate, loops, source disposal and Blob URL revocation.
- After `npm run build`, `node harness/verify/recording-studio-smoke.mjs`: production
  Studio with a fixture LibraryClient and seekable HTTP PCM; source rows, frame
  readout, score seek and stopping the old piece during navigation.
- `npm run smoke:player`: existing synth behavior in workbench and static review.

The fixtures contain generated tones and authored timings, not private recordings.
Rendering/performance goldens remain byte-identical; this item adds no approval debt.
