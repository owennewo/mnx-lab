# A piece made in studio

> **Status: built 2026-09-17.** Item 2 of the
> [studio authoring campaign](studio-campaign-authoring.md) and bound by its contract
> (clause 1: `.gp` is the only durable score format; clause 11: the Worker owns every write
> and holds no converter; clause 12: boundaries open one at a time; clause 13: write paths
> get tests). Implementation loop. No golden moved; no verification debt.

## Why

Studio could play, tag, attach recordings to and sync a piece — provided an operator had
ingested it from Soundslice first. Nothing a person did in studio could bring a piece into
existence, so the sync bar built the same day had nothing of the owner's own to work on.
The priority flow is **new piece → YouTube → sync**, and it starts here.

## What was built

- **`#/new` — the New piece page** (`apps/studio/src/NewPiecePage.ts`), reached from a
  *New piece* button in the library's header. Title (required), artist, tuning (the setup
  grammar's presets, or *another tuning…* recited low string first), capo, time signature,
  key, bar count. A value the grammar cannot read comes back as a sentence, not a request.
  On success it opens the piece the service named.
- **`src/edit/newDocument.ts`** — `buildNewDocument(spec)`: the blank piece, built **from
  the literal `{}` through `applyOp`** (`addPart` → `setTuning` → `setStaffKind` → capo →
  bars → meter → key), the way the construct traces build every corpus scenario, so a new
  piece is exactly what the editor could have made by hand. `_x.mnxLab.work` is the one
  direct write: no op owns document metadata until item 3 adds it. Pure, in `edit/` rather
  than the shell so the harness can hold it to account and the workbench can have it too.
- **`POST /api/library/pieces`** (`worker/api/library.ts`) — a same-origin JSON write like
  every browser write, the `.gp` as base64 (≤ 1 MiB, and it must be a GP7 zip container),
  plus the derived tags. **The service names everything**: `source_kind: 'studio'`, a fresh
  UUID as `source_id`, the piece id derived from those as for any source, the rendition id
  from the piece id and the content hash. It reuses `writePiece` with `expected_revision:
  null` — no migration, no new role (`role: 'original'`, `producer: 'studio'`, canonical from
  the start), and the storage invariants unamended. The Worker converts and derives
  nothing. `LibraryClient.createPiece` is its typed client.
- **`src/model/libraryTags.ts`** — `derivedLibraryTags(document)`: title, artist and the
  other work fields, creators, part names, capo, tuning and tuning name, read off the
  document. Campaign clause 9 (the document is authoritative, tags are a projection) needed
  it one item early, because a created piece must be listable and sortable. The operator
  ingest still computes its own copy — it is plain `.mjs` and cannot import TypeScript — so a
  test holds the two to the same answer instead.
- **`exportForStorage`** in `src/importers/exportFile.ts` — the `.gp` studio *stores*, written
  with the converter's `STORAGE_EXPORT_OPTIONS` (item 1's finding) and returning the options
  that ran, which land in the rendition's `producer_options`. The download export keeps the
  defaults.
- **The boundary**: `apps/studio → src/edit` is open in `.dependency-cruiser.cjs`. `assist`
  stays closed, and the editor's mount still arrives by promotion.
- **The piece page says what to do next**: with no recordings, the Source button reads
  *Source · Synth · add a recording* — the sync toggle only appears once a recording is the
  source, and nothing else on the page said so.

## Proof

- `harness/conformance/piece-create.test.ts` (9 tests). The blank piece is schema-valid
  (published schema and both extension validators) with the bars, meter, key, strings and
  capo asked for, and refuses what it cannot build. **It survives its own first save**: the
  exported `.gp` reads back with nothing lost or changed under item 1's comparator, for
  three different specs. The tags agree with the ingest tool's. Over the real route on local
  D1/R2 with a signed Access identity, driven through the typed client: the `.gp` becomes
  the canonical original of a piece the service named, reads back as the same music, lists
  and sorts by title, and accepts a YouTube recording; identical files are two pieces
  sharing one blob; another member cannot see it; it is a same-origin JSON write by a
  permitted member (415 / 403 / 403 / 401); and ten malformed or over-reaching bodies —
  including a caller-chosen piece id, rendition id and tag `source_ref` — are 400 and leave
  no row and no blob.
- `harness/verify/piece-create-smoke.mjs` (`npm run smoke:piece-create`, same local
  preconditions as `studio-smoke.mjs`): a real browser fills the form — a bad tuning refused
  in a sentence first — and makes a piece in DADGAD, capo 2, 6/8, two sharps, nine bars; the
  piece page opens it from the stored `.gp` with exactly that; the Source row asks for a
  recording and its sheet offers *Add recording*; the library lists it; the stored snapshot
  is one `gp`/`original`/`studio` rendition with the tags read off the document. Run and
  passed 2026-09-17.

## Found on the way

- **Order of strings is not music.** The setup grammar recites a tuning low string first;
  every importer writes string 1 first; so the blank piece's first round trip reported all
  six strings "changed". Each entry names its own string, so the comparator now orders
  `strings[]` by string number (with a test that a *retuned* string still differs), and the
  builder writes string 1 first. The register did not move.
- **Meter ops before the first bar are silent no-ops.** `setTimeSignature` on a document
  with no measures does nothing and says nothing; the builder appends bars first. Worth
  knowing for whoever writes the next genesis path.
- **A new piece starts at revision 0**, not 1 — the first write *is* the creation.

## Not done here

- **No score-file upload** — deliberately skipped by the campaign; a second source kind can
  be added without redesign.
- **No notation-only piece.** A part without strings reloads from `.gp` as a six-string
  guitar (item 1, campaign open decision 6), so the form does not offer one.
- **No delete** (item 5), and no editing of what was just typed — the Details sheet is item 3.
- **`producer_version` is the package version** (`0.3.0`), not a build id. Item 3's recovery
  record wants a finer stamp; it should add one then, in one place.
