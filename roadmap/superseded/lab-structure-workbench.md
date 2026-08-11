# Structure direction — the workbench: organize around spec, corpus and evidence

> **Status: superseded** (filed 2026-07-31; superseded same day by the adopted
> [lab-structure-lab.md](../complete/lab-structure-lab.md) direction, now under execution). One of four self-contained structure sketches —
> the others are [lab-structure-toolchain.md](lab-structure-toolchain.md),
> [lab-structure-platform.md](lab-structure-platform.md) and [lab-structure-lab.md](../complete/lab-structure-lab.md)
> (the likely direction of travel, which absorbs this plan's `spec/`/`corpus/`/`harness/`
> restructure). They are alternatives for a single decision; each is written to stand alone.

## Thesis

What makes this repo unlike every other notation project is not its application code — it is
the **evidence it produces about MNX**: a scenario corpus with human-verified engravings,
byte-stable layout goldens, lossless round-trip proofs across two foreign formats, a
proposed-schema pipeline with rendered reference output, and (nascent) measurements of
whether LLMs can manipulate MNX documents. Today those assets are scattered in ways that
hide them: schemas at the root, the score corpus inside a dead Express app (`server/scores`),
verification tooling split between `scripts/` and `tests/` (with `scripts/render-png.ts`
importing `tests/helpers/*`), and the upstream-proposal process existing only as CLAUDE.md
prose.

This plan restructures the repo **around the data and the experiments, and deliberately
leaves the application code where it is**. `src/` and `worker/` are the *apparatus*; the top
level becomes the lab notebook: `spec/` (the claims), `corpus/` (the specimens), `harness/`
(the experiments), `converters/` (the codecs), `cli/` (the tool you hand to someone else).

## Target shape

```
spec/                        the standard and our proposals against it
  mnx-schema.json            moved from schemas/ (still a verbatim copy of the pinned release)
  mnx-schema.proposed.json   moved; regenerated from the fork branch as today
  mnx-lab-extensions.schema.json, spec-prose.json, HISTORY.md
  proposals/<topic>/         NEW — one directory per upstream proposal: README with CG issue
                             links + fork branch name, the schema diff, pointers to the
                             scenarios that opt in via "schema": "proposed", and the rendered
                             evidence that ships with the proposal. Seeded from the three
                             live topics (score-text, chord-symbols, guitar-technique).
  tools/                     sync-spec-examples.mjs, specSource.mjs, compile-validator.mjs
corpus/                      every MNX document the lab owns, one addressing scheme
  scenarios/{spec,lab}/      moved from scenarios/ (ids, meta.json, goldens unchanged)
  scores/                    moved from server/scores — .gpx sources + derived .mnx.json/.xml,
                             each gaining a small meta.json (provenance, status) so full
                             scores shelve in the library rail beside scenarios
  manifest.json, preview/    (preview/ was scenarios/.preview)
harness/                     every way the corpus is exercised — merges tests/ and scripts/
  conformance/               scenarios.test.ts, primitives.test.ts, tab-validation.test.ts,
                             upgrade-extension.test.ts
  helpers/                   corpusPrimitives.ts, svgString.ts — the shared headless entry,
                             now a first-class module instead of a tests/ reach-around
  verify/                    verify-scenarios.mjs, preview.test.ts, check-scenarios.mjs
  render/                    render-png.ts (reference engravings for spec/ proposals)
  roundtrip/                 NEW — corpus-wide MNX ⇄ .gp and MNX ⇄ MusicXML sweeps driving
                             the converter CLIs over corpus/scores (the converters' own unit
                             suites stay theirs; this is the black-box pass over everything)
  evals/                     NEW — the LLM-edit experiments made reproducible:
                             cases/<name>/{prompt.md, before.mnx.json, expect.*}, a runner
                             that drives the worker's edit loop per model in models.json,
                             committed scored results per run
src/  worker/                the apparatus — unchanged internally, except: worker absorbs
                             server/prompts + models.json (server/ deleted), the edit loop's
                             core factors into worker/editLoop.ts so harness/evals can call
                             it directly without HTTP, and path constants update to spec/ +
                             corpus/
converters/                  unchanged in place — self-contained Node packages, exercised
                             from outside by harness/roundtrip
cli/                         NEW — the `mnx` bin: validate | render | convert | verify | eval,
                             thin wrappers over spec/tools, harness, and the converters
roadmap/ docs/ research/ vendor/mnx    unchanged
```

## What the restructure buys

- **The proposal pipeline becomes structure.** CLAUDE.md's five-step "prove it, then PR"
  flow gets a home: a proposal is *done* when its `spec/proposals/<topic>/` directory holds
  a schema diff, opting-in scenarios, and rendered engravings — the evidence bundle the CG
  post links to. The roadmap docs keep the narrative; the proposal directory keeps the
  artifacts.
- **One corpus, one addressing scheme.** Scenarios and full scores stop being two systems
  (`scenarios/` with meta + goldens vs bare files under `server/`); a score is just a big
  scenario with provenance. Coverage math, the library rail, and round-trip sweeps all
  enumerate the same tree.
- **The experiments stop hiding in test files.** `scripts/` vs `tests/` was a distinction
  about *invocation* (manual vs vitest); `harness/` is organized by *question* —
  does it conform, does it round-trip, does it verify, can a model edit it.
- **Evals make the AI goal falsifiable.** "Can I say *copy bars 4–8 and append*?" becomes
  `harness/evals/cases/copy-bars/`, scored per model, re-run after every prompt or schema
  change — regression protection for `server/prompts/editNotation.js`'s successor that
  today doesn't exist at all.

## Where the ten goals live

| Goal | Home |
|---|---|
| Renderer | `src/` apparatus, unchanged; proven headless via `harness/render` |
| Converter | `converters/` + the `harness/roundtrip` black-box sweep |
| Player | `src/` apparatus, unchanged |
| Editor | seeded *by the evals*: the diff/apply utilities `harness/evals` needs to assert "expected document reached" are the first real edit-op code, shared with `src/` later |
| Embedded | the existing `embed.html` face, unchanged |
| Library-for-others | `cli/` (`mnx` bin) + the corpus itself as a public artifact |
| Corpus | `corpus/` — the center of the repo |
| SaaS | a future face of the bench; nothing here blocks it, nothing serves it yet |
| LLM experiments | `harness/evals/` — first-class, scored, reproducible |
| Spec support | `spec/` + `spec/proposals/` — the centerpiece |

## Placeholders this plan needs

- **`harness/evals` v0**: three cases (transpose a bar, copy-bars-and-append, add a
  hammer-on), a runner calling `worker/editLoop.ts` directly with one model, an
  assert-by-document-equality checker (id-insensitive, the way the round-trip tests
  already compare), results written to a dated JSON.
- **`cli/` skeleton**: `mnx validate <file>` and `mnx render <file> --png` re-plumbed from
  existing code; `convert` shells to the converter bins; `verify`/`eval` invoke harness
  entries.
- **`corpus/scores/*/meta.json`**: provenance (`source: gpx`, exporter), status — enough
  for the rail to shelve them.

## Migration phases (each leaves the repo green and deployable)

1. **Dissolve `server/`.** Prompts + models.json into `worker/`; scores into
   `corpus/scores/`; delete the Express app; fix the frontend's sample-score import path.
2. **Move the data.** `schemas/` → `spec/`, `scenarios/` → `corpus/scenarios/`; update the
   path constants in `src/library/corpus.ts`, `scripts/`, `tests/`, vitest config, and
   [lab-04-scenario-library.md](../inprogress/lab-04-scenario-library.md) (the corpus contract doc
   moves with its subject). Acceptance: snapshots byte-identical, `npm run build` green.
3. **Merge `scripts/` + `tests/` into `harness/`** by question (conformance / verify /
   render), promoting `tests/helpers` to `harness/helpers` and ending the render-png
   reach-around. Root npm script names stay (`test`, `update:primitives`,
   `preview:scenarios`, `verify:scenarios`).
4. **Seed `spec/proposals/`** from the three live topics; factor `worker/editLoop.ts`;
   land `harness/evals` v0.
5. **Add `cli/`** and give scores their meta so the rail shelves the full corpus.

## Done when

- The repo's top level reads as the mission: spec / corpus / harness / apparatus / codecs /
  cli. A newcomer can find every claim's evidence from the root in one hop.
- 57/57 scenario verifications stand without re-approval; deploy is unchanged.
- `npx mnx render corpus/scenarios/spec/hello-world/score.mnx.json out.png` works from a
  fresh clone.
- One eval run has been committed with scores for at least two models from `models.json`.
- Each of the three proposal topics has an evidence directory an upstream CG post could
  link to verbatim.

## Open questions

- Do eval runs (nondeterministic, paid API calls) belong in CI at all, or stay a manual
  `mnx eval` with committed results? (Default: manual, committed.)
- Should `corpus/scores` goldens include committed primitives like scenarios have, or is
  round-trip identity their only contract? (Primitives for full scores are large.)
- Does the `cli/` ship as a published npm bin eventually, or stay a repo-local tool until
  someone asks?
