# A piece made from a file

> **Status: complete 2026-10-14.** A follow-up to
> [studio-piece-create.md](studio-piece-create.md), under the same
> [studio authoring campaign](../inprogress/studio-campaign-authoring.md) contract (`.gp`
> is the only durable score format; the Worker owns every write and holds no converter).
> Implementation loop. No golden moved; no verification debt.

## Why

The owner had a Guitar Pro 4 transcription (DADGAD, no capo) and a YouTube video of the
piece played with a capo on 1. Studio could make only a blank piece, so a file someone
already has could not become a piece at all: the importer read `.gp4`, the create route
took a `.gp`, and nothing joined them.

## What was built

- **`#/new` offers Blank | From a file** (`apps/studio/src/NewPiecePage.ts`). Blank is the
  form as it was. From a file opens the file through the importers layer
  (`openLocalFile`: GP, GPX, GP3–5, MusicXML, MNX), says what it is (format, parts, bars,
  tuning name), prefills title and artist from the document (the filename when it names
  no title), offers the capo when a part has strings, and lists the converter's warnings
  grouped with counts ("let-ring is not represented yet. × 115") **before** anything is
  made. Then the same export and `POST /api/library/pieces` as a blank piece.
- **`adoptImportedDocument` / `fileCapo`** (`src/edit/newDocument.ts`): the title, artist
  and capo written by the editor's own ops (`setWork`, `setPartDeclaration`,
  `removePartDeclaration`) so the music arrives untouched. An untouched capo field leaves
  each part's capo as the file wrote it; a changed one goes on every fretted part, and 0
  takes it off.

## Decisions

- **The chosen file is not kept** (owner, 2026-10-14: "Don't need to keep the original").
  The piece's only rendition is Studio's own `.gp` (`original`, producer `studio`), so what
  the converter drops is gone for this piece; the form says so in its first sentence and
  lists the drops. The Worker already admits `gp4`/`gpx`/… `original` renditions if that
  is ever wanted.

## Proof

- `harness/conformance/piece-create.test.ts` — *a piece from a file*: a GP4 fixture adopted
  keeps its music byte-for-byte apart from the capo, takes the capo on every fretted part
  and off at 0, refuses a blank title or an impossible capo, and survives its first save as
  the stored `.gp` with title, artist and capo.
- `npm run smoke -- piece-create` — after the blank piece, a GP4 chosen From a file in a
  real browser, retitled, capoed to 1, opened on its piece page with capo 1, stored as one
  `gp`/`original`/`studio` rendition and tagged with the new title.
