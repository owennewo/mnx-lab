# MusicXML meter assessment, 2026-09-22

**Current feature verdicts:** [2026-09-24 meter rendering assessment](musicxml-meter-current-assessment.md). This page preserves the earlier bounded review and pre-fix evidence.

All **12** time-signature fixtures have been reviewed against their original XML and
notation captures in Workbench and Studio. These are agent findings, not human scenario
verification. The broader render/write assessments remain in progress. This review is
about meter semantics and display; it does not approve every feature in these scores.

The initial full-corpus sweep hid time signatures through the editor's display preference.
It cannot establish whether a meter glyph is missing. This recapture uses the real
**Settings → Time signatures → Show** control and records every effective display option.
Future families must likewise check preferences before assigning absence-based verdicts.

## Evidence

- [Source time elements and imported changes](../harness/reports/musicxml-meter-assessment.json)
- [Retained original PNG/SVG/MNX and hash manifest](../harness/fixtures/musicxml-meter-evidence/manifest.json)
- [Workbench observations](../harness/fixtures/musicxml-meter-evidence/workbench/index.json)
- [Studio observations](../harness/fixtures/musicxml-meter-evidence/studio/index.json)
- [Authoring actions, rejections and exact-history results](../harness/fixtures/musicxml-meter-evidence/write/report.json)

Both shells ran application commit `6f0b09b0`, Chrome 153, 1440×1000, device scale 1,
staff scale 1 and spacing density 2. All 12 notation captures were visually reviewed in
both shells. The extra Tab/Both observations for `11b` are diagnostic only: the source
has no string tuning. Imported document hashes agree between shells. Studio viewed each
unchanged original through Versions; all 12 remained suspended after “Make current”
failed for missing title metadata. Those captures prove display, not Studio authoring.

[MusicXML time](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/time/)
allows additive beats and multiple fractions. Its
[symbol attribute](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/time-symbol/),
[senza-misura](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/senza-misura/)
and [interchangeable](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/interchangeable/)
carry distinct display/semantic information. Published MNX currently has one positive
integer count, one denominator through 128, and optional common/cut display. It has no
corresponding additive grouping, alternate meter, single-number display or unmetered field.

The [subsequent loading fix](musicxml-import-fixes.md) restores `11b`'s independent
piano staff and ordinary bass-clef position. Its hidden/local meter loss remains;
the meter captures here are the unchanged pre-fix record.

## Variant verdicts

Measure numbers below are one-based source order. Duplicate source families are named
explicitly; they were each loaded and reviewed. “Correct” applies only to the stated
variant. For every failure below the imported data already loses information, so a
renderer-only patch cannot recover it. Both shells show the same meter losses.

| Sources / variant | Original → imported → visible result | Verdict / ownership |
|---|---|---|
| `11a`, numeric values in all 11 bars | 2/2, 4/4, 2/2, 3/2, 2/4, 3/4, 4/4, 5/4, 3/8, 6/8, 12/8 retained and visibly correct as fractions | Correct numeric values; no whole-fixture pass |
| `11a`, bar 2 common symbol | `symbol="common"`, 4/4 → no `display` → numeric 4/4 | Importer gap; MNX already represents this |
| `11a`, bar 1 symbol | XML says common with 2/2; description says alla breve | Unresolved glyph policy for inconsistent input; numeric value retained |
| `11b`, absent initial meter | No initial time element → no initial time field → no glyph | Display consistent with source absence; application's implicit metrical interpretation not approved |
| `11b`, hidden/local meter | Bar 2 hidden 2/2; bar 3 visible staff 1 / hidden staff 2 4/4 → global fractions with no visibility/scope → both staves display both changes | Import/representation gap; independent piano-staff loss also applies |
| `11c-Complex`, `11c-CompoundSimple`, additive count | (3+2)/8 and (5+3+1)/4 → 3/8 and 5/4 → wrong fractions and overfill diagnostics | Importer truncates the numerator; grouping representation also missing |
| `11d-ComplexMultiple`, `11d-CompoundMultiple`, multiple fractions | 3/8+2/8+3/4 = 11/8; 5/2+1/8 = 21/8 → 3/8 and 5/2 → only first fraction | Importer loses metrical duration; display representation gap |
| `11e-ComplexMixed`, `11e-CompoundMixed`, additive plus fractions | (3+2)/8+3/4 = 11/8 → 3/8 → wrong fraction | Both truncation paths apply |
| `11f-SymbolMeaning`, incompatible symbol/value | cut with 3/8; single-number on 1/8+2/4 → numeric 3/8 and 1/8 | Exact glyph policy unresolved (fixture explicitly permits interpretation); second duration definitely wrong: 5/8 required |
| `11g-SingleNumber`, bar 1 display | single-number 3/8 → numeric 3/8 | Value correct; single-number display lost |
| `11g-SingleNumber`, bar 2 grouping/value | single-number (3+2)/8 → no change from prior 3/8 → no new glyph | Wrong duration plus grouping/display loss |
| `11h-SenzaMisura`, unmetered state | Empty marker then text X → no unmetered data → ordinary metric underfill/overfill diagnostics | Representation/import gap; empty first glyph alone cannot prove correct semantics |
| `11h-SenzaMisura`, explicit text | X discarded → no X visible | Representation/display gap |
| `11i-Alternate`, primary values | 3/4, 2/2, 4/4, 3/4, 2/2, 3/4 retained and visible | Correct primary fractions only |
| `11i-Alternate`, alternate values and separators | Alternate 6/8, 4/4, (7/8+1/8), 6/8, 4/4, 6/8 with parentheses/bracket/equals/hyphen/slash/space all disappear | Representation/import gap for alternate fractions and relations |

Workbench reports no import warnings for these losses. Studio's warning state while
viewing an older version belongs to its current source and is not an independent XML
warning observation. In the importer, `aligner.ts` reads the first `time` child using
integer `beats` and `beat-type`; additive text is truncated and later fractions ignored.

## Write-path findings

On original `11a`, Workbench selects the first bar (Shift+5), opens its inspector (Enter),
and submits each command below. All five tasks preserve every pitched note and every
other measure, validate published MNX and the root extension, and exactly undo/redo.
Meter changes legitimately add/remove trailing rests; the probe checks those explicitly.

| Task | Inspector command | Observed data result |
|---|---|---|
| Remove explicit meter | `time inherit` | First-bar time field removed |
| Create meter | `time 5/4` | 5/4; existing whole note plus quarter rest |
| Change meter | `time 6/4` | 6/4; existing whole note plus two quarter rests |
| Set common display | `time common` | 4/4 with `display: common`; padding removed |
| Set cut display | `time cut` | 2/2 with `display: cut` |

The final cut-time document survives JSON panel Copy → external file save → Open MNX
exactly. Intermediate states were not separately reopened; MusicXML download and GP
storage preservation are not proved here. The probe checks common/cut data creation,
not their rendered glyphs. Existing normal-piece Studio smoke is supplementary evidence;
these imported Studio fixtures remain blocked, so none receives an authoring pass.

Actual inspector submissions reject `time 3/128` and `time 33/4`, leaving the document
unchanged. These are representable in published MNX but outside the inspector parser's
range (denominators through 64; count through 32): a bounded authoring gap.
`time 3+2/8` and `time 3/4 single-number` also reject without mutation. Those involve
missing representation, not just extending a parser. Alternate meter, local suppression
and unmetered create/change/remove tasks need a carrier decision and independent UI
assessment; their absent imported data does not itself prove every possible authoring
route unavailable. Inspect/discoverability beyond the exercised bar inspector is open.

## Reproduce and next work

After `npm run build`, with Chrome installed:

```sh
MUSICXML_CAPTURE_FILTER='^11' MUSICXML_CAPTURE_TIME_SIGNATURES=show MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-meter-captures node harness/verify/musicxml-editor-capture.mjs
node harness/verify/musicxml-meter-write-probe.mjs
```

For Studio add `MUSICXML_CAPTURE_SHELL=studio` and use a separate capture directory plus
fresh local library state, as described in [the main assessment](musicxml-editor-assessment.md).
No production state or scenario verification records are changed.

The requested [render gaps](../roadmap/complete/core-musicxml-render-gaps.md) and
[write gaps](../roadmap/complete/core-musicxml-write-gaps.md) now include these bounded
meter findings. Other corpus families, unresolved meter display policy, independent
reference-engraving comparison where XML is ambiguous, and remaining task/persistence
combinations still belong to assessment items 18/19. This batch does not close either.

## Exact-meter follow-up — application `f15abe6b`

The importer now sums every primary beats/beat-type pair using exact rational
arithmetic. The complex/compound examples retain 5/8, 9/4, 11/8 and 21/8 rather
than their first component. Grouping is still flattened and explicitly warned.
Compatible common (4/4) and cut (2/2) displays survive import and export, including
changes that only alter display. Incompatible source symbols retain numeric duration
with a warning. Local/hidden, alternate, single-number, unmetered, invalid and
unrepresentable instructions have source-located diagnostics; no new carrier is claimed.

All twelve originals were reopened in both shells with time signatures shown. Exact
captures, SVGs, imported documents and observations are retained in
`harness/fixtures/musicxml-meter-fix-evidence/`, including the nested Studio scroll.
Both shells imported identical document hashes and reported no render exceptions.
Selected visual inspection of 11a and 11d in both shells, plus 11c/11e in Workbench,
confirms the common symbol and corrected numeric totals. This is a bounded check,
not a visual pass for every feature in those scores. The 11d second bar still has an
underfill diagnostic (20 eighth-note units against 21/8); retaining the source meter
does not authorize adding notes to make it fit. Historical captures above remain
receipts of the earlier implementation.

Studio still rejects making these untitled originals current, leaving their XML
viewing session suspended for editing. These render captures therefore provide no
new Studio authoring verdict. The existing write-gap proposal remains applicable.
The converter suite adds 23 meter regressions; the measured common/cut display row
moves from lossy to supported (44 supported, 65 lossy, 7 extension, 3 untested).
Independent note-table verdicts remain unchanged; that oracle does not assess meter
spelling or grouping.

## Extended numeric-meter authoring — application `e0feec14`

The two representable-meter rejections above are superseded: the shared inspector
accepts `time 3/128` and `time 33/4`. The Workbench original-file probe retains
seven edits, exact undo/redo, invalid-input and typed-command cancellation checks,
and exact final MNX copy/save/reopen evidence in
`harness/fixtures/musicxml-meter-write-fix-evidence/`. Its original whole note stays
when changing to 3/128, with a legitimate overfill; separate structural tests prove
exact padding of a one-128th-note bar with two 128th rests. The inspector documents
a 1,024-beat editing limit because padding creates per-beat rests.

The extended `studio-editor-smoke.mjs` types both commands in a newly created, editable
Studio piece and checks unchanged pitched content plus exact history. Inherited bars
receive the expected rest padding. These commands are undone before the smoke's
normal GP checkpoint/reload checks; extended-meter GP storage fidelity is not claimed.
At that capture the untitled imported-version reachability issue remained open; the
[later title-workflow assessment](musicxml-editor-assessment.md#untitled-studio-versions--title-workflow-follow-up)
records its repair on three original examples.
