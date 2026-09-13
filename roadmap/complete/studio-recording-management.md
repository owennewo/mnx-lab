# Studio recording attachments — YouTube links, uploaded audio and sync data

> **Status: complete 2026-09-13.** Implementation loop. Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 18.
> Needs [sync validation](../complete/core-player-recording-sync.md) and
> [audio playback](../complete/core-player-recording-playback.md). YouTube playback needs
> [item 17](../complete/core-player-youtube.md). This is Studio's persistent authoring surface.

## Agreement block (campaign contract)

- **Pure before audible.** Reuse the sync decoder and source capabilities. Ownership,
  upload integrity and revision handling live in storage/service code, not the player.
- **Time and identities.** Recordings own measured seconds and raw syncpoints;
  attachment does not alter MNX, synth tempo or editor selection.
- **Proof.** Service tests for ownership, updates and failed uploads; browser checks
  for attach/import/select/reload. No new runtime codec or scenario golden.
- **Gain.** Users can add their own recording without the operator ingest tool.

## Scope

On a Studio piece, add a named recording either by pasting a supported YouTube URL or
uploading an audio file. Attach Soundslice-format sync JSON to that recording. Support
both a bare syncpoint array and the existing `.sync.json` wrapper, with explicit
recording selection when it contains several entries; never bind timings by array
position or similar names. Reuse URL parsing from item 17.

Show sync coverage/diagnostics before saving and whenever the score revision changes.
A URL or audio file alone cannot infer alignment. Permit an explicitly unsynchronised
recording with follow/score-seek disabled, or let the user attach its timings; do not
invent automatic sync. A full waveform/tap-to-sync editor, audio transcription,
microphone capture, video-file uploading and automatic alignment are out of scope.

Reuse recording identity, naming, content-addressed audio blobs and revision-checked
writes. Raw source data survives normalized validation; do not overwrite the canonical
score or edit imported source media. Define source-format provenance and preserve
available crop_start/crop_end as absolute media times: the current imported
cropped_duration alone cannot reconstruct crop boundaries. Audit exporter/ingest
metadata before promising cropped playback parity; missing crop data is diagnosed,
not guessed from duration.

Add browser-authorized recording create/update operations, typed client access, and
an upload flow sized for audio. The operator's 24 MiB multipart ingest and its
largest-media omission behavior are not a user-facing upload design. State size and
format limits up front; handle cancellation, retry, partial failures, idempotency and
orphan cleanup. Keep owner checks on metadata and blobs; no service credentials in
browser code. Uploaded audio uses item 16's range-capable read path; YouTube stores
only the external identity and metadata, never media bytes.

Renaming and replacing sync data retain recording identity with revision conflict
handling. Any remove/detach action clearly identifies the selected recording and
must not delete a shared content-addressed blob still referenced elsewhere. Keep
this lifecycle separate from deleting the piece or its score sources.

## Done when

A user attaches audio plus timings and a YouTube link plus timings, selects either
from the player, reloads and gets the same association. Invalid URLs, multi-recording
imports, absent/partial sync, mismatched score structure, crop metadata, interrupted
uploads, ownership failures and concurrent updates have explicit outcomes. Changing
sync data invalidates the live mapping without reviving old playback. Local-file
preview and already-ingested recordings work independently of this authoring UI.

## Implementation and evidence — 2026-09-13

Built the Studio sheet and owner-authorized create/update/detach API. Audio uses a
separate 64 MiB streamed, checksum-verified transfer with 24-hour reservations;
revision and cancellation checks atomically gate attachment. Retry reuses identity.
An offline, dry-run-first sweep handles orphaned blobs without deleting shared media.

Sync imports retain the raw source and explicitly selected wrapper ID, plus available
absolute crop metadata. Coverage uses the existing performed-score compiler/map. The
exporter audit confirmed crop boundaries are currently omitted, so the UI preserves
available fields and explicitly does not promise cropped-playback parity. See
[the implemented contract](../../docs/studio-recordings.md), including rollout.

Real D1/R2 tests cover ownership, stale writes, cancellation races and integrity. The
built Studio/Worker smoke uploaded a 28.8 MB PCM file, attached a YouTube link, chose
the correct wrapper entry, played/sought audio, changed sync without restarting, and
reloaded both associations. Browser checks also cover invalid URLs, conflict review,
unsynchronised saves and removal. All 188 regenerated goldens stayed unchanged.
Migration 0004 must be applied before deployment; no production data was changed.

Item 18 landed through `9fdad40`. All 1,824 tests, scenario checks and production
build passed after rebase, as did the built Studio/Worker recording check, existing
Studio audio check and both embed formats. The browser check also exercises a
canonical-rendition read race; metadata and the score must name the same immutable
rendition before diagnostics can be used. No verification debt was added. The
implementation worktree was removed before this document moved to `complete/`.
