# MNX Studio — reserved

**There is no code here, deliberately.** This README is the only studio artifact until
the product starts (roadmap/complete/lab-structure-lab.md).

## What it is

The Soundslice-like consumer service: a person's whole library of MNX documents —
accounts, sync across devices, purchased/imported scores, practice tools (looping,
slowdown, backing tracks). A **different product for different users** than the
workbench (`src/workbench/`), which is the lab's internal review instrument. The two must
never bleed together; that guard is structural, not vigilance.

## The framework-neutrality contract

Studio's framework is **deliberately undecided** — React, Svelte, Lit, or whatever is
right *when it starts*. That choice stays open because studio may consume only
framework-neutral surfaces:

- the **`elements/`** custom elements (score viewer, playback surface) via the embed
  artifact or the `mnx-lab` package's subpath exports;
- the **`mnx-lab` library** (`mnx-lab/model`, `mnx-lab/engine`, `mnx-lab/audio`);
- the **Worker origin's** reserved API seams.

It must not import `src/workbench/` (the workbench shell is a leaf; dependency-cruiser makes
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
| Self-correcting edit loop | `src/assist/editLoop.ts` | working, transport-injected — the same loop runs in a browser or a Worker |

## Assist credentials — a promotion waiting for a second consumer

Studio will want the same BYOK flow the workbench has (core-assist-byok.md): PKCE or a
pasted OpenRouter key, held in the browser, spent browser-direct. The pieces are already
split along the line that makes that possible — `src/assist/openrouter.ts` is pure over
`fetch`/`crypto` and touches no storage, so **studio can consume it today**; only
`src/workbench/assistCredentials.ts` (localStorage, the PKCE redirect round trip) is
shell-specific, and studio must not import it — the workbench is a leaf, and
dependency-cruiser makes trying a red build.

It is **not** promoted into a shared layer yet, on purpose. The repo's rule is that a
shared surface graduates when a real second consumer needs it, and studio does not exist.
When it starts, the move is small and known: lift `assistCredentials.ts` down to a layer
both shells may import, leaving the storage keys and the callback-URL derivation as its
only decisions. Writing it now would be guessing at studio's routing and its session
model — the two things the module actually depends on.

The real backend (accounts, storage bindings, sync protocol) is **studio's to build**
on those seams — the workbench keeps no backend at all, by rule.

## When it starts

It starts greenfield in this directory with its own build, consuming the artifacts
above. First decisions then, not now: framework, hosting shape (same Worker origin vs
its own), and whether auth pages share the origin (the one known forcing point that
could pull the framework decision earlier).
