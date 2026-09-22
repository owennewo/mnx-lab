# Independent MusicXML checks

Campaign items 14 and 15 add two independent instruments over the same **344 cases**:
183 external fixtures, 27 W3C comparison sources, 130 committed scenario documents, and
four reference scores. Scenario and reference cases exercise export; XML sources exercise
both directions. Every generated export is XSD-checked, even if the semantic adapter is
unable to compare it. Errors and unsupported cases remain in the report.

## Reproduce

The app and normal root tests require no Python. They compare current XML hashes and
MNX note tables against committed external captures, and reject stale capture inputs.
For a live independent run, use the explicit dev-only environment:

```sh
npm run setup:musicxml-oracle
npm run check:musicxml-oracle-live
```

`uv.lock` locks music21 10.5.0, lxml 6.1.3 and their transitive dependencies. Python 3.12
is selected in the project's `.python-version`. Neither package enters the JavaScript
runtime or browser bundles. A live run takes seconds on this corpus; it has a bounded
subprocess timeout. XML parsing disables external entity/DTD fetching, and the XSD
resolver accepts only the pinned local dependencies.

After changing converter output or the capture adapter, recapture and review:

```sh
npm run capture:musicxml-oracle
git diff -- harness/reports/musicxml-independent.json
npm run check:musicxml-oracle-live
```

`harness/fixtures/musicxml-independent.json` retains the external note tables, warnings,
XSD errors, tool versions and input/tool/schema fingerprints. The generated readable
report is `harness/reports/musicxml-independent.json`. `update:musicxml-independent`
updates comparison verdicts against an existing capture; it does not bypass stale XML
or tool fingerprints. Do not regenerate a regression away without reviewing its cause.

## What a semantic match means

music21 reads the original XML directly; the MNX adapter independently walks the document
without converter duration, cursor or pitch helpers. Export comparisons use music21's
reading of our output against the input MNX. The comparison covers:

- Part count and written measure count/order, staff assignment and voice partition.
  Voice names are canonicalized by complete voice contents; multiplicity is retained.
- Measure-local onset and duration as rational quarter-note fractions. No repeat expansion,
  tempo playback or floating-point tolerance. A quantized source duration can disagree
  with its printed tuplet; that is a finding to interpret, not automatically a converter bug.
- Sounding semitone pitch including microtones, after instrument transposition; enharmonic
  spelling and pitch display are outside this claim.
- Grace order at an onset and written grace duration, with zero metric duration.
- Tie start/stop/continue state, and lyric identifier/text/syllabic state.

Silent spacer rests inserted by music21 for `<forward>` are omitted; following note onsets
still constrain timing. Explicit hidden-rest identity is outside this table's claim.
Ottava sounding-pitch handling, unpitched identity and MNX tremolo containers currently
have explicit adapter/oracle limitations. Default notation/TAB display duplication is
also unassessed where it requires a part-correspondence policy; it is not called data loss.
Empty staves, articulations, dynamics, layout and technique are not certified by a match.
The render and write-path assessments remain independent work.

Mutations demonstrate detection of changed pitch, onset, lyric, voice partition and
multiplicity against a real independently read score. A separate timing test covers
nested tuplet/grace traversal. music21 can reject or interpret a fixture differently;
`oracle-limited` and `different` are evidence to investigate, not unconditional blame.

## XSD provenance and limits

`harness/fixtures/musicxml-4.0/` contains byte-identical `musicxml.xsd`, `xml.xsd` and
`xlink.xsd` from the W3C MusicXML **v4.0** tag, commit
`799e2defb2ece0ae7bafe08dcbcac25b2c631d53`. Copyright and FSA notices remain inside each
file; `provenance.json` records source and hashes. For example, reproduce a file with:

```sh
git clone --branch v4.0 https://github.com/w3c/musicxml.git /tmp/musicxml40
git -C /tmp/musicxml40 show 799e2defb2ece0ae7bafe08dcbcac25b2c631d53:schema/musicxml.xsd
```

Every capture verifies a known-valid score, a negative duration and malformed XML against
the schema before scoring exports. Root tests bind those captured judgments to exact
current output bytes. Live validation is the external-tool gate; root checks alone do
not invoke libxml2. Existing failures are explicit baseline findings, not permission to
claim all exports conform. Validation establishes grammar, not musical fidelity.

## Initial findings (before converter fixes)

132 of 177 feature imports match the declared note-table scope, 37 differ, and 8 have
oracle limitations. 292 of 344 exports validate against XSD. The largest XSD defect is
`alter` emitted after `octave`; tuning alterations repeat the same mistake. Rehearsal and
section words share a direction-type where MusicXML requires separate direction-type
children. Smaller outstanding classes include zero durations, empty parts, and rootless
harmony kinds. The generated report is the current authority as fixes land.

The W3C tuplet source is an instructive discrepancy: its durations are quantized (e.g.
85/128 quarter notes) while the imported MNX expresses 2/3. The layout oracle cannot
expose that timing disagreement. Do not weaken exact timing to make it disappear.

## First fixes

Items 20 and 21 improve XSD validity **292 → 336 → 340 of 344**. Ordering changes leave
all note-table judgments unchanged; the divisions fix changes three external export
comparisons from different to match and reduces the rest-gallery difference. Four XSD
failures remain: two empty-part layout documents and two rootless harmony cases.
The existing converter matrix and core primitives goldens are unchanged.
