# Browser import surface — MusicXML opens in the workbench

> **Status: BUILT 2026-09-11.** Item 16 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md). **Open…** now takes
> `.musicxml`, `.mxl` and `.xml` beside MNX JSON and Guitar Pro, converted off the main
> thread by `converters/musicxml-mnx` in its own lazy worker.

## Why now

Asked for directly: a Soundslice export (`…Blues_Run_The_Game….musicxml`, 1 MB) was
refused with *Unsupported file type*. The campaign had made the converter
platform-independent (items 10, 11) and nothing in the shell called it. The row had sat
**BLOCKED** because `localFile.ts` was held uncommitted by another session; that
collision had cleared — the file was clean on `main` and the only live worktree did not
touch it — so the block was re-checked against `git status` rather than trusted.

## The agreement block

1. **The oracle** — `smoke:csp`, extended with a fourth requirement: every import worker
   loads under the **deployed** CSP (read from `public/_headers`) and produces a rendered
   document. A `.musicxml`, a `.mxl` deflated by Python's `zipfile` (so the browser's
   `DecompressionStream` path runs, not our stored-entry writer), and a `.gpx` go through
   the real `#local-file` input in headless Chrome; each must render SVG in
   `mnx-document-viewer` with zero violations and no error banner. The Guitar Pro case is
   there because the worker protocol was generalised under it, and the boot check never
   exercised either worker. What it cannot see: conversion *accuracy*, which stays with
   items 1 and 8 — this item puts the same `importMusicXML` the oracle and matrix score
   behind a file input, nothing more.
2. **The MNX verdict** — n/a. No feature is added; the import is the CLI's.
3. **The dependency budget** — zero, unchanged. The worker imports `import/musicxml.ts`
   and `common/mxl.ts` directly: the package index also re-exports the Node-only
   `.mnx.json` helpers (`fs`, `path`), which have no place in a browser chunk.
4. **The matrix row** — unmoved; what the converter supports did not change.
5. **The losslessness bar** — a document opened in the workbench is exactly what
   `importMusicXML` returns for the same bytes (no second code path, no browser branch
   in the converter), and all three formats open under the deployed CSP.

## What was built

- `src/workbench/fileImporterProtocol.ts` — the Guitar Pro envelope, renamed
  format-neutral. One worker **per format**, so each converter stays its own lazy chunk.
- `src/workbench/musicXmlImporter.worker.ts` — bytes decide zip-or-text (`isZip`), not
  the extension; `.mxl` reads through `readMxl`, then `importMusicXML` with warnings
  collected.
- `src/workbench/localFile.ts` — `MUSICXML_EXTENSIONS`, format `'MusicXML'`, one
  `importInWorker(format, buffer)` for both converters.
- **Six dead symbols removed from the converter's import path** (below).

## Learnings

- **Entering the app build means entering the app's compiler.** `tsc` for `src/` follows
  imports into `converters/`, under `noUnusedLocals`/`noUnusedParameters` the converter's
  own config does not set. The first build failed on six unused symbols in
  `import/aligner.ts` and `import/musicxml.ts` — two imports, a type, a local
  `measureNum`, and a whole private method (`getEventDivisionDuration`) nothing called.
  All dead; removing them is behaviour-neutral and the converter suite and oracle agree.
- **A converter commit is now a library event, even a behaviour-neutral one.**
  `tools/library-converter-versions.mjs` (a `build` gate since the storage campaign)
  stamps each converter as `version+git.<last commit touching it>`, so the cleanup above
  moved `musicxml-mnx`'s stamp in `worker/library/converter-versions.json`. The deployed
  read path selects MNX children by that stamp and fails explicitly without one, so **the
  first deploy after this lands needs `npm run rederive:library`** before
  MusicXML-canonical pieces read again — equal music, new evidence rows, by design
  ([docs/library-access.md](../../docs/library-access.md)).
- **"Platform-independent" was true of the modules, not the package entry.** Items 10
  and 11 made every import-path module DOM- and Node-free; `index.ts` still re-exports
  `mnxFile` for the CLI. The Guitar Pro worker reached past its index to `cleanRoom.ts`
  for a different reason and landed on the same move.
- **A real file from outside the fixtures earns its keep immediately.** The Soundslice
  export writes 606 notes with an unusable `<pitch>`; the importer rebuilds all of them
  from string/fret and tuning and says so in a warning. None of the committed fixtures
  exercises that path.
