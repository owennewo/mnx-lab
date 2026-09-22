# MusicXML loading and clef fixes, 2026-09-22

Campaign item 22 now repairs independent piano staves and ordinary clef placement, and
reports two previously silent import losses. This is a bounded implementation result;
the full render/write assessments and the remaining parts of item 22 stay in progress.

## What changed and why

- **Piano loading:** the converter already preserved `43a-PianoStaff`'s F4 on staff 1
  and B2 on staff 2. The shared `upgradeTabExtension` load path mistook any staff 2 for
  legacy tablature, deleted its notes and invented guitar strings. Migration now requires
  actual legacy markers for each part. A mixed legacy guitar/current piano regression
  also proves the piano remains untouched while the old guitar still upgrades.
- **Clef placement:** the restored bass staff exposed the converter's `-line` mapping.
  MusicXML F on line 4 needs MNX staff position +2, not -4. Import/export now translate
  coordinate origins and units, apply conventional missing-line defaults, and preserve
  a line change when the sign stays the same. An MNX clef placed in a space produces
  an export warning and a conventional-line fallback instead of invalid MusicXML.
- **Fractional pitch:** each unsupported fractional alteration produces a warning naming
  part, measure, note, original alteration and integer fallback. `01d` gives eight
  warnings. Its fallback pitches are unchanged; full microtonal support is not implemented.
- **Staff configuration:** unsupported line counts and individual line detail produce
  location-specific warnings, including attributes after notes. `14a` gives four
  warnings. The renderer still uses five-line notation; this is honest loss reporting,
  not a claim of variable-staff support.

The coordinate oracle is independent of our converter:
[MusicXML line](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/line/)
counts staff lines from the bottom, while the
[MNX clef](https://w3c.github.io/mnx/docs/mnx-reference/objects/clef/)
uses staff position. Tests use explicit G2 → -2, F4 → +2, C3 → 0, C4 → +2 and G1 → -4
examples in each direction. The pinned XSD permits integer lines beyond 1–5;
explicit off-staff line 0 and 6 tests preserve those values, even though music21 cannot
read all such unusual clefs. Only fractional lines require the warned fallback.
No new extension or runtime dependency was added.

## Browser evidence and its limits

[Retained manifest](../harness/fixtures/musicxml-import-fix-evidence/manifest.json),
[Workbench observations](../harness/fixtures/musicxml-import-fix-evidence/workbench/index.json)
and [Studio observations](../harness/fixtures/musicxml-import-fix-evidence/studio/index.json)
record four unchanged original sources per shell at application commit `744f0c84`, Chrome
153, 1440×1000, scale 1, density 2, with time signatures explicitly shown.

`43a-PianoStaff` and `11b-TimeSignatures-NoTime` were visually reviewed in both shells:
both staves contain their source notes, the bass clef is correctly placed, and only
Notation is available. All four imported document hashes agree between shells; no
projection throws. The retained microtone/staff-line observations prove the warnings in
Workbench, not full feature rendering. Studio still views these untitled originals as
older versions with editing suspended. Its conversion-note state belongs to the current
GP seed, so its warnings must not be counted as fresh XML diagnostics.

Reproduce with a current build and the local Studio setup from
[the assessment](musicxml-editor-assessment.md):

```sh
MUSICXML_CAPTURE_FILTER='^(43a-|11b-|01d-|14a-)' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/musicxml-fixes-workbench node harness/verify/musicxml-editor-capture.mjs
MUSICXML_CAPTURE_SHELL=studio MUSICXML_CAPTURE_FILTER='^(43a-|11b-|01d-|14a-)' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/musicxml-fixes-studio node harness/verify/musicxml-editor-capture.mjs
```

## Validation and remaining work

The four migration regressions and twelve clef-coordinate cases failed before their
fixes. Existing legacy migration and converter notation/TAB round trips continue to pass.
Independent capture covers all 344 cases: alto/tenor scenario export changes from an
oracle parse failure to a match; other verdicts are unchanged. XSD validity remains
340/344. The converter matrix, 27-case W3C layout baseline and all core scenario goldens
are unchanged. Captures are agent evidence, not human verification; no approval record
or scenario status was manually changed.

Unsupported-clef crash containment has now landed as detailed below; exact meter import
remains next in item 22.
Hidden/local meter in `11b` is still lost. Full microtonal/staff-configuration support
requires the representation decisions already specified in that item; the warning fixes
do not close those deferred capabilities. Studio title reachability, numeric meter UX
limits, and the remaining corpus-wide feature/task assessment are also still open.

## Unsupported-clef containment follow-up

Application commit `77da16d3` stops unsupported clefs from blanking whole projections.
The import warns about every unsupported sign and retains it for inspection; such a
clef is still outside the published MNX schema. No invented standard field or vendor
carrier makes it falsely valid. The plan marks its active interval internally, the
renderer draws question marks for unavailable pitch placement, and per-measure badges
identify the affected part/staff. Valid staves, rests, and subsequent supported-clef
intervals continue rendering. The projection failure panel no longer asserts that an
arbitrary failed document validates.

`73a-Percussion` keeps the pitched timpani visible, while cymbal/triangle placement gets
explicit placeholders. Import reports the two unsupported percussion clefs, six existing
C4 fallbacks for unpitched notes and the unsupported one-line staff. This is not a claim
of percussion notation, instrument identity, playback or authoring support. In particular,
the existing unpitched fallback is now disclosed, not repaired.

The [retained captures](../harness/fixtures/musicxml-clef-evidence/manifest.json) cover
`12a-Clefs`, `34c-Font-Size`, `41c-StaffGroups` and `73a-Percussion` in both shells at
1440×1000, scale 1, density 2, with time signatures shown. Every observation has zero
projection errors; imported document hashes agree between shells. Visual review confirms
local placeholders and surviving valid music, including the lower orchestral staves.
These are containment verdicts, not full correctness approvals for font sizes, grouping,
clef octaves or other source features. Both projection APIs also pass mixed-staff,
inherited-clef and mid-measure recovery regressions with hidden clefs; all 12 cases
failed on the previous implementation. Core goldens and the converter matrix/W3C
layout baseline remain unchanged.

### Capture correction for tall Studio scores

A tall viewer can scroll inside Studio's scrolling score frame. The old capture tool
scrolled only the outer frame, so it could miss lower staves even though the complete
SVG was retained. It now selects the overflowing viewer, brings it into view, and bases
tile overlap on the visible rectangle. Reports record the scroll target, visible/client
sizes and capture-script SHA-256. `41c-StaffGroups` now has four Studio tiles covering
its 2,623-pixel inner scroll extent, including the final staves; Workbench has five.
The other three fixtures need two Studio tiles and one Workbench tile each.

Earlier corpus-wide Studio PNGs are historical observations, not proof that every lower
staff was reviewed. Future assessment of tall sources must recapture them with this
corrected tool. The previous small piano/meter proofs remain bounded to their visible
content; this discovery does not broaden those verdicts. Studio title promotion remains
blocked for these untitled originals, and its warning state while viewing an older
version still belongs to the current GP seed.

Reproduce the captures with the existing command, changing the filter to
`^(12a-|34c-|41c-|73a-)` and choosing separate output directories for each shell.
