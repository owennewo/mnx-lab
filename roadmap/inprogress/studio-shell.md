# Studio first cut — browse, load, play, behind Access

> **Status: built 2026-09-11, in `inprogress/` until the deployed checks pass** (build
> record at the end). Studio starts. Depends on
> [workbench-path-prefix.md](workbench-path-prefix.md) (the workbench leaves the root
> first) and on the built [studio storage campaign](../complete/studio-campaign-storage.md)
> (the library it reads). Its editing phase is the **second consumer** that
> [core-editor-element-promotion.md](../proposed/core-editor-element-promotion.md) has been
> parked behind. Implementation loop.

## The goal

`mnx-lab.totai.uk` serves **studio**: sign in, see your library, open a piece, and it
fills the screen with the score and the player. Editing is possible as soon as the editor
is promoted; nothing is persisted yet. The workbench lives on at `/workbench/`, public and
unchanged.

Not in scope, each its own later item: saving an edit (the storage design already says
what that is — a new MNX rendition that takes the canonical pointer), sharing, sync,
recordings and syncpoints in the player, practice tools
([studio-player-practice.md](../proposed/studio-player-practice.md)), the BYOK assist flow
([apps/studio/README.md](../../apps/studio/README.md) records the promotion it needs).

## Decisions this doc makes

The README kept three things open until studio started: framework, hosting shape, and
whether auth pages share the origin. Starting settles them.

**Framework: Lit.** The only surfaces studio consumes are Lit custom elements
(`<mnx-document-viewer>`, `<mnx-player>`, whatever is promoted next), the decorator
configuration already exists, and the editor will arrive as a Lit element. A second
framework buys nothing today and costs a second build story. The neutrality contract is
kept in the only form that mattered: studio consumes `elements/` and below through the
same imports the `mnx-lab` package exports, never `src/workbench/`.

**Hosting: the same Worker, a path prefix.** Storage contract clause 2 already put D1
and R2 on the `mnx-lab` Worker; studio's pages sit beside them at `/studio/`. One
config, one deploy, one Access hostname. The Worker's root redirect, which
workbench-path-prefix.md pointed at `/workbench/` in the interim, flips to `/studio/`.

**Auth: Cloudflare Access at the edge, and nothing else.** See below. `worker/api/auth.ts`
stays a 501 seam — it is for a public sign-up that is a different product decision.

## Where it lives

```
studio/index.html            the face's HTML — Vite emits it at /studio/ (URL map = top-level HTML)
apps/studio/
  README.md                  updated: "it started", the decisions above
  src/main.ts                registers the shell; imports the elements it mounts
  src/StudioApp.ts           hash router + fullscreen frame
  src/LibraryPage.ts         #/ — the tag-filtered browse
  src/PiecePage.ts           #/piece/<id> — viewer + player
  src/session.ts             /api/library/me at boot; sign-out
```

`vite.config.ts` gains `studio: 'studio/index.html'` as a third client input.
`.dependency-cruiser.cjs` gains a rule and `check:boundaries` gains the directory:

```
apps/studio → src/model · engine · audio · elements · storage    (nothing else)
nothing     → apps/studio                                        (a leaf, like workbench)
```

`storage` is in because `src/storage/libraryClient.ts` is the typed client the Worker's
read routes were built for; studio reuses it rather than growing a second one. Anything
studio and the workbench both want beyond that is promoted, as the README says — the
first candidates are visible below.

## The three routes

Fullscreen by default: the score is the page. No queue, no five-band panel, no
inspector. One thin overlay bar carries the piece title, the player transport, a
**Library** button, the signed-in email and **Sign out**; it fades when the pointer is
idle over the score.

1. **`#/`** — the library. The same browse the workbench's Load dialog does, as a page:
   tag filter with completion (`dimension:value`, up to twelve, AND), the paged piece list,
   title and artist. Empty library and "no matching pieces" states. The dialog's search
   and paging logic is the first promotion candidate; do it only if it is a real copy.
2. **`#/piece/<id>`** — one piece. Fetches the canonical MNX through
   `GET /api/library/pieces/:id/canonical` (converted in `src/importers/`), mounts `<mnx-document-viewer>` filling the
   viewport with `<mnx-player>` in the bar. The 409 the client already maps ("needs a
   current MNX conversion") shows as a page, not a toast. Staff view (notation / tab /
   both) follows the same rule as the workbench: tab only when the strings are known.
3. **`#/not-permitted`** — see auth: Access admitted the email but D1 says inactive.

Per-browser preferences (staff view, zoom, last piece) are localStorage, the one
persistence a shell may own without a backend decision.

## Auth

**Access gates the page, not the app.** An anonymous visit to `/studio/` is redirected
to the email-OTP prompt by the edge before any HTML is served; there is no login page,
no login route, no "logged out" state inside studio. That is the property the user asked
for and it costs no application code.

- **Add `/studio` as a second path on the existing browser Access application**
  (`MNX library browser`, `mnx-lab.totai.uk/api/library`), **not** a new application.
  Both paths then share one audience and one `CF_Authorization` cookie, so a studio page
  load and its `/api/library` fetches are one session and `LIBRARY_ACCESS_AUD` is
  unchanged. Two applications on one hostname would bounce between audiences. The
  application already has OTP as its only provider and `auto_redirect_to_identity`
  on, so the prompt appears immediately.
- **`tools/library-access.py` changes first.** It provisions a single `domain` and
  refuses configuration drift, so the second path is added there (the API's
  `self_hosted_domains` / `destinations` list) and the script re-run — its designed
  update path, not a dashboard edit. Access matches an application path as a prefix;
  confirm on the first deploy that `/studio/` and everything under it is covered and
  that the more-specific `/api/library/ingest` machine application still wins.
- **The Worker's double gate is unchanged.** Every `/api/library` call still verifies the
  JWT against the issuer's JWKS and checks active D1 membership. Studio calls
  `GET /api/library/me` at boot to learn the email. A 403 means Access admitted the
  address but D1 has it inactive or unknown — studio shows `#/not-permitted` with the
  address and a sign-out link, never an empty library. A 401 there should be impossible
  behind the gate; treat it as "session expired" and reload, which re-enters Access.
- **Sign out** is the `/cdn-cgi/access/logout` link the library client already uses.
  Verify on the first deploy that it forces a fresh OTP rather than being silently
  re-issued from the one-month global session; if it does not, use the team-domain
  logout URL. Check whether `returnTo` is honoured so the user lands on `/studio/`
  (and therefore the prompt) rather than an Access interstitial. Document the answer in
  `docs/library-access.md`.
- **The workbench stays public.** Its Load dialog keeps the 401 → sign-in-button path it
  has; nothing about the workbench's static-functional rule changes.

**Local development** uses the local trust in `docs/library-access.md`: the signed test
session's `browser` field as a loopback cookie and `node tools/library-local-auth.mjs`.
In dev there is no edge, so `/studio/` loads without a prompt and the `/me` call is what
fails; the not-permitted page is the honest result and is how the page gets exercised.

## Editing — phase two, and the trigger it pulls

The editor mount lives in `src/workbench/`, a leaf; studio cannot import it and must not.
[core-editor-element-promotion.md](../proposed/core-editor-element-promotion.md) recorded on
2026-08-14 that trigger 1 (a stable intent vocabulary) is met and trigger 2 — **a real
second consumer asking for editing** — is the sole blocker. This item is that consumer
asking. When phase one is deployed, that doc moves to `inprogress/` and runs to its own
work list (the `elements/ → edit/` boundary, the element contract, the shadow-DOM focus
story, code-splitting so viewers do not pay for the keymap).

Once promoted, studio mounts the editor element on `#/piece/<id>` and edits **in memory
only**: no write route exists, the storage contract says the Worker owns every write,
and the design says the first saved edit becomes a new MNX rendition that takes the
canonical pointer. Leaving the page discards the edit, and the page says so. Persistence
is the next studio item, not a stretch goal of this one.

## Acceptance

- `npm run build` emits `dist/client/studio/index.html`; `check:boundaries` covers
  `apps/studio` and a deliberate import of `src/workbench/` from it is a red build.
- Deployed: `https://mnx-lab.totai.uk/` → `/studio/` → Access OTP prompt → library page
  signed in; both ingested pieces open and play; `capo:3` filters to one.
- Sign out returns to the OTP prompt; the workbench at `/workbench/` needs no sign-in.
- A D1-disabled address that Access admits sees the not-permitted page, not a blank
  library (test with `tools/library-access.py disable`, then re-enable).
- A smoke script under `harness/verify/` drives the built page against local D1/R2 with
  a signed local session: library list, filter, open, not-permitted. Same shape as the
  workbench's library smoke from storage item 4.
- `apps/studio/README.md` rewritten from "reserved" to "started", carrying the three
  decisions and the promotion trigger this item pulled.

## Open questions, deliberately left

- Whether `#/piece/<id>` uses the library's ulid or the `soundslice:<sliceId>` source
  identity in the URL. The ulid is the stable one; the source id is the readable one.
  Default to the ulid unless the first week of use says otherwise.
- The overlay bar's exact contents once the player element's tray (mute/solo, rate)
  exists — item 13 of the player campaign decides that, not this doc.

## Build record — 2026-09-11

Built as designed, with two departures worth recording:

- **The transport is a bottom dock, not part of the top bar.** `<mnx-player>` carries its
  whole tray — transport, sound, rate, volume, the iteration table — which is a dock's
  worth of controls, not a bar's; in the bar it squashed the title and covered the score.
  Two thin overlays now, both fading when the pointer is idle over a score: the top bar
  (title, staff view, Library, address, Sign out) and the bottom dock (the player).
  A compact player mode would be a change to the public `elements/` surface and is not
  this item's to make.
- **The Access change is reconciled in place.** `tools/library-access.py` declares the
  browser application with `self_hosted_domains` `[/api/library, /studio]` and `resource()`
  gained a `reconcile=` list of keys it may bring into line with a PUT; every other
  difference still refuses as drift. Covered by a unit test beside the drift-refusal one.

What is here: `studio/index.html` → `apps/studio/src/` (Lit; `StudioApp`, `LibraryPage`,
`PiecePage`, `session`), a `studio-consumes-neutral-surfaces` rule and `apps/studio` as a
leaf in `.dependency-cruiser.cjs` (`check:boundaries` cruises `apps` too; `tsc` includes
it), the Worker's root redirect flipped to `/studio/` (test updated),
`harness/verify/studio-smoke.mjs`, the rewritten `apps/studio/README.md`, the operations
doc. Verified locally: build green with the boundary rule, the Python operator tests, and
the studio smoke against `wrangler dev` with local D1/R2 and a signed local session — root
redirect, signed-out page, library list and filter, piece opened with the viewer drawn and
the player wired, back to the library, a missing piece as a page, no private localStorage,
no console errors. The not-permitted page is exercised by hand (disable the local user in
D1); the smoke has only one signed identity to work with.

**Still open — the owner's steps**, then this doc moves to `complete/`:

- [ ] `python3 tools/library-access.py bootstrap …` re-run with the owner's token file, so
      the browser application gains the `/studio` path; confirm the browser policy is
      still attached and the more-specific `/api/library/ingest` application still wins.
- [ ] `npm run deploy`; `https://mnx-lab.totai.uk/` → `/studio/` → OTP prompt → library.
- [ ] Both ingested pieces open and play; `capo:3` filters to one.
- [ ] Sign out forces a fresh OTP (else switch to the team-domain logout URL); note
      whether `returnTo` is honoured. Record the answer in `docs/library-access.md`.
- [ ] A D1-disabled address that Access admits sees the not-permitted page
      (`tools/library-access.py disable`, then `enable`).
- [ ] `core-editor-element-promotion.md` moves to `inprogress/` — its trigger is pulled.
- [x] The piece page reads the canonical `.gp` and converts it in the browser
      ([studio-storage-source-canonical.md](studio-storage-source-canonical.md), built the same day).
