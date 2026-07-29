# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**MNX Lab** (package `mnx-lab`) — a test bench for the developing W3C MNX format with emphasis on guitar tab, evolving from an AI-first notation editor. Custom SMuFL/SVG rendering engine (no third-party notation libraries), Tone.js playback, and an LLM-powered "chat-to-edit" workflow that routes through OpenRouter. The app is a single Lit web component (`<mnx-editor-app>`) — the architectural goal is that the compiled bundle can be embedded anywhere via one script tag, so do **not** introduce React/Vue/state libraries (see `roadmap/complete/01-principles.md`, P5). The pivot plan (scenario library + gallery) — now largely executed in-place — lives under `roadmap/` (start at `roadmap/README.md`).

## Roadmap-driven development

Development is driven through the **`roadmap/`** folder (index: `roadmap/README.md`), which files planning docs by status: `proposed/` (described, not built), `inprogress/` (partially done / living contract), `complete/` (shipped, kept for provenance), `superseded/` (overtaken, kept for history). Interpret roadmap-shaped requests against it:
- **"add that to the roadmap"** (or "remember this for later", "note this as future work") → create a new doc under `roadmap/proposed/` capturing the idea, and add a one-line pointer to `roadmap/README.md`.
- **"what's next on the roadmap"** / "what should we work on" → look at the partially-completed items in **`roadmap/inprogress/`**, pick the one that makes the most sense to tackle next, and propose it before diving in. Also skim `roadmap/proposed/` for not-yet-started work.
- When an in-progress effort finishes, move its doc to `roadmap/complete/` and fix any references.

## Running the project

```bash
git submodule update --init vendor/mnx   # the MNX spec sources (dev-time only)
npm run dev                 # everything: Vite dev server + Worker API (via @cloudflare/vite-plugin)
npm run build               # validator codegen + tsc (app + worker) + vite build
npm run deploy              # build + wrangler deploy (mnx-lab.totai.uk)
npm run compile-validator   # regenerate worker/generated/validate-mnx.mjs after a schema bump
npm run sync:spec           # regenerate scenarios/spec/ from the pinned spec submodule
```

**`vendor/mnx` is the W3C MNX spec repo as a submodule**, pinned to the commit our
`schemas/mnx-schema.json` was generated from. It is **dev-time only** — `npm run build`
and the deploy must never depend on it, which is why the schema stays vendored and
`scenarios/spec/` stays committed. Everything about reading it, moving the pin, and
contributing PRs upstream (fork topology, the Django/`uv` doctools setup) is in
**[docs/mnx-spec-submodule.md](docs/mnx-spec-submodule.md)**. Upstream is a *generated*
site: the schema and docs are emitted from a Django fixture, so a spec change is a change
to `doctools/data.json`, never a hand-edit of `mnx-schema.json`.

### Proposing spec changes upstream

Contributing back to MNX is a **secondary goal of this repo** — the test bench exists partly
to find gaps, and a found gap is worth more as a merged spec change than as a private
workaround ([#529](https://github.com/w3c-cg/mnx/pull/529) is the worked precedent: bug →
issue → PR → merged as schema v26, our render now ships as a reference engraving on the spec
site). A proposal is *proved* rather than described:

1. **Draft it in the fork.** Branch `vendor/mnx`, edit via the Django admin, `freezedb`. The
   branch *is* the proposal.
2. **Generate `schemas/mnx-schema.proposed.json`** from that branch (`manage.py makesite`,
   then copy out `mnx-schema.json`). It sits *beside* the published schema, never replacing
   it — `schemas/mnx-schema.json` always stays a verbatim copy of the pinned upstream release.
3. **Write scenarios against it.** A scenario opts in with `"schema": "proposed"` in its
   `meta.json`; `expect.standard` is then judged against the proposal. Everything else keeps
   validating against the published spec, so a proposal can never quietly loosen the corpus.
4. **Render it**, so the proposal ships with engravings from a real implementation.
5. Then issue → PR upstream.

**The proposed schema is dev-time only, like the submodule.** The Worker's precompiled
validators and the `/api/edit-notation` retry loop use the **published** schema only — the
LLM must never be taught to emit fields that don't exist yet. When a proposal is adopted,
move the pin, re-vendor, and delete `mnx-schema.proposed.json` and the `"schema"`
declarations along with it.

The `/api/*` routes are a **Cloudflare Worker** ([worker/index.ts](worker/index.ts), Hono), served inside the Vite dev server by `@cloudflare/vite-plugin` — there is no separate backend process. `OPENROUTER_API_KEY` comes from `.dev.vars`/`.env` locally (both gitignored) and from a Worker secret (`wrangler secret put OPENROUTER_API_KEY`) in production. If the key is missing or a placeholder, `/api/edit-notation` falls back to a regex-based mock in `handleMockCommand` (transpose / "whole note ending" / "double octave") so the UI stays demoable offline.

**Workers can't run `ajv.compile()`** (no runtime code generation), so the schema validator is precompiled by [scripts/compile-validator.mjs](scripts/compile-validator.mjs) into `worker/generated/validate-mnx.mjs` (committed; regenerated automatically by `npm run build`). The legacy Express server in `server/` is retained for its prompt module (`server/prompts/editNotation.js`) and `server/models.json`, which the Worker imports directly — but it is no longer run.

### Converter sub-packages

`converters/*` are standalone npm packages, each with its own `tsconfig.json`, `vitest` and CLI bin. **None is wired into the main app build** — they are Node-only tools, and must stay that way (`@mnx-editor/guitarpro-mnx` pulls in alphaTab, ~13.7 MB unpacked, which must never reach the client bundle).

- **`converters/musicxml-mnx/`** (`@mnx-editor/musicxml-mnx`) — MusicXML ⇄ MNX, via `@xmldom/xmldom`.
- **`converters/guitarpro-mnx/`** (`@mnx-editor/guitarpro-mnx`) — Guitar Pro ⇄ MNX, via **alphaTab** (MPL-2.0) used purely as a headless format codec: `ScoreLoader.loadScoreFromBytes` in, `Gp7Exporter` out. Reads gp3/gp4/gp5/gpx/gp; **writes `.gp` (GP7) only** — no maintained tool can write gp3–gp5. alphaTab is a *file-format codec confined to this package*; CLAUDE.md's "no notation libraries" rule still stands, so never import it from `src/`. Status + findings: [roadmap/inprogress/guitar-pro.md](roadmap/inprogress/guitar-pro.md).

```bash
cd converters/<name>
npm run build               # tsc
npm run test                # vitest run
npx vitest run tests/roundtrip.test.ts -t "name"   # single test

npx musicxml-mnx  --import in.xml       [--output out.mnx.json]
npx musicxml-mnx  --export in.mnx.json  [--output out.xml]
npx guitarpro-mnx --import in.gp        [--output out.mnx.json]
npx guitarpro-mnx --export in.mnx.json  [--output out.gp]
```

`--output` is optional in both CLIs (defaults to the input name with the target extension) and a *derived* output name refuses to overwrite an existing file — `--export score.mnx.json` would otherwise clobber the `score.xml` it came from.

**Guitar Pro string numbering is inverted relative to `_x.mnxLab.tab`**: MNX counts string 1 = *highest*-pitched, Guitar Pro/alphaTab counts 1 = *lowest*. The conversion is isolated in `converters/guitarpro-mnx/src/common/tuning.ts` — go through those helpers, never open-code it.

**The score corpus is authored as Guitar Pro.** `server/scores/*.gpx` are the *sources*; `*.mnx.json` is generated from them and `*.xml` is generated from the MNX. Regenerate with `guitarpro-mnx --import x.gpx` then `musicxml-mnx --export x.mnx.json`. This is deliberate: Soundslice's **MusicXML** export drops all guitar technique (0 hammer-ons/bends across two scores that have them), loses the capo, and got a tuning alteration sign wrong — its **GPX** export of the same score carries all of it correctly. Prefer `.gpx` for anything leaving Soundslice.

**Both round trips are lossless and tested as such** — `MNX → .gp → MNX` and `MNX → MusicXML → MNX` preserve every note, technique, lyric, position, tuning, capo, key, repeat and volta on all three fixtures. Note *ids* are legitimately rewritten by the MusicXML notation/TAB split, so technique targets (`hammerOn.target` etc. are id references) must be compared by which note they resolve to, never by string equality.

**Section labels, rehearsal marks and chord symbols** all travel through both converters, on the **global** measure under `_x.mnxLab` — MNX v19 has no field for any of them (it models `segno`/`fine`/`jump` but no rehearsal mark, and the only free text in 188 `$defs` is lyrics and staff labels; there is no harmony concept at all). `_x` is schema-legal here: it's declared in the schema's `global-attrs`. Guitar Pro states a chord two unrelated ways and the corpus uses both — `beat.text` (Vestapol, 25) and a `Chord` object via `beat.chordId` (House of the Rising Sun, 14) — so read both. **Fretboard diagrams are not carried**: they belong on the part (a diagram depends on the tuning), and no file in the corpus fills one in.

**Lyrics** travel through both converters (multi-verse, with hyphenation). Two traps worth knowing: MusicXML allows `<lyric>` on **any** `<note>`, *including a `<rest>`* — most of `Sun-did-glide`'s syllables live on rests, so any code walking lyrics must not assume pitched notes. And Guitar Pro stores a verse as one whitespace-split text blob where a trailing `-` marks a continuing syllable (`shin-` + `ing`) and `+` escapes a space inside one; that maps onto MNX's `type: start|middle|end|whole`. Verse identity is positional in Guitar Pro, so `global.lyrics.lineOrder` is the mapping.

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

`DocumentRepository` ([src/types/repository.ts](src/types/repository.ts)) is the swap point for future cloud sync. The current `IndexedDbRepository` uses `idb-keyval` with key prefix `mnx-doc:`. `DocumentController.initDefaultDocument` seeds the "House of the Rising Sun" sample on first run by importing `server/scores/House-of-the-Rising-Sun.mnx.json` as a JSON module — note that this couples the frontend build to a path under `server/`, and `tsconfig.json` has `resolveJsonModule: true` to make it work (`.mnx.json` still ends in `.json`, so it resolves as a JSON module normally).

### AI editing flow (`/api/edit-notation`)

The chat endpoint is a **self-correcting NDJSON stream**, not a simple proxy:

1. Frontend POSTs `{ userPrompt, mnxJson, selectionContext, model }` and reads `application/x-ndjson` line-by-line. Each line is either `{type: 'progress', tokens, status}` or `{type: 'done', success, updatedMnxJson | error, explanation}`.
2. The Worker calls OpenRouter with a forced `tool_choice: update_document` function call, streams the response, accumulates `function.arguments`, parses, then validates **twice** via precompiled Ajv validators: against the official `schemas/mnx-schema.json`, and every `_x.mnxLab` vendor dict against `schemas/mnx-lab-extensions.schema.json`. Both verdicts gate the retry loop.
3. **On validation failure**: the Worker appends the assistant's failed `tool_calls` message plus a synthetic `role: 'tool'` error response back into `messages` and re-calls OpenRouter — up to `maxAttempts = 3`. Throughout, NDJSON `progress` frames keep the client UI alive.
4. `formatValidationErrors` deliberately filters out `anyOf`/`oneOf`/`allOf` noise and only the first `sequence-content/items/anyOf/0` branch (the `event` shape) so the LLM gets actionable feedback. Don't "fix" this by re-enabling all branches — it makes errors unusable.

When modifying the system prompt (`server/prompts/editNotation.js`) or the tool schema in `worker/index.ts`, mirror any structural requirements (e.g. plural `notes` array vs singular `note`) — these LLM-facing rules are the project's primary defense against schema drift.

### Rendering (custom SMuFL/SVG engine)

The pipeline is layout → primitives → SVG (see `SVG_RENDERING_ENGING.md`): [src/layout/notation.ts](src/layout/notation.ts) and [src/layout/tab.ts](src/layout/tab.ts) are pure functions emitting staff-space primitives; [src/render/svg.ts](src/render/svg.ts) is the dumb emitter. **All horizontal spacing** (bar widths, note spacing, system packing/justification) lives in [src/layout/spacing.ts](src/layout/spacing.ts) — a deterministic springs-and-rods model (log₂ duration springs, rigid glyph columns, greedy packing, capped justification) whose plan both layouts consume so notation and tab stay column-aligned in the `both` view. Tune spacing via the named knobs at the top of that file, never by reintroducing per-renderer grid math. The viewer's `viewMode`s are `notation` / `tab` / `both` (`both` stacks the two renderers); **JSON is not a view mode** — the document pane is an independent split pane. Fret/string assignment uses `_x.mnxLab.tab.position` if all notes are annotated, otherwise a "lowest reasonable position" heuristic over `GUITAR_TUNING` ([src/tab/guitarPositions.ts](src/tab/guitarPositions.ts)). The layouts render **forgivingly**: content they don't model (un-timed containers like tuplet/tremolo) degrades to a placeholder column instead of crashing, and every problem draws a per-measure "!" badge with a native `<title>` tooltip ([src/layout/diagnostics.ts](src/layout/diagnostics.ts)) — **red circle** = user-fixable validation error (bar duration arithmetic etc., from [src/layout/validate.ts](src/layout/validate.ts)), **blue circle** = warning (legal and possibly intentional, but ambiguous enough that consumers disagree), **amber box** = renderer gap; all surface on `LayoutResult.diagnostics`. `ValidationIssue` carries `severity` (`error` | `warning`) and an optional `scope: 'tab'` — tab-scoped issues are *fingerboard* constraints, so the notation renderer drops them (that bar engraves fine there) while the tab renderer keeps them. Getting severity right matters: a warning must not read as "you made a mistake", and the schema validators must never see these at all (they'd reject valid MNX and poison the AI retry loop). Everything renders into the component's shadow root — the shadow boundary is the embeddability story. Do **not** reintroduce VexFlow or any notation library.

### MNX types and the `_x.mnxLab` extensions (v3)

**File extension: MNX documents are written as `.mnx.json`.** MNX is JSON, and the double extension keeps a document recognisable as MNX while every editor, formatter and schema tool still treats it as JSON. This is the convention across the repo — the scenario corpus (`scenarios/{spec,lab}/*/score.mnx.json`) and `server/scores/*.mnx.json`. **`.json` and `.mnx` are accepted secondary extensions on read** (third-party documents, older files, and `.mnx` as it appears in the wild), but nothing in this repo should *write* them. The converters share the helpers in [converters/musicxml-mnx/src/common/mnxFile.ts](converters/musicxml-mnx/src/common/mnxFile.ts) (`MNX_EXTENSION`, `MNX_READ_EXTENSIONS`, `resolveMnxInputPath`, `defaultMnxOutputPath`) so any new converter agrees on this without restating it — the CLI's `--output` is optional and defaults to `.mnx.json`.

Project-internal MNX types live in [src/types/mnx.ts](src/types/mnx.ts). Everything this project carries that W3C MNX v19 cannot express lives under **one vendor key, `_x.mnxLab`** — **v3**. The `_x` sub-key names an *agent, vendor or community* ([w3c-cg/mnx#429](https://github.com/w3c-cg/mnx/issues/429)), not a feature, which is why v2's `_x.tab` / `_x.section` were re-namespaced. Schema: [schemas/mnx-lab-extensions.schema.json](schemas/mnx-lab-extensions.schema.json); the register of what's in there, why MNX lacks it, and which CG issue each block drafts: **[docs/mnx-extensions.md](docs/mnx-extensions.md)**. Three placement points, validated as whole vendor dicts: `note._x.mnxLab`, `part._x.mnxLab`, `global.measures[i]._x.mnxLab`.

- **`tab`** — **single-source**: music is encoded once, notes carry `tab.position` (string/fret), and tab-ness is the part-level `tab.staffKind` view flag. There are **no TAB clefs** (invalid MNX) and **no duplicated tab staves**. `tab.technique` covers bends (a **curve** of `{position, alter}` points, `alter` in *semitones* like `pitch.alter` — not a single interval), slides, hammer-ons, pull-offs, vibrato, harmonics and palm mute.
- **`rehearsal`** / **`section`** — two *separate* objects on the global measure, each `{label}`. A rehearsal mark is an arbitrary index into the score; a section name states what the music is. Guitar Pro conflates them; don't re-merge them.
- **`harmonies`** — chord symbols, an array on the **global** measure parallel to `tempos`. Structured (`root`/`quality`/`bass`/`degrees`) *and* literal (`text`, present only when the source spelling differs from the canonical rendering).

Each block is shaped like the standard MNX object it is a draft of, so adoption upstream would mean deleting the `_x.mnxLab` wrapper rather than rewriting data — that means MNX's own idioms (camelCase names *and* enum values, `rhythmic-position` for metric positions, note-id references for spanner targets, plain `string` for text). When adding features, extend `_x.mnxLab` (and its schema), never standard MNX fields. Saved documents are upgraded v1 → v2 → v3 on load by [src/utils/upgradeTabExtension.ts](src/utils/upgradeTabExtension.ts).

## Conventions worth knowing

- **Web Awesome (`wa-*`) components** are the UI kit — see `src/main.ts` for which are registered. `wa-icon` is wired to Bootstrap Icons via CDN. Don't introduce a different UI library.
- **`.ts` extensions in imports are required** (`allowImportingTsExtensions: true` in tsconfig, `moduleResolution: bundler`).
- **Decorator metadata is enabled** (`experimentalDecorators`, `emitDecoratorMetadata`) for Lit decorators. Do not flip these to standard decorators without testing the whole component tree.
- **Tests**: root vitest (`npm test`) checks the scenario corpus (`tests/scenarios.test.ts`) and layout snapshots over it (`tests/primitives.test.ts` — regenerate with `npm run update:primitives` when layout output legitimately changes). The Worker and UI components have no tests; the converter sub-package has its own vitest suite and is the closest reference for "correct" MNX shapes.
- **Scenario verification**: `verified` status is a *human* assertion — never set it by editing `meta.json` directly. The spec-by-spec approval process (compare each `spec/` render to the MNX reference engraving, fix gaps, mark verified) is recorded in **[SPEC_APPROVAL.md](roadmap/complete/SPEC_APPROVAL.md)** (the initial sweep is **complete — 57/57 verified**) — read it before working on renderer correctness; it holds the per-scenario scoreboard, the approval bar, the renderer's capabilities + deferred-polish backlog, and the "how to add a renderer feature" recipe (still the process for verifying any newly-added scenario). `npm run preview:scenarios` writes a contact sheet to `scenarios/.preview/index.html` (our render beside the spec's reference engraving for `spec/` scenarios); tick the correct ones and run the `node scripts/verify-scenarios.mjs <ids>` command it assembles (`--list` shows the queue). `npm run update:primitives` keeps statuses honest automatically: first snapshot promotes `valid`→`rendered`, a changed snapshot demotes `verified`→`rendered` (back into the approval queue), a layout crash demotes to `valid`.
- `dist/` is a build artifact and is gitignored (it contains both the client build and the Worker bundle).
