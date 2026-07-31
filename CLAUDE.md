# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Rebuild in progress.** Main is being rebuilt from an empty slate per
> [roadmap/inprogress/structure-lab.md](roadmap/inprogress/structure-lab.md) — that doc is
> the authority; this file is a *forecast* of the target shape and is rewritten as-built in
> the final step. The full pre-rebuild tree and history are on the **`legacy` branch** and
> **`pre-rebuild` tag** — anything missing here is retrieved from there, never reconstructed
> from memory.

## What this repo is

**MNX Lab** (`mnx-lab`) — a test bench for the developing W3C MNX notation format with
emphasis on guitar tab. Custom SMuFL/SVG rendering engine (no third-party notation
libraries), Tone.js playback, an LLM-assisted edit loop. It runs **two development loops**,
and every artifact declares which it serves:

- **Implementation loop** — the spec is the constant, our code the variable. Scenarios are
  oracles; `status: verified` and the primitives goldens are verdicts about **our code**.
- **Spec loop** — our implementation is the (rough) constant, the schema the variable.
  `schema: proposed` scenarios are probes; their renders and verdicts are evidence about
  **the spec**, packaged for upstream via `spec/proposals/<topic>/`.

## Target shape (forecast)

```
spec/           the standard + our proposals: mnx-schema.json (verbatim pinned release),
                mnx-schema.proposed.json (generated from the proposal worktree),
                extension schemas, proposals/<topic>/ evidence bundles, tools/
                (sync-spec-examples, push-proposal, compile-validator)
scenarios/      one corpus format, two axes — origin: mirrored|local (spec/ vs lab/,
                an ownership boundary: sync owns spec/ wholesale) × schema:
                published|proposed (which schema judges expect.standard)
harness/        every way the evidence is exercised: conformance/ (corpus + primitives
                tests), verify/ (check/verify scripts — the only status mutation path),
                render/, helpers/; evals/ reserved
src/            capability layers: model → engine · audio · edit · corpus · storage;
                edit → assist; elements/ (embeddable Lit custom elements — Lit is
                load-bearing here only); ui/ (workbench shell, a leaf); entries/
worker/         Hono; secrets-and-validation proxy for assist ONLY — the workbench has
                no backend by rule (fully functional from static build output alone)
converters/     npm-workspace sub-packages (musicxml-mnx, guitarpro-mnx) + fixtures/
                (the .gpx-sourced scores; alphaTab never reachable from src/)
apps/studio/    placeholder README only — the future consumer product's reserved seam
vendor/mnx      the spec submodule, PIN ONLY (proposal branches live in git worktrees
                under ../mnx-proposals/, never checked out here)
```

Layer boundaries are machine-enforced: `.dependency-cruiser.cjs` +
`npm run check:boundaries` (wired into `npm run build`) — a violation is a red build.
`ui/` and `entries/` are leaves; anything two shells want must be promoted into
`elements/` or below. `model`/`engine`/`audio` stay importable from Node (no DOM at
module top level).

## Commands

```bash
npm run dev                # Vite dev server + Worker (via @cloudflare/vite-plugin)
npm test                   # harness suites over the scenario corpus
npm run check:scenarios    # corpus police (harness/verify/check-scenarios.mjs)
npm run verify:scenarios   # approval queue + provenance writer — use via /verify
npm run update:primitives  # regenerate layout goldens; keeps statuses honest
npm run sync:spec          # pinned spec fixture → scenarios/spec/ (owns that tree)
npm run build              # validators + boundaries + tsc + vite build
npm run deploy             # build + wrangler deploy (mnx-lab.totai.uk)
```

## Rules that survive the rebuild

- **`verified` is a human assertion** — only `verify-scenarios.mjs` (via the `/verify`
  skill conversation) writes `status: verified` and the `verification: {at,
  primitivesHash}` provenance record; the record is kept through demotion.
- **The primitives goldens are the crown jewels** — transplanted machinery must
  reproduce them byte-identically; a mismatch stops the line (diff against `legacy`).
- **No notation libraries** (VexFlow etc.); the SMuFL/SVG engine is ours. alphaTab is a
  format codec confined to `converters/guitarpro-mnx`.
- **`.mnx.json`** is the write extension for MNX documents (`.json`/`.mnx` accepted on
  read). `.ts` extensions in imports are required (`moduleResolution: bundler`).
- **`_x.mnxLab` v3** is the one vendor key for everything MNX can't express (tab,
  rehearsal/section, harmonies) — extend it and its schema, never standard MNX fields;
  register in [docs/mnx-extensions.md](docs/mnx-extensions.md).
- **Guitar Pro string numbering is inverted** relative to `_x.mnxLab.tab` — go through
  `converters/guitarpro-mnx/src/common/tuning.ts`, never open-code it.
- **The Worker never validates against the proposed schema** — the LLM edit loop must
  not be taught fields that don't exist yet.
- **The workbench has no backend**: corpus is committed JSON, documents are IndexedDB,
  verification writes happen through harness scripts editing repo files. If browser
  authoring is ever wanted, it's a dev-only Vite middleware writing repo files — never
  a deployed API. The real API layer is studio's, on the reserved seams.
- Interpret roadmap-shaped requests against `roadmap/` (proposed / inprogress /
  complete / superseded); index at [roadmap/README.md](roadmap/README.md).
