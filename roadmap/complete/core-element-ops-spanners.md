# Spanners — the first two-ended gesture

> **Status: built 2026-08-14, same day as proposed.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md), item 10 — the
> third op-family item, and the first whose *gesture* is the hard part rather
> than its grammar.
>
> Items 5 and 7 were attributes at the cursor: aim, type, done. A slur has two
> ends, and the selection ladder cannot yet extend laterally
> ([core-selection-ladder.md](../inprogress/core-selection-ladder.md) parks Shift+arrows and
> Ctrl+A), so this item must decide how a keyboard names two places at once.

## The agreement block

### 1. The op pair

| | construct | destruct |
|---|---|---|
| slur | `setSlur {fromNoteKey, toNoteKey, side?}` | `removeSlur {noteKey, index?}` |
| tie variant | `setTieVariant {noteId, targetType?, lv?}` | `toggleTie` (already the pair) |

**Removal class: reference** — and this item is where that class stops being
theoretical. A slur is *one object holding both ends*: it lives on the start
event and names the end event's id, optionally pinning `startNote`/`endNote` to
chord members. So removal drops one object and both ends go with it, which is
why `deleteNote`'s cascade (item 2) already had to know about slurs.

MNX shape decisions this forces:

- **The target is an event id**, so `setSlur` mints a deterministic id on the
  target event when it has none — the same move `toggleTie` makes for note ids,
  and the same known residue: an id minted for a spanner outlives the spanner if
  it is later removed. Recorded, not fixed here; the campaign's `annotation`
  class already names orphaned minted ids as a tombstone, and a general
  id-reaping pass is its own work.
- **Pins are written only for chords.** `spec/slurs` (single-note events) carries
  no `startNote`/`endNote`; `spec/slurs-targeting-specific-notes` pins all three.
  The op follows the corpus: pin when either end's event holds more than one note.

### 2. The gesture — anchor, then complete

With no lateral selection to lean on, the keyboard names two places in two
presses:

```
S at the start note   → arms a pending anchor (session state, shown in the edit strip)
navigate anywhere     → ordinary cursor movement, the anchor holds
S at the end note     → writes the slur, clears the anchor
S on a slur's start   → removes that slur (toggle)
Escape                → drops the anchor
```

This is **the first session state beyond the cursor and the entry duration**, and
it is deliberately small: one nullable note key. Traces stay honest because the
recorded intent is what was pressed (`toggleSlur` twice), not a synthesized
"create slur from A to B" — replay reconstructs the anchor exactly as a player
would.

**Disambiguation falls out of the pins.** `slurs-targeting-specific-notes` puts
three slurs on one event, and each names a different `startNote` — so "the slur
starting at *this* note" is unambiguous, and the sweep can remove them one at a
time without an index. Unpinned slurs sit on single-note events, where there is
nothing to disambiguate.

### 3. The shortcut — `S`, polymorphic by projection

The index flagged this collision: item 9 reserves `B H S V X O` for tab
technique, where `S` is *slide*. **Resolution: `S` is one key with two meanings,
chosen by the active projection** — slur in notation, slide in tab. That is not a
compromise, it is the ladder's own decided principle ("the active-projection bit
picks the input dialect: ↑↓ = pitch vs string") applied to a letter, and it joins
the polymorphic verbs the keymap already has (`Alt+↑↓` re-pitches a note or
repositions a rest; `Del` means a different removal at every rung).

Item 9 inherits the resolution rather than re-litigating it, and the index's
"Keys" column records `S` as **agreed** for both.

### 4. The rung — note→note

The anchor is taken at the **note** rung and completed there. Nothing new is
needed in the ladder; when lateral extension does land, "slur the selected run"
becomes a second way to reach the same op, not a replacement.

### 5. The evidence

- **Construct**: 3 scenarios are blocked only by `slur` (`spec/slurs`,
  `spec/slurs-chords`, `spec/slurs-targeting-specific-notes`) — reachable
  scenarios 42 → 45. Modest by design: this item buys a *gesture*, and the
  gesture is what items 11 and 13 will need.
- **Tie variants close an optimistic prediction instead of unlocking a scenario.**
  `spec/tie-targets` is already predicted reachable — every kind in it has a verb —
  yet `toggleTie` only makes plain `nextNote` ties, so `crossVoice`, `arpeggio`,
  `crossJump` and `lv` are unreachable in fact. That is exactly the
  kind-shaped-prediction blindness item 3 recorded; `setTieVariant` closes it.
- **Destruct**: the 6 slur elements move `no-op` → `removed`, judged by the six
  oracles — including the surviving-document check, which is the one that proves
  removing one of three slurs on an event leaves the other two untouched.
- Goldens byte-identical throughout.

## What the build measured (2026-08-14)

- **Construct: reachable scenarios 42 → 45**, and `spec/slurs` is the fifth
  recorded trace — 52 intents, the first to record a **two-press gesture**.
- **Destruct: all 6 slur elements removed**, including the three that share one
  event in `slurs-targeting-specific-notes`; the surviving-document oracle is what
  proves removing one leaves the other two untouched.
- **The renderer's default side matched the corpus's explicit ones.** `spec/slurs`
  declares `side: up` and `side: down`; the trace writes neither, and the
  primitives still match — the default (opposite the start event's stem) agrees
  with both. So `side` really is presentation, as the scope boundary assumed.
- **"Handled" is not "removed", and the sweep was conflating them.** `toggleSlur`
  legitimately returns `true` when it merely *arms* an anchor, and `attemptElement`
  read that as a successful removal — the oracle caught it as "the document did
  not change". The walk now compares the document rather than trusting the
  intent's return. **Every later gesture-shaped item inherits this**: an intent
  that returns true has been *handled*, which is not a claim about ink.
- **Ink-snapping made the trace, and nearly broke it.** Horizontal moves land on
  the ink at the destination (the ladder's nearest-pitch rule), so a recorded
  trace must not carry vertical corrections computed *before* the horizontal move
  — mine overshot by two lines and left the anchor armed. Recording a trace is
  therefore a *loop with the session*, not an open-loop script; the generator now
  tracks where the cursor actually lands.
- **An unpinned slur on a chord** (`spec/slurs-chords`) has to be addressed from
  the event's first note: the walker and `slurStartsAt` agree on that convention,
  and the sweep failed loudly until they did.

## Scope boundary

`side` (the curve's up/down override) is settable by the op but has no gesture —
the corpus's slurs carry it and the renderer honours it, so a trace can reproduce
them, but choosing a side by keyboard is presentation work, not structure.

Slurs spanning a *system break* or a repeat jump (`crossJump` ties) are written
faithfully but are not addressable as ranges — the same measure-span limitation
item 7 recorded for `ending.duration`.

## Open questions

- Should the pending anchor render as ink (a dotted line from the anchor to the
  cursor)? The overlay vocabulary exists (`elements/enclosure.ts`), but this item
  ships only a text readout in the edit strip (“slur from <note>…”); the
  ghost-line question belongs with the ladder's enclosure work.
- `lv` ties have no target at all, so they are a one-ended "spanner". They are
  included here because they are ties, but they need no gesture — worth noting
  that the family is not uniformly two-ended.
