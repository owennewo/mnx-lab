# Studio as an installed app

Chrome on Android offers to install any site, so `mnx-lab.totai.uk/studio/` could
always be put on a home screen — it just arrived as a bookmark shortcut with a
generated letter tile, because nothing here told the browser otherwise. This is
what now tells it.

Scope: **studio only**. The workbench is the lab's own instrument and stays
uninstallable — it takes nothing from here, favicon included.

## The two Access facts

`/studio` and `/api/library` are one Cloudflare Access application
([library-access.md](library-access.md)), and the install path crosses that
boundary twice, in opposite directions.

**The manifest is behind Access, so the page asks for it with credentials.**
Chrome fetches a manifest out of band, and an anonymous fetch of
`/studio/manifest.webmanifest` gets the OTP page — which does not parse, so
Chrome falls back to its defaults without saying anything. `studio/index.html`
therefore carries `crossorigin="use-credentials"` on the link. Remove it and the
install silently reverts to a letter tile.

**The icons must NOT be behind Access, so they live at `/app-icons/`.** This is
the one that has no local symptom at all: Chrome does not fetch the icons
itself, it hands their URLs to Google's WebAPK minting service, which fetches
them **server-side with no Access cookie**. An icon under `/studio/` mints as a
generated tile on a real device while looking perfect in dev.
`harness/conformance/app-icons.test.ts` asserts that no referenced icon path
starts with `/studio/` or `/api/`, because that is a rule about the deployment
that the files cannot otherwise state.

## The icon

`public/app-icons/icon.svg` is the source and the favicon; the PNGs beside it
are derived and committed, regenerated with `npm run update:icons`, which
rasterizes the SVG through the `google-chrome` the browser smokes already
require. `git diff -- public/app-icons/` is the review.

The mark is fret **0** on the middle string of three — the open string, so the
numeral means what the app is for. Flat paths only: no gradients, no text, no
Bravura, so rasterizing needs nothing but a browser and every size is the same
drawing rather than a set of separate ones.

**Round caps are the trap.** A string reaches `stroke-width / 2` beyond its
endpoint, so the drawing is 35px wider and taller than its coordinates say. The
composition chosen on the design canvas overflowed the maskable safe circle by
11px measured that way, and is scaled to 0.92 about the centre to fit — every
proportion preserved, 6.6px of clearance gained. The conformance test measures
the visual extent, caps included, and refuses anything that leaves the circle;
lengthening or thickening a string spends that margin.

One PNG set serves both purposes (`"any maskable"`): the ground bleeds to all
four edges for the mask, and the mark's own margins are generous enough that an
unmasked surface does not look crowded.

## theme-color, and why it is not a media query

The manifest carries one `theme_color`, used for the splash; the Android status
bar in an installed window follows the `<meta name="theme-color">` element,
which `applyTheme()` in `apps/studio/src/theme.ts` rewrites.

It is one element rewritten in JS rather than the usual pair under
`prefers-color-scheme`, because studio's theme is **tri-state**: `auto`, `light`,
`dark`. A reader who pins light while the machine is dark would get a dark
status bar over a light app, and a media query cannot know about the pin. `auto`
is the only setting that follows the machine, so it is the only one that
listens for the machine changing.

The hexes (`#f3f2f1`, `#141211`) are the `oklch()` grounds in
`apps/studio/studio.css` converted; the conformance test pins both sides so a
retune cannot drift them apart silently.

## The screen stays awake while playing

`src/elements/screenWakeLock.ts`, held from `Player.publish()`. A tablet on a
music stand goes untouched for the length of a song, so without it the screen
dims and locks mid-piece.

It hangs off the transport's own `wantsPlayback` rather than the Play button, so
a track that simply ends gives the screen back too. Three properties of the API
shape the rest: the browser releases the lock whenever the page stops being
visible and does **not** give it back, so there is a visibility listener; the
request rejects when the page is hidden or inside an iframe without the
`screen-wake-lock` permission policy, which the embed face is; and Safari has no
`navigator.wakeLock` at all. Every path fails quietly — a score that plays
without holding the screen is the old behaviour, not a broken one.

It lives in `elements/` rather than `audio/` because it touches the DOM, and
`model`/`engine`/`audio` stay importable from Node.

The proof is in `harness/verify/player-workbench-smoke.mjs`, which stubs
`navigator.wakeLock` through `Page.addScriptToEvaluateOnNewDocument` and asserts
one request per playback, no second request while already holding, and a release
on stop. Headless Chrome's real implementation refuses when the page is not
visible, so the stub is testing our bookkeeping, which is the part that breaks.

## Deliberately not done

- **Media session** — lock-screen and Bluetooth transport controls. Assessed and
  declined on 2026-09-24: it works free only for the `audio` source
  (`HtmlAudioPort` is a real media element), needs a silent-audio-element hack
  for the synth, which is Web Audio only, and is owned by the iframe for
  YouTube. Partial support is worse than none for a footswitch, and a pedal in
  keyboard mode already works through the player's Space binding.
- **Offline / a service worker.** The app shell would be easy; the pieces are
  not — they are `.gp` bytes fetched from R2 per open, so it needs a caching
  policy (last opened? starred?) and revision checks, plus care that a cached
  shell never masks an expired Access session. Its own item when wanted.
- **Share target**, `file_handlers`, manifest `shortcuts`.
