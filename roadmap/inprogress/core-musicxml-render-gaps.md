# MusicXML rendering gaps — preserve the music before judging its engraving

> **Status: in progress, 2026-09-22.** Campaign item 22. Initial bounded findings from
> [render assessment item 18](../inprogress/core-musicxml-render-assessment.md), which
> remains in progress. [Campaign contract](../inprogress/core-campaign-musicxml.md).
> This is the requested follow-up proposal, not an exhaustive feature backlog.

## Agreement

1. **Oracle:** original pinned MusicXML, source descriptions, retained browser captures
   and imported MNX in [the assessment](../../docs/musicxml-editor-assessment.md).
2. **MNX verdict:** preserve representable data. Fractional pitch and variable staff
   lines require a representation decision; never put decimals into integer-only
   published `pitch.alter` or hand-edit the published schema.
3. **Dependencies:** no runtime notation library or new runtime dependency.
4. **Matrix:** converter fixes regenerate converter and independent-oracle evidence;
   screenshots alone never upgrade support cells.
5. **Acceptance:** named regressions, original-file browser smoke, explicit residual
   losses. Renderer changes regenerate goldens and register any approval debt in
   [lab-verify](../inprogress/lab-verify.md); no hand-written verification.

## Selected gaps, in dependency order

### P1: preserve independent piano staves; never infer guitar tuning

`43a-PianoStaff` has treble and bass clefs, two pitches, and no string tuning. Opening
it produces one pitch and standard guitar strings with `staffKind: both`, without an
import warning. Both piano staff identity and music have been lost before rendering.
Regression isolation: the converter preserves both staves; `upgradeTabExtension` in the
shared file-loading path treats every second staff as legacy tab. Require actual legacy
markers per part, and preserve modern parts when another part needs migration. The
independent XML note table and original fixture establish both pitches/staff assignments.
No converter-support claim changes from this migration fix. Do not hide the Tab button
to conceal the corruption; genuine legacy notation/TAB migration must still work.

Acceptance: original fixture retains both notes on their original staves, offers only
Notation without actual strings, and reports no fabricated tuning. Also cover
`11b-TimeSignatures-NoTime` and a real notation/TAB counterpart to prove intentional
single-source merging still works. Compare independent note multiplicity, imported
staff assignments and browser engraving; run the converter suite and importer smoke.

### P1: report fractional-pitch loss rather than silently changing pitch

`01d-Pitches-Microtones` requests alterations -1.5, -0.5, +0.5, +1.5 twice. Import
produces -1, 0, 0, +1 twice, with no warning; the capture shows ordinary accidentals.
`aligner.ts` reads pitch alteration with `getChildInt`. Published MNX's `alter` is an
integer, so changing that call to a float is not a sufficient or valid fix.

First acceptance: detect and explicitly diagnose the exact lost pitches on import;
never advertise successful microtonal rendering. Full support is deferred to an
explicit spec-loop/carrier decision (topic: microtonal pitch), followed by matching
import, engraving, playback, editing and export support. Preserve the original XML
as evidence. Quartertone, arrow, Turkish/Persian variants remain separate review work.

### P2: diagnose unsupported staff-line configurations

`14a-StaffDetails-LineChanges` requests one, five, four and three lines, including a
mid-measure change and hidden individual lines. Imported MNX carries none of those
instructions; the capture draws ordinary five-line staves with no import warning.

First acceptance: an actionable importer warning identifies the unsupported staff
configuration and location. Full engraving support is deferred pending a representation
proposal (topic: staff configuration); no arbitrary new standard fields. A future
implementation must preserve changes and visibility, then prove each affected measure
in a browser capture. Do not classify this as an SVG-only defect.

### P1: contain unsupported-clef failures without blanking the score

`12a-Clefs`, `34c-Font-Size`, `41c-StaffGroups` and `73a-Percussion` show a
`staffPosition` exception in both shells (notation; also Both for staff groups).
The percussion import contains `{clef: {sign: "percussion"}}`, which fails the current
published-schema shape; inspect importer validation before attributing the root cause
solely to layout. The renderer then fails the whole projection, including valid content.

Acceptance: import either preserves a supported representation or reports the unsupported
clef at its source location. Forgiving layout must produce an explicit local placeholder
and diagnostics while retaining unrelated valid staves, rather than an uncaught access
or blank projection. Use the minimal percussion fixture plus a mixed pitched/unpitched
probe; verify the reported unsupported scope and both browser shells. This does not
promise a full percussion editor or supersede the separate percussion-kit proposal.

### P1: retain exact meter duration and existing common/cut display

Added from the [12-fixture meter review](../../docs/musicxml-meter-assessment.md),
with new both-shell captures explicitly showing time signatures. `11c` additive beats
are truncated; `11d`/`11e` retain only the first fraction. For example (3+2)/8 becomes
3/8 and 3/8+2/8+3/4 becomes 3/8 instead of 11/8, silently. `11a` bar 2 loses
common display even though published MNX supports it.

Acceptance: compute exact rational duration across every beats/beat-type pair, retaining
an equivalent valid MNX count/unit where possible; preserve compatible common/cut
symbols. Never silently discard grouping, alternate meters, single-number display,
local visibility or unmetered state. Diagnose each unsupported feature at its source
location, and agree on fallback semantics before implementation. Do not invent a
standard field or claim equivalent duration preserves additive engraving. Exercise all
12 meter originals and repeat the independent semantic/XSD checks and visible-meter
browser captures. An inconsistent symbol/value (`11f`, or `11a` bar 1) needs an explicit
policy with a regression, not an arbitrary glyph expectation. Full grouped, alternate,
local/hidden and unmetered support requires a separate carrier/spec decision.

## Boundaries

These are agent-assessed source → document → display findings, with no human-verification
claim. Cosmetic spacing and unresolved corpus features are not included. The meter section explicitly extends the four initial findings with separately retained
evidence. Further scope changes require the same source, data and UI evidence. The [write-gap proposal](../proposed/core-musicxml-write-gaps.md) owns editor
reachability and persistence, and shares the representation blockers above.
