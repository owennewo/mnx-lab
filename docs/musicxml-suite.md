# External MusicXML suite

Campaign item 13 vendors all **183** files from the W3C Music Notation Community Group's
[LilyPond-derived test suite](https://github.com/w3c-cg/musicxmlTestSuite) at commit
`77c19f7e819154c70ca1a1992e80dcda8ff82fea`. Its MIT licence and upstream README are kept
verbatim beside the files in `converters/fixtures/musicxml-suite/`; fixture notices are
unchanged. This is a dev-time corpus, not a runtime dependency or browser bundle asset.

## Reproduce

The normal test gate needs neither Python nor a network connection:

```sh
npm run check:musicxml-suite
```

After a reviewed converter change, inspect and regenerate the observation report:

```sh
npm run update:musicxml-suite
git diff -- harness/reports/musicxml-suite.json
```

To reproduce the vendor tree from upstream (Python standard library + git):

```sh
git clone https://github.com/w3c-cg/musicxmlTestSuite.git /tmp/musicxmlTestSuite
npm run sync:musicxml-suite -- /tmp/musicxmlTestSuite --check
```

Without `--check`, the command writes the pinned files and manifest. It reads git blobs
at the hardcoded revision, not the clone's current branch or working-tree contents. A pin
update requires a reviewed script change, manifest/source regeneration, count review in
the test, and a new observation baseline. Unexpected files in the owned vendor directory
cause refusal rather than silent deletion. Do not edit vendored fixtures in place.

## What the artifacts say

- `converters/fixtures/musicxml-suite/manifest.json`: source revision, notice hashes,
  stable fixture IDs, file hashes, format/version, upstream descriptions, categories,
  intended test classes, and source XML element counts. Descriptions are whitespace
  normalized; missing descriptions remain null. The whole upstream `xmlFiles/` tree is
  included. Compressed input is inventoried with Python's independent ZIP reader.
- `harness/reports/musicxml-suite.json`: for each fixture, import/export/re-import
  dispositions, output hashes, warnings, published and extension validation errors, and
  definitions disappearing after re-import. Output hashes include the deterministic
  encoding stamp; no timestamp is requested. Harness observation errors fail the test
  instead of masquerading as converter failures.

`completed` means only that the pipeline did not throw. `validImports` means that both
schema checks passed. Neither means musically correct, rendered correctly or editable.
`lostDefs` checks whole definition disappearance, not loss of individual values or
instances. The existing converter matrix has that same limitation; this external source
report does not inflate it by treating our own imports as independently known truth.
The fixture hashes and committed baseline are regression tripwires, not external oracles.

There are **177 feature**, **3 explicitly invalid**, and **3 compatibility** cases. The
negative classification comes from upstream's `.invalid.` filenames, compatibility from
category 99; neither is silently excluded or included in a claimed feature pass rate.
All 183 complete the pipeline at the initial baseline. Of the 177 feature cases, **164**
produce MNX valid against both schemas; **13** do not:

| Finding | Fixtures |
|---|---|
| Clef lacks required `staffPosition` | `12a-Clefs`, `41c-StaffGroups`, `73a-Percussion` |
| Published MNX rejects emitted section/rehearsal/directions properties | `21d-Chords-SchubertStabatMater`, `31a-Directions`, `31b-Directions-Order`, `31d-Directions-Compounds`, `31f-Direction-Multiline-Compounds`, `32b-Articulations-Texts`, `34b-Colors`, `34c-Font-Size`, `52a-PageLayout` |
| Harmony extension requires missing text | `71f-AllChordTypes` |

The report also detects the `rest` definition disappearing on the `71e-TabStaves` round
trip. Only three inputs emit import warnings; no export warnings are emitted in this
baseline. Silence is plainly insufficient evidence of support. These are findings for
triage, not fixes delivered by item 13.

The existing 27-pair oracle remains at 24 exact matches and three final-barline content
mismatches; the established MNX-authored matrix remains 43 supported / 66 lossy /
7 extension / 3 untested. The new corpus changes neither artifact.

## Next use

Item 14 adds independent music21 semantic expectations; item 15 adds XSD export checks.
Items 18 and 19 reuse manifest fixture IDs and source descriptions for actual editor
rendering and authoring assessment. An XML element inventory is only an aid to selecting
those tasks, not a substitute for reading what each fixture is intended to demonstrate.
No browser captures, visual verdicts, write-path verdicts or human approvals are claimed
by this initial sweep.
