# Campaign: studio authoring — create a piece, sync it, edit it, keep it

> **A campaign** (see CLAUDE.md → Roadmap-driven development): this doc is an index over
> normal proposals sharing one goal, the shared contract they follow, and the running log
> of progress and learnings as items land. Indexed items are ordinary `studio-*` / `core-*`
> proposals that name this campaign. **Opened 2026-09-17 from a design conversation;
> nothing is built.** Storage shape stays owned by
> [docs/studio-storage.md](../../docs/studio-storage.md); the sync bar by
> [docs/player-sync-bar.md](../../docs/player-sync-bar.md). This doc owns the order and
> the contract.

## The goal

**Studio stops being read-only.** A person makes a new piece in studio (title, artist,
tuning, meter, a number of bars), attaches a YouTube recording, authors its sync in the sync
bar, and later writes the music — and all of it is still there tomorrow, on another device,
with nothing lost silently.

The priority flow is **new piece → YouTube → sync**, and it must work *before* any note
editing exists: a bar skeleton is enough to sync against, and the music falls onto the sync
as it is written. Editing arrives last and is the long item.

**And, on purpose, a converter-improvement loop.** Every save crosses the Guitar Pro
exporter and every load crosses the importer, so every save is a round-trip experiment on
real, user-authored material. The campaign turns that into evidence rather than risk: a
save reports what did not survive, and an unexplained loss is a converter defect with a
ready-made fixture.

Not in scope: score-file upload as a creation path (rare; addable later as a second source
kind without redesign), a server-side journal, multi-writer sync (the op-log engine of
`docs/studio-storage.md` → *When the Durable Object arrives*), sharing, AI editing in
studio, layout authoring (system breaks, `scores[]`), thinning of automatic versions,
public sign-up.

## Baseline at campaign opening

- **Recordings and sync already work in studio — for a piece that exists.** The Source
  sheet's Add takes a YouTube link or an audio file (`apps/studio/src/RecordingsSheet.ts`),
  and the player's rail/sync-bar toggle is wired (`PiecePage.ts`:
  `.syncEditable=${!!this.snapshot} @sync-edit=…`), saved through `client.saveRecording`
  with a 700 ms debounce, serial flush and one retry on a 409. Both hang off a library
  snapshot, so they work the moment a created piece is a library piece. The sync toggle is
  hidden while the synth is the source.
- **A sync is stored twice, and only one half is the truth.** The authored segments (cuts,
  beats, tempo, names, beat unit) are stored verbatim in the recording row's `provenance`
  (`studio-sync-segments`) and reopen the bar unchanged. The Soundslice-shaped tuples in
  `syncpoints` are *derived* from the segments and the score's bars at the moment of a sync
  edit (`Player.onSyncChange` → `syncpointsFromSegments`). A score with no bars saves
  `syncpoints: null` and keeps its segments. **The gap:** tuples are re-derived only on a
  sync edit, so bars written after a sync leave the stored tuples stale until the bar is
  touched again.
- **No piece can be created from a browser.** The only route reaching `writePiece` is
  `POST /api/library/ingest`: machine credentials, `source.kind === 'soundslice'` only.
  Piece ids derive from `(source_kind, source_id)`; the table is
  `UNIQUE (owner, source_kind, source_id)`. `LibraryClient` has no create, save or delete.
  The schema is already ahead of the routes: `renditions.producer` lists `'studio'`,
  `derived_from` and `created_at` give a version lineage, `expected_revision: null` means
  create, and renditions are immutable with one canonical pointer.
- **Score content is not writable, and studio may not import the editor.**
  `.dependency-cruiser.cjs` bars `apps/studio` from `src/edit/` and `src/assist/` "until
  the editor is promoted". `src/edit/` is complete and DOM-free — 58 ops through one pure
  `applyOp`, `EditHistory` retaining ops with undo/redo, genesis from the literal `{}`
  (`ensureSkeleton`; `harness/fixtures/construct-traces/` are the recipes) — but its mount
  code (keymap wiring, cursor/selection overlay, HUD, rung inspector, popovers, lyric
  editor) is ~4000 lines inside `src/workbench/ScenarioPage.ts`, a leaf.
- **There is no blank-document entry point, and nothing edits document metadata.**
  `_x.mnxLab.work` has a schema, types and readers (`documentTitle`, `documentArtist`) but
  no `EditOp` and no UI. Studio's heading resolves `title` tag → `documentTitle` →
  filename. Derived tags (title, artist, capo, tuning) are computed inside
  `tools/library-ingest.mjs`, not in a shared module.
- **Export and import already run in the browser.** `src/importers/exportFile.ts`
  (`exportDocument(doc, 'gp7')`, with an `onWarning` sink over ~25 exporter `warn(...)`
  sites) and `src/importers/localFile.ts` (import in a web worker, returning `warnings`
  that `PiecePage` currently drops). The GP7 container writer fixes its zip timestamps, so
  **the bytes are a pure function of the score** and content addressing holds. The
  importer and `applyOp` contain no randomness or clock reads, so the same `.gp` on the
  same build yields the same MNX with the same ids.
- **Round-trip equality exists only in tests, and only for notes.**
  `converters/guitarpro-mnx/tests/roundtrip.test.ts` flattens notes and rests (pitch,
  duration, string, fret, container); `tests/helpers/normalize.ts` has `normalizeIds`.
  Nothing compares slurs, dynamics, lyrics, directions, metadata or layout, and nothing is
  importable from `src/`.
- **Size.** A 77-bar GP7 file is ~24 KB (`Sun-did-glide.gp`); the same piece as MNX JSON is
  ~400 KB.

## The contract

1. **`.gp` (GP7) is the only durable score format, including for studio edits.** MNX is
   the working format in memory and is never stored durably — no MNX migration ladder ever
   runs on stored data, and the Worker never validates or applies MNX. This keeps
   [studio-storage-source-canonical](../inprogress/studio-storage-source-canonical.md)'s
   rule and **reverses** the sentence in `studio-shell.md`, `apps/studio/README.md` and
   `docs/studio-storage.md` that the first saved edit becomes an MNX rendition; item 2
   amends those docs. A studio edit is itself a `.gp` source.
2. **Every save is a checkpoint; every checkpoint is a new immutable rendition.** Export
   to GP7, store as a new rendition (`producer: 'studio'`, `producer_version` = build,
   `derived_from` = the rendition it was edited from), move the canonical pointer, all under
   the piece revision. The server therefore holds **every version**, not one; an unchanged
   save stores no new blob. The storage invariants are acceptance criteria and none is
   amended — there is no replaceable draft blob.
3. **No save is silent about loss.** Every checkpoint runs export → re-import → compare
   against the in-memory document, in a worker, discounting only `_x.mnxLab.encoding` and
   note-id spelling (ids compare by resolution). The verdict is recorded in the rendition's
   provenance with the exporter's warnings. The in-memory document is **kept**, never
   replaced by the round-tripped one; what will not persist is marked, not removed.
4. **Every round-trip difference must be explained by a warning.** A difference with a
   matching exporter warning is Guitar Pro's limit and is told to the user. A difference
   with none is **a converter defect**: the save still happens, and a defect report is
   captured (document before, `.gp` bytes, re-imported document, the difference as paths,
   the ops since the last clean save) — a ready-made converter fixture. Until warnings are
   structured (`{code, where}`), the verdict is `clean | differs` and classification is by
   the committed register (item 1).
5. **The journal is disposable, local and build-stamped.** Between checkpoints, committed
   ops are written through to IndexedDB with a disposable MNX snapshot, stamped with the
   base rendition's sha256 and the build id, and cleared on a successful checkpoint.
   Recovery is *load the `.gp`, import, replay* — sound because import and `applyOp` are
   deterministic, and single-writer linear replay needs no rebase. The journal format is
   never versioned or migrated: a mismatched journal is tried, verified op by op, and the
   user is told how far it got. Nothing outside the document may ever hold a note id —
   ids change on every load.
6. **Hybrid autosave; nobody is asked to save.** Checkpoints fire on idle (~30 s), at a
   ceiling during continuous editing (~5 min), on `visibilitychange` → hidden, `pagehide`
   and leaving the piece, at the journal's size cap, around structural ops (bars, repeats,
   parts), and on a click. **Save version…** is the same checkpoint, named, showing the
   full round-trip report. Renditions are marked automatic or named from day one so a later
   thinning policy has something to key on.
7. **One save-state chip, leading with risk.** It counts **undo steps** not yet
   checkpointed (a paste is one edit), then the age of the last checkpoint:
   `Saved · 2 min ago` / `12 edits unsaved · last saved 4 min ago` / `Saving…` /
   `Saved · 2 items won't persist` / `Not saved · 31 edits on this device only · retrying` /
   `Recovered 9 edits from this device`. Age ticks coarsely. Sync and tag saves share it.
8. **One revision-ordered write queue per piece.** Checkpoints, sync saves and tag changes
   all bump the same piece revision, so they serialise through one queue in the piece page.
   A second tab on the same piece opens read-only behind a Web Lock; a 409 from another
   device offers *reload, or save mine as a copy* — never a silent overwrite.
9. **The document is authoritative for metadata; tags are a projection.** `_x.mnxLab.work`
   is edited through an op like everything else. The derived-tag projection moves out of
   `tools/library-ingest.mjs` into `src/model/` and every checkpoint sends fresh derived
   tags, so library facets follow metadata edits with no second write path. `scores[].name`
   stays a layout label and is not touched.
10. **Segments are the sync; tuples are a cache.** When a source has segments, tuples are
    derived from the segments and the *current* bars — on load and whenever bar structure
    changes, not only on a sync edit — and playback never depends on the stored tuples
    being fresh. A checkpoint may write the refreshed tuples back to keep the row honest.
    Imported Soundslice syncs have no segments: they are re-validated against the new
    traversal and marked *may be out of date — re-sync* when it changes; their stored
    evidence is never rewritten. The sync.json tuple format stays an interchange format,
    not the authoring model: it is bar-indexed (every later anchor goes stale when a bar is
    inserted) and cannot hold an unfinished sync.
11. **The Worker owns every write and stays DOM-free at `model + assist`.** No converter
    and no `applyOp` enter the Worker: it stores bytes, enforces revision and ownership,
    and accepts the client's derived tags and provenance, exactly as it does for ingest.
    New routes are browser-authenticated behind Access with the existing same-origin and
    content-type guards, and size-capped as ingest is.
12. **Boundaries open deliberately, one at a time.** `apps/studio → src/edit` opens at
    item 3 (the first edit surface) — step 1 of the promotion review, taken early because
    `applyOp` and `EditHistory` are DOM-free. `elements → edit` opens at item 7.
    `elements → assist` stays closed: the AI palette and model picker stay in the workbench.
13. **Write paths get tests.** The Worker and UI have none by convention, but create and
    checkpoint are the first write paths for score content: harness conformance tests beside
    `harness/conformance/library.test.ts`, and a smoke script in the manner of
    `harness/verify/sync-bar-smoke.mjs`.
14. **Every item lands through the worktree recipe** (CLAUDE.md → Working in parallel) with
    the roadmap slug as the worktree name, and closes with a log entry here. Goldens are
    not expected to move; an item that moves one registers the batch in
    [lab-verify](../inprogress/lab-verify.md) first.

## The index

Ordered by dependency; each item is a normal proposal doc **written when it is picked up,
not before**. Item 1 has no UI and can run in parallel with 2–4. Items 2–4 deliver the
priority flow; 5–6 make it durable to live with; 7 is the long one.

| # | Item | Status | Summary |
| --- | --- | --- | --- |
| 1 | `core-roundtrip-register` | proposed | **The comparator and the baseline loss register.** A pure module in `src/model/` — canonicalise (strip `encoding`, rename note ids in traversal order with targets, promoting `normalizeIds` out of the converter's test helpers), then deep-diff to JSON paths collapsed by path shape with counts. Shared by the harness, `importers/` and studio; format-agnostic so MusicXML round trips get it later. A committed register under `harness/fixtures/` covers MNX → `.gp` → MNX over the lab corpus and `.gp` → MNX → `.gp` → MNX over the library pieces; a test fails when it changes and **git diff is the review** (the `update:edit-traces` mechanism). The register is both the converter backlog and the list of things the editor must flag as not persisting. Verdict v1 is `clean \| differs` beside the warnings; structured warnings (`{code, where}`) and a computed explained/unexplained verdict are this item's stated follow-up, not its gate. |
| 2 | `studio-piece-create` | proposed | **A piece made in studio.** `POST /api/library/pieces` (browser-authenticated, `expected_revision: null`, reusing `writePiece`) with `source_kind: 'studio'` and a generated id; `createPiece` on `LibraryClient`. A **New piece** form — title, artist, tuning (preset, custom through the existing `setupGrammar`, or none = notation only — no instrument is assumed), capo, time signature, key, bar count — that replays a construct trace from `{}`, exports GP7 and stores it as the piece's first rendition. Lands on the piece page with the Source sheet one tap away, and makes the *add a recording to see the sync bar* step obvious (the toggle is hidden on the synth). Amends the three docs contract clause 1 reverses. Conformance tests for the route. |
| 3 | `studio-save-pipeline` | proposed | **The save pipeline, proven on the smallest edit surface.** Opens `apps/studio → src/edit`. A `setWork` op (merge; an undefined field removes it) and a **Details** sheet offering the fields the Guitar Pro score header can hold — expected: title, subtitle, artist, album, composer, lyricist, transcriber, copyright, notes; item 1's register confirms. Then everything in contract clauses 2–9: `POST /pieces/:id/renditions` (bytes, `expected_revision`, `derived_from`, provenance with verdict/warnings/named/build, derived tags; pointer moved atomically), export + round-trip check moved into a worker and **measured on Vestapol**, the IndexedDB journal and recovery, checkpoint triggers, the save-state chip and **Save version…**, the single write queue, the Web Lock, the derived-tag projection promoted into `src/model/` and shared with the ingest tool. Import `warnings` get a quiet *conversion notes (n)* entry on the piece page — displayed, not stored. Conformance tests and a smoke script. |
| 4 | `studio-sync-rederive` | proposed | **Sync first, bars later.** Contract clause 10: derive tuples from segments and the current bars on load and on bar-structure change (the derivation already lives in `src/model/syncSegments.ts`; it must run outside a sync-bar commit), write refreshed tuples back at a checkpoint, and flag imported tuple-only syncs whose traversal changed. Closes the hands-on checks [studio-sync-bar](../inprogress/studio-sync-bar.md) still owes — the click against a real YouTube clock, and the bar on touch — on a piece made by item 2. |
| 5 | `studio-piece-lifecycle` | proposed | **Living with pieces.** Soft delete (`deleted_at`; hidden from lists, R2 untouched — *never deletes* holds). A versions route listing a piece's renditions from `derived_from` / `created_at` with automatic-or-named and the round-trip verdict; open an older version; **revert** as a pointer move plus revision bump, no new rendition. Rename is a Details edit. An operator listing of unexplained round-trip verdicts that pulls their defect reports into converter fixtures. |
| 6 | `core-sync-interchange` | proposed, optional | **sync.json as interchange.** *Export sync* (none exists): the dense Soundslice-compatible array as derived, or a sparse wrapper with anchors only at the cuts and a wrapper-level `interpolation: "beat"` — never a fifth tuple element, which breaks Soundslice compatibility and the decoder's arity check. The reader option for beat-linear interpolation is built only if sparse export is wanted. **Lifting an imported Soundslice sync into segments** (lossless = one segment per anchor interval, crowded; merged = tidy, discards measured timing) is a decision the item owns. Pick up when a second consumer of a sync appears, not before. |
| 7 | [core-editor-element-promotion](core-editor-element-promotion.md) | proposed — trigger 2 **met** by this campaign | **The editor in studio, in slices.** That doc owns the promotion review; this campaign is the second consumer it was parked behind. Recommended shape, to be confirmed by a design pass over the mount code: a separate, code-split editor element that attaches to the viewer rather than an editing mode of `<mnx-document-viewer>` (embeds view, studio edits; viewers must not pay). **Slice 1:** cursor and selection overlay, keymap, note/fret entry, delete, undo. **Slice 2:** the setup popovers. **Slice 3:** lyric editor and rung inspector — last, because the inspector is still in progress in the workbench and promoting it early makes its churn public API. Workbench consumes the promoted element and deletes its mount. Every edit rides item 3's pipeline unchanged; items the register says cannot persist are marked in the score. |
| 8 | `studio-editor-touch` | proposed | **Entry without a keyboard.** The workbench editor is keyboard-driven and studio is used on an Android tablet; a touch entry surface is new design, not a port. Decision 1 below says whether slice 1 of item 7 waits for it. |

### Decisions still open

1. **Does item 7's slice 1 ship keyboard-only, or is it blocked on item 8?** A product call.
2. **Lifting imported syncs** (item 6): lossless-and-crowded or merged-and-lossy.
3. **Thinning automatic versions.** Dozens of ~24 KB renditions per session is ~1–2 MB
   against R2's free 10 GB, so it waits; when it comes it deletes rows, which the storage
   invariants do not allow today — a deliberate later change. The automatic/named mark
   (clause 6) is what it will key on: keep the original, every named version and the latest.
4. **A server-side journal row** (`journal(piece_id, base_rendition_id, build, ops,
   updated_at)`, opaque to the Worker, mutable under invariant 1). Add it only if item 3's
   measurement says checkpoints must be rarer than ~a minute, or a dead tablet losing one
   checkpoint interval turns out to matter.
5. **Where layout state lives** if item 1's register confirms `.gp` cannot hold system
   breaks and `scores[]`. Until then the studio editor does not offer layout authoring and
   display stays a per-browser preference.

## Why these choices — the arguments, so they can be re-litigated honestly

- **`.gp` over MNX as the stored format.** MNX and `_x.mnxLab` (v6.4 and moving) would put
  a migration ladder under every stored document, and spec adoption would make it worse.
  Guitar Pro is stable, small, and already what the library stores. The cost — every save
  crosses the exporter — is turned into the campaign's second goal by clauses 3–4. **A lossy
  save is permanent**: a later converter fix improves later saves but cannot recover what an
  earlier one dropped, which is why every checkpoint is kept and defect reports carry the
  pre-save document.
- **Ops, not intents, in the journal.** Intents are relative to cursor and selection state
  and change meaning with the keymap and grammar; ops are the pure, deterministic stream
  `EditHistory` already retains. Most ops address by `measureIndex`, which makes them poor
  for multi-writer rebase and perfectly good for single-writer replay against an identical
  base — so the journal is safe exactly where the stage-3 op-log engine is not yet.
- **Why not a durable op log.** Note ids do not survive a `.gp` round trip, so a stored log
  would address ids that no longer exist on the next load; and a wire-and-storage op format
  owes a versioning discipline the ops (58, still growing) are not ready to pay. The
  original argument is `git show be743d02^:roadmap/proposed/low-priority/studio-storage-sync.md`;
  its trigger — the first time a document has two writers — is unchanged and unmet.
- **Hybrid over Word-style autosave.** Android kills background tabs and `pagehide` is
  unreliable, so a recovery file would carry most of the load anyway; and the page would
  otherwise have two save models, since sync edits already autosave. **Save version…**
  keeps what the Word model was good at: a deliberate moment to read the loss report, and
  versions that mean something.
- **Both numbers on the chip.** Age alone misleads — *saved 40 min ago* with no edits since
  is safe, and the same age with 60 edits since is not. The edit count is the risk; the age
  is the freshness.
- **Segments over sparse tuples.** A segment is a sparse sync in beat coordinates. The
  tuple format differs in three ways — it interpolates equal time per bar (wrong across a
  pickup or meter change at constant tempo, which is why the derivation is dense), it
  addresses performed bar indices (stale under a bar insert; shifting them under repeats
  needs the pass model), and it has nowhere for an unfinished sync. The second is the one
  that matters once bars are being written under an existing sync.

## Progress + learnings log

### 2026-09-17 — campaign opened from a sweep and a design conversation

Three read-only sweeps (studio + storage, recordings + sync bar, edit layer + metadata)
found the premise half wrong in a useful way: *add a recording* and *switch to the sync
rail* were already built and persisted in studio — what was missing was any way for a piece
to exist that did not come from the operator ingest. That reordered the work around
creation and saving. The decisions above were taken in that conversation by the owner:
`.gp` stays the stored format even for edits; hybrid autosave with a local-only journal to
start; the chip shows edits and age; score-file upload is skipped because YouTube-first is
the priority; segments stay the sync's truth and the stale-tuple gap is closed by
re-derivation rather than by changing the stored format.

Landing tips for whoever picks up item 1 or 2: `main` is busy (the player campaign is
landing sync-bar follow-ups in `src/elements/Player.ts` and `apps/studio/src/PiecePage.ts`),
so item 3's write queue should be built as its own module and wired into `PiecePage` in one
small, late commit; and `worker/api/library.ts` validates manifests against an `allowed`
key list, so a new route is cleaner than widening ingest.
