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

Sign in, browse the library and open a piece in the shared score frame. Tags and
recording attachments can be edited and persisted; score editing is still a later
item. [Recording management](../../docs/studio-recordings.md) adds YouTube links,
audio uploads, selected-recording details, deletion and read-only sync statistics to the piece page.

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
the library page's tools row above the score (the way back, the title, Zoom, Settings,
Tags, Source, Instruments, the theme toggle) and the player's tray below it, which carries
only transport, readout, rail, rate and volume; one focus mark on the score's top-right
corner, faded until hovered, hides and shows both together and takes the browser into
and out of fullscreen with them (a tap, not the remembered choice — fullscreen needs
the gesture). **Source · <what plays>** opens the Source sheet in the frame's side slot: Synth and
each recording, choose one, edit or add a recording in the same slot
([docs/studio-recordings.md](../../docs/studio-recordings.md)). The Instruments sheet sits in the frame's side slot,
between the strips, and lists the parts: hide one from the score (it keeps playing), mute
it, set its level beneath the tray's master volume and choose its sound — which is why the
tray carries no Sound selector here. The mix is synth-only; while a recording plays only
hiding works. Hidden parts, the mix and the source last played are remembered per piece in the LIBRARY (`piece_views.prefs`, docs/studio-storage.md), so they hold across devices; `mnx-studio.parts.<id>` stays as the local cache that paints the sheet before the snapshot lands. The staff view is the settings card's STAFF row alone (the frame's
segmented control is off here), the piece's own values are the Edit piece panel's, and sign-out is the
library page's — a piece is not where you leave. A tap on the score is never a chrome
toggle. The staff view, the display settings, zoom and spacing, the theme, and whether
the score was left focused, are per-browser localStorage preferences (`mnx-studio.*`),
the one persistence a shell may own without a backend decision.

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
`src/storage` (the typed library client), `src/importers` (the clean-room converters in
a worker — promoted out of the workbench when the library stopped storing derived MNX) and,
since 2026-09-17, `src/edit` — the DOM-free ops layer, opened when studio began making
pieces (`#/new` builds a document through `applyOp`). It must not import `src/workbench/`
or `src/assist/`; nothing may import `apps/studio/`. The editor's *mount* arrives through
`elements/`, by promotion: since 2026-09-17 the piece page binds
`src/elements/editorHost.ts` behind a dynamic `import()` — the keyboard's core, then the rung
inspector (Enter), the lyric text editor (Shift+L) and copy/cut/paste, mounted in an overlay the
page supplies over the score pane. `.dependency-cruiser.cjs` makes any of
those a red build. Anything both shells want is first *promoted* into `elements/` or
below — a deliberate, reviewed move.

## Editing — the trigger this pulled

[roadmap/complete/core-editor-element-promotion.md](../../roadmap/complete/core-editor-element-promotion.md)
was parked behind "a real second consumer asking for editing". Studio is that consumer.
The [studio authoring campaign](../../roadmap/inprogress/studio-campaign-authoring.md)
sequences it: pieces are made in studio first (`#/new`), then the save pipeline, then the
promotion in three slices. **A saved edit is a new `.gp` rendition that takes the canonical
pointer** — Guitar Pro stays the stored format even for studio's own edits, so no MNX
migration ever runs on stored data, and every save is checked for what the round trip lost.

### On a tablet or a phone, studio plays — it does not edit

**A touch device is a player.** Where the primary pointer is coarse
(`(pointer: coarse)`), the piece page **does not bind the editor at all**: no cursor, no
keymap, no editor chunk loaded, no write lock taken, and the Edit piece panel and the save chip
say why rather than offering verbs that do nothing. Everything else is unchanged — the
score, zoom, the player, sources and recordings, instruments, the piece's own values and focus mode are the
whole point of the device.

This is a **decided rule, not a gap**. A touch entry bar was built on 2026-09-20 and
rejected by the owner the same day, on the tablet, after use: a bar over the score holds the
foot of the pane whether or not anything is being edited, and the tablet edits in focus mode
where the music is meant to be the whole page. The case, both shapes and the six traps are
kept in
[roadmap/rejected/studio-editor-touch.md](../../roadmap/rejected/studio-editor-touch.md) —
**read it before proposing a palette, a sheet or a mode toggle**, and note that a setting was
considered and refused: a per-device toggle is a second answer to "can this device edit".

A tap still **places the edit cursor** on a device that edits and still **seeks playback**
everywhere ([core-editor-pointer-placement](../../roadmap/complete/core-editor-pointer-placement.md));
that is navigation, and it is not affected. `#/new` is a form, so a piece can still be made
on a tablet — the music goes in on a computer.

The test lives in `PiecePage.ts`, in the shell, deliberately: `src/elements/editorHost.ts`
knows nothing about what kind of machine it is on, and no layer below `elements/` should.
**`npm run smoke:play-only` guards it** — a rule that is an absence rots quietly, so that
smoke drives studio as a tablet (touch emulation, real touch events, no keystroke) and
asserts the absence: no binding, the editor chunk never even fetched, a tap leaving no
cursor, no Keys sheet, and the chip and the Edit piece panel saying why. Break the rule and it
fails on the first assertion.

**The piece page edits and saves** (since 2026-09-17,
[studio-save-pipeline](../../roadmap/complete/studio-save-pipeline.md)). Its first editor
is the **Edit piece** panel — opened by the pencil beside the title, not by a button in the
tools row, because it edits what the title SAYS rather than acting on the score. It holds
everything a piece is, in three bands ordered by what you can do about each: the score's own
header as fields (a `setWork` op through an `EditHistory`), then what the engine read off
the notes — parts, capo, tuning, correctable only by an alias, which renames a value
library-wide without touching the file — then your own values. It replaced the separate
Details and Tags sheets, which split one subject in two: Details owned the header fields
while Tags showed the same values again, read-only, under “From the music”, with a pencil
that could only rename the echo. `fromWorkHeader` (`src/model/libraryTags.ts`) is the line
between the first two bands, and a header value the score itself never stated — a title read
from a sidecar at ingest — shows as the field's placeholder rather than vanishing. Nobody is asked to save: `src/storage/saveSession.ts` keeps the live
document in a local IndexedDB recovery record while edits are unsaved, checkpoints after a
pause, and measures the Guitar Pro round trip in a worker every time. The chip beside the
title says what is at risk, then how fresh the last save is; the Save sheet says what a save
could not keep, names a version, and settles a conflict with another device by keeping this
one's work as a copy. One tab per piece edits (a Web Lock); a second one reads.

## Assist credentials — still a promotion waiting

Studio will want the workbench's BYOK flow (core-assist-byok.md). `src/assist/openrouter.ts`
is pure and could be consumed today; `src/workbench/assistCredentials.ts` (localStorage,
the PKCE round trip) is shell-specific and stays behind the boundary until studio actually
asks for assist — then it lifts to a layer both shells may import, with the storage keys
and the callback-URL derivation as its only decisions.

The library Actions column offers MNX, Guitar Pro 7 (`.gp`), MusicXML, and PDF.
PDF opens a paginated vector preview; **Print / Save PDF** uses the browser print
dialog. It reads the same saved staff, display, repeat, zoom, and spacing preferences
as the piece page. A Tab setting renders only tab for pieces with known strings.
The file exports preserve the whole document regardless of display settings.
