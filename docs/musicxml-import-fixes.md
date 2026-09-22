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
  a line change when the sign stays the same. An MNX space/off-staff position produces
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
examples in each direction. No new extension or runtime dependency was added.

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

Unsupported-clef crash containment and exact meter import remain next in item 22.
Hidden/local meter in `11b` is still lost. Full microtonal/staff-configuration support
requires the representation decisions already specified in that item; the warning fixes
do not close those deferred capabilities. Studio title reachability, numeric meter UX
limits, and the remaining corpus-wide feature/task assessment are also still open.
