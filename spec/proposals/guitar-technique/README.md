# Proposal: guitar-technique — tab as a view, technique as data

**Status:** the data design is built and round-trip-proven as the `_x.mnxLab.tab`
extension block; not yet drafted in the spec fork (no proposed-schema scenarios, so no
`schema.diff` here yet). **CG issues:**
[w3c-cg/mnx#63](https://github.com/w3c-cg/mnx/issues/63) (guitar tab),
[w3c-cg/mnx#179](https://github.com/w3c-cg/mnx/issues/179).

## Thesis

**Single-source**: music is encoded once; notes carry `tab.position` (string/fret) and
tab-ness is the part-level `tab.staffKind` view flag. There are **no TAB clefs** (invalid
MNX — `scenarios/lab/24-tab-spec-gaps/tab-clef-rejected` pins the rejection as a spec-gap
exhibit) and no duplicated tab staves. `tab.technique` covers bends (a **curve** of
`{position, alter}` points, `alter` in semitones like `pitch.alter`), slides, hammer-ons,
pull-offs, vibrato, harmonics and palm mute. Design + register:
[docs/mnx-extensions.md](../../../docs/mnx-extensions.md); narrative:
[roadmap/proposed/core-guitar-technique.md](../../../roadmap/proposed/core-guitar-technique.md).

## Evidence so far

- Lossless `MNX ⇄ .gp` and `MNX ⇄ MusicXML` for every technique on all three fixture
  scores (`converters/fixtures/`), including bend curves.
- The tab renderer engraves positions from the extension (or a lowest-reasonable-position
  heuristic) — `scenarios/lab/20-tab-part/`, `lab/21-tab-positions/` are verified.
- Technique *rendering* (bend arrows, hammer-on slurs …) is not built yet.

## Next

Draft the schema change in the fork (worktree branch), regenerate
`mnx-schema.proposed.json`, migrate the tab scenarios to
`"proposal": "guitar-technique"` variants against it, render, then issue + PR per the
score-text cycle.
