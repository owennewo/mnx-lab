# MusicXML 02a–02f rest rendering assessment

**Implementation loop. Agent assessment, application `2a2481d9`, 2026-09-24.**
Six unchanged rest originals from the pinned 183-fixture W3C/LilyPond suite were
opened through current Workbench and Studio. This continues [render item 18](../roadmap/inprogress/core-musicxml-render-assessment.md);
it is neither human scenario verification nor a whole-suite verdict. The
[machine report](../harness/reports/musicxml-rest-assessment.json) holds 13 stable
feature IDs, 113 source note/range variant IDs, 26 feature × shell × view rows,
and individual dispositions for the 44 short-rest ladder variants.

## Evidence and method

- The original paths, descriptions, hashes, versions and pinned revision are in
  the [suite manifest](../converters/fixtures/musicxml-suite/manifest.json).
  The originals were not changed. [W3C's MusicXML rest reference](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/rest/)
  defines explicit staff placement, and its [multiple-rest reference](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/multiple-rest/)
  defines the measure count and `use-symbols` distinction.
- [Retained evidence](../harness/fixtures/musicxml-rest-evidence/manifest.json)
  hashes each shell's browser observation, imported MNX, complete Notation SVG and
  overlapping scroll PNGs. Both imports agree structurally on every fixture.
  [The assessment script](../harness/verify/musicxml-rest-assessment.py) rechecks
  source hashes and measure/event counts and rebuilds the report from that evidence.
- Chrome 153.0.8010.36 ran at 1440×1000, device scale 1, staff scale 1 and
  spacing density 2. Time signatures were explicitly set to **Show**. Each
  observation records effective display settings, render diagnostics, scroll
  dimensions and tile names. Both shells made the imported original current with
  a bound desktop editor. No source declares strings; only Notation is applicable.
  Tab and Both were not manufactured.

Reproduce in an isolated worktree after `npm ci` and `npm run build`:

```sh
MUSICXML_CAPTURE_FILTER='^02[a-f]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-rest-workbench node harness/verify/musicxml-editor-capture.mjs
MUSICXML_CAPTURE_SHELL=studio MUSICXML_CAPTURE_FILTER='^02[a-f]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-rest-studio node harness/verify/musicxml-editor-capture.mjs
python3 harness/verify/musicxml-rest-assessment.py
```

The Studio capture uses a private local library and the real Saved → Versions →
View → Make current path. The capture script opens original XML through the
Workbench file input and retains the unchanged Studio original. It tiles the
actual scroll host; all relevant measures in these six sources fit in the
retained views. No scenario status, golden, production library or source XML
was changed.

## Source → MNX → visible result

The table condenses the 26 per-shell rows. Each verdict applies to **Notation in
both shells**; the machine report gives the source variants, separate shell
evidence and cause.

| Feature IDs | Source requirement and observed result | Verdict / cause |
|---|---|---|
| `02a.multimeasure-rest`, `02c.multimeasure-ranges` | The requested 2-bar group and the 3/15/1/12/3-bar groups show as 3 and 34 separate whole-rest bars respectively. No `scores[].multimeasureRests` survives import; count labels never appear. | **Incorrect** / importer. Published MNX already has `start`, `duration` and `label`, and layout reads ranges. |
| `02c.use-symbols` | The last 3-bar group requests 1/2/4-bar symbols but shows three ordinary bars. | **Incorrect** / importer plus MNX representation: the published range has no symbol-style field. |
| `02d.meter-scaled-multimeasure-rests` | All nine rest events retain whole, dotted-half or half durations under the visible 4/4, 3/4, 2/4 and 4/4 meters; none of the 2/3/2/2-bar groups collapses. | **Partial** / importer. Meter totals and display are correct; the lost feature is grouping. |
| `02a.short-rest-durations`, `02f.short-rest-durations` | In each source's two 11-rest ladders, the seven values half through 128th survive in each bar. The four 256th/512th/1024th entries per bar all import as undotted 128ths. Both shells repeat the 128th glyph and report false overfill in affected bars. | **Partial** / importer; 28 correct and 16 incorrect source variants across the two fixtures. The published MNX base enum and engine glyph mapping include the requested values, but these captures do not independently prove their isolated engraving. |
| `02b.explicit-rest-position`, `02f.explicit-rest-position` | Source `<display-step>`/`<display-octave>` positions disappear; all imported rests are `{}` and draw at duration defaults, including notes placed in staff spaces. The final `02b` rest in C clef also loses its G4 position. | **Incorrect** / importer. Published `rest.staffPosition` and layout placement exist; no MusicXML-to-position mapping was applied. |
| `02b.default-rest-position`, `02a.timed-full-bar-rest` | The unpositioned quarter rest remains at its default height; the final `02a` dotted whole rest retains its dot and timed value despite `measure="no"`. | **Correct** for visible rendering; the `measure=no` flag itself is not retained in MNX. |
| `02e.untyped-rest`, `02e.unstaffed-voice-note` | A rest without `<type>` imports as a quarter on lower staff 2; the voice-2 E3 without `<staff>` appears below upper staff 1 on ledger lines, as described by the source. | **Correct**. The underfill badge is on the intentionally incomplete first measure, not a missing rest. |
| `02f.clef-context` | F clef on line 4 changes to G clef on line 2 for the later ladder. | **Correct**; rest-height and short-duration losses are separate. |

The importer produced **no warnings** for the lost count, symbol style, explicit
position or 256th-and-shorter values. The overfill badges are downstream of
the enlarged imported durations, not proof that the source bars overfill.
Both shell observations have no projection exceptions. These conclusions
compare the original XML, browser-imported MNX and complete visible notation;
an SVG existing at all was not used as a pass criterion.

## Ownership and remaining work

[Completed item 22](../roadmap/complete/core-musicxml-render-gaps.md) already fixed
compatible common/cut meter import and exact meter totals. `02d` demonstrates
those values now display; its missing *grouping* is new. [Completed item
23](../roadmap/complete/core-musicxml-write-gaps.md) already fixed Studio's
untitled XML version promotion; all six are reachable now. [Proposed item
24](../roadmap/proposed/core-musicxml-accidental-fidelity.md) owns separate
accidental and GP-storage losses. The rest losses warrant [proposed item
25](../roadmap/proposed/core-musicxml-rest-fidelity.md), with importer-first
regressions and a separate symbol-style carrier decision.

This slice assesses rendering only. It makes no create/change/remove, undo/redo
or persistence claim for [write item 19](../roadmap/inprogress/core-musicxml-write-assessment.md).
Render item 18 remains open: the rest of the 183-source suite still needs
explicit current feature × view dispositions, including any unresolved cases.
