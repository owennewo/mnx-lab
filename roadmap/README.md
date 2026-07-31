# Roadmap

Planning docs for MNX Lab, filed by their status **relative to the current codebase**. This
is an archive of intent, not a live task board. The recent driver — the spec-approval sweep —
is now complete ([complete/SPEC_APPROVAL.md](complete/SPEC_APPROVAL.md), 57/57 verified); the
living corpus contract is [inprogress/04-scenario-library.md](inprogress/04-scenario-library.md).

The big picture: the `clean_room_impl/` **pivot plan** (library-first: scenarios → gallery →
render → tab → playback → editing → AI-last) was **executed by refactoring the existing app
in place**, *not* by the from-scratch monorepo of packages it proposed. So most of that plan
is "done," its scenario-library structure is the living corpus contract, and its package
architecture was dropped. The older pre-pivot docs (AI-first UI, VexFlow stack) are superseded.

## Buckets

| Bucket | Meaning |
|--------|---------|
| `proposed/` | Described but not built. |
| `inprogress/` | Actively being worked / a living contract. |
| `complete/` | Built and shipped (kept for provenance; may be aspirational in tense). |
| `superseded/` | Overtaken by reality or a later decision; kept for history, **not current**. |

## Contents

### proposed/
- **[mnx-cg-proposals.md](proposed/mnx-cg-proposals.md)** — **where** chord symbols, section
  labels and technique should live, designed to be adoptable by the MNX CG rather than to stay
  private `_x` fields. Checked against the CG's live issues: #109 chord symbols, #112/#377
  rehearsal marks (the spec editor asked for a proposal and nobody wrote one), #63 guitar tab,
  #110 fretboard diagrams — all open, all unclaimed. Derives an acceptance template from the
  dynamics rework (#518, proposed → merged in three weeks). **The designs are now built**
  (`_x.mnxLab` v3 — see [docs/mnx-extensions.md](../docs/mnx-extensions.md)); what is left here
  is the outward half: join the CG, sign the CLA, and post the three proposals.
- **[score-text.md](proposed/score-text.md)** — **where text belongs in MNX.** v27 allows free
  text in seven places (lyrics, naming, two dynamics decorations) and a bar can carry no text
  at all, so rehearsal marks, section names and performance directions have nowhere to go.
  Proposes typed `rehearsal`/`section` on the global measure beside `segno`/`fine`/`jump`, plus
  generic `directions[]` on the part measure shaped like `dynamic-group`. Key argument: typing
  makes placement derivable, which is why Soundslice needs an inner/outer axis and MNX would
  not. Includes a round-trip stress test — 3 of 4 directions are destroyed or misclassified
  today, and the corpus never catches it. Supersedes the placement half of
  [mnx-cg-proposals.md](proposed/mnx-cg-proposals.md) §3.
- **[chord-symbols.md](proposed/chord-symbols.md)** — chord symbols. **Data path shipped**
  (2026-07-26) as `global.measures[i]._x.mnxLab.harmonies[]`: structured *and* literal, read
  from Guitar Pro `beat.text` **and** `Chord` objects, written and read as MusicXML
  `<harmony>`, lossless both ways (`Vestapol` 25, `House-of-the-Rising-Sun` 14). Remaining:
  **rendering** — nothing draws a chord symbol yet.
- **[guitar-technique.md](proposed/guitar-technique.md)** — playing technique. **Data path
  complete** (2026-07-26): hammer-ons, pull-offs, slides, vibrato, **harmonics** and **palm
  mute** all survive `MNX ⇄ .gp` and `MNX ⇄ MusicXML`, and bends are now **curves**
  (`points: [{position, alter}]` in semitones) rather than a single interval that flattened
  anything more elaborate. Remaining: **rendering** — nothing draws technique yet.
- **[render-density-zoom.md](proposed/render-density-zoom.md)** — configurable horizontal +
  vertical **density / zoom levers** ("see more music on less page"). Feasible today: layout is
  in staff-space units (uniform zoom = `pxPerSp`), horizontal density = `spacing.ts` knobs,
  vertical density = layout gap/padding constants. Not started.
- **[open_router.md](proposed/open_router.md)** — two-stage **voice** input + structured edit.
  The *text* edit path shipped (worker `/api/edit-notation` NDJSON self-correcting loop); the
  **voice/transcription stage was never built**. What's left here is the voice half.

### inprogress/
- **[guitar-pro.md](inprogress/guitar-pro.md)** — **Guitar Pro ⇄ MNX** conversion, built at
  `converters/guitarpro-mnx/` using **alphaTab** as a headless format codec (no binary parsing
  hand-written). Reads gp3/gp4/gp5/gpx/gp, writes `.gp` (GP7 — the only format anything can
  still write). The score corpus is now **authored as `.gpx`**, with `.mnx.json` and `.xml`
  derived from it. `MNX → .gp → MNX` round-trips **all three reference scores with zero
  differences** — notes, technique, lyrics, repeats, voltas, tuning, capo, key — schema-valid.
  Harmonics, palm mute and chord symbols now travel too (v3 of the extension). Left:
  tuplets/grace, ties/staccato, a third-party gp3/gp4/gp5 import fixture, and manual
  acceptance in Guitar Pro.
- **[04-scenario-library.md](inprogress/04-scenario-library.md)** — the scenario corpus
  structure (`spec/` + `lab/`, path-derived ids, `meta.json`, `expected.primitives.json`,
  `check-scenarios.mjs`). The one clean-room doc that describes *current* reality; the corpus
  keeps growing, so it stays "in progress."

### complete/
- **[structure-lab.md](complete/structure-lab.md)** — **the adopted repo structure,
  executed 2026-07-31 as a fresh-slate rebuild of main** (pre-rebuild history on the
  `legacy` branch + `pre-rebuild` tag). Capability layers with machine-enforced
  boundaries (`model → engine · audio · edit · corpus · storage; elements; ui/entries
  as leaves; worker ≤ model+assist`); one scenario format with two axes
  (origin: mirrored/local × schema: published/proposed); the symmetric
  `sync:spec`/`push:proposal` spec-loop pipeline with `spec/proposals/<topic>/`
  evidence bundles and the submodule as pin-only (proposal branches in worktrees);
  scores moved to `converters/fixtures/`; the backend-less, review-first **workbench**
  (attention-queue home, compare view, deep links) with approval as the conversational
  `/verify` skill over `verification` provenance; embed + `mnx-lab` library build
  faces; reserved studio/edit/storage seams. Execution deviations recorded in the
  doc's appendix.
- **[SPEC_APPROVAL.md](complete/SPEC_APPROVAL.md)** — the spec-by-spec renderer verification
  sweep, **complete (57/57 verified: 49/49 spec + 8/8 lab)**. The per-scenario scoreboard, the
  approval bar, the renderer's capability list + deferred-polish backlog, and the "how to add a
  renderer feature" recipe — still the process for verifying any newly-added scenario.
- **[clean-room-plan.md](complete/clean-room-plan.md)** — index/methodology for the pivot plan
  (was `clean_room_impl/README.md`).
- **[00-vision.md](complete/00-vision.md)** — goals 1–8; all realized (AI demoted to the
  sketches-only Assist drawer, as designed).
- **[01-principles.md](complete/01-principles.md)** — P1–P10; all honored **except P2**
  ("every capability is a package / monorepo"), which reality contradicts.
- **[03-rollout.md](complete/03-rollout.md)** — the 7-phase sequence; all phases shipped
  in-place (phase-3 spec coverage is the ongoing part, tracked in SPEC_APPROVAL).
- **[module-specs.md](complete/module-specs.md)** — planned just-in-time module specs; **none
  written** (moot without the monorepo).
- **[MUSICXML.md](complete/MUSICXML.md)** — MusicXML⇄MNX assessment; the converter is built at
  `converters/musicxml-mnx/`.

### superseded/
- **Structure sketches** — three of the four self-contained restructuring sketches
  (alternatives for a single decision), superseded by the adopted
  [structure-lab.md](inprogress/structure-lab.md), which composes two of them:
  - **[structure-toolchain.md](superseded/structure-toolchain.md)** — an npm-workspaces
    monorepo of publishable `@mnx-lab/*` packages with a one-way dependency graph; apps
    become thin consumers. *Deferred, not rejected* — the recorded trigger for revisiting
    is a real external consumer needing independent versioning.
  - **[structure-platform.md](superseded/structure-platform.md)** — one deployable modular
    monolith: capability layers inside `src/` with machine-enforced import boundaries;
    embed and library as extra build faces. *Absorbed into structure-lab* (the code half).
  - **[structure-workbench.md](superseded/structure-workbench.md)** — reorganize around the
    data and evidence (`spec/` / `corpus/` / `harness/` / `cli/`). *Absorbed into
    structure-lab* (the data half).
- **[02-architecture.md](superseded/02-architecture.md)** — the **monorepo package split**
  (`mnx-core`/`mnx-render`/`gallery`/…). Not adopted: the app stayed a single `mnx-lab` in
  `src/`. The *contracts* (C1 validate, C2 layout→primitives→draw, C6 loader) live on as
  internal `src/` modules, just not as packages.
- **[tech_stack.md](superseded/tech_stack.md)** — pre-pivot "locked-in" stack; names **VexFlow**
  (since replaced by the custom SVG engine — CLAUDE.md now forbids notation libraries).
- **[UX_Layout.md](superseded/UX_Layout.md)** — pre-pivot AI-first glassmorphic UI; replaced by
  the 2026-06 reading-room redesign (`mnx-library-rail` + `mnx-scenario-header` +
  `mnx-assist-drawer`).

## Not here (reference docs, left in place)

`CLAUDE.md`, `README.md`, `SVG_RENDERING_ENGING.md`, `docs/mnx-extensions.md`,
`schemas/HISTORY.md`, `research/mnx_format.md` — these are current reference, not plans.
