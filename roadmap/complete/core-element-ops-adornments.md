# Event adornments — markings, dynamics, directions

> **Status: built 2026-08-14, same day as proposed.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md), item 8.
>
> Three kinds that all read as "something attached to this moment", and the first
> item where the campaign's own family test says **do not collapse them**.

## The agreement block

### 1. The op pairs — two, because the owners differ

Item 7 collapsed ten kinds into one verb because they were all *a key on the
global measure*. Applying that test here splits the three:

| owner | kinds | construct | destruct |
|---|---|---|---|
| the **event** | `articulation` (`markings.*`) | `setMarking {noteKey, marking}` | `removeMarking {noteKey, marking}` |
| the **part measure** | `dynamic`, `direction` | `setPositioned {measureIndex, onset, attribute}` | `removePositioned {measureIndex, kind, index}` |

Markings are boolean-ish keys on the event itself (`{"staccato": {}}`). Dynamics
and directions are *positioned entries in part-measure arrays*, carrying a
`position.fraction` — so they share an owner, a shape and a removal, and they
collapse together. Forcing all three into one verb would have meant a payload
whose owner depended on its own discriminant, which is the shape item 7 warned
against.

**Removal class: annotation** for all three — strip the key or splice the entry,
delete an emptied `markings`/`dynamics`/`directions` container with it, no
tombstones.

### 2. The shortcut — one adornment popover, `Shift+A`

The index pencilled in "adornment alphabet (letter keys)". **Deferred, deliberately.**
Single-letter accelerators are worth having for the two or three marks a player
uses constantly, but claiming eight letters now — while `B`, `S`, `T` are already
spoken for and `H V X O` are reserved for item 9 — would spend the campaign's
scarcest budget on the least-settled vocabulary. The ops are what later items
build on, and the input layer's standing rule is that **keys are the unstable
layer**: an accelerator pass can bind them later without touching a single op or
trace.

So: one typed popover, first word names the adornment.

```
accent · staccato · tenuto · marcato · staccatissimo · spiccato · stress · breath
f · mf · pp · ffff              (a bare dynamic word is a dynamic)
text Play 8x · text cantabile   (a direction)
no accent · no dynamic · no text
```

Dynamics and directions land **at the cursor's onset**, not at the bar start —
the first family in this campaign whose attributes are positioned *within* a
measure, which is why they take the cursor's position rather than just its index.

### 3. The rung — note (markings) and event (positioned)

A marking attaches to the event under the cursor's note; a dynamic or direction
attaches to the cursor's *moment* in the part. Both are reached from where the
cursor already is, so nothing new is asked of the ladder.

### 4. The evidence

- **Construct**: 13 scenarios are blocked only by these three kinds — the
  articulation set, the three dynamics documents, and four `score-text/directions`
  scenarios. Reachable scenarios 55 → 68.
- **Destruct**: 70 elements (dynamic 43, articulation 14, direction 13) move
  `no-op` → `removed` under the six oracles.
- Goldens byte-identical throughout.

## What the build measured (2026-08-14)

- **Reachable scenarios 55 → 68** (the predicted +13, exact) and **all 70 elements
  removable** — dynamic 43, articulation 14, direction 13, no `broken` verdicts.
- **The two-pair split was right, and the sweep is where it showed.** Markings are
  removed through their note (like ties and slurs); dynamics and directions needed
  a **two-coordinate address** — bar *and* onset — which is new: every earlier
  attribute was reachable by measure index alone. `ElementRef` grew `onset` for
  exactly this, and the walk drives `nextPosition` until the cursor's moment
  matches before firing the verb.
- **The popover reached five kinds across three owners without growing a limb**,
  which is the payoff of item 7's table refactor: `POPOVER_SPECS` gained a row,
  the grammar gained a branch, nothing else moved.
- Single-letter accelerators stayed deferred, and the ops do not care — the trace
  format records intents, so binding `A` to accent later changes no fixture.

## Scope boundary

`type` on a dynamic (`immediate`/`gradual`/`relative`/`accent`) is written as
`immediate` for a plain mark; hairpins (`wedgeType` + `end`) and accent groups
(`accentPrefix`/`residualValue`) are settable by the op but have no grammar —
they need a span gesture and a compound grammar respectively, and
`lab/dynamics/hairpin-and-relative` is a renderer gap besides.

`orient` and `staff` on a direction default to the renderer's choice; picking
them is presentation, like item 10's slur `side`.
