# Tab technique — the reserved letters, and one key that reads the music

> **Status: built 2026-08-14.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md), item 9 — the
> entry half of [core-guitar-technique.md](../proposed/core-guitar-technique.md),
> which owns the drawing and remains a renderer gap.

## The agreement block

### 1. The op pair

| | construct | destruct |
|---|---|---|
| technique | `setTechnique {noteKey, technique}` | `removeTechnique {noteKey, kind}` |
| fingering | `setFingering {noteKey, hand, finger}` | `removeFingering {noteKey}` |

Fingering joins technique here because it is the other note-level vendor
annotation and shares its owner, its rung and its removal — item 7's test again.

**Removal class: annotation** (strip the key, and the emptied vendor containers
go with it, all the way up `tab` → `mnxLab` → `_x`), except `hammerOn`,
`pullOff` and `slide`, which are **references** — they name the note they travel
to, so `setTechnique` mints that note's id exactly as `toggleTie` does, and
`deleteNote`'s cascade (item 2) already unlinks them.

A bend is written as a **curve** (`points` in semitones), never a single
interval — the shape core-guitar-technique.md settled after flattening lost
information. The keyboard writes the common one: straight up a tone across the
note.

### 2. The shortcut — the reserved letters, live only in the tab pane

`B H S V X O`, reserved by the campaign since it opened, and the collision item
10 flagged dissolves without a conditional anywhere: **the letters live in the
tab *pane layer*, and pane layers resolve before shared ones**. So `B` bends in
tab and beams in notation; `S` slides in tab and slurs in notation. The keymap
already had the mechanism; item 10 named the principle; this item is where the
two meet.

**`H` is one key for two techniques, and the music picks**: hammer-on when the
next note is higher, pull-off when it is lower. That is not a shortcut, it is
what the words mean — you hammer *up* and pull *off* downward — so offering two
keys would ask the player to name something their fingers already decided.

### 3. The rung — note

Every technique attaches to the note under the cursor.

### 4. The evidence

- **Destruct**: 19 elements (technique 12, fingering 7) move `no-op` → `removed`.
- **Construct**: 7 scenarios were blocked only by these two kinds — the five
  `lab/tab-techniques` documents and both `lab/tab-fingering` ones. Reachable
  scenarios 71 → 78.
- Goldens byte-identical: nothing here draws yet, which is the renderer gap
  core-guitar-technique.md owns.

## The string annotation's missing half (2026-08-14)

Audited after item 5's time-signature oversight, the kind table showed one more
unfinished pair: `setFret` wrote a note's string choice and nothing stripped it —
34 elements.

`removeStringAnnotation` closes it, and the model's own rule decides the
semantics: **the string is the choice, the fret its consequence**
(roadmap/proposed/low-priority/spec-instrument-position.md), so the fret leaves with it
rather than surviving as a fret belonging to no string. The note falls back to
the derivation ladder, which is instrument neutrality read from the other
direction — removing the annotation does not remove the tab, it returns the
choice to the renderer.

The surface is the adornment popover's `no string`, on the same reasoning item
11 used for the bar popover: a popover is a surface, not a data-owner, and the
note-level annotations belong together whatever object holds them.

**34 removed; the corpus reaches 1,218 removable elements — and the kind table
now has no rows with a construct verb and no removal.** Every remaining `no-op`
is a kind with no verbs at all, which is honest ground rather than an oversight.

## Scope boundary

The bend's curve is written in its simplest form; authoring a multi-point bend
(pre-bend, release, the shapes `bend-and-release` carries) needs a curve editor,
not a key. Harmonics are written `natural`; the artificial/pinch/tap variants
need the popover grammar this item deliberately did not open, since the six
letters cover what a player reaches for.
