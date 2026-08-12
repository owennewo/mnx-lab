# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**MNX Lab** (package `mnx-lab`) — a test bench for the developing W3C MNX notation format,
with emphasis on guitar tab. Custom SMuFL/SVG rendering engine (no third-party notation
libraries), an LLM-assisted edit loop through OpenRouter, and a scenario corpus with
human-verified engravings. The repo was rebuilt from an empty slate in 2026-07 per
[roadmap/complete/lab-structure-lab.md](roadmap/complete/lab-structure-lab.md); the full
pre-rebuild tree and history live on the **`legacy` branch** and **`pre-rebuild` tag** —
retrieve missing things from there, never reconstruct them from memory.

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
npm run build              # validators + boundaries + tsc (app+worker) + vite build
npm run build:lib          # the mnx-lab library face → dist/lib
npm run build:embed        # the embed face → dist/embed/mnx-lab.js
npm run smoke:lib          # npm pack → install → render SVG in Node via mnx-lab/engine
npm run deploy             # build + wrangler deploy (mnx-lab.totai.uk)
```

## Repository shape

```
spec/                the standard + our proposals against it
  mnx-schema.json         verbatim copy of the pinned upstream release — never edited
  mnx-schema.proposed.json generated from a proposal worktree — transient, dev-time only
  mnx-lab-extensions.schema.json  the _x.mnxLab vendor schema (v5)
  guitar-tab-extension.schema.json (v2 legacy, kept for upgrade tests), spec-prose.json,
  HISTORY.md
  proposals/<topic>/      evidence bundles: README, schema.diff, scenarios.md, engravings/
  tools/                  sync-spec-examples, specSource, push-proposal, compile-validator
scenarios/           ONE corpus format, two axes (below); manifest.json, meta.schema.json
harness/             every way the evidence is exercised
  conformance/            scenarios/primitives/tab-validation/upgrade/edit-ops tests
  verify/                 check-scenarios, verify-scenarios (the ONLY status writers),
                          lib-smoke
  render/                 render-png.ts (engravings for proposals; needs google-chrome)
  helpers/                corpusPrimitives (SMuFL from disk + fixed viewport), svgString
src/                 the apparatus — capability layers (order below)
  model/  engine/  audio/  edit/  corpus/  storage/  assist/  elements/  workbench/  entries/
worker/              Hono; a secrets-and-validation proxy for assist ONLY
  api/                    editNotation, models + reserved 501 seams documents, auth
  editLoop.ts             the self-correcting loop, factored for future evals
  prompts/editNotation.ts the LLM-facing system prompt (§-numbered, addressable)
  generated/              validators precompiled from spec/ (committed; schema DATA,
                          importable from any layer)
converters/          npm-workspace sub-packages + fixtures/ (the three scores)
apps/studio/         README only — the future consumer product's reserved seam
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

Each scenario is a directory (`meta.json`, `score.mnx.json`, optional
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
`harness/verify/verify-scenarios.mjs`; the record is *kept through demotion*, so the
attention queue distinguishes **stale** (approved once, output changed) from **never
seen** (no record). `npm run update:primitives` keeps statuses honest: a successful
snapshot write promotes `valid`→`rendered`, a changed snapshot demotes
`verified`→`rendered`, a layout crash demotes to `valid` (removing the snapshots). A
golden appearing for the **first** time is never a change — that is how a new golden is
introduced without mass-demoting the corpus. `renderHash` and `bothHash` are **optional**
in a record for the same reason: approvals predating a golden were real assertions made
on the evidence that existed, so their absence is not staleness; `--backfill-render`
stamps the former (what that asserts is spelled out at the flag), and `bothHash` has
**no backfill** — the combined system earns its hash only through a real approval.
`renderHash`'s file set is **frozen** at the two standalone SVGs; `expected.both.svg`
hashes separately, or adding it would have moved every committed digest at once. The
approval flow is the conversational **`/verify` skill** (`.claude/skills/verify/`) —
queue → one stable review page → verdicts in sentences; there is no human-facing CLI and
no checkbox page. The initial 57/57 sweep is recorded in
[roadmap/complete/lab-spec-approval.md](roadmap/complete/lab-spec-approval.md), still the recipe
for verifying renderer features.

**The goldens are the crown jewels.** Any move or refactor of `model/`/`engine/` must
reproduce them byte-identically (`npm run update:primitives` then a clean
`git diff -- scenarios/`); a mismatch stops the line — diff against `legacy`, never
"close enough".

The goldens per scenario cover different code.
`expected.primitives.json` pins layout, and stops at staff-space coordinates and SMuFL
glyph *names*. `expected.svg` puts those primitives through the real emitter
(`harness/helpers/corpusSvg.ts` → `src/engine/render/svg.ts`), pinning what
`expected.primitives.json` structurally cannot see: the glyph name→codepoint lookup, the
five emit branches, sp→px, the viewBox. Map `gClef` to the wrong codepoint and the
primitives hash does not move. `expected.both.svg` (tab-opting scenarios) pins the
combined notation+tab system — vertical composition, spanning barlines, interleaved
wrap — which the standalone projections structurally cannot see; it is deliberately
**not** a third `RenderedSystem` in the primitives file, so introducing it rewrote no
committed golden. It is **text, not pixels, on purpose** — a PNG hash would
absorb the local Chrome build, font hinting and antialiasing, so a browser upgrade would
demote every approval at once and the queue would stop meaning "the renderer changed".
`GOLDEN_PX_PER_SP` is a **power of two** so sp→px adds no float noise. PNGs stay what
they always were: proposal engravings and a review aid (`harness/render/render-png.ts`),
never a golden and never hashed.

## The workbench (`src/workbench/`) — review-first, no backend

Home is the **attention queue** (blocked → stale → never-seen; current counted, not
shown), derived from committed provenance in `src/workbench/queue.ts`. Every scenario + view
has a stable deep link: `#/scenario/<id>?view=notation|tab|both` (unspecified ⇒ the
document's `tab.staffKind` hint); legacy `?view=compare|json` links are honored and
open the matching tab of the scenario page's **side panel** (description | tags |
actions | hud | compare | json — roadmap/inprogress/core-score-hud.md), which holds
all page chrome including the selection HUD and the per-part instrument override
(the HUD's ensemble table → `<mnx-score-viewer>.partTabSetups`; the flat
`stringsOverride`/`capoOverride` pair remains for single-instrument embeds —
presentation only). Tab/both exist only when the strings are KNOWN — declared in
the document, or supplied through that override. No instrument is ever assumed.

**`#/objects`** is the coverage map — every non-plumbing `$def` against the scenarios
exercising it (`src/corpus/defIndex.ts`, inverting the spec's own `coversDefs` join),
tiered **never exercised → one example → covered**. Counts read *verified / total*, so an
object covered only by unapproved scenarios reads as exercised-but-not-evidence; the
header's coverage fraction links here, because a fraction is a scoreboard and the tiers
are a work queue. **`#/objects/<def>`** is both the per-object page and the rail filter:
it writes `def:<name>` into the rail's search box, so filtering is deep-linkable, visible
and clearable by the one control that already exists — there is no second filter mode.
A scenario page tags its `featureDefs` (plumbing stripped: median 5, vs 25 raw), capped
at nine with a `+N more`.

The rail groups by **topic**, not by authoring category — `src/corpus/groups.ts`, an
ordered name→regex table matched on the scenario id, **first match wins**. The spec has
no taxonomy to inherit (its own index is a flat alphabetical list of 52 "example
documents"), and our nine categories held one scenario each, so both halves read badly;
topic groups interleave them instead. The grouping is OURS and display-only — never in
`scenarios/spec/` or a meta.json. Order is load-bearing, so
`harness/conformance/groups.test.ts` asserts nothing is ungrouped **and no group is
empty** — an empty group is the signature of a broad rule above stealing a narrow rule's
scenarios. A rail row carries two orthogonal signals: the **dot** is queue state via the
shared `classify()` (shape as well as colour, so *stale* stops looking like *never
seen*), and the **tags** are provenance — `spec` for mirrored (hand-edits forbidden),
`proposed` for schema probes. The
**compare** view shows our render beside the spec's reference engraving at
`/spec-media/<slug>.png` — read-only from the pinned `vendor/mnx` by Vite middleware in
dev, and copied into `dist/client/spec-media/` by the same plugin at build time. Built
without the submodule, the pane degrades to a note. The images are the CG's, shown with
attribution and never committed here. The scenario page distinguishes **loading** from
**failed** (the score is a lazy chunk — a dead dev server must not read as a render bug).

**The workbench has no backend — by rule.** It must stay fully functional (minus live
AI edits) from static build output alone: the corpus is committed JSON, documents live
in IndexedDB, and every verification write happens through harness scripts editing repo
files — git is the database and the audit trail. The Worker is *not* its backend;
`workbench/` may reach it only through `assist/`. If browser-driven corpus authoring is ever wanted,
the pattern is a dev-only Vite middleware writing repo files — never a deployed API.
The real API layer (documents, auth, sync) belongs to **studio**
([apps/studio/README.md](apps/studio/README.md)) on the reserved seams
(`worker/api/documents|auth` 501 stubs, `storage/cloudRepository.ts`).

## AI editing flow (`/api/edit-notation`)

A **self-correcting NDJSON stream**: `src/assist/protocol.ts` defines the frames
(shared by Worker and client), `worker/editLoop.ts` runs the loop — forced
`update_document` tool call (with a `required`→`auto` tool_choice fallback), streamed
accumulation, then **two verdicts**: the official schema and every `_x.mnxLab` dict
against the extension schema. On failure the failed tool call + a synthetic
`role: 'tool'` error re-enter the conversation, up to 3 attempts.
`formatValidationErrors` deliberately filters `anyOf`/`oneOf`/`allOf` noise down to the
`event` branch — don't "fix" it, that makes errors unusable. With no
`OPENROUTER_API_KEY` (from `.dev.vars` locally, a Worker secret in prod) the shared
mock (`src/assist/mock.ts`) keeps the UI demoable. **Workers can't run
`ajv.compile()`**, so validators are precompiled by `spec/tools/compile-validator.mjs`
into `worker/generated/` (committed; rebuilt by `npm run build`). **The Worker and the
retry loop use the published schema only** — never teach the LLM proposed-schema fields.
When touching `worker/prompts/editNotation.ts` or the tool schema, mirror structural
rules (plural `notes` array, etc.) — they are the primary defense against schema drift.

## Rendering (custom SMuFL/SVG engine)

Pipeline: layout → primitives → SVG. `src/engine/layout/{notation,tab}.ts` are pure
functions emitting staff-space primitives; `src/engine/render/svg.ts` is the dumb
emitter. **All horizontal spacing** lives in `src/engine/layout/spacing.ts` (springs-
and-rods; tune the named knobs, never per-renderer grid math) — both layouts consume one
plan so notation and tab stay column-aligned. The `both` view is **one native system**:
`layoutNotation({includeTabStaves: true})` (seam: `src/engine/layout/bothSystem.ts`)
draws each tab-bearing part's tab staff inside the same system walk — shared barlines,
interleaved multi-system wrap, columns aligned by shared plan slots. Tab-staff emission
(lines/clef/timesig/frets) lives ONCE in `src/engine/layout/tabStaff.ts`, used by both
the standalone tab layout and the native staff — extend it there, never fork it. See
[roadmap/complete/core-both-view-single-system.md](roadmap/complete/core-both-view-single-system.md). Fret/string assignment uses
the derivation ladder in `src/engine/tab/guitarPositions.ts` (MNX pitch is
sounding): an annotated `_x.mnxLab.string` derives its fret against the declared
`strings[]` + capo (a stored `fret` is validation-only — a mismatch renders the
derived fret plus a red badge), bare notes get the lowest-playable-fret
assignment, and unplayable notes draw nothing plus a red `scope: 'tab'` badge —
never a silent clamp. **No instrument is assumed**: absent `strings[]` means no
fingerboard (the shim materializes standard into older tab documents); a viewer
override (`TabSetup`) may supply strings/capo as presentation. Layouts render **forgivingly**:
unsupported content degrades to a placeholder and per-measure "!" badges
(`src/engine/layout/diagnostics.ts`) — red = user-fixable error, blue = warning, amber =
renderer gap. `ValidationIssue.scope: 'tab'` marks fingerboard-only constraints (the
notation renderer drops them; severity matters — a warning must not read as "you made a
mistake", and the schema validators must never see these). Everything renders into
shadow DOM. Do **not** reintroduce VexFlow or any notation library. The note↔JSON
cross-highlight depends on `model/noteKeys.ts` and `model/jsonView.ts` mirroring the
same traversal — keep them in lockstep.

## MNX types and `_x.mnxLab` (v5)

Types: `src/model/mnx.ts`. **Documents are written as `.mnx.json`** (`.json`/`.mnx`
accepted on read; helpers in `converters/musicxml-mnx/src/common/mnxFile.ts`).
Everything MNX v19 can't express lives under the one vendor key **`_x.mnxLab`** (the
`_x` sub-key names a vendor, not a feature). v5 shape: note-level **flat**
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
deletes the wrapper — see roadmap/proposed/{instrument-position,derived-positions}.md.
Extend `_x.mnxLab` and its schema — never standard MNX fields.
Saved documents upgrade v1→v2→v3→v4→v5 on load via `src/model/upgradeTabExtension.ts`.

## The spec loop: sync down, push up

`vendor/mnx` is the spec repo as a submodule, **pin only**, and it is never checked out
to a proposal branch. A build **may read it but must never require it**: the only build
that touches it is the `spec-media` copy above, which skips with a warning when the
submodule is absent, so `npm run build` still succeeds in a fresh clone (the compare pane
degrades). Nothing else in a build or deploy reads it. Upstream is a
*generated* site (Django fixture `doctools/data.json`); a spec change edits the fixture,
never `mnx-schema.json` by hand. Everything — reading it, moving the pin, the worktree
recipe, the doctools/`uv` setup — is in
[docs/mnx-spec-submodule.md](docs/mnx-spec-submodule.md).

- **`npm run sync:spec` (down)**: pinned fixture → `scenarios/spec/` mirrored scenarios
  (+ prose-drift tripwire in `spec/spec-prose.json`).
- **`node spec/tools/push-proposal.mjs <topic>` (up)**: injects a topic's scenarios,
  our engravings and `coversDefs` joins into the proposal branch's fixture, byte-stable.
  Proposal branches live in **git worktrees** (`~/dev/mnx-proposals/<branch>`), where
  `makesite` verifies the result and `mnx-schema.proposed.json` is generated from.
- **On adoption**: move the pin, re-vendor, `sync:spec` mirrors the examples back down,
  the local scenarios retire, and `mnx-schema.proposed.json` + every
  `"schema": "proposed"` declaration are deleted.
  [#529](https://github.com/w3c-cg/mnx/pull/529) is the worked precedent.

## Converters

`converters/*` are npm workspaces, Node-only, never in the app build. Shared fixtures in
`converters/fixtures/` — **authored as Guitar Pro** (`.gpx` sources; `.mnx.json` derived
via `guitarpro-mnx --import`, `.xml` derived via `musicxml-mnx --export`). Both round
trips are lossless and tested (notes, technique, lyrics, repeats, voltas, tuning, capo,
key; note ids are legitimately rewritten by the MusicXML split — compare technique
targets by resolution, not string equality). **Guitar Pro string numbering is inverted**
relative to `_x.mnxLab` — go through `converters/guitarpro-mnx/src/common/tuning.ts`,
never open-code it. MusicXML allows `<lyric>` on rests — never assume pitched notes.
CLI: `npx musicxml-mnx|guitarpro-mnx --import|--export <file> [--output out]` (derived
output names refuse to overwrite).

## Conventions

- **`.ts` extensions in imports are required** (`moduleResolution: bundler`).
- **Decorator config**: `experimentalDecorators` + `emitDecoratorMetadata` for Lit —
  don't flip to standard decorators without testing the whole tree.
- The clean-room shell is plain Lit — no Web Awesome, no other UI kit.
- Tests: root vitest = `harness/`; converter packages run their own
  (`npm -w @mnx-editor/<name> test`). The Worker and UI have no tests.
- `dist/` is gitignored build output. The scratch site for proposal verification comes
  from `makesite` in the worktree, not from this repo.
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
