# viewer-embedded — a foreign host page

The third app (workbench · studio · **viewer-embedded**), and the embed
contract's first real consumer. Read-only by design: it views documents, it does
not edit them. See
[roadmap/complete/core-viewer-embedded-app.md](../../roadmap/complete/core-viewer-embedded-app.md).

## The point

It consumes **only the published artifact** — `dist/embed/mnx-lab.js` — never
`src/`. That restriction is the whole value: an app that imported the source
tree would test nothing about what a stranger's website actually receives. This
page knows three things and no more:

1. the URL of the embed artifact,
2. the URLs of its own document files,
3. the element's public attributes and properties.

It declares no `@font-face` and hosts no SMuFL metadata. If it ever needs to,
the embed contract has a hole — and that is exactly the hole this app found
when it was written (the component used to fetch its metadata from the *host's*
origin root, so any real embed 404'd).

## The two theme axes

The buttons switch **page** and **viewer** independently, because all four
combinations have to look right and a host locked to the component's scheme
can only show two of them.

- **page** flips `color-scheme` on `:root` — the standard declaration, and the
  very signal the component reads when its theme is `auto`. No bespoke
  handshake.
- **viewer** sets `<mnx-document-viewer theme>`. `auto` follows the page (because
  `color-scheme` is inherited and the component resolves `light-dark()`
  against it); `light`/`dark` override — a dark site that still wants white
  paper, say.

That second finding was the app's first real catch: on a dark page the document viewer
had no styles at all — transparent paper, the host's ink, and staff lines
with `stroke: none`, i.e. not drawn. The viewer now carries its own tokens.

## Running it

```bash
npm run dev:embed-app        # builds the artifact, serves BOTH origins, prints the URL
```

It starts two servers — the artifact on one port, this page on another — and
prints the one URL to open. Two origins is not ceremony: it is what a real
embed faces, and serving both from one root is precisely the convenience that
hid the asset bug for so long.

Opening `index.html` directly (or serving only this directory) shows
*“no artifact base configured”* rather than rendering. That is deliberate:
there is no correct default to fall back to — the deploy currently ships
`dist/client`, not `dist/embed`, so this repo has no artifact URL to point at,
and inventing a relative one would just tempt someone to serve the artifact
same-origin. A real host hard-codes its CDN URL in `ARTIFACT_BASE` (`app.js`);
here, `?base=<url>` supplies it.

The documents in `documents/` are copies, deliberately: a host serves its own
documents. They are not read from `scenarios/` at runtime — coupling the demo
to the corpus would make it a second workbench.

## Document heading

The viewer always shows a heading. `mnxDoc.name` is its required fallback (a
filename, scenario name, or host-library label); optional `mnxDoc.artist` and
`mnxDoc.title` produce `Artist: Title`. These are wrapper metadata, not fields
inside `mnxJson`: MNX v27 still marks document title and composer metadata as
planned for 1.0 rather than part of the schema.

## Tested by

`npm run smoke:embed` — builds the artifact, serves it and this page on **two
different origins**, drives headless Chrome, and asserts the element upgrades,
the SVG renders, Bravura is registered by the artifact, a second viewer on the
same page works, and the console stays clean. Same-origin testing is what let
the asset bug survive this long, so the two origins are the point.
