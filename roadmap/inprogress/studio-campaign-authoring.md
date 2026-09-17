# Campaign: studio authoring — create a piece, sync it, edit it, keep it

> **A campaign** (see CLAUDE.md → Roadmap-driven development): this doc is an index over
> normal proposals sharing one goal, the shared contract they follow, and the running log
> of progress and learnings as items land. Indexed items are ordinary `studio-*` / `core-*`
> proposals that name this campaign. **Opened 2026-09-17 from a design conversation; items 1–3
> built the same day, the rest not started.** Storage shape stays owned by
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
kind without redesign), a server-side recovery record, multi-writer sync (the op-log engine of
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
   the spelling of identities — **every** id kind, compared by what it resolves to (item 1
   owns the rule). The verdict is recorded in the rendition's
   provenance with the exporter's warnings. The in-memory document is **kept**, never
   replaced by the round-tripped one; what will not persist is marked, not removed.
4. **Every round-trip difference must be explained by a warning.** A difference with a
   matching exporter warning is Guitar Pro's limit and is told to the user. A difference
   with none is **a converter defect**: the save still happens, and a defect report is
   captured (document before, `.gp` bytes, re-imported document, the difference as paths,
   the ops since the last clean save) — a ready-made converter fixture. Until warnings are
   structured (`{code, where}`), the verdict is `clean | gains | differs | error` — `gains`
   being a document that comes back saying *more* than was saved, which Guitar Pro's
   mandatory fields make common — and classification is by the committed register (item 1).
   Every save exports with the converter's `STORAGE_EXPORT_OPTIONS`, never the defaults.
5. **The recovery record is the live document, not a replay.** *(Revised 2026-09-17 after
   review — log entry 2.)* While a piece is dirty, the **live in-memory document** is
   written through to IndexedDB (debounced ~1 s, and on `visibilitychange` → hidden), beside
   the sha256 and revision of the checkpoint it was last saved as, the build id, and whether
   it is dirty. **Recovery loads that snapshot and nothing else**: no re-import, no replay.
   That is the only base that is exact, because a checkpoint does *not* leave the live
   document equal to its own re-import — the importer regenerates note (`n…`), event (`e…`)
   and part (`P…`) ids, and a lossy save differs in structure too — so ops recorded after a
   checkpoint address a document the `.gp` cannot reproduce. It also makes undo a non-issue:
   `EditHistory.undo()` restores a snapshot and emits no op, so an op list cannot represent
   *edit → checkpoint → undo*, while the live document simply is the undone state. Edits
   made while a checkpoint is in flight are covered the same way: the checkpoint captures
   one immutable document (`applyOp` is pure) and the record keeps following the live one.
   Dirty means *the live document is not the document last checkpointed* (by reference in
   memory; the flag is persisted), so undoing back to the saved state is clean again.
   The record is deleted when the piece is clean. It is disposable and never migrated: it
   opens through the same upgrade path as any `.mnx.json`, and one that will not open is
   offered as a download beside the last checkpoint rather than repaired. A recovered
   record whose base checkpoint is no longer the server's canonical rendition goes to
   clause 8's conflict prompt. **Recovery restores the document, not the undo history.**
   **Ops are evidence, not the recovery path**: the history events since the last clean
   checkpoint (`apply` / `undo` / `redo`, which is the shape a log must have — not a bare
   op list) ride along for the defect report and the chip's count. They legitimately carry
   note ids and `noteKey`s (`setTechnique`, `setSyllable`) because they sit beside the
   document they address; what may never hold a note id is anything **durable or
   server-side** — ids change on every load.
6. **Hybrid autosave; nobody is asked to save.** Checkpoints fire on idle (~30 s), at a
   ceiling during continuous editing (~5 min), on `visibilitychange` → hidden, `pagehide`
   and leaving the piece, around structural ops (bars, repeats, parts), and on a click. **Save version…** is the same checkpoint, named, showing the
   full round-trip report. Renditions are marked automatic or named from day one so a later
   thinning policy has something to key on.
7. **One save-state chip, leading with risk.** It counts **history events** since the last
   checkpoint — an undo step each, so a paste is one edit, and an undo or redo counts as a
   change too — and reads zero whenever the live document *is* the checkpointed one (clause
   5's definition of dirty), then the age of the last checkpoint:
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
    item 2 — the New piece form already needs `setupGrammar` and construct-trace replay
    through `applyOp` — which is step 1 of the promotion review, taken early because
    everything it reaches is DOM-free. `elements → edit` opens at item 7.
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
not before**. **Landing order is not development order:** item 1 has no UI and can be
*developed* alongside item 2, but **item 3 cannot land before item 1** — it consumes the
comparator and the register's answer on which metadata fields persist. Item 4 depends on 2
only. Items 2–4 deliver the priority flow; 5–6 make it durable to live with; 7 is the long
one.

| # | Item | Status | Summary |
| --- | --- | --- | --- |
| 1 | [core-roundtrip-register](../complete/core-roundtrip-register.md) | **complete 2026-09-17** | **The comparator and the baseline loss register.** `src/model/documentCompare.ts` — pure; identity moved into the references (each rewritten to the path it resolves to, every `id` then dropped), `encoding` discounted, spliced arrays compared as multisets, differences collapsed to path shapes. Its reference inventory is checked against both schemas and goes red on a new one; equivalence under respelled and swapped ids is proved before anything is judged. `harness/fixtures/roundtrip-register.json` covers MNX → `.gp` → MNX over the corpus and `.gp` → MNX → `.gp` → MNX over the committed fixtures, with ranked `lostOrChanged` and `gained` lists; `npm run update:roundtrip-register`, and **git diff is the review**. An operator lane runs the same over a private library and writes outside the repo. Structured warnings (`{code, where}`) and a computed explained/unexplained verdict are its stated follow-up. Findings in log entry 3. |
| 2 | [studio-piece-create](../complete/studio-piece-create.md) | **complete 2026-09-17** | **A piece made in studio.** `#/new`: title, artist, tuning (the grammar's presets or a custom one — never "none", see open decision 6), capo, time, key, bars. `src/edit/newDocument.ts` builds the blank piece from `{}` through `applyOp`; `exportForStorage` writes the `.gp` with `STORAGE_EXPORT_OPTIONS`; `src/model/libraryTags.ts` reads the derived tags off the document (clause 9, one item early); `POST /api/library/pieces` stores it under `source_kind: 'studio'` with every id chosen by the service, reusing `writePiece` — no migration, no new role, the Worker still converting nothing. Opened `apps/studio → src/edit`. The piece page now asks for a recording when there is none. Amended `studio-shell.md`, `apps/studio/README.md`, `docs/studio-storage.md` and `docs/library-access.md`. Conformance over the real route on local D1/R2, and a real-browser smoke (`npm run smoke:piece-create`). |
| 3 | [studio-save-pipeline](../complete/studio-save-pipeline.md) | **complete 2026-09-17** | **The save pipeline, proven on the smallest edit surface.** A `setWork` op and the **Details** sheet (the nine fields a Guitar Pro header holds) — studio's first editor. `src/storage/saveSession.ts`: the state machine of clauses 2–8 with every dependency a port — the recovery record *is* the live document (IndexedDB, `recoveryStore.ts`), dirty is by reference, a checkpoint captures one document while the record follows the live one, idle/ceiling/hidden triggers, retry, and stale-write-versus-conflict. `POST /pieces/:id/renditions`: a fourth rendition role `edit` (no migration), refused unless edited from the current canonical, the round-trip check as provenance, named versions, and ingest leaving an edited piece's pointer and projection alone. The save check runs in a worker (`src/importers/storageCheck*`; ~250 ms on Vestapol). The chip beside the title, the Save sheet (losses, *Save a version*, conflict → *Keep mine as a copy*, recovered edits, conversion notes), one write queue for the page's writes, a Web Lock per piece, a build stamp on everything written. Storage files are now deflated (520 KB → 18 KB). All six recovery acceptance tests, the route over local D1/R2, and a real-browser smoke including a reload-before-save recovery and a two-device conflict. |
| 4 | `studio-sync-rederive` | proposed | **Sync first, bars later.** Contract clause 10: derive tuples from segments and the current bars on load and on bar-structure change (the derivation already lives in `src/model/syncSegments.ts`; it must run outside a sync-bar commit), write refreshed tuples back at a checkpoint, and flag imported tuple-only syncs whose traversal changed. Closes the hands-on checks [studio-sync-bar](../inprogress/studio-sync-bar.md) still owes — the click against a real YouTube clock, and the bar on touch — on a piece made by item 2. |
| 5 | `studio-piece-lifecycle` | proposed | **Living with pieces.** Soft delete (`deleted_at`; hidden from lists, R2 untouched — *never deletes* holds). A versions route listing a piece's renditions from `derived_from` / `created_at` with automatic-or-named and the round-trip verdict; open an older version; **revert** as a pointer move plus revision bump, no new rendition. Rename is a Details edit. An operator listing of unexplained round-trip verdicts that pulls their defect reports into converter fixtures. |
| 6 | `core-sync-interchange` | proposed, optional | **sync.json as interchange.** *Export sync* (none exists): the dense Soundslice-compatible array as derived, or a sparse wrapper with anchors only at the cuts and a wrapper-level `interpolation: "beat"` — never a fifth tuple element, which breaks Soundslice compatibility and the decoder's arity check. The reader option for beat-linear interpolation is built only if sparse export is wanted. **Lifting an imported Soundslice sync into segments** (lossless = one segment per anchor interval, crowded; merged = tidy, discards measured timing) is a decision the item owns. Pick up when a second consumer of a sync appears, not before. |
| 7 | [core-editor-element-promotion](../proposed/core-editor-element-promotion.md) | proposed — trigger 2 **met** by this campaign | **The editor in studio, in slices.** That doc owns the promotion review; this campaign is the second consumer it was parked behind. Recommended shape, to be confirmed by a design pass over the mount code: a separate, code-split editor element that attaches to the viewer rather than an editing mode of `<mnx-document-viewer>` (embeds view, studio edits; viewers must not pay). **Slice 1:** cursor and selection overlay, keymap, note/fret entry, delete, undo. **Slice 2:** the setup popovers. **Slice 3:** lyric editor and rung inspector — last, because the inspector is still in progress in the workbench and promoting it early makes its churn public API. Workbench consumes the promoted element and deletes its mount. Every edit rides item 3's pipeline unchanged; items the register says cannot persist are marked in the score. |
| 8 | `studio-editor-touch` | proposed | **Entry without a keyboard.** The workbench editor is keyboard-driven and studio is used on an Android tablet; a touch entry surface is new design, not a port. Decision 1 below says whether slice 1 of item 7 waits for it. |

### Decisions still open

1. **Does item 7's slice 1 ship keyboard-only, or is it blocked on item 8?** A product call.
2. **Lifting imported syncs** (item 6): lossless-and-crowded or merged-and-lossy.
3. **Thinning automatic versions.** Dozens of ~24 KB renditions per session is ~1–2 MB
   against R2's free 10 GB, so it waits; when it comes it deletes rows, which the storage
   invariants do not allow today — a deliberate later change. The automatic/named mark
   (clause 6) is what it will key on: keep the original, every named version and the latest.
4. **A server-side recovery row** (one mutable row per piece, opaque to the Worker, mutable
   under invariant 1). Add it only if item 3's measurement says checkpoints must be rarer
   than ~a minute, or a dead tablet losing one checkpoint interval turns out to matter. By
   clause 5 it cannot be a bare op list against the `.gp`: it is either the live-document
   snapshot (hundreds of KB per write) or a base snapshot plus `apply`/`undo`/`redo` events —
   the item that adds it chooses, and inherits item 3's recovery tests.
5. **Where layout state lives.** Item 1's register confirmed it: `layouts`, `scores` and
   `parts[].staves` are lost wherever they appear. The studio editor does not offer layout
   authoring over `.gp` storage and display stays a per-browser preference; a home for
   layout state is a decision for whoever first needs one.
6. **Notation-only pieces** (log entry 3): Guitar Pro has no "unstated", so a part with no
   strings comes back as a guitar. Either the exporter learns to write an unfretted track
   and the importer to read one back without strings, or studio pieces are fretted by
   definition. Blocks nothing until someone wants a lead sheet.

## Why these choices — the arguments, so they can be re-litigated honestly

- **`.gp` over MNX as the stored format.** MNX and `_x.mnxLab` (v6.4 and moving) would put
  a migration ladder under every stored document, and spec adoption would make it worse.
  Guitar Pro is stable, small, and already what the library stores. The cost — every save
  crosses the exporter — is turned into the campaign's second goal by clauses 3–4. **A lossy
  save is permanent**: a later converter fix improves later saves but cannot recover what an
  earlier one dropped, which is why every checkpoint is kept and defect reports carry the
  pre-save document.
- **Ops, not intents, as the recorded evidence — and neither as the recovery path.**
  Intents are relative to cursor and selection state and change meaning with the keymap and
  grammar; ops are the pure, deterministic stream `EditHistory` already retains. But replay
  is only as good as its base, and the one base a `.gp` checkpoint can reproduce is *not*
  the live document (ids, and whatever the save lost). A snapshot of the live document is
  exact, indifferent to undo, independent of importer determinism across builds, and
  cheap locally — so it is the recovery record, and the ops are kept for the defect report
  and the count.
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
`.gp` stays the stored format even for edits; hybrid autosave with a local-only recovery
record to start; the chip shows edits and age; score-file upload is skipped because YouTube-first is
the priority; segments stay the sync's truth and the stale-tuple gap is closed by
re-derivation rather than by changing the stored format.

Landing tips for whoever picks up item 1 or 2: `main` is busy (the player campaign is
landing sync-bar follow-ups in `src/elements/Player.ts` and `apps/studio/src/PiecePage.ts`),
so item 3's write queue should be built as its own module and wired into `PiecePage` in one
small, late commit; and `worker/api/library.ts` validates manifests against an `allowed`
key list, so a new route is cleaner than widening ingest.

### 2026-09-17 — entry 2: an outside review, four findings, all upheld

Reviewed by another model before any code; each claim was checked against the tree and all
four stood.

1. **The replay base was wrong.** Clause 5 said recovery was *load the `.gp`, import,
   replay*. But clause 3 keeps the live document after a save, and the importer regenerates
   `n…`, `e…` and `P…` ids (`converters/guitarpro-mnx/src/gpif/toMnx.ts`), so after the
   first checkpoint the live document is no longer what its own `.gp` re-imports to, and
   later ops address ids the replay base does not have. Determinism helps only when the
   starting document is identical. The old clause's "nothing outside the document may hold
   a note id" also contradicted ops that carry `noteKey`.
2. **Undo has no op.** `EditHistory.undo()` pops an entry and restores its `before`
   snapshot; an append-only op list would resurrect an edit the user undid across a
   checkpoint.

   Both are answered by one change rather than by a remapping scheme: **the recovery record
   is the live document**, ops become evidence. It removes replay, and with it every
   dependency on ids, undo representation, in-flight timing and cross-build importer
   determinism. The cost is a few hundred KB written locally per pause in editing, and that
   recovery does not restore the undo stack. The lesson for later items: *a log is only as
   good as its base, and the only exact base here is the thing itself.*
3. **The comparator would have cried wolf.** Normalising note ids alone reports every
   imported slur (event ids exist only as slur targets) and any part-id respelling as a
   converter defect. Item 1 now specifies canonicalisation over every identity derived from
   the schemas, drops unreferenced ids, and must prove equivalence on shuffled ids before it
   judges a user's save.
4. **The order contradicted itself.** Item 2 needs `src/edit` (`setupGrammar`, trace
   replay), so the boundary opens there, not at item 3; and "item 1 runs in parallel with
   2–4" blurred development with landing — item 3 lands after item 1.

### 2026-09-17 — entry 3: item 1 built — the judge, and what it found on day one

[core-roundtrip-register](../complete/core-roundtrip-register.md) carries the detail; what later items
should start knowing:

- **The first design of the comparator cried wolf twice, and the register showed it within
  minutes.** Renaming referenced ids and dropping the rest still reported 160 "lost ids" —
  an event keeps its id only while a beam or slur points at it, so every lost beam was
  counted twice. Identity now lives *only* in the references. And 132 of 138 documents
  "differed" until gains were split from losses: Guitar Pro has no "unstated", so a track
  always returns with a tuning, a key, a transposition and a voice name. **`gains` is a
  verdict of its own** (clause 4 amended), not a loss and not nothing.
- **Export for storage is not export for a person.** The exporter's default collapses a
  unison held in two voices; the second voice re-imports as a rest — 386 events across 9
  files of the private library. `STORAGE_EXPORT_OPTIONS` (in the converter, because the
  converter knows which of its options trade fidelity for tidiness) is what item 3 exports
  with. Expect more switches to join it.
- **The library's case is in good shape; authoring in MNX is not.** Committed `.gp`
  fixtures: 7 of 8 clean, the eighth explained by its warning. Private library with storage
  options: 86 clean / 7 gains / 30 differing of 123, and **22 of those 30 carry no warning** —
  silent chord-symbol loss (123 entries, 8 files), lyric syllable types, directions changing
  homes, tie and hammer-on targets resolving elsewhere. Corpus: 0 clean / 30 gains / 100
  differing, 76 silent. Pieces made in studio are authored in MNX, so the corpus lane is the
  one that predicts what item 3's chip will say. **Each silent shape owes a fix or a
  warning before the editor (item 7) makes it reachable.**
- **Item 3's metadata question is answered:** `_x.mnxLab.work` loses only `source` and a
  `creators[]` role the Guitar Pro header has no field for. The Details sheet's field list
  stands. **Open decision 5 is answered** (layout state does not survive) and **decision 6 is
  new** (a notation-only part comes back as a guitar — item 2's form changed to match).
- **Process:** an ad-hoc probe test that prints is silent under this repo's vitest config —
  write findings to a file. And a `\u0000` written through a heredoc lands as a literal NUL
  byte in the source; both new files had one, caught before commit.

### 2026-09-17 — entry 4: item 2 built — a piece can exist

[studio-piece-create](../complete/studio-piece-create.md). The priority flow now runs to the moment a
recording is added: *New piece* → a nine-bar skeleton → the piece page → Source → Add
recording → the sync bar, all on work that was already built and persisted.

- **The storage model needed nothing.** No migration, no new rendition role, no invariant
  amended: `writePiece` already meant "create" by `expected_revision: null`, a source kind is
  free text, and a piece with no upstream is given one (`studio` + a UUID) so that identity,
  uniqueness and the id's shape hold exactly as for an ingest. What was missing was only a
  route a browser may call. Item 3's checkpoint route should expect the same.
- **Browser writes are JSON, so the file is base64.** The middleware's CSRF argument (a
  cross-site form cannot send `application/json`) is worth more than the 33% — a GP7 file is
  tens of KB. Item 3's checkpoints take the same shape; the 1 MiB cap is the number to
  revisit if a real piece ever nears it.
- **Item 1 paid for itself at once.** "Survives its own first save" is one assertion because
  the comparator exists, and it failed usefully on the first run (string order — now
  canonicalised). Every later genesis or edit path can make the same assertion in a line.
- **Clause 9's projection arrived early** (`src/model/libraryTags.ts`), and **sharing it with
  the ingest tool is not free**: the tool is plain `.mjs`. Item 3 inherits a parity test, not
  a shared import; whoever wants one module should move the tool to TypeScript first.
- **Landing tip:** a real-browser smoke needs local auth (`npm run dev:login` inside the
  worktree — it keeps its own key, `.dev.vars` and local D1, all ignored) and
  `wrangler dev` on a spare port with `LIBRARY_LOCAL_ORIGIN`; 8791 may be another agent's.

### 2026-09-17 — entry 5: item 3 built — studio edits, and nobody is asked to save

[studio-save-pipeline](../complete/studio-save-pipeline.md). Studio's first editor is nine text fields,
and everything the campaign promised about saving is true of them.

- **The ports paid for themselves.** `SaveSession` imports only types; its world is handed
  to it. That is why all six recovery acceptance tests — including *edit → checkpoint → undo
  → crash* and *edits during an in-flight save* — run in 40 ms with a hand-cranked clock,
  and why the one mutation tried (marking the live document saved instead of the captured
  one) was caught. **Item 7 should mount the editor on this session unchanged**: it calls
  `documentChanged` and nothing else.
- **`gains` is a first-crossing verdict.** A document read from a `.gp` already says what
  Guitar Pro makes explicit, so its saves are `clean`. The corpus lane's 30 `gains` describe
  authoring in MNX from scratch — a new piece's *first* save — not the steady state.
- **Storage files were 20× too big, and the cap would have found out the hard way.** Stored
  (not deflated) GPIF put an 82-bar piece at 520 KB against a 1 MiB route cap. Now 18 KB.
  The general lesson for the rest of the campaign: *measure the largest committed score
  before choosing a limit* — item 2 chose 1 MiB from a fixture Guitar Pro had written.
- **The ingest had to learn about edits.** "A Soundslice piece keeps the Soundslice `.gp` as
  canonical" would have turned the operator's next re-export of any edited slice into a
  conflict. Once the pointer is an `edit` rendition, ingest adds what Soundslice exported and
  moves neither the pointer nor the derived tags. **Any future writer of the pointer owes the
  same check against the ingest.**
- **A piece can have its title only in the sidecar.** Soundslice pieces carry title and
  artist as sidecar tags, and the `.gp` may hold neither; a checkpoint that re-projected
  tags from the document alone would have erased them (and been refused: a title is
  required). The projection keeps what the library knew for those two dimensions until the
  document says otherwise.
- **The chip belongs beside the title.** Two more actions clipped it off a tablet-width
  pane. It sits in the frame's `chips` slot now; the tools row wraps.
- **Owed by later items:** the structural-op checkpoint trigger and a lighter document
  hand-off than `setDocument` (item 7); the version list over the named versions this item
  already stores (item 5); the Tags and Recordings sheets joining the write queue, if 409s
  between them and an autosave ever show up in practice.
- **Landing tip:** `pkill -f "<pattern>"` from a shell whose own command line contains the
  pattern kills the shell. Stop a local `wrangler dev` by PID (`pgrep -af "port <n>"`), and
  check the port is free before starting one — another agent may hold 8791.

