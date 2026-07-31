# MNX Studio — reserved

**There is no code here, deliberately.** This README is the only studio artifact until
the product starts (roadmap/inprogress/structure-lab.md).

## What it is

The Soundslice-like consumer service: a person's whole library of MNX documents —
accounts, sync across devices, purchased/imported scores, practice tools (looping,
slowdown, backing tracks). A **different product for different users** than the
workbench (`src/ui/`), which is the lab's internal review instrument. The two must
never bleed together; that guard is structural, not vigilance.

## The framework-neutrality contract

Studio's framework is **deliberately undecided** — React, Svelte, Lit, or whatever is
right *when it starts*. That choice stays open because studio may consume only
framework-neutral surfaces:

- the **`elements/`** custom elements (score viewer, playback surface) via the embed
  artifact or the `mnx-lab` package's subpath exports;
- the **`mnx-lab` library** (`mnx-lab/model`, `mnx-lab/engine`, `mnx-lab/audio`);
- the **Worker origin's** reserved API seams.

It must not import `src/ui/` (the workbench shell is a leaf; dependency-cruiser makes
that a red build), and nothing may import studio. Anything both shells want is first
*promoted* into `elements/` or below — a deliberate, reviewed move.

## Reserved seams, already in place

| Seam | Where | Today |
| --- | --- | --- |
| Document sync API | `worker/api/documents.ts` | 501 stub, no bindings |
| Auth API | `worker/api/auth.ts` | 501 stub, no bindings |
| Typed sync client | `src/storage/cloudRepository.ts` | stub over the 501 route |
| Local persistence | `src/storage/indexedDbRepository.ts` | working (the workbench uses it) |
| Embeddable viewer | `entries/embed.ts` → `dist/embed/` | working |

The real backend (accounts, storage bindings, sync protocol) is **studio's to build**
on those seams — the workbench keeps no backend at all, by rule.

## When it starts

It starts greenfield in this directory with its own build, consuming the artifacts
above. First decisions then, not now: framework, hosting shape (same Worker origin vs
its own), and whether auth pages share the origin (the one known forcing point that
could pull the framework decision earlier).
