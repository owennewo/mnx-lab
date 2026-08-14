# Clef & key signature — the inherited-attribute pair

> **Status: built 2026-08-14, same day as proposed.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md), item 5 — the
> first *op-family* item, so unlike items 2–3 this opens with the contract's
> full agreement block: the op pair with its removal class, the shortcut, the
> rung, and the evidence.
>
> **Why this item and not another**: item 3's blocking histogram
> ([core-element-ops-construct-traces.md](core-element-ops-construct-traces.md))
> is unambiguous — **`clef` blocks 96 of the 106 scenarios**, and the next nine
> blockers together account for fewer. Ordering by taste is over.

## The agreement block

### 1. The op pair

| | construct | destruct |
|---|---|---|
| clef | `setClef {measureIndex, sign, staffPosition?, octave?}` | `removeClef {measureIndex}` |
| key signature | `setKeySignature {measureIndex, fifths}` | `removeKeySignature {measureIndex}` |

**Removal class: inherited attribute** — and the campaign's taxonomy says exactly
what that must mean. Removing a clef does not produce a staff with *no* clef; it
removes a **declaration**, and the measure reverts to its predecessor's governance:
the nearest earlier declaration, or — when there is none — the engine's default,
which for a tab-bearing part is the guitar treble-8 the exemplar already
discovered it draws. Same for a key signature, falling back to C (`fifths: 0`).
Two consequences that are decisions, not details:

- **No tombstones.** Removal deletes the array entry, and an emptied `clefs: []`
  is deleted with it — the surviving-document oracle (item 2) enforces this, and
  would have caught a `clefs: []` residue on its first run.
- **The first declaration is removable.** It is tempting to refuse removing the
  only clef ("a staff must have one"), but that confuses the document with the
  render. A clef-less document is perfectly legal MNX and renders with the
  engine's default; `minimal-single-note` is exactly that document, and it is in
  the corpus as `verified`.

Scope: the **entry surface** (`parts[0]`, staff 1) and measure-start position, in
line with every other op today. Mid-measure clef changes (`position.fraction`,
`spec/clef-changes`) and per-staff clefs on a grand staff wait for the same
addressing work items 11 and 13 own.

### 2. The shortcut — popover tier

`Shift+C` (clef) and `Shift+K` (key signature), joining `Shift+T` time,
`Shift+U` tuning, `Shift+P` part. Both are free in `SHELL_BINDINGS`, neither
collides with the campaign's reserved `B H S V X O` (item 9, unmodified letters).
Setup is low-frequency; it earns a typed grammar, not a single key.

**How removal is typed** matters more than the letters. Del at the measure rung
already means "remove the empty bar" (item 1), so removal here needs its own
surface — and the popovers already have one, the text. Both grammars accept
**`inherit`** (shorthand `-`), which names precisely what removal does rather than
what it deletes. One token, one meaning, reusable by every later
inherited-attribute item.

The grammars:

- clef: `treble` · `bass` · `alto` · `tenor` · `treble8vb` · `treble8va` ·
  `bass8vb` · `inherit`
- key: a signed count of fifths (`-7`…`7`), or a major key name (`C`, `G`, `F`,
  `Bb`, `F#`…), or `inherit`

### 3. The rung — measure

Both attach at the **measure rung**, and their asymmetry is worth stating because
it will recur: a clef is a **part-measure** attribute while a key signature is a
**global-measure** one, so the same rung addresses two different owners. The
cursor's measure is the target either way, matching `setTimeSignature`. `KeyDoc`
rows land in `src/edit/keymapDocs.ts` in this same change, per the contract, so
the cheatsheet cannot drift from the keymap.

### 4. The evidence

- **Construct**: 21 scenarios are blocked *only* by clef and/or key signature, so
  the coverage report should move `ops-reachable` from 1 to 22 — the single
  biggest step this campaign can take. At least one becomes a recorded trace here;
  the rest arrive as their own families land.
- **Destruct**: the sweep's 113 `clef` and 6 `key-signature` elements move from
  `no-op` to `removed`, each judged by all six oracles (the surviving-document one
  is what proves "no tombstone" mechanically).
- Goldens byte-identical throughout, as always.

## What the build measured (2026-08-14)

Both axes moved, and the numbers are the agreement block's fourth point discharged:

- **Construct: reachable scenarios 1 → 22** (21 `ops-reachable` plus `bare-melody`
  promoted past them to `traced`), exactly the predicted step. `clef` and
  `key-signature` have left the blocking histogram entirely; the top blocker is now
  **beam at 10**, down from clef's 96. `lab/tab-derivation/bare-melody` is recorded
  as a trace — 24 intents from `{}` (part, tuning, staff kind, bar, 4/4, the
  treble-8 clef, then four pitched notes) matching its committed goldens.
- **Destruct: 758 elements removable, up from 651.** All 6 key signatures and **101
  of 113 clefs** now remove cleanly, each judged by the six oracles — including the
  surviving-document check, which is what mechanically proves the no-tombstone rule
  (an emptied `clefs` array is deleted, not left as `[]`). The 12 remaining `no-op`
  clefs are exactly the ones the scope boundary excluded: a second part, a second
  staff, or a mid-measure position.
- **The sweep had to learn a new address.** Declaring the verbs was not enough:
  `attemptElement` only knew how to drive notes and note-attached elements, so
  clefs came back `unaddressable` with a verb — the same under-attempt that ties
  had. Measure-scoped attributes now navigate by `goToMeasure` and fire their own
  intent. **The pattern for later items**: a verb without an address in the walk is
  invisible to the scoreboard, and the report says so rather than hiding it.
- **`ElementRef.measureIndex` is set only when the ops layer can really reach it**,
  mirroring how `noteKey` is set only for entry-surface notes. That is what keeps
  the 12 excluded clefs honest instead of failing.
- **The popovers became a table.** Five attributes through one nested-ternary
  template was already at its limit; `POPOVER_SPECS` (label · placeholder · hint)
  is the same "make it data" move as the keymap docs, and the next family adds a
  row rather than a limb.

## Open questions

- Should the clef grammar accept raw `G2`/`F4`/`C3` (sign + staff position) beside
  the names? Proposed: not yet — names cover the corpus, and raw pairs invite
  documents no engraver would write.
- A clef change *mid-measure* is the interesting half of `spec/clef-changes` and
  is deliberately out of scope; it needs an onset-addressed variant of the same
  op, which is item 11's territory.
