# The viewer consumes an MNX document — `score` → `document` on the public face

> **Status: proposed (2026-08-30).** Serves the **implementation loop**. Follows
> [core-document-rung.md](../complete/core-document-rung.md), which settled the semantic
> distinction and deliberately left the public element out of scope. This item owns that
> public-face rename; the corpus filename moves separately in
> [lab-corpus-document-filename.md](lab-corpus-document-filename.md), and the workbench mode
> that exposes only the renamed viewer lives in
> [workbench-document-focus-mode.md](workbench-document-focus-mode.md).

## The collision is now on the public surface

MNX uses **document** and **score** for two different scales:

```
MNX document
├─ global   the shared timeline
├─ parts    the music
├─ layouts  reusable arrangements
└─ scores   0..N named presentations — Full score, Part A, Part B
```

`<mnx-score-viewer>` does not receive one member of `scores[]`. Its required content
property is `mnxDoc: MnxDocument`, and it resolves notation/tab/both over that document.
The name therefore teaches the wrong unit precisely where the library and embed face make
their promise to another application. It will become worse when the score picker already
named by `core-document-rung.md` arrives: a *score viewer* with a `score=` picker would use
the same word for the whole element and for one narrower presentation inside its document.

The vocabulary contract for this item is:

| Word | Meaning after this item |
|---|---|
| **document** | the MNX root, the object supplied to a viewer, and the workbench editing target |
| **score** | only one `MnxScore` / member of MNX `scores[]` |
| **projection** | the selected notation, tab or both rendering of a document |
| **engraving / music / paper** | the visible result where prose needs a human rather than a model term |
| **scenario** | one corpus fixture; never a synonym for its document |

This is an audit, not a global replacement. The value of the item is not making `score`
disappear; it is making every surviving use mean the MNX object.

## The public rename

The primary surface becomes:

| Today | After |
|---|---|
| `src/elements/ScoreViewer.ts` | `src/elements/DocumentViewer.ts` |
| `ScoreViewer` | `DocumentViewer` |
| `<mnx-score-viewer>` | `<mnx-document-viewer>` |
| `mnx-lab/elements` named export `ScoreViewer` | named export `DocumentViewer` |
| “score viewer” in the surface contract | “document viewer” |

Measured when raised: **43 direct class/tag references across 26 active files** once
completed and superseded roadmap history is excluded. The live consumers are bounded:
the workbench, `embed.html`, `apps/viewer-embedded`, the embed and selection smoke tests,
the element subpath export, the viewer contract and extension docs, and a few engine/token
comments that name their owner.

The package is `0.2.0`, and this repository contains no independently maintained consumer.
The default verdict is therefore a **clean pre-1.0 break**: update every in-repo consumer in
the same commit and do not carry two permanent tags for one component. At pickup, check the
deployed embed artifact once. If a real external host is discovered, the compatibility seam
is one release only:

- register `mnx-document-viewer` on `DocumentViewer`;
- register the old `mnx-score-viewer` on a trivial subclass, because the custom-element
  registry cannot register the same constructor twice;
- keep `ScoreViewer` as a deprecated named export of that subclass;
- exercise both tags in the embed smoke and name the removal release in the docs.

An unbounded alias is rejected: it would leave the ambiguity on the public surface forever
and make the next score-picker API explain which meaning its host is using.

## The semantic audit behind the tag

Names immediately owned by the element and its hosts move with the public face:

- `renderScore()` becomes `renderDocument()` or, where the method draws only the chosen
  view, the more exact `renderProjection()`;
- `#score-container` becomes `#projection-container` — it contains emitted SVG, not the
  root data object;
- `scoreTokens` becomes `notationTokens` or `viewerBaseTokens`, whichever its declarations
  actually describe; `documentTokens` is not an automatic answer for visual ink;
- workbench imports, typed queries and CSS selectors use `DocumentViewer` and
  `mnx-document-viewer`;
- user-facing “score panel”, “score pane”, “score as loaded” and “whole score” are read in
  context and become document panel, document pane/canvas, loaded document and whole
  document where they name the root;
- current normative docs, README/AGENTS guidance, demos and smoke diagnostics move. A
  completed roadmap document may retain the old name when it records the surface that
  existed then; add a forward note only where a reader could mistake it for current API.

The audit must **not** rename:

- `MnxScore`, `MnxStructure.scores`, `setScore`, `removeScore`, `scoreIndex` or the setup
  grammar's `score …` / `no score …` sentences;
- score layout, page, system-break and multimeasure-rest logic — these genuinely operate on
  one presentation;
- ordinary musical prose where “the score” intentionally means the engraved music rather
  than a JavaScript/MNX object, provided it cannot be confused with the root contract.

The final search is reviewed use by use. A zero-result search for `score` would be evidence
of damage, not success.

## Work

1. Rename the element file, class, custom-element tag and `mnx-lab/elements` export together.
   Update the embed entry and build comments so importing the embed artifact registers the
   new tag.
2. Update the workbench, standalone embed demo and `apps/viewer-embedded` to consume the new
   surface. The document property remains `mnxDoc`; this is a naming correction, not a new
   data path.
3. Perform the internal semantic audit above, preferring `projection` for rendered output
   rather than mechanically substituting `document` everywhere.
4. Rewrite `docs/core-viewer-surface.md` around `<mnx-document-viewer>` and update current
   extension docs, package examples and app guidance.
5. Update the conformance and browser smoke assertions. If the pickup audit activates the
   one-release compatibility seam, assert that both tags upgrade and present the same
   public properties; otherwise assert that the obsolete tag is absent so it cannot return
   accidentally.
6. Record the package-facing break in the relevant history/changelog surface. Do not fold
   the corpus filename migration into this commit: its generated-tree rules and diff shape
   deserve their own verdict.

## Acceptance

- The embed and `mnx-lab/elements` faces document and export `DocumentViewer`, and every
  current in-repo host mounts `<mnx-document-viewer>`.
- The viewer still accepts an `MnxDocument` and renders notation/tab/both byte-identically;
  no rendering option, event or property changes merely because its owner was renamed.
- Every surviving code use of `score` in the touched surface is classified as a genuine MNX
  presentation or deliberate musical prose.
- `npm test`, `npm run check:scenarios`, `npm run build`, `npm run build:embed` and
  `npm run smoke:embed` are green.
- `npm run update:primitives` leaves `git diff -- scenarios/` empty. A component-name change
  has no authority to move one staff-space coordinate or emitted SVG byte.

## Not this

- Not the `score.mnx.json` corpus convention — `lab-corpus-document-filename.md` owns it.
- Not the future `?score=` presentation picker. The rename only makes that API possible
  without a noun collision.
- Not editor promotion into `elements/`, a second renderer, or a new viewer property.
- Not a rewrite of completed roadmap history to pretend the old public name never existed.
