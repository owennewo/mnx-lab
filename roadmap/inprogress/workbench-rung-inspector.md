# The rung inspector — the cursor's path as a breadcrumb, the rung's state as pills

> **Status: IN PROGRESS 2026-08-28** — picked up the day it was proposed, after the
> design pass. **Design canvas:** [Rung Inspector](https://claude.ai/code/artifact/6d09ff2a-d82a-4cba-a653-3d4245fa26a3)
> (seven states over the score: walking, go-to, add, amend, the two-step Backspace,
> mini-rung, range — plus the key legend). Two decisions came out of that pass and are
> folded in below: the inspector sits **over the score, where the tray sits**, not in
> the side panel; and it is **keyboard-first with the cursor always drawn**.
>
> A third editing surface, to be tried *beside* the
> selection tray and the Shift+letter popovers so that use decides which wins — not a
> replacement for either yet. Ends [core-selection-tray-mechanism.md](../complete/core-selection-tray-mechanism.md)'s
> line of surfaces at three: **the tray is a command palette, the popovers are typed
> grammars, this is an inspector.** Written from a design conversation on 2026-08-28;
> the argument is recorded here so it is not re-derived.

## The problem — two indexes of one content, stitched at a seam

The workbench has two keyboard surfaces for editing, built a month apart, and they
index the same ops on different axes:

- **Feature-first**: nine `Shift+letter` popovers (`T` time, `K` key, `C` clef,
  `U` tuning, `P` part, `B` bar attribute, `A` adornment, `L` lyric, `R` rhythm; a
  tenth, `layout`, is reached from the ops panel). Each is a typed-sentence grammar with
  its own hand parser in `src/edit/setupGrammar.ts`. Each landed with the campaign item
  that needed it, and its letter was chosen for the *mnemonic*, not the rung — which is
  why key signature is not in the bar-attribute family, and why the families straddle
  rung boundaries: only three of nine (`time`, `key`, `tuning`) are single-rung, and the
  registry cross-lists `clef` at `measure`, `bar attribute` at `section` and
  `voiceMeasure`, `rhythm` at `voiceMeasure` as conveniences.
- **Rung-first**: the selection tray, fed from `src/edit/commandRegistry.ts` where every
  command declares its `scopes`. Its `popover`-tier tiles **open the feature popover**
  — the seam. The popover is rung-blind (it acts on the cursor), the tray is rung-scoped
  per command, so `Shift+B` at `voiceMeasure` and at `measure` open the identical prompt
  and the user feels an asymmetry they cannot name.

Both are *verb-shaped*: they answer "what can I do?". Neither answers the question that
precedes it — **"what is set on this thing?"** The HUD (`src/workbench/hudRows.ts`)
answers it read-only, as a wall of rows. Removal in the grammars is blind (`no section`
strips something you cannot see), and two removal tokens (`no` / `inherit`) exist only
to teach a taxonomy the surface hides.

## The proposal

**Enter, with nothing pending, opens the inspector on the current rung.** It draws one
line: the cursor's path as a breadcrumb of *identity pills*, a separator, the rung's
attributes as *deletable pills*, and a blank slot with typeahead.

```
[document] › [Verse 1] › [bar 3] › [Guitar] › [voice 1]  │  [time: 4/4] [key: Bb] [barline: double]  ▯
 identity pills — mandatory, value = a reference             attribute pills — deletable        blank slot
                              ^ active crumb
```

The framing to build it under: **the inspector is the HUD made editable.** `hudRows.ts`
already computes one row per present rung with one `active` and the identity string
(`bar 3 of 12 · 4/4`, `Verse 1 · m5–12`, `new bar 13` on the ghost bar) — those rows
*are* the crumbs, laid horizontally. The chip, the HUD and the tray share one rung
vocabulary (`hudRows.ts:40` says so, and why); the inspector is a fourth reader of that
vocabulary, never a fourth spelling.

### One rule about bare typing

The design risk is that "add an attribute", "go to a sibling" and "amend a value" all
want the keyboard. They can coexist only if there is **exactly one meaning for bare
typing** and everything else is reached by *opening* something first. So a crumb is a
pill too — a mandatory one whose value is a reference (`bar: 3`, `part: Guitar`, the same
shape as `hammerOn.target`) — and the line has two states, always visible by whether a
caret sits inside a pill:

| | **Walking** (no pill open) | **Editing** (a pill is open, caret inside) |
|---|---|---|
| bare typing | goes to the **blank slot** = add attribute | filters this pill's candidates |
| ↑ / ↓ | the ladder — move the active crumb, re-render its attributes | cycle this pill's candidates (siblings on a crumb, enum values on an attribute) |
| ← / → , Tab | walk pills, crumbs included | move caret / accept the completion |
| Enter | open the focused pill | commit — on a crumb this is **go to**: the cursor moves and the lower crumbs re-derive |
| Backspace | two-step removal (below) | edit the text |
| Escape | leave the inspector, focus back to the score | close the pill, back to walking |
| `/` | widen to the tray | — |

So "go to a sibling" is *Enter on the crumb, arrow or type, Enter* — one key more than
a bare ←/→ would be, and deliberately so: bare ←/→ meaning "sibling" on a crumb was the
collision. On the score, ←/→ at that rung already steps siblings in one key, so nothing
is lost. **Shift+↑/↓** works inside the inspector as well as bare ↑/↓, so the ladder
gesture people already have keeps working; bare arrows are the shortcut, not a
contradiction. `Delete` keeps its ladder meaning (remove the rung's object,
[core-delete-clears-then-removes.md](../complete/core-delete-clears-then-removes.md)) and is
**never** a pill key — Backspace is the only destructive key on pills.

### Verbs are not attributes

`insert before`, `split`, `transpose`, `delete` are verbs; the inspector is a view of
**state**. They stay in the tray and the keymap. The boundary is one sentence — **Enter
answers "what is this thing", `/` answers "what can I do to it"** — and `/` typed in the
inspector widens to the tray exactly as a second `/` in the tray widens to the `global`
tab ([core-selection-tray-global-tab.md](../complete/core-selection-tray-global-tab.md)).
Letting verbs in as "pills that fire and vanish" would rebuild the tray inside the
inspector and the two would never diverge enough for use to judge them.

This also keeps the **Ctrl+G** contract intact: *"`/` is commands, Ctrl+G is
destinations"* is about destinations *outside* the score (queue, coverage map). A crumb's
go-to is a cursor move *within* the score — the ladder's own ↑↓←→, made addressable — not
a finder.

### Pills are typed unions, not a tenth grammar

Every attribute the popovers construct is already a typed union in `src/edit/ops.ts`:
`MeasureAttribute {kind: 'barline', type}`, `{kind: 'tempo', base, bpm}`,
`{kind: 'ending', numbers, open}`, `PositionedAttribute` (dynamic, direction, ottava),
the technique union. A pill is `kind: value`; typeahead completes `kind` from the
union's discriminants and the value from its enum. **The vocabulary is derived, not
written** — that is the whole win over `setupGrammar.ts`, and the reason the popover
parsers can retire family by family once the inspector reaches them.

Five shapes need adapters, and the finding worth recording is that they are **not one
shape**:

| Family | Shape today | Pill key | Note |
|---|---|---|---|
| Measure attributes | `{kind, …}` union, one op pair | `kind` | the model for the rest |
| Positioned (dynamic, direction, ottava) | `{kind, …}` union at a rhythmic position on the event | `kind` | same shape, different owner |
| Tab technique | `{kind: 'bend', semitones?, release?}`; slide/hammerOn/pullOff carry a `target` note id | `kind` | `target` is a reference — its typeahead is a note picker, not an enum; **bend is a gap** (below) |
| Markings | `event.markings[name] = attrs` — stringly keyed, no union | the marking name | mostly boolean pills (`staccato`, `accent`, `fermata`) |
| Note singletons | `accidentalDisplay`, `fingering {hand, finger}` — bespoke set/remove ops | the field name | two adapters, not a family |

The adapter has a home: the registry already gives every command `isActive`/`action`
facets over a narrow `SessionView`; a **`pill` facet** beside `tier` keeps the registry
the single source, and `harness/conformance/command-registry.test.ts`'s joins extend
naturally (unique pill keys per rung, every pill names an op the session handles,
mandatory pills name their floor).

### Key-value, multi-level, and the removal classes

- **Key-value is the base case**, not a special one: `time: 3/4`, `key: Bb`,
  `barline: double`, `tempo: ♩=120`. Mandatory ones (event `duration`, `barline` whose
  default is `regular`, `time`) are always-present pills that cycle rather than delete,
  drawn without an ×.
- **Multi-level is the ladder applied inside a pill.** Typed form is dotted —
  `bend.pre 1`, `bend.release 1/2`, `ending.numbers 1,2`, `ending.open` — a two-stage
  completion. Displayed form: a pill with structure is a **mini-rung**; Enter descends
  into its own pill row (`pre: 1` `release: ½` `hold: —`), Escape ascends. A container
  *is* a rung, so this is also how the residue ledger's `container-properties` row
  (tuplet ratio, bracket, number display) gets its surface.
- **Amending** is the upsert path — typing `bend.pre 1/2` over an existing `bend.pre 1`
  replaces it, one op (the set ops already replace by `kind`), one undo step — or Enter
  on the pill with the *value* selected (the rename-a-file convention: key fixed, value
  highlighted), type, Enter.
- **Two-step Backspace maps onto the removal classes** the op campaign already named
  ([core-element-ops-bar-attributes.md](../complete/core-element-ops-bar-attributes.md) §1):
  - *annotation* pills (`section`, `tempo`, `bend`, `staccato`): press 1 clears the value
    → `bend.pre: ▯`, pill stays, caret inside, typeahead offering values; press 2 removes
    the pill.
  - *modifier / mandatory* pills (`barline`, `duration`, `time`): press 1 reverts to the
    floor → `barline: regular`; there is no press 2, because removing the attribute does
    not remove the ink.

  The removal class stops being report vocabulary and becomes the thing that decides
  whether a pill has a floor. One rule, both cases, and the `no` / `inherit` tokens have
  nothing left to teach.
- **Ranges.** A pill that holds on every member draws solid; on some, half-tone (the
  mixed-checkbox convention). Adding applies to all; removing a half-tone pill strips it
  from the members that have it. Ops are per object already, so the range is a fan-out
  in the surface, not new ops.

### Where it lives — over the score, in the tray's frame

**Where the tray sits**: one tray-gap below the selection's enclosure, joined by the
accent shaft, in the tray's own frame (`--tray-w` 470px, 1px ink border, the meta line on
top, mirrored/flipped by the same `place()` rules) — see the
[design canvas](https://claude.ai/code/artifact/6d09ff2a-d82a-4cba-a653-3d4245fa26a3).
The first draft put it in the side panel's hud tab, because the HUD's rows are its
data; the design pass moved it: the inspector is *about the selection*, so it belongs
at the selection, and the tray already solved that placement (anchor rect, mirroring
near the right edge, flipping when there is no room below). The HUD stays the
read-only, always-visible form of the same rows; the rung chip's ▲▼ stays the mini
version. The two share `hudRows.ts` and nothing else.

Inside the frame, the line **wraps to two rows** at 470px — crumbs, a hairline, then
attributes — rather than one long scrolling row. The meta line names the state
(`bar 3 of 12 · walking · cursor on the bar crumb`, `… · editing tempo`, `… · go to`),
and a strip along the bottom is the **key legend for the current state**, the way the
tray's meta line is — so the arbiter of keys is on the same screen as the keys.

**Keyboard-first, cursor always drawn.** One cursor (accent outline, `--row-current`
fill) walks crumbs and attributes as a single row: **Tab / Shift+Tab and ←/→**. Enter
opens the pill under it — a crumb opens its sibling list, an attribute opens with its
value selected — and typing with nothing open always lands in the blank slot. An open
pill is a 2px accent border with a caret. Pills with a floor draw ▾; removable pills
draw ×; crumbs draw neither.

## Agreements before code

1. **Enter goes last in `PENDING_PRECEDENCE`** (`src/edit/keymap.ts`:
   `popover › overlay › pendingFret › spanAnchor › selection`), so a half-typed fret or
   an armed spanner never opens an inspector. Escape from the inspector is one more
   entry in `ESCAPE_PRECEDENCE`, asserted in `key-scope.test.ts` like the others.
2. **The inspector fires `session.handleIntent` with the same ops** as the tray and the
   popovers, and registers `rungInspector` as a surface **only** where it genuinely adds
   keyboard reachability (the tray's own rule — the ops panel credits the key, not the
   emitter). Where it does, the ops log becomes the measurement: which surface fired
   each op is how "which wins" gets read.
3. **Pills derive from the unions.** No pill vocabulary is hand-listed where a
   discriminated union exists; the `pill` facet may *name* the union member, never
   restate its values.
4. **Bend's op widens first.** Today's `{semitones?, release?: boolean}` is a
   simplification of the model's curve (`points: [{position, alter}]`; a pre-bend is a
   first point at 0 with non-zero alter). `bend.pre` / `bend.release ½` cannot be
   expressed by the op at all; the pill row is a projection of the curve and the right
   one to expose, so this is a model-side change (`setTechnique`'s payload, or the
   adapter writing points) and it lands before the technique pills do — the same point
   the residue ledger keeps hitting: the surfaces are ahead of the ops for anything with
   structure.
5. **The rung vocabulary stays single-sourced** in `hudRows.ts`. Crumb labels are the
   HUD's identity strings, unchanged.
6. **Goldens byte-identical.** Nothing here touches `model/` layout or `engine/`; the
   enclosure preview the tray uses (`drawEnclosure` over `data-source-id`) is reused for
   an opened crumb, so no layout code moves.

## Stages

1. **Crumbs.** The HUD's active row rendered as the breadcrumb; Enter from the score
   opens it, ↑/↓ and Shift+↑/↓ walk it, Escape returns. Read-only. This alone is a way to
   *read* the ladder the HUD's wall of rows does not give.
2. **Go to.** Enter on a crumb opens its sibling list (↑/↓ cycles, typing filters,
   Enter commits through the cursor's existing step at that rung). Lower crumbs
   re-derive.
3. **Measure-attribute pills.** The first family — the ten-kind union plus `time` and
   `key` at the bar rung, which is the family the popovers split worst. Add via the blank
   slot's typeahead, amend via upsert or Enter-on-pill, two-step Backspace with floors.
   `rungInspector` registered as a surface for what the tray cannot already reach.
4. **The other families**, one per step, in the residue ledger's order: positioned,
   markings, note singletons, technique (after agreement 4), containers as mini-rungs.
5. **Ranges** — the half-tone pill.

Each stage lands with its registry join and a hands-on pass over CDP like the tray's;
the popover it makes redundant is **not** removed in the same change — retirement is a
separate, later decision taken on the ops log, which is the point of running three
surfaces.

## What this does not decide

- Whether the popovers retire. They may survive as **accelerators**: `Shift+B` = open the
  inspector at the bar rung with the blank slot filtered to that family; `Shift+K` = the
  same with the caret on the `key` pill. That keeps the mnemonics at zero cost and
  dissolves the "regardless of rung" asymmetry without a rule — but it is a decision for
  after stage 3, made on evidence.
- Whether the path is a **textual address**. `bar 3 › Guitar › voice 1 › event 2 › note 1`
  is the same walk `model/noteKeys.ts` does, and could become the human form of a note
  key — what the ops panel's `where` text, recorded traces and the assist loop's error
  messages each spell their own way today. Named here so the breadcrumb is built as if
  it might be one; not claimed.
- Whether the inspector ships to embed/studio. Same open question the tray's purple
  carries.

## Related

- [core-selection-ladder.md](../complete/core-selection-ladder.md) — the rungs and
  their vocabulary.
- [workbench-rung-legibility.md](../complete/workbench-rung-legibility.md) — the rung
  chip; the crumbs are its long form.
- [core-selection-tray-mechanism.md](../complete/core-selection-tray-mechanism.md),
  [core-selection-tray-global-tab.md](../complete/core-selection-tray-global-tab.md),
  [core-selection-tray-residue.md](core-selection-tray-residue.md) — the tray trio; the
  inspector is `/`'s sibling, not its successor.
- [core-element-ops-bar-attributes.md](../complete/core-element-ops-bar-attributes.md) —
  the removal classes the Backspace rule is built on, and the popover grammar this
  would first make redundant.
- [core-rung-addressing.md](../complete/core-rung-addressing.md) — Shift+1–8 jumps to a
  named rung; the crumbs are that ladder with identities on it.
