# The save pipeline, proven on the smallest editor

> **Status: complete 2026-09-17.** Item 3 of the
> [studio authoring campaign](../inprogress/studio-campaign-authoring.md) and bound by its contract —
> clauses 2–9 are this item. Implementation loop. No golden moved; no verification debt.

## Why

Studio could make a piece (item 2) and could not change one. The campaign sequences saving
*before* the editor on purpose: the hard part of editing in studio is not the keyboard, it is
that every save crosses a lossy converter and the owner works on a tablet that kills
background tabs. So the pipeline is built first and proven on the smallest edit surface
there is — nine text fields — where nothing about note entry can confuse the result.

## What was built

- **`setWork`** (`src/edit/ops.ts`) — the op that owns `_x.mnxLab.work`. A merge: a string
  sets a field (trimmed; empty removes it), `null` removes it, an absent key is untouched;
  `creators` is replaced whole; an emptied `work` leaves no `{}` behind. The blank piece's
  title and artist now go through it, so genesis is ops all the way.
- **The Details sheet** (`apps/studio/src/DetailsSheet.ts`) — studio's first editor. Title,
  subtitle, artist, album, music by, words by, transcribed by, copyright, notes: the fields a
  Guitar Pro score header can hold (item 1's register: `source` and other creator roles do
  not survive). A committed field is one history step; Undo and Redo are in the sheet. It
  owns nothing — a `work-change` event, applied by the page through its `EditHistory`.
- **`SaveSession`** (`src/storage/saveSession.ts`) — the state machine, with every outside
  dependency a port (export-and-check, the write, the local store, the clock, the timers), so
  it imports only types and the harness holds it to account without a browser.
  - *The recovery record is the live document* — written through to a local store while the
    piece is dirty (debounced 1 s; at once when the page is hidden) and **loaded as-is**: no
    re-import, no replay. Campaign log entry 2 is why.
  - *Dirty is by reference*: `EditHistory.undo()` hands back the very object it took, so
    undoing to the checkpointed document is clean again, the record is deleted, and the
    pending timers are cancelled.
  - *A checkpoint captures one document*; the record keeps following the live one, so edits
    made while a save is in flight are neither lost nor counted as saved.
  - Checkpoints fire after a 30 s pause, at a 5 min ceiling under continuous editing, when
    the page is hidden or left, and on request. A failed save keeps the record, says so, and
    retries (5 s, 15 s, 60 s). A stale write is retried once **if our base is still
    canonical** (a tag or a sync moved the revision); otherwise it is a **conflict**, which
    stops autosave and keeps the record.
- **`recoveryStore`** (`src/storage/recoveryStore.ts`) — IndexedDB, one record per piece,
  resolving on transaction commit; and an in-memory twin for the tests. The record carries
  the base rendition id and the build that wrote it. A record against a base that is no
  longer canonical is a **fork**: shown, kept, never saved over what another device wrote.
- **The save check in a worker** (`src/importers/storageCheck{,Core,.worker}.ts`) —
  `checkStorage(document)`: export with `STORAGE_EXPORT_OPTIONS`, read straight back,
  compare with item 1's judge. Returns the bytes, the options that ran, the summary the
  service keeps (`RoundTripCheck`, now in `src/model/documentCompare.ts`) and the first
  fifty losses in full for the owner.
- **`POST /api/library/pieces/:id/renditions`** and `LibraryClient.saveCheckpoint` — see
  [docs/studio-storage.md](../../docs/studio-storage.md) (*A saved edit is a checkpoint*)
  and [docs/library-access.md](../../docs/library-access.md). A fourth rendition role,
  `edit`, validated in the library module — **no migration**. Refused unless edited from the
  current canonical; bytes already canonical store nothing; an undo-then-save is a new
  version sharing the old blob; the check and an optional version name ride as provenance.
  **An ingest after a studio edit moves neither the pointer nor the projection** — without
  that, the first re-export of an edited slice would have failed the operator's ingest.
- **The chip** (`src/storage/saveChip.ts`, shown beside the title in the frame's `chips`
  slot): the risk, then the freshness. `Saved · 4 min ago` / `12 edits unsaved · last saved
  4 min ago` / `Saving…` / `Saved · 2 items won’t persist` / `Not saved · 31 edits on this
  device only · retrying` / `Recovered 9 edits from this device` / `Saved on another device
  · 2 edits here`. It ticks every half minute.
- **The Save sheet** (`apps/studio/src/SaveSheet.ts`) — what the chip summarises: what the
  last save could not keep (path, kind, what it was) and what the writer warned; *Save now*;
  *Save a version* with a name; a conflict settled by **Keep mine as a copy** (a new piece,
  through item 2's route) or **Open the saved one**; recovered edits and *Discard them*; and
  the importer's **conversion notes** from when the stored file was opened — shown, never
  stored.
- **One write queue and one editing tab.** Checkpoints and sync saves — the page's own
  writes — run one at a time, since they move one revision. A Web Lock per piece makes a
  second tab on this device read-only.
- **The build stamp** (`apps/studio/src/build.ts`): package version + commit
  (`__MNX_COMMIT__`, defined in `vite.config.ts`), on every rendition studio writes and on
  every recovery record. Item 2 left this owed.
- **Deflated storage files.** `writeGpContainer` can now deflate the score, as Guitar Pro
  itself does, and `STORAGE_EXPORT_OPTIONS` asks for it. See *Found on the way*.

## Proof

- `harness/conformance/save-session.test.ts` (22). **The campaign's six recovery acceptance
  tests, by name**, over real documents edited through `EditHistory`: *edit → checkpoint →
  undo → crash* recovers the undone state; *checkpoint → more edits → crash* recovers a
  document byte-identical to the live one; edits made while a checkpoint is in flight survive
  and stay counted unsaved, and the record moves to the new base; undo back to the
  checkpointed state reads clean and keeps nothing; a record another build wrote is handed
  over whole and looking is not applying; a record on a stale base is a fork. Then the idle
  and ceiling triggers, stale-retry versus conflict, failure-and-retry, a named version asked
  for mid-save, flush writing the record before the save, dispose, and the chip's eleven
  sentences. Mutation-checked: marking the *live* document saved instead of the captured one
  fails the in-flight test.
- `harness/conformance/piece-checkpoint.test.ts` (5), over the real route on local D1/R2
  with a signed identity and the typed client: every version kept, the pointer moved, the
  tags following the document; nothing stored for unchanged bytes, a new version for an
  undo; 409 for a foreign base and for a stale revision, and the retry landing after a tag
  moved it; another member's 404, 415/403 for a non-JSON or cross-origin write, nine
  over-reaching or malformed bodies refused with nothing written; and the ingest-after-edit
  rule.
- `harness/conformance/storage-check.test.ts` (3): a blank piece saves as `gains` with no
  losses; a document carrying `source` and an `arranger` names exactly those two as lost;
  **the largest committed score (Vestapol, 82 bars) is checked in ~250 ms** and its stored
  file is 18 KB.
- `harness/verify/save-pipeline-smoke.mjs` (`npm run smoke:save-pipeline`; local
  preconditions as `studio-smoke.mjs`). In a real browser: a piece is made, opened clean and
  holding its edit lock; a title edit moves the heading at once, the chip reads *1 edit
  unsaved*, and the IndexedDB record holds the edited document against the right base with a
  build stamp, while the service still holds the original; **the page is reloaded before any
  checkpoint and the edit comes back** (*Recovered 1 edit from this device*); *Save now*
  produces an `edit` rendition with its check and options, the tags follow, the record is
  gone; an edit undone is clean again with nothing saved and nothing kept; a named version;
  and a checkpoint posted "from another device" is met as a conflict — nothing overwritten —
  and settled by keeping a copy. Run and passed 2026-09-17.

## Found on the way

- **Our `.gp` was twenty times the size it needed to be.** The container writer stored the
  score uncompressed: Vestapol exported at **520 KB**, against 24 KB for a comparable file
  Guitar Pro wrote. Harmless for a download; not for a writer that saves every half minute
  into a JSON body capped at 1 MiB. `fflate` was already a dependency for reading, its
  deflate is deterministic, and the reader already handled deflated entries — so storage
  exports deflate (18 KB) and the default stays stored, the form the parity fixtures were
  proven against.
- **A document read from a `.gp` saves `clean`, not `gains`.** `gains` is what a document
  *authored in MNX* gets on its first crossing; after that it already says everything Guitar
  Pro makes explicit. The smoke expected `gains` and was wrong.
- **The layer rule caught a type import.** `importers/` may not reach `storage/`, even for
  `RoundTripCheck`; the type belongs with the judge in `model/`, which is where it now is.
- **The tools row clipped.** Two more actions pushed the chip off a 780 px pane — the one
  thing that must always be visible. The chip moved to the frame's `chips` slot beside the
  title, and the narrow tools row now wraps (`src/elements/ScoreFrame.ts`, a one-line change
  the workbench cannot feel: it slots no actions).

## Not done, said plainly

- **No structural-op trigger.** The campaign asks for a checkpoint around bar, repeat and
  part edits; nothing in studio can make one yet. Item 7 owes it, in `showDocument`.
- **The Tags and Recordings sheets are not in the write queue.** They write with the
  snapshot's revision themselves, as before; a collision with an autosave is a 409 that one
  side retries. The queue covers the page's own writes, which is where the traffic is.
- **A second tab's read-only state is not exercised by the smoke** (it asserts the lock is
  held), nor is the *record this build cannot open → downloaded as a file* path.
- **Recovery restores the document, not the undo history** — by design (campaign clause 5).
- **Editing the metadata re-hands the document to the player**, which stops playback. Fine
  for a title; item 7 will want a lighter path for notes.
- **No version list** — item 5. Named versions are stored and unlisted.
- **Structured warnings** remain item 1's follow-up: the Save sheet shows losses and warnings
  side by side and leaves the matching to the reader.
- **Not deployed.**
