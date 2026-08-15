# `viewer-embedded` — the third app, and the embed contract's first real consumer

> Raised 2026-08-14. Answers the fork left open by
> [core-editor-element-promotion.md](core-editor-element-promotion.md)'s
> "getting it moving" section, and gives
> [core-viewer-surface.md](../inprogress/core-viewer-surface.md) the consumer it has been
> waiting for.

## What this is

A third app beside the two we have — a small **read-only** host page with links
to a few scores, viewing them through `<mnx-score-viewer>` loaded **as the
published artifact**, the way a stranger's website would.

| App | Role | Consumes |
|---|---|---|
| workbench | review-first corpus bench (the editor incubates here) | `src/` directly |
| studio | the future SaaS product (reserved seam, README only) | — |
| **viewer-embedded** | **a foreign host page: read-only viewing** | **`dist/embed/mnx-lab.js` only** |

## What it decides (the consumer question, answered)

The promotion doc asks whether the embed face should offer **editing**. This app
is the answer: **embeds view; studio edits.** Consequences, recorded so they stop
being open questions:

- It **does not** satisfy the promotion's trigger 2, which asks for a consumer
  that needs *editing*. Building this must not be mistaken for unlocking the
  editor promotion — that trigger now belongs to **studio**, when studio is real.
- [core-editor-focus-scope.md](core-editor-focus-scope.md)'s **stage 2 becomes
  "not wanted", not "pending"**: a read-only embedded viewer needs no key
  handling beyond *not stealing the host's keys*, which stage 1 already ships.
  That doc can close.
- What this app *does* satisfy is the **viewer surface's** missing consumer.
  `core-viewer-surface.md` calls today's contract "an undesigned accretion";
  accretions get designed when something outside the repo depends on them.

## The second finding: the viewer had no styles of its own

Caught within minutes of looking at the app on a dark page — and worse than
the asset bug, because it was invisible-by-degrees rather than fatal.

`designTokens` is declared on the **app component's** `:host` and inherits
down through the workbench's shadow roots. `ScoreViewer` never included it. On
a host page there is no such ancestor, so **every token was undefined**:

- `background: var(--paper)` → transparent, so the host's page colour showed
  through and *looked* like a themed score,
- `color: var(--paper-ink)` → inherited the host's text colour,
- `stroke: var(--paper-line)` → computed to `none`: **the staff lines were
  not drawn at all**,
- and `--mnx-accent` and friends did nothing, because the `var(--mnx-*)`
  reads that give them meaning live in that same un-applied block — so the
  documented public styling API was dead in the only place it was for.

**Fix**: the score tokens split into `scoreTokens`, composed by both
`designTokens` (app chrome) and a new `viewerTokens` that `ScoreViewer`
carries itself. The light values are identical to the app's, deliberately —
inside the workbench the viewer's own definitions now win, so any drift would
silently restyle the app.

### Theme, and how a component can know

The paper now **follows the colour scheme**, reversing the old rule that "the
score always renders on warm paper, even under dark chrome" — a blazing white
score on a dark page is exactly what the app made obvious.

Resolution needs no API and no host cooperation: `color-scheme` is an
*inherited* CSS property, and `light-dark()` resolves against the **used**
scheme. So the component honours the host page's declared scheme, and for a
page that says `light dark`, the reader's OS preference. A page that never
opts into dark keeps a light score — correct, because the paper should match
the page it sits on, not the operating system.

What automatic detection **cannot** see is a host's private convention (a
`.dark` class, `data-theme="night"`); nothing in CSS exposes that. Hence
`<mnx-score-viewer theme="auto | light | dark">`, which works by declaring
`color-scheme` on the host and letting every token re-resolve at once.

The demo app drives both axes independently — page light/dark × score
light/dark — because all four combinations have to look right and a host
locked to the component's scheme can only ever show two of them.

## The finding this app exists to catch

**The embed is broken for a genuinely external host, today.**

- `src/engine/smufl/smufl.ts` defaults to `basePath: '/smufl'`, and
  `ScoreViewer` calls `loadSmufl()` with **no options** — so the component
  fetches `<host-origin>/smufl/glyphnames.json`. On `example.com` that is a 404
  and nothing renders.
- The Bravura `@font-face` is declared by the **host page** (`embed.html` does
  it, with a comment admitting as much).
- `basePath` is exposed nowhere: not an attribute, not a property, not an export.

So "one script tag" is untrue: it is one script tag **plus** hosting two JSON
files at your origin root **plus** declaring a font face — none of it documented
outside a demo's CSS comment. `embed.html` never caught this because it is
served from the workbench's own origin, where `/smufl` happens to exist. It is a
test that can only pass.

**The fix (stage 1): the artifact locates its own assets.** The embed entry knows
its own URL (`document.currentScript` / `import.meta.url`), so the default
`smuflBase` becomes *its own directory*, and the font is registered through the
`FontFace` API instead of being the host's chore. An explicit `smufl-base`
attribute stays as the override (a host mirroring assets, or a CDN split). Then
one script tag really is enough, and the promise the build face makes is one the
artifact keeps.

## Architecture

- **Lives at `apps/viewer-embedded/`**, mirroring the `apps/studio/` seam, and
  deliberately **outside `src/`**. That is the whole point: it must see only
  `dist/embed/mnx-lab.js`. An app that imports from `src/` tests nothing about
  the embed contract — it would just be a second workbench.
- **Loads the component with one `<script src>`**, base configurable: the local
  build in dev, the deployed origin in production. Cross-origin is the
  interesting case and the default under test.
- **Scores travel with the app** — three or four `.mnx.json` files fetched by
  the page and set as a property. This exercises the real host flow (*the host
  supplies a document*) and keeps the demo from reaching into workbench
  internals or the corpus at runtime.
- **Plain HTML + a little JS.** No framework: the app's job is to be
  unremarkable, so that anything that breaks is the component's fault.

### Deliberately out of scope

- **Playback.** The embed face registers `ScoreViewer` **only**, and there is no
  player element in `elements/` at all — so "view and play" is not reuse, it is
  promoting audio into the public surface, with bundle weight and an
  autoplay/gesture story attached. Its own decision, its own ticket.
- **Editing** — see above; that is studio's trigger.
- **Serving the corpus.** The workbench does not expose scores as static files
  and should not start; the demo carries its own.

## Testing

The embed face has **no test today** — `embed.html` is a manual demo. This adds
the sibling of the existing `smoke:lib`:

**`npm run smoke:embed`** — build the artifact, then drive headless Chrome
(already a dependency for `render-png`; CDP over Node 22's global `WebSocket`
adds no packages). Load a fixture host page and assert: the custom element
upgrades, SMuFL resolves, an SVG renders with a non-empty viewBox and a
plausible glyph count, and **no console errors**.

Two details decide whether it is worth anything:

1. **Serve the host page from a different origin/port than the artifact.**
   Same-origin is exactly the trap `embed.html` fell into: a same-origin test
   passes while every real embed breaks.
2. **Smoke, not golden.** Never compare against `expected.svg` — the harness
   goldens are computed at a fixed `WIDTH_SP` viewport while a browser embed
   goes through `fitPxPerSp`, so exact match is the wrong oracle and would
   manufacture false demotions. Structural assertions only, the same honest
   posture as `smoke:lib`.

A second case belongs in the same harness: **two viewers on one page** — the
scenario nothing covers today, and one the focus ring already made legible.

## Staging

1. **The asset fix** — self-locating `smuflBase`, `FontFace` registration, the
   `smufl-base` override attribute. The bug the app exists to catch, fixed
   first so the app is a demo rather than a workaround.
2. **`smoke:embed`** — the cross-origin harness above, including the
   two-viewer case. Lands with (1) so the fix is pinned by a test that could
   have failed.
3. **The app** — `apps/viewer-embedded/`, its bundled scores, its build face
   and (if wanted) its deploy.
4. **Close the fork** — record "embeds view, studio edits" in the promotion and
   focus-scope docs; focus-scope stage 2 retires as *not wanted*.
