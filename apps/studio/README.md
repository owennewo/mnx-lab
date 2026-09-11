# MNX Studio

**Started 2026-09-11** ([roadmap/inprogress/studio-shell.md](../../roadmap/inprogress/studio-shell.md)).
Until then this directory was a README and a set of reserved seams
(roadmap/complete/lab-structure-lab.md); the seams are now in use.

## What it is

The Soundslice-like consumer service: a person's whole library of MNX documents —
accounts, sync across devices, purchased/imported scores, practice tools (looping,
slowdown, backing tracks). A **different product for different users** than the
workbench (`src/workbench/`), which is the lab's internal review instrument. The two must
never bleed together; that guard is structural, not vigilance.

Today it is the first cut: sign in, see your library, open a piece, and it fills the
screen with the score and the player. Nothing is edited or persisted yet.

## Shape

```
studio/index.html        the face's HTML — Vite emits it at /studio/ (top-level HTML = URL map)
apps/studio/
  studio.css             document-level only: the SMuFL face and the page reset
  src/main.ts            registers the shell and the elements it mounts
  src/StudioApp.ts       <mnx-studio> — hash router; the header on every page but a piece
  src/LibraryPage.ts     #/              the tag-filtered browse over the library client
  src/PiecePage.ts       #/piece/<id>    the canonical .gp, converted in src/importers, into
                                         <mnx-score-frame> holding <mnx-document-viewer> +
                                         <mnx-player>, one binding
  src/session.ts         /api/library/me at boot; sign-in is re-entering the page
```

`#/not-permitted` is the third route: Access admitted the address but D1 has it inactive.
Piece URLs carry the library's piece id. On a piece the page IS the score frame
([roadmap/inprogress/core-score-frame.md](../../roadmap/inprogress/core-score-frame.md)):
a title grip on the top edge and a pause grip on the bottom, drawn out into the library
page's tools row (the way back, the title, the piece's chips, the staff view, Zoom,
Settings, Tags, the menu) and the player's tray. A tap on the score is never a chrome
toggle. The staff view, the display settings, zoom and spacing are per-browser localStorage
preferences (`mnx-studio.*`), the one persistence a shell may own without a backend decision.

## The decisions that starting settled

- **Framework: Lit.** The only surfaces studio consumes are Lit custom elements, the
  decorator configuration already exists, and the editor will arrive as a Lit element.
- **Hosting: the same Worker, a path prefix.** D1 and R2 already bind to the `mnx-lab`
  Worker (storage campaign, contract clause 2); studio's pages sit beside them at
  `/studio/`, and the Worker redirects `/` there. One config, one deploy, one hostname.
- **Auth: Cloudflare Access at the edge, and nothing else.** `/studio` is a second path
  on the same browser Access application as `/api/library`, so a page load and its
  fetches share one audience and one cookie. An anonymous visit meets the OTP prompt
  before any HTML is served; there is no login page in studio. The Worker still checks
  the JWT and active D1 membership on every library call. Sign out is Access's own
  logout. `worker/api/auth.ts` stays a 501 seam — it is for a public sign-up, a
  different product decision. Operations: [docs/library-access.md](../../docs/library-access.md).

## The boundary (machine-enforced)

`apps/studio/` may import only `src/model`, `src/engine`, `src/audio`, `src/elements`,
`src/storage` (the typed library client) and `src/importers` (the clean-room converters in
a worker — promoted out of the workbench when the library stopped storing derived MNX). It must not import `src/workbench/`, `src/edit/`
or `src/assist/`; nothing may import `apps/studio/`. `.dependency-cruiser.cjs` makes any of
those a red build. Anything both shells want is first *promoted* into `elements/` or
below — a deliberate, reviewed move.

## Editing — the trigger this pulled

[roadmap/proposed/core-editor-element-promotion.md](../../roadmap/proposed/core-editor-element-promotion.md)
was parked behind "a real second consumer asking for editing". Studio is that consumer.
When the promotion lands, the piece page mounts the editor element and edits **in memory
only**; the storage design already says the first saved edit becomes a new MNX rendition
that takes the canonical pointer, and that write path is the next studio item.

## Assist credentials — still a promotion waiting

Studio will want the workbench's BYOK flow (core-assist-byok.md). `src/assist/openrouter.ts`
is pure and could be consumed today; `src/workbench/assistCredentials.ts` (localStorage,
the PKCE round trip) is shell-specific and stays behind the boundary until studio actually
asks for assist — then it lifts to a layer both shells may import, with the storage keys
and the callback-URL derivation as its only decisions.
