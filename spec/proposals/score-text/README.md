# Proposal: score-text — typed text on the score

**Status:** drafted in the fork and proved against the corpus; not yet posted upstream.
**Fork branch:** `proposal-score-text` (kept as a git worktree, never checked out in
`vendor/mnx` — see [docs/mnx-spec-submodule.md](../../../docs/mnx-spec-submodule.md)).
**Proposed schema:** [spec/mnx-schema.proposed.json](../../mnx-schema.proposed.json)
(v28), generated from that branch. **CG issues:**
[w3c-cg/mnx#112](https://github.com/w3c-cg/mnx/issues/112),
[w3c-cg/mnx#377](https://github.com/w3c-cg/mnx/issues/377).

## Thesis

MNX v27 allows free text in seven places (lyrics, naming, two dynamics decorations), and
a bar can carry no text at all — rehearsal marks, section names and performance
directions have nowhere to go. This proposal adds:

- **`rehearsal`** and **`section`** — two *separate* typed objects on the **global**
  measure, beside `segno`/`fine`/`jump`. A rehearsal mark is an arbitrary index into the
  score; a section name states what the music is. (Guitar Pro conflates them; MNX should
  not.)
- **`directions[]`** — generic performance directions on the **part** measure, shaped
  like `dynamic-group`.

The key argument: **typing makes placement derivable**. Because a rehearsal mark, a
section label and a direction are different kinds of thing, an engraver can place each
correctly without the inner/outer placement axis other formats need. The narrative case,
including a round-trip stress test in which 3 of 4 directions are destroyed or
misclassified by today's format, is
[roadmap/proposed/score-text.md](../../../roadmap/proposed/score-text.md).

## Contents

- [`schema.diff`](schema.diff) — published (v19-pinned schema) → proposed (v28),
  regenerated whenever the proposal branch changes.
- [`scenarios.md`](scenarios.md) — the nine corpus scenarios that opt in with
  `"schema": "proposed", "proposal": "score-text"`.
- [`engravings/`](engravings/) — our rendered output per scenario, produced by
  `harness/render/render-png.ts`; this is what `push:proposal` injects as the spec
  examples' reference images.

## The cycle

Drafted in the fork's Django admin → `freezedb` → proposed schema generated → scenarios
prove it → engravings render it → issue + PR upstream ([#529](https://github.com/w3c-cg/mnx/pull/529)
is the worked precedent, merged as schema v26 with our engraving on the spec site).
On adoption: move the pin, `sync:spec` mirrors the examples back down as
`origin: mirrored`, these local scenarios retire, and `mnx-schema.proposed.json` plus
every `"schema": "proposed"` declaration are deleted.
