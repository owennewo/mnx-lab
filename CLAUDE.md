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

### Lit + context + ReactiveController pattern

State lives in two places and is mirrored, not unified:

1. **ReactiveControllers** (`src/controllers/`) own the canonical mutable state and side effects — `DocumentController` holds the active `MnxDocument` and debounces saves to IndexedDB; `PlaybackController` owns the Tone.js transport, synth, and playhead tracker.
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

The pipeline is layout → primitives → SVG (see `SVG_RENDERING_ENGING.md`): [src/layout/notation.ts](src/layout/notation.ts) and [src/layout/tab.ts](src/layout/tab.ts) are pure functions emitting staff-space primitives; [src/render/svg.ts](src/render/svg.ts) is the dumb emitter. The viewer supports four `viewMode`s: `notation` / `tab` / `both` / `json` — `both` stacks the two renderers. Fret/string assignment uses `_x.tab.position` if all notes are annotated, otherwise a "lowest reasonable position" heuristic over `GUITAR_TUNING` ([src/tab/guitarPositions.ts](src/tab/guitarPositions.ts)). Everything renders into the component's shadow root — the shadow boundary is the embeddability story. Do **not** reintroduce VexFlow or any notation library.

### MNX types and the `_x.tab` extension (v2)

Project-internal MNX types live in [src/types/mnx.ts](src/types/mnx.ts). The W3C MNX schema does **not** include tab data; this project's tablature extension lives under `_x.tab` — **v2, single-source**: music is encoded once, notes carry `_x.tab.position` (string/fret), and tab-ness is the part-level `_x.tab.staffKind` view flag. There are **no TAB clefs** (invalid MNX) and **no duplicated tab staves**. Schema: [schemas/mnx-tab-extension.schema.json](schemas/mnx-tab-extension.schema.json); rationale and MusicXML mapping: [docs/tab-extension-spec.md](docs/tab-extension-spec.md). The v1 `_x.guitar` form is deprecated; saved documents are upgraded on load by [src/utils/upgradeTabExtension.ts](src/utils/upgradeTabExtension.ts). When adding tab features, extend `_x.tab` (and its schema), never standard MNX fields.

## Conventions worth knowing

- **Web Awesome (`wa-*`) components** are the UI kit — see `src/main.ts` for which are registered. `wa-icon` is wired to Bootstrap Icons via CDN. Don't introduce a different UI library.
- **`.ts` extensions in imports are required** (`allowImportingTsExtensions: true` in tsconfig, `moduleResolution: bundler`).
- **Decorator metadata is enabled** (`experimentalDecorators`, `emitDecoratorMetadata`) for Lit decorators. Do not flip these to standard decorators without testing the whole component tree.
- **No tests** exist for the frontend or the Worker — only the converter sub-package has vitest tests. Treat the converter as the closest thing to a reference for "correct" MNX shapes.
- `dist/` is a build artifact and is gitignored (it contains both the client build and the Worker bundle).
