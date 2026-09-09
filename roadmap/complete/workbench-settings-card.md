# The settings card, re-cut — glyphs, one control column, hover parity with the zoom pad

> **Status: BUILT 2026-09-09.** All five stages landed in one commit —
> `src/workbench/SettingsPad.ts` rewritten, `harness/verify/unrolled-smoke.mjs` moved
> onto the new REPEATS field. `ScenarioPage` needed no change at all: the pad's
> property and event surface is unchanged, which is the clearest evidence the re-cut
> stayed inside the component. 1614 tests pass, `check:scenarios` OK, `npm run build`
> green, and `git diff -- scenarios/` clean after `update:primitives`.
>
> **Verified hands-on over CDP in a real browser, 38 assertions, both themes.** The
> mark measures **24×24 in a 44×46 hit area** and sits level with the crosshair; the
> header cell lands **exactly** on it (935,76 both) and the card's ink edge where the
> zoom pad's is (both y=74); all nine controls share **one width, 131.3px**; a list
> matches its field's box and keeps the card open under it; Escape closes the list,
> then the card; preferences survive a reload; REPEATS writes and clears `?unrolled=1`;
> a stringless document greys TAB and BOTH with the reason in the tooltip; the dark
> half resolves with no baked-in colour, the TAB glyph's knock-out included. No
> console errors.
>
> Workbench chrome only: `src/workbench/SettingsPad.ts`
> and the one line in `ScenarioPage` that mounts it. No engine, no model, no goldens,
> nothing the embed face ships. **Design canvas:**
> [Settings Card](https://claude.ai/code/artifact/45c8488d-08d4-4971-bdaa-577fe553b627)
> — page *Controls* holds the chosen direction (Main, in the score corner; Option D with
> its list open; the hover-poses board), page *Earlier sketches* holds the five
> directions it beat and the card as built today.
>
> Continues [core-display-settings.md](../complete/core-display-settings.md) (which
> filled the card) and the zoom pad's footer fold of 2026-09-09 (which emptied it of
> layout levers). Follows the shared contract of
> [core-campaign-modernist.md](../complete/core-campaign-modernist.md), whose item 9 is
> the zoom pad this card is being brought into line with; not indexed there.

## What the build changed about the plan

Four corrections, each of which the plan could not have known:

1. **The `renderedExpanded` touch gate was not owed.** Stage 3 planned to copy it from
   the zoom pad. That gate exists because the pad's arms are in the DOM in *both* poses,
   so a first touch can operate a control the reader cannot see. This card renders no
   fields until it opens, so first contact has nothing else to hit. Not copied, and the
   component says why.
2. **A bare mark flush to the cluster's top edge rides two pixels high.** The crosshair
   beside it sits INSIDE the zoom pad's 2px border, so its 24px glyph box starts two
   pixels down. The plan's "the mark stays in flow as a 24×24 cell" would have left the
   two neighbours misaligned by exactly that border — measured, not guessed, and only
   visible because the marks are 5px apart. The mark takes the offset and the card takes
   it back in its own `top`/`right`, so its border lands where the zoom pad's does.
3. **Handing focus back to the trigger has to happen BEFORE the list is dropped.**
   Closing first destroys the focused item, which fires `focusout` with a null
   `relatedTarget` — and the existing focus-out rule then takes the whole card down.
   Every list selection would have closed the card.
4. **`sharedChrome`'s `row-current` tint loses to a `background` declared here.** Same
   specificity, and the component's block is composed after it, so `background:
   transparent` on the list item silently won and the chosen value was marked by its
   accent bar alone. The primitive is reused by NOT declaring the property.

A fifth correction is about the plan's own reading of the code: `data-off` compares
against `DEFAULT_DISPLAY_PREFERENCES`, not against `normalizeDisplayOptions({})`. The
host supplies defaults for `barNumbers` and `instrumentNames` — the plan's "which have
no default" was true of the engine's normalizer and false of the preference store the
card is actually handed.

## The five decisions, taken at the design pass

The canvas explored three glyph placements and four control shapes. What survived:

| # | Decision | Rejected, and why |
|---|---|---|
| 1 | **The first row is STAFF**, not SHOW. It chooses which staff kinds are drawn — notation, tab, both — and that is what the word names. | *Show* named the verb the whole card performs. *View* is the URL's word for the same choice (`?view=`) and the URL keeps it; the row does not have to repeat it. |
| 2 | **A glyph sits beside each value word** — a small picture of the *result*, with the word kept for the reader who does not trust the picture. | Glyph on the title (A): names the thing, never shows what SHOW or HIDE will do. Glyph instead of the word (C): SHOW/HIDE pairs read only by a slash; EVERY BAR vs EVERY SYSTEM is a guess until hovered. |
| 3 | **One control per row, all the same width**: glyph · the value in force · a trailing mark that says what a click does. A **two-way row** trails **swap arrows** and a click flips it — the zoom footer's spacing toggle, generalised. A **three-way row** trails a **chevron** and a click opens the list. | All options visible as words (B, today's shape): ragged widths, nothing lines up column to column. Equal-width cells (E): the card grows to ~520px and two-way rows leave an empty cell. One cycling cell (F): hides the other values on a three-way row. |
| 4 | **The mark idles like the crosshair**: a bare 24px gear at 0.28, no border, no shadow; 0.55 and accent when a setting is off default; on hover the card materialises *around* the gear, which becomes the card's top-right cell. | Today's bordered 26px square at 0.55 with a card dropped 6px below on a bridge — the one boxed mark left in the cluster since the focus toggle moved into the zoom footer. |
| 5 | **The Unrolled checkbox becomes a REPEATS row** — AS WRITTEN \| UNROLLED — a two-way field like the others, URL-driven like STAFF. | A checkbox in a card whose every other row is a tracked-uppercase option strip: a third vocabulary for one card. |

The card keeps its remit — *what* is drawn. Spacing mode and clearance stay in the zoom
pad's footer, where the *how* lives.

## Contract rules, answered before code

1. **Tokens over literals.** The canvas is authored in resolved light-theme values so it
   paints while streaming; every one maps to a name already in `tokens.ts`, and the
   implementation uses the name: `oklch(0.237 0.004 60)`→`--ink`,
   `oklch(0.397 …)`→`--ink-2`, `oklch(0.62 …)`→`--ink-3`, `oklch(0.754 …)`→`--ink-faint`,
   `oklch(0.887 …)`→`--line`, `oklch(0.807 …)`→`--line-strong`, `oklch(0.983 …)`→
   `--bg-context`, `oklch(0.611 0.225 31.5)`→`--accent` (and `--accent-fg` on text),
   `oklch(0.927 0.023 31.5)`→`--row-current`, `#ffffff`→`--surface`, the shadow pair→
   `--shadow-far`. The TAB pictogram's paper knock-out is `var(--surface)`, never `#fff` —
   the card sits on paper that goes dark with the theme. No new token is expected.
2. **Zero radius; rules via `--rule-w`.** The card's border and the header's bottom rule
   are `--rule-w` ink; row separators and the field's underline are 1px `--line` /
   `--line-strong`, the same weights the zoom pad's `.half + .half` and `.foot button`
   use.
3. **The embeddable surface is untouched.** `SettingsPad` is a `workbench/` leaf; nothing
   below the boundary changes, so `check:boundaries` and the goldens are gates in name
   only — but they run.
4. **Glyphs are drawn, never imported.** The cluster's rule: every mark is an inline `svg`
   template in the component file, 24-unit box, `currentColor`, stroke 1.6 with square
   caps (the focus and spacing glyphs' style). No icon set, no SMuFL font in the chrome.
5. **Selection-red stays separable.** The card puts accent on type and a 1.6-stroke glyph
   inside a bordered card — the zoom pad's form — not a stroked rect on the paper and not
   a filled disc.

## What is already there

`SettingsPad.ts` today: a `button.gear` (26px, bordered, 0.55) and a `.drop` that hangs
a `.card` from it; `displayRow()` renders a label plus an `.options` strip of
`<button aria-pressed>`; the STAFF row is hand-rolled because its options are `<a href>`
links to `hrefFor(view)` — **the URL is the single writer of the view**, and that
contract is kept; the Unrolled row is a bare `<input type=checkbox>` that dispatches
`unrolled-change`, which `ScenarioPage` turns into a `?unrolled=1` hash param. The
enter-to-open / leave-to-close / focus / Escape / click-away handlers already match the
zoom pad's and stay as they are.

`ZoomPad.ts` is the reference for the pose: one geometry, two states, transitions on
opacity, background, border and shadow only; `data-off` raises the idle floor to 0.55
and paints what changed in accent, scoped to `.pad:not(.expanded)` because the host
attribute outweighs the class; `renderedExpanded` gates gestures so that on touch the
first contact opens and the next one operates.

## Stages

Each stage lands on its own and leaves the card usable; order is by risk, the pose first
because it is the one that changes what the cluster looks like at rest.

### Stage 1 — the pose

- Replace `button.gear` + `.drop` with the zoom pad's grammar. The **mark stays in flow**
  as a 24×24 cell (so the crosshair beside it never moves), bare: no border, no
  background, no shadow, opacity 0.28, transitions matching `.pad`'s (0.12s opacity,
  0.16s the rest). Hit area follows the zoom pad's recipe — padding 10px, margin −10px —
  so the mark is catchable before it is legible.
- The open card is still absolutely positioned at `top: 0; right: 0`, but with **no
  bridge**: its header row's right-hand 24px cell is drawn exactly over the mark, so the
  card appears *around* the gear. Header: the word SETTINGS in the `.lbl` voice on a
  `--bg-context` ground, the gear cell with a 1px `--line` left edge, a `--rule-w` ink
  rule beneath — the readout / footer vocabulary of the zoom pad.
- **Off default** sets a host attribute `data-off`, exactly as the zoom pad does, and
  means: any `display` key whose value differs from `normalizeDisplayOptions({})`'s (for
  `barNumbers` and `instrumentNames`, which have no default, *any* set value), or
  `unrolled`. The view is excluded — the paper itself shows which staff is drawn, and the
  URL owns it. Idle-off-default: opacity 0.55, the gear in `--accent`. Scope the rule to
  the idle pose, for the specificity reason `ZoomPad.ts` records.
- Mirror `suppressed` if the host ever passes it; today `ScenarioPage` sets it on neither
  pad, so this is a property with a rule, not a wire.
- Reduced motion: `transition: none`, as the zoom pad.

### Stage 2 — one grid

- The rows become a single CSS grid, `grid-template-columns: max-content max-content`:
  label column, control column. Rows are 26px, separated by a 1px `--line` rule drawn on
  the row's top edge (never the first). The `.lbl` voice is unchanged.
- The control column is sized by the grid, **not by a magic 156px**: every field is
  `width: 100%` of the column, and the column takes the widest field's `max-content`, so
  all nine controls are one width by construction and Archivo's fallback metrics cannot
  break the alignment. The canvas's 156px is what that measured to in Archivo at 10px /
  0.11em with CURRENT VERSE as the widest word.
- The STAFF row is renamed. `aria-label` on the group follows.
- `.card` drops `overflow: auto`. It exists for a 540px cap the nine-row card
  (≈ 24 + 9×27 + help ≈ 330px) never reaches, and it would clip a list opened from a low
  row. Keep `max-height`; if a viewport ever shrinks the card past it the *page* scrolls,
  which is the same outcome the zoom pad has.

### Stage 3 — the field

One render helper, `field()`, for all nine rows, in two kinds:

- **Two-way** (time signatures, clefs, title, beams, repeats): a `<button>` carrying the
  glyph of the value in force, its word, and the swap-arrows mark. `title` and
  `aria-label` say what the click does — *"Clefs: shown — click to hide"*. Click
  dispatches `display-change` with the other value (`unrolled-change` for repeats). No
  `aria-pressed`: it is not a pressed state, it is a two-valued setting, and the label
  carries both values.
- **Three-way** (staff, lyrics, bar numbers, instrument names): a `<button
  aria-haspopup="listbox" aria-expanded>` with glyph, word and chevron. Click opens a list
  positioned under the field, **inside the card's DOM** — which is what keeps the card
  open under it: `pointerleave` fires on the host's outer element and the list is a
  descendant, so no new holding logic is needed. The list is `role="listbox"` with
  `role="option" aria-selected` items, each glyph + word, the current one on
  `--row-current` with a `--rule-w` accent left edge (the `.row-state.row-current`
  primitive from `sharedChrome`), the rest in `--ink-2`.
- **STAFF's list items are `<a href>`**, not buttons, exactly as the row's options are
  today — deep links, middle-click and history keep working, and the URL stays the single
  writer. A view the document cannot offer stays in the list greyed (`--ink-faint`,
  `cursor: help`) with the *"needs known strings"* tooltip: the existing `.off` rule,
  moved into the list.
- One list open at a time; it closes on selection, on Escape (first Escape closes the
  list, the second the card), on click-away, and whenever the card closes. Arrow keys
  move within the list, Enter selects; the existing `keydown` `stopPropagation` keeps
  these keys off the page's window listener.
- Touch: adopt the zoom pad's `renderedExpanded` gate so the first contact opens the card
  and the next one operates a field.

### Stage 4 — the glyphs

Twenty-two `svg` templates in `SettingsPad.ts`, all from the canvas: one per value,
none per row — the chosen shape carries the picture in the field, so the label column
stays words. Every HIDE is its SHOW glyph plus a slash (`M4 20 20 4`,
stroke 1.8), so the pair reads as one drawing and its negation.

| Row | Value glyphs |
|---|---|
| Staff | five lines · six lines with a fret-number knock-out · a five-over-four stack |
| Repeats | thick-thin barline with two dots · the same bar opened out, with the endings' brackets |
| Lyrics | note over three text lines · note over one · note over one, slashed |
| Time signatures | the common-time C · slashed |
| Clefs | an F clef (the one clef that draws honestly at 12px) · slashed |
| Title | a heavy centred rule over two light ones · slashed |
| Bar numbers | two barlines each with a numeral · one numeral at the system's start · slashed |
| Instrument names | two systems each with a name stub · only the first named · slashed |
| Beams | two beamed stems, beam slanted · beam flat |

Rendered at **14px**, not the 12 the canvas used, and the STAFF family redrawn at 4/5/3+3
lines rather than the honest 5/6/5+6: at this size a 24-unit box gives 0.58px per unit,
so a real staff's 3.5-unit gaps close into one grey block and all three views draw the
same smudge. The count was never what told them apart — the gap, the fret block and the
two groups are. Checked at 6× on the open list, which is the one place all three are
seen together. The mark itself is drawn at **24px**, not the 16 it used inside its
retired border: without that box the glyph IS the mark, and it has to carry the same
presence as the 24px crosshair.

### Stage 5 — the repeats row

Replace the checkbox with a two-way field, REPEATS: AS WRITTEN | UNROLLED. Same
`unrolled-change` event, same `?unrolled=1` handling in `ScenarioPage`; the only host
change is that the property is now read for `data-off`. **`harness/verify/unrolled-smoke.mjs`
clicks the checkbox** (`input[type=checkbox]` in the pad's shadow root, line 71) to prove
the toggle updates route and viewer, so it moves to the REPEATS field's button in the
same commit — it is the one automated check the card has, and it must stay green.

## Verification

The workbench has no unit tests by rule, and the card owns no state worth one. The
recipe is the zoom pad's: **hands-on over CDP in a real browser, both themes**, recorded
in this doc's status block above. The checklist, all of it green:

- Idle: the gear measures 24×24 inside a 44×44 hit area, no border, opacity 0.28; the
  crosshair beside it has not moved by a pixel from today's position.
- Off default (hide lyrics, reload): 0.55, gear in accent; reset, back to 0.28.
- Hover: the card appears with its header cell over the gear; leaving closes it; a list
  open at the moment of leaving closes with it.
- All nine controls share one width; a 3px-narrower window does not change it.
- Two-way: click flips, the label and glyph swap, the preference survives a reload.
- Three-way: click opens, item click selects and closes, Escape twice closes list then
  card, arrows move, Enter selects; STAFF's items are links and middle-click opens a
  new tab on the right view; a stringless document greys TAB and BOTH with the tooltip.
- Repeats: UNROLLED writes `?unrolled=1`, AS WRITTEN removes it, back/forward restore.
- Reduced motion: no transitions.

Gates as always: `npm test`, `npm run check:scenarios`, `npm run build`, and a clean
`git diff -- scenarios/` after `update:primitives`, trivially — nothing under `engine/`
moves.

**Left undone, deliberately:** the CDP pass was driven by a throwaway script, not a
committed one. `harness/verify/unrolled-smoke.mjs` already opens the card and clicks the
REPEATS field, so the row's behaviour has committed cover; the geometry the pass
measured — the 24×24 mark level with the crosshair, the header cell on the mark, one
control width — does not. A `settings-card-smoke.mjs` in that directory is the obvious
home if this alignment ever regresses.

## Out of scope, named so it is not done by accident

- Moving the two help paragraphs into tooltips. They stay as they are.
- Any change to `?view=` naming, `hrefFor`, or `displayPreferences.ts`'s storage shape.
- A settings card in the embed face or in studio — the card is workbench chrome.
- A dark-theme re-cut of the glyphs: they are `currentColor` and need none.
