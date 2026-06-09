# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AI-first music notation editor for the W3C MNX format, with VexFlow rendering, Tone.js playback, and an LLM-powered "chat-to-edit" workflow that routes through OpenRouter. The app is a single Lit web component (`<mnx-editor-app>`) — the architectural goal is that the compiled bundle can be embedded anywhere via one script tag, so do **not** introduce React/Vue/state libraries (see `research/tech_stack.md`).

## Running the project

```bash
./start.sh                  # starts both Vite (5173) and the Express proxy (3000)
npm run dev                 # frontend only (Vite)
npm run build               # tsc + vite build
cd server && npm start      # backend proxy only
```

The Vite dev server proxies `/api/*` to `localhost:3000`, but the frontend currently calls `http://localhost:3000/api/edit-notation` directly (CORS-enabled on the server) — both servers must be running for the AI chat to work. `OPENROUTER_API_KEY` is read from `.env` at the repo root by `server/index.js`; if missing or placeholder, `/api/edit-notation` falls back to a regex-based mock in `handleMockCommand` (transpose / "whole note ending" / "double octave") so the UI stays demoable offline.

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
2. Server calls OpenRouter with a forced `tool_choice: update_document` function call, streams the response, accumulates `function.arguments`, parses, then validates against `schemas/mnx-schema.json` via Ajv 2020.
3. **On validation failure**: the server appends the assistant's failed `tool_calls` message plus a synthetic `role: 'tool'` error response back into `messages` and re-calls OpenRouter — up to `maxAttempts = 3`. Throughout, NDJSON `progress` frames keep the client UI alive.
4. `formatValidationErrors` deliberately filters out `anyOf`/`oneOf`/`allOf` noise and only the first `sequence-content/items/anyOf/0` branch (the `event` shape) so the LLM gets actionable feedback. Don't "fix" this by re-enabling all branches — it makes errors unusable.

When modifying the system prompt or tool schema in `server/index.js`, mirror any structural requirements (e.g. plural `notes` array vs singular `note`) — these LLM-facing rules are the project's primary defense against schema drift.

### MNX <-> VexFlow rendering

[src/utils/mnxToVexflow.ts](src/utils/mnxToVexflow.ts) is the bridge. Guitar fret/string assignment uses the `_x.guitar` vendor extension if all notes are annotated, otherwise falls back to a "lowest reasonable position" heuristic over `GUITAR_TUNING` (standard tuning, string 1 = high E). The viewer supports four `viewMode`s: `notation` / `tab` / `both` / `json`. VexFlow renders into a `<div>` inside the component's shadow root — the shadow boundary is what isolates VexFlow's SVG from host-page CSS, which is part of the embeddability story.

### MNX types and the `_x` extension

Project-internal MNX types live in [src/types/mnx.ts](src/types/mnx.ts). The W3C MNX schema does **not** include guitar tab data; this project uses the `_x` namespace as a vendor extension (formalized in [schemas/guitar-tab-extension.schema.json](schemas/guitar-tab-extension.schema.json)). When adding new tab/guitar features, extend `_x.guitar`, don't add fields at the standard MNX level — the official schema validator will reject them.

## Conventions worth knowing

- **Web Awesome (`wa-*`) components** are the UI kit — see `src/main.ts` for which are registered. `wa-icon` is wired to Bootstrap Icons via CDN. Don't introduce a different UI library.
- **`.ts` extensions in imports are required** (`allowImportingTsExtensions: true` in tsconfig, `moduleResolution: bundler`).
- **Decorator metadata is enabled** (`experimentalDecorators`, `emitDecoratorMetadata`) for Lit decorators. Do not flip these to standard decorators without testing the whole component tree.
- **No tests** exist for the frontend or the Express server — only the converter sub-package has vitest tests. Treat the converter as the closest thing to a reference for "correct" MNX shapes.
- The frontend `dist/` directory is checked in; treat it as a build artifact, not source.
