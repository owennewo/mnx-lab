# Structure direction — the platform: one app, hard internal seams

> **Status: proposed** (filed 2026-07-31). One of four self-contained structure sketches —
> the others are [structure-toolchain.md](structure-toolchain.md),
> [structure-workbench.md](structure-workbench.md) and [structure-lab.md](structure-lab.md)
> (the likely direction of travel, which absorbs this plan's layer model and build faces).
> They are alternatives for a single decision; each is written to stand alone.

## Thesis

The repo is **one product**: the hosted lab at mnx-lab.totai.uk, growing over time into the
Soundslice-like service that manages a person's whole library of MNX documents. One package,
one version, one deploy. Structure means **capability layers inside `src/` with
machine-enforced import boundaries**, and the goals that sound like separate artifacts —
embed, library, SaaS — are served as **additional build faces of the same source tree**, not
as separate packages. Extraction stays cheap forever *because* the boundaries are enforced;
it just never happens speculatively.

The organizing question for every file becomes "which capability owns you?", answered by
seven layer directories with a one-way import order — the same discipline a package graph
buys, obtained with `git mv` and a lint rule instead of package manifests.

## Target shape

```
src/
  model/       MNX document model: types (mnx.ts), _x.mnxLab types, schema access,
               validate(), upgrade v1→v3, noteKeys traversal — imports nothing internal
  engine/      document → primitives → SVG: primitives.ts, layout/ (notation, tab, spacing,
               beams, dynamics, diagnostics, validate), smufl/, positions (guitarPositions),
               views (notationRenderer, tabRenderer), render/ (svg, bounds), plus
               headless.ts — the Node-safe compose-everything entry that scripts/ and
               tests/ currently reconstruct from tests/helpers
  audio/       mnxToAudio + the framework-free transport/synth/playhead core
  edit/        NEW (placeholder): EditOp catalog, applyOp(doc, op) → doc, undo history,
               selection model — the seed the editor UI and the AI loop both converge on
  assist/      the chat-to-edit client: NDJSON stream reader, frame types, mock fallback
               types — the protocol module the worker shares
  corpus/      scenario access: corpus.ts loader, plumbingDefs — data stays outside src/
  storage/     DocumentRepository, IndexedDbRepository, CloudRepository (reserved stub)
  ui/          components/, controllers/, contexts/, styles/ — everything Lit-rendered
  entries/     main.ts (app), embed.ts (element registration for the embed face),
               lib.ts (the deliberate public API re-export surface)
worker/
  index.ts     thin Hono wiring; routes split into api/edit-notation.ts + api/models.ts
  prompts/     editNotation.ts — moved from server/prompts and converted to TS
  api/documents.ts, api/auth.ts   reserved SaaS seams (501 stubs, no bindings yet)
  generated/   precompiled validators (unchanged)
scenarios/     unchanged (the corpus data contract in 04-scenario-library.md keeps its paths)
scores/        moved from server/scores — the .gpx sources + derived .mnx.json/.xml
converters/    unchanged in place; linked as npm workspaces for install/dedup only —
               Node-only satellites that feed the corpus, never part of the app build
server/        deleted
```

## The layer order and its enforcement

Lower layers never import higher ones. `model` is the floor; `ui` is the ceiling; `worker`
is a sibling ceiling that may only reach `model` and `assist` (it must stay DOM-free — its
own `tsconfig` already polices the runtime, the boundary rule polices the direction).

```
model → engine → audio ─┐
model → edit  → assist ─┼→ ui → entries
model → corpus ─────────┘
model → storage ────────┘
```

Enforcement is a committed **dependency-cruiser** (or eslint-boundaries) config plus
`npm run check:boundaries` wired into `npm run build`. The known existing violations become
the first fix list: `worker/index.ts` importing `../server/prompts/editNotation.js`, and
`scripts/render-png.ts` importing `tests/helpers/*` (both dissolve — the first via
`worker/prompts/`, the second via `engine/headless.ts`).

## Three build faces from one source

| Face | Entry | Artifact |
|---|---|---|
| **App** | `index.html` → `entries/main.ts` | today's site + Worker, deployed by wrangler |
| **Embed** | `embed.html` → `entries/embed.ts` | `dist/embed/mnx-lab.js` (IIFE + ESM), the one-script-tag element for third-party pages |
| **Library** | `entries/lib.ts` via a `build:lib` Vite lib-mode pass | the published **`mnx-lab` package** with subpath exports: `mnx-lab/model`, `mnx-lab/engine`, `mnx-lab/audio`, `mnx-lab/elements` |

The library goal is met by **one package with subpaths**, versioned with the app it's
extracted from. `model`, `engine`, and `audio` must stay importable from Node (no DOM at
module top level) so library consumers and headless scripts get the renderer for free —
`scripts/render-png.ts` already proves the pipeline runs headless; this makes that a
guarantee instead of an accident.

## The SaaS growth path (reserved, not built)

The service grows *inside* this structure rather than beside it, because Cloudflare is
already the platform: same origin, same Worker, same deploy.

- `storage/CloudRepository` implements the existing `DocumentRepository` interface over
  `/api/documents`, initially throwing "not configured" — the swap point
  `src/types/repository.ts` was designed for, now with a named occupant.
- `worker/api/documents.ts` + `worker/api/auth.ts` ship as 501 stubs; D1/KV bindings enter
  `wrangler.jsonc` only when the feature does.
- Accounts, sync, and purchased-library concerns land as new `worker/api/*` routes and a
  `storage/` implementation — no restructuring event required later.

## Where the ten goals live

| Goal | Home |
|---|---|
| Renderer | `engine/` (+ `mnx-lab/engine` export for headless SVG/PNG) |
| Converter | `converters/*` — workspace-linked, Node-only, alphaTab never reachable from `src/` |
| Player | `audio/` core + `ui/` playback chrome |
| Editor | `edit/` placeholder ops + `ui/` wiring behind a flag |
| Embedded | `entries/embed.ts` face |
| Library | `entries/lib.ts` face — the `mnx-lab` package subpaths |
| Corpus | `scenarios/` + `scores/` data, `corpus/` loader |
| SaaS | `worker/api/*` + `storage/` reserved seams |
| LLM experiments | `assist/` protocol + `worker/` loop |
| Spec support | `schemas/` + `vendor/mnx` + the proposal flow, all unchanged |

## Placeholders this plan needs

- **`edit/`**: an `EditOp` union with two or three ops (transpose selection, set fret,
  append measure), `applyOp`, and a history stack; one hidden toolbar button proving the
  wiring. The AI loop later emits `EditOp[]` instead of whole documents — noted as intent,
  not built now.
- **`storage/CloudRepository`** and the two 501 Worker routes.
- **`entries/lib.ts`** with an honest first surface: `validate`, `layout`, `renderSvg`,
  element registration — plus a `npm pack` dry-run test that the exports map resolves.

## Migration phases (each leaves the repo green and deployable)

1. **Dissolve `server/`.** Prompts + models.json into `worker/`; `server/scores` → `scores/`;
   delete the Express app; update the one frontend import of a `server/` path
   (`DocumentController`'s sample-score seed) to the new location.
2. **Re-shelve `src/` into the layer directories.** Pure `git mv` plus import rewrites; the
   acceptance test is byte-identical primitives snapshots and an unchanged built app.
3. **Turn the boundaries on.** Add dependency-cruiser + `check:boundaries` to `build`;
   burn down the violation list it prints (expected: a handful of ui→engine-internal
   reaches; `engine/headless.ts` absorbs `tests/helpers/*`).
4. **Add the embed and library faces.** `entries/` split, `build:lib`, exports map,
   pack-resolution test; embed demo page keeps working against the new artifact.
5. **Seed the placeholders.** `edit/` ops + flagged button; storage/Worker stubs.

## Done when

- One `npm run deploy` still ships everything; 57/57 scenario verifications stand without
  re-approval.
- `npx dependency-cruiser` (via `check:boundaries`) passes and is in the build, so a
  boundary violation is a red build, not a review comment.
- `npm pack` produces an installable `mnx-lab` whose `mnx-lab/engine` renders a scenario
  to SVG in Node — kept as a smoke test.
- CLAUDE.md's architecture section is rewritten around the seven layers and the layer
  order table.

## Open questions

- Is the `mnx-lab` npm name available for the published face?
- Does `corpus/` (the loader) belong in the published surface, or is the corpus an
  app-only concern until someone external asks?
- When the AI loop switches from whole-document replacement to `EditOp[]`, does `assist/`
  own the op schema or does `edit/`? (Default: `edit/` owns ops; `assist/` owns transport.)
