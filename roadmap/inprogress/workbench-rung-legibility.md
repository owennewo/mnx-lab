# Rung legibility — knowing which mode you are in without moving your eyes

> **Status: proposed and phase 1 built 2026-08-20.** The rung chip is live in
> the workbench (details in the phase 1 record below). Phase 2 — the three
> geometry sharpenings — is open.

## The problem

The enclosure vocabulary ([core-selection-ladder.md](../complete/core-selection-ladder.md))
encodes the selection rung in two channels: **extent** (grows monotonically)
and **fill/border ratio** (fades as the level widens). Both are *relative*
channels — they are read by comparison against the shape just left. The 180ms
relax/tighten tween teaches transitions well, but nothing teaches **steady
state**: glance at a static screen and "translucent band around the staff"
could be the voice, part-bar or bar rung.

Worse, the geometric distinctions **degenerate in the most common documents**,
and the three rungs users actually confuse are exactly the three degeneracies:

- **voice vs part-bar** — in a single-voice bar the voice run hull ≈ the
  part-measure staff band;
- **part-bar vs bar** — in a single-part score the system slot ≈ the staff
  band (the vertical difference nearly vanishes);
- **bar vs section** — they *share* `panel-wide` by design, distinguished
  only by extent, outside-dimming and the section's own colour.

The ladder doc already named the missing channel: *"A persistent level chip
('Verse 2 · Bar 12 · Voice 2 · note') is the redundant, colorblind-safe,
screen-reader channel."* The HUD rows carry the level, but in the side panel —
away from the gaze point. This item builds the promised chip **at the
selection itself**, then sharpens the three degenerate geometries so the chip
is needed less often.

## Decisions

- **The chip is the certainty channel; geometry improves the odds.** Neither
  substitutes for the other. The chip gives an unambiguous read at the gaze
  point; the geometry work reduces how often anyone reads it.
- **Words, not initials.** `n`/`e`/`v` need decoding; "voice"/"bar" are
  self-teaching, and a chip has no space pressure. The words are
  `ROW_BY_LEVEL`'s — the HUD's own row vocabulary (score · section · bar ·
  part · voice · container · event · note) — so the chip, the HUD and the
  tray's tabs can never disagree about what a rung is called.
- **Transient-then-faint.** Full strength on every rung change, settling to a
  whisper (~0.4 opacity) after ~1.2s: scrubbing Shift+↑/↓ reads as a live
  level indicator; a settled screen stays quiet. `prefers-reduced-motion`
  drops the fade, never the chip.
- **Workbench chrome, not an element feature.** The chip rides the existing
  `selection-anchored` event (the tray shaft's anchor — already follows every
  render *and* scroll), so `elements/` learns nothing new and the boundary
  "elements knows shapes, never editor levels" holds. When the editor
  promotes ([core-editor-element-promotion.md](../proposed/core-editor-element-promotion.md)),
  the chip either travels with the mount or the promoted element grows a
  label slot — that item's call.
- **Rejected: a colour ladder.** Four strikes: the repo's own precedent
  distrusts colour-only signals (the rail dots use shape *as well as* colour);
  the hue budget is spent semantically (red = user error, blue = warning,
  amber = renderer gap, and section tints with its own user-assigned colour);
  eight distinguishable hues across `light-dark()` in both themes is a tuning
  tarpit; and even three hues for the trio just moves the problem to "what
  did teal mean again".
- **Rejected: border styles / textures.** Dashed is taken — ghosts mean
  *potential*, and that meaning is load-bearing. Dotted/double borders turn
  to mush at staff-space scale; hatched fills fight the notation.
- **Mostly rejected: scope dimming** (fade what the rung excludes). Honest
  but heavy — it interacts with the primary/echo asymmetry (echoes already
  sit at 40%) and makes the whole page pulse while scrubbing. Only the
  voice-rung slice survives, as a phase 2 item.

## Phase 1 — the rung chip (BUILT 2026-08-20)

A small bordered word in the score pane, planted at the selection anchor's
top-left corner (flipping inside the anchor when the system sits at the pane's
top edge). Named by `ROW_BY_LEVEL`, exported from `hudRows.ts` so the mapping
stays single-sourced. Full opacity on every rung change (including
selection-appears), settling after ~1.2s; `role="status"` so a screen reader
hears the rung change too; `pointer-events: none` — read-only chrome like the
clipboard notice, in the same visual voice (same border/surface/mono tokens).
Hidden while the tray is open (the tray already names the rung in its tabs and
meta line), while deselected (no anchor exists), and dimmed further when the
keyboard is elsewhere, following the enclosure's own inactive fade.

## Phase 2 — sharpen the three degeneracies (open)

All three stay inside the vocabulary's thesis — differentiation is geometry,
not styling systems — and none touches a golden (overlay only):

1. **voice vs part-bar: organic vs architectural.** The run hull becomes
   unmistakably ink-hugging — capsule corners, top/bottom edges following the
   event ink — against the panel's sharp-cornered staff band. Optionally, at
   the voice rung only, the *other* voices' ink dims one notch (the surviving
   slice of scope-dimming; the membership tint already exists).
2. **part-bar vs bar: barline ownership made visible.** `panel` stops inside
   the barlines; `panel-wide` passes through them. At the measure rung, paint
   the two barlines themselves full-strength as part of the enclosure — the
   bar *owns* its barlines, which is also the rung where barline/repeat
   commands live, so the cue teaches the command vocabulary. And guarantee
   `panel-wide` a minimum visible margin above/below the staff band in
   one-part scores, so "the slot" never collapses to "the band".
3. **bar vs section:** re-examine after 1–2 land; the section rung's
   outside-dim + lit label + own colour may already suffice.

## Not this

- **Not a renderer change** — enclosures and the chip are overlay/chrome;
  every golden is untouched by design.
- **Not the tween's job.** The tween teaches transitions; this item is about
  steady state. No new animation beyond the chip's opacity settle.
- **Not a second naming scheme.** The chip displays `ROW_BY_LEVEL` verbatim;
  a rung rename happens there or nowhere.
