# Roadmap

Planning docs for MNX Lab, filed by their status **relative to the current codebase**. This
is an archive of intent, not a live task board — the one genuinely live tracker is
[inprogress/SPEC_APPROVAL.md](inprogress/SPEC_APPROVAL.md).

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
- **[open_router.md](proposed/open_router.md)** — two-stage **voice** input + structured edit.
  The *text* edit path shipped (worker `/api/edit-notation` NDJSON self-correcting loop); the
  **voice/transcription stage was never built**. What's left here is the voice half.

### inprogress/
- **[SPEC_APPROVAL.md](inprogress/SPEC_APPROVAL.md)** — the live renderer-verification roadmap:
  per-scenario scoreboard (**28/49 spec examples verified**), the approval bar, known renderer
  gaps, and the "how to add a renderer feature" recipe. Read this before touching renderer
  correctness.
- **[04-scenario-library.md](inprogress/04-scenario-library.md)** — the scenario corpus
  structure (`spec/` + `lab/`, path-derived ids, `meta.json`, `expected.primitives.json`,
  `check-scenarios.mjs`). The one clean-room doc that describes *current* reality; the corpus
  keeps growing, so it stays "in progress."

### complete/
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

`CLAUDE.md`, `README.md`, `SVG_RENDERING_ENGING.md`, `docs/tab-extension-spec.md`,
`schemas/HISTORY.md`, `research/mnx_format.md` — these are current reference, not plans.
