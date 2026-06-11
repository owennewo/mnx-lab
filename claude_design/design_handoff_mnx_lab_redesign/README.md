# Handoff: MNX Lab front-end redesign

**Target codebase:** `github.com/owennewo/mnx-lab` (`main`) — Lit + Web Awesome, TypeScript strict, Vite.
**Design rationale:** see `mnx-lab-redesign/DIRECTION.md` (included) — read it first; it records *why* each call was made and defers to `clean_room_impl/00-vision.md` / `01-principles.md` in the repo.

## Overview

A library-first redesign of the MNX Lab front-end. The old "editor" framing (chat panel default-left,
playback in the header, Library behind a toggle) is replaced by a reading room: the scenario library is
permanent navigation, the scenario page (verdicts + rendered score + MNX document) is the main surface,
JSON-beside-rendering is the core interaction, and chat/playback are demoted to supporting cast.
A second deliverable mocks the embeddability story (`<mnx-editor-app>` in a third-party page).

## About the design files

Everything in this bundle is a **design reference built in HTML/React for prototyping speed** — it is
NOT production code. The task is to **recreate these designs in the existing Lit + Web Awesome codebase**,
keeping its hard constraints:

- Lit + web standards only; no React/Vue/state libraries. The prototypes use React only as a mock medium.
- Web Awesome (`wa-*`) stays as the UI kit, restyled via CSS custom properties. Icons: Bootstrap Icons via `wa-icon`.
- Everything renders inside the component's shadow root; tokens go on `:host`, never `document`.
- Keep the state architecture: ReactiveControllers own state, `MnxEditorApp.willUpdate()` mirrors snapshots
  into `@lit/context` providers, children emit composed `CustomEvent`s upward.
- TypeScript `.ts` import extensions, experimental decorators, `npm run build` must pass.

**The fake score renderer (`engrave.jsx`) must NOT be ported.** It exists only so the chrome could be
judged around plausible Bravura output. The real `src/layout → primitives → SVG` pipeline is the renderer;
the design treats its SVG as a black box that fills its container.

## Fidelity

**High-fidelity.** Colors, type, spacing, copy, and interactions are final design intent. Recreate
pixel-perfectly using the token sheet below. Two exceptions: (1) the engraved score content is placeholder;
(2) corpus counts/statuses mirror the repo as of 2026-06-10 and must come from the real `scenarios/` data,
never hardcoded.

## Screens / Views

### 1. App shell (`MNX Lab Redesign.html`)
Grid: `52px header / 1fr / 30px footer` rows; middle row `312px rail / 1fr main` columns. Body 13.5px
IBM Plex Sans, antialiased.

- **Header (52px, border-bottom 1px line):** hamburger (≤980px only) · wordmark (16×16 five-line/notehead
  mark + "MNX *Lab*" — "MNX" 15px/600 sans, "Lab" Plex Serif italic 500, ink-2) · env chip
  (`MNX v17 · _x.tab v2`, mono 10.5px, 1px border, radius 4) · spacer · coverage metric chip
  (`47/53 rendered · 61/78 defs`, mono 11px, clickable → dashboard) · search input (230px, 30px tall,
  radius 6, `/` kbd hint) · "Assist" button · theme toggle. Buttons: 30px tall, radius 6, surface bg,
  1px line border; active state = accent border + accent text.
- **Library rail (312px, bg-rail, border-right):** filter block (search + two chip rows) over a scrollable
  list over a coverage footer.
  - Status chips (radius 999, 11px): `All 53 · Verified 5 · Rendered 47 · Needs work 5 · Spec gaps 1`
    plus an `id-refs 19` toggle. Single-select status + independent id-refs toggle. Counts always global.
  - "SHELVE BY" facet row (label mono 9.5px uppercase): `category · status · source · $def`.
  - Rows (5px 8px padding, radius 6): status pip (7px circle — draft = outlined gray, valid = amber,
    rendered = green, verified = blue with 2px halo) or 7px oxide **diamond** for invalid-by-design;
    12.5px title, ellipsized; right-aligned mini-tags (`gap`, `tab` — mono 9px). Selected row: accent
    @ 11% bg + 2px accent inset bar left. In non-category shelvings each row shows ` · lab`/` · spec`
    namespace suffix (mono 10px ink-3).
  - Category mode: `lab/` ns-header ("hand-authored"), category sub-headers (mono id + `rendered/total`
    count right), empty categories render as italic "planned — no scenarios yet"; then `spec/` ns-header
    ("W3C mirror · read-only · synced <date>"). ns-headers sticky.
  - $def mode: one group per **feature def** (alphabetical, count right), scenarios repeated per def;
    after the groups (only when unfiltered) an "uncovered — the backlog" section listing defs with no
    scenario (gray, draft-pip rows). Plumbing defs are excluded from grouping.
  - Coverage footer: `61 / 78 feature defs` + 4px progress bar (rendered-green); clicking opens dashboard.
- **Main: coverage dashboard** (empty state, no scenario selected): kicker (mono uppercase
  `test bench · W3C MNX · guitar tab`) · serif 30px headline "Turn any valid MNX into correct notation." ·
  lede · 4 stat tiles (serif 27px number + mono label w/ status pip) · feature-def coverage bar with
  uncovered-def dashed chips · per-category table (mono id, stacked status bar
  verified→rendered→valid→draft, count; rows click to first scenario; empty = "planned") · attribution
  footnote (spec/ license + sync date).
- **Main: scenario page:**
  - Header block (24px side padding): mono id path `scenarios/<id>` (11px ink-3) · serif 23px/500 title ·
    badge row: verdict chip ("MNX valid" green-tint / "MNX invalid · by design" oxide), `_x.tab <verdict>`
    chip when extension ≠ n/a, lifecycle widget (4 pips 8×4px filled per stage; verified fills blue;
    mono label), source chip, `id-refs` chip when true, `N $defs` expandable chip (▾) → def chip row:
    solid accent chips = feature defs (clickable → shelve rail by that def), dashed = plumbing.
    Description (13px ink-2, max 76ch, `text-wrap: pretty`) · mono links: spec reference ↗, issue ↗,
    `notes.md →` toggle revealing a bordered prose card.
  - Toolbar: segmented `Notation | Tab | Both` (Tab/Both disabled w/ tooltip "No _x.tab part in this
    document" unless the part declares it; active = accent bg, white text) · spacer · zoom (− 100% +,
    75–175% in 25% steps) · play button + bpm number input (mono) — disabled unless the doc renders ·
    `copy json` · `json` split-pane toggle (active = accent border).
  - Score area (border-top): **paper** card centered in a scrollable region — `--paper` bg, radius 10,
    1px warm border, 30px/26px padding, shadow; width = `min(100%, 820px × zoom)`. In Both view, mono
    uppercase 10px captions `notation` / `tab · _x.tab` above each pane. **Paper stays light in dark mode.**
  - JSON pane (400px right split, surface bg, border-left): mono header `score.mnx.json · N lines` +
    copy + close; body mono 11px/1.65 with line numbers (right-aligned, 38px, 55% opacity); syntax
    colors below. Lines that hold a note's `"id"` (or anchored pitch) are **anchored**: accent line
    number, hover bg, clickable.
- **States on paper:**
  - *Invalid by design:* serif h3 with oxide diamond "Invalid by design — a spec-gap exhibit" + explainer +
    pinned-error table (rule mono oxide 600, message, path mono; row click → highlights the offending JSON
    line in oxide). No render. Never style as red/failure.
  - *Valid but unrendered:* amber-dot h3 "Validates, doesn't render yet" + explainer + mono error chip
    (e.g. `layout: unsupported feature — grace (event.grace)`).
- **Footer (30px, mono 10.5px):** left `MNX v17 · _x.tab v2 · 53 scenarios · spec/ synced <date>`;
  right: selection readout `selected G♯4 · measure 1 · highlighted in document` or the hint
  "click a notehead — or a note line in the JSON — to cross-locate it".
- **Assist drawer (392px right overlay between header/footer, veil 12% black):** header "Assist" +
  mono sub "AI edit · downstream · sketches only". With a scenario open: "Corpus documents are read-only"
  card + accent **Fork to a sketch →** button + downstream-priorities note. In sketch mode: chat bubbles
  (user = accent bg right; assistant = bordered left, with mono accent tool-line
  `⤷ edit_notation · 1 tool call · document replaced`), suggestion pill row, textarea + Send.
- **Sketch mode:** title gets "— sketch", amber chip `sketch — editable copy · discard`, status draft,
  source "sketch"; document/JSON/score re-derive from the edited doc. Forking NEVER mutates the corpus.

### 2. Embedded page (`MNX Lab Embedded.html`)
A mock third-party docs page. The component frames are the deliverable:

- **`mode="viewer"`:** card (radius 12, line border, shadow): title bar (pip/diamond + 12.5px/600 title +
  mono id + brand mark/wordmark link, right-aligned) · optional controls row (mini segmented + json
  toggle) · paper (12px margin, radius 8) · optional JSON pane (full-width, max-height 232, border-top) ·
  footer (mono 10px: version left, "open in MNX Lab ↗" right).
- **Compact (container < 420px), pure CSS via container query** (`container-type: inline-size` on the
  card): hide `.emb-id`, brand text (mark stays), footer version, pane captions; seg buttons 10.5px /
  2px 7px; paper margin 8px. **Do not use ResizeObserver-driven classes.**
- **`mode="gallery"`:** full library in a host-sized box: brand bar (mark + counts + version), 252px rail,
  scenario page with JSON pane closed by default (280px when opened), description/notes hidden, title 19px.
- Attribute API (the element's public contract): `mode` (gallery|viewer), `scenario`, `view`
  (notation|tab|both), `json`, `controls`, `theme` (light|dark|auto), CSS custom properties
  (`--mnx-accent`, `--mnx-paper`, … = the token set below), composed events `scenario-selected`,
  `note-selected`.

## Interactions & behavior

- **Note ↔ JSON cross-highlight (the core gesture):** click a notehead → note gets accent fill + 10.5px
  accent ring; JSON pane opens if closed, scrolls the bound line to center, highlights it (accent 16% bg +
  2px accent inset bar); footer shows pitch/measure. Click an anchored JSON line → selects the notehead.
  Click again to clear. Requires stable note ids (or JSON pointers) surfaced through the renderer's
  primitives — the layout already carries note ids for selection.
- **Faceted browsing:** shelving is render-only regrouping of one flat filtered list. Status filter,
  id-refs toggle, and search compose; search matches title, id, tags, **and coversDefs**. Def-chip click
  on the scenario page = `setFacet('def') + setQuery(def)`.
- **Keyboard:** `/` focuses filter (Esc blurs); `↑/↓` and `j/k` walk the filtered flat list (selection
  follows); `Esc` closes drawer, then clears note selection.
- **Playback:** play steps an active-event highlight through the score at the bpm input's tempo
  (duration-weighted), auto-stops at the end. Pure function of the document (Tone.js in the real app).
- **Fork to sketch:** deep-copies the active scenario doc into a transient document; chat edits apply to
  it only; "discard" or selecting any scenario exits. Mirrors the existing invariant in
  `MnxEditorApp.handleLibraryToggle`.
- **Theme toggle:** light/dark; score paper unaffected. Persist preference.
- **Transitions:** essentially none — fills/colors 0.12s; no entrance animations (deliberate: calm,
  print-like). Respect that restraint.
- **Responsive (app):** ≤980px the rail becomes a left overlay (translateX, shadow, hamburger);
  ≤1240px JSON pane 340px. Embeds are container-driven, never viewport-driven.

## State management (mapped to the existing architecture)

Keep ReactiveControllers + `@lit/context` + composed events. Suggested decomposition:

| New component | Replaces / extracts from | Emits |
|---|---|---|
| `mnx-library-rail` | `ScenarioGallery.ts` | `scenario-selected` |
| `mnx-scenario-header` | inline header in `MnxEditorApp` | `def-facet-requested`, `notes-toggled` |
| `mnx-score-toolbar` | view-toggle block + `PlaybackBar.ts` (absorbed, compact) | `view-changed`, `json-toggled`, `zoom-changed`, play/stop/tempo events |
| `mnx-document-pane` | JSON view-mode in `ScoreViewer.ts` | `document-line-selected` |
| `mnx-coverage-dashboard` | new (empty state) | `scenario-selected`, `category-selected` |
| `mnx-assist-drawer` | `ChatPanel.ts` (demoted) | `fork-requested`, `chat-command-submitted` |

State: a `ScenarioLibraryController` owning corpus metadata + filter/facet/query/selection
(`facet: 'category'|'status'|'source'|'def'`); existing `DocumentController`/`PlaybackController`
unchanged; selection context gains the JSON-line binding. View-mode loses `json` as a mode —
`viewMode: 'notation'|'tab'|'both'` plus independent `showDocumentPane: boolean`. Coverage numbers come
from the `check-scenarios` report, statuses recomputed (only `verified` is human-asserted).

## Design tokens

Fonts: **IBM Plex Sans** (UI), **IBM Plex Mono** (ids/JSON/chips/numbers), **IBM Plex Serif**
(titles, dashboard headline) — bundle, resolve relative to the component (P4). Score font: Bravura (already in repo).

| Token | Light | Dark |
|---|---|---|
| bg | `oklch(0.967 0.005 88)` | `oklch(0.215 0.009 75)` |
| bg-rail | `oklch(0.952 0.006 88)` | `oklch(0.195 0.009 75)` |
| surface | `oklch(0.992 0.003 88)` | `oklch(0.255 0.01 75)` |
| line | `oklch(0.895 0.007 88)` | `oklch(0.31 0.01 75)` |
| line-strong | `oklch(0.82 0.008 88)` | `oklch(0.38 0.01 75)` |
| ink | `oklch(0.255 0.012 80)` | `oklch(0.9 0.008 85)` |
| ink-2 | `oklch(0.45 0.012 80)` | `oklch(0.72 0.01 85)` |
| ink-3 | `oklch(0.6 0.01 80)` | `oklch(0.58 0.01 85)` |
| accent | `#3E5C86` | fg = `color-mix(in oklab, accent, white 38%)` |
| paper / paper-ink | `oklch(0.985 0.006 85)` / `oklch(0.24 0.015 80)` | **same — paper never inverts** |
| status: draft / valid / rendered / verified | `oklch(0.62 .012 80)` / `oklch(0.66 .105 78)` / `oklch(0.55 .1 155)` / `oklch(0.5 .1 250)` | lightness lifted: 0.66 / 0.74 / 0.68 / 0.68 |
| spec-gap (oxide) | `oklch(0.55 0.125 42)` | `oklch(0.68 0.125 42)` |

Accent alternates offered as tweaks: `#3E5C86` (plate blue, default), `#9C4F33` (oxide), `#2F6B4F` (forest).
Soft fills via `color-mix(in oklab, <color>, transparent N%)` — selection bg 89%, JSON highlight 84%.

Type scale: 30/27 serif (dashboard), 23 serif (title), 15/600 (wordmark), 13.5 (body), 12.5 (rows/buttons),
11–10 mono (meta). Spacing: 4/6/8/10/12/16/20/24. Radii: 4 (kbd), 6 (buttons/rows), 7 (segmented),
8 (cards), 10 (paper/tiles), 12 (embed), 999 (chips). Shadows: paper `0 1px 2px 5% black + 0 6px 24px -8px warm 18%`.
Fixed sizes: header 52, footer 30, rail 312, JSON pane 400 (app) / 280 (gallery embed), embed rail 252.

## Copy

Reuse the prototype copy verbatim where possible — it is design, not filler. Notable strings: the
lifecycle tooltip, the read-only Assist card, the spec-gap and render-fail panel texts, the dashboard
headline/lede, "shelve by", "uncovered — the backlog", footer cross-locate hint. The product name in the
header is **MNX Lab** (retire "MNX Notation Editor").

## Assets

- Wordmark: 5 hairline staff lines + one accent notehead ellipse (inline SVG, trivially redrawn).
- Icons: use Bootstrap Icons via `wa-icon` in the real app (prototype inlines simple SVGs).
- Bravura + SMuFL metadata: already in `public/smufl/`.
- Corpus content: from `scenarios/` — titles, descriptions, meta, notes.md are real and should render as-is.

## Files in this bundle

- `MNX Lab Redesign.html` — app prototype (open in a browser; everything is live)
- `MNX Lab Embedded.html` — embeddability mock (host page + viewer/gallery embeds)
- `mnx-lab-redesign/DIRECTION.md` — design direction + rationale
- `mnx-lab-redesign/tokens.css` — **the token sheet** (authoritative for colors/spacing/type)
- `mnx-lab-redesign/embed.css` — embed card + container-query compact rules
- `mnx-lab-redesign/data.js` — corpus mock (note `coversDefs`/`featureDefs` shape feeding the facets)
- `mnx-lab-redesign/sidebar.jsx` — rail + facet/filter logic (port the *logic*, not the React)
- `mnx-lab-redesign/score-pane.jsx` — scenario page, JSON pane + anchor/cross-highlight algorithm
- `mnx-lab-redesign/app.jsx` — shell, dashboard, drawer, keyboard map, playback stepper
- `mnx-lab-redesign/embed.jsx` — viewer/gallery embed mock
- `mnx-lab-redesign/engrave.jsx` — fake renderer — **reference only, do not port**
- `mnx-lab-redesign/tweaks-panel.jsx` — prototype-host tooling, ignore
- `screenshots/` — reference captures of the key states:
  `01` coverage dashboard (empty state) · `02` scenario page w/ note→JSON cross-highlight ·
  `03` spec-gap exhibit · `04` tab part in Both view · `05` dark mode · `06` rail shelved by $def ·
  `07` embed viewer + resizable · `08` embed gallery · `09` embed theming (dark / oxide accent)

## Suggested implementation order

1. Tokens on `:host` + `wa-*` restyle (theme + density attributes).
2. Shell re-layout: permanent rail, header rename, footer, dashboard empty state.
3. Scenario page: header/badges/lifecycle, toolbar (view modes + JSON toggle), paper treatment.
4. Document pane with note↔JSON cross-highlight (needs note-id ↔ JSON-pointer binding from core).
5. Facets (shelve-by + id-refs + def search) over real meta; coverage numbers from check-scenarios.
6. Spec-gap + render-fail states; playback compaction; Assist drawer + fork-to-sketch.
7. Embed modes + container queries.

Each step ships usable (P8) and `npm run build` must pass throughout.
