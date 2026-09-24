# MusicXML accidental fidelity — explicit ink, named glyphs and saved edits

> **Status: proposed, 2026-09-24.** Campaign item 24 in
> [core-campaign-musicxml](../inprogress/core-campaign-musicxml.md). Bounded gaps
> from [render assessment item 18](../inprogress/core-musicxml-render-assessment.md)
> and [write assessment item 19](../inprogress/core-musicxml-write-assessment.md).
> [01a–01h evidence](../../docs/musicxml-pitch-assessment.md). This proposal does
> not close either assessment or implement these fixes. Serves the implementation loop.

## Agreement

1. **Oracle:** original pinned MusicXML and its manifest, 257 source-note records,
   current Workbench/Studio screenshots and real editor traces. Match musical pitch
   separately from the explicitly requested accidental ink.
2. **MNX verdict:** use published `accidentalDisplay.enclosure` for explicit
   parentheses/brackets. Its current shape has no named microtonal/arrow/Turkish
   accidental glyph; choose a spec-loop or `_x.mnxLab` carrier deliberately before
   full support. Never edit the pinned published schema.
3. **Dependencies:** no new runtime notation dependency. Extend the existing
   importer, shared layout and single `bindEditor` surface.
4. **Matrix:** converter and independent oracles change only after semantic
   regressions; a screenshot alone is no support upgrade. Preserve all original
   descriptions and variant IDs in the assessment inventory.
5. **Acceptance:** source → imported data → actual shell rendering, direct
   create/inspect/change/remove with structural preservation and exact history,
   and each applicable save/reopen route. Renderer changes re-earn goldens and
   register any verification debt in [lab-verify](../inprogress/lab-verify.md).
   Never hand-write a scenario verification record.

## P1: carry and draw explicit accidental enclosures

`01e` supplies 16 ordinary accidentals with distinct qualification attributes.
Its six explicit parenthesis/bracket variants (`m03/n02–04`, `m04/n02–04`) all
import as plain `{show:true}`. The importer checks accidental **text** for the
word `parentheses` and ignores its `parentheses`/`bracket` attributes. Published
MNX already has `accidentalDisplay.enclosure.symbol`. A real note-inspector
command on `01e/m01/n01` writes `parentheses` into valid MNX in both shells,
but the visible flat stays unenclosed. These are separate importer and engine
gaps, independent of microtonal pitch representation.

Preserve explicit yes/no enclosure intent where the published carrier can do
so, and draw a legible parenthesis or bracket at the original note. For a
source that asks for both bracket and parenthesis, or only sets
`cautionary`/`editorial` with no explicit enclosure, agree on a documented
priority/default policy first. MusicXML [leaves an absent bracket/parentheses
attribute to application defaults](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/accidental/);
the current source alone does not justify guessing a glyph. If semantic
editorial/cautionary identity must survive beyond its visual enclosure, name
the needed carrier rather than silently merging those source flags.

Acceptance: assert imported MNX and source attributes for all 16 variants;
render the six explicit cases correctly in both original-file browser shells;
assert that an independently authored MNX parenthesis/bracket draws even
without MusicXML import. Add a structural regression for the existing
`pitches/01-parenthesized-accidental` scenario without hand-changing its
golden or verification fields. Verify collision/spacing around doubles and
the selected note marker.

## P1: stop silently replacing named accidental glyphs with naturals

`01g` names 12 arrow accidentals and `01h` names 14 Turkish/Persian
accidentals; every source `<pitch>` is G4 with no `<alter>`. The importer
keeps the pitch but collapses all 26 names to `accidentalDisplay.show:true`;
both shells show an ordinary natural on every note and issue **zero** glyph-loss
warnings. `01f` also loses quarter/three-quarter glyph names; its 12
fractional pitches are already diagnosed under completed item 22.

First acceptance is containment: warn at each lost glyph's part, measure and
note, naming the exact MusicXML accidental value, and never present a generic
natural as if it were the source's chosen symbol. The UI must expose the
diagnostic without blanking the remaining score. A full implementation needs
a representation decision for exact named glyphs and their relationship to
pitch; the [MusicXML value list](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/accidental-value/)
shows why a pitch integer cannot stand in for the written symbol. That
decision is a spec-loop dependency, not an importer shortcut. Once agreed,
test all 26 named variants and the `01f` glyphs against original-file
Workbench/Studio captures and exported MusicXML.

Do not reopen item 22's already completed fractional-pitch diagnostic as a
new task. Full fractional pitch, playback and export remain its stated
carrier-dependent deferral. The newly identified failure here is the silent
**named glyph** collapse, including the glyph-only sources with no pitch
alteration.

## P2: make qualified accidental editing explicit and inspectable

The shared note inspector currently accepts `accidental show`, `accidental
parens` and `no accidental`. `01e`'s first-note probe proves those commands
through both shells with exact undo/redo and unrelated-data preservation.
There is no proved direct command for brackets, editorial meaning, combined
qualification or an explicit `parentheses=no` choice. The imported inspector
reports only `show` where the source had a qualification.

After the carrier/default policy above, add clearly named note-level choices
through the existing inspector, with current-value feedback that distinguishes
the cases. Acceptance: create, inspect, change and remove each representable
`01e` variant on a selected note without altering pitch or neighbouring notes;
exact undo/redo; Workbench JSON-copy/MNX reopen; the Studio route below.
Use the single shared editor binding and desktop selection model. Do not count
raw JSON edits or unbound edit operations as a user-facing control.

## P1 persistence prerequisite: an editable result must survive Studio storage

`01a`'s **15 of 108** lost notes were already measured in item 23; that item
did not repair GP storage. The new `01e` probe keeps all **16** notes but
loses all **16** `accidentalDisplay` values when Studio saves its editable
MusicXML version to canonical GP, including a newly authored parenthesis.
The loss is reported by the existing storage check. Library MNX, MusicXML and
GP7 exports all read that saved canonical GP, so each download reopens
without the accidental display data. The untouched XML original remains
available in Versions; it is not an edit checkpoint.

Choose and document a lossless canonical/checkpoint path for these data, or
explicitly refuse a destructive checkpoint while retaining the editable
state. Merely showing the already available loss list is not preservation.
Acceptance for `01e`: make the parenthesized edit in the real Studio editor,
save/reload, then export/reopen MNX, MusicXML and GP7 through their actual
Library controls. The parenthesis and all unrelated notes must survive any
route advertised as preserving the edit; routes whose format cannot carry it
must state that limitation before the user relies on them. Repeat `01a`'s
108-note count as a separate high-register regression. Keep the original
rendition byte-identical and the library title workflow intact.

## Explicit limits and ownership

- Completed [item 22](../complete/core-musicxml-render-gaps.md) owns the eight
  `01d` and twelve `01f` fractional-pitch warnings and their representation
  deferral. This proposal adds no integer-to-fraction schema hack.
- Completed [item 23](../complete/core-musicxml-write-gaps.md) owns the
  formerly blocked Studio title promotion. It already exposes the `01a` GP
  loss; this proposal makes preservation an acceptance target.
- Default cautionary/editorial enclosure style remains unresolved until the
  policy is chosen. Other pitch-register authoring variants and the other
  suite fixtures are still assessment work, not asserted gaps here. The later
  [21h chord render assessment](../../docs/musicxml-chord-assessment.md)
  confirms the same loss on a three-note chord: ordinary accidental ink and
  pitches survive, but cautionary/editorial flags vanish from imported MNX
  with no explicit source enclosure. This adds evidence to the existing
  policy/carrier task, not a separate chord proposal.
