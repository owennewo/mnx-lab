# MusicXML rest fidelity — grouped bars, positions and short values

> **Status: proposed, 2026-09-24.** MusicXML campaign item 25.
> Bounded gaps from [render assessment item 18](../inprogress/core-musicxml-render-assessment.md),
> evidenced in the [02a–02f rest review](../../docs/musicxml-rest-assessment.md)
> and [03-series rhythm review](../../docs/musicxml-rhythm-assessment.md).
> This proposal does not close the assessment or implement the fixes. Serves the
> implementation loop. [Campaign contract](../inprogress/core-campaign-musicxml.md).

## Agreement

1. **Oracle:** unchanged pinned MusicXML and descriptions, stable source-rest/range
   IDs, browser-imported MNX and complete Workbench/Studio notation captures.
   Compare each rest's written type, dot and placement, and each requested
   collapse range; successful import or nonempty SVG is insufficient.
2. **MNX verdict:** published MNX has rest `staffPosition`, note-value bases
   through 4096th and score `multimeasureRests` with `start`, `duration`,
   `label`. Preserve those before adding any vocabulary. MusicXML's
   `use-symbols=yes` has no published range-style carrier: require an explicit
   representation/spec-loop decision for full support. Do not hand-edit the
   pinned MNX schema or invent a vendor field during an importer fix.
3. **Dependencies:** no new runtime dependency or notation library. Use the
   existing importer and layout engine; optional oracle tools stay dev-only.
4. **Matrix:** converter changes regenerate the support matrix and independent
   semantic/XSD measurements. A screenshot alone never upgrades a matrix cell.
5. **Acceptance:** source → MNX structural regressions and original-file
   Workbench/Studio captures for every selected variant. Isolate renderer
   behavior with a minimal authored MNX probe where import previously erased
   the data. Regenerate primitives after model/engine changes and register any
   verification debt in [lab-verify](../inprogress/lab-verify.md); do not hand-write
   scenario verification records or expected goldens.

## P1: import representable multimeasure rest ranges

`02a` requests a 2-bar rest; `02c` requests 3, 15, 1, 12 and 3 bars;
`02d` requests 2, 3, 2 and 2 under changing meters. The current importer
emits one ordinary rest bar for every source measure, with no score-level
collapse ranges or warning. Both shells render every bar independently.
This is misleading for the 15-bar span and obscures the source's rest counts.

Map MusicXML `<multiple-rest>` start/count to published
`scores[].multimeasureRests` over stable measure IDs. Keep the underlying
measure durations so 4/4, 3/4 and 2/4 remain correct. Test all source starts,
endpoints and the one-bar case; reject or diagnose a range that exceeds its
part or crosses an incompatible boundary rather than silently guessing.
Acceptance: structural range equality for `02a`, `02c`, `02d`, and both-shell
captures with the requested bar counts, original-note order and unchanged
meter display. A minimal MNX probe confirms the renderer draws ranges
independently of MusicXML import.

The later `03d` source adds eight **one-bar** `<multiple-rest>1` cases under
changing meters. All markers disappear; 5/16, 9/8 and 31/8 full-bar rest
durations are approximated as quarter, whole and triple-dotted whole because
there is no matching single note value. This is the one-bar case above, with
an additional exact-duration requirement, rather than a separate proposal.
Choose a valid published-MNX representation for the complete bar (for
example, a score-level one-bar range plus a metric `space` fraction, if
layout and editing uphold that meaning). Acceptance also covers `03d`'s
eight source rest IDs: exact bar spans and one full-bar rest symbol in both
shells, including 5/16, 9/8 and 31/8, with no silent closest-value rounding.
Prove the representation in an authored-MNX probe before treating the
importer change as sufficient.

## P1: preserve explicit rest height across clefs

`02b` has E4, F5, A3, C6 and G4 rest placements. `02f` places 12 rests
from G4 through D4 in treble clef, including spaces. Every corresponding
imported `rest` is `{}`; the browser shows default-height glyphs instead.
MusicXML's [display step and octave](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/display-octave/)
set staff position under the current clef and do not give a rest musical
pitch. Map them to published `rest.staffPosition` with the same clef
coordinate convention as notes, respecting mid-score clef changes. Never
write a pitch onto a rest.

Acceptance: assert every explicit source placement against MNX staffPosition,
including C clef in `02b` and F→G change in `02f`; compare actual vertical
glyph coordinates in both original-file shells and a minimal MNX placement
probe. The first unpositioned `02b` rest must keep its default position.
If a requested coordinate cannot be represented, warn with its source
measure and note rather than silently dropping it.

## P1: retain 256th through 1024th rest values and dots

Each of `02a` and `02f` has two 11-rest ladders. In each ladder, the
256th, 512th and two 1024th values import as undotted 128ths; in the dotted
`02a` ladder, their dots also vanish. The actual source bars fit their
meters, but the enlarged MNX durations make both shells show false overfill
badges. Sixteen of the 44 ladder variants are wrong, and import warns on none.

Accept MusicXML values through 1024th using the published MNX duration enum
and preserve their dot counts. Verify exact rational measure sums before and
after import. Check the engine's existing rest-glyph mapping with an
independently authored MNX probe, then capture the original files through
both shells. Acceptance: all 44 variant values and dots match, repeated
128th glyphs and false overfill badges disappear, and normal legitimate
overfill diagnostics still work. Export and XSD/independent semantic checks
must not regress.

## P2: diagnose symbol-style loss pending a carrier decision

`02c`'s final 3-bar range requests `use-symbols=yes`: combinations of
1-, 2- and 4-bar rest symbols rather than one H-bar shape. Published
`multimeasureRests` has no style field. The importer currently drops both
the range and the style without warning. First preserve the range through
the P1 work, then issue a source-located diagnostic naming `use-symbols`
until a representation and notation policy is agreed. Full visual support
requires a separate carrier decision with a source-to-render regression;
do not equate a numbered H-bar with the requested symbol style.

## Scope and deduplication

Completed [item 22](../complete/core-musicxml-render-gaps.md) owns exact meter
totals and compatible common/cut display; `02d` confirms those are visible.
Completed [item 23](../complete/core-musicxml-write-gaps.md) owns untitled
Studio version promotion; the reviewed sources are now reachable. [Item
24](core-musicxml-accidental-fidelity.md) owns accidental glyphs and its
measured GP-storage losses. [Item 26](core-musicxml-rhythm-fidelity.md)
owns short and long **note** values and invisible cursor gaps. This item
owns only the rest-family render findings. Direct rest authoring, undo/redo
and save/reopen remain [write
assessment item 19](../inprogress/core-musicxml-write-assessment.md) work;
none is inferred from this rendering review.

The later [22d notehead assessment](../../docs/musicxml-notehead-assessment.md)
adds an E4-positioned quarter rest that imports as an unpositioned `rest: {}`
and prints at the same height as the preceding unpositioned quarter rest.
This is another source witness for the existing `rest.staffPosition`
acceptance case, not a separate notehead-height task. Its parentheses
belong to [item 30](core-musicxml-notehead-fidelity.md).
