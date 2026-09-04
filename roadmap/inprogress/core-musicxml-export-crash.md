# A part with no id — the first thing the matrix found

> **Status: BUILT 2026-09-04.** Item 9 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md), and the shortest
> item in it. **Matrix supported 24 → 36.**

## The bug

`id` and `name` are both **optional** on an MNX part. The exporter assumed neither was:

- `basePartId(part.id)` called `.replace` on `undefined` and threw, so a document with an
  unnamed part could not be exported at all.
- `partMap.set(id, \`${part.name}\`)` on a nameless part wrote a literal
  `<part-name>undefined</part-name>` into the output.

Both are now filled in positionally — `P1`, `P2` — which is exactly what the *importer*
already does for a `<part>` that arrives without an id. The two halves now agree about
what an anonymous part is called.

## Why nothing had caught it

Every fixture the converter had ever been run against was authored in Guitar Pro, where
parts always have names. Two corpus scenarios do not
(`lab/31-score-text/10-labels-on-a-tab-staff`, `lab/50-lyrics/02-tab-verses`), and nothing
had ever pointed the converter at the corpus — the converter's tests use
`converters/fixtures/`, and the corpus belongs to the renderer.

The matrix ([lab-converter-matrix.md](lab-converter-matrix.md)) is what put the two
together, on its first run, without being asked to look for crashes.

## The number this moved, and why it is larger than it looks

Fixing one crash took the MusicXML lane from **24 supported to 36**. Those two documents
between them carried twelve schema objects that nothing else in the corpus exercised
alone, and a document that throws counts as having lost everything it carried. So a
single unguarded `.replace` was suppressing a dozen verdicts.

That is worth remembering when reading the matrix: **a crash is not one red cell, it is
every cell that document could have proved.** It is why `error` sorts above `lossy` in
the page's tiers.

## The agreement block

1. **The oracle** — the matrix's own `failures` list, now empty, plus two direct
   assertions in `spanners.test.ts` (exports at all; mints `P1` and round-trips it).
2. **The MNX verdict** — none; this is our code failing to honour an optional field the
   standard already has.
3. **The dependency budget** — no new dependency.
4. **The matrix row** — regenerated, and the crash it reported is gone.
5. **The losslessness bar** — no document in the corpus fails to export; converter suite
   green at 86.
