# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**MNX Lab** (package `mnx-lab`) — a test bench for the developing W3C MNX format with emphasis on guitar tab, evolving from an AI-first notation editor. Custom SMuFL/SVG rendering engine (no third-party notation libraries), Tone.js playback, and an LLM-powered "chat-to-edit" workflow that routes through OpenRouter. The app is a single Lit web component (`<mnx-editor-app>`) — the architectural goal is that the compiled bundle can be embedded anywhere via one script tag, so do **not** introduce React/Vue/state libraries (see `research/tech_stack.md`). The pivot plan (scenario library + gallery) lives in `clean_room_impl/`.

## Running the project

```bash
npm run dev                 # everything: Vite dev server + Worker API (via @cloudflare/vite-plugin)
npm run build               # validator codegen + tsc (app + worker) + vite build
npm run deploy              # build + wrangler deploy (mnx-lab.totai.uk)
npm run compile-validator   # regenerate worker/generated/validate-mnx.mjs after a schema bump
```

The `/api/*` routes are a **Cloudflare Worker** ([worker/index.ts](worker/index.ts), Hono), served inside the Vite dev server by `@cloudflare/vite-plugin` — there is no separate backend process. `OPENROUTER_API_KEY` comes from `.dev.vars`/`.env` locally (both gitignored) and from a Worker secret (`wrangler secret put OPENROUTER_API_KEY`) in production. If the key is missing or a placeholder, `/api/edit-notation` falls back to a regex-based mock in `handleMockCommand` (transpose / "whole note ending" / "double octave") so the UI stays demoable offline.

**Workers can't run `ajv.compile()`** (no runtime code generation), so the schema validator is precompiled by [scripts/compile-validator.mjs](scripts/compile-validator.mjs) into `worker/generated/validate-mnx.mjs` (committed; regenerated automatically by `npm run build`). The legacy Express server in `server/` is retained for its prompt module (`server/prompts/editNotation.js`) and `server/models.json`, which the Worker imports directly — but it is no longer run.

### MusicXML converter sub-package

`converters/musicxml-mnx/` is a standalone npm package (`@mnx-editor/musicxml-mnx`) with its own `tsconfig.json` and `vitest`. It's not wired into the main app build.

```bash
cd converters/musicxml-mnx
npm run build               # tsc
npm run test                # vitest run
npx vitest run tests/import.test.ts -t "name"   # single test
npx musicxml-mnx --import in.xml --output out.json
npx musicxml-mnx --export in.json --output out.xml
```

## Architecture

### The "reading room" UI (2026-06 redesign)

The front-end follows the design handoff in `claude_design/design_handoff_mnx_lab_redesign/` (rationale: its `DIRECTION.md`). The scenario library is permanent navigation (`mnx-library-rail`, faceted: category/status/source/$def), the scenario page is the main surface (`mnx-scenario-header` + `mnx-score-toolbar` + paper `mnx-score-viewer` + `mnx-document-pane`), the **coverage dashboard is the empty state** (`mnx-coverage-dashboard`), and AI chat is demoted to an Assist drawer (`mnx-assist-drawer`) that only ever edits transient **sketches** (fork-to-sketch), never corpus documents. Design tokens live on the app's `:host` ([src/styles/tokens.ts](src/styles/tokens.ts)) — light/dark chrome, but **score paper never inverts**. The note↔JSON cross-highlight depends on stable note keys: layouts synthesize positional keys for id-less documents ([src/utils/noteKeys.ts](src/utils/noteKeys.ts)) and [src/utils/jsonView.ts](src/utils/jsonView.ts) mirrors the same traversal to anchor document lines — keep these two in lockstep.

`<mnx-editor-app>` is also the embed: `mode="viewer"` (one-scenario card) and `mode="gallery"` (host-sized library), themed via `--mnx-*` custom properties; see `embed.html` for the demo host page and the attribute reference. Compact embed chrome is a named container query (`mnx-embed`) — no ResizeObserver.

### Lit + context + ReactiveController pattern

State lives in two places and is mirrored, not unified:

1. **ReactiveControllers** (`src/controllers/`) own the canonical mutable state and side effects — `ScenarioLibraryController` owns corpus browsing (facet/filter/query/selection, lazy score+notes loading); `PlaybackController` owns the Tone.js transport, synth, and playhead tracker; `DocumentController` (IndexedDB saved scores) is retained but no longer surfaced by the shell.
2. **`@lit/context` providers** on `MnxEditorApp` (`mnxDocumentContext`, `playbackStateContext`, `selectionContext`) expose plain-data snapshots to descendants.

`MnxEditorApp.willUpdate()` copies controller fields into the `@provide`d `@state` properties every render cycle — this is the seam that fans controller mutations out to consumers. When adding new shared state, follow this pattern: mutate on the controller, mirror in `willUpdate`, consume via `@consume({ subscribe: true })`. Don't try to put a controller instance directly into context.

Child-to-parent communication uses bubbling DOM `CustomEvent`s with `composed: true` (so they cross the Shadow DOM boundary). The root component listens and dispatches to controllers — see `handleChatCommand`, `handleNoteSelect`, etc. in [src/components/MnxEditorApp.ts](src/components/MnxEditorApp.ts).

### Storage abstraction

`DocumentRepository` ([src/types/repository.ts](src/types/repository.ts)) is the swap point for future cloud sync. The current `IndexedDbRepository` uses `idb-keyval` with key prefix `mnx-doc:`. `DocumentController.initDefaultDocument` seeds the "House of the Rising Sun" sample on first run by importing `server/scores/House-of-the-Rising-Sun.json` as a JSON module — note that this couples the frontend build to a path under `server/`, and `tsconfig.json` has `resolveJsonModule: true` to make it work.

### AI editing flow (`/api/edit-notation`)

The chat endpoint is a **self-correcting NDJSON stream**, not a simple proxy:

1. Frontend POSTs `{ userPrompt, mnxJson, selectionContext, model }` and reads `application/x-ndjson` line-by-line. Each line is either `{type: 'progress', tokens, status}` or `{type: 'done', success, updatedMnxJson | error, explanation}`.
2. The Worker calls OpenRouter with a forced `tool_choice: update_document` function call, streams the response, accumulates `function.arguments`, parses, then validates **twice** via precompiled Ajv validators: against the official `schemas/mnx-schema.json`, and every `_x.tab` object against `schemas/mnx-tab-extension.schema.json`. Both verdicts gate the retry loop.
3. **On validation failure**: the Worker appends the assistant's failed `tool_calls` message plus a synthetic `role: 'tool'` error response back into `messages` and re-calls OpenRouter — up to `maxAttempts = 3`. Throughout, NDJSON `progress` frames keep the client UI alive.
4. `formatValidationErrors` deliberately filters out `anyOf`/`oneOf`/`allOf` noise and only the first `sequence-content/items/anyOf/0` branch (the `event` shape) so the LLM gets actionable feedback. Don't "fix" this by re-enabling all branches — it makes errors unusable.

When modifying the system prompt (`server/prompts/editNotation.js`) or the tool schema in `worker/index.ts`, mirror any structural requirements (e.g. plural `notes` array vs singular `note`) — these LLM-facing rules are the project's primary defense against schema drift.

### Rendering (custom SMuFL/SVG engine)

The pipeline is layout → primitives → SVG (see `SVG_RENDERING_ENGING.md`): [src/layout/notation.ts](src/layout/notation.ts) and [src/layout/tab.ts](src/layout/tab.ts) are pure functions emitting staff-space primitives; [src/render/svg.ts](src/render/svg.ts) is the dumb emitter. **All horizontal spacing** (bar widths, note spacing, system packing/justification) lives in [src/layout/spacing.ts](src/layout/spacing.ts) — a deterministic springs-and-rods model (log₂ duration springs, rigid glyph columns, greedy packing, capped justification) whose plan both layouts consume so notation and tab stay column-aligned in the `both` view. Tune spacing via the named knobs at the top of that file, never by reintroducing per-renderer grid math. The viewer's `viewMode`s are `notation` / `tab` / `both` (`both` stacks the two renderers); **JSON is not a view mode** — the document pane is an independent split pane. Fret/string assignment uses `_x.tab.position` if all notes are annotated, otherwise a "lowest reasonable position" heuristic over `GUITAR_TUNING` ([src/tab/guitarPositions.ts](src/tab/guitarPositions.ts)). The layouts render **forgivingly**: content they don't model (un-timed containers like tuplet/tremolo) degrades to a placeholder column instead of crashing, and every problem draws a per-measure "!" badge with a native `<title>` tooltip ([src/layout/diagnostics.ts](src/layout/diagnostics.ts)) — red circle = user-fixable validation issue (bar duration arithmetic etc., from [src/layout/validate.ts](src/layout/validate.ts)), amber box = renderer gap; both also surface on `LayoutResult.diagnostics`. Everything renders into the component's shadow root — the shadow boundary is the embeddability story. Do **not** reintroduce VexFlow or any notation library.

### MNX types and the `_x.tab` extension (v2)

Project-internal MNX types live in [src/types/mnx.ts](src/types/mnx.ts). The W3C MNX schema does **not** include tab data; this project's tablature extension lives under `_x.tab` — **v2, single-source**: music is encoded once, notes carry `_x.tab.position` (string/fret), and tab-ness is the part-level `_x.tab.staffKind` view flag. There are **no TAB clefs** (invalid MNX) and **no duplicated tab staves**. Schema: [schemas/mnx-tab-extension.schema.json](schemas/mnx-tab-extension.schema.json); rationale and MusicXML mapping: [docs/tab-extension-spec.md](docs/tab-extension-spec.md). The v1 `_x.guitar` form is deprecated; saved documents are upgraded on load by [src/utils/upgradeTabExtension.ts](src/utils/upgradeTabExtension.ts). When adding tab features, extend `_x.tab` (and its schema), never standard MNX fields.

## Conventions worth knowing

- **Web Awesome (`wa-*`) components** are the UI kit — see `src/main.ts` for which are registered. `wa-icon` is wired to Bootstrap Icons via CDN. Don't introduce a different UI library.
- **`.ts` extensions in imports are required** (`allowImportingTsExtensions: true` in tsconfig, `moduleResolution: bundler`).
- **Decorator metadata is enabled** (`experimentalDecorators`, `emitDecoratorMetadata`) for Lit decorators. Do not flip these to standard decorators without testing the whole component tree.
- **Tests**: root vitest (`npm test`) checks the scenario corpus (`tests/scenarios.test.ts`) and layout snapshots over it (`tests/primitives.test.ts` — regenerate with `npm run update:primitives` when layout output legitimately changes). The Worker and UI components have no tests; the converter sub-package has its own vitest suite and is the closest reference for "correct" MNX shapes.
- **Scenario verification**: `verified` status is a *human* assertion — never set it by editing `meta.json` directly. The spec-by-spec approval process (compare each `spec/` render to the MNX reference engraving, fix gaps, mark verified) is an **ongoing task tracked in [SPEC_APPROVAL.md](SPEC_APPROVAL.md)** — read it before working on renderer correctness; it holds the live per-scenario scoreboard, the approval bar, the renderer's known gaps, and the "how to add a renderer feature" recipe. `npm run preview:scenarios` writes a contact sheet to `scenarios/.preview/index.html` (our render beside the spec's reference engraving for `spec/` scenarios); tick the correct ones and run the `node scripts/verify-scenarios.mjs <ids>` command it assembles (`--list` shows the queue). `npm run update:primitives` keeps statuses honest automatically: first snapshot promotes `valid`→`rendered`, a changed snapshot demotes `verified`→`rendered` (back into the approval queue), a layout crash demotes to `valid`.
- `dist/` is a build artifact and is gitignored (it contains both the client build and the Worker bundle).
