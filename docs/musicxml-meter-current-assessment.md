# MusicXML 11-series meter rendering assessment

**Implementation loop. Agent assessment, application `183ac088`, 2026-09-24.**
All 12 unchanged 11-series originals in the pinned 183-fixture W3C/LilyPond suite were reopened through the current Workbench and Studio desktop editors. This updates the [earlier bounded meter review](musicxml-meter-assessment.md) after items 22 and 23 landed. It adds 34 stable feature IDs, 40 source-context variants and 68 feature × shell × Notation rows to [render item 18](../roadmap/inprogress/core-musicxml-render-assessment.md). It is neither a whole-fixture verdict nor human scenario verification.

## Evidence and method

The [machine report](../harness/reports/musicxml-meter-current-assessment.json) records every original time declaration with its pinned source hash, part/measure/ordinal ID, symbol, staff, visibility, grouping, alternate and imported global meter. The [verifier](../harness/verify/musicxml-meter-current-assessment.py) checks the original hashes, exact summed meter duration against imported MNX, matching imports and warnings between shells, display settings, editability, and coverage of every source variant. The [capture manifest](../harness/fixtures/musicxml-meter-current-evidence/manifest.json) hashes both shells' complete SVG, PNG, observation and imported MNX per source; [Workbench](../harness/fixtures/musicxml-meter-current-evidence/workbench/index.json) and [Studio](../harness/fixtures/musicxml-meter-current-evidence/studio/index.json) retain browser observations.

Chrome 153.0.8010.36 ran at 1440×1000, device scale 1, staff scale 1 and density 2. The real Settings control set **Time signatures → Show**; clefs were also Show. All 24 original-file opens succeeded without a render exception. Every score fit one viewport tile in each shell; the browser capture checked scroll width and height before the visual review. Each Studio XML version was made current and bound to the desktop editor, following item 23's title repair. No source declares known strings, so Tab and Both are inapplicable. The rendering review does not award Studio authoring or persistence passes.

Reproduce after `npm ci` and `npm run build` in an isolated worktree:

~~~sh
MUSICXML_CAPTURE_FILTER='^11[a-i]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-meter-current-workbench node harness/verify/musicxml-editor-capture.mjs
MUSICXML_CAPTURE_SHELL=studio MUSICXML_CAPTURE_FILTER='^11[a-i]-' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-meter-current-studio node harness/verify/musicxml-editor-capture.mjs
python3 harness/verify/musicxml-meter-current-assessment.py
~~~

The capture commands write scratch data; the verifier checks the retained, hash-pinned evidence. Prior `6f0b09` captures in the older report show the historical truncation and Studio edit block. The `f15abe6b` follow-up is a selected post-fix check, not the current full feature sheet.

## Source → imported MNX → visible result

Every verdict below applies independently to **Notation in both shells**. The machine report has one row per shell with direct source/import/observation/capture paths. IDs such as `11i-TimeSignatures-Alternate/p01/m03/t01` refer to stable source positions, not generated MNX IDs.

| Feature IDs | Original → imported MNX → current visible result | Verdict / cause |
|---|---|---|
| `11a.numeric-duration`, `11a.compatible-common` | Eleven meter values from 2/2 through 12/8 survive exactly; the compatible 4/4 common symbol survives as `display: common` and prints C. | **Correct.** Item 22 fixed the earlier common-symbol loss. |
| `11a.inconsistent-first-symbol` | Original XML asks for `symbol="common"` on 2/2, while the manifest says alla breve. Import warns, keeps 2/2 and prints a fraction. | **Unresolved / source/reference ambiguity** for exact glyph; numeric duration passes above. |
| `11b.absent-initial-meter` | The first bar has no time declaration; MNX and both images omit an initial sign. The manifest allows application-dependent initial display. | **Not applicable** as a required glyph; implicit metrical interpretation is not approved. |
| `11b.hidden-meter-ink`, `11b.staff-local-scope` | Bar 2 hides 2/2 on both staves. Bar 3 shows 4/4 on staff 1 but hides it on staff 2. MNX holds global 2/2 and 4/4 without visibility or local scope; both shells print both changes on both staves. Five source-located warnings identify these losses. | **Incorrect / importer and MNX representation.** |
| `11b.visible-upper-meter`, `11b.piano-staff-context` | Upper-staff bar-3 4/4 is visible, and the independent treble/bass piano staves are present. | **Correct** for those bounded features; item 22 restored the two-staff context. |
| `11c.complex.total-duration`, `11c.compound-simple.total-duration` | Each original has (3+2)/8 and (5+3+1)/4. MNX now holds 5/8 and 9/4; both fractions print. | **Correct** totals, fixed by item 22. |
| `11c.complex.grouped-spelling`, `11c.compound-simple.grouped-spelling` | The `3+2` and `5+3+1` expressions flatten to single numerators. | **Missing / importer and MNX representation.** |
| `11d.complex-multiple.total-duration`, `11d.compound-multiple.total-duration` | 3/8+2/8+3/4 becomes 11/8; 5/2+1/8 becomes 21/8. Both exact totals print. The second bar's underfill badge reflects the source's 20 eighth units against 21/8, not a lost meter. | **Correct** totals, fixed by item 22. |
| `11d.complex-multiple.grouped-spelling`, `11d.compound-multiple.grouped-spelling` | The separate source fractions become one stacked fraction in each bar. | **Missing / importer and MNX representation.** |
| `11e.complex-mixed.total-duration`, `11e.compound-mixed.total-duration` | Both sources' (3+2)/8+3/4 imports and prints as the correct 11/8 total. | **Correct** totals, fixed by item 22. |
| `11e.complex-mixed.grouped-spelling`, `11e.compound-mixed.grouped-spelling` | Both additive/mixed expressions flatten to 11/8. | **Missing / importer and MNX representation.** |
| `11f.numeric-duration` | Semantically inconsistent cut on 3/8 and single-number on 1/8+2/4 retain and print the numeric totals 3/8 and 5/8. | **Correct** totals. |
| `11f.inconsistent-cut-symbol` | The first source requests cut on 3/8. Import warns and prints a numeric fraction; the manifest explicitly makes display application-dependent. | **Unresolved / source/reference ambiguity** for glyph policy. |
| `11f.single-number-display`, `11f.separate-fraction-spelling` | The second source requests numerator-only 1/8+2/4. Import warns and prints stacked 5/8, losing both display and grouping. | **Missing / importer and MNX representation.** |
| `11g.numeric-duration` | Single-number 3/8 and (3+2)/8 retain and visibly distinguish 3/8 and 5/8 totals. | **Correct** totals. |
| `11g.single-number-display`, `11g.additive-numerator` | Both numerator-only controls and the second bar's `3+2` spelling are lost; both shells show ordinary 3/8 and 5/8. | **Missing / importer and MNX representation.** |
| `11h.unmetered-state`, `11h.explicit-X-symbol` | Empty and X `senza-misura` declarations vanish. No X appears, and default metric interpretation produces underfill badges in bars 1, 3 and 4. | **Incorrect** unmetered state; **missing** X mark / importer and MNX representation. Exact X placement is unresolved. |
| `11h.full-measure-rest-context`, `11h.two-voice-context` | Bar 2's full-measure rest and notes in two voices in bars 3–4 are visible, but this meter pass did not isolate the rest's duration semantics or exact voice timing/identity. | **Unresolved / not yet isolated.** These are explicit dispositions, not passes. |
| `11i.primary-meters` | All six primary fractions (3/4, 2/2, 4/4, 3/4, 2/2, 3/4) survive and print. | **Correct.** |
| `11i.alternate-meters`, `11i.relations-and-enclosures` | Six alternate meters, including 7/8+1/8, and parentheses/bracket/equals/hyphen/slash/space separators disappear with source-located warnings. | **Missing / importer and MNX representation.** |

The report contains 26 **correct**, 26 **missing**, 6 **incorrect**, 8 **unresolved** and 2 **not applicable** shell rows. Counts describe this bounded meter feature list, not a percentage of MusicXML support.

## Ownership and remaining work

[Completed item 22](../roadmap/complete/core-musicxml-render-gaps.md) owns the exact numeric totals, compatible common display, diagnostics and independent piano-staff repair. Grouping, hidden/staff-local, single-number, unmetered and alternate information remain its documented carrier/display deferrals. Current evidence confirms those losses but introduces no new independent gap proposal. [Completed item 23](../roadmap/complete/core-musicxml-write-gaps.md) made the Studio imported versions editable and extended representable numeric meter controls; neither change establishes feature-specific create/inspect/change/remove, undo/redo or save/reopen results here.

The [earlier Workbench meter write probe](musicxml-meter-assessment.md#write-path-findings) and [later numeric-range repair](musicxml-meter-assessment.md#extended-numeric-meter-authoring--application-e0feec14) remain bounded evidence. [Write item 19](../roadmap/inprogress/core-musicxml-write-assessment.md) still needs source-feature task matrices and each persistence route, particularly Studio's editable version versus its lossy GP storage path. [Render item 18](../roadmap/inprogress/core-musicxml-render-assessment.md) still needs the rest of the pinned suite, and the unresolved cases above remain open.
