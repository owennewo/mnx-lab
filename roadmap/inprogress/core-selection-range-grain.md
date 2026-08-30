# The range-grain ladder — rungs are range grains; coinciding objects are offered on them

> **Status: in progress — decisions 1–4 built and landed 2026-08-30** (three
> slices on `main`: d909a49 section rung retired + Ctrl+Shift+←/→ boundary
> extend; e100184 container rung retired, `containerCoincidence()` probe on
> `SessionView`, Del groups whole containers, container-run clip retired;
> f68181b staff off partMeasure identity, part-bars clip, ↑↓ walks parts).
> The ladder is now `note → event → voiceMeasure → partMeasure → measure →
> document`, all suites green at each landing. **Remaining: decision 5** —
> the three spanner add models, delete-from-any-reference, the reverse
> item→spanner index, and the coincidence rule generalized to slurs, beams
> and ottavas (the tray hint for partial coverage also still to surface).

Serves the **implementation loop**. Proposed 2026-08-30, out of a rung-by-rung review
of the selection ladder ([core-selection-ladder.md](../complete/core-selection-ladder.md)):
have we missed a rung, and have we introduced an artificial one? The answer became a
principle, and the principle became five decisions — four changes and one deliberate
non-change. They are one coherent move and land as one item.

## The principle

The ladder built by core-selection-ladder.md says *every rung is an object in the
document's containment chain*. This review sharpens that: **every rung is a range
grain** — note, event, voice-bar, part-bar, bar, document — **and an object whose
extent coincides with the selected range is offered on that range.** The chain's
containers stay rungs; everything the tree does not contain (labels that imply spans,
spanners that reference the chain) stops pretending to be a level and becomes an offer
on the range that matches it.

Two existing rules already pointed here:

- The ladder rejected a `voice` rung because voice continuity is *emergent by
  name-matching* — a label, not an object. Applied honestly, the same test removes
  `section` (decision 1).
- `wrapInContainer` is already an event-range verb: select events, make a tuplet. The
  coincidence rule is that gesture run backwards (decisions 2 and 5).

The resulting ladder: `note → event → voiceMeasure → partMeasure → measure → document`.
Every rung is a schema object; every removal's value is reabsorbed as a bar-level
gesture or a coincidence offer.

## Decision 1 — remove the `section` rung

A section is a `{label}` on a global measure; the *range* is emergent, derived by
walking to the next label (`sectionRangeAt`). It is the only rung whose member
(`{start, end}`) is a computed span rather than a schema object — the exact shape the
ladder's own voice argument excludes. It is also proposed-schema only, so today the
ladder changes shape per scenario (3 of 108 declare it).

Everything it offers moves to the bar rungs, where the data (the global measure)
actually lives:

| today at `section` | at the bar rungs |
|---|---|
| Ctrl+←/→ jump sections | already bound at voiceMeasure/partMeasure/measure |
| **Ctrl+Shift+←/→** | **new: extend to the section boundary** — the text editor's select-to-word-edge. → extends the active edge to the last bar of the current section (pressed again, through the next); ← to its first bar. From a section's first bar, one Ctrl+Shift+→ selects the whole section. No sections declared ⇒ boundary is the piece's ends (degrades to Shift+End). Same rule at all three bar rungs, each in its own members. |
| `section` label… tile | already scoped to `measure` too; becomes measure-only |
| `section-colour` tile | scope moves to `measure` (an attribute of the label on the bar) |
| `section-range` "Select section" | redundant: Ctrl+Shift+← then Ctrl+Shift+→ is the section, as a concrete measure range. Keep a tile only as a mouse path. Do **not** invent a `'section'` closure scope — that would reintroduce the rung under another name. |
| `delete-section-boundary` | bar-rung verb (`no section` already strips the label in the setup grammar) |
| ↑↓ | was unbound (no honest referent) — nothing to move |

Consequences: the `section` clip kind collapses into a measure-range clip; the digit
accelerator renumbers (see *Mechanics*); the Ctrl+A "select every section" closure is
the bar rung's timeline closure — the same set of bars, nothing lost.
**Spec-loop note**: [spec-score-text.md](low-priority/spec-score-text.md) cites the
section *rung* as evidence for the label field. The evidence is unchanged — editors
navigate and select by section — but it now comes from bar-level gestures; that doc
gets a sentence re-pointing it.

## Decision 2 — remove the `container` rung (the coincidence rule)

Unlike section, a tuplet/grace/tremolo **is** a schema object in the chain — the
removal rests on a different ground: **a container's identity is coextensive with a
range of its children.** There is nothing a container is beyond "these events, with a
ratio/slash/tremolo decoration", so the selection that means "this tuplet" is already
expressible at the event rung.

**The coincidence rule**: when an event range's members are exactly one container's
content, the tray offers that container's settings and its unwrap verb. Partial
coverage (two of a triplet's three events) offers nothing container-ish — but the tray
says *"part of a tuplet"* so the refusal reads as informative, not arbitrary. This
mirrors the existing construct direction (`wrapInContainer` on an event range), so the
two directions finally match: range → wrap; coinciding range → settings/unwrap.

Costs accepted: container-unit stepping (←/→ walked containers; Shift+→ extended by
container) goes — bare event navigation already steps into container children, since
grid positions carry the event they mean. Escape from an event inside a triplet lands
on voiceMeasure. Edge: a container whose sole child is another container — the range
coincides with both; offer the innermost (the outer is reached by widening once
outside).

## Decision 3 — voiceMeasure and partMeasure stay; the collapse is parked

The three bar-grain rungs (voice-bar, part-bar, bar) are the same grain at three
widths, and on a solo tab — one voice, one staff, one part — they select the same
music: three Escapes, three shapes, one thing. A document-level distinguishability
collapse was considered (fold voiceMeasure into partMeasure when no staff ever has two
sequences; fold partMeasure into measure in a single-part document; a folded rung's
tiles move to its absorber). **Decided: do nothing for now.** The selection type is
shown in the edit strip, so the user is told what rung they hold even when several
cover the same ink; the collapse may be revisited if hands-on use shows the extra
Escapes hurting. This section is the record for whoever reopens it.

The standing rule that *did* get confirmed: **a parent rung must be able to construct
its child**, because the child rung is absent until it exists. Satisfied by entry
materialization (typing a fret on an empty bar builds sequence → event → note in one
stroke) plus a construct tile where entry cannot reach (`new-voice` at partMeasure —
commandRegistry.ts already carries the reasoning — and the ghost bar of
[core-rung-insert.md](../complete/core-rung-insert.md)).

## Decision 4 — staff is not a thing: it comes off partMeasure's identity

MNX has no staff object. A staff is a *number* other things point at
(`sequence.staff`, `clef.staff`, `dynamic.staff`, per-note `note.staff` for
cross-staff) — an address the engraving uses, not a thing anyone composes with. In
SATB terms: the treble staff "has" Soprano and Alto only in the sense that each says
`staff: 1`; move Alto's low phrase to the bass staff for a bar and the *voice* changes
its number — the staff holds nothing. The workflows are "select Alto, bars 2–6"
(voiceMeasure range) and "select the whole choir's bars" (partMeasure range); there is
no task between them.

Today's implementation is staff-shaped where the name is part-shaped: the member is
`{partIndex, staffIndex, measureIndex}`, a plain selection takes only the cursor's
staff, ↑↓ walks staves before parts, and a rung showing one staff offers whole-part
verbs (tuning, capo, mute, transposition). Changes:

- **Member becomes `{partIndex, measureIndex}`** — all staves; the footprint and
  enclosure cover the part's staves as ONE panel. Precedent already in the code: the
  both view's notation+tab pair is deliberately one part-measure with one merged
  panel; a grand staff is the same situation (two renderings of one part) and gets the
  same treatment.
- **↑↓ at partMeasure walks parts.** Staff stays a *cursor* attribute — entry and
  lower-rung navigation still hop staves (Ctrl+↑↓ at the event rung), because the
  cursor must reach the bass staff to type there.
- The part-wide tiles are now honest where they sit. "Delete staff bar" becomes
  **delete part bar** (empties all staves' sequences for the bar); per-voice deletion
  already lives at voiceMeasure.
- The `wholePart` staff expansion in `partMeasureMembers` goes — members always cover
  the part.

Known trade, accepted with eyes open: a user clicking a bass-staff bar in other
engraving apps gets *that staff's* bar; here they get the part's bar and reach T-or-B
by tightening to the voice rung. Voices are the working unit, the part is the ensemble
unit; revisit when mouse selection arrives.

## Decision 5 — spanners and attachments: three add models, delete anywhere, coincidence generalized

The schema has three anchoring families, and only one matches the intuitive
"placed on the first item with an end ref":

| family | examples | lives | span known by |
|---|---|---|---|
| point attachment | markings (staccato…), fermata, lyrics | on its one item | no span |
| start-anchored spanner | slur (start event, `target` end-event id, `startNote`/`endNote` chord pins), tie (start note, `target` end note) | on the first item | end reference |
| bar-owned span | beam (`events: [id…]` member list), ottava (`position`→`end` time interval + staff/voice), dynamics (time-positioned point) | on the part-measure | members / time interval |

Point attachments have no addressing problem: select the event, toggle. For the
spanning families:

**Add — all three models supported:**
1. **On an item, end implied as next** — slur to the next event, tie to the next
   same-pitch note (derivable). The one-keystroke default.
2. **Press again at the end to extend** — a grow gesture: slur moves `target`, beam
   appends to `events`, ottava pushes `end`. Requires resolving "which spanner ends at
   the cursor" — the reverse index below.
3. **Range sets the extent** — select the events (or time range), add the attachment.
   The general form, and the same gesture as `wrapInContainer`.

**Delete — from any referenced position**: either endpoint (slur/tie), any member
event (beam), any position inside the time span (ottava). The reverse index makes
this free.

**The coincidence rule generalizes** (this is the relationship with containers): when
a range coincides with an existing spanner's span, the tray offers that spanner's
properties (slur side/line type/chord-member endpoints, beam breaks, ottava value) and
its delete — a container is just a spanner the schema promoted into the tree, and both
families now share the ONE mechanism. Overlapping matches (a slur and a beam over the
same four events; nested slurs) list side by side in the tray, which already renders
mixed-state tiles. The existing note→note / event→event press–navigate–press anchor
gesture survives as model 2's cousin for endpoints outside the selected scope.

## Mechanics

- **Ladder**: `SELECTION_LADDER` drops `section` and `container`; `SelectionMember`
  drops those kinds and `partMeasure.staffIndex`; `closureScopeForLevel` loses two
  arms. `presentLevels` keeps only genuine absence (empty bar, empty space).
- **Digit accelerator renumbers**: 1 note, 2 event, 3 voice, 4 part, 5 bar,
  6 document. `KEY_DOCS` rows for container/section rewrite as their range/coincidence
  meanings; Ctrl+Shift+←/→ is a new selection-group row at the bar rungs.
- **Clipboard**: the `section` and `container` clip kinds collapse into measure-range
  and event-range clips; cut/paste planners and clipboard-feedback wording follow.
- **Reverse index**: item → {spanners referencing it}, built beside the grid walk;
  needed by add-model 2, delete-anywhere, and the coincidence probe.
- **Enclosures**: the container shape retires; the part-measure panel spans all
  staves via the same barline join the both view already uses.
- **Footprint** (measured 2026-08-30): `'section'` appears ~111 times across 29
  files in `src/` + `harness/`, including eight test suites; `container` selection
  arms are of similar spread. This is a real, mechanical refactor, not a flag flip —
  traces that replay section/container intents need regenerating along the semantic
  change, the floor-axis precedent.
- **Tests to pin**: coincidence offer exact/partial/nested (innermost wins); the
  "part of a tuplet" hint; overlap listing (slur+beam same span); Ctrl+Shift+←/→ from
  first bar, mid-section, last section, and with no sections; partMeasure member
  covering all staves and ↑↓ walking parts; delete-part-bar across staves; digit
  renumbering refusals.

## Relations

- [core-selection-ladder.md](../complete/core-selection-ladder.md) — the ladder this
  refines; its object-rung principle becomes the range-grain principle.
- [core-selection-floor-axis.md](../complete/core-selection-floor-axis.md) — precedent
  for deleting a selection kind whose value didn't survive contact with a user, and
  for regenerating traces along a semantic change.
- [core-document-rung.md](../complete/core-document-rung.md) — the ladder stays
  one-dimensional; this doc keeps that promise while shrinking it.
- [core-rung-insert.md](../complete/core-rung-insert.md) — the parent-constructs-child
  rule this doc confirms as standing.
- [core-selection-tray-residue.md](core-selection-tray-residue.md) — tile scopes move
  (section pair to `measure`, container pair to the coincidence offer); its triage
  tables shrink by two rungs.
- [spec-score-text.md](low-priority/spec-score-text.md) — re-point the section-rung
  evidence at the bar-level gestures.
