# Structure direction — the toolchain: a workspace of publishable packages

> **Status: superseded** (filed 2026-07-31; superseded same day by the adopted
> [lab-structure-lab.md](../complete/lab-structure-lab.md) direction, now under execution). One of four self-contained structure sketches —
> the others are [lab-structure-platform.md](lab-structure-platform.md),
> [lab-structure-workbench.md](lab-structure-workbench.md) and [lab-structure-lab.md](../complete/lab-structure-lab.md)
> (the likely direction of travel, which defers this plan rather than rejecting it). They
> are alternatives for a single decision; each is written to stand alone.

## Thesis

The lasting output of this project is a set of **reusable pieces**: a renderer that turns an
MNX document into SVG anywhere, converters that move documents in and out of MusicXML and
Guitar Pro, a player, embeddable elements. Apps — today's lab site, a future score-library
service — are thin compositions of those pieces. So the repo becomes an **npm-workspaces
monorepo whose unit of structure is the published package**, and whose discipline is a
one-way dependency graph.

This revives P2 ([lab-01-principles.md](../complete/lab-01-principles.md)) and the package split
sketched in [lab-02-architecture.md](lab-02-architecture.md) — but as an **extraction
from working code**, not a clean-room build. The contracts that plan could only sketch (C1
validate, C2 layout→primitives→draw, C6 corpus loader) now exist as proven internal seams in
`src/`, and the corpus gives the extraction a mechanical acceptance test: **a move is correct
when the 57/57-verified primitives snapshots don't change**.

## Target shape

```
packages/
  core/               @mnx-lab/core              document model: MNX types, _x.mnxLab types,
                                                 schemas (published + proposed + extensions),
                                                 validate(), upgrade v1→v3, note-key traversal,
                                                 .mnx.json file conventions
  layout/             @mnx-lab/layout            document → Primitive[]: notation + tab layouts,
                                                 spacing model, SMuFL metadata, beam/dynamics
                                                 logic, fret/string assignment, diagnostics,
                                                 bar-arithmetic validation
  render-svg/         @mnx-lab/render-svg        Primitive[] → SVG: emitter, bounds, px fitting
  audio/              @mnx-lab/audio             document → playback schedule; Tone.js transport,
                                                 synth, playhead (framework-free core)
  elements/           @mnx-lab/elements          Lit custom elements: <mnx-score-viewer>,
                                                 <mnx-score-editor> (placeholder), design tokens;
                                                 ships ESM + a self-contained IIFE embed bundle
  corpus/             @mnx-lab/corpus            scenarios/{spec,lab} data, manifest, scores
                                                 (the .gpx sources + derived files), loader API,
                                                 verification tooling
  convert-musicxml/   @mnx-lab/convert-musicxml  moved from converters/musicxml-mnx
  convert-guitarpro/  @mnx-lab/convert-guitarpro moved from converters/guitarpro-mnx
  cli/                @mnx-lab/cli               `mnx` bin: validate / render (png+svg) / convert
apps/
  lab/                the site: library rail, coverage dashboard, scenario page, assist
                      drawer, document pane, IndexedDB storage, embed.html demo host
  api/                the Cloudflare Worker: /api/edit-notation + /api/models; absorbs
                      server/prompts/editNotation.js and server/models.json; server/ deleted
roadmap/ docs/ research/ vendor/mnx    unchanged at root (vendor stays dev-time only)
```

## The dependency graph

Runtime edges point one way; violating them is a build error (enforced by package manifests —
a package literally cannot import what it doesn't declare).

```
                         core
        ┌─────────┬────────┼──────────┬─────────────┐
     layout     audio    corpus   convert-musicxml  convert-guitarpro
        │
   render-svg
        │
     elements ──────────── apps/lab · apps/api · cli (compose anything above)
```

- **dev-dependency edges may cross** where runtime edges may not: `layout`'s conformance
  tests devDepend on `corpus`; `corpus`'s preview tooling devDepends on `layout` +
  `render-svg`. Tests exercising a contract from outside are the point (P9).
- **alphaTab stays confined** to `convert-guitarpro`, which no browser-facing package may
  depend on. A bundle assertion in `elements` (grep the built embed bundle for alphaTab
  markers) turns CLAUDE.md's rule into a failing test.
- Cross-package imports go through package entry points (`@mnx-lab/core`), never deep
  `.ts` paths; the in-package `.ts`-extension convention is unchanged.

## Where everything lands

| Today | Becomes |
|---|---|
| `src/types/mnx.ts`, `src/utils/upgradeTabExtension.ts`, `src/utils/noteKeys.ts` | `packages/core` |
| `schemas/*.json`, `schemas/HISTORY.md`, `scripts/compile-validator.mjs` | `packages/core` — the precompiled Ajv validators become a build artifact of core, exported as `@mnx-lab/core/validators`; `apps/api` imports that export instead of owning `worker/generated/` |
| `converters/musicxml-mnx/src/common/mnxFile.ts` (shared file conventions) | `packages/core` — both converters import it instead of sharing by path |
| `src/primitives.ts`, `src/layout/*`, `src/smufl/*`, `src/tab/guitarPositions.ts`, `src/notation/notationRenderer.ts`, `src/tab/tabRenderer.ts` | `packages/layout` |
| `src/render/svg.ts`, `src/render/bounds.ts` | `packages/render-svg` |
| `src/utils/mnxToAudio.ts` + the transport/synth/playhead core of `PlaybackController` | `packages/audio` (the Lit `ReactiveController` shell stays with the UI that owns it) |
| `src/components/ScoreViewer.ts`, `src/components/marks.ts`, `src/styles/tokens.ts` | `packages/elements` |
| `src/components/*` (shell: app, rail, dashboard, drawer, panes), `src/controllers/*`, `src/contexts/*`, `src/utils/{jsonView,indexedDbRepository,pinnedErrors,defaultScore}.ts`, `src/types/repository.ts`, `index.html`, `embed.html` | `apps/lab` |
| `scenarios/**`, `scenarios/manifest.json`, `server/scores/*`, `src/library/corpus.ts`, `src/library/plumbingDefs.ts`, `scripts/{check,verify,sync-spec}-*.mjs` | `packages/corpus` |
| `worker/index.ts`, `server/prompts/editNotation.js`, `server/models.json` | `apps/api` (prompt module converted to `.ts`; `server/` deleted) |
| `scripts/render-png.ts`, `tests/helpers/*` | `packages/cli` (the headless render pipeline becomes the CLI's `mnx render`, ending the current `scripts/` → `tests/helpers` reach-around) |
| `tests/scenarios.test.ts` | `packages/corpus` (verdicts vs schemas) |
| `tests/primitives.test.ts`, `tests/tab-validation.test.ts` | `packages/layout` |
| `tests/preview.test.ts`, `tests/upgrade-extension.test.ts` | `packages/corpus`, `packages/core` |

## Build, test, publish wiring

- **npm workspaces** at the root; the converters' private `node_modules`/lockfiles merge
  into the root lock. Root scripts keep their familiar names and fan out
  (`npm test` → `vitest` workspace projects; `npm run update:primitives` → the layout
  package's script).
- **TypeScript**: per-package `tsconfig.json` extending a root base; packages emit `dist/`
  + `.d.ts` via `tsc`; apps stay `noEmit` + Vite. During dev, workspace linking resolves
  package imports to source so the edit-refresh loop doesn't require rebuilding.
- **Vite** remains only where there's a bundle: `apps/lab` (+ the Worker via
  `@cloudflare/vite-plugin`, unchanged) and `packages/elements`' embed build (IIFE +
  ESM single-file artifacts).
- **Publishing**: changesets (or equivalent) for versioning and changelogs; everything
  under `@mnx-lab/*` publishes 0.x, `apps/*` stay private. First acts: claim the npm
  scope; rename the converters from `@mnx-editor/*`.
- **Deploy** is untouched in behavior: `npm run deploy` builds `apps/lab` + `apps/api` and
  runs wrangler.

## Placeholders this plan needs

- **`<mnx-score-editor>`** in `elements`: wraps the viewer with selection plus two or three
  document operations (transpose selection, set fret, append measure) implemented as pure
  `(doc, op) → doc` functions in `core`. Its job is to prove the editing seam, not to be an
  editor.
- **`@mnx-lab/cli`**: `mnx validate|render|convert` shelling into core/layout/render-svg
  and the converters — mostly re-plumbing of `render-png.ts` and the existing converter bins.
- **`apps/api`**: no new behavior; the placeholder work is converting the prompt module to
  TypeScript inside the app.

## Migration phases (each leaves the repo green and deployable)

1. **Workspace-ify without moving code.** Add `"workspaces"`; adopt the two converters;
   absorb `server/prompts` + `server/models.json` into `worker/` and delete `server/`.
2. **Extract `core`.** Types, schemas, validator codegen, upgrade, note keys, file
   conventions. Converters and `src/` switch their imports to it.
3. **Extract `corpus`.** Scenario data + scores + loader + verification scripts;
   `tests/scenarios.test.ts` moves in.
4. **Extract `layout` + `render-svg`.** The load-bearing move; primitives snapshots move
   with it and must not change byte-for-byte.
5. **Split `elements` from `apps/lab`**; ship the embed bundle from `elements`; add the
   alphaTab bundle assertion.
6. **Extract `audio`; add `cli`; wire changesets and the first publish.**

## Done when

- `npm i && npm test && npm run deploy` work from a fresh clone exactly as today; 57/57
  scenario verifications stand without re-approval (snapshots unchanged).
- A third party can `npm i @mnx-lab/core @mnx-lab/layout @mnx-lab/render-svg` and render a
  scenario to SVG in Node without touching this repo — that script becomes a smoke test.
- The embed story is one `<script>` tag pointing at the `elements` IIFE artifact.
- CLAUDE.md is rewritten with a per-package map, and each package README states its
  contract in the C1/C2/C6 style.

## Open questions

- Is the `@mnx-lab` npm scope available (fallback: `mnx-lab-*` unscoped)?
- Does `corpus` publish its data (heavy, useful to others) or stay a private workspace
  package consumed only by tests and `apps/lab`?
- Where do the edit-stream NDJSON protocol types live once a second consumer appears —
  promoted to a small package, or kept co-located in `apps/lab`? (P8 says: not before.)
