# The JSON view finally gets a consumer

> **Status: proposed 2026-08-15.** Item 7 of
> [core-campaign-modernist.md](../inprogress/core-campaign-modernist.md). The UI half lands with
> [workbench-score-panel.md](../complete/workbench-score-panel.md)'s json tab; the model half stands alone and
> can go first.
>
> `core-` because the work is in `src/model/` — below the harness boundary, so it is the
> one part of this campaign that can be **tested properly**.

## The problem: a complete engine nobody plugged in

`src/model/jsonView.ts` renders an MNX document to numbered lines with a JSON-pointer
index. `buildJsonView(doc)` returns `lines`, `lineByPointer`, `noteLineByKey` and
`noteKeyByLine` — everything a real JSON pane needs, including the note↔JSON
cross-highlight traversal that CLAUDE.md insists must stay in lockstep with
`model/noteKeys.ts`.

**Nothing in the UI calls it.** The panel's json tab renders
`<pre class="json">${this.rawScore}</pre>` — the raw file text, unindexed, unhighlighted.
The only importer in the whole repo is `src/model/pinnedErrors.ts`, and it takes just the
`pointerToDisplayPath` helper.

**And it has no test**, despite CLAUDE.md naming it as one of two modules that must
mirror each other's traversal exactly.

Two things follow. The score panel's json tab is mostly *wiring an existing module*
rather than new mechanism — and this module is about to become load-bearing for a
surface people use, having never been pinned.

## The pinned-error highlight is already half-built, and broken

`showErrorInJson()` sets `errorPointer`, and the exhibit row still prints
**"· highlighted in document →"**. `panelJson()` never reads `errorPointer`. The panel
consolidation moved JSON into a tab and dropped the wire; the promise in the UI text has
been false since.

This is the cheapest win in the campaign: `errorPointer` → `lineByPointer.get(pointer)` →
scroll to the line and mark it. The claim already in the interface becomes true again.

## What to add to the model

One field. `buildJsonView()` gains:

```
spanByPointer: Map<string, [startLine, endLine]>
```

`lineByPointer` gives a subtree's *start* line only, which is enough to jump to
something and not enough to **show** it. The `emit` function is already recursive and
already pushes to `lines`, so recording `lines.length` before and after each call yields
the span — roughly ten lines of code, no restructuring, no second traversal.

That unlocks the design's real idea for the tab: a **SELECTION / WHOLE SCORE** toggle
that, scoped, *"shows the eight lines behind what is selected"*. Without spans a scoped
view can only guess where the subtree ends.

The selection-level → JSON-pointer mapping is **workbench-tier**, not model-tier — it
belongs beside `ENCLOSURE_BY_LEVEL` in `ScenarioPage.ts`, because it is a fact about the
ladder's levels, not about JSON. Keep the boundary clean: `model/` knows pointers,
`workbench/` knows what the cursor currently points at.

## The test, which is the point of splitting this out

**`harness/conformance/json-view.test.ts`** — new. `jsonView.ts` is in `model/`, imports
nothing internal, and is directly importable by the harness. Assert:

1. **`lines.join('\n')` equals `JSON.stringify(doc, null, 2)`** for a set of corpus
   documents. This pins the renderer to the one format everyone already expects and makes
   any accidental drift in indentation or key order a red build.
2. **Every `spanByPointer` range contains its `lineByPointer` start**, and spans nest
   consistently — a child's span inside its parent's. This is the invariant the scope
   toggle depends on.
3. **Note keys round-trip**: `noteKeyByLine(noteLineByKey(k)) === k` across a document
   with multiple parts, voices and staves. This is the assertion CLAUDE.md's "keep them
   in lockstep" rule has been asking for and never had — and it is worth writing even if
   the rest of this item is deferred, because the lockstep requirement is *already* live
   for the note↔JSON cross-highlight.

Use real corpus documents rather than fixtures. `twelve-bar-blues` (multi-part,
multi-voice) and a `spec/` mirror are the useful pair; the mirrors carry no ids, which is
exactly the edge that catches key-minting assumptions.

## The UI half

Lands with the score panel's json tab. Line-number gutter in the lightest grey; three
inks only — keys in ink at 600, numbers in the accent, punctuation quiet — using the
`--json-string` / `--json-number` / `--json-boolean` tokens that **already exist in
`tokens.ts` and are referenced nowhere**. A regex pass per line is adequate; do not add a
tokenizer for a read-only pane.

Then: COPY in the context bar, the scope toggle beside it, and a find-in-JSON footer with
the line count.

**One performance note.** The largest corpus documents run to a few thousand lines, and
the panel renders inside a shadow root with Lit. Render the gutter and body as a single
pass over `lines` rather than a component per line, and check the largest score in the
corpus at the hands-on review before assuming it is fine.

## Not this

- **Not an editor.** The pane is read-only. Editing MNX by hand belongs to the ops layer
  and the assist loop, both of which have verdict machinery this pane does not.
- **Not a folding tree.** The scope toggle is the answer to "this document is too long",
  and it is a better one, because it follows the selection instead of asking the reader
  to navigate twice.
- **Not a diff view.** Related, but that is the compare tab's rejected feature — see the
  campaign doc.
- **Not a replacement for `pointerToDisplayPath`**, which `pinnedErrors.ts` uses and which
  stays as it is.

## Verification

- `npm test` — the new conformance test is the deliverable, and it should fail
  convincingly if `spanByPointer` is wrong (delete a `lines.length` capture and watch
  assertion 2 go red).
- Goldens untouched — `jsonView.ts` is not on the layout or emit path at all.
- **Hands-on**: the exhibit's "highlighted in document →" link actually highlights;
  the scope toggle over a note selection shows the note's object and not its neighbours;
  find-in-JSON over the largest corpus score stays responsive.
