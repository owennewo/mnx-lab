# Recording bookends — pre-roll, post-roll and honest sync diagnostics

> **Status: in progress 2026-09-17.** Implementation loop. Player campaign item 19;
> follow-up to recording sync, playback, YouTube and Studio recording management.

Soundslice sync points anchor score positions inside a recording; they do not claim that
the score begins at media time zero or continues to the end of the file. Time before the
first anchor is **pre-roll** and time after the last is **post-roll**. Both are normal media,
not malformed sync. Soundslice represents them as duration-labelled blank bookends spanning
the complete rendered system. MNX Lab's map already refuses to extrapolate through those
regions, but the playback adapter promotes that normal `outside-coverage` result to a
`syncIssue`. Studio consequently calls an ordinary intro a “sync warning.” Normal Play and
Stop also seek to the first anchor, making the pre-roll impossible to hear.

The same review found a separate metadata error: operator ingest writes Soundslice's
`cropped_duration` into the generic `recordings.duration_s`. The player does not use that
field—it correctly reads the native media duration—but the stored value is not a trustworthy
full-file duration and should not make that claim.

## Agreement

- A recording clock has four presentation states: **pre-roll**, **mapped**, **post-roll**
  and **unavailable**. Pre/post-roll have media time but no score position. They clear score
  ink and following without becoming a diagnostic.
- Invalid tuple shape/order, traversal incompatibility, an unreliable clock and a final
  retained anchor genuinely beyond the decoded media duration remain diagnostics. Partial
  score coverage remains descriptive (“follows part of the score”), not a warning.
- The sync map stays strict and returns `outside-coverage` for queries outside its anchors;
  the playback adapter is responsible for classifying that expected result from media time
  and bounds. No intro/outro interpolation is invented.
- Normal Play from stopped and Stop use media time zero. A score seek still uses the mapped
  anchor. Post-roll plays to the natural media end. Score loops remain mapped-only.
- The player reports the media phase and its bounds to presentation. Readouts say
  `Pre-roll · m:ss` or `Post-roll · m:ss`, never `outside sync`.
- The selected recording contributes fixed-width pre/post-roll bookends before the first
  and after the last rendered system. They span the whole system in notation, tab and both
  views, display duration, carry accessible labels, and are not MNX measures, selectable
  music or duration-proportional timeline cells. A zero-length or not-yet-known region is
  absent. The active region is visibly identified without drawing a score playhead.
- Bookends are recording presentation owned by `elements/`. The engine may expose a generic
  system-edge inset/decorator seam, but it must not import audio or serialize recording state;
  with no bookends supplied every scenario golden stays byte-identical.
- `duration_s` means measured full playable-media duration only. Operator ingest stops
  filling it from `cropped_duration`; imported crop fields survive as source provenance.
  Missing crop boundaries are never inferred and sync seconds are never shifted from a
  duration alone. Existing Soundslice rows are repairable by a normal re-ingest that clears
  the misleading value without replacing identities or blobs.

## Work

1. Split runtime media phase from `syncIssue` in the backend/session/player event contract.
   Update source handoff so an unanchored current position is an alignment limitation, not a
   corrupt recording, and update standalone/embed and Studio copy.
2. Restore media-clock transport semantics: Play/Stop at zero, mapped score seeks unchanged,
   automatic entry to and exit from score following at the anchors, and post-roll through the
   file end.
3. Add the system-level bookend presentation for notation, tab and combined projections,
   including wrapping, multiple staves/parts, instrument labels, zoom/reflow, narrow layouts
   and accessibility.
4. Correct ingest and recording provenance. Add a dry-run cache audit showing first/last
   anchors, reported cropped duration, decoded duration where available and genuine overruns;
   document the safe production repair rather than guessing crop offsets.
5. Cover audio and YouTube readiness, full/partial maps, zero-length regions, true media
   overrun, source switching, loops and score-follow transitions in conformance and browser
   smoke checks.

## Done when

Selecting a valid Soundslice recording at time zero shows pre-roll without a warning; Play
starts at zero, following begins at the first anchor, clears after the last and audio reaches
its natural end. The score shows duration-labelled bookends matching the selected source in
all projections. Genuine sync failures remain visible and actionable. No runtime decision
uses `cropped_duration` as full media length, operator dry-run identifies the existing repair
set, all tests/build/scenario checks pass, and primitive regeneration leaves `scenarios/`
clean.
