# MNX → SVG Renderer: Architecture Brief

You are building an MNX-to-SVG renderer with a deliberately layered architecture. The goal is to render music notation cleanly today, while preserving the ability to swap in a Canvas renderer (or add one alongside) later without rewriting the engraving logic.

This document defines the architecture. Follow it carefully — the layering is the point, not an incidental detail. Resist the temptation to take shortcuts that collapse the layers, even when a shortcut would save lines now.

## What MNX is

MNX is a JSON-based music notation format developed by the W3C Music Notation Community Group. It has two conceptual layers:

- **Semantic layer (required):** `global` (shared time grid, measures, tempos, keys, time signatures) and `parts` (per-instrument musical content — sequences of events with pitches, durations, beams, slurs, ties, dynamics, articulations).
- **Visual layer (optional):** `layouts` (named definitions of how staves group into systems) and `scores` (named views, optionally specifying which measures appear on which system on which page).

A single MNX file can omit the visual layer entirely (engine decides everything), specify it partially (engine fills gaps), or specify it fully (engine respects exact pagination). The renderer must handle the full spectrum.

The MNX schema is provided as a project file. Trust it as the source of truth for what fields exist and what's required.

## The three-layer architecture

```
┌───────────────────────────────────────────┐
│  Layer 1: MNX document (input)            │
│  Pure JSON. The user's source of truth.   │
└───────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────┐
│  Layer 2: Layout engine                   │
│  Pure functions. No DOM, no SVG, no       │
│  rendering concerns. Reads MNX + optional │
│  layout hints, fills defaults, produces a │
│  renderer-agnostic primitive list.        │
└───────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────┐
│  Layer 3: SVG renderer                    │
│  Thin. Walks the primitive list, emits    │
│  SVG DOM. Knows nothing about MNX.        │
└───────────────────────────────────────────┘
```

Each layer talks only to the layer directly above and below it. The renderer must not read MNX. The layout engine must not produce SVG strings or touch the DOM.

## Layer 2 in detail: the layout engine

This is where most of the code lives and most of the difficulty resides.

### Input

- A parsed MNX document (a JavaScript object matching the schema).
- A viewport hint (width in pixels, optional height/page size). This is the only "presentation" input the engine receives — it's used to decide system breaks when the MNX doesn't specify them.

### Output

Two values:

1. **A primitive list:** a flat array of drawing primitives, each describing one mark on the page. Positions are in **staff spaces**, not pixels. Staff space is the SMuFL-native unit (the distance between two adjacent staff lines). The renderer converts to pixels.

2. **A spatial index / lookup table:** a map from MNX `id` to the bounding box of the primitive(s) that represent it. This exists for hit-testing and for syncing playback highlights to visual elements. The renderer doesn't need it; the host application does.

### Primitive shape

Define a single TypeScript type for primitives. Use a discriminated union on `kind`. Approximate shape:

```ts
type Primitive =
  | { kind: 'glyph'; glyph: string; x: number; y: number; scale?: number; sourceId?: string }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; thickness: number; sourceId?: string }
  | { kind: 'curve'; points: [Point, Point, Point, Point]; thickness: number; sourceId?: string } // cubic Bézier
  | { kind: 'text'; text: string; x: number; y: number; font: 'music' | 'body' | 'bodyItalic'; size: number; anchor?: 'start' | 'middle' | 'end'; sourceId?: string }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; radius?: number; fill?: string; stroke?: string; thickness?: number; sourceId?: string };
```

All coordinates in staff spaces. All thicknesses in staff spaces. `glyph` is a SMuFL canonical name (e.g. `'gClef'`, `'noteheadBlack'`, `'fermataAbove'`), not a Unicode codepoint — the renderer resolves the name to a codepoint via `glyphnames.json`.

The `sourceId` field is optional but should be populated whenever a primitive corresponds to a specific MNX element (a note, a beam, a slur). It's how the spatial index gets built and how user interactions get traced back to the model.

### Responsibilities

The layout engine is responsible for:

- Reading the MNX `global` to establish the time grid, tempos, key signatures, time signatures, barlines, repeats, endings, jumps.
- Reading each part's `measures` and walking `sequences` to lay out events in rhythmic order.
- Choosing staff grouping (from `layouts` if present, else defaults to one staff per part stacked top-to-bottom).
- Choosing system breaks (from `scores.pages[].systems[]` if present, else heuristically from viewport width and measure content widths).
- Resolving rhythmic positions (fractions) to horizontal x-coordinates within each system. Within a measure, space events by their `fraction` position scaled by the measure's allocated width.
- Resolving pitches to vertical y-coordinates within a staff, using the active clef.
- Drawing the staff itself (5 horizontal lines) as line primitives.
- Placing clefs, key signatures, time signatures at the start of each system.
- Placing noteheads, stems, beams, flags, accidentals, dots.
- Drawing slurs and ties as curve primitives (the engine computes Bézier control points).
- Placing articulations, dynamics, fermatas, ornaments as glyph or text primitives.
- Drawing barlines (regular, double, final, repeats) as line primitives, with repeat dots as glyphs.
- Honouring MNX id-based references: when a `beam.events` lists event ids, find those events; when a `slur.target` references a note id, attach the curve to that note's position.
- Looking up SMuFL metadata (anchor points like `stemDownNW` on notehead glyphs) to position stems correctly. The metadata is in JSON files shipped with the font.
- Building the spatial index as it goes.

The layout engine does *not* know about SVG, pixels, the DOM, or events. Its output is a data structure. It could run in Node.js to produce a snapshot.

### Defaults when the optional layer is absent

- No `layouts` → one staff per part, single-staff systems, no grouping bracket, stacked top-to-bottom.
- No `scores.pages[].systems[]` → engine picks system breaks greedily: fit as many measures as possible into the viewport width given each measure's natural width.
- No `scores` at all → create a virtual default score that includes all parts.

### Defaults when MNX-level engraving choices are unspecified

- Stem direction: based on note position (middle line and above → stem down; below middle line → stem up). Overridable via `event.stemDirection`.
- Beam grouping: only when `event.beams` are explicitly provided (the schema's `support.useBeams` flag signals this). If unset, render flags on individual notes.
- Accidental display: only when `note.accidentalDisplay.show` is true, *or* when the `support.useAccidentalDisplay` flag is false (meaning the engine infers display). If the flag is true, the file is authoritative.

## Layer 3 in detail: the SVG renderer

This layer is intentionally thin. Its job is mechanical translation.

### Input

- A primitive list (from Layer 2).
- A target SVG element (or a function that creates one).
- A pixels-per-staff-space value (the conversion factor, e.g. 8 means each staff space is 8 px).

### Behaviour

Walk the primitive list and emit SVG. Approximate mapping:

| Primitive | SVG |
|---|---|
| `glyph` | `<text font-family="Bravura">` with the SMuFL codepoint as content |
| `line` | `<line>` with `stroke-width` |
| `curve` | `<path d="M ... C ...">` for cubic Bézier |
| `text` | `<text>` with appropriate `font-family` and `font-style` |
| `rect` | `<rect>` with optional `rx`/`ry` for rounded |

All staff-space coordinates multiplied by the pixels-per-staff-space factor at emit time. The renderer never sees staff spaces leaking through to the user; it never reasons about them either — it just multiplies.

### What the renderer must do

- Set the SVG `viewBox` based on the bounds of the primitive list (so the page scales to fit container).
- Attach `data-source-id` attributes to elements that have a `sourceId`, so the DOM can be queried by MNX id (useful for highlights, hit-tests, debugging).
- Group primitives semantically: wrap each system in a `<g class="system">`, each measure in `<g class="measure">`, etc. This is for CSS hooks and debugging, not engraving.
- Use `<text>` for music glyphs, not `<path>` (we want the browser's font rasteriser doing the work, not us re-emitting outlines).
- Apply `font-family: Bravura` (or whichever SMuFL font is loaded) via CSS, not inline attributes, so it's themeable.

### What the renderer must not do

- It must not look at the MNX document.
- It must not make engraving decisions ("should this stem be flipped?" — that's Layer 2's job).
- It must not contain music-specific logic. If you find yourself writing `if (primitive.kind === 'glyph' && primitive.glyph === 'noteheadBlack')` in the renderer, you're leaking layout into rendering.

## Coordinate system and units

- **Staff space (sp):** the engine's working unit. 1 sp = the distance between two adjacent staff lines. SMuFL metadata uses this unit.
- **Page coordinates:** x increases rightward, y increases downward (matches SVG convention). The middle line of a 5-line staff is at the staff's y-origin; lines 1 and 5 are at ±2 sp.
- **Time:** rhythmic positions are MNX fractions `[numerator, denominator]`. Convert to a within-measure x-offset in sp by `position * measureWidth / measureDuration`.

Stick to staff spaces everywhere in Layer 2. The only place sp → px conversion happens is in the renderer.

## SMuFL handling

- Use Bravura as the default font (SIL OFL, free).
- Load it via CSS `@font-face` from a WOFF2 file in your assets.
- Ship the SMuFL metadata as JSON files: `glyphnames.json` (name → codepoint), and the font's own `bravura_metadata.json` (anchor points, glyph bounding boxes in sp).
- Build a small lookup module (`smufl.ts`) that exposes:
  - `glyphCodepoint(name: string): string` — returns the Unicode character to put in a `<text>`.
  - `glyphAnchor(name: string, anchor: string): {x, y} | null` — returns an anchor point in sp, e.g. where a stem-down attaches to a notehead.
  - `glyphBBox(name: string): {x, y, w, h} | null` — for measuring glyphs without rendering them.

The layout engine calls `smufl.*` for engraving decisions; the renderer calls only `glyphCodepoint`.

## Repository structure

Aim for something like:

```
src/
  mnx/
    types.ts          # types matching the MNX schema
    validate.ts       # optional: AJV-based validation
  layout/
    engine.ts         # entry point: layoutMnx(doc, viewport): { primitives, index }
    time.ts           # rhythm/fraction utilities
    staff.ts          # staff-line generation, clef positioning
    notes.ts          # noteheads, stems, accidentals
    beams.ts          # beam grouping and drawing
    slurs.ts          # slur / tie curve computation
    measures.ts       # measure-level layout, barlines
    systems.ts        # system breaks, multi-staff alignment
    pages.ts          # page breaks
    defaults.ts       # defaults when layout layer absent
  smufl/
    smufl.ts          # name → codepoint, anchors, bboxes
    glyphnames.json
    bravura_metadata.json
  render/
    svg.ts            # primitive list → SVG DOM
  primitives.ts       # the discriminated union type
  index.ts            # public entry: render(doc, target, opts)
```

The `layout/` directory is large; the `render/` directory should stay small.

## Testing strategy

Because the layers are clean, tests are clean:

- **Layout engine tests:** pure-function assertions. "Given this MNX snippet, the primitive list contains a `glyph` of kind `noteheadBlack` at position (12.5, 0)." No DOM, no SVG, runs in Node.
- **Renderer tests:** snapshot the emitted SVG string for a fixed primitive list input. Tiny in scope.
- **End-to-end tests:** render a known MNX file to SVG, compare to a golden file (probably visually, via puppeteer screenshots, or structurally by serialised SVG).

Lean on the engine tests heavily — they're where regressions will bite, and they're the cheapest tests to write because they're pure.

## What to build first

Build a vertical slice end-to-end before adding breadth:

1. Define the primitive type and the renderer. The renderer should be done in one sitting.
2. Implement the layout engine for a *minimal* MNX subset: one part, one staff, treble clef, 4/4 time, quarter and eighth notes only, no beams, no slurs, no accidentals. Just get notes on a staff.
3. Render it. Confirm it looks right.
4. Add one feature at a time: accidentals, then beams, then ties, then slurs, then dynamics, then multiple staves, then layouts.

Resist the urge to scaffold the whole feature set before anything renders. The architecture wants vertical slices.

## What not to do

- **Do not** import a music notation library (VexFlow, OpenSheetMusicDisplay, abcjs). The whole point is to own the engraving. If you find yourself wanting to, ask whether it's worth it — usually it isn't, because their data models leak into yours.
- **Do not** mix layout and rendering. If you catch yourself writing SVG-emitting code in `layout/`, stop. If you catch yourself making engraving decisions in `render/`, stop.
- **Do not** use pixels in Layer 2. Staff spaces only.
- **Do not** read the MNX document anywhere except in `layout/` and `mnx/`.
- **Do not** generate `id` values for primitives — only copy `sourceId` from MNX elements that already have ids. The renderer can add its own internal ids if it needs them for DOM purposes.
- **Do not** pull in React, Vue, or any framework yet. Vanilla TypeScript. Reactivity can come later as a separate concern, and the SVG renderer should work standalone.
- **Do not** invent your own glyph names. Use SMuFL canonical names exclusively. If you need a glyph SMuFL doesn't have (rare, but happens — e.g. for a stylised fret-number-in-rounded-rectangle), draw it as composed primitives (`rect` + `text`), not as a fake glyph name.
- **Do not** silently drop MNX features. If the engine encounters something it doesn't yet support, log a warning with the feature name and the location. This makes the "what's left to do" list self-documenting.

## A note on later flexibility

The architecture exists so a Canvas renderer can be added later by implementing a second consumer of the primitive list. When that day comes, the layout engine doesn't change. The new renderer lives alongside `render/svg.ts` as `render/canvas.ts` and exports a parallel API. Don't pre-emptively build the Canvas renderer or abstract for it — just keep the layout/render boundary clean enough that adding one is a self-contained piece of work.

The same applies to print, PDF export, and server-side rendering: all of them consume the primitive list, none of them need to know about each other.

## Style and tooling

- TypeScript, strict mode.
- No build complexity beyond `tsc` and a bundler of your choice (vite is fine).
- Format with prettier, lint with eslint. Defaults are fine.
- Functions, not classes, in `layout/`. The data flow is unidirectional; classes would be ceremony.
- Pure functions where possible. State (e.g. an id-to-primitive index being built incrementally) is fine when justified, but prefer returning new structures over mutating.

## Summary

The architecture is: **MNX → layout engine → primitive list → SVG**. The primitive list is the contract. Everything below it knows nothing about music; everything above it knows nothing about drawing. Keep that line clean and the codebase stays tractable, swappable, and testable.