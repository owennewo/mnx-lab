# 02 — Architecture

> **Stability: provisional.** The v1 module list and dependency rules are fairly firm; the
> exact contract shapes are sketches hardened in each module's spec. **A `modules/` spec may
> not be written until its contract appears here.**

## v1 surface (everything needed for the library + gallery)

| Package | Responsibility | Depends on |
|---------|----------------|-----------|
| `mnx-core` | The MNX document model: types, schema, validation, `_x` extension. The lingua franca. | (nothing) |
| `mnx-render` | Layout engine (document → primitives) + SVG renderer (primitives → SVG). Notation + tab. | `mnx-core` (types only) |
| `mnx-scenarios` | The scenario library (`spec/` mirror of the CG's worked examples + `lab/` hand-authored scenarios, incl. invalid-by-design). Starts as a plain `scenarios/` directory in-repo; promoted to a package only when something external needs to install it. See `../inprogress/lab-04-scenario-library.md`. | `mnx-core` (types only) |
| `gallery` | The browse app: enumerate the library, show JSON + validation status + rendered output. Read-only. | `mnx-core`, `mnx-render`, `mnx-scenarios` |

**Dependency rule (P2):** arrows point one way. `mnx-core` imports nothing internal. Nothing
imports `gallery`. `mnx-render` and `mnx-scenarios` never import each other — they only share
`mnx-core`. Violating this is a build error, not a style nit.

```
                 mnx-core
              ┌──────┼───────┐
        mnx-render  mnx-scenarios
              └──────┼───────┘
                  gallery
```

## Deferred packages (built in later phases — listed so the seams are reserved, not built)

| Package | Responsibility | Phase |
|---------|----------------|-------|
| `mnx-audio` | Document → playback schedule; Tone.js transport + playhead. | playback |
| `editor-app` | The editing shell + `DocumentRepository` storage; composes core/render/audio. | editing |
| `mnx-ai` | Chat-to-edit: the self-correcting NDJSON edit protocol + server proxy. | **last** |
| `mnx-convert` | MusicXML ⇄ MNX, standalone CLI + lib (mature in current repo). | any time, standalone |

## The v1 contracts (the seams)

These are the only surfaces packages know each other through. Sketches — exact signatures
land in each module spec.

### C1 — Document model (`mnx-core`) — *settled*
```
type MnxDocument        // typed MNX incl. _x extension
validate(doc): { valid: boolean, errors: ValidationError[] }
```
Everything downstream takes `MnxDocument` in. The library is the validation corpus.

### C2 — Render (`mnx-render`) — *the core contract*
```
render(doc: MnxDocument, opts: RenderOptions): SVGElement
// two stages with a typed boundary between them:
layout(doc: MnxDocument, opts): Primitive[]     // music-aware, no SVG
draw(primitives: Primitive[], opts): SVGElement // SVG-aware, no music
```
`Primitive[]` is the **document-agnostic boundary** (P3) — the door left open for
canvas/PDF later. `RenderOptions` carries `viewMode: 'notation' | 'tab' | 'both'`, sizing,
and SMuFL font resolution. Getting this right *is* the project right now.

### C6 — Scenario loader (`mnx-scenarios`) — *settled*
```
listScenarios(): ScenarioMeta[]                       // ids derived from paths
loadScenario(id): { meta, doc: MnxDocument, expectedPrimitives?: Primitive[] }
```
Consumed by corpus tests (assert `validate(doc)` matches each scenario's declared `expect`,
both standard and `_x.tab` verdicts; snapshot `layout(doc)` vs `expectedPrimitives`) and by
`gallery` (facet-driven browsing, live render). The committed reference artifact is the
primitive list, not SVG. One corpus, multiple consumers — and no loader package yet: the
gallery uses `import.meta.glob`, scripts walk the filesystem. See `../inprogress/lab-04-scenario-library.md`
for the layout and `meta.json` schema.

## Deferred contracts (reserved, defined when their phase arrives)
- **C3 — Audio:** `toSchedule(doc) → PlaybackSchedule`; `createPlayer(schedule)` with a
  playhead reported in document coordinates (so render can highlight without audio knowing SVG).
- **C4 — Convert:** `importMusicXml(xml) → MnxDocument`; `exportMnx(doc) → string`. Round-trip
  is the test surface (seed: `../complete/core-musicxml.md`, `../../converters/musicxml-mnx/`).
- **C5 — AI edit:** an `AsyncIterable<EditFrame>` NDJSON stream (`progress` / `done`), server
  forces a `tool_choice` function call, validates against `mnx-core`, self-corrects ≤3 attempts
  (seed: `../superseded/core-open-router.md`).

## Cross-cutting (introduced with the editing phase, not v1)
- **Storage — `DocumentRepository`** (IndexedDB via `idb-keyval`, key prefix `mnx-doc:`).
- **`_x.tab` extension schema (v2, single-source)**, owned by `mnx-core` (P7) — see
  `../../docs/mnx-extensions.md`.
- **Component events:** child→parent via bubbling `CustomEvent` with `composed: true`.

## Intentionally NOT in v1
No editor, no player, no AI, no plugin system, no auth, no collaboration, no canvas/PDF
renderer (the `Primitive[]` boundary leaves the door open — we just don't walk through it yet).
