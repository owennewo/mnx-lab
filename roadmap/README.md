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
- **[instrument-position.md](proposed/instrument-position.md)** — **where a note is played**:
  the string declaration, capo, `note.string`, `note.fingering`. Thesis: **the string and the
  finger are choices, the fret and the hand position are consequences** — given tuning, string
  and pitch, the fret is arithmetic (and on violin, string + pitch + finger derives the hand
  position). Argued from the conflict rule MNX already used against MusicXML's duplicated tab
  staves, not from "derivable data shouldn't be stored". Names are tested against **piano**,
  which sorts them: only `fingering` is universal, so it must not nest under a `tab` namespace.
  Records upstream state (#63 open with a standing invitation from the spec editor, **no
  discussion exists**), natural/artificial harmonic derivation, and the divergence from the
  built `_x.mnxLab.tab.position`, which stores the fret. Scope is bounded by a principle
  rather than a list — **encode the choice, not the consequence** — which maps the same shape
  onto brass (valve combination selects a fundamental, pitch determines the partial) and
  excludes tin whistle by the same rule that excludes storing the fret. Design only — nothing built, nothing
  posted; complements [guitar-technique.md](proposed/guitar-technique.md) (what the hands do).
- **[derived-positions.md](proposed/derived-positions.md)** — the execution half of
  [instrument-position.md](proposed/instrument-position.md): migrate `_x.mnxLab` to the
  proposal's shape (v5: string authoritative, `fret` optional and non-authoritative, `fingering`
  un-nested, `tuning[]` → `strings[]`) **and specify the derivation ladder** so unannotated
  guitar notation still renders valid tab — lowest-playable-fret assignment, default standard
  tuning, capo-aware (the current fallback in `guitarPositions.ts` ignores both; MNX pitch is
  sounding, so no transposition term — `part.transposition` is display-only). The pitch-only
  assignment is ruled **presentation, not content** — never written back, not proposed as
  normative spec text; our renderer's determinism is owned by the
  `lab/tab-derivation` scenario family, so heuristic changes become reviewed golden
  demotions instead of silent drift. **Stages 2–4 shipped 2026-08-07** — the v5 reshape
  (schema, v4→v5 upgrade hop, converters, corpus, edit layer, Worker prompt), the
  hardened derivation (tuning/capo-aware authority ladder, red mismatch/unplayable badges,
  no silent clamp), and nine rendered scenarios pinning it (bare melody/chord, string-only,
  partial annotation, drop-D, capo, transposition-is-display-only, out-of-range, fret
  mismatch); goldens byte-identical throughout. **Instrument neutrality followed the same
  day**: the assume-standard-guitar default is retired — tab requires declared `strings[]`
  or a viewer override (`<mnx-score-viewer>` `stringsOverride`/`capoOverride`, surfaced as
  the workbench's instrument selector with presets incl. open D/bass/uke/mandolin); the
  shim materializes the old implicit default into saved documents.
- **[viewer-surface.md](proposed/viewer-surface.md)** — name and define **the viewer
  surface**: `<mnx-score-viewer>`'s public contract (props/attributes/events), today an
  undesigned accretion. Layered rule (engine `RenderOptions` → element bindings → workbench
  chrome), attribute-first, the `view="auto"` precedence chain (user > host > document
  `staffKind` hint > default), a set-valued `hide` knob, and eviction of workbench leakage
  (`pinnedErrors` et al). Subsumes render-density-zoom's "where do the levers live" question.
- **[render-density-zoom.md](proposed/render-density-zoom.md)** — configurable horizontal +
  vertical **density / zoom levers** ("see more music on less page"). Feasible today: layout is
  in staff-space units (uniform zoom = `pxPerSp`), horizontal density = `spacing.ts` knobs,
  vertical density = layout gap/padding constants. Not started. Where the levers are *exposed*
  is now owned by [viewer-surface.md](proposed/viewer-surface.md).
- **[editor-ai-prompt.md](proposed/editor-ai-prompt.md)** — the command palette's **third
  mode**: `Ctrl+K` text routing to `/api/edit-notation` when it reads as a sentence rather than
  a command (research §6.2), inheriting the `ui/ → assist/` boundary. Owns the deeper
  convergence `src/edit/ops.ts` has always named: the assist loop emitting **`EditOp[]`
  through `applyOp`** instead of replacing whole documents, so AI edits land in the session's
  undo history and op log like keyboard edits. Split out of
  [editor-input-layer.md](inprogress/editor-input-layer.md); the voice half stays in
  [open_router.md](proposed/open_router.md).
- **[open_router.md](proposed/open_router.md)** — two-stage **voice** input + structured edit.
  The *text* edit path shipped (worker `/api/edit-notation` NDJSON self-correcting loop); the
  **voice/transcription stage was never built**. What's left here is the voice half.

### inprogress/
- **[both-view-single-system.md](inprogress/both-view-single-system.md)** — the notation+tab
  `both` view as **one engraved system** (connected barlines, one SVG) instead of two stacked
  renders. **Phases 1+2 shipped** (2026-08-07): tab is now a **native display staff** in the
  notation layout's system walk (`includeTabStaves`; seam `layoutBothSystem`) — single-stroke
  shared barlines, interleaved multi-system wrap, fret emission shared with the standalone tab
  layout via `tabStaff.ts`. Goldens byte-identical throughout. Left: the combined-golden
  decision + recorded limitations (lyrics gap, repeat dots on tab, scores-doc injection).
- **[guitar-pro.md](inprogress/guitar-pro.md)** — **Guitar Pro ⇄ MNX** conversion, built at
  `converters/guitarpro-mnx/` using **alphaTab** as a headless format codec (no binary parsing
  hand-written). Reads gp3/gp4/gp5/gpx/gp, writes `.gp` (GP7 — the only format anything can
  still write). The score corpus is now **authored as `.gpx`**, with `.mnx.json` and `.xml`
  derived from it. `MNX → .gp → MNX` round-trips **all three reference scores with zero
  differences** — notes, technique, lyrics, repeats, voltas, tuning, capo, key — schema-valid.
  Harmonics, palm mute and chord symbols now travel too (v3 of the extension). Left:
  tuplets/grace, ties/staccato, a third-party gp3/gp4/gp5 import fixture, and manual
  acceptance in Guitar Pro.
- **[editor-input-layer.md](inprogress/editor-input-layer.md)** — the **editor's input layer**,
  designed to be testable while super-experimental: a declarative keymap (key → intent), a
  pure state machine (intent + selection → `EditOp`), and **intent-trace fixtures** that are
  also recordings ("copy trace" → `harness/fixtures/edit-traces/`, replayed by vitest, undo-all
  must round-trip byte-identically). Editor edits the model, renderer reacts; the cursor is a
  **rhythmic position, not a note id** (empty measures must be navigable). **Phases 1+2 built
  2026-08-03** (`src/edit/{intents,keymap,cursor,session,tabStrings}.ts`): string-mode cursor
  with entry ghosts, note entry/deletion/duration, two-digit fret combining, **setup-as-ops**
  (`setTuning`/`setTimeSignature`), the `lab/document/empty-tab-canvas` template, the
  from-scratch flagship trace, **setup popovers** (Shift+T/Shift+U, typed grammar in
  `setupGrammar.ts`), and **rests & ties** (§8.11's no-rest-key model: ops keep touched bars
  full of beat rests; `T` ties; `Alt+↑↓` nudges rests), and the **command palette**
  (`Ctrl+K` commands / `Ctrl+G` go-to, one grammar shared with the rail filter; bar jumps are
  a traceable `goToMeasure` intent; AI mode split to
  [editor-ai-prompt.md](proposed/editor-ai-prompt.md)). Remaining: `elements/` promotion.
  Grounded in
  [research/notation-editor-keyboard-models.md](../research/notation-editor-keyboard-models.md).
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
