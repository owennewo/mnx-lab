# Studio as an installed app — manifest, icons, wake lock

> **Status: built 2026-09-24; awaiting the device check below.** Opened from an
> observation rather than a plan: Chrome on Android was already offering to
> install `mnx-lab.totai.uk`, and nothing in this repo had ever asked it to.
> The reference page is [docs/studio-installable.md](../../docs/studio-installable.md);
> this doc is the decision record, and most of it is about what was left out.

## What it is

Chrome offers to install any site, so the offer was real but the result was a
bookmark shortcut: a letter tile, the `<title>` for a name, browser chrome in
the window. Three things change that, and one of them has nothing to do with
installing at all.

1. **A manifest and icons.** `public/studio/manifest.webmanifest`,
   `public/app-icons/*`. Standalone display, a proper name and short name, the
   splash painted in studio's own ground.
2. **`theme-color` that follows the theme toggle**, including a pinned choice —
   rewritten by `applyTheme()`, not declared as a `prefers-color-scheme` pair,
   because the theme is tri-state and a media query cannot see a pin.
3. **The screen stays awake while playing** (`src/elements/screenWakeLock.ts`,
   held from `Player.publish()`). This is the one that solves a problem that is
   hit every session rather than one that might never be: a tablet on a music
   stand dims and locks mid-song. It is in `elements/`, so the workbench and
   the embed player get it too.

## The two findings worth keeping

**The icons cannot live under `/studio/`.** Chrome does not fetch manifest icons
itself — it hands their URLs to Google's WebAPK minting service, which fetches
them server-side with **no Access cookie**. Behind Access they mint as a
generated tile, on a real device, while looking perfect in dev. The manifest
itself *is* behind Access and is asked for with `crossorigin="use-credentials"`
instead. `harness/conformance/app-icons.test.ts` asserts both, because neither
is visible in the files.

**Round caps broke the maskable geometry.** A string reaches `stroke-width / 2`
past its endpoint, so the mark was 35px wider and taller than its coordinates
claimed and overflowed the 80% safe circle by 11px — measured, wrongly, on the
endpoints. The fix was to scale the whole composition by 0.92 about the centre,
which preserves every proportion the owner chose and buys 6.6px of clearance.
The test measures the visual extent, caps included.

## Assessed and declined

- **Media session** (lock-screen and Bluetooth transport controls). It is free
  only for the `audio` source, needs a silent-media-element hack for the synth,
  and is owned by the iframe for YouTube — so a footswitch would work on one
  source and not another, which is worse than uniform absence. A pedal in
  keyboard mode already works through the player's Space binding. Owner's call,
  2026-09-24.
- **Offline / a service worker.** The shell is easy; the pieces are `.gp` bytes
  from R2 per open, so it needs a caching policy and revision checks, and care
  that a cached shell never masks an expired Access session. Its own item if it
  is ever wanted — do not smuggle it in with a manifest change.
- **Share target, `file_handlers`, manifest `shortcuts`.** Out of scope by the
  owner: orthogonal to standalone.

## The device check (what remains)

On a real Android tablet, install from Chrome and confirm:

- the icon and name are ours, and the mask does not clip the strings;
- the splash colour does not flash against a dark system theme;
- the status bar follows the theme toggle, **including a pinned light theme on a
  dark machine** — the case the media-query approach would have got wrong;
- the screen stays lit through a full playthrough, and sleeps normally once
  paused;
- how the focus mark's fullscreen (`ScoreFrame.ts`) feels now that standalone
  has already taken the browser chrome away. The mark exists partly because
  Android needed it ([score frame](core-score-frame.md) history); in an
  installed window its bargain is different, and this is the first chance to
  judge it. Findings come back here.

No goldens moved — this touches no `model/`, `engine/` or `scenarios/` — so
there is nothing to register in [lab-verify.md](lab-verify.md).
