# The selection tray — the triage ledger

> **Status: repurposed 2026-08-24.** This doc was *the residue* — the ledger of tray
> tiles that could not be wired yet, each row naming its unblocker. That job is
> essentially done: [the campaign's](../complete/core-campaign-element-ops.md) vocabulary
> sweep and the two waves after it retired some twenty rows (their retirement notes live in
> this file's history and in the campaign's learnings log), and **seven blocked
> placements remain**, demoted to the appendix at the foot of this doc so every `blockedBy` id in
> [src/edit/commandRegistry.ts](../../src/edit/commandRegistry.ts) still resolves to an
> address. The interesting question is no longer *what is missing*. It is whether the
> tiles that are **already there** are right — and nobody has checked.
>
> The filename does not change, because a dozen completed docs point at "the residue
> ledger" as a thing that happened; the appendix keeps those links landing on something
> true. Third of the trio behind
> [core-selection-tray-visuals.md](../complete/core-selection-tray-visuals.md) and
> [core-selection-tray-mechanism.md](../complete/core-selection-tray-mechanism.md).

## The claim

The registry has **82 rows across 94 placements** — one command in one rung's tab is one
placement — and the only assertion anyone has ever made about them is mechanical: the
conformance suite proves each tile fires *an intent through the funnel*, that no tile is
actionless without a blocker, and that no wired tile carries a stale one. Nothing
asserts that a tile does **what its label promises**, and nothing at all has been said
about the order they appear in. The tray's content is a pure function of the registry
array, so today's grouping is *the order somebody typed the rows in* — which is why the
bar rung interleaves `repeat-start`, `repeat-end`, `final-barline`, `segno`, `coda`,
then `ending` and `rehearsal` and `tempo`, when the repeat family is plainly one thing.

That is the same shape of gap the corpus already has a vocabulary for: `valid` is a
machine verdict, `verified` is a **human** one, and the queue distinguishes *never seen*
from *stale*. A tray tile has no such distinction. Every one of them is `valid` and
none of them is `verified`.

## The three axes

Each placement carries three independent marks. They are deliberately small enough that
a reviewer can settle one in seconds at the tray itself:

- **tested** — clicking it does the correct thing. Not "an intent fired" (the harness
  owns that) but "the document changed the way the label promised, at this rung, on a
  selection of more than one member, and undo put it back". A human verdict.
- **grouped** — it sits in a named group with its relatives. The bar rung's repeat
  family — repeat start, repeat end, volta, segno, jump — is one group; key/time/clef is
  another; delete is its own. A group is a claim about *meaning*, not about glyph
  shape.
- **ordered** — within its group it sits at the right index. There is usually a natural
  order (repeat **start** before repeat **end**; shorter before longer before dots) and
  it is not the order the rows were typed in.

**Ordered depends on grouped** — an index inside a group nobody has drawn is not a
statement about anything — so the honest sequence per rung is group, then order, then
test each tile once the layout it will ship in has stopped moving. Testing first is
allowed and wastes nothing; a tile's behaviour does not change when it moves.

## Purple

A placement with **none of the three marks renders purple** — a fourth tile state
beside `available`, `active`, `mixed` and `unavailable`
([SelectionTray.ts:55](../../src/workbench/SelectionTray.ts#L55)). Purple says *nobody
has vouched for this tile yet*; it is the tray's own never-seen colour, and it is
supposed to be embarrassing while it is everywhere.

Decisions this needs, recorded rather than assumed:

1. **One purple, not three.** A tile leaves purple only when all three marks are set;
   which axis is outstanding is the *ledger's* business, not the tray's. The
   alternative — three ticks in the tile corner — turns every tile into a progress
   widget and makes the tray about its own construction. Rejected on those grounds, and
   cheap to reverse.
2. **Purple never overrides `unavailable`.** A blocked tile is already greyed and its
   verb does not exist; asking a reviewer to test it is asking nonsense. The appendix's
   seven placements are out of scope until they wire, and they enter triage purple on
   the day they do.
3. **The mark lives in the registry, next to `blockedBy`.** A `triage` field on
   `EditorCommand`, keyed per scope for the twelve rows that appear at more than one
   rung. One source, above the shell boundary so the harness can read it, and a
   conformance test can then hold the ledger and the tiles together the way
   [command-registry.test.ts:184](../../harness/conformance/command-registry.test.ts#L184)
   already holds the blockers. A side-table of JSON would drift on the first rename.
4. **A `tested` mark is per placement, not per command.** `slur` at the note rung arms
   an anchor; at the event rung it reads a resolved range. `section` at the bar rung and
   at the section rung are different verbs wearing one label. Twelve rows are in this
   position and each rung must be clicked on its own.
5. **The colour is a token.** `light-dark()` through the modernist palette, inherited
   from `<mnx-workbench>`'s host. The tray declares **no** `designTokens` block of its
   own and carries no colour literals — a conformance assertion holds that line in both
   directions, and a purple hex would be the first thing to break it.

**Open:** does purple ship? A visitor to a published score should probably not be shown
our QA state, which argues for gating it to the workbench shell (or a dev flag) rather
than putting it in `elements/`. Left undecided here because the tray does not reach the
embed or studio yet — see the appendix's promotion row — and the answer is free until it
does.

## The ledger

87 placements to triage, plus 7 blocked in the appendix. Every box below is empty on
purpose: this is the state of the tray on 2026-08-24, and it is the whole point of the
doc that not one of them has been ticked yet. Rung order is the ladder's own, and row
order within a rung is **today's display order** — so a rung whose `ordered` column
fills in without the rows moving is a rung that was already right.

### note — 19 placements

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `tie` — Tie to the next note | `T` | ☐ | ☐ | ☐ |
| `slur` — Slur — press again at the last note *(notation)* | `S` | ☐ | ☐ | ☐ |
| `beam` — Beam — press again at the last event *(notation)* | `B` | ☐ | ☐ | ☐ |
| `accidental-display` — Force the accidental | `Shift+A` | ☐ | ☐ | ☐ |
| `respell` — Respell enharmonically (cycles) | `J` | ☐ | ☐ | ☐ |
| `staccato` — Staccato | `Shift+A` | ☐ | ☐ | ☐ |
| `accent` — Accent | `Shift+A` | ☐ | ☐ | ☐ |
| `tenuto` — Tenuto | `Shift+A` | ☐ | ☐ | ☐ |
| `strong-accent` — Marcato | `Shift+A` | ☐ | ☐ | ☐ |
| `staccatissimo` — Staccatissimo | `Shift+A` | ☐ | ☐ | ☐ |
| `breath` — Breath mark | `Shift+A` | ☐ | ☐ | ☐ |
| `bend` — Bend *(tab)* | `B` | ☐ | ☐ | ☐ |
| `slide` — Slide *(tab)* | `S` | ☐ | ☐ | ☐ |
| `hammer-pull` — Hammer-on / pull-off *(tab)* | `H` | ☐ | ☐ | ☐ |
| `vibrato` — Vibrato *(tab)* | `V` | ☐ | ☐ | ☐ |
| `palm-mute` — Palm mute *(tab)* | `X` | ☐ | ☐ | ☐ |
| `harmonic` — Natural harmonic *(tab)* | `O` | ☐ | ☐ | ☐ |
| `fingering` — Fingering | `Shift+A` | ☐ | ☐ | ☐ |
| `lyric` — Lyric syllable… | `Shift+L` | ☐ | ☐ | ☐ |

### event — 24 placements (+1 blocked, appendix)

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `slur` — Slur — press again at the last note *(notation)* | `S` | ☐ | ☐ | ☐ |
| `beam` — Beam — press again at the last event *(notation)* | `B` | ☐ | ☐ | ☐ |
| `staccato` — Staccato | `Shift+A` | ☐ | ☐ | ☐ |
| `accent` — Accent | `Shift+A` | ☐ | ☐ | ☐ |
| `tenuto` — Tenuto | `Shift+A` | ☐ | ☐ | ☐ |
| `strong-accent` — Marcato | `Shift+A` | ☐ | ☐ | ☐ |
| `staccatissimo` — Staccatissimo | `Shift+A` | ☐ | ☐ | ☐ |
| `breath` — Breath mark | `Shift+A` | ☐ | ☐ | ☐ |
| `shorter` — Shorter duration | `−` | ☐ | ☐ | ☐ |
| `longer` — Longer duration | `=` | ☐ | ☐ | ☐ |
| `dots` — Dot the value (cycles 0 → 1 → 2 → none) | `.` | ☐ | ☐ | ☐ |
| `tuplet` — Triplet | `Shift+R` | ☐ | ☐ | ☐ |
| `grace` — Grace note | `Shift+R` | ☐ | ☐ | ☐ |
| `tremolo` — Tremolo | `Shift+R` | ☐ | ☐ | ☐ |
| `piano` — Piano | `Shift+A` | ☐ | ☐ | ☐ |
| `mezzo-forte` — Mezzo-forte | `Shift+A` | ☐ | ☐ | ☐ |
| `forte` — Forte | `Shift+A` | ☐ | ☐ | ☐ |
| `crescendo` — Crescendo | `Shift+A` | ☐ | ☐ | ☐ |
| `diminuendo` — Diminuendo | `Shift+A` | ☐ | ☐ | ☐ |
| `ottava` — Ottava alta | `Shift+A` | ☐ | ☐ | ☐ |
| `direction` — Direction text… | `Shift+A` | ☐ | ☐ | ☐ |
| `lyric` — Lyric syllable… | `Shift+L` | ☐ | ☐ | ☐ |
| `fermata` — Fermata | `Shift+A` | ☐ | ☐ | ☐ |
| `arpeggio` — Arpeggio | — | ⛔ blocked — `arpeggio` | | |
| `clear-event` — Clear to an equal-duration rest | `Del` | ☐ | ☐ | ☐ |

### container — 1 placement (+1 blocked, appendix)

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `container-settings` — Container settings… | — | ⛔ blocked — `container-properties` | | |
| `delete-container` — Delete this container (only when empty) | `Del` | ☐ | ☐ | ☐ |

### voice bar — 6 placements

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `full-measure-rest` — Full-measure rest | `Shift+B` | ☐ | ☐ | ☐ |
| `rest-spelling` — Respell the rests… | `Shift+R` | ☐ | ☐ | ☐ |
| `space` — Insert space… | `Shift+R` | ☐ | ☐ | ☐ |
| `cycle-voice` — Step to the next voice at this beat | `Alt+V` | ☐ | ☐ | ☐ |
| `new-voice` — Add a voice to this bar | — | ☐ | ☐ | ☐ |
| `delete-voice-bar` — Delete this voice bar (only when empty) | `Del` | ☐ | ☐ | ☐ |

### staff bar — 5 placements (+2 blocked, appendix)

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `clef` — Clef… | `Shift+C` | ☐ | ☐ | ☐ |
| `tuning` — Tuning… | `Shift+U` | ☐ | ☐ | ☐ |
| `capo` — Capo… | `Shift+P` | ☐ | ☐ | ☐ |
| `part-scope` — Select the whole part | `Ctrl+A` | ☐ | ☐ | ☐ |
| `transpose-part` — Instrument transposition | — | ⛔ blocked — `part-transposition` | | |
| `mute-part` — Mute the part | — | ⛔ blocked — `mute` | | |
| `delete-part-bar` — Delete this staff bar (only when empty) | `Del` | ☐ | ☐ | ☐ |

### bar — 15 placements

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `clef` — Clef… | `Shift+C` | ☐ | ☐ | ☐ |
| `key-signature` — Key signature… | `Shift+K` | ☐ | ☐ | ☐ |
| `time-signature` — Time signature… | `Shift+T` | ☐ | ☐ | ☐ |
| `repeat-start` — Repeat start | `Shift+B` | ☐ | ☐ | ☐ |
| `repeat-end` — Repeat end | `Shift+B` | ☐ | ☐ | ☐ |
| `final-barline` — Final barline | `Shift+B` | ☐ | ☐ | ☐ |
| `segno` — Segno | `Shift+B` | ☐ | ☐ | ☐ |
| `coda` — Jump (D.S. al fine) | `Shift+B` | ☐ | ☐ | ☐ |
| `ending` — Volta ending… | `Shift+B` | ☐ | ☐ | ☐ |
| `rehearsal` — Rehearsal mark… | `Shift+B` | ☐ | ☐ | ☐ |
| `tempo` — Tempo… | `Shift+B` | ☐ | ☐ | ☐ |
| `measure-repeat` — Measure repeat… | `Shift+B` | ☐ | ☐ | ☐ |
| `delete-bar` — Delete this bar (only when empty) | `Del` | ☐ | ☐ | ☐ |
| `section` — Section label… | `Shift+B` | ☐ | ☐ | ☐ |
| `add-bar` — Append a bar | `Shift+M` | ☐ | ☐ | ☐ |

### section — 3 placements (+1 blocked, appendix)

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `section` — Section label… | `Shift+B` | ☐ | ☐ | ☐ |
| `section-colour` — Section colour | — | ⛔ blocked — `section-colour` | | |
| `section-range` — Select the section’s range | — | ☐ | ☐ | ☐ |
| `delete-section-boundary` — Delete this section boundary | `Del` | ☐ | ☐ | ☐ |

### document — 5 placements (+2 blocked, appendix)

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `add-part` — Add a part… | `Shift+P` | ☐ | ☐ | ☐ |
| `staff-kind` — Staff kind: notation + tab | `Shift+P` | ☐ | ☐ | ☐ |
| `add-bar` — Append a bar | `Shift+M` | ☐ | ☐ | ☐ |
| `part-name` — Part name… | `Shift+P` | ☐ | ☐ | ☐ |
| `staves` — Staves per part… | `Shift+P` | ☐ | ☐ | ☐ |
| `system-break` — System break | — | ⛔ blocked — `layout-authoring` | | |
| `multimeasure-rest` — Multimeasure rest | — | ⛔ blocked — `layout-authoring` | | |

### session (the `global` tab) — 9 placements

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `undo` — Undo | `Ctrl+Z/Y` | ☐ | ☐ | ☐ |
| `redo` — Redo | `Ctrl+Z/Y` | ☐ | ☐ | ☐ |
| `doc-add-bar` — Append a bar | `Shift+M` | ☐ | ☐ | ☐ |
| `doc-add-part` — Add a part… | `Shift+P` | ☐ | ☐ | ☐ |
| `doc-time` — Time signature… | `Shift+T` | ☐ | ☐ | ☐ |
| `doc-tuning` — Tuning… | `Shift+U` | ☐ | ☐ | ☐ |
| `staff-kind-both` — Staff kind — notation + tab | — | ☐ | ☐ | ☐ |
| `staff-kind-tab` — Staff kind — tab only | — | ☐ | ☐ | ☐ |
| `staff-kind-notation` — Staff kind — notation only | — | ☐ | ☐ | ☐ |

## Retirement

A row is done when all three boxes are ticked and the tile is not purple in the running
workbench. A **rung** is done when its table is; that is the unit worth celebrating,
because a rung is what a user actually looks at. The doc moves to `complete/` when all
nine tables are ticked **and** the appendix is empty — a blocked tile that wires becomes
a purple tile with three empty boxes, so the two halves cannot be closed independently.

Ticking a box is an assertion, so it follows the repo's rule for those: the reviewer who
clicked the tile ticks it, in the same commit as any fix the click provoked. **A change
to a command's `action` un-ticks its `tested` box** — the same demotion the goldens get
when their output moves, done by hand here because there is nothing to hash.

## What this doc is not

- **Not a redesign of the tray.** Visuals are settled
  ([core-selection-tray-visuals.md](../complete/core-selection-tray-visuals.md)); this
  moves tiles within the frame that doc drew and adds one state to the four it defined.
- **Not a backlog of new commands.** Anything the tray does not offer at all belongs to
  the campaign's "beyond" list or the appendix, not to a triage row.
- **Not a substitute for the conformance suite.** The suite proves the wiring; `tested`
  is a human verdict about behaviour, and the two are complementary in exactly the way
  `valid` and `verified` are for a scenario.
- **Not a grouping proposal.** The `grouped` and `ordered` columns are deliberately
  empty rather than pre-filled with a draft: a group is a claim about what belongs with
  what, and it is worth more argued once at the tray than guessed here.

## Appendix — the residue

What is left of this doc's first purpose: seven placements that draw unavailable, each
`blockedBy` id as it appears in the registry. They are excluded from triage until they
wire.

| `blockedBy` | Tile(s) | Rung | Unblocked when |
|---|---|---|---|
| `arpeggio` | `arpeggio` | event | **no address recorded** — the tile was greyed without an owner, and the ledger never caught it because the conformance test asserts a blocker *exists*, not that it resolves. Either find its verb an owner on the campaign's "beyond" list or cut the tile |
| `container-properties` | `container-settings` | container | a `setContainerProperties`-class op plus a rhythm-popover edit mode; the existing grammar constructs a wrapper but cannot rewrite one in place |
| `part-transposition` | `transpose-part` | staff bar | not a campaign item — needs its own proposal from the campaign's "beyond" list |
| `mute` | `mute-part` | staff bar | audio's own decision: there is no player element at all ([core-viewer-embedded-app.md](../complete/core-viewer-embedded-app.md) records why), so the row renders value-less until there is |
| `section-colour` | `section-colour` | section | **no address recorded** — same hole as `arpeggio`; decide whether section colour is a document property or a viewer preference before giving it a verb |
| `layout-authoring` | `system-break`, `multimeasure-rest` | document | removal already landed; construction needs a surface that can express a **tree**, which the popover grammar cannot and the palette cannot (it does not see the document). The tray *can* see the document, so it is a candidate surface — recorded, not claimed |

Three surface gaps outlive the tiles and are not triage rows either: the dashed
on-score preview of a scope **wider** than the enclosure can draw; the promoted
score-rung `score-navigate` event; and the tray in the **embed / studio**, which waits
on [core-editor-element-promotion.md](core-editor-element-promotion.md) and its
deliberately parked trigger.

✔ when: every placement carries all three marks, no tile renders purple, and the
appendix is empty.
