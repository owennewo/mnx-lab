# Store the source, convert on read — the library holds what Soundslice exported

> **Status: built 2026-09-11, in `inprogress/` until the deployed checks pass** (build record
> at the end). Lineage: the
> [studio storage campaign](../complete/studio-campaign-storage.md), whose contract clause 4
> (*conversion stays in Node; the ingest derives MNX*) this item **reverses**, and whose
> item 5 (the rederive sweep) it **retires**. Follows the first full cache sync of the same
> day, which is what surfaced the question. Implementation loop.

## The decision

**MNX is the lab's working format, not — yet — its storage format.** The spec is too
incomplete to bet a library on, so the mnx-lab service stores what Soundslice exported
and nothing derived from it: the `.gp`, the `.original.*` upload when there was one, the
`.musicxml`, the recordings, the syncpoints, the list tags. **The canonical rendition of a
Soundslice piece is its `.gp`**, asserted by the ingest and enforced by the Worker.
Conversion to MNX happens where the music is read — in the browser, the way the workbench
already opens a `.gp` from disk — and never lands in D1 or R2.

This resolves the caching problem at the root. The design that stored derived MNX made
every converter change a service-wide event: re-stamp a version pin, deploy, re-derive
every piece, move bytes for pieces the change never touched. With nothing derived stored,
a converter change touches the service not at all.

## Vocabulary

| Term | Means |
| --- | --- |
| **soundslice service** | Soundslice itself. Only `soundslice-cli` talks to it. |
| **soundslice cache** | the export on disk, `~/dev/soundslice-cli/gp/files`. Written by `soundslice-cli`, read by mnx-lab, never modified by it. |
| **mnx-lab service** | the Cloudflare data — D1 rows and R2 objects — behind the Worker. |
| **ingest** | `npm run ingest:library`: copies the soundslice cache into the mnx-lab service. |
| **validation mode** | a converter run whose output is a verdict and a fact sheet, never a stored file. |

There is no *mnx-lab cache*: mnx-lab keeps nothing on disk between runs.

## What changes

### 1. Ingest stores bytes only

The tool sends the source renditions, the recordings and the tags. No derived MNX is
produced for storage. `canonical` is initialised to the Soundslice `.gp`; the tool
**refuses** a slice whose stored canonical is anything else, and the Worker enforces the
same rule for `source.kind = soundslice`. (Editing, when it comes, still moves the pointer
to an MNX rendition — the storage design's rule is unchanged; it simply has no case yet.)

### 2. Validation mode — forgiving ingest, strict validator

Each converter gains one entry point: source bytes in, a **verdict** and a **fact sheet**
out. The verdict is schema-valid or not, with the full error list. The fact sheet is what
the converted document states about the piece: title, artist, capo, tuning, part names.
The ingest runs it over every source in the slice — the `.gp` and the `.musicxml` alike —
so the two exporters keep cross-checking each other; that is what found Soundslice's
MusicXML defects and the one-bar-ending bug, and it stays.

- **Forgiving ingest.** A verdict never blocks storing. The bytes are the owner's and a
  conversion failure is the converter's problem.
- **Strict validator.** The report prints every error per source per converter, and the run
  exits nonzero if any conversion failed, even though everything was stored.
- **Tags only from a conversion that validated.** A broken converter can never write a
  wrong capo into the library.

### 3. Tags

Title and artist come from the **Soundslice sidecar** — the piece as its owner named it.
Capo and tuning come from the fact sheet, one tag per distinct value across the guitar
parts; tuning as pitches, with a recognised name where there is one
(`converters/guitarpro-mnx/src/common/tuning.ts`). Every derived tag's `source_ref` names
the converter and version that produced it, so derived tags remain what the storage design
calls them — a **rebuildable projection**, never stored truth. The Worker stops deriving
tags itself (it has no MNX to derive from) and accepts asserted tags as it already does.

### 4. Skip what the library already holds

Before sending anything for a slice, the tool fetches its snapshot and compares. Every
stored rendition and recording carries the **SHA-256 the Worker computed at upload**
(R2's own ETag is never consulted); a rendition's id is derived from slice id, format,
role, producer and hash, so the tool can compute every id from the cache without
contacting anything. If every computed id is in the snapshot and the tags match, the
slice is **skipped** — no conversion, no upload. `--force` replays it in full. A converter
change therefore costs one snapshot read per piece and refreshes only the tags whose
converter version changed. The rederive sweep becomes this revalidation.

### 5. Reads hand back the canonical file

`GET /pieces/:id/mnx` retires in favour of `GET /pieces/:id/canonical`, returning the
canonical rendition's bytes with format and filename. Studio's piece page and the
workbench's Load dialog convert in the browser, in the lazy web worker the workbench
already uses for a local `.gp`.

### 6. The importer worker is promoted

`src/workbench/guitarProImporter.worker.ts`, its MusicXML sibling and
`fileImporterProtocol.ts` live in the workbench, a leaf studio cannot import. They move to
a layer both shells may use — a new `src/importers/` over `model/`, with the converters as
its only other dependency — and dependency-cruiser learns the layer. This is the promotion
[apps/studio/README.md](../../apps/studio/README.md) anticipated, arriving one item early.

### 7. Retirements and revisions

- `tools/library-rederive.mjs`, the `/ingest/rederive/*` routes, `worker/library/
  converter-versions.json` and the build check that forces a re-stamp on every converter
  change: **retired**. Nothing they maintain exists any more.
- [docs/studio-storage.md](../../docs/studio-storage.md): the *multiple formats, one
  canonical pointer* section states that no derived rendition is stored for an import,
  and "a converter bug is a diff between two renditions" becomes "a diff between two
  conversions of one stored source, run locally".
- The nine cached sources become **converter fixtures** in `converters/fixtures/`, so the
  bug class that validation-at-ingest used to catch is caught at test time instead.
- [studio-shell.md](studio-shell.md) §piece page reads the canonical route
  and converts; its checklist gains the change.

## What is given up, stated plainly

Today the Worker validates derived MNX at ingest, which is what stopped the one-bar-ending
bug on 2026-09-11. After this item, validation happens in the ingest tool (strict, but
non-blocking) and at test time (the fixtures); nothing validates on the service, and a
reader who opens a piece the converter cannot handle sees the shells' forgiving
degradation rather than a refusal. The trade is deliberate: the service keeps the owner's
files, and the converters are judged where they can be fixed.

Already-stored derived MNX rows stay — renditions are immutable — and are simply unused.
All nine pieces' canonical pointers are already the `.gp`.

## Acceptance

- `npm run ingest:library` over the soundslice cache stores nine slices, derives nothing,
  asserts `.gp` canonical, prints a per-source verdict for both converters, and exits zero;
  a second run skips all nine and moves no bytes; `--force` replays one.
- A slice whose stored canonical is not `.gp` is refused by the tool and by the Worker.
- Tags on each piece: title and artist from the sidecar; capo and tuning where the
  conversion validated, with `source_ref` naming converter and version.
- Studio and the workbench open a library piece through the canonical route, converting in
  the promoted worker; the studio smoke and the library smoke pass on the new path.
- No converter is reachable from `worker/`; `src/importers/` is a layer in
  `.dependency-cruiser.cjs`; `check:boundaries` green.
- The rederive tool, routes, pin and build check are gone; `npm run build` no longer knows
  converter versions.
- The nine cached sources are converter fixtures with round-trip and validation tests.

## Out of scope

Editing and the MNX rendition it will store, sharing, sync, a compact player, and any
change to how Soundslice is exported.

## Build record — 2026-09-11

Built as designed, with three departures:

- **The cached sources are not fixtures.** They are copyrighted transcriptions, and the
  repo's rule is never to commit one. The regression coverage that stored-MNX validation
  used to give lives in the tool instead: `npm run ingest:library -- <cache> --dry-run`
  validates every source with both converters and exits nonzero on any error, without
  the network. Run over the real cache today: nine slices, twenty conversions, zero errors.
- **The workbench's Load dialog was stripped, not re-pointed.** The workbench has no backend
  by rule; the dialog was its one thread to the service. The dialog, the `?library=1`
  hand-off, the `/api/library/login` route and `library-smoke.mjs` are gone; `/workbench/`
  never touches the service, and only `/studio/` is behind Access. The studio smoke is the
  one end-to-end proof of the library path.
- **The projection has a `tuning-name` dimension** beside `tuning` (standard, drop D, DADGAD,
  open G/D/E/A, half- and whole-step down, bass and ukulele standard), and `title`/`artist`
  come from the sidecar as designed; the workbench-era tuning format (`E[+1]3`) became
  `F#3`.

What is here: `Library(db, bucket)` with `readCanonical` and a `derived_tags` projection
input (replace-when-present, retain-when-absent, derived dimensions only, each with a
`source_ref`); the rederive routes, tool, version pin and build check deleted; `POST
/ingest` enforcing the Soundslice `.gp` canonical for the pointer being set and one already
stored; `GET /pieces/:id/canonical` streaming the file with format, rendition and revision
headers; the ingest tool rewritten — plan without converting, skip by recorded SHA-256,
validation mode, forgiving ingest / strict validator, projected tags, `--force`;
`src/importers/` as a layer (the two clean-room workers, the protocol and the file opener,
promoted from the workbench; dependency-cruiser and CLAUDE.md know it); studio's piece
page and client reading the canonical file and converting it in that worker, naming the
piece from the library's title/artist tags; docs revised. Verified: the full suite (1736),
boundaries, both type checks, and the studio smoke against `wrangler dev` with local D1/R2
— a real `.gp` stored, listed, opened and drawn with the player wired.

**Already stored, unchanged:** nine pieces' derived MNX rows remain, immutable and unused;
their canonical pointers were the `.gp` already. The first ingest run after this lands
re-validates all nine (their projection predates `source_ref`) and posts nine manifests
with no files.

**Still open — the owner's steps**, then this doc moves to `complete/`:

- [ ] `npm run deploy` (the Worker no longer serves `/pieces/:id/mnx`; studio needs the
      canonical route); then `npm run ingest:library -- ~/dev/soundslice-cli/gp/files` to
      refresh the projection — nine manifests, no bytes.
- [ ] In deployed studio, the nine pieces open and play from their `.gp`.
- [ ] A second ingest run reports nine `skipped`.
