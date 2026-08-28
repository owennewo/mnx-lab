# The rung inspector — the cursor's path as a breadcrumb, the rung's state as pills

> **Status: IN PROGRESS 2026-08-28 — all five stages built and landed the same day.**
> What stays open is not a stage but a dependency: the container rung reads its spec
> and cannot write it until the session grows a `setContainerProperties`-class verb
> ([core-selection-tray-residue.md](../proposed/core-selection-tray-residue.md),
> `container-properties`). Picked up the day it was proposed, after the design pass. **Design canvas:** [Rung Inspector](https://claude.ai/code/artifact/6d09ff2a-d82a-4cba-a653-3d4245fa26a3)
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

### Redesign (2026-08-28, after stage 5) — the rung window and the three rows

Driven hands-on, the horizontal breadcrumb read as a second HUD. The
[design canvas](https://claude.ai/code/artifact/6d09ff2a-d82a-4cba-a653-3d4245fa26a3)
(versions `vertical-rung-window`, `three-rows`) replaced it and the build followed:

- **The breadcrumb is a vertical window on the left** — three rows of 30px: the rung
  above, the **current rung** (accent bar, lit), the rung below, the outer two faded off
  the edge like a wheel. ↑↓ turn it; Enter on the middle row is go-to. The rows carry
  **only the rung's name and 1-based index** (`bar 3`, `note 1`, `section 2`) — nothing
  else, so the window stays 118px and never wraps.
- **The body is a hard three rows.** Row 1 is the add slot (where the cursor opens and
  where bare typing lands); rows 2–3 hold the existing pills, wrapping, and what does
  not fit scrolls behind a `+N more · scrolls` badge counted after layout. Candidate
  menus float over the frame rather than growing it.
- **Identity moved out of the window into floor pills.** `pitch: B3` at the note
  (amended by typing a pitch — parsed, diffed against the note, fired as the session's
  own `transpose`, so spelling and the fingerboard follow); `name: Head` at the section
  (empty is refused — a section without a name is not a section — with `bars: 1–8` as a
  reading); `time`/`barline` at the bar as before.
- **←/→ step siblings at the current rung** — next bar at the bar rung, next note at
  the note rung — through the session's own `nextPosition`/`prevPosition`, so the
  window turns sideways the way ↑↓ turn it up and down. This reverses the earlier
  ruling that ←/→ walk pills: with the window in place the collision that ruling
  avoided is gone (there is one rung row, not a row of crumbs), and stepping is what a
  hand on the arrows expects. **Tab/Shift+Tab walk the frame** — the rung row, the
  slot, the pills — and ↑↓ stay the ladder from anywhere in it.

## Agreements before code

1. **Enter opens the inspector in `PENDING_PRECEDENCE`'s last step** (`src/edit/keymap.ts`:
   `popover › overlay › pendingFret › spanAnchor › selection`; `handlePending` level 5),
   so a half-typed fret or an armed spanner never opens one. *Correction from the
   build:* there is no `ESCAPE_PRECEDENCE` — Escape and Enter share the one list, and
   the tray is its `overlay` consumer, DOM-enforced (it owns its keydown and
   `preventDefault`s before the page listener runs). The inspector is the same class of
   thing, so it needed **no new precedence entry**: once open it owns its keys exactly
   as the tray does, and the literal list in `key-scope.test.ts` is untouched.
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

## What the build found (2026-08-28, stages 1–3)

- **The machinery is `edit/`, not shell.** The first cut put pills, siblings, words
  and the line parser in `workbench/inspectorRows.ts` beside `hudRows.ts` — and the
  boundary checker refused the harness test (`harness-not-into-shells`). Right call:
  everything but the crumb *labels* is a pure function of the document and the typed
  unions, so it lives in **`src/edit/inspector.ts`** and
  `harness/conformance/rung-inspector.test.ts` joins it headlessly; the shell's
  `inspectorRows.ts` only glues `buildHudRows`' labels on. `attributeText` (from
  `opRows`) and `timeAt` (from `hudRows`) moved down with it, plus a new `keyAt`.
- **`readMeasureAttributes` is the reverse of the op.** Pills are read by the inverse
  of `measureAttributeValue`, so what the inspector shows is exactly what
  `setMeasureAttribute` could have written; the test sets one of each kind and reads it
  back. It made one canonical-form decision: `at` is spelt only when it differs from
  the kind's default (segno/fine start, jump end), or a `segno` written without one
  read back with one.
- **Placement is one function.** `SelectionTray.place()` became
  `workbench/overlayPlacement.ts`, consumed by both; the tray's behaviour is unchanged
  and the design-tokens test now runs its three joins over the inspector too.
- **Hands-on caught what the joins could not.** `npm run smoke:inspector`
  (`harness/verify/inspector-smoke.mjs`, headless Chrome over CDP on the selection
  smoke's pattern) drives Enter → ↑×4 → `barline double` ⏎ → ⌫ → Enter-on-crumb ↓ ⏎ →
  Esc, and asserts the HUD agrees about the rung at each step. It found the cursor
  **not following the rung** after ↑: the page re-aimed it before the `crumbs` prop had
  re-rendered. Fixed in the element — `updated()` moves a cursor that was *on a crumb*
  to the new active crumb, and leaves a cursor on a pill alone.
- **`/` in the inspector opens the tray** on the same anchor and side; the tray closes
  the inspector on open. They are never up together.
- Goldens byte-identical; 1118 tests + the smoke green; `rungInspector` credited in
  `opRows` (`Enter · inspector`) and listed in `SURFACE_INTENTS`.

## What the build found (2026-08-28, stages 4–5)

- **Two readers and two verbs were the whole model-side cost.** `readTechniques` and
  `readPositionedAttributes` are the inverses of the `setTechnique`/`setPositioned`
  writers (the test sets one of each and reads it back); `setTechnique` is the
  non-toggle verb an *amend* needs (`toggleTechnique` on a present bend removes it),
  and `setEventDuration` types a value where the ladder keys only step. **Bend widened
  to `pre`** (agreement 4): the curve's start is an explicit pre-bend, else the shape
  each form always had — every pre-widening call still writes byte-identical points,
  and the reader spells `pre` only when it differs from that default. The grammar
  takes the flattened dotted form: `bend pre 1 2 release`.
- **A point edit re-anchors the selection at the note** (`session.apply`'s rule), so
  applying an event pill would have dropped the inspector to the note rung with the
  pills changing under the cursor. The page puts the ladder back (`goToLevel` to the
  rung it was on) after any edit that moved it — recorded in the trace, which is
  honest: the inspector *is* holding a rung the session would otherwise leave.
- **Ranges cost nothing new.** `pillsFor` reads one member at a time through
  `resolvedSelection.members` and merges by key: on every member → solid, on some →
  `partial` (half-tone). Removal fans out where the session already fans out
  (markings, measure attributes, fingering, accidentals, strings) and acts at the
  cursor elsewhere (techniques, positioned, syllables) — the doc lists which. From
  inside the inspector **Shift+←/→ extends** exactly as on the score, floor-axis rule
  included: at the note rung the first press re-levels to event, the second extends.
- **The pills' words are nouns, the grammars' are values.** `dynamic: mf`, `fingering:
  left 3` compose an amend as `dynamic mf` / `fingering left 3`; the parser strips the
  noun before handing the value to `parseAdornment`. A syllable pill spells its
  hyphens back from `syllableType` so `sleep-` round-trips.
- **Read-only is a class, not an absence.** Container pills (`tuplet: 3:2 quarter`,
  `bracket`, `number`) and inherited readings (`strings: 6 strings`) draw dotted with
  no × and refuse Enter; the meta note says why. This is the honest form of the
  residue ledger's `container-properties` row on the same screen as the container.
- **Known gap, unchanged:** `setFullMeasureRest` / `setMeasureRepeat` write
  `parts[0].sequences[0]` regardless of the cursor's part and voice — a pre-existing
  op limitation the voice-bar pills now expose. Not fixed here; it is an ops item.
- `npm run smoke:inspector` now also walks ↓ to the event rung, adds `staccato`,
  asserts the rung held, reads the note rung, and extends to a two-event range to see
  the pill go half-tone. 1128 tests + the smoke green; goldens byte-identical.

## Stages

1. ✅ **Crumbs** (2026-08-28). The HUD's rows as the breadcrumb; Enter from the score
   opens it, ↑/↓ walk it, Escape returns.
2. ✅ **Go to** (2026-08-28). Bar, part and section crumbs open their sibling lists
   (↑/↓ cycles, typing filters, Enter commits via `goToMeasure`/`setPart`). Voice has no
   direct setter in the session (only `cycleSlot`), so its crumb offers none — the
   score's own ←/→ steps it.
3. ✅ **Measure-attribute pills** (2026-08-28). `time` (floor when declared here,
   inherited otherwise), `key` (removable when declared here), `barline` (always
   present, floor `regular`), and one pill per declared attribute (`tempo#n` for the
   array). Add via the slot's typeahead, amend via Enter-on-pill (value selected) or
   upsert, two-step Backspace. Parsing reuses `parseBarAttribute` for the family it
   already covers; the word list is derived from `MEASURE_ATTRIBUTE_FIELDS`. The
   rhythm riders (`full-measure rest`, `measure repeat`) are refused with a pointer to
   Shift+B — they are `voiceMeasure` things and arrive with stage 4.
4. ✅ **The other families** (2026-08-28). Event: `duration` (floor, amend by value),
   markings, positioned (dynamic/cresc/dim/louder/softer/text/8va/8vb), syllables.
   Note: string annotation (removable; the value is chosen with the tab digits),
   accidental display, fingering, techniques (bend with `pre`/peak/`release`), then
   the event's own. Voice-bar: full-measure rest, measure repeat. Part-bar: clef,
   capo, strings (reading). Container: read-only spec pills — the mini-rung waits on
   the missing verb, and the dotted typed form (`bend pre 1 2 release`) covers the
   one structured value that exists today.
5. ✅ **Ranges** (2026-08-28) — the half-tone pill, Shift+←/→ from inside.

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
