# `.mxl` — the container most MusicXML actually arrives in

> **Status: BUILT 2026-09-04.** Item 11 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md), completing the
> zero-dependency objective for this converter. **Still no runtime dependency**, in Node
> or in the browser.

MuseScore, Sibelius, Dorico and Finale all hand you `.mxl` by default. A converter that
reads only `.musicxml` cannot open most of the files that exist, so this was the gap
between "works on our fixtures" and "works on a file someone sends you".

## Why the existing zip reader could not be reused

The campaign assumed this item was mostly a promotion of
`converters/guitarpro-mnx/src/gpif/container.ts` into a shared place. It is not, and the
reason matters more than the work:

**That reader is `node:zlib`, synchronous, with no browser path.** Reusing it would have
carried the Node-only assumption into the one converter that had just been made
platform-independent — undoing item 10 in the name of not repeating code.

`DecompressionStream('deflate-raw')` is the inflater Node *and* browsers both have. It is
a stream, so it is async, and that is the one real cost: `readMxl` returns a promise.
**The asynchrony is contained at the container boundary** — `importMusicXML` is still
synchronous, and `importMxl` is the async entry that wraps it. Nothing else in the
converter changed shape.

Writing needs no compressor at all: **stored entries** are entirely legal zip, and the
only arithmetic required is CRC-32, which is fifteen lines. The files are larger than a
deflating writer's and every reader takes them.

## Reading is stricter than it looks

Two details that a naive reader gets wrong on real files:

- **The central directory is the source of truth, not the local headers.** A local header
  may declare sizes of zero and defer them to a data descriptor after the payload — legal,
  and what streaming writers produce.
- **The end-of-directory record is found by scanning backwards**, because a zip comment may
  follow it.

And one about the wild: when `META-INF/container.xml` is missing or names nothing that
exists, the fallback is the first non-metadata `.musicxml`/`.xml` entry. Hand-assembled
files without a manifest are common, and refusing them would be pedantry.

## The tests that are worth having

Anything round-trips against itself. The two that mean something cross an implementation
boundary, using Python's `zipfile` as an independent zip:

| | |
|---|---|
| **Our reader** | reads a **deflated** container written by `zipfile`, and produces exactly what reading the plain file produces |
| **Our writer** | produces a container `zipfile` opens, lists correctly, and passes `testzip()` — a real per-member CRC check |

That second one is the reason to write stored entries with a correct CRC rather than a
plausible one: `testzip()` is what catches a plausible one.

## The CLI sniffs rather than trusting the extension

`--import` now reads **bytes** and checks for the zip magic, so a `.mxl` named `.xml`
still opens and a text file named `.mxl` still fails honestly. `--export` writes a
container when the output path ends in `.mxl`.

## The agreement block

1. **The oracle** — cross-implementation, both directions (above), plus the campaign's
   oracle and matrix required unmoved.
2. **The MNX verdict** — none; this is a container, below the model.
3. **The dependency budget** — none added. The package still has no `dependencies` key.
4. **The matrix row** — regenerated, unchanged.
5. **The losslessness bar** — a document through the container equals the same document
   without it.

## Result

| | |
|---|---|
| Converter suite | 98 → **104** tests |
| Oracle | 24 / 27 — unchanged |
| Matrix | 36 supported — unchanged |
| Runtime dependencies | still **zero** |

## What is left of the objective

The **browser import surface** (item 15) is now the only piece: the converter is
platform-independent, but nothing in the workbench calls it yet. The Guitar Pro worker
(`src/workbench/guitarProImporter.worker.ts`) is the shape to copy.
