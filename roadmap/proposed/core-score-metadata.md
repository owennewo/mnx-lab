# Score metadata: what the piece is, and what wrote the file

> **Status: plan, nothing built** (2026-09-09). Worktree `core-score-metadata`.
> Serves the implementation loop (extension v6.2 + both converters + the viewer heading)
> and hands the spec loop a drafted object pair for w3c-cg/mnx#267 and #547.

## The gap

MNX has no document metadata. The root object admits `mnx`, `global`, `parts`, `scores`,
`layouts` and the universal `_c`/`_x`/`id`; `mnx` carries `version` and `support` only.
The only name-like strings anywhere are `part.name`, `part.shortName` and `score.name` —
and `score.name` labels a *layout* ("Full score", "Guitar part"), which is also what the
engine draws as the `score-title` primitive (`src/engine/layout/notation.ts:845`). Title,
composer, copyright and encoding provenance have nowhere to go.

Upstream knows and has not designed it:

- [w3c/mnx#56](https://github.com/w3c/mnx/issues/56) "Metadata schema in MNX needs
  definition" — milestone V1, frames vocabulary reuse and extensibility, no proposal.
- [w3c-cg/mnx#267](https://github.com/w3c-cg/mnx/issues/267) "Encode title data" — the spec
  editor deliberately dropped the old `<title>` and wants a design that handles MusicXML's
  work/movement cases "elegantly" without losing the simplicity of one field.
- [w3c-cg/mnx#547](https://github.com/w3c-cg/mnx/issues/547) (Ictus, 2026-08-17) — asks for
  a root `encoding` object (software, version, date); their interim workaround is a vendor
  `_x` block, which is exactly what this item builds.

Locally, metadata leaks in and straight back out:

| Where | What happens today |
|---|---|
| `MnxDocument` (`src/model/mnx.ts:749`) | `title`/`artist` live on the **host wrapper** with a comment saying MNX has no home for them. Never written into the document, so any save or MNX round trip drops them. |
| Guitar Pro import | GPIF parser reads only `Title`/`Artist`; the GP3–5 reader already decodes all eleven header fields (`gp345/song.ts`) and then keeps two. The worker reply carries the two to the wrapper. |
| GPIF export (`gpif/fromMnx.ts:705`) | Writes an empty `<Score>` block. |
| MusicXML import | Reads `<encoding>` into a local `metadata` variable that is never used. `<work>`, `<identification>`, `<credit>` are ignored. |
| MusicXML export | Writes software + date; nothing else. |
| Fixtures | All five `.xml` fixtures carry no title or creator. Triplets-and-graces `.gp` has a title, Binary-suite has title + artist, and the three `.gpx` sources have nothing. |

## What the formats agree on

| Concept | MusicXML | MuseScore `metaTag` | Guitar Pro (GPIF / GP3–5 header) |
|---|---|---|---|
| Title / subtitle | `work-title`, `movement-title` | `workTitle`, `subtitle`, `movementTitle` | `Title`, `SubTitle` |
| Composer / lyricist / arranger | `creator type="…"` (open string) | `composer`, `lyricist`, `arranger` | `Music`, `Words`, `WordsAndMusic` |
| Performing artist, album | none | none | `Artist`, `Album` |
| Copyright | `rights` | `copyright` | `Copyright` |
| Transcriber / source | `source`, `encoder` | `source`, `translator` | `Tabber` |
| Encoding provenance | `encoding/software`, `encoding-date` | `platform`, `creationDate` | `Encoding` (GPIF only) |
| Free notes | `miscellaneous-field` | any custom tag | `Instructions`, `Notices` |

LilyPond `\header` and ABC headers carry the same core. `artist` and `album` are the
tab-world's addition and are first-class here because Guitar Pro files lead with them.
Every format also separates *what the piece is* from *what wrote the file*, and #267 and
#547 ask for those separately — hence two objects, not one.

MusicXML's `<credit>` is **printed page text** (positioned, styled) and is a layout
concern, not metadata. It is read as a fallback source and written for interoperability,
but nothing in the model is shaped by it.

## The shape (extension v6.2, root level)

```jsonc
{
  "mnx": { "version": 1 },
  "_x": { "mnxLab": {
    "work": {
      "title": "House of the Rising Sun",
      "subtitle": "…",
      "artist": "…",                 // performer — Guitar Pro's primary field
      "album": "…",
      "creators": [                  // MusicXML creator/type; MuseScore composer/lyricist/arranger
        { "role": "composer", "name": "Trad." },
        { "role": "lyricist", "name": "…" },
        { "role": "transcriber", "name": "…" }   // Guitar Pro's Tabber
      ],
      "copyright": "…",
      "source": "…",
      "notes": "…"                   // GP Instructions (+ Notices); MusicXML miscellaneous-field
    },
    "encoding": { "software": "guitarpro-mnx", "version": "0.1.0", "date": "2026-09-09" }
  }},
  "global": …, "parts": …
}
```

Rules, each following an existing extension principle (docs/mnx-extensions.md §Design
principles):

- **Plain strings only.** MNX has no formatted text; `dynamic-group.prefix` set the
  precedent. No fonts, no positions — that is `<credit>`'s job and the viewer's.
- **`role` is an open string with a recommended set** — `composer`, `lyricist`,
  `arranger`, `transcriber`, `translator`, `editor`, `publisher` — matching MusicXML's
  `creator type` (open, "composer, lyricist and arranger are typical"). An unknown role
  round-trips verbatim rather than failing validation.
- **`artist` and `album` are flat, not creator roles.** A performer is not a creator
  (Dublin Core says `contributor`), and the viewer heading already wants exactly
  `title` + `artist`. Considered and rejected: `creators[{role: "artist"}]` — one
  mechanism, but it makes the most common tab-world field the odd one out.
- **`encoding` describes *this file* and is stamped by whoever writes it.** A converter
  importing *to* MNX writes its own name and version (from `package.json`); the CLI adds
  the date. It is **never forwarded**: MusicXML's `<encoding>` describes the MusicXML
  file, so export writes ours, import does not copy theirs. This is #547's semantics.
- **Every field optional, `additionalProperties: false`** on both objects, as on every
  other block. Both draft the standard objects `work` and `encoding` at the MNX root, so
  adoption deletes the `_x.mnxLab` wrapper (principle 3).
- **Dublin Core mapping** recorded in the schema descriptions (`title` → `dc:title`,
  `creators` → `dc:creator`, `copyright` → `dc:rights`, `encoding.date` → `dc:date`,
  `source` → `dc:source`). That is the direct answer to #56's vocabulary question.

**Version: v6.2, `$id` stays at `/v6`.** A new placement point, but purely additive:
every existing document validates unchanged and nothing migrates, so there is no
upgrade hop — the v6.1 precedent (`harmony.color`) applies, not v5's. The wrapper fields
it replaces live in memory only (the workbench persists nothing but UI preferences), so
no stored document needs the shim.

## Plan

### 1. Model, schema, validators

- `spec/mnx-lab-extensions.schema.json`: `work`, `creator`, `encoding`, and a `root-ext`
  def (the whole vendor dict at `document._x.mnxLab`), with the Dublin Core notes in the
  descriptions. Title/description bump to v6.2.
- `spec/tools/compile-validator.mjs`: fourth named export `validateRootExt`;
  `worker/generated/validate-extensions.d.mts` typed to match.
- `src/model/mnx.ts`: `MnxLabWork`, `MnxLabCreator`, `MnxLabEncoding`, `MnxLabRootExt`;
  `MnxStructure._x?.mnxLab?`. **Remove** `MnxDocument.title`/`artist` and their comment:
  the reason they lived on the wrapper is gone, and two homes for one fact is the v2
  mistake again. A `work(doc)` accessor beside `upgradeTabExtension` gives the shells
  one read path.
- `src/assist/editLoop.ts`: the extension walk checks the root dict first, reporting at
  `/_x/mnxLab`. `harness/verify/check-scenarios.mjs` `computeExtensionVerdict`: same.
- The assist prompt is not taught the block (it is not taught any extension today).

### 2. Converters — read and write as far as each format allows

**guitarpro-mnx**

- `gpif/document.ts`: `metadata` widens from `{title, artist}` to all eleven `<Score>`
  children. `gp345/gp5.ts` forwards the full `scoreInfo` it already decodes (GP5's
  `music` is split from `words`; GP3/4 have no `music` field).
- `gpif/toMnx.ts`: `<Score>` → `work`, plus `encoding`. Mapping: `Title`/`SubTitle`/
  `Artist`/`Album`/`Copyright` 1:1; `Music` → composer, `Words` → lyricist,
  `WordsAndMusic` → one composer **and** one lyricist entry of the same name; `Tabber` →
  transcriber; `Instructions` → `notes`, with `Notices` lines appended after a blank line.
  Empty strings are omitted, and a `<Score>` with nothing in it writes no `work` — so
  the three empty `.gpx` fixtures come back byte-identical apart from `encoding`.
- `gpif/fromMnx.ts`: `<Score>` from `work`, XML-escaped. Names appearing under both
  composer and lyricist collapse to `WordsAndMusic`; remaining composers join into
  `Music`, lyricists into `Words`. `<Encoding>` stays GP's own — we do not claim to be
  Guitar Pro. GP3–5 is read-only (no binary writer exists), unchanged.
- The alphaTab **oracle** importer (`import/gp.ts`) and the alphaTab-backed writer
  (`export/gp.ts`) carry the same block via `Score.title/subTitle/artist/album/words/
  music/copyright/tab/instructions/notices`, or the parity tests
  (`gpif-parity`, `gp345-headers`, `gpif-writer-parity`) go red — they compare whole
  documents.
- `cleanRoom.ts`: `importGuitarProWithMetadata` retires; the document *is* the metadata.
  `tests/metadata.test.ts` re-targets to `work`.

**musicxml-mnx**

- Import: `<work-title>` → `title` (fallback: `<credit credit-type="title">`, then a
  `<credit>` with no type when the document has no `<work>` at all — MuseScore and Finale
  print credits, and some writers emit only those); `<movement-title>` → `subtitle` when
  there is no `<work-title>`, else appended to `notes`; `<credit credit-type="subtitle">`
  → `subtitle`; `<creator type>` → `creators` verbatim, except `type="artist"` → `artist`;
  `<rights>` → `copyright`; `<source>` → `source`; `<miscellaneous-field name="album|
  notes">` → those fields. `<encoding>` is dropped (rule above). The dead `metadata`
  variable goes.
- Export, in XSD order (`work`, `movement-number`, `movement-title`, `identification`,
  `defaults`, `credit`, `part-list`): `<work><work-title>`; `<identification>` with
  `<creator type>` per creator, `<creator type="artist">`, `<rights>`, `<source>`,
  `<encoding>` (ours, as today), `<miscellaneous-field name="album">` and `"notes"`;
  then `<credit credit-type="title|subtitle|composer|lyricist|arranger|rights">` blocks
  with a plain `<credit-words>` each — no positions, so consuming apps place them by
  their own defaults.

**Both CLIs** stamp `encoding` with today's date on import; the library stamps software
and version only unless an `encodingDate` option is passed, so tests stay deterministic.

**Round trips.** MNX → GP → MNX and MNX → MusicXML → MNX are lossless for `work` over the
corpus, tested, with two caveats recorded in docs/mnx-extensions.md § round trips:
GP `Notices` fold into `notes` (a GP → MNX → GP trip moves them into `Instructions`), and
`encoding` is re-stamped on every import by design (a `lossy` cell in the converter
matrix that is correct, and the doc says so).

### 3. Fixtures, corpus, viewer, docs

- Re-derive the five `.mnx.json` and `.xml` fixtures per the corpus rule
  (`guitarpro-mnx --import`, then `musicxml-mnx --export`). Expected diff: `encoding` on
  all five, `work.title` on Triplets-and-graces, `work.title` + `work.artist` on the
  Binary-suite trio's test expectations. `converter-matrix.json` regenerates with two new
  rows.
- One lab scenario, `scenarios/lab/00-document/05-score-metadata/`: every `work` field
  populated, `encoding` present, `schema: published`, `expect.extension: valid`.
  Its engraving is identical to an untitled document — the engine does not read `work`
  (below) — so its goldens are the plain-canvas ones; it is registered in
  `lab-verify.md` like any new scenario.
- `src/elements/DocumentViewer.ts` `documentHeading()`: `work.title` → wrapper `name`
  → `id`; `work.artist`. `src/workbench/localFile.ts`, `guitarProImporterProtocol.ts`,
  the worker and `ScenarioPage.loadDocument` lose their `title`/`artist` plumbing.
- `docs/mnx-extensions.md`: a "Root level" section, two register rows, format-mapping
  rows, the round-trip caveats, history entry v6.2. CLAUDE.md's `_x.mnxLab` paragraph
  gains the fourth placement point in one clause.

### 4. Upstream (follow-up, not a gate)

A `spec/proposals/score-metadata/` bundle needs the fork's fixture edited in the proposal
worktree and `mnx-schema.proposed.json` regenerated (docs/mnx-spec-submodule.md) — the
score-text cycle. That is a separate landing: this item ships the extension and the
evidence; the bundle plus comments on #267 and #547 referencing it are named here so the
next reader knows they were chosen, not forgotten. Rows for
[spec-mnx-cg-proposals.md](low-priority/spec-mnx-cg-proposals.md)'s outward half.

## Deliberately not in this item

- **The engine does not read `work`.** The `score-title` primitive stays `score.name`.
  Whether `work.title` should feed it when a score has no name is a real question — it
  would be additive and move no existing golden, since no scenario carries `work` — but
  it is an engraving decision with its own verify batch, and this item is data plumbing.
- **No metadata editor in the workbench.** Reading and displaying is in; a form for
  editing `work` is a `workbench-` item if wanted.
- **No movement/opus modelling.** #267's `<work>` vs `<movement-title>` distinction is
  collapsed to `title` + `subtitle`, the MuseScore convention. If a real multi-movement
  MNX document ever arrives, `work.movement` is where it goes.
- **No MusicXML `<credit>` positions or styling**, in or out.

## Verification debt

The one new scenario, `lab/00-document/05-score-metadata`, lands at `draft` and is
registered in the standing ledger
([roadmap/inprogress/lab-verify.md](../inprogress/lab-verify.md) → *Score metadata —
2026-09-09*). No existing golden moved, which is itself the thing to check: the
engraving must be indistinguishable from an untitled one-note document. Registration is
not approval.

## Gates

`npm test` (harness incl. converter matrix), `npm -w @mnx-editor/guitarpro-mnx test`,
`npm -w @mnx-editor/musicxml-mnx test`, `npm run check:scenarios`, `npm run build`,
`npm run update:primitives` with a clean `git diff -- scenarios/` apart from the new
scenario's own goldens. Landing per CLAUDE.md § Landing the work; worktree removed before
this doc moves to `complete/`.
