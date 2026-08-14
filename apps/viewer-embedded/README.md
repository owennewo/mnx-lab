# viewer-embedded — a foreign host page

The third app (workbench · studio · **viewer-embedded**), and the embed
contract's first real consumer. Read-only by design: it views scores, it does
not edit them. See
[roadmap/proposed/core-viewer-embedded-app.md](../../roadmap/proposed/core-viewer-embedded-app.md).

## The point

It consumes **only the published artifact** — `dist/embed/mnx-lab.js` — never
`src/`. That restriction is the whole value: an app that imported the source
tree would test nothing about what a stranger's website actually receives. This
page knows three things and no more:

1. the URL of the embed artifact,
2. the URLs of its own score files,
3. the element's public attributes and properties.

It declares no `@font-face` and hosts no SMuFL metadata. If it ever needs to,
the embed contract has a hole — and that is exactly the hole this app found
when it was written (the component used to fetch its metadata from the *host's*
origin root, so any real embed 404'd).

## Running it

```bash
npm run build:embed          # produces dist/embed/ (artifact + its smufl/ assets)
npx http-server apps/viewer-embedded   # …or any static server
# then open index.html; ?base=<url> points at a different artifact origin
```

The scores in `scores/` are copies, deliberately: a host serves its own
documents. They are not read from `scenarios/` at runtime — coupling the demo
to the corpus would make it a second workbench.

## Tested by

`npm run smoke:embed` — builds the artifact, serves it and this page on **two
different origins**, drives headless Chrome, and asserts the element upgrades,
the SVG renders, Bravura is registered by the artifact, a second viewer on the
same page works, and the console stays clean. Same-origin testing is what let
the asset bug survive this long, so the two origins are the point.
