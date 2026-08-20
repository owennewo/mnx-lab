# The selection command tray — the visuals

> **Status: COMPLETE 2026-08-15 — stages 1–4, same day as picked up.** The
> stage-4 hands-on review landed two visual revisions, both in the component
> only: **ink-box glyph normalization** — each tile glyph is drawn into an SVG
> whose viewBox is the glyph's own bounding box from the font metadata
> (`glyphBBox`, staff spaces, 1em = 4sp), scaled to a 34px target with a
> 30px-per-staff-space ceiling, because a palette normalizes optical size
> where a score must not (a staccato dot vs a repeat barline; Dorico's and
> Sibelius's palettes do the same) — and **the shortcut as a corner chip**
> (ink chip, bottom-right, inverting on active tiles) rather than a second
> row under the glyph, with tiles at 66×64 and grid gap 7. Verified again
> after the review in headless Chrome: all seven rungs, both variants, zero
> console errors; 555 tests green.
>
> Shipped by stages 1–3: `<mnx-selection-tray>`
> (`src/workbench/SelectionTray.ts`) with all six regions, the four tile
> reads, the value-rows variant, the in-component keyboard model and the
> shaft+plinth connector with flip-above and the docked fallback;
> `trayDemo.ts` demo sets for all seven rungs; the viewer's
> `selection-anchored` event **plus a `selectionAnchorRect()` method**, re-fired
> on the host's own scroll so the tray follows the paper; the tray/palette
> split in `SHELL_BINDINGS` (the shell dispatches a cancelable
> `mnx-tray-intent`; unclaimed, it falls through to the palette — so
> editorless pages still get a command surface). Shipped on Ctrl+K, rebound
> to `/` on 2026-08-15 (see below),
> with `KEY_DOCS` rows and the ops-panel palette label updated. Verified in
> headless Chrome over CDP: open-on-selection with the shaft planted on the
> enclosure, preview dot + "↵ to widen", the event scope's full glyph grid
> incl. the slur/tie arcs, the part rows variant, demo commit and flip,
> Escape close — zero console errors; all 542 tests green, goldens untouched.
> Deviations from the spec's mocks, recorded: our tab row holds seven rungs,
> not four, so tab padding is 9px (spec 13px) and the rows-variant width is
> 400px (spec 330); Archivo is not yet bundled (system-sans fallback — the
> open item below stands). First of a trio: this doc (the look, complete
> and unwired), [core-selection-tray-mechanism.md](core-selection-tray-mechanism.md)
> (state and actions through the intent funnel), and
> [core-selection-tray-residue.md](../proposed/core-selection-tray-residue.md) (what cannot be
> wired yet, and what unblocks each row).
>
> **Design provenance.** The visual spec is a Claude Design project —
> [Selection Palette](https://claude.ai/design/p/df26d61e-a908-4a91-900d-01c08f75499f),
> file `Selection Palette.dc.html` ("SPEC · v1 — selection command tray"); the four
> connector studies it was chosen from are kept in
> `Selection Palette explorations.dc.html`. This doc translates that spec into the
> repo's vocabulary; where the two disagree (the tab set, below) this doc wins and
> says why.
>
> Siblings: [core-selection-ladder.md](../complete/core-selection-ladder.md) (the
> rungs the tabs are), [core-campaign-element-ops.md](core-campaign-element-ops.md)
> (the verbs the tiles will fire),
> [core-editor-focus-scope.md](../complete/core-editor-focus-scope.md) (who owns the keystroke
> while the tray is open), [core-editor-element-promotion.md](../proposed/core-editor-element-promotion.md)
> (why it incubates in `workbench/`),
> [core-viewer-surface.md](core-viewer-surface.md) (the one
> element-surface addition it needs — that contract is now real, stages 1–5
> built 2026-08-14).

## What this is

`/` stops opening a document-wide list. It opens a **tray planted under whatever
is selected**, showing the commands that apply to *that* thing at *that* rung — drawn
as Bravura glyphs with their shortcut printed underneath and their current state
visible on the tile. Global commands still exist, one keystroke further away
(Ctrl+Shift+K). The tray is a **teaching surface, not a mode**: every command on it
keeps its own direct shortcut, live whether the tray is open or shut, and the tile is
where you *learn* the shortcut.

This first part builds the component whole — every region, every tile state, the
connector, the keyboard model inside it — fed by **demo data**, firing nothing. The
point of splitting visuals from mechanism is that the tray's look and feel can be
reviewed hands-on (the campaign's review posture) before any wiring argument starts,
and the component contract the demo data flows through is the same one the mechanism
will feed for real.

## The tab model: the ladder, not the design's four

The design shows four scope tabs — NOTE / EVENT / BAR / PART. The repo already has
the real axis: the selection ladder (`src/edit/selection.ts`), and the tray's tabs
**are the ladder's rungs**, labelled with the HUD's existing short vocabulary
(`hudRows.ts` `LEVEL_BY_ROW`), filtered by the presence rule (`presentLevels()`):

| Tab label | Ladder rung | Design's name | Notes |
|---|---|---|---|
| note | `note` | NOTE | |
| event | `event` | EVENT | |
| voice | `voiceMeasure` | — | not in the design; command set drafted below |
| part | `partMeasure` | PART | the design's part-config **rows** are the closure's properties surface, not a rung of their own — part is deliberately not a rung ([core-selection-ladder.md](../complete/core-selection-ladder.md)) |
| bar | `measure` | BAR | |
| section | `section` | — | present only when the document declares sections |
| score | `score` | — | |

Absent rungs (no sections declared, an empty measure with no note rung) render no
tab — the presence rule the ladder already computes; the tray never shows a tab the
ladder would skip. The `container` rung joins the row when the ladder grows it
(recorded in [core-selection-tray-residue.md](../proposed/core-selection-tray-residue.md)).

The tray opens on the tab matching the current selection level. Moving to another
tab is a **preview** — the tab highlights, a red dot marks the tab still holding the
real selection, and the score shows the previewed scope as a dashed outline; Enter
commits, Escape returns. In this visuals part the preview is tray-internal state
only (the dashed score outline is mechanism work, since it rides `SelectionContext`).

## Anatomy

Six regions, top to bottom, exactly as the spec draws them. One flat surface: 2px
ink border, **zero border-radius**, one drop shadow.

- **A · Shaft + plinth.** The connector: an accent shaft (width = the selection's
  width clamped to 24–240px, height 30px, centred on the selection's horizontal
  centre and clamped to the tray's span) dropping onto a **6px ink bar** the full
  tray width that the tray stands on. The tray's own top border is removed so plinth
  and border read as one rule. If there is no room below the selection, the tray
  flips above and the plinth becomes a capital on the tray's top edge, shaft rising.
  The tray re-anchors on any selection change and while the score reflows —
  **animate position, never fade**.
- **B · Scope tabs.** The ladder rungs, as above. `↑ ↓` move between tabs.
- **C · Meta line.** Names exactly what a command will hit, and how much of it —
  "Event 1 · bar 1 beat 1 — 2 notes · B3, B2 · quarter — 11 COMMANDS". The HUD's
  row values (`buildHudRows`) already compute per-rung readouts in exactly this
  shape; the demo data mimics them and the mechanism will reuse them.
- **D · Glyph grid.** 52px-wide tiles: 24px Bravura glyph + the shortcut underneath.
  The part tab swaps the grid for **labelled rows with the current value flush
  right** — part commands carry values (clef, key, transpose, mute) and a bare glyph
  cannot show a value. Everything else about the tray is identical across tabs.
- **E · Hover readout.** A dark bar naming the hovered/focused tile in words, its
  key as a bordered chip at the right.
- **F · Search line.** Filters this scope's commands; the hint names Ctrl+Shift+K as
  the way to widen to every global command.

## Tile states

Four reads, from the spec's handoff notes, all present in the demo data so the
review sees each one:

| State | Drawing | Meaning |
|---|---|---|
| **available** | white, 1px hairline border | the command can be applied |
| **active** | solid accent, white glyph | the thing already exists on the selection; the tile is now a *remove* |
| **unavailable** | grey fill, grey glyph, not focusable | the command needs a different rung — tabbing to that rung turns it on |
| **mixed** | available + a 2px accent left edge | some but not all members of the selection carry the mark; click = apply-to-all |

The mechanism will add a distinction *within* unavailable (needs-another-rung vs
not-yet-built); visually they are the same grey, which is the point — the tray never
apologizes for the codebase.

## Keyboard, inside the component

Scope-4 region rules ([core-editor-focus-scope.md](../complete/core-editor-focus-scope.md)):
while the tray is open it owns the keys it names and nothing else.

- `↑ ↓` — move between scope tabs (preview only).
- `Enter` on a tab — commit the previewed scope (mechanism; a no-op flash in the demo).
- `← →` and `Tab` — move the tile cursor. `Enter` on a tile fires it (demo: the
  tile flips state in place, showing the stays-open behavior the spec assumes).
- Any printable character — jumps focus to the search line.
- `Escape` — closes the tray; the selection is as it was on open.

## The component contract

`<mnx-selection-tray>`, incubating at `src/workbench/SelectionTray.ts` with the
ScoreHud posture stated in its header: deliberately dumb, speaking a **neutral data
contract** — no `edit/` types in its props — so the eventual promotion to
`elements/` ([core-editor-element-promotion.md](../proposed/core-editor-element-promotion.md),
parked on studio) is a move, not a rewrite.

Properties (down):

| Prop | Shape |
|---|---|
| `tabs` | `{key, label, active, holdsSelection}[]` — presence-filtered, in ladder order |
| `meta` | `{primary, secondary, count}` |
| `tiles` | `{id, glyph, shortcut, label, state: 'available'\|'active'\|'mixed'\|'unavailable'}[]` |
| `rows` | `{id, glyph, label, value}[]` — the part tab's value-row variant |
| `anchor` | `{x, y, width} \| null` in the shell's coordinate space; `null` docks the tray bottom-center of the score pane (the fallback when nothing is selected or geometry is unknown) |
| `searchText` | the search line's value |

`glyph` is `{smufl: '<glyphname>'}` — a SMuFL glyph **name**, the repo's convention
(the primitives pin names, the engine owns name→codepoint) — or
`{arc: 'slur' | 'tie'}` for the two marks that have no single SMuFL glyph, drawn as
the spec's 26×14 two-point SVG arcs at 2px stroke.

Events (up, composed): `tray-tab-preview {key}` · `tray-tab-commit {key}` ·
`tray-command {id}` · `tray-search {text}` · `tray-close`.

### The one `elements/` change: the anchor

The shaft has to land on the selection, and the selection's geometry lives inside
`<mnx-score-viewer>`'s shadow SVG — `drawEnclosure` already computes the box every
draw. The viewer gains a **`selection-anchored`** composed event carrying the
enclosure's bounding rect (viewport coordinates, `null` when nothing is enclosed),
emitted after each enclosure draw. Presentation-only geometry in the existing
`mnxContext.ts` spirit — the viewer still never learns editor vocabulary — and a
knob that lands under [core-viewer-surface.md](core-viewer-surface.md)'s
now-built layering discipline (element binding; the workbench chrome consumes
it) — one more designed binding, not accretion.

## Mounting

`ScenarioPage` renders the tray over `.main`, positioned from `selection-anchored`.
**`/` opens the tray when an edit session exists** and the editor has the
keyboard; **Ctrl+Shift+K opens the global `<mnx-command-palette>`**; with no
session, `/` falls through to go-to. The binding move itself
(`SHELL_BINDINGS`) lands with this part so the demo is reachable, but everything the
tray *fires* stays inert until the mechanism.

> **Two later corrections, recorded here because this doc's body describes the
> state on the day it shipped:**
>
> 1. **The key.** Shipped on **Ctrl+K**; rebound to **`/`** on 2026-08-15.
>    Chrome owns Ctrl+K (the omnibox), and since the shell deliberately never
>    consumes keys typed into text fields, it worked from the score and escaped
>    to the browser from every input. Slash costs no modifier, no browser
>    fights it, and it is the convention for "start a command". The rail
>    filter's own `/` retired to Ctrl+G, which already matched scenarios
>    through the same `matchesQuery` and reaches bars and objects besides. Then
>    **Ctrl+Shift+K retired too**: the global commands became the tray's own
>    `global` tab, so a second `/` widens to it and go-to's `>` prefix is the
>    off-editor door
>    ([core-selection-tray-global-tab.md](core-selection-tray-global-tab.md)).
>    Every "Ctrl+Shift+K" below should be read as one of those two.
> 2. **The value-rows variant** (region D's second half) was **removed
>    2026-08-15 as dead code**. Every tab renders tiles from the command
>    registry, and the part tab's clef/key/transpose values were never wired
>    into rows — an untested code path pretending to be a feature. It returns
>    with the closure that would give it real values to show (the residue
>    ledger's "part rows as the closure's surface").

## Styling: faithful, and deliberately so

**Ruling (2026-08-14): the tray ships the design's art direction verbatim**, as
self-contained shadow styles — it does not include `designTokens` and does not
adopt the workbench's IBM Plex / radius language. Archivo throughout; ink
`#201e1d`, accent `#ec3013`, pressed `#b8240d`, hover tint `#fce7e3`, hairline
`#dcd9d6`, disabled `#f5f3f1` / `#c3bfbb`; zero border-radius anywhere; shadow
`0 18px 40px rgba(32,30,29,.18)`. Tile 52px, glyph 24px, grid gap 6px, tray padding
13px; tabs and eyebrows 10px/600, letter-spacing .12em, uppercase; meta and hover
readout 11.5px; tile shortcut 8.5px/600.

The tray is the **leading edge of a possible workbench-wide restyle** in this
direction — that restyle is its own future proposal, not smuggled in here. Until
it lands the tray will sit visibly apart from the surrounding chrome; that contrast
is accepted, recorded, and reviewable in the hands-on pass.

~~Open item: **Archivo loading**.~~ **CLOSED 2026-08-15** by
[core-modernist-type.md](core-modernist-type.md) — bundled through
`@fontsource` in the workbench entry, not a component-local `@font-face`. The guess
recorded here (that the component should declare its own face, the way the embed
registers Bravura) was wrong in a useful way: the workbench already had a font
pipeline, and the right move was to put Archivo through it rather than give this one
component a private one. Re-review results in the revision block above.

Open item: **the tray on a dark page**. Since 2026-08-14 the viewer carries its
own tokens and follows the page's colour scheme (`light-dark()`); the spec's art
direction is light-only and has no dark variant. The tray ships light-only —
acceptable in the light-chrome workbench — and the dark pass belongs to the
restyle question. Recorded as a residue row so it cannot be forgotten at
promotion time.

### Revision 2026-08-15 — the restyle arrived; both open items close

**The look won the review**, so the future proposal this section anticipated now
exists: [core-campaign-modernist.md](core-campaign-modernist.md), a campaign
whose contract is the token vocabulary this component currently hard-codes. Three
consequences land back here, each as an indexed campaign item:

- **The tray drops its hexes** (campaign item 4). The ruling above — ship the art
  direction verbatim as self-contained shadow styles, deliberately without
  `designTokens` — was correct for a component landing ahead of its system, and it
  expires when the system catches up. Once
  [core-modernist-tokens.md](core-modernist-tokens.md) lands, `SelectionTray.ts`
  adds `designTokens` and its ~60 colour literals become token references. The
  paragraph above about sitting "visibly apart from the surrounding chrome" stops
  being true, which was always the intent. Delete the component's header comment
  explaining why it excludes `designTokens` in the same change.
- **Archivo is bundled — the open item below is CLOSED** (campaign item 3, landed
  2026-08-15). The proposed mechanism turned out to be unnecessary: the workbench
  already bundles its faces through `@fontsource/*` imported in `src/entries/main.ts`
  — *"no font CDN"*, as that file's header puts it — so Archivo was a dependency plus
  three import lines (latin subset, 3 files, 43KB), with no `@font-face` authoring and
  no `public/` asset. This component now renders in the face it has always declared.
  **Re-reviewed with the tray open, driven over CDP**, since a keyboard surface cannot
  be reached by a plain screenshot: seven rung tabs still fit one row, the 8.5px corner
  chips stay legible, the readout bar holds. **The recorded deviations below (tab
  padding 9px, rows-variant width 400px) were re-checked against the real face and
  stand as written** — no amendment needed.
- **The dark page gets an answer** (campaign item 2), by authoring a dark half rather
  than deferring again. The tray inherits it for free *provided* the de-hexing was
  total — which makes dark mode the real completeness test for item 4.

The two residue rows behind these — *"the tray on a dark page"* and *"the workbench
restyle the tray's art direction leads"* — are retired in
[core-selection-tray-residue.md](../proposed/core-selection-tray-residue.md), the first by
unblocking and the second by adoption.

## Demo data

One static module of placeholder command sets covering **all seven rungs**, clearly
marked as scaffolding for the review (the mechanism replaces it with the registry).
The design supplies note / event / bar / part; the other three are drafted from the
ladder's ownership table — and since the campaign's vocabulary sweep
(2026-08-14/15) nearly all of these name **verbs that now exist**, so the demo
sets should mirror the mechanism's wired tables rather than invent labels:

- **voice** — full-measure rest, voice cycle (Alt+V today), move selection to
  voice N, delete voice (empty-only, the campaign's container rule).
- **section** — rename, set color, move boundary (the bar-attribute family's
  `section` kind), select-the-range.
- **score** — title, add part, staff kind (notation / tab / both), append bar,
  system breaks, multimeasure rests.

## Not this

- **No intents, no ops.** Tiles flip local state for the review and nothing else —
  part 2 wires the funnel.
- **Not the promotion.** Workbench-incubated; the neutral contract is the whole
  preparation the promotion needs.
- **Not the global palette's redesign.** `<mnx-command-palette>` keeps its job at
  Ctrl+Shift+K; whether it later adopts this skin belongs to the restyle question.
- **Not the dashed on-score scope preview** — that rides `SelectionContext` and
  lands with the mechanism.

## Staging

1. **The component** — `SelectionTray.ts`, all six regions, four tile states, rows
   variant, keyboard model, demo data module.
2. **The anchor** — `selection-anchored` on the viewer; shaft/plinth placement,
   flip-above, the docked fallback, animate-position.
3. **The mount** — ScenarioPage overlay, the Ctrl+K / Ctrl+Shift+K split.
4. **Hands-on review** — every rung's tab visited, every tile state seen, connector
   behavior at the viewport edges; findings feed part 2 the way the ladder's
   per-level reviews feed the keymap.
