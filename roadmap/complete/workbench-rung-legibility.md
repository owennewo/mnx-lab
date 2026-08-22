# Rung legibility — knowing which mode you are in without moving your eyes

> **Status: COMPLETE 2026-08-22 — all three phases built.** Phase 1 (the rung
> chip, 2026-08-20) and phase 2 (the extent ladder on both axes, same day) are
> below. Phase 3 settles the bar-vs-section pair: the section rung **lights the
> label**, and the re-examination the item was held open for is recorded there.
> Owes one first approval — `lab/score-text/one-bar-sections`, registered in
> [lab-verify.md](../inprogress/lab-verify.md) — for a scenario authored to exercise the
> degeneracy; no existing golden moved.

## The problem

The enclosure vocabulary ([core-selection-ladder.md](core-selection-ladder.md))
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

A small bordered word in the score pane, named by `ROW_BY_LEVEL` (exported
from `hudRows.ts` so the mapping stays single-sourced). Full opacity on every
rung change (including selection-appears), settling after ~1.2s; dimmed when
the keyboard is elsewhere, following the enclosure's own inactive fade;
hidden while deselected (no anchor exists).

**Revised same day — the chip is the tray's collapsed handle.** The first
build planted it above the selection as read-only chrome (`role="status"`,
`pointer-events: none`). Hands-on review moved it **below the selection's
left edge — exactly where the tray opens — and made it a button: clicking
the chip is the `/` key** (one `openTray()` door shared with the shell
intent, so the projection-follow rule cannot fork). It flips above by the
tray's own room-below test, using a conservative height estimate — the tray
measures itself live, so the two can disagree only in a band a few pixels
tall, and the chip is always on the side the tray has room to expand into.
Hidden while the tray is open: the chip has *expanded into it*. This is the
one deliberate exception to "chrome never takes the pointer" — a small box,
usually over inter-system whitespace, with hover/focus raising it to full
strength; the rung announcement stays on a polite live region.

## Phase 2 — the extent ladder on both axes (BUILT 2026-08-20)

The original phase 2 (capsule styling, painted barlines) was replaced in
review by a stronger scheme: **horizontal extent climbs the ladder too**,
using the vocabulary's primary channel — extent — instead of styling
refinements. The rule:

| Rung | Vertical | Horizontal |
|---|---|---|
| voice | **notehead contour** (no staff-band floor) | its noteheads' span |
| part-bar | staff band ∪ ledger ink (unchanged) | **its music's span** — first glyph to last |
| bar | the system's full slot (unchanged) | **the full cell** — barline to barline, through them |

Because of the full-bar invariant every beat is a note or a rest glyph, so
the part-bar's ink span differs from the bar cell by exactly the **leading
clef/key/time gap and the trailing justification gap** — the bar owns its
furniture, the part-bar owns its music, and the bar becomes the *first*
full-width rung. Implementation notes:

- The run hull reads **noteheads/fret-numbers only** — stems and beams carry
  the event-level `.selected` class and used to inflate it — and the deeper
  culprit, the staff-band floor in both the ink path and the structural-span
  path, is removed. Empty/rest-only voice copies hug nothing: a slim
  mid-staff band, inset from the cell, is the honest "this voice, nothing in
  it" shape. `previewGlyphs` mirrors the filter so the tray's scope preview
  cannot disagree.
- **Vertical monotonicity is deliberately traded at the event→voice hop**:
  the staff-height event slice relaxes into a shorter, longer hull. The axis
  carries the meaning — *a moment is tall, a run is long* — and horizontal
  growth still signals the widening. The tween morphs it fine.
- **Accepted dissonance:** clefs are part-measure properties, yet the
  part-bar box now excludes the clef it owns. Differentiation beat taxonomy.
- The both-view landmark survives: the part-measure echoes still merge into
  ONE rect spanning the notation+tab pair — it is simply ink-span wide.
- Settled in phase 3 below: **bar vs section**. The voice-rung "dim the other
  voices" idea stays parked as an option if the hull alone proves insufficient.

## Phase 3 — the section rung lights its label (BUILT 2026-08-22)

The re-examination this item was held open for, and it began by finding that
two of the three channels the pair was supposed to rest on **did not exist**.
The ladder doc specifies the section rung as *"the band stretches over the
range, label chip lit, tinted with the section's own `color`; outside dims"*
(core-selection-ladder.md). Only the band was ever built: nothing reads
`MnxMeasureLabel.color` for the enclosure, and there is no scope dimming
anywhere (`ScoreViewer`'s only dim is the unrelated focus-inactive fade). So
the pair rested on **extent alone**.

Extent is the wrong channel for it, and not by a little:

- Where a section is several bars long, extent already separates the pair
  comfortably — no work needed.
- Where a section is **exactly one bar**, the two enclosures are *identical*:
  same `panel-wide` kind, same single rect, same geometry. Nothing to read.
- Growing the section's box to reach the label does not help, because the
  bar's box **already contains it**. `panel-wide` deliberately takes the
  system's whole vertical slot, *"the strip where the bar's own
  tempo/rehearsal marks sit"* — and score-wide labels stack in that same
  strip. Taking the strip away from the bar would break a real ownership
  claim: a bar owns its rehearsal mark and its tempo.

So the channel is not the box. **It is the label.** The section name is what
makes a section a section, and lighting it is the one signal that does not
degenerate with the section's length — it reads identically at one bar and at
twenty. It is also the ladder's own unbuilt promise rather than a new
invention, and the cheapest of the three: the emitter already tags the label
`section-label`, and `elementWalk` already names that class for the `section`
element, so the selector is single-sourced and needed no new data.

- **A chip behind the label**, not a restyling of it: the label's ink is
  already at full strength, so "lit" has to be additive. It is drawn as the
  **cap box** the emitter drew (`SCORE_LABEL_CAP_RATIO`, now exported), so it
  lines up with a rehearsal mark's own box beside it instead of floating half
  a space low the way a text bounding box would put it.
- **Its own layer** (`g.enclosure-label`), inserted so it paints *over* the
  0.06 panel-wide wash and *under* the ink — the name it lights stays
  readable. Not the enclosure group, because the tween pairs that group's
  rects by index and a chip present at one rung and absent at the next would
  morph into a wash rather than appear.
- **Claimed by the label's ANCHOR**, not its box (`sectionLabelChips` in
  `selectionGeometry.ts`, the pure half, tested). A long name overhangs its
  cell on purpose — `emitScoreLabels` says so — and a box-containment test
  would drop exactly the sections whose names are worth reading.
- **A flag, not a kind** (`SelectionContext.litLabels`, set by
  `LIT_LABEL_LEVELS` in the workbench). The shape genuinely does not change;
  inventing an eighth `EnclosureKind` for a rung that draws the same rect
  would put an editor distinction into the shape vocabulary. The host decides
  which rung claims labels, `elements/` renders it — the same division
  `enclosure` itself already follows.
- **Only the section rung claims them.** A bar owns the rehearsal mark and
  tempo in that strip; if the bar lit labels too, the channel would say
  nothing. Rehearsal marks are never lit — they index a bar, not a section.

**Verified over CDP** on the new scenario, climbing the ladder with
Shift+↑: at `bar` and at `section` the enclosure is byte-for-byte the same
shape — `enc-panel-wide`, one rect — and the chip count goes 0 → 1. That is
the degenerate case reproduced and separated.

**Corpus:** `npm run update:primitives` came back **clean** — the item's
"not a renderer change" claim holds, every existing golden untouched. One
scenario added, `lab/score-text/11-one-bar-sections` (four bars, each its own
section), because nothing in the corpus exercised the case: all three existing
section scenarios use two-bar sections, where extent already works and the
degeneracy never appears. Its first approval is registered in
[lab-verify.md](../inprogress/lab-verify.md).

## Not this

- **Not a renderer change** — enclosures and the chip are overlay/chrome;
  every golden is untouched by design.
- **Not the tween's job.** The tween teaches transitions; this item is about
  steady state. No new animation beyond the chip's opacity settle.
- **Not a second naming scheme.** The chip displays `ROW_BY_LEVEL` verbatim;
  a rung rename happens there or nowhere.
