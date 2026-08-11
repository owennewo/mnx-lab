# Proposal: chord-symbols — harmony on the global measure

**Status:** the data design is built and round-trip-proven as the `_x.mnxLab.harmonies`
extension block; not yet drafted in the spec fork (no proposed-schema scenarios, so no
`schema.diff` here yet). **CG issue:** [w3c-cg/mnx#109](https://github.com/w3c-cg/mnx/issues/109)
(open, unclaimed — MNX has no harmony concept at all).

## Thesis

Chord symbols are an array on the **global** measure parallel to `tempos`:
structured (`root`/`quality`/`bass`/`degrees`) *and* literal (`text`, present only when
the source spelling differs from the canonical rendering). The block is shaped like the
standard MNX object it drafts, so adoption means deleting the `_x.mnxLab` wrapper, not
rewriting data. Design + register: [docs/mnx-extensions.md](../../../docs/mnx-extensions.md);
narrative: [roadmap/proposed/core-chord-symbols.md](../../../roadmap/proposed/core-chord-symbols.md).

## Evidence so far

- Lossless through both converters (Guitar Pro reads **both** of its chord spellings —
  `beat.text` and `Chord` objects; MusicXML as `<harmony>`): `Vestapol` carries 25,
  `House-of-the-Rising-Sun` 14 (see `converters/fixtures/`).
- Rendering is not built yet — nothing draws a chord symbol — so there are no proposal
  scenarios or engravings here yet.

## Next

Draft the schema change in the fork (worktree branch), regenerate
`mnx-schema.proposed.json`, add `scenarios/lab/` scenarios declaring
`"proposal": "chord-symbols"`, render, then issue + PR per the score-text cycle.
