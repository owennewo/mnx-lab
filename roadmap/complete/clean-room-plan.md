# Clean-Room Implementation Plan

> **Status: largely executed (2026).** This was written as *input for a clean-room rebuild*,
> but the plan's content shipped by **refactoring the existing app in place** rather than by
> the from-scratch monorepo it describes. The library-first rollout (00, 01, 03) is done; the
> scenario-library structure (`../inprogress/04-scenario-library.md`) is the living corpus
> contract; the **monorepo package split was not adopted** (`../superseded/02-architecture.md`).
> Kept for provenance. See `../README.md` for the current roadmap map.

This folder is **input for a clean-room rebuild** of the MNX music editor — documents meant
to be read by a developer or an agent (e.g. Claude Code) before any code is written. It is
*not* the implementation and does not describe the current `src/` codebase. It describes the
thing we want to build instead.

The existing project is the source of "good bits" we are mining, not a baseline to preserve.
Reusable design ideas come from `../../SVG_RENDERING_ENGING.md`, `../../research/`, `MUSICXML.md`,
and `../../schemas/`.

## The shape of the plan

We build **library-first**. The first artifact is a hierarchical **scenario library** — many
small, valid MNX documents that cover the spec — plus a read-only **gallery** app to browse
them and see their rendered output. That single corpus is at once the renderer's test
fixtures, the app's content, and executable documentation of MNX (see `../inprogress/04-scenario-library.md`).

Sequencing, hard rule: **validate → lay out → render** first; **playback** and **editing**
next; **AI dead last**. No editor and no player in the first milestone — and it's still doing
a lot.

## Three decisions are locked

1. **Monorepo of packages.** Each capability is its own package with its own tests; apps
   compose them. (See `../superseded/02-architecture.md`.) *— not adopted; the app stayed a
   single `mnx-lab` in `src/`.*
2. **Beachhead = scenario library + gallery.** Ship a corpus of valid MNX and an app that
   validates and renders it — no editor, no player, no server. (See `03-rollout.md`.)
3. **AI is last.** It presupposes a solid model, renderer, and editor; it is goal #7, phase 7.

## Reading order

| # | Doc | Question it answers | Stability |
|---|-----|---------------------|-----------|
| 0 | `00-vision.md` | Why build this, for whom, and what is explicitly *not* in scope? | provisional |
| 1 | `01-principles.md` | What rules must never be broken? | settled-ish |
| 2 | `../superseded/02-architecture.md` | What are the modules and the contracts between them? | provisional |
| 3 | `03-rollout.md` | What do we build first, and what is "not yet"? | provisional |
| 4 | `../inprogress/04-scenario-library.md` | **The heart:** how is the scenario corpus structured? | provisional |
| – | `module-specs.md` | How is each module built? (written just-in-time) | per-file |
| – | `decisions/*.md` | Why did we choose X over Y? (ADRs — never created) | append-only |

## Two rules that keep this honest

- **Contract-first.** A module spec in `module-specs.md` may not be written until that module's
  contract exists in `../superseded/02-architecture.md`. This keeps the pieces decoupled and reusable.
- **Just-in-time detail.** Tier 1–2 docs (vision, principles, architecture, rollout, library)
  are written up front because they are small and stable. A module's detailed spec is written
  only when we're about to build it, so detail can't rot.

Each doc states its **stability** at the top: `settled` (load-bearing, change deliberately),
`provisional` (strawman, expected to change), or `append-only` (ADRs).
