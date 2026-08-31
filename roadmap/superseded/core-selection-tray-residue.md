# The selection tray — the triage ledger

> **SUPERSEDED 2026-08-31 by the one-surface campaign's item 11b**
> ([workbench-one-surface-tray-verbs.md](../complete/workbench-one-surface-tray-verbs.md)):
> the tray this ledger triaged is gone — attributes into the inspector (11a),
> verbs to their rung-generic keys, the shell demolished. The tables below are
> the historical record of the placements. The three obligations that outlive
> the surface are **op-gaps, not tray rows** — `part-transposition`, `mute`,
> `section-colour` — named in the campaign's closing entry and in 11b's doc.

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
> **The purple half is built (2026-08-24).** The marks are a `triage` field on the
> registry row, the tray draws an untriaged tile in `--tile-untriaged`, and the
> conformance suite keeps the field well formed. Since the ledger below is empty,
> **every tile in the tray is purple** — which is the honest picture and the point.
> What remains is the ticking, and that is human work: see *Retirement*.
>
> **The tile cursor follows the scroll (2026-08-25).** The tray's tile cursor is
> VIRTUAL — an index and a class, never DOM focus, because the search box keeps
> focus so typing works while the grid is being walked. The browser scrolls what
> it focuses, so a virtual cursor gets none of that for free, and ↓ past the fold
> left the cursor on a tile nobody could see. Latent until the tray was bounded,
> because before that there was no fold to fall past. Scrolled by hand rather
> than with `scrollIntoView({ block: 'nearest' })`: that scrolls ancestors too —
> the tray floats over a score that must not move under it — and it knows
> nothing about the sticky captions, which would swallow a tile parked at
> `scrollTop`.
>
> **The tray is bounded and dismisses itself (2026-08-25).** Banding made a
> latent bug visible: the tray had **no height limit at all**, so it simply grew
> with its content — the note rung's six captioned bands ran 699px tall in a
> 520px window and the first band left the screen. It now measures the room on
> the side it settled on, caps itself to it, and scrolls the TILES only (the
> meta line, the ladder and the search row stay put, and a band caption sticks
> while its own tiles pass under it). The flip test changed with it: it used to
> ask whether the other side could hold the tray WHOLE, so a tray too tall for
> both stayed below and overflowed; it now takes whichever side has more room.
> And firing a tile closes the tray — two of the three fire paths already did,
> the popover one because "both want the same keystrokes", and the intent path
> was simply never given the line. Both are asserted in `smoke:selection`,
> because a layout bug needs a browser to see it.
>
> **Every rung is banded (2026-08-25)**, each leading with a `structure` band — insert
> before, insert after, delete — so a rung's structural verbs are drawn together and drawn
> first instead of scattered among its properties (three among thirteen at the bar rung,
> which is how the tray came to hide the one voice verb that could still be reached).
> Banding them surfaced **four verbs with keys and no tile at all** — `insert-event-before`
> / `insert-event-after` at the note and event rungs, `delete-note`, and `delete-part` —
> now added, which is why the placement counts below moved. The per-rung tables were
> **regenerated from the registry** on the same day; the marks stay unticked, because a
> band being built is not a band being vouched for.
>
> **The note rung is grouped and ordered (2026-08-24)**, in `COMMAND_GROUPS` beside the
> registry: five captioned bands — spelling, joins, articulation, fingerboard, text — with
> the search line lifted **above** the tiles so the panel reads in palette order, the first
> tile armed from the moment it opens, and ↓/↑ carrying the keys between the query and the
> grid. The marks stay **unticked**: a design review settles what belongs with what, and
> ticking is still the reviewer's to do at the tray.
>
> The filename does not change, because a dozen completed docs point at "the residue
> ledger" as a thing that happened; the appendix keeps those links landing on something
> true. Third of the trio behind
> [core-selection-tray-visuals.md](../complete/core-selection-tray-visuals.md) and
> [core-selection-tray-mechanism.md](../complete/core-selection-tray-mechanism.md).


> **2026-08-31 — 11a note:** the one-surface campaign retired every attribute
> tile ([workbench-one-surface-tray-attrs.md](../complete/workbench-one-surface-tray-attrs.md)),
> so the triage tables below now list many placements that no longer exist.
> The ledger's settlement — tick, trim, or retire — is item 11b's, per the
> campaign's split.

## The claim

The registry has **85 rows across 96 placements** — one command in one rung's tab is one
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

## Purple — built 2026-08-24

A placement with **none of the three marks draws purple**, and today that is every one
of them. It is not a fifth `TrayTileState` but a flag **orthogonal** to state
([SelectionTray.ts](../../src/workbench/SelectionTray.ts)): a tile can be untriaged
*and* already `active`, and folding the two into one enum would make "this marking is
on" and "nobody has checked this tile" compete for a slot only one of them can win.
Purple is the tray's own never-seen colour, and it is supposed to be embarrassing while
it is everywhere.

The six decisions, as built:

1. **One purple, not three.** A tile leaves purple only when all three marks are set;
   which axis is outstanding is the *ledger's* business, not the tray's. The
   alternative — three ticks in the tile corner — turns every tile into a progress
   widget and makes the tray about its own construction. Rejected on those grounds, and
   cheap to reverse.
2. **Purple never overrides `unavailable`, and the rule is enforced upstream of the
   CSS.** `isTriaged` returns *true* for a command with no `action`, so a blocked tile
   never carries the flag at all and the stylesheet never has to arbitrate. A blocked
   verb does not exist; asking a reviewer to click it is asking nonsense. The appendix's
   seven placements enter triage purple on the day they wire.
3. **The mark lives in the registry, next to `blockedBy`** — a `triage` field on
   `EditorCommand`, `Partial<Record<CommandScope, TriageMark[]>>`. One source, above the
   shell boundary so the harness can read it, and
   [command-registry.test.ts](../../harness/conformance/command-registry.test.ts) now
   holds it honest: marks only for scopes the command offers, no mark outside the three,
   no `ordered` without `grouped`, and nothing claimed for a blocked tile. A side-table
   of JSON would have drifted on the first rename.
4. **A `tested` mark is per placement, not per command.** `slur` at the note rung arms
   an anchor; at the event rung it reads a resolved range. `section` at the bar rung and
   at the section rung are different verbs wearing one label. Twelve rows are in this
   position and each rung must be clicked on its own.
5. **The colour is a token** — `--tile-untriaged`, `light-dark()`, declared on the app
   host in `designTokens` beside the queue's ramp and inherited by the tray. The tray
   declares **no** `designTokens` block of its own and carries no colour literals; a
   conformance assertion holds that line in both directions, and a purple hex would have
   been the first thing to break it. It is the one place the system spends a second hue,
   because this separates *shipped* from *nobody has looked*, which is a different kind
   of claim from the four the queue's ramp separates — and it retires with the last row.
6. **Two cascade exceptions, both to protect information the reader needs.** An `active`
   tile keeps its inverted glyph (purple ink on the accent fill is unreadable; the
   border still carries the mark), and hover and the keyboard cursor keep the accent
   border — with every tile purple, a purple border under the cursor would leave the
   grid with no visible cursor at all.

The five **session-chrome** tiles (copy/paste/cut, trace, revert) have no registry row
to declare a mark on, so they are purple unconditionally.

**Open:** does purple ship? A visitor to a published score should probably not be shown
our QA state, which argues for keeping it in the workbench shell (where it is today)
rather than following the tray into `elements/`. Free to leave undecided while the tray
does not reach the embed or studio — see the appendix's promotion row.

## The ledger

89 placements to triage, 7 blocked in the appendix, and five session-chrome tiles with
no registry row at all. Every box below is empty on purpose: this is the state of the tray on 2026-08-24, and it is the whole point of the
doc that not one of them has been ticked yet. Rung order is the ladder's own, and row
order within a rung is **today's display order** — so a rung whose `ordered` column
fills in without the rows moving is a rung that was already right.

### note — 22 placements

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `insert-event-before` — Insert an event before this one | `Shift+I` | ☐ | ☐ | ☐ |
| `insert-event-after` — Insert an event after this one | `I` | ☐ | ☐ | ☐ |
| `delete-note` — Delete this note | `Del` | ☐ | ☐ | ☐ |
| `respell` — Respell enharmonically (cycles) | `J` | ☐ | ☐ | ☐ |
| `accidental-display` — Force the accidental | `Shift+A` | ☐ | ☐ | ☐ |
| `tie` — Tie to the next note | `T` | ☐ | ☐ | ☐ |
| `slur` — Slur — press again at the last note *(notation)* | `S` | ☐ | ☐ | ☐ |
| `beam` — Beam — press again at the last event *(notation)* | `B` | ☐ | ☐ | ☐ |
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

### event — 26 placements (+1 blocked, appendix)

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `insert-event-before` — Insert an event before this one | `Shift+I` | ☐ | ☐ | ☐ |
| `insert-event-after` — Insert an event after this one | `I` | ☐ | ☐ | ☐ |
| `clear-event` — Clear to an equal-duration rest | `Del` | ☐ | ☐ | ☐ |
| `shorter` — Shorter duration | `−` | ☐ | ☐ | ☐ |
| `longer` — Longer duration | `=` | ☐ | ☐ | ☐ |
| `dots` — Dot the value (cycles 0 → 1 → 2 → none) | `.` | ☐ | ☐ | ☐ |
| `tuplet` — Triplet | `Shift+R` | ☐ | ☐ | ☐ |
| `grace` — Grace note | `Shift+R` | ☐ | ☐ | ☐ |
| `tremolo` — Tremolo | `Shift+R` | ☐ | ☐ | ☐ |
| `slur` — Slur — press again at the last note *(notation)* | `S` | ☐ | ☐ | ☐ |
| `beam` — Beam — press again at the last event *(notation)* | `B` | ☐ | ☐ | ☐ |
| `staccato` — Staccato | `Shift+A` | ☐ | ☐ | ☐ |
| `accent` — Accent | `Shift+A` | ☐ | ☐ | ☐ |
| `tenuto` — Tenuto | `Shift+A` | ☐ | ☐ | ☐ |
| `strong-accent` — Marcato | `Shift+A` | ☐ | ☐ | ☐ |
| `staccatissimo` — Staccatissimo | `Shift+A` | ☐ | ☐ | ☐ |
| `breath` — Breath mark | `Shift+A` | ☐ | ☐ | ☐ |
| `fermata` — Fermata | `Shift+A` | ☐ | ☐ | ☐ |
| `arpeggio` — Arpeggio | — | ⛔ blocked — `arpeggio` | | |
| `piano` — Piano | `Shift+A` | ☐ | ☐ | ☐ |
| `mezzo-forte` — Mezzo-forte | `Shift+A` | ☐ | ☐ | ☐ |
| `forte` — Forte | `Shift+A` | ☐ | ☐ | ☐ |
| `crescendo` — Crescendo | `Shift+A` | ☐ | ☐ | ☐ |
| `diminuendo` — Diminuendo | `Shift+A` | ☐ | ☐ | ☐ |
| `ottava` — Ottava alta | `Shift+A` | ☐ | ☐ | ☐ |
| `direction` — Direction text… | `Shift+A` | ☐ | ☐ | ☐ |
| `lyric` — Lyric syllable… | `Shift+L` | ☐ | ☐ | ☐ |

### container — 1 placement (+1 blocked, appendix)

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `delete-container` — Delete this container (clears its notes first) | `Del` | ☐ | ☐ | ☐ |

### voice bar — 6 placements

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `new-voice` — Add a voice to this bar | `I` | ☐ | ☐ | ☐ |
| `delete-voice-bar` — Delete this voice bar (clears its notes first) | `Del` | ☐ | ☐ | ☐ |
| `full-measure-rest` — Full-measure rest | `Shift+B` | ☐ | ☐ | ☐ |
| `rest-spelling` — Respell the rests… | `Shift+R` | ☐ | ☐ | ☐ |
| `space` — Insert space… | `Shift+R` | ☐ | ☐ | ☐ |
| `cycle-voice` — Step to the next voice at this beat | `Alt+V` | ☐ | ☐ | ☐ |

### staff bar — 6 placements (+2 blocked, appendix)

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `new-voice` — Add a voice to this bar | `I` | ☐ | ☐ | ☐ |
| `delete-part-bar` — Delete this staff bar (clears its notes first) | `Del` | ☐ | ☐ | ☐ |
| `clef` — Clef… | `Shift+C` | ☐ | ☐ | ☐ |
| `tuning` — Tuning… | `Shift+U` | ☐ | ☐ | ☐ |
| `capo` — Capo… | `Shift+P` | ☐ | ☐ | ☐ |
| `transpose-part` — Instrument transposition | — | ⛔ blocked — `part-transposition` | | |
| `mute-part` — Mute the part | — | ⛔ blocked — `mute` | | |
| `part-scope` — Select the whole part | `Ctrl+A` | ☐ | ☐ | ☐ |

### bar — 17 placements

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `insert-bar-before` — Insert a bar before this one | `Shift+I` | ☐ | ☐ | ☐ |
| `insert-bar-after` — Insert a bar after this one | `I` | ☐ | ☐ | ☐ |
| `delete-bar` — Delete this bar (clears its notes first) | `Del` | ☐ | ☐ | ☐ |
| `clef` — Clef… | `Shift+C` | ☐ | ☐ | ☐ |
| `key-signature` — Key signature… | `Shift+K` | ☐ | ☐ | ☐ |
| `time-signature` — Time signature… | `Shift+T` | ☐ | ☐ | ☐ |
| `repeat-start` — Repeat start | `Shift+B` | ☐ | ☐ | ☐ |
| `repeat-end` — Repeat end | `Shift+B` | ☐ | ☐ | ☐ |
| `ending` — Volta ending… | `Shift+B` | ☐ | ☐ | ☐ |
| `double-barline` — Double barline | `Shift+B` | ☐ | ☐ | ☐ |
| `final-barline` — Final barline | `Shift+B` | ☐ | ☐ | ☐ |
| `measure-repeat` — Measure repeat… | `Shift+B` | ☐ | ☐ | ☐ |
| `segno` — Segno | `Shift+B` | ☐ | ☐ | ☐ |
| `coda` — Jump (D.S. al fine) | `Shift+B` | ☐ | ☐ | ☐ |
| `rehearsal` — Rehearsal mark… | `Shift+B` | ☐ | ☐ | ☐ |
| `tempo` — Tempo… | `Shift+B` | ☐ | ☐ | ☐ |
| `section` — Section label… | `Shift+B` | ☐ | ☐ | ☐ |

### section — 3 placements (+1 blocked, appendix)

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `delete-section-boundary` — Delete this section boundary | `Del` | ☐ | ☐ | ☐ |
| `section` — Section label… | `Shift+B` | ☐ | ☐ | ☐ |
| `section-range` — Select the section’s range | — | ☐ | ☐ | ☐ |
| `section-colour` — Section colour | — | ⛔ blocked — `section-colour` | | |

### document — 7 placements (+2 blocked, appendix)

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `insert-part-before` — Insert a part above this one | `Shift+I` | ☐ | ☐ | ☐ |
| `insert-part-after` — Insert a part below this one | `I` | ☐ | ☐ | ☐ |
| `add-part` — Add a part… | `Shift+P` | ☐ | ☐ | ☐ |
| `delete-part` — Delete this part (clears its notes first) | `Del` | ☐ | ☐ | ☐ |
| `part-name` — Part name… | `Shift+P` | ☐ | ☐ | ☐ |
| `staves` — Staves per part… | `Shift+P` | ☐ | ☐ | ☐ |
| `staff-kind` — Staff kind: notation + tab | `Shift+P` | ☐ | ☐ | ☐ |

### session (the `global` tab) — 8 placements

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `undo` — Undo | `Ctrl+Z/Y` | ☐ | ☐ | ☐ |
| `redo` — Redo | `Ctrl+Z/Y` | ☐ | ☐ | ☐ |
| `doc-add-part` — Add a part… | `Shift+P` | ☐ | ☐ | ☐ |
| `doc-time` — Time signature… | `Shift+T` | ☐ | ☐ | ☐ |
| `doc-tuning` — Tuning… | `Shift+U` | ☐ | ☐ | ☐ |
| `staff-kind-both` — Staff kind — notation + tab | — | ☐ | ☐ | ☐ |
| `staff-kind-tab` — Staff kind — tab only | — | ☐ | ☐ | ☐ |
| `staff-kind-notation` — Staff kind — notation only | — | ☐ | ☐ | ☐ |

### session chrome — 5 placements, no registry row

The `global` tab also carries the page's own tiles, which act on the session rather than
on the document and so live in `ScenarioPage`, not in `edit/`. They have nowhere to
declare a mark, so they are purple unconditionally — and, like a registry row, never
while unavailable. Three of them appear only when there is something to act on.

| Tile | Key | tested | grouped | ordered |
|---|---|---|---|---|
| `copy-selection` — Copy current selection *(when a clipboard exists)* | `Ctrl+C` | ☐ | ☐ | ☐ |
| `paste-selection` — Paste copied selection here *(when a clipboard exists)* | `Ctrl+V` | ☐ | ☐ | ☐ |
| `cut-selection` — Cut current selection *(when a clipboard exists)* | `Ctrl+X` | ☐ | ☐ | ☐ |
| `copy-trace` — Copy this session as a trace fixture | — | ☐ | ☐ | ☐ |
| `revert` — Revert every edit *(when the session is dirty)* | — | ☐ | ☐ | ☐ |

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
| ~~`arpeggio`~~ | ~~`arpeggio`~~ | event | **CLOSED 2026-08-31 (one-surface 11b): the blocker was stale** — the adornment grammar already speaks `arpeggio` / `arpeggio down arrow` / `no arpeggio` and the inspector reads the pill; the tile retired |
| ~~`container-properties`~~ | ~~`container-settings`~~ | container | **CLOSED 2026-08-31** by [workbench-one-surface-rhythm.md](../complete/workbench-one-surface-rhythm.md): `setContainerProperties` landed (presentation fields only — re-timing stays a wrap request), surfaced as coincidence pills in the rung inspector; the tile retired with the rhythm popover, so the row leaves the triage tables |
| `part-transposition` | `transpose-part` | staff bar | not a campaign item — needs its own proposal from the campaign's "beyond" list — **tile retired 2026-08-31 (one-surface 11b); the op-gap survives and is named in the campaign's closing entry** |
| `mute` | `mute-part` | staff bar | audio's own decision: there is no player element at all ([core-viewer-embedded-app.md](../complete/core-viewer-embedded-app.md) records why), so the row renders value-less until there is — **tile retired 2026-08-31 (one-surface 11b); the op-gap survives — audio's player question is unchanged** |
| `section-colour` | `section-colour` | section | **no address recorded** — same hole as `arpeggio`; decide whether section colour is a document property or a viewer preference before giving it a verb — **tile retired 2026-08-31 (one-surface 11b); the document-vs-viewer question survives, named in the campaign's closing entry** |
| ~~`layout-authoring`~~ | ~~`system-break`, `multimeasure-rest`~~ | document | **CLOSED 2026-08-31** by [workbench-one-surface-layout.md](../complete/workbench-one-surface-layout.md): the surface that sees the document turned out to be the rung inspector's document rung — `parseLayoutSentence` wholesale (upsert-by-id via context), summary pills with slot-addressed removals; the two blocked tiles retired with the layout popover |

Three surface gaps outlive the tiles and are not triage rows either: the dashed
on-score preview of a scope **wider** than the enclosure can draw; the promoted
score-rung `score-navigate` event; and the tray in the **embed / studio**, which waits
on [core-editor-element-promotion.md](core-editor-element-promotion.md) and its
deliberately parked trigger.

✔ when: every placement carries all three marks, no tile renders purple, and the
appendix is empty.
