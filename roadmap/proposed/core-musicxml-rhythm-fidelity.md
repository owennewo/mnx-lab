# MusicXML rhythm fidelity — written values and unwritten time

> **Status: proposed, 2026-09-24.** MusicXML campaign item 26.
> Bounded gaps from [render assessment item 18](../inprogress/core-musicxml-render-assessment.md),
> evidenced in the [seven 03-series originals](../../docs/musicxml-rhythm-assessment.md).
> This proposal does not close the assessment or implement fixes. Serves the
> implementation loop. [Campaign contract](../inprogress/core-campaign-musicxml.md).

## Agreement

1. **Oracle:** pinned original MusicXML and manifest descriptions, source note
   and cursor-control IDs, exact rational onsets and durations, browser-imported
   MNX, both-shell Notation captures, and a separate authored-MNX layout probe.
   Compare written value/ink and onset separately. A correct note count alone
   misses both false rests and shifted timing.
2. **MNX verdict:** published MNX already has `maxima`, `longa`, `breve`,
   `256th`, `512th`, `1024th` note-value bases and fractional `space` items.
   Preserve those; no extension or published-schema edit is justified by
   these fixtures. `03d`'s full-bar rest grouping is owned by item 25.
3. **Dependencies:** no new runtime dependency or notation library. Extend
   the existing converter, model and custom SMuFL layout where needed.
4. **Matrix:** converter changes regenerate the support matrix and
   independent note-table/XSD evidence. Screenshots alone do not upgrade
   support cells.
5. **Acceptance:** exact structural and timing regressions plus original-file
   Workbench and Studio captures. Isolated MNX probes prove renderer ink when
   current import loses the value. Re-earn primitives after model/engine
   changes and register moved golden approvals in
   [lab-verify](../inprogress/lab-verify.md). Never hand-write verification
   status or expected goldens.

## P1: retain the entire requested note-value ladder

`03a` has 45 C5 notes across plain, dotted and double-dotted ladders. Nine
maxima/longa/breve values import as `whole` with three dots, and twelve
256th/512th/1024th values import as undotted 128ths. The 24 ordinary
whole-through-128th values keep their own types and dots, but 39 imported
note onsets are displaced after earlier duration losses. The browser draws
false underfill badges under 16/2, 24/2 and 28/2. There is no import warning.

Expand the converter's type and rational-duration handling through the
MusicXML 1024th and maxima endpoints. Use an explicit source `<type>` for
the written value, while checking `<duration>`/`<divisions>` for metric
consistency; never approximate an exact source duration as the closest
supported dot pattern without warning. Distinguish MusicXML `long` from
MNX `longa` deliberately. Acceptance: all 45 source variant IDs retain
written type, dot count, pitch and exact onset/duration, with no false
bar-underfill diagnostics, in structural tests and both browser shells.
The preexisting short-duration **export** fix in item 21 is a separate path.

## P1: draw long values with their own noteheads

An independently authored published-MNX `maxima`, `longa` or `breve` currently
draws `noteheadBlack` in layout; the same probe shows that 256th, 512th and
1024th flag glyphs are available. Import repair alone cannot make the long
values visibly correct. Choose SMuFL long-value glyphs or an equivalent
composed shape against the pinned source/reference; specify stems, dot
placement, spacing, selection and ledger behavior. Acceptance: authored-MNX
probes distinguish maxima, longa and breve from whole and from one another,
then original `03a` renders all three dotted variants in each applicable
shell. Keep unrelated noteheads and existing human-approved engravings
stable or register their changed golden batch for review.

## P1: keep cursor gaps invisible, including the trailing forward

`03b`'s partial `<backup>` gives correct note onsets but the importer fills
voice 2's empty first beat with a **printed quarter rest**. `03f`'s first two
`<forward>` intervals also become printed quarter rests; the third, after
the last note, disappears entirely. Thus its first source bar ends at 4/4
but imported MNX covers only 13/4 quarter beats. Neither fixture asks for
visible rest ink.

Represent unwritten time with published MNX fractional `space` items, not
`rest:{}`. Preserve leading, interior and trailing gaps; do not pad a voice
to a full bar where the original simply ends early. The isolated probe on
`03f` replaces its two rests with spaces and appends a 3/16-whole trailing
space: it retains all three noteheads, draws zero rest glyphs and clears the
first-bar underfill. Acceptance: exact source and MNX onsets, unchanged
voice membership, zero extra rests, complete source-specified forward span,
and original-file captures in both shells for `03b` and `03f`. Cover an
explicit MusicXML rest beside a forward gap so that a real rest remains ink.

## Scope and deduplication

- [Item 21](../complete/core-musicxml-short-durations.md) fixed exported
  divisions, not the source-to-MNX note-value mapping or long noteheads.
- [Item 22](../complete/core-musicxml-render-gaps.md) owns exact meter totals;
  `03d` shows those totals correctly with Show enabled.
- [Item 23](../complete/core-musicxml-write-gaps.md) owns untitled Studio
  version promotion; the seven source versions are now editable.
- [Item 25](core-musicxml-rest-fidelity.md) owns `03d`'s one-bar full-rest
  markers and noncanonical full-bar durations; it is extended with that
  evidence. This item does not reopen the rest proposal.
- The MusicXML 4.0 no-`divisions` compatibility case has a correct visible
  whole note, while music21's note-table reading disagrees about its
  duration. Preserve that unresolved oracle discrepancy in the assessment;
  do not prescribe a converter change from one indirect comparison.

Direct editor authoring and save/reopen for these IDs remain [write-path
assessment item 19](../inprogress/core-musicxml-write-assessment.md) work.
