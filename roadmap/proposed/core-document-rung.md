# The top rung is named for something else — `score` → `document`

Serves the **implementation loop**. Raised 2026-08-24 while scoping
[core-layout-authoring.md](core-layout-authoring.md)'s addressing question, which
cannot be answered while the word is ambiguous.

## The collision

`SELECTION_LADDER`'s top rung is called `score` and means **the whole document —
every part, every measure**. MNX means something narrower and different by the
word: `scores[]` is an array of **named presentations** of the music, of which a
document may hold several.

```
MNX document
├─ global   required   the timeline
├─ parts    required   the music
├─ layouts  OPTIONAL   reusable vertical arrangements
└─ scores   OPTIONAL   0..N named presentations — "Full score", "Part A", "Part B"
```

The root requires only `global`, `mnx` and `parts`, and **102 of our 108
scenarios carry no `scores[]` at all**. So the rung is not merely a loose synonym
for the MNX object — it names a thing that is usually absent, and when present is
plural.

The word carries four meanings in this codebase today:

| Reading | Where | Scale |
|---|---|---|
| the whole document | the ladder's top rung; `SelectionClosureScope` | all parts |
| an MNX presentation | `no score 1`, `removeScore` | one view of them |
| a corpus scenario | `keymapDocs.ts:100`, "the previous/next score in the collection" | one document |
| UI chrome | "the score panel", `<mnx-score-viewer>`, `score.mnx.json` | the app |

## Why it has to be settled now, not eventually

[core-layout-authoring.md](core-layout-authoring.md) owes construct sentences for
the MNX `score` kind, and its **destruct half already ships**: `no score 1` parses
in [setupGrammar.ts:117-126](../../src/edit/setupGrammar.ts#L117) and applies in
[ops.ts:1371](../../src/edit/ops.ts#L1371). That item will therefore put the word
"score" into a popover sentence meaning *one presentation* — typed while standing
on a rung named `score` meaning *the entire document*. Two opposite scales, one
word, one keystroke apart, in the same session state.

**A rename after that item lands has to rewrite its grammar too.** Before it, the
rename touches no grammar at all.

## The proposal

1. **Rename the rung `score` → `document`.** It already means the document; this
   is the honest name, and it frees the word for MNX's meaning.
2. **Add no `score` rung.** Every rung on the ladder is a *widening range over the
   global timeline* — note → event → container → voiceMeasure → partMeasure →
   measure → section → document. An MNX score is a **projection over parts**: it
   narrows on an axis the ladder does not have, at full width in time. It would be
   the only rung that is not a range, which is the same objection
   [core-layout-authoring.md](core-layout-authoring.md) already raises against a
   layout rung. **The ladder stays one-dimensional.**
3. **Which score you are reading becomes viewer state**, beside the projection
   axis that already exists: `#/scenario/<id>?view=both&score=Part%20A`. A picker,
   deep-linkable, one active at a time. Named here, **built elsewhere** — no
   corpus document needs it yet (six carry `scores[]`, and only
   `spec/multimeasure-rests` has more than one worth choosing between).

The distinguishing test for (2) and (3), and the reason a layout is neither: **a
layout can change within a single view.** `spec/system-layouts` is one score whose
winds are spread across three staves at m1 and condensed onto one at m4. You pass
through several layouts while reading one presentation, so a layout cannot be the
thing you are "in" — it is a value a score cites. A score *is* the thing you are
in, which is exactly why it is a picker and not a rung.

## What moves, and what must not

93 occurrences of the `'score'` token across 21 files. The rename is mechanical,
but **it is not a global replace** — three of the four readings above stay put:

- **Rename**: `SelectionLevel`, `SELECTION_LADDER`, `presentLevels`,
  `SelectionClosureScope`, the clip payload `{kind: 'score', score}`
  ([selectionClipExtraction.ts:459](../../src/edit/selectionClipExtraction.ts#L459)),
  and their `KeyDoc` rows.
- **Leave alone**: [setupGrammar.ts:87,120](../../src/edit/setupGrammar.ts#L87) —
  both hits are the MNX sense and a blind rename **corrupts the `no score 1`
  grammar**; `keymapDocs.ts:100` (corpus sense); `keymapDocs.ts:509` (the panel).

User-facing copy moves with it and is the part worth reading rather than
sed-ing — `hudRows.ts:30`, `clipboardFeedback.ts:51` ("the whole score · N parts,
N bars"), and the `KeyDoc` meanings at `keymapDocs.ts:75,145,214,249,342`.

**Cost checked, not estimated**: `grep -rl '"score"' harness/fixtures/edit-traces/`
returns **zero** — no committed trace names the rung, so **no golden and no trace
fixture moves**. That is the whole reason this is cheap, and it stops being true
once layout-authoring records traces that stand on the rung.

## The question this item must answer first

**With a presentation picked, what does Escape-to-top select?** Every part in the
document, or only the parts visible in the active view? Selecting music you cannot
see is surprising; bounding selection by presentation makes the top rung mean
different things in different views, which is worse. The likely answer is that
`document` genuinely is the top and the view is a *drawing* filter that selection
ignores — but that is an assertion to test against the `spec/multimeasure-rests`
three-score case, not to assume. **It decides whether the rung is named `document`
or whether a bounded rung belongs beneath it**, so it is answered before the
rename, not after.

## Not in scope

The `?score=` picker itself (named above, deliberately unbuilt). The layout and
score construct sentences — [core-layout-authoring.md](core-layout-authoring.md)
owns those and this item unblocks the vocabulary they need. Renaming
`score.mnx.json`, `<mnx-score-viewer>` or the `mnx-lab` export surface: those are
a **public face** (library subpath exports, the embed build, every scenario
directory) and the rung rename does not require touching one of them.
