# Campaign: studio storage — songs in Cloudflare, every format kept

> **A campaign** (see CLAUDE.md → Roadmap-driven development): this doc is an index over
> normal proposals sharing one goal, the shared contract they follow, and the running log
> of progress and learnings as items land. Indexed items are ordinary `studio-*` proposals
> that name this campaign. **Opened 2026-09-11.** Item 1 is in progress; nothing is deployed yet. The design it
> implements is [docs/studio-storage.md](../../docs/studio-storage.md); this doc owns the
> order and the contract, that doc owns the shape.

## The goal

**Studio has songs to play, and the workbench can borrow them.** A person's scores —
notation in whatever formats exist for them, the recordings that go with them, the
syncpoints that line the two up, and the lists they were filed in — live in Cloudflare
under one *piece* each. Filling it is a **personal ingest script** — a lab tool, run by
hand from the local `soundslice-cli` cache, not a product feature and not studio code.
Studio (not yet written) reads the result as its library. The workbench
gets a **Load** button that finds a piece by tags, "for testing", without acquiring a
backend of its own.

**And, on purpose, a converter-bug detector.** Every notation format a piece has is kept
as an immutable rendition beside the others — the uploaded `.gp5`, Soundslice's `.gp`
and MusicXML, our derived MNX from each — with producer and version on every one. The
on-disk canonical format is deliberately undecided; the schema carries a pointer, not a
policy. When a converter changes, re-deriving and diffing across the whole library is the
regression test. The first ingest, done by hand on 2026-09-11, already found three
Soundslice MusicXML exporter defects and one stale build of our own CLI this way (log
entry 1).

Not in scope: the sync engine, sharing, editing, and studio's front end. Each is its own
later campaign; this one lays the storage they all stand on.

## Baseline at campaign opening

- **The source.** `~/dev/soundslice-cli` (a separate repo, Python) exports a Soundslice
  library into `gp/files/`, one bundle per slice named `Artist_Title_<sliceId>.*`: the
  Soundslice `.gp` re-export, the `.original.<ext>` upload when there was one, Soundslice's
  `.musicxml`, uploaded `.mp3`/`.mp4` recordings, `.sync.json` (recordings, YouTube ids,
  syncpoints) and `.lists.json` (list memberships with hierarchical paths). Its README says
  the store reads without its SQLite index, and file identity is the slice id plus a
  recorded sha256. Two slices are exported today.
- **The Worker.** `wrangler.jsonc` deploys `worker/index.ts` (Hono) to `mnx-lab.totai.uk`
  with static assets in front; the only binding is the `OPENROUTER_API_KEY` secret.
  `worker/api/documents.ts` and `worker/api/auth.ts` are the reserved 501 seams;
  `src/storage/cloudRepository.ts` is their typed stub client. The layer order caps the
  Worker at `model + assist` and makes `workbench/` a leaf that reaches the Worker only
  through `assist/`.
- **The converters.** `guitarpro-mnx` (clean-room, GP3–GP8) and `musicxml-mnx` are Node
  CLIs whose live import paths already carry the score header into `_x.mnxLab.work` and
  strings/capo into the part. Their CLIs run from `dist/`, which is a build step, not a
  checkout (log entry 1).
- **The workbench** has no backend by rule and must stay fully functional from static build
  output alone. Its only Worker traffic is the assist demo.
- **The player campaign** owns performed ordinals (`core-campaign-player.md`), which
  Soundslice syncpoints are counted in.
- **Studio** is a README (`apps/studio/README.md`): framework and hosting shape are
  deliberately undecided until it starts.

## The contract

1. **The design doc is the schema.** [docs/studio-storage.md](../../docs/studio-storage.md)
   holds the tables, the R2 key layout and the invariants. An item that needs a schema change
   edits the doc *and* adds a migration; applied migrations are never edited. The five
   invariants there (immutable renditions, one canonical pointer, derived tags as a
   projection, originals never rewritten, producer on every rendition) are acceptance
   criteria for every item.
2. **Same origin, for now.** D1 and R2 bind to the existing `mnx-lab` Worker. One config,
   one deploy, and the workbench's Load route needs that origin anyway. This settles
   studio's *storage* hosting, not its front end; the Worker-side library module is
   DOM-free and portable if studio later takes its own origin.
3. **The Worker owns every write.** The ingest script, and later studio, write through Worker
   routes, never to D1 or R2 directly. That is where the invariants are enforced and where
   derived tags are materialised, and it is the same code path an edit will use later. Local
   development runs against `wrangler dev`'s local D1 and R2, so nothing needs the account
   to test.
4. **Conversion stays in Node.** Deriving MNX from `.gp`/MusicXML happens in the ingest script
   with the converters as they are. The Worker reads `_x.mnxLab.work` and part-level
   `strings`/`capo` out of MNX JSON to derive tags; no converter enters the Worker bundle.
   The layer ceiling `worker: model + assist only` is unchanged.
5. **The workbench stays static-functional.** Library access is additive: the Load button
   degrades to absent when the route is unreachable, the corpus and localStorage remain the
   only things the workbench *requires*. Reaching the Worker for the library goes through
   `src/storage/` (a typed client beside `cloudRepository.ts`), which amends the rule
   "workbench reaches the Worker only through `assist/`" to "through `assist/` and
   `storage/`" — a CLAUDE.md edit that item 4 makes explicitly.
6. **Nothing is public.** Every library route requires authentication from day one, in some
   form; the tabs are copyrighted and the read routes serve them whole. Item 4 is a shell
   until the auth conversation has happened.
7. **Idempotent, additive, never destructive.** A re-run of the ingest script against
   unchanged files writes nothing. A piece is keyed by `(owner, source_kind, source_id)`, so
   a re-export of the same slice updates the piece and adds renditions rather than creating
   a second piece; a recording is keyed by `(piece, source_id)`, so corrected syncpoints
   update the row rather than duplicating the blob; a list membership carries its upstream
   id in `source_ref`, so a tag the owner has renamed is not resurrected. The script sets
   the canonical pointer only when there is none (to the Soundslice `.gp`) and never moves
   it. It never deletes anything: a companion missing from a later export is not a deletion.
   Every write follows the design doc's order — blobs first and verified, then one D1 batch
   under the piece revision.
8. **The ingest script is not a product surface.** It lives beside the repo's other
   operator scripts (`spec/tools/*.mjs` is the precedent), runs only from a checkout by the
   person who owns the Cloudflare account, enters no build face, and is not studio's: studio
   reads the library, it never fills it this way. Nothing under `apps/studio/` changes in this
   campaign. **And studio never grows a Soundslice importer for its users**: studio is a
   product other people may use, and pulling their Soundslice libraries into it is not
   something this project wants to offer — the owner has no wish to disrupt Soundslice that
   way. The ingest stays a script for one account, by design, not by omission.
9. **Every item lands through the worktree recipe** (CLAUDE.md → Working in parallel) with
   the roadmap slug as the worktree name, and closes with a log entry here.

## The index

Ordered; each item is a normal proposal doc written when it is picked up, not before.

| # | Item | Status | Summary |
| --- | --- | --- | --- |
| 1 | [studio-storage-provision](studio-storage-provision.md) | in progress | Create the Cloudflare resources — one D1 database, one R2 bucket — and bind them: `wrangler.jsonc` bindings, `worker/env.ts` types, a Worker secret for the ingest script's write token, `.dev.vars` for local. **Tooling decision inside the item:** `wrangler d1 create` / `wrangler r2 bucket create` wrapped in one checked-in, idempotent bootstrap script, rather than Terraform — see *Why not Terraform (yet)* below. Done when `wrangler dev` starts with local D1 and R2 and `npm run deploy` reaches the real ones. |
| 2 | `studio-storage-schema` | proposed | The D1 migrations for the design doc's five tables (`migrations/`, applied with `wrangler d1 migrations apply`, local and remote), the R2 key layout, and a DOM-free `worker/library/` module: typed reads and writes that enforce the invariants (insert rendition → immutable; set canonical → one pointer; write MNX → re-derive tags). A harness test runs the module against local D1 via `wrangler dev`/Miniflare so the schema is exercised before any real data touches it. |
| 3 | `lab-library-ingest` | proposed | A personal operator script, `tools/library-ingest.mjs` run as `npm run ingest:library -- <dir>` (`lab-` because it serves the repo's owner, not a shell). Reads a `soundslice-cli` `gp/files/` directory, builds one piece per slice (renditions from every notation file with role, producer — the cached `.gp` is `soundslice-cli`, header-injected, with the raw export's sha256 in `provenance` — filename and fetch time; recordings with syncpoints keyed by Soundslice recording id; asserted tags from `lists.json` as `unknown:<path>` with the list id as `source_ref`), derives MNX from the `.gp` **and** from the MusicXML with the converters built from the checkout (recording package version, git sha and flags as `producer_version`/`producer_options`), and pushes everything through the Worker's ingest route with the write token. `--dry-run` prints the plan; re-runs are no-ops by sha256 (contract 7). Done when both exported slices are in the real library and `Blues Run The Game` resolves through its canonical pointer to an MNX with title, artist and capo 3. |
| 4 | `studio-storage-read` | **shell — discuss first** | Read routes (`GET /api/library/pieces?tag=…` filtered by any number of `dimension:value` tags; `GET /api/library/tags?dimension=&q=` for completion; `GET /api/library/renditions/<id>` streaming the blob; the piece's canonical MNX resolved server-side) and a workbench **Load** button with tag completion — type `tuning:` and see the values, stack several, pick a piece, open its canonical MNX in the viewer. **Blocked on an auth conversation** before it is designed: the candidates are Cloudflare Access in front of `/api/library/*` (zero code, but a Terraform-shaped resource — see below), a bearer token held in the browser like the BYOK OpenRouter key, or studio's own auth seam (`worker/api/auth.ts`) brought forward. The decision shapes items 1 and 5 too, so the conversation happens after item 3 lands and before this item is written. |
| 5 | `studio-storage-rederive` | proposed | The payoff for keeping every format. A sweep (an ingest-script subcommand or a Worker cron) that, for every piece, derives a fresh MNX child from each source rendition with the converters at their current versions, stores it as a new rendition when its bytes differ from the previous child (with `_x.mnxLab.encoding` discounted in the comparison, per the converters' own rule), rebuilds derived tags from the canonical path, and reports the differences per piece and per converter. A converter regression is then a line in that report rather than a bug someone happens to notice. Also the home of the alias table's "apply to documents" action once editing exists — not before. |

Later, outside this campaign: the sync engine and Durable Object (the design doc's *When
the Durable Object arrives*), sharing tiers, studio's front end.

### Why not Terraform (yet)

Terraform is the right tool when there are many resources, several environments, and
things wrangler cannot see. Item 1 has three resources — one database, one bucket, one
secret — and every one of them must *also* be declared in `wrangler.jsonc` for the Worker to
bind to it, so Terraform would hold state for objects wrangler already names. It also needs
a state backend (an R2 bucket, which is the thing being created) and adds a second
toolchain for every agent working in the repo. A checked-in idempotent bootstrap script
over the wrangler commands, with the resulting ids committed in `wrangler.jsonc` (ids are
not secrets), reproduces the account from nothing and reads in one screen.

The honest trigger to revisit: **item 4's auth decision.** If it lands on Cloudflare Access,
that is an Access application plus policies — resources outside wrangler's reach, exactly
the kind Terraform is for — and DNS or a second environment would tip the same way. Record
the choice in item 1's doc so the revisit is a known cost, not a surprise.

## Progress + learnings log

Appended as items land, newest last. Each entry: what landed, what was learned, what the
next item should know.

### 1. 2026-09-11 — campaign opened from a hand ingest

Two slices exported from Soundslice (`Sweet_Child_O_Mine_B2qHc`, `Jackson_C_Frank_Ole_Kirkeng_Blues_Run_The_Game_wJPHc`) were read by hand to
settle the storage unit. Findings the items inherit:

- **A converter's CLI is its `dist/`, and `dist/` is not the checkout.** Both
  `guitarpro-mnx` and `musicxml-mnx` resolve to `converters/*/dist/cli.js`, and the
  worktree's build was eight days behind source: the first import came back with no
  `_x.mnxLab.work` at all and was briefly misread as a converter gap. Item 3's tool must
  build (or import from source) rather than trust an installed binary, and must stamp the
  producer version it actually ran.
- **Soundslice's MusicXML exporter loses what the `.gp` keeps**: no `<work>`/`<credit>`
  (title and artist absent), no `<capo>` (Blues Run The Game is capo 3 in the `.gp`), and
  an empty `<step> </step>` on every flattened note (606 of them in E♭ major), which our
  aligner already detects and rebuilds from string/fret/tuning. The MNX derived from the
  MusicXML is therefore a *weaker* rendition than the one derived from the `.gp` — useful
  precisely as a comparison, wrong as a canonical.
- **The original upload can be a different arrangement.** The `.original.gp5` is 72 bars
  at capo 6 with the composer, lyricist and transcriber named in its header; the Soundslice
  `.gp` is 151 bars at capo 3. `role: original` is a fact about provenance, not "an older
  copy of the same thing", and which one is canonical is a choice the pointer records.
- **Syncpoints count performed bars.** 82 written bars → 139 syncpoints on one slice; 151
  → 152 on the other (an end marker). The recordings column says so; the player campaign's
  unroll is what makes them usable.
- **List paths arrive without a dimension.** "80s", "tunings / drop d", "Ole Kirking" are
  asserted tags with no name yet; `unknown:<path>` on import, renamed later by row update,
  is the design's answer.

### 2. 2026-09-11 — design reviewed before anything was built

An independent review of the design doc proposed eight changes; seven were taken, one was
already the case, and one claim was corrected. What the items inherit:

- **Blob dedupe is the hash key, not a constraint.** `UNIQUE (piece_id, sha256)` is gone.
  A re-derive that reproduces last time's bytes gets its own row against the same blob —
  the "same result at version Y" evidence item 5 wants.
- **The cached `.gp` is `soundslice-cli`'s, not Soundslice's.** The CLI injects the title
  and artist into the empty exported header; the rendition's producer says so and
  `provenance` carries the raw export's sha256. Item 3 reads the sidecar JSON for ids and
  fetch times; the CLI's `index.sqlite` is optional.
- **Rows are mutable, blobs are not.** Recordings upsert by Soundslice recording id;
  syncpoints, filenames and provenance are corrected in place; the piece `revision` is the
  compare-and-set token. Item 2's library module owns the write order (blobs first, then
  one D1 batch) and the same-piece rule for pointers and parents.
- **Import never deletes, never renames, never moves the pointer once set.** Asserted tags
  from lists carry `source_ref` so the owner's renames survive re-runs.
- **A dimension is derived or asserted, never both.** Corrections to derived values are
  aliases or edits.
- **The size claim was wrong**: D1 could hold a 1 MB MNX. Renditions live in R2 for
  uniformity, not necessity.
- **Syncpoints reference no rendition.** The player checks performed-bar count against
  syncpoint count before syncing and refuses with a reason on a mismatch.
