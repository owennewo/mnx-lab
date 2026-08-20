# The score HUD — the selection ladder's property surface

> **Status: COMPLETE 2026-08-15.** Stages 1–3 built 2026-08-11, same day as
> proposed; **stage 4 was formally CUT** rather than parked (see below) and
> redirected to the selection tray, which is what makes this closable — with it
> gone, stages 1–3 are the whole of it. Originally:
> Shipped: `src/workbench/ScoreHud.ts` (the component, neutral `HudRow[]`/
> `HudPart[]` contract, `hud-row-activated`/`hud-part-setup-changed` events) +
> `src/workbench/hudRows.ts` (the session→rows mapping: address chain, presence
> rule, rung highlight); click-to-level as a bounded relax/tighten walk through
> the intent funnel (traces replay clicks); the per-part override end to end —
> engine `PartTabSetups` (flat `TabSetup` or a per-part resolver, resolved
> inside `tabPositionContext`; strings/capo still fall back per field),
> `<mnx-score-viewer>.partTabSetups` keyed by part id-then-index, and the
> ensemble table wired through the page. Two design rulings made in the build:
> **an explicit per-part entry carries `staffKind`** (supplying an instrument
> IS the ask to see that part's fingerboard — the override can opt a part in
> where the document never did), and the both view's old first-candidate
> fallback generalized to **every known-strings part when NO part declares a
> staffKind** (kind-less documents make no both goldens — `wantsTab` gates
> those — so the golden gate was untouched: verified byte-identical, 286
> tests green). The edit strip's selection-level chip retired into the HUD;
> the toolbar instrument selector retired on multi-part scores (single-part
> keeps it, wired to the same per-part state). Verified hands-on in headless
> Chrome on twelve-bar-blues: guitar keeps its declared 6-string tab, an
> overridden bass gains its own 4-string staff, clicks walk the ladder.
> **Stage 4 (rung property edits through ops) is CUT, not parked — revised
> 2026-08-15.** It was parked behind the ladder's per-level pass; the score-panel
> design ([workbench-score-panel.md](../complete/workbench-score-panel.md), campaign item 5)
> retires it instead, and redirects the work to the selection tray. The design's
> governing rule is **"the tray edits, the HUD explains"**: the HUD's keys half is
> reference and never clickable, and its footer hands editing back to the tray
> key — `/` since 2026-08-15, Ctrl+K when the design was written. That
> is incompatible with the HUD growing content edits, so adopting the design makes
> the HUD permanently a *read* surface — plus the one presentation exception the
> rule itself names (the part row's strings and capo, which are per-part overrides
> with values rather than toggles). This closes the stage with a reason rather than
> leaving it open indefinitely, and it makes this doc completable: with stage 4 cut,
> stages 1–3 are the whole of it.
>
> **Same-day revision from using it: the HUD became the anchor tab of a side
> panel.** The first build put the HUD beside the viewer while the head kept
> the edit strip — so the strip's cursor readout (`m1 · 0/1 · s2`) duplicated
> the HUD's bar/event/note rows. The fix consolidated ALL of the page's
> chrome into one tabbed right panel — **description | tags | actions | hud |
> compare | json** — leaving the head at title + score-view tabs
> (notation/tab/both) only. The strip's readout is deleted (the HUD *is* the
> readout); its buttons/popovers moved to the actions tab (a keyboard-opened
> popover switches the panel there); the compare view collapsed to just the
> reference pane (the main pane is always our render, so side-by-side IS the
> comparison — `comparePaneView()` deleted); the raw JSON became a panel tab;
> the toolbar instrument selector retired entirely (the ensemble table serves
> single-part too). Legacy `?view=compare|json` deep links are honored: they
> open the matching panel tab over the document's default score view.
>
> **Rows now carry their level's properties** (the ladder's thesis, second
> pass): score adds bar/part counts; bar adds the effective time signature;
> voice reads `n of N`; event shows duration + content (`beat 0/1 · quarter
> 1 note` / `… rest`); note shows the PITCH beside its line (`B3 · string
> 2`). All derived in `hudRows.ts` from the document via the grid's
> slot/event addressing — the component still sees only strings. Candidates
> for later passes: fret+fingering on the note row (needs the override
> context threaded in), ties/articulations on event, key signature on bar,
> section bar-counts, `part.transposition` in the ensemble table. The panel
> also gained a **drag bar** (left edge, 240–640px, remembered per browser
> like the Ctrl+B rail toggle).
>
> Incubates in `workbench/` as a sibling of
> `<mnx-score-viewer>`. Builds on
> [core-selection-ladder.md](../complete/core-selection-ladder.md) (the rungs and the
> walk), takes its promotion discipline from
> [core-editor-element-promotion.md](../proposed/core-editor-element-promotion.md), keeps the
> viewer's prop surface small per [core-viewer-surface.md](core-viewer-surface.md),
> and owns the **per-part strings/capo override** gap left open by
> [core-derived-positions.md](../inprogress/core-derived-positions.md)'s instrument-neutrality work.

## The problem, twice over

**The ladder has no property surface.** The selection ladder's thesis is that every
level owns exactly the properties the document puts at that level, and the options
offered at the cursor are that rung's properties and nothing else. The rungs and the
Escape/Enter walk are built; the *properties each rung offers* have nowhere to appear.
Today's whole readout is the edit strip's one cryptic line
(`m5 · 1/4 · p3 · note · q`) — accurate, dense, and mute about what the current level
actually *is* or offers.

**The instrument override is global and the world is per-part.** The viewer override
(`stringsOverride`/`capoOverride`, one `TabSetup`) was built against single-instrument
scenarios and applies one value to *every* part: `tabPositionContext` resolves
`override.strings ?? part._x.mnxLab.strings` identically for all parts. On a
multi-part score (`lab/document/twelve-bar-blues`: guitar declares standard tuning,
bass declares nothing) any override both **clobbers the part that had an opinion** and
**infects the parts that shouldn't have one** — the bass acquires a guitar
fingerboard, becomes tab-eligible in the both view, and renders unplayable-note
badges. The document side is already per-part (`_x.mnxLab.strings`/`capo` live on the
part); the override should mirror the shape of the thing it stands in for.

One component answers both: a **HUD companion** beside the viewer — a vertical readout
of the containment chain at the cursor, one row per level, the active rung
highlighted, each row hosting that level's identity and options. The part row, listing
every part with its strings/capo, *is* the per-part override UI.

## Rows are the address, highlight is the rung

The ladder is deliberately not the containment chain — **part is not a rung** (the
ladder is the vertical axis; part is the horizontal closure of part-measure,
`selection.ts`). The HUD displays what humans read, the *address chain*, and maps the
rung onto it:

> **Vocabulary note (2026-08-15).** "Part is not a rung" is a statement about
> `SELECTION_LADDER` in `src/edit/selection.ts` — the vertical containment axis — and
> **not** about this table. There *is* a part **row**, `LEVEL_BY_ROW` maps it to
> `partMeasure`, and it is listed below. The score-panel design draws it as a "PART
> rung" and that reads like a contradiction of this section; it is not one. Same
> surface, different word. When the two vocabularies meet, this doc's is the one to
> use: **rows are the address chain, the highlight is the rung.**

| HUD row | Shows | Highlighted at rung |
|---|---|---|
| score | title / scenario name | `score` |
| section | section label + bar range | `section` |
| bar | index (+ time signature) | `measure` |
| part | **ensemble table**: each part's name, strings, capo | `partMeasure` |
| voice | voice index at the cursor | `voiceMeasure` |
| event | onset, duration base | `event` |
| note | pitch (notation) / string+fret (tab) | `note` |

Rules the ladder already established, honored here:

- **Presence rule**: a rung the document doesn't have at the cursor is skipped by
  Escape/Enter — so the HUD *drops* that row (no sections ⇒ no section row), never
  shows it empty. The column always matches what the walk can reach.
- **Breadcrumb semantics**: rows above the active rung are the surviving relative
  address, exactly what relax keeps.
- Clicking a row sets the selection level — **mouse parity for Escape/Enter**, which
  does not exist today. The enclosure tween and the HUD highlight then narrate the
  same move in two places.

## Two kinds of edit, one visible boundary

The HUD hosts both, and must keep them legible:

- **Content** — a section name, later a note's properties: flows through
  intents/ops, lands in the undo history, marks the session dirty. (Not in the first
  slice; the rows start read-only except for the override.)
- **Presentation** — strings/capo on the part row: flows to viewer props as
  `TabSetup`, the document untouched, nothing dirty. The current instrument
  selector's tooltip ("the document is untouched") is the precedent; the HUD should
  mark the distinction visibly, not just in a title attribute.

## The part row is the per-part override

The ensemble table replaces the single instrument selector for multi-part scores:
every part gets a line — name, declared-or-overridden strings, capo — with the
cursor's part highlighted. Mechanically this needs the override surface reshaped from
one global `TabSetup` to a **per-part map**, with the existing per-field fallback kept
*per part* (capo-only override atop a declared tuning still works, scoped to one
part):

- Engine: `tabSetup?: TabSetup` becomes a per-part lookup — `tabPositionContext`
  already takes the part, so the callers select the right entry instead of passing
  one value. Small, mechanical threading through the notation/tab/both layouts.
- Element: `stringsOverride`/`capoOverride` join a keyed form (shape TBD below). The
  flat props' fate is a [core-viewer-surface.md](core-viewer-surface.md) decision —
  sugar for single-part documents, or retired.

Caveats recorded so they aren't rediscovered:

- **The cursor lives on `parts[0]`** today (`selection.ts`, `noteKeys.ts` encode the
  `parts[0]` traversal), so a strictly cursor-following part row would always show
  part 0 — hence the table-of-all-parts shape, which is also exactly the override UI.
- **The standalone tab layout renders `parts[0]` only** (`tab.ts`). Per-part setup is
  meaningful in the both view today; multi-part tab is a separate, larger gap and
  this doc does not block on it.

## Where it lives

Incubated in **`workbench/`**, where churn is free, as a **sibling** of
`<mnx-score-viewer>` — the host owns the shared state (selection flows down to both,
override events flow up), no direct coupling between the two components, and the
viewer's prop surface does not grow. Three standing constraints shape the eventual
promotion:

1. **`elements/` never imports `edit/`** (established when the enclosure work put the
   level→shape map in the workbench). So the HUD is designed against a **neutral
   row-data contract from day one** — the workbench maps session → `HudRow[]`; the
   component renders rows and emits `row-activated` / `tab-setup-changed`. Same
   pattern as the enclosure vocabulary: `elements/` draws, `workbench/` interprets.
2. **The promotion gate** ([core-editor-element-promotion.md](../proposed/core-editor-element-promotion.md))
   applies to the selection half — it renders session state, so it promotes when the
   editor does (a check, not a debate).
3. **The instrument half is viewer-tier** — a read-only embed could want the ensemble
   table with no editor at all. The HUD is two tiers in one skin; the part table may
   promote earlier than the breadcrumb, and the row contract should not entangle them.

## Open questions

- **Part keying — decided in the build.** `part.id` is optional in MNX, so
  `<mnx-score-viewer>.partTabSetups` resolves by id first, index-as-string
  second: an embed host keys naturally by id, the workbench (which owns its
  keys) uses plain indexes.
- **Saying "none".** No way exists to *suppress* a declared part's fingerboard (an
  explicit `null` entry?). The eligibility loop would still tab-ify a declared part.
  Possibly out of scope; decide deliberately.
- **Deep links.** The instrument override is local state today; per-part overrides
  make URL encoding harder if we ever want it. Not needed for the first slice.
- **Name.** "HUD" is the working title; the component wants a real element name
  (`<mnx-score-hud>`?) before promotion, not before incubation.

## Staging

1. **Read-only breadcrumb** — rows from the session, active-rung highlight, presence
   rule, the `HudRow[]` contract. The edit strip's `selectionLevel` chip retires into it.
2. **Click-to-level** — `row-activated` wired to the relax/tighten intents.
3. **The ensemble table** — per-part `TabSetup` threading (engine + element),
   part rows with strings/capo controls, single-selector retirement on multi-part
   scores. This stage closes the twelve-bar-blues override gap.
4. **Rung properties** — content edits in rows (section rename first), through ops.
   Rides on the ladder's own per-level pass; not before.
