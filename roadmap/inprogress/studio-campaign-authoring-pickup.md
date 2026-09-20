# Pickup note — the studio authoring campaign, after its first day

> **Written 2026-09-17, at the end of the session that opened the campaign and built most of
> it, for whoever picks it up next.** The plan is
> [studio-campaign-authoring.md](studio-campaign-authoring.md) — the goal, the fourteen-clause
> contract, the index, the arguments, and a nine-entry learnings log. **Read its contract and
> its log before writing code**; this note does not repeat them. It says what is left, in what
> order, and the things a new session would otherwise have to rediscover. Delete this note
> when the campaign closes — it is a handoff, not a record.

## Where it stands

| # | Item | State | Doc |
| --- | --- | --- | --- |
| 1 | Round-trip comparator + loss register | complete (`966fe6c7`) | [core-roundtrip-register](../complete/core-roundtrip-register.md) |
| 2 | Make a piece (`#/new`) | complete (`5feeb2fc`) | [studio-piece-create](../complete/studio-piece-create.md) |
| 3 | Save pipeline, Details sheet | complete (`2cfc0280`) | [studio-save-pipeline](../complete/studio-save-pipeline.md) |
| 4 | Sync re-derivation, shape stamp | complete 2026-09-20 (`f2de86f1`); the owner keeps testing the two hands-on checks on the live site | [studio-sync-rederive](../complete/studio-sync-rederive.md) |
| 5 | Delete, versions, revert, defect reports | complete (`7ddd02d5`); **migration 0005 before deploy** | [studio-piece-lifecycle](../complete/studio-piece-lifecycle.md) |
| 6 | sync.json interchange | **skipped 2026-09-20** by the owner | (index row only) |
| 7 | Editor promotion | complete — slices 1–3 (`a394e7bc`, `7b38b743`), then the workbench's adoption of the binding | [core-editor-element-promotion](../complete/core-editor-element-promotion.md) |
| 8 | Touch entry | **built and REJECTED 2026-09-20** by the owner, on the tablet — the bar is deleted and **studio is play-only on a touch device** | [studio-editor-touch](../rejected/studio-editor-touch.md) |
| 9 | Pointer placement (a press places the cursor) | complete 2026-09-20 (`5b97fbb7`) | [core-editor-pointer-placement](../complete/core-editor-pointer-placement.md) |

All of it is on `main` and pushed. **None of it is deployed.**

## What is left, in the order I would do it

### 1. Deploy — and the one thing that must happen first

`migrations/0005_piece_lifecycle.sql` adds `pieces.deleted_at`, and **every library read now
names that column**, so the deployed Worker will fail on every library call until the
migration is applied:

```bash
npx wrangler d1 migrations apply LIBRARY_DB --remote    # FIRST
npm run deploy
```

This is outward-facing and the owner's to trigger — ask, do not just run it. The things worth
walking after it — **all of which can be walked locally first**, since YouTube plays under
`wrangler dev` (the owner corrected this note on 2026-09-20; the earlier claim that only the
real site could show them was wrong):

- `#/new` → make a piece → it opens; **Source → Add recording → a YouTube link** → the rail /
  sync-bar toggle appears (it is hidden while the synth is the source).
- The save chip beside the title; a Details edit; reload before the 30 s pause → *Recovered
  1 edit*; *Save now*.
- The editor's chunk and the storage-check worker both load under the production CSP
  (`public/_headers`). The importers' workers already load there, so this should be fine —
  but it has not been seen.
- `npm run defects:library -- --list` against production (same credential flags as the
  ingest). Expect nothing until someone edits something Guitar Pro cannot hold.

### 2. ~~The owner's two hands-on checks (item 4 inherits them from the sync bar)~~ — closed 2026-09-20

The owner marked item 4 complete with both checks still in progress, to keep testing on the
live site; [studio-sync-rederive](../complete/studio-sync-rederive.md) records it. They were:

- **the click against a real YouTube clock** — by ear, on a real video;
- **the sync bar on touch** — its 16 px segment-label targets, on the Android tablet.

Best done on a piece made with `#/new`, which is the first time the priority flow can be
walked end to end. Both docs (and [studio-sync-bar](../complete/studio-sync-bar.md)) are in
`complete/`; a finding from either check is a defect against the built thing, not a reopening.

### 3. ~~Item 7's last work-list item: the workbench adopts `bindEditor`~~ — done

Both shells sit on the one binding now; what was built and why is in
[core-editor-element-promotion](../complete/core-editor-element-promotion.md) → *Work-list item 5*
and campaign log entry 10. `npm run smoke:workbench-editor` is the net for the workbench's
side of the seam (revert, replay, the sweep, the rail); run it with `smoke:inspector`,
`smoke:focus`, `smoke:selection`, `smoke:player` **and `smoke:studio-editor`** after touching
`src/elements/editorHost.ts` — the binding is under both shells.

> **`smoke:selection` is already red on `main`** — two reveal-scroll checks (*the selection is
> off screen at the first/last bar*: a 218 px selection in a 191 px viewport). Verified on a
> clean build of `261a3398`, before any of the editor work. It is not a gate, so nothing
> caught it; someone should find out which landing moved the geometry. Do not read it as a
> regression from this campaign, and do not let it hide one: compare the failure text.

### 4. Item 8: touch entry

Not designed. What is known:

- The owner works on an **Android tablet**; the score frame's focus mark takes the browser
  fullscreen there, and a tap on the score is *never* a chrome toggle (memory:
  `score-frame-edge-grips`).
- ~~**There is no click-to-place.**~~ **Built as item 9, 2026-09-20**
  ([core-editor-pointer-placement](../complete/core-editor-pointer-placement.md)): a press
  anywhere on the score places the cursor, snapped to the nearest stop and line, and a tap
  IS a press — so touch already has this. What is left for item 8 is the entry surface
  itself.
- Fret entry is the easy half: a fret pad calls `binding.handleIntent({ type: 'enterFret',
  fret })`. Duration, tie, delete and undo are single intents too. The Keys sheet
  (`apps/studio/src/KeysSheet.ts`, fed by `binding.keys()`) already knows what is possible on
  the current rung — but **a palette cannot be generated from it as written**: `CheatRow` is
  `{keys, meaning}`, both display strings, and the join that resolves a stroke to an intent
  happens inside the binding and is discarded. Generating one needs a new export, which the
  item doc owns.
- ~~Write the item doc~~ ~~build pass one~~ — **closed 2026-09-20 as rejected**
  ([studio-editor-touch](../rejected/studio-editor-touch.md)). The doc named two shapes; the
  owner chose the bar in the editor overlay, it was built as `<mnx-entry-bar>` with a touch
  smoke, and the owner rejected it the same day on the tablet: a bar over the score is a bar
  over the score, and the tablet's whole point is focus mode with the music as the page.
  **The standing rule now is that studio on a touch device plays and does not edit** — the
  piece page binds no editor where the primary pointer is coarse. Do not rebuild a palette
  without reading the rejected doc; its traps and its survey are still accurate. (The owner
  has now rejected a bottom-edge surface on sight three times: memory `sync-bar`,
  `playback-tray-locked`, and this.)

### 5. Follow-ups the item docs name, none of them blocking

- **The converter backlog** is `harness/fixtures/roundtrip-register.json` →
  `lostOrChanged`, ranked by how many documents each shape bit. Silent ones owe a fix *or* a
  warning. From the owner's private library (`ROUNDTRIP_DIR=~/dev/soundslice-cli/gp/files
  ROUNDTRIP_REPORT=<outside the repo> npx vitest run
  harness/conformance/roundtrip-register.test.ts`): chord symbols lost silently, lyric
  syllable `type` changing, part-measure `directions` changing homes, tie / hammer-on targets
  resolving elsewhere. Each fix is a register diff — `npm run update:roundtrip-register`, and
  the git diff is the review.
- **Structured warnings** (`{code, where}`) and a computed explained / unexplained verdict
  (item 1's stated follow-up). Until then the Save sheet shows losses and warnings side by
  side.
- **A lighter document hand-off.** Every edit goes `showDocument` → `this.doc` → `present()`
  → `bindPlayback.setDocument`, which recompiles the performance and *stops playback*. Correct;
  heavy for a keystroke. The workbench does the same.
- **A notation-only piece** cannot survive `.gp` storage (a part with no strings reloads as a
  six-string guitar), so `#/new` does not offer one — campaign open decision 6.
- **No sync.json import in studio**; when the Recordings sheet grows one it should send the
  score shape with it (`performedShape`).
- **Thinning automatic versions**, a **server-side recovery row**, the **Tags / Recordings
  sheets joining the write queue**, **score-file upload as a creation path** — all parked
  with reasons in the campaign doc.

## Decisions the owner has made — do not reopen them

- **`.gp` is the only durable score format, including for studio's own edits.** No MNX
  migrations on stored data; every save is a converter round-trip experiment. I first
  recommended MNX renditions and was overruled.
- **Hybrid autosave**, nobody asked to save; the recovery record is the **live document** in
  IndexedDB (not an op replay — campaign log entry 2 is why); the chip leads with unsaved
  edits, then age.
- **Segments are the sync; tuples are a cache.** sync.json stays an interchange format.
- **Score-file upload is skipped** ("uploads are super rare"); YouTube-first.
- **Editor slice 1 shipped keyboard-only.**

## What a new session will not find written anywhere else

**Layer rules that bit, in order of how long they cost:**

- The Node harness **may not import `src/elements/`** (`harness-not-into-shells`). Pure logic
  you want unit-tested has to live in `model/`, `edit/`, `storage/` or `importers/`. That is
  why `SaveSession` takes every dependency as a port, and why the editor binding's only proof
  is a browser smoke.
- `importers/` **may not import `storage/`**, even for a type. Shared types go to `model/`
  (`RoundTripCheck` lives in `src/model/documentCompare.ts` for this reason).
- The rung inspector **must not declare `designTokens`** (a test holds it to inheriting the
  palette). Outside the workbench it needs an ancestor that does: `<mnx-editor-surfaces>`.
  Anything else promoted out of the workbench will meet the same question.
- `<mnx-score-frame>` **measures whatever is slotted into it** to place its focus mark. Add
  siblings to the slot; never wrap the viewer.
- `EditorSession` **deep-copies the document it is given**, so the object on screen is not the
  one you passed in. `SaveSession.adopt()` exists to say which object *is* the saved one.
  Dirty is by reference throughout.
- `docs/studio-storage.md`'s SQL blocks are **asserted equal to the migrations** by
  `library.test.ts`. Do not "correct" a comment inside them; write prose beside them.
- **Seven conformance files apply migrations by name.** A new migration has to be added to
  each (`grep -rn "0001_library" harness`).

**Running the browser smokes.** They are not gates; run the relevant ones by hand.

```bash
# inside the worktree — it keeps its own key, .dev.vars and local D1, all gitignored
npm run dev:login
npm run build
npx wrangler dev --config wrangler.jsonc --assets dist/client --port 8795 --local-upstream localhost   # background; pick a FREE port
LIBRARY_LOCAL_ORIGIN=http://127.0.0.1:8795 node harness/verify/studio-editor-smoke.mjs
```

Need the local Worker: `piece-create`, `save-pipeline`, `piece-lifecycle`, `studio-editor`,
`studio`, `library`. Serve `dist/` themselves, no Worker: `sync-bar`, `sync-rederive`,
`inspector`, `focus-mode`, `selection`, `workbench-editor`, `player-workbench` (after
`performance-review.mjs`).
Port 8791 may be another agent's — check with `ss -ltn` first. Screenshots land in `/tmp/mnx-*.png`;
look at them — three real bugs in this campaign were only visible there.

**Tooling traps, each of which cost a step:**

- A `\u0000`-style escape written through a heredoc or the Write tool can land as a **literal
  control byte** in the source (it happened three times). Before every commit, list changed
  files that contain one — it should print nothing:
  `git status --short | awk '{print $NF}' | xargs -r grep -lP '[\x00-\x08\x0e-\x1f]'`
- `pkill -f "<pattern>"` / `pgrep -f` from a shell whose own command line contains the pattern
  **kills that shell**. Stop a local `wrangler dev` by the listening PID: `ss -ltnp | grep :<port>`.
- **Headless Chrome fires no focus events** for an unfocused page. A smoke that depends on
  focus needs `Emulation.setFocusEmulationEnabled`.
- The repo's vitest config **swallows `console.log`** from a test. A probe that prints is
  silent — write findings to a file.
- Miniflare tests that make dozens of requests pass alone and **time out at 5 s in the full
  run**; give them an explicit timeout.
- Keep read-only checks and state-changing git commands in **separate calls**. A stray
  `git stash` in a compound command hid a working tree here for one step. The repo has another
  agent's stash (`core-guitarpro-binary-import`) — leave it alone.

**Landing, as this campaign did it.** One worktree per item named for the doc's slug; commit,
rebase, all three gates, `--ff-only`, push, remove the worktree. Closing an item is a *second*
small landing that moves the doc to `complete/` and fixes the paths that cited it (tests and
smokes cite their roadmap doc in a header comment) — the rule is that the worktree is gone
before the doc moves. Each landed item gets an index-row update and a log entry in the
campaign doc; that log is the most useful thing in it.

## The map

| What | Where |
| --- | --- |
| Blank piece from ops | `src/edit/newDocument.ts` |
| The round-trip judge; `RoundTripCheck` | `src/model/documentCompare.ts` |
| Library tags read off a document | `src/model/libraryTags.ts` (parity-tested against `tools/library-ingest.mjs`) |
| Storage export + save check (worker) | `src/importers/exportFile.ts`, `storageCheck{,Core,.worker}.ts`; `STORAGE_EXPORT_OPTIONS` in `converters/guitarpro-mnx/src/gpif/fromMnx.ts` |
| Save state machine, recovery, chip, versions | `src/storage/saveSession.ts`, `recoveryStore.ts`, `saveChip.ts`, `versions.ts` |
| Sync: what plays, the shape stamp | `src/model/syncSegments.ts` (`playingSyncpoints`), `src/audio/scoreShape.ts`, `src/model/recordingAttachment.ts` |
| The editor's mount and its surfaces | `src/elements/editorHost.ts`, `editorSelection.ts`, `inspectorMount.ts`, `EditorSurfaces.ts`, `keyScope.ts` |
| Studio's pages and sheets | `apps/studio/src/PiecePage.ts` (the hub — one door, `showDocument`), `NewPiecePage.ts`, `DeletedPage.ts`, `DetailsSheet.ts`, `SaveSheet.ts`, `KeysSheet.ts` |
| Worker routes | `worker/api/library.ts`: `POST /pieces`, `POST /pieces/:id/renditions`, `PUT /pieces/:id/canonical`, `DELETE /pieces/:id`, `POST /pieces/:id/restore`, `GET /deleted`, `GET /ingest/studio/defects`; documented in `docs/library-access.md` and `docs/studio-storage.md` |
| Operator tools | `npm run ingest:library`, `npm run defects:library`, `npm run update:roundtrip-register` |
