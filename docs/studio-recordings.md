# Studio recording attachments

Implementation loop, player campaign item 18. The source dropdown selects the recording;
its adjacent details button opens a panel for that recording alone. An open panel
follows source selection. Synth has no recording details. **Add recording…** in the
source dropdown opens a named YouTube-link or audio-upload form, even on an empty
piece. Adding does not change playback source until the recording is saved.

The selected recording can be renamed or deleted (with a named confirmation).
Deletion returns playback to Synth and closes the panel. YouTube details include the
full clickable URL. The panel displays read-only sync-point count, start and end
locations (1-based performed bars, fractional bar position, and absolute media
seconds), plus coverage diagnostics. Empty or invalid mappings are explained as sync warnings in this panel, including
live alignment diagnostics from the player. These warnings do not appear in the
Studio playback tray or disable Play: an explicit Play starts unaligned media from
its beginning. Actual media-loading errors remain visible beside playback controls.
There is no timing JSON upload or editor in Studio. New attachments have no sync
points; renaming preserves existing sync points and provenance unchanged.

Playback itself is shared with [audio](player-recordings.md) and
[YouTube](player-youtube.md); attachment does not load YouTube resources.

## Timings and provenance

The storage API and operator importer still accept Soundslice tuples and wrapper
provenance. Original JSON remains evidence; the panel reads the active `syncpoints`
field, not historical provenance. It compiles the current score and uses
`createRecordingSync` to report full/partial coverage or unusable alignment.
A matching coverage range does not prove that performances share the same structure.
Sync-point editing is deferred; new attachments play without score following or
score seeking, as explained in the form.

Opening the sheet refreshes the piece revision. A changed canonical pointer reloads
the score. Revision conflicts require reload and review before another write. A
canonical replacement during conflict review closes the old sheet and loads the new
score; reopen Recordings to review it. Updating sources pauses and replaces the live
mapping, including for embed hosts, so changing timings cannot restart old playback.

### Crop audit (2026-09-13)

The local `soundslice-cli/soundslice_cli/api.py` recording field list contains
`cropped_duration` but omits `crop_start` and `crop_end`. Its README documents seconds
from the original recording start. `tools/library-ingest.mjs` currently puts
`cropped_duration` in `duration_s`; that field is not a trustworthy full-media duration.
Neither exporter nor historical imports can reconstruct absent crop boundaries.

New wrapper imports preserve available `crop_start`, `crop_end` and
`cropped_duration`. Boundaries must be finite nonnegative absolute media seconds,
with end after start when both exist. The stored metadata can contain duration-only legacy data.
**Crop controls are not applied by this item**: playback uses the original media clock. No offset is inferred, and no
cropped-playback parity with Soundslice is claimed. The player takes actual duration
from the media API; it never uses imported cropped duration as its clock.

## Upload and write contract

- Audio: MP3, M4A, WAV, Ogg or FLAC, 1 byte–64 MiB. Extension determines the declared
  MIME type; native browser decoding determines playback support. There is no server
  codec, transcoding or microphone recording. An unsupported or corrupt recording
  produces the existing native playback error. This is separate from transfer integrity.
- Sync JSON: at most 1 MiB UTF-8; HTTP metadata is capped at 2 MiB, and a reservation's
  combined raw/validated metadata at 1.5 MiB. Large scores may hit the shared tuple limit.
- A browser-generated Studio ID is reused across retries. JSON reservation creation
  records owner, piece revision, immutable request metadata, expected SHA-256, length
  and MIME type. Reservations expire after 24 hours. No recording row exists yet.
- The raw PUT uses a non-simple `X-Recording-Upload: 1` header and
  `application/octet-stream`. Every route authenticates Access and active membership;
  metadata, upload and read checks all enforce piece ownership. Cross-origin writes
  are rejected; CORS is not enabled. No service token or R2 key is handed to the browser.
- The browser hashes the selected file, then streams a single transfer. R2 validates
  its SHA-256 during the write. The Worker requires the reserved Content-Length and
  confirms stored size; it does not buffer the entire audio file. The 64 MiB cap stays
  below the baseline 100 MB request limit. Upload requests time out in the browser after
  five minutes; retry restarts the transfer. The UI shows checking/uploading stages.
- Only after successful storage does one D1 batch advance the piece revision, mark
  the reservation complete and insert the recording. The existing revision trigger
  and reservation-state constraint abort stale or cancelled completions atomically.
  A completed PUT retry returns the current snapshot rather than attaching twice.
- Cancel aborts the fetch and cancels the reservation. If completion won the race,
  the response says it already finished and asks for reload. A failed cancellation is
  reported as unconfirmed. Closing/navigating cancels best effort; expired reservations
  cannot be used. Changing a draft uses a new ID. Unfinished reservations are invisible.
- Renaming and sync replacement retain recording/source/media identity. Different
  media is a new recording. Remove names the recording and requires a confirmation;
  it only detaches that row and increments the piece revision. Shared bytes remain.

The stream/checksum API was checked against the current
[Cloudflare R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
No dependency was added. The YouTube URL parser moved into `model` for service reuse;
its existing audio import remains a re-export.

## Storage rollout and orphan cleanup

Apply `migrations/0004_recording_management.sql` before deploying this code. It adds
nullable provenance and upload reservations without rewriting imported rows. Existing
operator ingestion remains compatible and preserves user provenance during metadata
updates. This item does not deploy or run a production migration itself.

A cancelled transfer or lost SQL race may leave verified but unreferenced bytes; it
must never leave a row pointing to a missing object. Failed multipart writes are not
used. Shared content-addressed keys must not be deleted by the browser. Follow the
storage design's separate, offline garbage-collection rule:

```sh
# Operator environment: CLOUDFLARE_API_TOKEN with account D1/R2 access.
node tools/recording-gc.mjs                  # inventory only; safe with writers active
# Stop and drain ALL library writers, including operator ingest, before deletion.
node tools/recording-gc.mjs --apply --writers-stopped
```

The sweep paginates only `recordings/<sha256>`, retains objects less than 24 hours old,
checks references across all owners and unexpired pending reservations, and fails
closed on malformed reads. It never touches rendition bytes. Apply also removes
reservations that expired more than 24 hours ago. The stopped-writers requirement
is an operator assertion: a read-then-delete sweep cannot race live attachment or
ingest safely. No production sweep was run during implementation. API shapes follow
[Cloudflare’s R2 object API](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/list/)
and [D1 query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).

## Evidence

`harness/conformance/recording-management.test.ts` uses real local D1/R2 for ownership,
identity, revision, checksum, cancellation and stale-upload tests. Miniflare's Node
RPC loses known-length tags on Node streams, so that test boundary materializes small
fixtures; the actual streaming path is separately checked inside the built Worker.
`recording-gc.test.ts` covers shared references, pending reservations, age limits,
pagination, dry-run and stopped-writer requirements.

```sh
npm run build
node harness/verify/recording-management-smoke.mjs
```

The smoke serves production Studio and the production Worker with local D1/R2 and a
signed local identity. It uploads 28.8 MB of real PCM over HTTP (larger than the operator ingest limit),
imports one of two named-alike
wrapper entries by ID, plays and seeks uploaded audio, changes timings while playing,
and reloads both recording associations. It also checks stale-write reload/review,
invalid URLs, explicitly unsynchronised saves and confirmed removal, then captures
the sheet at 360px width.
All fixture media and credentials are ephemeral; no real library data is changed.
