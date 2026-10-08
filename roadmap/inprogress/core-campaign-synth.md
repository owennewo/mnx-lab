# Campaign: the synth — guitar-faust moves into `synth/`

> **A campaign** (see CLAUDE.md → Roadmap-driven development): this doc is the plan of record
> for moving the guitar-faust synth into this repository as `synth/` (its own module and its own
> shell at `/synth/`) and for playing studio's scores through it. Indexed items will be filed as
> ordinary `core-*`/`studio-*` proposals that name this campaign as each phase starts.
> **Opened 2026-10-08** by Claude Opus 5.5 in Claude Code, at the lead's direction (quoted
> below). It replaces guitar-faust's "headless library" integration plan of 2026-10-07, which
> kept the synth in its own repository.

**Status: Phase 0 (readiness and decisions) in progress, 2026-10-08.** The synth's own history,
its campaigns and their evidence logs (the instrument host campaign, the chain campaign that
produced synth 0.2.0) stay in the guitar-faust repository (`~/dev/guitar-faust/plans/`), which
becomes the read-only record after the move (S1, S14).

## The lead's directions (8 October 2026)

> I see mnx-lab as being a mono repo. moving it to mnx-lab/synth is therefore still maintaining
> it as a separate app/module but within a repo. I'm happy for it to be moved (losing its
> history). I think mnx-lab already has two apps /studio and /workbench, no?

> sorry, you are right it isn't just on this laptop. it is in cloudflare/deployed so we should
> yes - maybe we should get serious with licences/notices.

> synth lives in the same repo/shared folder, getting the synth without a registry is therefore
> very achievable

> performance-listening will be paused whilst this migration takes place. you have permission
> to migrate to mnx-lab/synth

> [the remaining decisions, M3–M11:] fine - happy with those

> lets add a stage where a landing page of / (root) has links to the 3 apps /studio /synth and
> /workbench and also adding notice/licenses page linked off this home page. the repo can also
> have LICENSE and or NOTICE markdown files. synth can be open access

> ok lets go with agpl + commercial

> I accept your recommendations - i don't particularly want to be and address for commercial
> enquiries - they can work out contact from github

Earlier the same day: "Only local usage is allowed for now" (no npm or other registry).

## What changes from the 7 October plan

The 7 October plan kept guitar-faust as its own repository and had mnx-lab consume a published
library (M2 "no move"). The lead has now chosen the **monorepo**: the synth moves into
`mnx-lab/synth/` as its own module and app, beside `/studio/` and `/workbench/`. mnx-lab does
already have those two shells, plus the embed and library build faces. The synth's git history
is not imported; the guitar-faust repository stays on disk, read-only, as the record of how 0.2.0
was made. Everything the old plan said about the contract, the transport, the part router, studio
choosing (never editing) instruments, D1 rig references and retiring the old sink still holds;
only the dependency route and the hosting change.

## Shape

```
mnx-lab (monorepo; github.com/owennewo/mnx-lab is PUBLIC; deployed at mnx-lab.totai.uk)
 ├─ synth/                  npm workspace "@mnx-lab/synth" — the whole synth: contract, host,
 │                          instruments, blocks, app, DSP sources, compiled WASM, pieces, tests
 │   └─ its app             a third shell at /synth/ (configure instruments, chains, sessions)
 ├─ src/audio/              the transport emits mnx-sound/2 notes and controls to the synth's
 │                          host through @mnx-lab/synth's public exports only
 ├─ apps/studio/            chooses each part's instrument (a factory design or a rig 3.0.0
 │                          from /synth/), never edits it; plays through the host
 ├─ /  (new home page)      links to /studio/, /synth/ and /workbench/, and to /notices/
 ├─ /notices/               the site's licence and every third-party notice it ships
 └─ LICENSE.md, NOTICE.md   the same, in the repository
```

## Entry criteria

- Synth 0.2.0 released locally with the release gate and the lead's listening sign-off. **Met
  8 Oct 2026** (guitar-faust `dist/releases/0.2.0-candidate-6767127d0b4238df`).
- Contract `mnx-sound/2`, rig 3.0.0 and the conformance fixtures versioned. **Met.**
- mnx-lab's performance-listening work paused for the duration. **Directed by the lead,
  8 Oct 2026**; to be recorded in mnx-lab (`roadmap/inprogress/lab-listening-promotion.md`).

## Goals

1. The synth lives in `mnx-lab/synth/`, builds and passes its own suites there, with its
   guarantees intact: determinism (Node ≡ worklet), reference renders, conformance, budgets,
   reproducible DSP builds where FAUST is installed.
2. Its app is served as `/synth/` from mnx-lab's build and deployment, same origin as studio,
   open to everyone (no Cloudflare Access).
2a. The site's root `/` is a home page linking to the three apps and to a licences and notices
   page; the repository carries `LICENSE.md` and `NOTICE.md`.
3. mnx-lab's transport emits contract `Note`s and `Control`s (tempo controls, chord gestures,
   techniques unflattened), not `SinkEvent`s.
4. A part router sends each mnx part to the right instrument kind; unsupported material is
   lowered or reported, never dropped silently.
5. Studio chooses each part's instrument (factory design or a rig from `/synth/`), stores the
   choice per piece and part, and never edits it.
6. The old `Sink`/`SynthBackend` is retired for covered parts; MIDI export uses `lower()`.
7. Every third-party licence and notice the synth ships is complete before it is public.

## Non-goals

- Importing guitar-faust's git history.
- Any instrument, rig or session editor inside studio (configuration stays in `/synth/`).
- Publishing to npm or any registry.
- New instrument kinds, contract versions, or synth sound work (a later plan).

## Guardrails

| Guardrail | Check |
|---|---|
| mnx-lab conventions | One worktree per task outside the repo; rebase, `npm run gate`, `--ff-only` self-merge; never `git stash`; stop what you start (mnx-lab CLAUDE.md) |
| **Nothing public before the licence decision** | No synth code reaches mnx-lab's `main` (pushed to a public repository) or the deployed site until decision S8 is settled and the notices are complete |
| The synth's guarantees | Its `npm test`, reference renders, browser flows and worklet parity pass inside mnx-lab exactly as in guitar-faust; a move must not change a reference hash |
| mnx-lab's guarantees | Its goldens, tests, smokes and boundaries stay green; the layer order is not loosened without the lead |
| One seam | mnx-lab code imports only `@mnx-lab/synth`'s public exports, never synth source paths |
| No silent loss | Every lowered or unsupported technique or part is a diagnostic visible in studio |
| Saved data | Existing studio pieces open and play; stored rig references carry contract, rig and synth versions |

## Status board

| Phase | Title | Status | Exit evidence |
|---|---|---|---|
| 0 | Readiness and decisions | ☑ Done | this campaign doc (`f9e87a32`); decisions S1–S17 agreed; licence AGPL-3.0-only + commercial |
| 1 | Move the synth into `mnx-lab/synth/` | ☑ Done | synth suite 119 pass + cost inside mnx-lab; references unchanged; DSP reproduces; full mnx-lab gate green |
| 2 | The `/synth/` shell: build, CSP, smokes | ☑ Done | `vite build` places the synth's app at `/synth/`; CSP `'wasm-unsafe-eval'`; `synth` smoke (22 flows under the deployed CSP) |
| 3 | Home page, licences and notices; **first landing** | ☑ Done | home page at `/`, `/notices/`, `LICENSE.md`, `NOTICE.md`, `CONTRIBUTING.md`; `home` smoke; notices test; landed with Phases 1–2 |
| 4 | Contract adoption in the transport | ☐ Not started | |
| 5 | Host backend and part router | ☐ Not started | |
| 6 | Studio: choosing instruments and rigs | ☐ Not started | |
| 7 | Persistence: rig references in D1 | ☐ Not started | |
| 8 | Retire the old sink | ☐ Not started | |
| 9 | Performance, smokes and archiving guitar-faust | ☐ Not started | |

## Phase 0 — Readiness and decisions

- [x] Survey mnx-lab (read-only):
  - workspaces: `converters/*` and the listening bench;
  - shells: `workbench/` and `studio/` as Vite inputs, plus the embed and library faces;
  - the machine-enforced layer order (`.dependency-cruiser.cjs`);
  - the landing gate's path rules (`docs/gates.md`: an unrecognised path runs everything);
  - the CSP in `public/_headers` and the Workers Assets deployment (`wrangler.jsonc`);
  - the roadmap conventions and the player campaign.

  mnx-lab is unchanged since 6 October. The integration seams the old plan named
  (`src/audio/expression.ts`, `sink.ts`, `native/synthBackend.ts`, `playbackBackend.ts`,
  `apps/studio/src/InstrumentsSheet.ts`) still exist.
- [x] Rewrite this plan for the move and quote the lead's directions.
- [x] **S8 settled:** AGPL-3.0 + commercial (the lead); applied to the whole repository.
- [x] S11: `/synth/` is open access (the lead).
- [x] S12, S14, S16 and the licence details (S17) settled: the agent's recommendations, accepted by the lead.
- [x] The notices work (the eight untagged FAUST functions; full texts for STK-4.3, FAUST's LGPL
  with exception and V8/fdlibm) moved into Phase 3 with `LICENSE.md` and `NOTICE.md`.
- [x] This campaign doc, its index line in `roadmap/README.md`, and the pause recorded in
  `roadmap/inprogress/lab-listening-promotion.md` with the lead's words (worktree
  `core-campaign-synth`).
- [x] Inventory what moves and what stays (below).

**Exit:** decisions S1–S16 agreed (S12, S14 and S16 are proposed and settle as their phases
start); the licence chosen (S8); this doc landed. The notices work itself is Phase 3.

### What moves, what stays

| Moves to `mnx-lab/synth/` | Stays in guitar-faust (history) |
|---|---|
| `web/` (contract, host, instruments, blocks, audio, model, app, data, generated WASM); `dsp/`; the `scripts/` builds, measurements and release tooling needed; `tests/` and their support; the `package.json` scripts; README, LISTENING and notices | `plans/` (the campaigns and evidence logs); `references/`, `output/`, `build/`; `dist/` (the 0.2.0 release); `plans/archive/`; the research data under `web/data/instrument-model/` and `dry-comparison/`, unless a test reads them |

## Phase 1 — Move the synth into `mnx-lab/synth/`

- [x] Copy the moving tree into `synth/` as an npm workspace (`@mnx-lab/synth`, private,
  version 0.2.0).
  - Paths that assume the repo root become workspace-relative.
  - FAUST staging (`/tmp/guitar-faust-dsp`) keeps a fixed path, so builds still reproduce byte
    for byte.
- [x] The synth's suites run inside mnx-lab (`npm -w @mnx-lab/synth test`): reference hashes,
  app flows from its own server, worklet parity, the cost check.
- [x] Root tooling learns the area:
  - TypeScript and dependency-cruiser treat `synth/` as an external package;
  - the gate maps `synth/**` to the synth's suites (S12);
  - `vitest` excludes it.
- [x] Notices and licence files present (S8).

**Exit:** green synth suites and a green mnx-lab gate in the worktree; reference hashes
unchanged; nothing landed until S8 allows it.

## Phase 2 — The `/synth/` shell

- [x] Build the synth app into mnx-lab's client output at `/synth/` (its own build, or a Vite
  input), with same-origin worklet and WASM loading.
- [x] CSP: `'wasm-unsafe-eval'` in `script-src`; `smoke:csp` covers WASM compilation and the
  worklet.
- [x] Open access (S11): no Cloudflare Access rule for `/synth/`. The synth's app flows join
  mnx-lab's smoke runner with their `covers`.
- [ ] Nothing lands or deploys before Phase 3 (S8).

## Phase 3 — Home page, licences and notices; first landing

- [x] **Home page at `/`**, replacing the Worker's redirect to `/studio/` (`worker/index.ts`).
  It is a static page in mnx-lab's build, plain and accessible, with links to `/studio/`
  (behind Access), `/synth/` and `/workbench/` and a one-line description of each, plus a
  link to the notices page.
- [x] **Licences and notices page** (`/notices/`), linked from the home page:
  - the site's own licence (S8);
  - every third-party component the deployed site ships, with its notice and licence text.
    That means the synth's FAUST library functions (STK-4.3, LGPL with exception) and the
    V8/fdlibm math port, plus mnx-lab's own: Lit and `@lit/context`, Hono, jose, the Archivo
    font (`@fontsource/archivo`), the SMuFL fonts in `public/smufl/`, the CC0 sample packs,
    the MNX schema copy, and anything else the inventory finds;
  - the inventory generated from the bundle or the lockfile where possible, so it cannot fall
    behind.
- [x] **Repository files:** `LICENSE.md` (the AGPL-3.0 text, S8/S17), `NOTICE.md` (the same
  third-party inventory, the synth's notices folded in), a "Commercial licensing" section in the
  README (enquiries via GitHub, S17) and `CONTRIBUTING.md` (S16); `package.json` licence fields.
- [x] Smokes: the home page and the notices page load and link correctly; the CSP still holds.
- [ ] **First landing** (mnx-lab's process: rebase, `npm run gate`, `--ff-only`, push `main`)
  of Phases 1–3 together, only once S8 is settled; then deploy.

## Phase 4 — Contract adoption in the transport

- [ ] Split `src/audio/expression.ts`:
  - musical timing and dynamics stay in mnx;
  - instrument techniques become contract technique objects;
  - MNX `arpeggio` and Guitar Pro brushes become chord gestures;
  - tempo becomes `tempo` controls.
- [ ] Map mnx parts to setup parts: kind, layout from `_x.mnxLab.strings` and capo, kit pieces
  via `pieceFromGm`.
- [ ] The transport emits batches with stable ids and `through`; lookahead ≥ the commit horizon;
  seek and stop use `cancel({from, silence:true})`; loop and rate are preserved.
- [ ] Scenario → event-log export; the synth's conformance kit runs on the exported logs.
- [ ] `writtenIds` ↔ note ids for highlighting and diagnostics.

## Phase 5 — Host backend and part router

- [ ] `PlaybackBackend` on `InstrumentHost`.
- [ ] Part router: `plucked` / `keys` / `kit`; other kinds are lowered to a transitional
  generic host, then muted with a diagnostic (S4).
- [ ] Diagnostics and meters in studio; a feature flag between old and new playback.

## Phase 6 — Studio: choosing instruments and rigs

- [ ] `InstrumentsSheet`: per part, a factory design or a rig 3.0.0 from `/synth/`. File import
  comes first, a same-origin hand-off later (S9). The score stays the tuning authority
  (contract D4).
- [ ] An "Open in /synth/" link for editing; the edited rig comes back by export and import.

## Phase 7 — Persistence: rig references in D1

- [ ] A migration storing, per (piece, part), a factory design reference or an opaque rig 3.0.0
  blob, with the contract, rig and synth versions.
  - Rows are validated by the synth's pure-JS validators in the Worker.
  - The synth never migrates rigs; a later rig format is an explicit decision.

## Phase 8 — Retire the old sink

- [ ] Remove `Sink`/`SynthBackend` playback for covered parts.
- [ ] Sample packs per S6; MIDI export via `lower()`.
- [ ] Remove the feature flag.

## Phase 9 — Performance, smokes and archiving guitar-faust

- [ ] A studio performance smoke for a multi-part piece; the synth's benchmark inside mnx-lab's
  build, compared with its own results.
- [ ] guitar-faust: a final commit pointing to `mnx-lab/synth/`; the repository kept read-only.
- [ ] Resume performance-listening (the lead's call).

## Decisions register

| # | Decision | Status |
|---|---|---|
| S1 | **Move** the synth into `mnx-lab/synth/` as its own module and app. Its history is not imported; guitar-faust stays read-only as the record (replaces M2) | agreed (lead, 8 Oct 2026) |
| S2 | **No registry**: an npm workspace in the monorepo. mnx-lab imports `@mnx-lab/synth`'s public exports; the synth keeps its own version (replaces M1) | agreed (lead, 8 Oct 2026) |
| S3 | Contract source of truth: `synth/web/contract/`, reviewed with both sides' tests (was M3) | agreed (lead, 8 Oct 2026) |
| S4 | Parts with no host kind are lowered to a transitional generic host until retirement, then muted with a diagnostic (was M4) | agreed (lead, 8 Oct 2026) |
| S5 | Configuration happens only in the synth's app; studio chooses (was M6) | agreed (7 Oct 2026) |
| S6 | Sample packs stay for keys until the synth's keys are better than basic (was M7) | agreed (lead, 8 Oct 2026) |
| S7 | FAUST never runs in mnx-lab's CI: compiled WASM is committed, and the reproducibility check runs where FAUST is installed (was M8) | agreed (lead, 8 Oct 2026) |
| S8 | **Licence: AGPL-3.0 + commercial (dual licensing)**, copyright Owen Williams, for the whole mnx-lab repository including `synth/`. `LICENSE.md` carries the AGPL-3.0 text; a commercial licence is available from the copyright holder. Third-party components keep their own licences (`NOTICE.md`, `/notices/`). The notices must be complete **before** any synth file reaches mnx-lab's pushed `main` or the deployed site (was M9) | agreed (lead, 8 Oct 2026); scope (whole repository) applied on the agent's recommendation, open to the lead's change before the first landing |
| S16 | No CLA yet. A short `CONTRIBUTING.md` says outside contributions need a signed agreement allowing relicensing, and none are accepted until one exists; then a standard agreement (Harmony, or an adapted Apache CLA) with a lawyer. A DCO is not enough for dual licensing | agreed (lead, 8 Oct 2026) |
| S17 | **Licence details**: **AGPL-3.0-only**; "Copyright © 2026 Owen Williams"; AGPL covers all code and content here except where `NOTICE.md` says otherwise (W3C MNX copies and mirrored scenarios, the MusicXML test suite (MIT), sample packs (CC0), fonts (OFL), the FAUST and V8 code); `package.json` `"license": "AGPL-3.0-only OR LicenseRef-Commercial"`, no per-file headers; the home and notices pages link the source on GitHub; a lawyer reviews the commercial licence text before any deal. **Commercial enquiries go to the copyright holder through GitHub (`github.com/owennewo`); no email address is published** | agreed (lead, 8 Oct 2026) |
| S9 | Custom rigs reach studio by file import first; a same-origin hand-off from `/synth/` later (was M10) | agreed (lead, 8 Oct 2026) |
| S10 | Same-origin only: everything is served from mnx-lab's own build (was M11) | agreed (lead, 8 Oct 2026) |
| S11 | `/synth/` on the deployed site is **open access**, like `/workbench/` | agreed (lead, 8 Oct 2026) |
| S15 | The site's root becomes a **home page** linking to `/studio/`, `/synth/`, `/workbench/` and a **licences and notices page**; the repository carries `LICENSE.md` and `NOTICE.md` | agreed (lead, 8 Oct 2026) |
| S12 | `synth/` is a workspace with its own runner, like the converters. Root `vitest` excludes it. The gate gets a `synth` area: `synth/**` runs the synth's functional suite in the checks lane, and its browser flows and worklet parity become smokes covering `synth`, run against the built `/synth/`. The timing-based cost check, the benchmark and the DSP reproducibility check (`synth:verify-dsp`, where FAUST is installed, S7) stay manual. `gate-plan.test.ts` pins the rule | agreed (lead, 8 Oct 2026) |
| S13 | mnx-lab's performance-listening work is paused for the migration | agreed (lead, 8 Oct 2026) |
| S14 | Once Phase 3 has landed and the synth's suites are green here, guitar-faust gets one final commit: a README banner pointing to `synth/` and saying development stops there. Plans, evidence, references and the 0.2.0 release folder are kept; its local servers are stopped. The synth's version continues here, 0.2.0 at the move and `0.3.0-dev` next. guitar-faust stays unlicensed and private; only this copy is AGPL | agreed (lead, 8 Oct 2026) |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Publishing by landing: mnx-lab's `main` is pushed to a public GitHub repository | High | S8 blocks every landing; Phase 1 runs in a worktree until then |
| The gate runs everything for an unrecognised `synth/` path, or misses synth regressions | Medium | S12: an explicit `synth` area in the gate, pinned by `gate-plan.test.ts` |
| Two test runners and two styles in one repo | Low | The synth is a workspace with its own conventions, like the converters |
| Bundle and asset size in studio (WASM) | Medium | Lazy-load the synth only when a part plays; record the sizes |
| CPU contention with mnx-lab's timing experiments | Low | Paused by the lead (S13) |

## Evidence log

- 2026-10-08 — Plan rewritten for the monorepo move (S1, S2) after the lead's directions
  (quoted above). The read-only survey of mnx-lab found it unchanged since 6 October, with the
  integration seams intact.
  - **Found:** mnx-lab's GitHub repository is public, so landing the synth there publishes it.
    S8 is now blocking, and a guardrail was added.
  - Nothing had been written to mnx-lab at that point.
- 2026-10-08 — The lead added a stage and settled S11 (quoted above): a home page at `/` linking
  to the three apps and to a licences and notices page; `LICENSE.md` and `NOTICE.md` in the
  repository; `/synth/` open access. This is now Phase 3, which ends with the first landing.
  Later phases were renumbered (4–9).
  - The survey found the root redirect in `worker/index.ts`.
  - The site's own third-party material (Lit, Hono, jose, Archivo, the SMuFL fonts, CC0 samples,
    the MNX schema) joins the synth's in the notices inventory.
  - Still open: which licence (S8).
- 2026-10-08 — **S8 settled: AGPL-3.0 + commercial.** Before deciding, the lead asked about GPL versus AGPL and dual licensing.
  - **The agent's advice:**
    - Dual licensing needs clean copyright ownership; S16 adds a CLA for outside contributions.
    - Every shipped third-party component is permissive or carries an exception, so it is compatible with both the AGPL and a commercial licence.
    - AGPL section 13 covers server-side use, such as a headless synth rendering audio for a service, which the GPL leaves free.
    - Licensing can be loosened later but not tightened.
    - Caveat: the copyright status of purely AI-generated code is unsettled in some jurisdictions, which may weaken enforcement. A lawyer should review the commercial licence text and any deal.
  - **Scope:** the whole repository, as recommended, adjustable before the first landing.
- 2026-10-08 — This doc filed in mnx-lab as the plan of record (worktree `core-campaign-synth`),
  with the performance-listening pause recorded in `lab-listening-promotion.md`. guitar-faust's
  copy becomes a pointer here.
- 2026-10-08 — **Phase 0 done.** The lead accepted the recommendations for S12 (the gate), S14
  (archiving guitar-faust) and S16 (no CLA yet; `CONTRIBUTING.md`), and the licence details (S17).
  No commercial-enquiry address will be published: contact goes through GitHub.
- 2026-10-08 — **Phase 1 done in the worktree `core-synth-move`** (not landed: S8/Phase 3).
  - **Moved:** guitar-faust's tracked tree at `2a3785e`, without `plans/`, copied into `synth/`. That is 184 files, 2.2 MB; the 566 MB of untracked research data stayed behind.
  - **Package:** renamed `@mnx-lab/synth` (workspace and built library, tarball `mnx-lab-synth-<v>.tgz`), with `exports` mirroring the library's subpaths onto `web/`. Registered in the root `workspaces`; the lockfile gained only the workspace link.
  - **Contract document:** `plans/instrument-host-contract.md` moved to `synth/docs/contract.md`, links rewritten. The synth README points here and to guitar-faust for history.
  - **Gate (S12):** `tools/gate.mjs` has a `synth` area. `synth/**` (except top-level prose) runs `npm -w @mnx-lab/synth run test:gate`, which is the synth suite without its timing-based cost check. Pinned in `gate-plan.test.ts` and documented in `docs/gates.md`. TypeScript, vitest and dependency-cruiser already exclude `synth/`.
  - **Evidence:**
    - `npm -w @mnx-lab/synth test`: 119 pass, 1 skip, cost check keys 0.20 and kit 0.10. The reference hashes are unchanged, so the move changed no audio.
    - `build:v2` reproduces the published Engine2 binary byte for byte from `synth/`; blocks and basic instruments rebuild identically (`diff -r` of `web/generated` against guitar-faust is empty).
    - The synth's app flows pass, as do worklet = Node and the packaged-library smoke with its browser case.
    - **mnx-lab's full gate passed:** every root test, the static checks, the build, all 24 smokes, the listening bench and the new synth lane.
- 2026-10-08 — **Phase 2 done** (worktree `core-synth-move`).
  - **Build:** a Vite plugin (`synthShell` in `vite.config.ts`) runs the synth's own deterministic app build into `<client outDir>/synth/` (89 files, 944 KB), so its worklet, Worker and WASM URLs are not rewritten. The dev server serves `synth/web/` at `/synth/` unchanged (checked: HTML, JS, WASM and JSON with the right types).
  - **CSP:** `public/_headers` admits `'wasm-unsafe-eval'` (WebAssembly compilation only, not `eval`), with the reason recorded beside the policy.
  - **Smoke:** `harness/verify/synth-smoke.mjs` serves the built site with the headers read from `public/_headers` and runs the synth's 22 app flows (Playwright via `playwright-core` 1.63.0, a dev dependency of the synth workspace, on the system Chrome) against `/synth/`; any CSP refusal is a page error. The gate maps `synth/**` to the build and this smoke. `/synth/` is open access (S11): Cloudflare Access covers only `/studio/` (checked on the live site: `/` and `/workbench/` answer without Access).
- 2026-10-08 — **Phase 3 done.**
  - **Pages:**
    - `/` is a static home page (`index.html`, styled by `site/site.css` with Archivo, light and dark) linking studio (sign-in), the synth, the workbench, the notices page and the source. The Worker's root redirect to `/studio/` is removed; the library-access test now expects the Worker to leave `/` to the asset.
    - `/notices/` and `NOTICE.md` are generated by `tools/notices.mjs` from one inventory of 20 components, with full licence texts in `public/licenses/` (served at `/licenses/`): AGPL-3.0, BSD-3-Clause (Lit), OFL-1.1 (Archivo, Bravura), MIT (fflate, xmldom, Hono, jose), CC0-1.0 (samples), STK-4.3 and LGPL-2.1 + the FAUST exception (from the pinned FAUST libraries), and V8 and fdlibm.
  - **Licences to confirm:** the SMuFL glyph names, the MNX schema and mirrored examples, and the MNX sources carry no licence upstream, so they are listed as "W3C Music Notation Community Group (licence to confirm)". They were already shipped before this campaign.
  - **Repository files:** `LICENSE.md` (the AGPL-3.0 text from gnu.org), `NOTICE.md`, `CONTRIBUTING.md` (S16), a Licence section in the README, and `"license": "AGPL-3.0-only OR LicenseRef-Commercial"` in every `package.json`. The synth's `THIRD_PARTY_NOTICES.md` now states the licence.
  - **Tests:** `harness/conformance/notices.test.ts` requires the generated files to be current, every production package in `package-lock.json` to have a notice, and every named licence text to exist. The `home` smoke resolves every same-origin link on both pages (25) on the built site. The gate maps the new paths to every test plus the `home` smoke.

