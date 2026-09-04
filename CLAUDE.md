# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**MNX Lab** (package `mnx-lab`) — a test bench for the developing W3C MNX notation format,
with emphasis on guitar tab. Custom SMuFL/SVG rendering engine (no third-party notation
libraries), an LLM-assisted edit loop through OpenRouter, and a scenario corpus with
human-verified engravings. The repo was rebuilt from an empty slate in 2026-07 per
[roadmap/complete/lab-structure-lab.md](roadmap/complete/lab-structure-lab.md); the full
pre-rebuild tree and history live on the **`pre-rebuild` tag** (`git show pre-rebuild:<path>`,
or check it out detached) — retrieve missing things from there, never reconstruct them from
memory. The `legacy` branch was the same commit and was deleted 2026-08-15; the tag is now
the only name for that history.

The repo runs **two development loops**, and every artifact declares which it serves:

- **Implementation loop** — the spec is the constant, our code the variable. Scenarios
  are oracles; `status: verified` and the primitives goldens are verdicts about **our code**.
- **Spec loop** — our implementation is the (rough) constant, the schema the variable.
  `schema: proposed` scenarios are probes grouped by `proposal` topic; their verdicts and
  engravings are evidence about **the spec**, packaged for upstream in `spec/proposals/`.

## Running the project

```bash
git submodule update --init vendor/mnx   # the MNX spec sources (dev-time only)
npm run dev                # Vite dev server + Worker API (via @cloudflare/vite-plugin)
npm test                   # harness suites over the corpus (root vitest)
npm run check:scenarios    # corpus police
npm run verify:scenarios   # attention queue / approval writer — drive via /verify
npm run update:primitives  # regenerate layout goldens; keeps statuses honest
npm run sync:spec          # pinned spec fixture → scenarios/spec/ (owns that tree)
npm run push:proposal -- <topic>   # inject a topic's evidence into the proposal branch
npm run update:roster      # worker/models.query.json → worker/models.json (stored queries)
npm run refresh:catalog    # refetch OpenRouter's catalog snapshot, then regenerate
npm run build              # validators + boundaries + tsc (app+worker) + vite build
npm run build:lib          # the mnx-lab library face → dist/lib
npm run build:embed        # the embed face → dist/embed/mnx-lab.js
npm run smoke:lib          # npm pack → install → render SVG in Node via mnx-lab/engine
npm run deploy             # build + wrangler deploy (mnx-lab.totai.uk)
```

## Working in parallel: one worktree per agent

**Assume other agents are working in this repo right now.** Sessions run concurrently and
independently, so `main` in the primary checkout (`/home/williao/dev/mnx-lab`) is
**shared integration space, not a workspace** — leave it on `main` and clean. Every
session that will change a tracked file takes its own worktree *first*, before the first
edit, including for "small" changes: the cost of a collision is paid by whoever discovers
it, not whoever caused it. Read-only sessions (answering questions, reading the roadmap)
stay where they are and change nothing.

```bash
git -C ~/dev/mnx-lab worktree add ~/dev/mnx-labs-worktrees/<task> -b <task> main
cd ~/dev/mnx-labs-worktrees/<task> && npm ci     # worktrees do NOT share node_modules
ln -s CLAUDE.md AGENTS.md                        # Codex + agy read AGENTS.md; gitignored
```

`<task>` is the roadmap doc's slug where the work has one (`core-vertical-density`),
otherwise a short kebab-case name. Worktrees live **outside the repo** at
`~/dev/mnx-labs-worktrees/` so nothing in the tree — gitignore, the corpus police, the
boundary checker, Vite — ever has to know they exist. `git worktree add` does not
populate `vendor/mnx`; leave it empty unless the task is in the spec loop (no build
requires it — the compare pane degrades with a warning), and run
`git submodule update --init vendor/mnx` inside the worktree if it does. Git refuses to
check out one branch in two worktrees, so the branch name is itself the collision guard:
if `add` refuses, another agent already owns that task — pick up something else rather
than working around it.

### Landing the work

Self-merging to `main` is expected, not something to ask about — but it is the one moment
when concurrent work actually collides, so it runs to a fixed order:

1. Commit everything in the worktree; the tree must be clean.
2. `git fetch origin && git rebase origin/main` — **rebase, never merge**. `main` stays
   linear so the next agent's rebase is legible.
3. **Re-earn the goldens.** If the rebase pulled in anything under `src/model/`,
   `src/engine/` or `scenarios/`, run `npm run update:primitives` and require
   `git diff -- scenarios/` to come back **clean**. A rebase can silently resurrect a
   stale golden; regeneration is the only trustworthy resolution. Never hand-merge a
   conflict *inside* an `expected.*` file — take either side wholesale, regenerate, and
   let the diff be the verdict.
4. **Never hand-edit a `verification:` block or a `status:` field to resolve a
   conflict.** Only `harness/verify/verify-scenarios.mjs` writes them, and editing one by
   hand forges a human assertion. On conflict keep `main`'s record; if your change really
   moved the output, `update:primitives` demotes it to `rendered` and the queue asks a
   human — which is the correct outcome.
5. Gates, all of them, in the worktree after the rebase: `npm test`,
   `npm run check:scenarios`, `npm run build`.
6. `git -C ~/dev/mnx-lab merge --ff-only <task>`. **Fast-forward only** — a refusal
   means `main` moved while you were testing, so return to step 2 and run the whole
   sequence again. Never `--no-ff`, never force-push `main`, never rewrite a commit
   already on `main`.
7. Push `main`.

If a gate fails, stop and fix it in the worktree. Landing a red build costs every other
agent their next rebase.

### Retiring the worktree

**A worktree is deleted the moment it stops being needed — on completion, or as soon as
it is clearly not wanted, whichever comes first.** Abandoned, superseded, and
turned-out-to-be-a-no-op all count as "not wanted": remove it then, not later.

```bash
git -C ~/dev/mnx-lab worktree remove ~/dev/mnx-labs-worktrees/<task>
git -C ~/dev/mnx-lab branch -d <task>       # -d, not -D — it must already be merged
git -C ~/dev/mnx-lab worktree prune
```

`worktree remove` refusing on a dirty tree is information, not an obstacle — go look at
what is uncommitted before reaching for `--force`. `branch -d` refusing means the work is
not actually on `main` yet.

**Removal comes *before* the roadmap doc moves to `complete/`.** That move is the last
commit of a work item and it happens in the primary checkout on `main`, so "no worktree
for this task exists" is a precondition of writing it — a checkable invariant rather than
a habit. An item is not complete while its worktree is still on disk.

## Repository shape

```
spec/                the standard + our proposals against it. mnx-schema.json is a
                     verbatim copy of the pinned upstream release — never edited;
                     mnx-schema.proposed.json is transient, dev-time only;
                     mnx-lab-extensions.schema.json is the _x.mnxLab vendor schema (v6);
                     guitar-tab-extension.schema.json is v2 legacy, kept as the record of
                     that shape — no test loads it. proposals/<topic>/ are evidence
                     bundles (README always; schema.diff, scenarios.md and engravings/ as
                     the proposal matures); tools/ syncs down and pushes up
scenarios/           ONE corpus format, two axes (below); manifest.json, meta.schema.json
harness/             every way the evidence is exercised — conformance/, verify/
                     (check-scenarios + verify-scenarios are the ONLY status writers),
                     render/ (PNG engravings for proposals; needs google-chrome),
                     helpers/ (corpusPrimitives, corpusSvg, svgString)
src/                 the apparatus — capability layers (order below)
  model/  engine/  audio/  edit/  corpus/  storage/  assist/  elements/  workbench/  entries/
worker/              Hono; a DEMO for visitors with no key of their own, plus reserved
                     501 seams. models.json is GENERATED from models.query.json — never
                     hand-edited; generated/ is schema DATA precompiled from spec/,
                     importable from any layer
converters/          npm-workspace sub-packages + fixtures/ (the three scores)
apps/studio/         README only — the future consumer product's reserved seam
apps/viewer-embedded/ the third app: a mock host page for the embed face
                     (core-viewer-embedded-app.md; smoke:embed / dev:embed-app)
roadmap/ docs/ research/ vendor/mnx    unchanged at root
```

### The layer order (machine-enforced)

```
model                                      (floor — imports nothing internal)
model → engine · audio · edit · corpus · storage      (peers over the model)
edit  → assist                             (assist carries ops; edit owns them)
engine · audio · model → elements          (the embeddable surface)
elements → workbench                       (workbench shell — leaf)
workbench · elements → entries             (build faces)
worker: model + assist only                (sibling ceiling; DOM-free)
```

`.dependency-cruiser.cjs` + `npm run check:boundaries` (inside `npm run build`) make a
violation a red build. **`workbench/` and `entries/` are leaves — nothing imports them**;
anything two shells want is first *promoted* into `elements/` or below, a deliberate,
reviewed move. `model`/`engine`/`audio` stay importable from Node (no DOM at module top
level; `engine/headless.ts` is the guarantee and the harness's entry). Lit is
load-bearing **only in `elements/`** (shadow DOM = the embeddability story); the
workbench shell also uses it as incumbent; studio's framework is deliberately undecided.
alphaTab is confined to `converters/guitarpro-mnx` and must never reach `src/`.

### Build faces (one source tree)

| Face | Entry | Artifact |
|---|---|---|
| Workbench | `index.html` → `src/entries/main.ts` | the deployed site + Worker |
| Embed | `src/entries/embed.ts` (`embed.html` = mock host demo) | `dist/embed/mnx-lab.js` (IIFE+ESM) — registers `elements/` only |
| Library | `src/entries/lib.ts` via `build:lib` | `mnx-lab` with subpath exports `mnx-lab/{model,engine,audio,elements}` + `mnx-lab/smufl/*` |

The trigger for graduating to independently-versioned packages is a real external
consumer needing independent versioning — a check, not a debate.

## The corpus: one format, two axes

Each scenario is a directory (`meta.json`, `document.mnx.json`, optional
`expected.primitives.json` + `expected.svg` (+ `expected.tab.svg` + `expected.both.svg`)
goldens and `notes.md`) with **two orthogonal axes** in meta:

- **`origin`**: `mirrored` (generated from the pinned spec by `sync:spec`, which owns
  the whole `scenarios/spec/` tree — hand-edit forbidden) | `local` (ours, under
  `scenarios/lab/<category>/`). `spec/` vs `lab/` is an *ownership boundary*, not a
  taxonomy.
- **`schema`**: `published` (default) | `proposed` — which schema judges
  `expect.standard`. `proposed` **must** name its `proposal: <topic>` and
  `spec/proposals/<topic>/` must exist; `mirrored` is always `published`.
  `check-scenarios` enforces all of this.

**Verification is a human assertion with provenance.** `status: verified` and the
`verification: {at, primitivesHash, renderHash, bothHash}` record are written **only** by
`harness/verify/verify-scenarios.mjs` — never by hand, in a rebase conflict or anywhere
else; hand-editing one forges a human assertion. The approval flow is the conversational
**`/verify` skill** (`.claude/skills/verify/`) — queue → one stable review page →
verdicts in sentences; there is no human-facing CLI and no checkbox page.
**Verification debt is decoupled from the work that caused it**: an item may reach
`complete/` owing approvals, provided the batch is registered in the standing ledger
[roadmap/inprogress/lab-verify.md](roadmap/inprogress/lab-verify.md) with its cause and
what a reviewer should look for.

**The goldens are the crown jewels.** Any move or refactor of `model/`/`engine/` must
reproduce them byte-identically (`npm run update:primitives` then a clean
`git diff -- scenarios/`); a mismatch stops the line — diff against `pre-rebuild`, never
"close enough". `npm run update:primitives` keeps statuses honest, promoting and
demoting as the snapshots move.

How the status transitions work, what each golden pins that the others structurally
cannot see, and why `expected.both.svg` is text rather than pixels:
[docs/corpus.md](docs/corpus.md). The initial 57/57 sweep in
[roadmap/complete/lab-spec-approval.md](roadmap/complete/lab-spec-approval.md) is still
the recipe for verifying renderer features.

## The workbench (`src/workbench/`) — review-first, no backend

Home is the **attention queue**; every scenario + view has a stable deep link
(`#/scenario/<id>?view=notation|tab|both`); `#/objects` is the coverage map. Tab views
exist only when the strings are KNOWN — **no instrument is ever assumed**. Theming is
`light-dark()`, never an attribute.

**The workbench has no backend — by rule.** It must stay fully functional from static
build output alone: the corpus is committed JSON, the only browser persistence is
localStorage UI preferences, and every verification write happens through harness
scripts editing repo files — git is the database and the audit trail. If browser-driven
corpus authoring is ever wanted, the pattern is a dev-only Vite middleware writing repo
files — never a deployed API. The real API layer (documents, auth, sync) belongs to
**studio** ([apps/studio/README.md](apps/studio/README.md)) on the reserved seams.

The queue, the panel's five-band frame, `#/objects`, the topic grouping, document focus,
the compare pane and the theming rationale: [docs/workbench.md](docs/workbench.md).

## AI editing flow — one loop, two paths

`src/assist/stream.ts` is the **designated single entry point** and it picks the path:
the user's key runs `src/assist/editLoop.ts` browser-direct against OpenRouter; no key
POSTs to the Worker's demo. Both paths yield the same `src/assist/protocol.ts` frames,
so a caller tells them apart only by the `demoMode`/`mockMode` stamp on the done frame.
**An unstamped done frame means the user's own key paid for it.**

Three rules that outlive the details: **never restore a hardcoded `fetch` to the loop**
(the injected `ChatTransport` is what makes it testable); **the loop uses the published
schema only** — never teach the LLM proposed-schema fields; and **`worker/models.json`
is generated** — hand-editing the roster is a red test (`npm run update:roster`).
`workbench/` may reach the Worker only through `assist/`.

The self-correction loop, the validator/CSP/model-selection machinery and the
`anyOf` error filtering: [docs/assist-loop.md](docs/assist-loop.md).

## Rendering (custom SMuFL/SVG engine)

Pipeline: layout → primitives → SVG. `src/engine/layout/{notation,tab}.ts` are pure
functions emitting staff-space primitives; `src/engine/render/svg.ts` is the dumb
emitter. **All horizontal spacing** lives in `src/engine/layout/spacing.ts` — tune the
named knobs, never per-renderer grid math. Tab-staff emission lives ONCE in
`src/engine/layout/tabStaff.ts` — extend it there, never fork it. Layouts render
**forgivingly**: unsupported content degrades to a placeholder plus a per-measure badge,
never a silent clamp. Everything renders into shadow DOM. Do **not** reintroduce VexFlow
or any notation library.

The `both` single-system walk, the fret/string derivation ladder, diagnostic severities
and the note↔JSON cross-highlight: [docs/rendering.md](docs/rendering.md).

## MNX types and `_x.mnxLab` (v6)

Types: `src/model/mnx.ts`. **Documents are written as `.mnx.json`** (`.json`/`.mnx`
accepted on read; helpers in `converters/musicxml-mnx/src/common/mnxFile.ts`).
Everything MNX v19 can't express lives under the one vendor key **`_x.mnxLab`** (the
`_x` sub-key names a vendor, not a feature). v6 shape: note-level **flat**
`string`/`fret`/`fingering` (the string is the authoritative choice; `fret` is
optional and non-authoritative — validation only; single-source — no TAB clefs, no
duplicated staves), part-level flat `strings[]`/`capo`; only `tab.technique` (bends
are curves of `{position, alter}` in semitones) and `tab.staffKind` stay under the
`tab` sub-namespace. `rehearsal`/`section` are standard objects on the global measure
(two separate `{label}` objects — don't re-merge them); `harmonies` (structured +
literal, parallel to `tempos`) is the global-measure vendor block. Schema:
`spec/mnx-lab-extensions.schema.json`; register + rationale:
[docs/mnx-extensions.md](docs/mnx-extensions.md). Blocks are shaped like the standard
objects they draft (camelCase, `rhythmic-position`, note-id references) so adoption
deletes the wrapper — see roadmap/proposed/low-priority/spec-instrument-position.md and
roadmap/complete/core-derived-positions.md.
Extend `_x.mnxLab` and its schema — never standard MNX fields.
Saved documents upgrade v1→v2→v3→v4→v5→v6 on load via `src/model/upgradeTabExtension.ts`.

## The spec loop: sync down, push up

`vendor/mnx` is the spec repo as a submodule, **pin only**, and it is never checked out
to a proposal branch. A build **may read it but must never require it** — only the
`spec-media` copy touches it, and that skips with a warning when the submodule is
absent. Upstream is a *generated* site (Django fixture `doctools/data.json`); a spec
change edits the fixture, never `mnx-schema.json` by hand. Everything — reading it,
moving the pin, the worktree recipe, the doctools/`uv` setup — is in
[docs/mnx-spec-submodule.md](docs/mnx-spec-submodule.md).

- **`npm run sync:spec` (down)**: pinned fixture → `scenarios/spec/` mirrored scenarios
  (+ prose-drift tripwire in `spec/spec-prose.json`).
- **`node spec/tools/push-proposal.mjs <topic>` (up)**: injects a topic's scenarios,
  our engravings and `coversDefs` joins into the proposal branch's fixture, byte-stable.
  Proposal branches live in **git worktrees** (`~/dev/mnx-proposals/<branch>`).
- **On adoption**: move the pin, re-vendor, `sync:spec` mirrors the examples back down,
  the local scenarios retire, and `mnx-schema.proposed.json` + every
  `"schema": "proposed"` declaration are deleted.
  [#529](https://github.com/w3c-cg/mnx/pull/529) is the worked precedent.

## Converters

`converters/*` are npm workspaces, Node-only, never in the app build. alphaTab is
confined to `converters/guitarpro-mnx` and must never reach `src/`. Shared fixtures in
`converters/fixtures/` — **authored as Guitar Pro** (`.gpx` sources; `.mnx.json` derived
via `guitarpro-mnx --import`, `.xml` derived via `musicxml-mnx --export`); the one
exception is `Triplets-and-graces.gp`, hand-authored as GPIF because none of the three
app-authored scores contains a tuplet or a grace note. Both round trips are lossless and
tested (roadmap/complete/core-tuplets-grace-notes.md) — note ids are legitimately
rewritten by the MusicXML split, so compare technique
targets by resolution, not string equality. Tuplets and grace notes are **containers in
MNX and per-beat/per-note flags in both file formats**, so each direction collapses or
expands a run — the same asymmetry as voltas, solved the same way. **Guitar Pro string
numbering is inverted** relative to `_x.mnxLab` — go through
`converters/guitarpro-mnx/src/common/tuning.ts`, never open-code it. MusicXML allows
`<lyric>` on rests — never assume pitched notes. CLI:
`npx musicxml-mnx|guitarpro-mnx --import|--export <file> [--output out]` (derived output
names refuse to overwrite).

## Conventions

- **`.ts` extensions in imports are required** (`moduleResolution: bundler`).
- **Decorator config**: `experimentalDecorators` + `emitDecoratorMetadata` for Lit —
  don't flip to standard decorators without testing the whole tree.
- The clean-room shell is plain Lit — no Web Awesome, no other UI kit.
- Tests: root vitest = `harness/`; converter packages run their own
  (`npm -w @mnx-editor/<name> test`). The Worker and UI have no tests.
- `dist/` is gitignored build output. The scratch site for proposal verification comes
  from `makesite` in the worktree, not from this repo.
- **Git**: one worktree per agent, rebase, `--ff-only` self-merge to `main`, worktree
  deleted before the roadmap doc moves to `complete/` — the full contract is *Working in
  parallel* above, and it governs every session that edits a tracked file.
- Roadmap-driven development: interpret roadmap-shaped requests against `roadmap/`
  (index: [roadmap/README.md](roadmap/README.md)) — "add to the roadmap" → new doc in
  `roadmap/proposed/` + index line; "what's next" → propose from `inprogress/` +
  `proposed/`; finished efforts move to `complete/`. **Every roadmap doc is prefixed
  by what it serves** (all buckets renamed 2026-08-11): `studio-` and `workbench-`
  (the two shells), `core-` (the shared apparatus beneath them — model/engine/audio/
  edit/elements/converters), `spec-` (the spec loop: arguments about the standard,
  aimed upstream), `lab-` (the repo itself: structure, process, corpus machinery).
  Another prefix is acceptable only when it earns its keep: a concern that is
  genuinely separate *and* important enough to name.
- **`roadmap/proposed/low-priority/`** holds proposed items we are **unlikely to work
  on soon** — still wanted, still described, just not next. It is a priority signal, not
  a verdict: unlike `rejected/` (not worth building) and `superseded/` (overtaken),
  nothing here has been argued against, and a doc moves back up the moment it is picked
  up. Keeping it a subfolder of `proposed/` rather than a sibling bucket is deliberate —
  the bucket a doc lives in still means what it always meant, so nothing about
  promotion, prefixes or the index changes. **"What's next" answers from `proposed/`
  itself**; reach into `low-priority/` only when asked for the whole field, or when
  something there is a named dependency of the item in hand.
- **A `proposed/` doc is written only when it is asked for.** Noticing future work
  during a task is not a mandate to file it: name it in the reply and let the human
  decide. "Add to the roadmap", "write that up", or picking up a campaign row are the
  ask; a finished item's own follow-ups, a tempting refactor, and an idea that arrived
  mid-review are not. `proposed/` is the record of what was *chosen*, so a doc nobody
  recognises costs the next reader more than the idea was worth — and it makes "what's
  next" answer with noise.
- **Standing docs** live in `inprogress/` and never move to `complete/` — they record an
  obligation rather than a work item. [roadmap/inprogress/lab-verify.md](roadmap/inprogress/lab-verify.md)
  is the one that exists: the verification ledger every item hands its demoted scenarios
  to on the way out. Closing an item that moved a golden means **registering the batch
  there first** (cause, scenario set, what a reviewer should look for), with a two-way
  link between the two docs. Registration is not pre-approval, and the hand-edit ban on
  `status:`/`verification:` is unchanged.
- **`roadmap/rejected/`** holds proposals judged **not worth building** — distinct
  from `superseded/` (overtaken by reality or a later decision). A rejected doc keeps
  its full analysis: the point of the bucket is that whoever raises the idea again
  finds the case against it instead of redoing it. Claude may **demote a `proposed/`
  item to `rejected/` on its own judgement** when the item is of near-zero value or
  effectively "will never do" — the doc's own status must state the reason and date,
  and the index moves with it. Demotion is a filing correction, reversible by moving
  the doc back; when in doubt (the item has an owner, an active dependency, or a
  contested judgement), ask instead of demoting.
- **Campaigns**: a roadmap doc may be a *campaign* — an index over many normal
  proposals that share one goal, named `<prefix>-campaign-<name>.md` and living in the
  same buckets. The campaign carries three things: the **shared contract** its items
  follow when they are similar in nature (agreements every item must make before code),
  the **index** (rows may predate their docs — a row graduates to an ordinary proposal
  when picked up, and may adopt a pre-existing proposal), and a running **progress +
  learnings log** appended as items land, so later items start smarter than earlier
  ones. An indexed proposal names its campaign and inherits its contract. "Add to
  campaign X" → a new index row; closing an item → its learnings entry. A campaign
  moves to `inprogress/` when its first item does and to `complete/` when the index is
  exhausted or formally cut.
