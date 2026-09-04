# Zero dependencies — a clean-room XML layer

> **Status: BUILT 2026-09-04.** Item 10 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md), and the first item
> serving the campaign's *other* objective. **`converters/musicxml-mnx` now has no runtime
> dependency at all** — and the oracle and the matrix did not move by a single cell.

## Why not the obvious fix

The reflex is an isomorphic adapter: use `globalThis.DOMParser` where it exists and
`@xmldom/xmldom` where it does not. That was the plan this campaign inherited, and it is
wrong twice.

- **Node has no global `DOMParser`** (checked on v22), so the adapter keeps xmldom as a
  Node dependency forever. "Zero in the browser, one in Node" is not zero.
- **The cost was never on the parse side.** xmldom and a browser DOM disagree about
  *serialization* — self-closing tags, entity escaping, whitespace text nodes — so an
  adapter would have made the exporter's output depend on where it ran. For a converter
  whose fixtures are committed derived files, that is worse than the dependency.

So: write both halves. MusicXML's grammar is fixed and shallow, and the converter used
exactly **eleven** DOM members, which is what makes this one file rather than a project.

## The bar it had to clear

`converters/fixtures/*.xml` are **committed derived files**. A writer that produced merely
*valid* XML would show the whole corpus as changed the next time anyone re-derived it. So
the test is byte equality, not validity:

> **Every fixture is written byte for byte as the previous serializer wrote it**, with
> only `<encoding-date>` normalised — the one part of the output that is not derived from
> the document.

Getting there needed the XML declaration **preserved verbatim** rather than regenerated:
the parser keeps `<?xml …?>` on the document and the writer re-emits it. That was the
entire difference on the first attempt, 37 bytes at the front of four files.

## What it cost to be sure

| | |
|---|---|
| Converter suite | 86 → **98** tests (12 new, covering the layer itself) |
| Oracle | 24 / 27 — **unchanged** |
| Matrix | 36 supported — **unchanged**, generated file byte-identical |
| Runtime dependencies | 1 → **0** |
| Suite runtime | 5.4s → **2.7s** |

**Swapping the entire XML layer changed nothing observable.** That is the result to want,
and it is only meaningful because the oracle and the matrix existed to say so — a claim
this size, a month ago, would have rested on 46 round-trip assertions over three guitar
scores.

## The one thing the survey missed

The API surface was scoped by grepping `src/`, which found eleven members and missed
`nodeName` — used only in `tests/`, where the round-trip suite walks measure children.
Four tests failed with every measure reported malformed, because `undefined === 'note'` is
simply false and the cursor never advanced.

**A survey of what code uses has to include the tests**, and the failure mode is
characteristic: a missing DOM member does not throw, it reads as `undefined` and quietly
takes the other branch.

## The agreement block

1. **The oracle** — the campaign's own W3C oracle and matrix, both required to be
   unmoved, plus byte parity against the four committed fixtures and 12 unit tests over
   the layer.
2. **The MNX verdict** — none; this is below the model.
3. **The dependency budget** — this item *is* the budget: one runtime dependency removed,
   none added, and the round-trip suite now parses with our own reader rather than
   xmldom's, so the package has no `dependencies` key at all.
4. **The matrix row** — regenerated, unchanged.
5. **The losslessness bar** — byte equality with the previous writer.

## What is left of the zero-dep objective

`.mxl` (the zip container) and the browser import surface, items 12 and 15. The other
converter, `guitarpro-mnx`, still depends on xmldom and alphaTab — out of scope here, and
alphaTab is being retired separately by
[core-guitarpro-binary-import.md](core-guitarpro-binary-import.md). This XML layer is
importable by that package when its own reader lands.
