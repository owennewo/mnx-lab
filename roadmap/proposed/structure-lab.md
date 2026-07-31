# Structure direction — the lab: layered apparatus, one corpus, two loops

> **Status: proposed** (filed 2026-07-31, revised same day). The fourth structure sketch,
> and the likely direction of travel. It **composes** two of the three earlier
> alternatives — [structure-platform.md](structure-platform.md) for the code and
> [structure-workbench.md](structure-workbench.md) for the data — and defers
> [structure-toolchain.md](structure-toolchain.md) rather than rejecting it. If adopted,
> the other three move to `superseded/` with a pointer here.
>
> **Revision note.** The first draft had a three-role corpus model
> (oracle / probe / repertoire) and moved scores into the corpus. Both were wrong and are
> replaced below: the scores turned out to be converter fixtures that never had a home
> (nothing else consumes them — the frontend seed is an inline object in
> `src/utils/defaultScore.ts`), and oracle/probe collapse into **one scenario format with
> two axes**. The spec loop gained a mechanism: a symmetric `sync`/`push` pipeline
> through the spec's own database fixture. Later same-day revisions: the
> **workbench**/**studio** names were adopted; the workbench was ruled backend-less;
> review became its primary job with a conversational **`/verify`** contract (no human
> CLI); both app shells were designated **clean-room implementations** over the
> extracted machinery; and the migration itself became a **fresh-slate rebuild** of
> main — transplant the evidence, rebuild the shells — with pre-change history kept on
> a `legacy` branch.

## Thesis

The three earlier sketches turned out to be answers to **two orthogonal questions**:

1. **How should the *code* be organized?** Platform's answer: one repo-wide set of
   capability layers with machine-enforced import boundaries, and the artifact-shaped
   goals (embed, library) served as extra **build faces** of the same source tree.
   Toolchain's package split is deferred, not foreclosed — enforced boundaries keep
   extraction cheap forever, and the explicit trigger for revisiting it is a real
   external consumer needing versioning independent of the app.
2. **How should the *data* be organized?** Workbench's answer: the repo's unique output
   is its **evidence about MNX**, and that evidence deserves structure that states what
   each artifact proves — instead of `schemas/` at the root, fixtures inside a dead
   Express app, and a `scripts/`-vs-`tests/` split that is about invocation rather than
   meaning.

They compose because they touch disjoint files. The organizing idea for the data is that
this repo runs **two development loops**, and every artifact must declare which loop it
serves:

- **Implementation loop** — the spec is the *constant*, our renderer/player/editor is
  the *variable*. Scenarios are oracles; `status: verified` and the primitives goldens
  are verdicts about **our code**.
- **Spec loop** — our implementation is the (rough) constant, the *schema* is the
  variable. Proposal scenarios are probes; their verdict against
  `mnx-schema.proposed.json` and their rendered engravings are evidence about **the
  spec**, packaged for upstream.

## One corpus, one format, two axes

There is **one kind of corpus artifact — the scenario** — with one directory shape, one
`meta.json` schema, one goldens format, one verification flow. What used to feel like
different corpora is two orthogonal axes on that one format:

| Axis | Values | Meaning |
|---|---|---|
| **origin** | `mirrored` \| `local` | *who writes it*: `mirrored` = generated from the pinned spec by `sync-spec-examples.mjs`, hand-edit forbidden; `local` = ours |
| **schema** | `published` \| `proposed` | *which schema judges `expect.standard`*; `proposed` additionally **must** name its `proposal: <topic>` |

Rules `check-scenarios.mjs` enforces:

- `origin: mirrored` ⇒ never hand-edited (sync owns the whole `scenarios/spec/` tree —
  a generator needs to own a directory wholesale to survive upstream renames and
  deletions, so the `spec/` vs `lab/` split remains as an **ownership boundary**, not a
  taxonomy);
- `schema: proposed` ⇒ `proposal` names a topic and `spec/proposals/<topic>/` exists —
  no proposal scenarios loose in `lab/` with their rationale only in a roadmap doc;
- `origin: mirrored` ⇒ `schema: published` (the pin is always upstream).

Both loops read the same tree: the **implementation loop is every scenario** (all flow
through conformance, goldens and human verification identically — the 57/57 sweep
already worked this way); the **spec loop is the `proposed` subset**, grouped by
proposal, with a defined terminal state (below).

### Scores exit the corpus

`server/scores/*` are **converter fixtures, not corpus** — their only consumers are the
four converter test suites (each already reaching for `../../../server/scores`); the
frontend seeds from an inline object, and nothing renders or verifies them. They move to
**`converters/fixtures/`**, shared by both converter packages, formalizing the
cross-reach. Their whole contract is what it already is: lossless round-trip identity.
The "test full MNX files" want keeps a defined path — when a *rendering* question about
a full score arises, promote it into `scenarios/lab/` as an ordinary local scenario,
deliberately, with a meta.json. Until then it stays a fixture.

With scores out, **`scenarios/` stays exactly where it is** — the first draft's
`corpus/` move existed to unify scores with scenarios, and that need is gone. Less
churn: ids, golden paths, `manifest.json` and
[04-scenario-library.md](../inprogress/04-scenario-library.md) are all untouched.

## The spec loop: `sync` down, `push` up

The spec is database-driven: `vendor/mnx/doctools/data.json` is a Django fixture
(~2,400 records — `jsonobject` = the `$defs`, `exampledocument` + joins = the worked
examples, `exampledocumentcomparison` = the MusicXML comparisons, one `xmlschema`), and
`makesite` generates `docs/` *and* `mnx-schema.json` from it. The corpus **must not
live there** (it's dev-time only, the fixture is one giant blob hostile to diffs and
LLM edits, and our metadata/goldens have no home in its models) — but it is the right
**projection target**. The pipeline becomes symmetric:

- **`sync:spec` (exists, down)**: pinned fixture → `scenarios/spec/` mirrored
  scenarios + prose-drift tripwire. Unchanged.
- **`push:proposal` (new, up)**: for one proposal topic, inject its local scenarios
  into the proposal branch's fixture as genuine `exampledocument` records — document
  JSON into `doctools/media/examples/json/`, **our engraving as the example's image**,
  def joins computed from `coversDefs` — beside the `jsonobject` edits that constitute
  the schema change, then `freezedb`. This subsumes today's manual "edit admin,
  `makesite`, copy out `mnx-schema.proposed.json`" recipe.

The proposal branch is therefore **"upstream + our superset" as a generated artifact**
— authored in scenario files at the bottom, reviewed by the CG in the spec's native
format at the top. Adoption closes the loop: proposal merges → move the pin →
`sync:spec` mirrors the example back down as `origin: mirrored` → the local scenario
retires → `mnx-schema.proposed.json` and the `schema: proposed` declarations are
deleted (the rule CLAUDE.md already states). [#529](https://github.com/w3c-cg/mnx/pull/529)
proved the full cycle by hand, including our engraving shipping as the spec's reference
image; `push:proposal` industrializes it. A bundle whose schema diff is empty is an
**example-only contribution** — a lighter upstream ask the same structure carries.

### `spec/proposals/<topic>/` — the evidence bundle

```
spec/proposals/score-text/
  README.md          thesis + CG issue links (#112/#377) + fork branch name + status
  schema.diff        published → proposed, regenerated with the proposal
  scenarios.md       the opting-in scenarios (today: all nine of scenarios/lab/31-*)
  engravings/        our rendered output per scenario — what push:proposal injects
```

Seeded from the three live topics: **score-text** ([score-text.md](score-text.md)),
**chord-symbols** (#109, the `harmonies` block), **guitar-technique** (#63/#179, the
`tab` block + `24-tab-spec-gaps`). Roadmap docs keep the narrative;
[mnx-cg-proposals.md](mnx-cg-proposals.md) keeps the outward campaign.

### The submodule stops double-dutying

`vendor/mnx` stays the **pin only** — always upstream, the tree `sync:spec` reads.
Proposal branches are checked out as **git worktrees** (`git worktree add
../mnx-proposals/<branch> <branch>`), and both `push:proposal` and
`mnx-schema.proposed.json` generation operate on the worktree, never on `vendor/mnx`.
`pinIsUpstream` demotes from load-bearing guard to assertion. Recipe lands in
[docs/mnx-spec-submodule.md](../../docs/mnx-spec-submodule.md).

## Target shape

```
spec/                          the standard, our extensions, and our proposals against it
  mnx-schema.json              moved from schemas/ — verbatim copy of the pinned release
  mnx-schema.proposed.json     moved; generated from the proposal worktree
  mnx-lab-extensions.schema.json, guitar-tab-extension.schema.json (v2 legacy, kept for
  upgrade tests), spec-prose.json, HISTORY.md
  proposals/<topic>/           evidence bundles (see above)
  tools/                       sync-spec-examples.mjs, specSource.mjs, push-proposal.mjs,
                               compile-validator.mjs
scenarios/                     unchanged in place — one format, two axes
  spec/                        origin: mirrored (owned wholesale by sync)
  lab/                         origin: local (ours; proposal scenarios declare their topic)
  manifest.json, meta.schema.json, .preview/
harness/                       every way the evidence is exercised — merges tests/ + scripts/
  conformance/                 scenarios.test.ts, primitives.test.ts, tab-validation.test.ts,
                               upgrade-extension.test.ts
  verify/                      verify-scenarios.mjs, check-scenarios.mjs, preview.test.ts —
                               the human approval flow (SPEC_APPROVAL.md, unchanged)
  render/                      render-png.ts — engravings for proposals and previews
  evals/                       RESERVED — LLM-edit experiments (cases, runner, scored
                               results); feature work, out of scope here, prerequisite is
                               worker/editLoop.ts
  helpers/                     svgString.ts + the corpus half of corpusPrimitives.ts; the
                               engine half becomes src/engine/headless.ts, ending the
                               scripts/ → tests/helpers reach-around from both ends
src/                           the apparatus — capability layers
  model/                       types/mnx.ts, _x.mnxLab types, schema access, validate(),
                               upgradeTabExtension, noteKeys — imports nothing internal
  engine/                      document → primitives → SVG: primitives.ts, layout/*, smufl/,
                               tab/guitarPositions.ts, notation+tab renderers,
                               render/{svg,bounds}.ts, headless.ts (Node-safe entry)
  audio/                       mnxToAudio + framework-free transport/synth/playhead core
  edit/                        NEW placeholder: EditOp union, applyOp(doc, op) → doc,
                               history — the seed the editor UI and the AI loop converge on
  assist/                      chat-to-edit client protocol: NDJSON frame types, stream
                               reader, mock fallback — shared with the worker
  corpus/                      access code for scenarios/ data: library/corpus.ts loader,
                               plumbingDefs.ts (code in src/, data at root — deliberate)
  storage/                     types/repository.ts, indexedDbRepository.ts,
                               CloudRepository (reserved stub over /api/documents)
  elements/                    NEW LAYER — the embeddable Lit custom elements:
                               ScoreViewer, marks, playback surface, design tokens; the
                               embed's viewer/gallery modes migrate here out of the app
                               shell. Lit is load-bearing HERE (shadow DOM = the
                               embeddability story) and only here.
  ui/                          the WORKBENCH app shell — a CLEAN-ROOM rebuild around the
                               review-first IA (queue home, compare view, deep links);
                               a leaf; nothing imports it. The legacy reading-room
                               components/controllers survive in place only until cutover
  entries/                     main.ts (workbench) · embed.ts (elements registration) ·
                               lib.ts (public API re-export surface)
worker/
  index.ts                     thin Hono wiring; routes split: api/edit-notation.ts +
                               api/models.ts; editLoop.ts factored for future evals
  prompts/editNotation.ts      moved from server/prompts, converted to TS
  api/documents.ts, api/auth.ts   reserved SaaS seams (501 stubs, no bindings yet)
  generated/                   precompiled validators (built from spec/, path updated)
converters/                    unchanged in place; npm-workspace-linked for install/dedup
  fixtures/                    NEW — the three scores (.gpx sources + derived), shared by
                               both converter suites; alphaTab never reachable from src/
apps/studio/                   placeholder README only — product intent, framework
                               neutrality, reserved seams; no code until it starts
cli/                           LATE, optional: `mnx` bin — validate | render | convert |
                               verify — thin wrappers over engine/headless, spec/tools
                               and the converter bins
server/                        deleted
roadmap/ docs/ research/ vendor/mnx    unchanged at root
```

## Two apps, one platform — and the anti-merge rule

The frontend built so far is a **verification instrument**: a corpus browser (rail,
faceted by `$def`), a conformance scoreboard (coverage dashboard), a JSON inspector
(document pane), and an LLM probe (assist drawer). It serves the two loops; almost none
of it belongs in a consumer product. It is the lab's permanent internal app — the
**workbench** — and it is *already built as* `ui/`.

The Soundslice-like service (**studio** — the name is adopted, alongside **workbench**)
is a **different product for different users** (accounts, sync, purchased libraries,
practice). It does not exist,
and it does not grow inside the workbench. When it starts, it starts greenfield as
`apps/studio/` — **any framework** (React/Svelte/Lit — decided then, not now), because
it consumes only framework-neutral surfaces: the `elements/` custom elements, the
`mnx-lab` package, and the same Worker origin whose `api/documents.ts` + `api/auth.ts`
stubs and `storage/CloudRepository` are its reserved seams. Lit's position, layer by
layer: **essential in `elements/`** (web components are the embed story), **incumbent
and fine in `ui/`** (one component tree, no complex app state), **an open choice for
studio**.

The guard against the two apps bleeding together is structural, not vigilance:
**`ui/` and the studio shell are leaves — nothing may import them, and they may not
import each other.** Anything both apps want must first move down into `elements/` or
below, which is a deliberate, reviewed promotion. The repo already contains one
realized instance of the merge risk — the embed today is `<mnx-editor-app
mode="viewer|gallery">`, the workbench shell moonlighting as the embeddable component —
and unwinding it (embed face re-pointed at `elements/`) is part of the migration.

### Clean-room shells over extracted machinery

Both app shells are **clean-room implementations**. The line is drawn at `elements/`:

- **Below the line** (`model/`, `engine/`, `audio/`, and the score-viewer element
  itself): *proven machinery*, moved with `git mv` and import rewrites. The
  57/57-verified renderer and its goldens are the repo's crown jewels — they are never
  rewritten, and byte-identical snapshots remain the acceptance test for every move.
- **Above the line**: written fresh. The new workbench shell is built from scratch
  around the review-first IA (below), consuming `elements/`. The existing reading-room
  components (`MnxEditorApp`, rail, dashboard, panes, drawer, the controllers) are
  **reference material, not source** — consult them for hard-won lessons (bubbling
  event pattern, container queries, token usage), but do not port them wholesale.

The cutover is strangler-style, never big-bang: the legacy shell keeps running and
deploying until the new workbench reaches review-parity, then the reading-room
components are deleted. **Studio stays unimplemented**: `apps/studio/README.md` states
the product intent, the framework-neutrality contract, and the seams reserved for it
(`worker/api/*`, `storage/CloudRepository`, the elements/library artifacts) — no code
until the product starts.

### The workbench has no backend — by rule, not accident

Today the Worker serves the workbench exactly two routes (`/api/edit-notation`,
`/api/models`), both existing only because the OpenRouter key and the validating retry
loop belong server-side. Everything else is static files plus client compute: the
corpus is committed JSON served by Vite, documents live in IndexedDB, and verification
writes happen through harness scripts editing `meta.json` in the repo — never through
an API. The missing-key mock fallback already proves the degraded mode works.

This plan promotes that state to a rule: **the workbench must remain fully functional
(minus live AI edits) from static build output alone. The Worker is not the workbench's
backend — it is a secrets-and-validation proxy for assist, and `ui/` may reach it only
through `assist/`** (a boundary `check:boundaries` enforces).

The rationale is that this repo's primary developer is an LLM agent, and fixtures beat
APIs for agent-driven development on every axis that matters here: files are directly
readable, greppable, editable and diffable; the whole harness runs serverless and
deterministic with no ports or env secrets; and git remains the database, so corpus
history, status changes and proposal evidence all arrive as reviewable diffs — the
audit trail the repo's value depends on. If browser-driven corpus authoring is ever
wanted (e.g. a "mark verified" button in the workbench), the pattern is a **dev-only
Vite middleware that writes to the repo files** — an ephemeral file API, never
deployed — not a real backend. The real API layer (documents, auth, sync) is
**studio's**, on the reserved `worker/api/*` + `storage/` seams.

### Review is the workbench's job; verification is a conversation

The workbench exists to answer two questions: **"how is the work getting on?"** (Owen
reviewing) and **"did that feature land?"** (the agent proving it). Today the surface
that actually answers them — side-by-side comparison and the approval queue — is a
*second, disconnected frontend* (`scenarios/.preview/index.html`, checkboxes assembling
a CLI command to paste), while the app proper is a browse-and-play reading room. That
browse-and-play UX is proto-**studio** DNA; it may stay, but it stops driving the
information architecture. The reframe:

- **Review-first IA.** The workbench's home surface becomes the attention queue
  ("N stale, M never seen, K render crashes"), and the scenario page gains a **compare
  view**: our render beside the spec's reference engraving, and beside the previous
  golden when stale. `scenarios/.preview/` dissolves into it.
- **Verification provenance.** `meta.json` gains a `verification: {at, primitivesHash}`
  record, written by `verify-scenarios.mjs` and **kept through demotion** — so the
  queue distinguishes *never seen* (no record) from *stale* (hash differs, and the
  committed goldens let the agent diff exactly what changed) from *current*. Today
  demotion erases history and both states collapse into `rendered`.
- **The agent is the review interface** — the `/verify` skill, contract below. The
  harness scripts remain the **only** mutation path — the workbench displays state, it
  never writes it — so the no-backend rule holds.
- **Deep-linkable state.** Every scenario + view mode (including compare) gets a stable
  URL, so the agent can drive a browser to the exact comparison and screenshot it. The
  agent's *primary* did-it-land check stays the harness (goldens, headless renders);
  workbench screenshots are how it shows the human.

The compare view and queue surface are feature work sequenced after the restructure
(they live in `ui/` over `harness/` outputs); the provenance field and the `/verify`
skill are cheap, independent of every migration phase, and can land any time.

#### The `/verify` skill — contract

A project skill (`.claude/skills/verify/`) that makes the approval loop a conversation.
Target shape of a session:

```
> /verify
  Three scenarios need approval — side-by-sides here: <link>
  (2 stale — beam spacing changed in `beams`, new glyph in `ottavas-8va` — 1 never seen)
> The first two look fine, but the spacing is wrong on the third
  Verified the first two. For the third I've adjusted the spacing and re-rendered —
  refresh the page.
> They all look good now
  Verified the third. The queue is empty.
```

Rules:

- **The human never runs a command or ticks a checkbox.** All mutations go through the
  agent, and the agent's only mutation path is the harness scripts — the same
  file-based, git-audited trail as ever. There is no human-facing CLI in this flow.
- **One review page, one stable URL, refreshed in place.** "Refresh the page" must work
  mid-conversation (an Artifact redeployed to the same URL, or the local preview page
  regenerated). The page shows our render beside the spec reference — and beside the
  previous golden for stale items, with the agent's what-changed note derived from the
  committed primitives diff.
- **Rejections are handled in-line when possible**: the agent fixes the layout code or
  the scenario, re-renders, and re-presents in the same session. Anything not
  immediately fixable is recorded as a finding, with the scenario left unverified.
- **The queue is provenance-derived and ordered by attention**: crashes first, then
  stale (with diffs), then never-seen; already-current items are counted, not shown.

## The layer order and its enforcement

```
model                                      (floor — imports nothing internal)
model → engine · audio · edit · corpus · storage      (peers over the model)
edit  → assist                             (assist carries ops; edit owns them)
engine · audio · model → elements          (the embeddable surface)
elements → ui                              (workbench shell — leaf)
        → apps/studio                      (future shell — leaf, sibling of ui)
ui · elements → entries                    (build faces)
worker: model + assist only                (sibling ceiling; DOM-free)
```

Enforcement is a committed **dependency-cruiser** config and `npm run check:boundaries`
wired into `npm run build` — a violation is a red build, not a review comment. First
burn-down list: `worker/index.ts` → `../server/prompts/editNotation.js` (dissolves into
`worker/prompts/`), `scripts/render-png.ts` → `tests/helpers/*` (dissolves into
`engine/headless.ts` + `harness/helpers/`), and the embed/app conflation above.

## Build faces from one source

| Face | Entry | Artifact |
|---|---|---|
| **Workbench** | `index.html` → `entries/main.ts` | today's site + Worker, deployed by wrangler |
| **Embed** | `embed.html` → `entries/embed.ts` | `dist/embed/mnx-lab.js` (IIFE + ESM) — one script tag, registers `elements/` |
| **Library** | `entries/lib.ts` via `build:lib` (Vite lib mode) | the published **`mnx-lab`** package: `mnx-lab/model`, `mnx-lab/engine`, `mnx-lab/audio`, `mnx-lab/elements` |
| *Studio* | *`apps/studio/` (future)* | *its own build; consumes embed/library artifacts + the Worker API* |

`model`, `engine`, `audio` must stay importable from Node (no DOM at module top level);
`engine/headless.ts` makes the proven headless pipeline a guarantee. The library face is
one package versioned with the repo; **the trigger for graduating to toolchain's
independent packages is a real external consumer needing independent versioning** —
recorded so the future decision is a check, not a debate.

## Where the ten goals live

| Goal | Home |
|---|---|
| Renderer | `engine/` + `mnx-lab/engine` + `engine/headless.ts` |
| Converter | `converters/*` + shared `converters/fixtures/` |
| Player | `audio/` core + `elements/` playback surface + `ui/` chrome |
| Editor | `edit/` placeholder ops + flagged `ui/` wiring |
| Embedded | `entries/embed.ts` face over `elements/` |
| Library-for-others | `entries/lib.ts` face (subpath exports) + optional `cli/` |
| Corpus | `scenarios/` — one format, two axes, one loader (`src/corpus/`) |
| SaaS | `apps/studio/` reserved + `worker/api/*` + `storage/` seams |
| LLM experiments | `assist/` + `worker/editLoop.ts` now; `harness/evals/` when built |
| Spec support | `spec/` + `spec/proposals/` + the sync/push pipeline |

## Placeholders this plan needs

- **`edit/`**: an `EditOp` union with two or three ops (transpose selection, set fret,
  append measure), `applyOp`, a history stack, one hidden toolbar button proving the
  wiring. Intent (not built now): the AI loop later emits `EditOp[]` instead of whole
  documents.
- **`push:proposal` v0**: one topic (score-text — its nine scenarios and engravings
  already exist), injecting into a worktree fixture and `freezedb`-ing; verified by
  `makesite` rendering the examples on the branch.
- **`storage/CloudRepository`** + the two 501 Worker routes.
- **`entries/lib.ts`** with an honest first surface (`validate`, `layout`, `renderSvg`,
  element registration) + an `npm pack` dry-run test that the exports map resolves.
- **Verification provenance + `/verify` skill**: the `verification: {at, primitivesHash}`
  meta field (kept through demotion) and the conversational skill per the contract
  above. Replaces the checkbox-and-paste-a-command flow entirely; no human-facing CLI.
- **`apps/studio/README.md`**: the only studio artifact — what the product is, who it
  is for, the framework-neutrality contract, and the seams reserved for it.

## Migration: fresh-slate rebuild (adopted 2026-07-31)

> An earlier draft of this section migrated in place, every phase leaving the repo
> deployable. **Superseded**: main is rebuilt from an empty slate instead, so that
> every file present is there because a rebuild step justified it — cruft removal by
> omission. Pre-rebuild state is preserved on a **`legacy` branch (and tag — tags
> don't get accidentally rebased)** with full history; main's `git log --follow`
> restarts at the rebuild, which is the accepted price.

Two verbs govern what returns to main:

- **Transplant** — moved verbatim, never rewritten, because it is *evidence or proven
  machinery*: the scenario corpus with its goldens and human `verified` statuses
  (recorded judgment — a rewritten engine would demote all 57 and force
  re-approval), the schemas (verbatim upstream copies), `model/` / `engine/` /
  `audio/` and the score-viewer machinery of `elements/`, the converters + their
  fixtures, `docs/`, `roadmap/`, and the `vendor/mnx` pin. Gate for every code
  transplant: **byte-identical primitives snapshots**, so the 57/57 verifications
  stay honest.
- **Build fresh** — the clean-room surface: the workbench shell (`ui/`), `entries/`,
  the Worker wiring (`index.ts` routes, prompts conversion, `editLoop.ts`), `assist/`,
  root configs, CLAUDE.md.

Never comes back at all: `server/`, the reading-room components and controllers, the
`scripts/`-vs-`tests/` split, `scenarios/.preview/` as a separate frontend.

**Invariant change.** "Green and deployable every phase" is replaced by **"harness
green from the first transplant onward"**. Deploys are manual, so mnx-lab.totai.uk
keeps serving the last deploy throughout; the first redeploy happens when the
clean-room workbench has something to show (step 7).

**Steps** (each a coherent commit or short series):

1. **Snapshot.** Commit everything; create the `legacy` branch and tag.
2. **The wipe.** Empty main *except* `.git`, `.gitignore`, `.gitmodules` +
   `vendor/mnx` (the corpus resync depends on it), `roadmap/` and `docs/` (this plan
   must not delete itself). The wipe is **`git rm` of tracked files only, never
   `rm -rf`** — the gitignored files must survive untouched: `.dev.vars`/`.env`
   (the OpenRouter key), `.claude/settings.local.json`, `.wrangler/`, `node_modules/`.
3. **Scaffolding.** Root `package.json` (workspaces), base tsconfig, vitest,
   dependency-cruiser config, CLAUDE.md rewritten as the layer/loop map — small,
   since it describes what's coming.
4. **Evidence first.** Transplant `spec/` (schemas + tools) and `scenarios/`; minimal
   `harness/` (conformance + verify). Tests green from here on.
5. **The machinery.** Transplant `model/`, then `engine/` + `headless.ts` — **the
   goldens-byte-identical checkpoint** — then `elements/` machinery, `audio/`; adopt
   `converters/` + fixtures as workspaces.
6. **Fresh worker + assist.** Thin Hono wiring, routes split, prompts converted,
   `editLoop.ts` factored; `worker/generated/` rebuilt from `spec/`.
7. **Clean-room workbench.** Review-first `ui/` (queue home, compare view, deep
   links) + `entries/main.ts`; boundaries fully on with no allowances (there is no
   legacy shell to allow). First redeploy.
8. **Faces and the rest of the plan.** Embed + lib faces; axes + spec-loop pipeline
   (`origin`/`proposal` fields, `spec/proposals/` seeds, worktree convention,
   `push:proposal` v0); placeholders (`edit/`, storage/Worker stubs,
   `apps/studio/README.md`; `cli/` if wanted).
9. **Documentation reconciliation — always last.** Step 3's CLAUDE.md was a
   *forecast*; rewrite it **as built**, verifying every path, script name, layer rule
   and convention against the final tree (a wrong CLAUDE.md misleads every future
   agent session — this step is not optional polish). Move this doc to
   `roadmap/complete/`, refresh `roadmap/README.md`, and update the agent memory
   files that describe repo layout.

The **verification provenance + `/verify` skill depend on no step at all** — they can
land before the wipe (against today's layout) or any time after step 4, and are the
recommended first slice either way.

## Handoff notes for the executing session

This plan will be executed by a fresh session starting with maximum context headroom.

- **The decisions above are settled** — clean-room shells, no workbench backend,
  two-axis corpus, fresh-slate rebuild. Don't re-litigate them; if execution reveals a
  genuine problem, append a revision note rather than silently deviating.
- **On starting**: move this doc to `roadmap/inprogress/` and the three sibling
  sketches ([structure-toolchain.md](structure-toolchain.md),
  [structure-workbench.md](structure-workbench.md),
  [structure-platform.md](structure-platform.md)) to `roadmap/superseded/` with
  pointers here; refresh `roadmap/README.md`.
- **Commit discipline**: one step = one commit (or short series), message naming the
  step and its gate. Gates are non-negotiable — a transplant that can't produce
  byte-identical goldens stops the line for investigation (diff against `legacy`);
  never "close enough".
- **Trust order during steps 1–2**: this doc over CLAUDE.md, which describes the old
  world until step 3 rewrites it.
- **Known loose end at handoff**: `vendor/mnx` is checked out on the score-text
  proposal branch (`a3dc1eb`, "Added nine examples for rehearsal marks, sections and
  directions") while the committed pin is upstream `46fbe93` — the pointer change is
  **deliberately uncommitted**. This is the pin/proposal double-duty this plan
  abolishes: when adopting the worktree convention, return `vendor/mnx` to the pin
  and re-home that branch in a worktree. Do not commit the pointer bump.
- **The escape hatch** is the `legacy` branch and tag — full pre-rebuild history.
  Anything unexpectedly missing on main is retrieved from there, never reconstructed
  from memory.

## Done when

- `npm i && npm test && npm run deploy` work from a fresh clone exactly as today; 57/57
  scenario verifications stand without re-approval (snapshots unchanged).
- `check:boundaries` passes inside `npm run build`; `ui/` is a leaf no other layer
  imports.
- `npm pack` produces an installable `mnx-lab` whose `mnx-lab/engine` renders a
  scenario to SVG in Node — kept as a smoke test.
- The embed artifact registers `elements/` components without pulling in the workbench
  shell.
- The workbench is the clean-room review-first shell (queue home, compare view, deep
  links); the legacy reading-room components are deleted; `scenarios/.preview/` is gone.
- A `/verify` session works end-to-end per the contract — queue, link, sentences,
  refresh — with no human-facing CLI.
- Main contains only files a rebuild step justified; the pre-rebuild tree and its full
  history are reachable via the `legacy` branch and tag.
- Every `"schema": "proposed"` scenario names its proposal topic; each of the three
  topics has a `spec/proposals/<topic>/` bundle; `push:proposal` has produced a
  proposal branch whose `makesite` output shows our examples and engravings.
- The submodule pin is never checked out to a proposal branch (worktree recipe
  documented; `pinIsUpstream` is an assertion).
- CLAUDE.md is rewritten accordingly (the stale `server/scores` seed claim is already
  fixed).

## Open questions

- Is the `mnx-lab` npm name available for the library face?
- **`push:proposal` reproducibility**: is `loaddb` → inject → `freezedb` stable enough
  (primary keys, record ordering) to re-run without noisy diffs, or does the tool need
  to write fixture records directly?
- Studio's framework: deliberately undecided until it's built — is there any earlier
  forcing point (e.g. auth pages on the same origin) that would pull the decision in?
- Does `src/corpus/` vs root `scenarios/` naming read clearly enough (code vs data)?
- When evals land in `harness/evals/`: manual `mnx eval` with committed results, or CI?
  (Default: manual, committed — nondeterministic paid API calls don't belong in CI.)
- `cli/`: build it when the library face ships, or wait until someone external asks?
