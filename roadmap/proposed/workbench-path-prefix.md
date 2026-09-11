# Workbench at `/workbench/` — two faces on one origin

> **Status: proposed 2026-09-11.** Lab-side groundwork for
> [studio-shell.md](studio-shell.md), which takes `/studio/` and, once it exists, the root.
> Lands first; studio depends on it, not the other way round. Implementation loop.

## The problem

`mnx-lab.totai.uk` was always meant to be **studio's** address — the consumer product
that [apps/studio/README.md](../../apps/studio/README.md) reserves. Today the workbench is
deployed at the root instead, because it was the only shell there was. When studio
starts, the two must share the one Worker origin (the storage campaign's contract clause
2 already fixed that: same origin, one config, one deploy) without either shell knowing
the other exists.

The target URL space:

| Path | Serves | Auth |
| --- | --- | --- |
| `/` | redirect to `/studio/` (studio-shell.md) | none |
| `/studio/` | studio | Cloudflare Access at the edge |
| `/workbench/` | the workbench | none — public, static-functional |
| `/api/*` | the Worker | as today; `/api/library/*` behind Access |
| `/smufl/`, `/samples/`, `/assets/`, `/spec-media/` | shared static output | none |

This doc owns the workbench half: moving the existing face under `/workbench/` with
nothing else changing. The root redirect is deliberately **not** here — until studio
exists the root keeps serving the workbench, so the move is invisible to a visitor
until the day it isn't.

## The design

**Both shells route by hash, so the origin needs no SPA fallback.** The workbench's
routes are `#/`, `#/scenario/<id>`, `#/document`, `#/objects`, `#/converters`; a
navigation to `/workbench/` is a plain static file. Workers Assets serves
`/workbench/index.html` for `/workbench/` and redirects `/workbench` to it (its default
trailing-slash handling). `not_found_handling: single-page-application` in
`wrangler.jsonc` therefore goes; an unknown path becomes a 404 rather than a silent copy
of whichever shell happens to be at the root.

**Vite emits an HTML input at its path relative to the repo root.** So the face's HTML
moves from `index.html` to `workbench/index.html` and its rollup input follows; the
output lands at `dist/client/workbench/index.html`. The repo's top-level HTML files are
then the deployed URL map — `workbench/index.html`, `studio/index.html` (later),
`embed.html` (the mock host page, unchanged) — which is a property worth keeping.
Script, font and `public/` references are already root-absolute (`/smufl/…`,
`/samples/…`, `/assets/…`) so nothing under them moves.

**The Worker does not change.** Access continues to guard `/api/library`; the demo
routes stay where they are. The `_headers` CSP applies to `/*` and covers the new path
unchanged.

### What actually assumes `/`

A survey on 2026-09-11 found three places, all mechanical:

1. `worker/api/library.ts` — `GET /api/library/login` redirects to `/?library=1`. Becomes
   `/workbench/?library=1`. (Studio never uses this route; Access on its own path makes a
   login route unnecessary there.) The `?library=1` hand-off in `WorkbenchApp.ts` reads
   and strips the query on boot and is already path-agnostic.
2. `src/workbench/LibraryDialog.ts` — the "Back to workbench" link is `href="/"`.
3. `harness/verify/{csp,selection,inspector,focus-mode}-smoke.mjs`,
   `player-workbench-smoke.mjs`, `unrolled-smoke.mjs` and `staticServer.mjs` — each
   requires `dist/client/index.html` and serves the page at `/`. They need
   `/workbench/` and the new file path. `csp-smoke` also asserts `_headers` reached the
   build; that assertion stays.

The PKCE callback in `src/workbench/assistCredentials.ts` is derived from
`location.origin + location.pathname`, so it becomes `/workbench/` on its own. OpenRouter
does not pre-register callback URLs, so nothing is re-registered.

`docs/workbench.md` and CLAUDE.md's *Build faces* table name `index.html →
src/entries/main.ts`; both update.

## Acceptance

- `npm run build` emits `dist/client/workbench/index.html` and no root `index.html`.
- `npm run dev`: `/workbench/` serves the workbench; `/` still serves the workbench
  **until** studio-shell.md lands (a dev-only stub is acceptable in the interim; a
  redirect in the Worker is the eventual answer and belongs to that doc).
- Every smoke script passes against the new path: `smoke:csp`, `smoke:selection`,
  `smoke:inspector`, `smoke:focus`, `smoke:player`, `smoke:unrolled`.
- The library Load round trip still works end to end on the deployed site: anonymous
  Load → sign-in button → Access OTP → return to `/workbench/?library=1` → dialog opens
  signed in. Sign out returns the dialog to its sign-in prompt.
- The PKCE connect round trip returns to `/workbench/#<route>`, not `/`.
- A deep link that was shared before the move — `https://mnx-lab.totai.uk/#/scenario/<id>`
  — is **broken by design** once the root redirects to studio. Not worth a compatibility
  shim: the workbench has no external users and the queue links are regenerated on every
  visit. Recorded so nobody adds one later.

## Out of scope

The root redirect, the studio face, Access on `/studio`, and any change to what the
workbench does. This is a path move and nothing else; the diff should read as one.
