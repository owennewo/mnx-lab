# Part declarations — the half of every genesis verb that was missing

> **Status: built 2026-08-14, same day as proposed.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md), item 13, taken at
> a **narrower scope than its index row**, which the numbers rather than taste
> chose. The row's real subject — parts, voices and staves *beyond the first* —
> becomes item 13b.

## Why this slice

The destruct report's biggest remaining `no-op` counts are not exotic: they are
the part's own declarations, sitting unremovable because **every genesis verb
shipped without its other half**.

| kind | elements | construct verb | destruct verb |
|---|---|---|---|
| part-name | **59** | `addPart` (item 1) | — |
| strings | 21 | `setTuning` | — |
| staff-kind | 20 | `setStaffKind` (item 1) | — |
| staves | 5 | — | — |
| capo | 1 | — | — |

Item 1 built genesis in a hurry because construct traces needed it; items 5, 7,
8, 10 and 11 have since established that **a verb without its pair is half an
element**. This closes them, which moves 106 elements and takes the campaign's
`no-op` column down to its genuinely hard remainder.

The index row's own subject — a *second* part, voice or staff — requires the ops
layer to stop assuming `parts[0]` (`findKeyedNote`, `buildGrid` and the note-key
traversal all hard-code it), and that changes note keys, which the primitives
goldens embed. That is a corpus-verification event, not a refactor, so it earns
its own item with its own decision about re-approval.

## The agreement block

### 1. The op pair — one, because they share an owner

Item 7's test again, and this time it says collapse: `name`, `staves`, and the
vendor block's `strings`, `capo`, `tab.staffKind` are all **keys on `parts[0]`**.

```
setPartDeclaration    {declaration}   // capo and staves; a typed union
removePartDeclaration {kind}          // all five
```

The existing setters stay as they are. `addPart` still writes the name,
`setTuning` the strings, `setStaffKind` the kind — churning them would rewrite
recorded traces for no gain, and the campaign's rule is that **traces are the
regression surface**, not a thing to disturb for symmetry. So this item adds the
two missing constructors (capo, staves) and the five missing removals.

**Removal class: annotation** for all five, with one consequence worth stating:
removing `strings` removes the fingerboard, so a tab-projecting part stops having
a tab view at all. That is correct — no instrument is ever assumed — and it is
why the sweep's oracle set includes "no new diagnostics": a part that loses its
strings while declaring `staffKind: tab` must degrade, not crash.

### 2. The shortcut — the part popover, `Shift+P`

The popover that creates a part is where you change one. Its grammar grows:

```
capo 3 · staves 2                       (the two new setters)
no name · no strings · no capo · no tab · no staves
```

`no tab` reads better than `no staff-kind` and matches what a player would say.
Removal keeps item 7's `no <thing>` token, now on its third family.

### 3. The rung — score

Part declarations attach at the **score** rung, where item 1 put genesis. A part
is not a rung of the ladder (the HUD's part row is an address, not a level), so
the score rung is where "this part's declarations" live.

### 4. The evidence

- **Destruct**: 106 elements (part-name 59, strings 21, staff-kind 20, staves 5,
  capo 1) move `no-op` → `removed`.
- **Construct**: 2 scenarios are blocked only by `staves` (`spec/grand-staff`,
  `lab/score-text/directions-multi-staff`), so reachable goes 68 → 70. The other
  declarations already had constructors, so this half of the item buys removals,
  not reach — which is exactly the asymmetry the campaign opened on.
- Goldens byte-identical throughout.

## What the build measured (2026-08-14)

- **Removable elements 912 → 1003** (part-name 46, strings 21, staff-kind 20,
  staves 3, capo 1) and **reachable scenarios 68 → 71**. The 13 `no-op`
  part-names and 2 `no-op` staves are second parts — item 13b's subject, reported
  rather than hidden.
- **The oracle refused the first version of this item, twice, and was right both
  times.**
  1. Removing `strings` from a tab-projecting part left it declaring a view it
     could not draw: *"diagnostics 0 → 2"*. The fix is a **declared cascade** —
     the fingerboard and the preference to show it are one decision, so
     `staffKind: tab|both` leaves with the strings (`notation` survives, since it
     needs no fingerboard).
  2. Then the no-tombstone cleanup itself read as damage: emptying `_x.mnxLab`
     collapses `_x` too, two levels above the element. The surviving-document
     oracle grew the **ancestor collapse** rule — a vanished key is excused only
     when it is the very segment the element sat under, walking the element's own
     ancestor chain, so a *sibling* can never be excused by it.
- Both are the campaign's method working as designed: the sweep is not a report on
  the ops, it is a constraint on them, and it made this item's semantics sharper
  than the proposal's.

## Scope boundary

`layout`, `score` and `multimeasure-rest` (26 elements, 5 scenarios) stay
unbuilt: a layout is a *tree* of staff and group nodes and a score is a
*presentation* with page and system breaks. Neither is a declaration, and both
want a grammar this popover should not grow. They go to item 13b with parts,
voices and staves beyond the first, where the structural surface is the subject
rather than a side effect.
