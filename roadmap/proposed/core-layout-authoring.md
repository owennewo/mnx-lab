# Layout authoring — the tree the element-ops campaign handed on

Serves the **implementation loop**. Owner of the `layout`, `score` and
`multimeasure-rest` element kinds, formally handed over by
[core-campaign-element-ops.md](../complete/core-campaign-element-ops.md) on
2026-08-15 (its second scoping decision).

## Why it is not element-ops work

The campaign's verbs all attach to a **place**: a note, an event, a bar, a part.
Its whole vocabulary — navigate to the thing, press the key, type the
declaration — assumes the target has coordinates in the music.

A layout has none. It is a **tree** of system → group → staff sources, describing
how parts are gathered onto staves for one presentation; a `score` is a named
selection of layouts plus page geometry; a multimeasure rest is a range inside
one. Nothing in the tree lives at an onset, so the selection ladder cannot reach
it and the popover grammar has nothing to attach to. Building them would have
meant inventing a second addressing scheme inside an item about the first —
which is exactly the kind of scope creep the campaign's contract exists to stop.

The removal half already exists (`removeLayout`, `removeScore`,
`removeMultimeasureRest`, from campaign item 13b): a tree node can be deleted by
index without any of this, because deletion needs only identity, not a place to
stand. **The asymmetry is the evidence** — where construction needs an
addressing scheme that removal does not, the thing being addressed is not the
music.

## What it blocks today

Six scenarios stay `blocked` in `harness/reports/construct-coverage.json`, each
naming this doc in `deferredTo`:

`lab/60-layout/group-barline-individual` · `spec/multiple-layouts` ·
`spec/orchestral-layout` · `spec/organ-layout` · `spec/system-layouts` ·
`spec/multimeasure-rests`

They render, they verify, and their ink is fully destructible. Only their
*construction* is owed.

## The question this item has to answer first

**What addresses a tree node?** Three candidates, none obviously right:

- **A second rung on the ladder** — layout as a level above score, navigated
  with the same Escape/Enter grammar. Coherent, but the ladder's rungs are all
  ranges of *music*, and a layout is not.
- **A structured text form** — the tree typed as text (`system: [guitar, bass]`),
  parsed like the other popover grammars. Cheapest by far, and honest about the
  tree being a shape rather than a place.
- **A panel** — direct manipulation in the side panel, with the ops fired as
  intents so traces still record them (the tray's ruling, part 2).

The trace machinery does not care which wins: a construct trace records intents,
and all three emit intents.

**Prerequisite (2026-08-24): the word.** Whichever wins, this item's sentences say
"score" meaning *one presentation*, while the ladder's top rung says `score`
meaning *the whole document* — and the destruct half (`no score 1`) already sits
in a popover typed from that rung. [core-document-rung.md](../complete/core-document-rung.md)
renames the rung to `document` first; it is cheap only until this item records
traces that stand on it.

## Built 2026-08-24 — the agreement block, and the answer

**The addressing question is answered: the structured text form.** The decisive
evidence was already in the tree — the three *destruct* sentences (`no layout 2`)
have always parsed as typed text addressed by a 1-based slot, so the construct
halves are the positive form of sentences the codebase already had. No tree-node
addressing scheme was invented: **you set a layout's whole shape as a value**, and
the ladder stays one-dimensional, exactly as the objection above wanted. The panel
remains possible later at no cost — all three candidates emit intents, and these
are the intents it would emit.

### The op pairs (contract §1)

| Kind | Construct | Destruct | Removal class |
|---|---|---|---|
| `layout` | `setLayout {index, layout}` | `removeLayout` | reference (unlinks naming scores) |
| `score` | `setScore {index, score}` | `removeScore` | container |
| `multimeasure-rest` | `addMultimeasureRest {scoreIndex, start, duration}` | `removeMultimeasureRest` | annotation |

Set-or-append: an index past the end appends, so **one verb both creates and
replaces**, and the id (or score name) is the primary key — naming an existing
layout replaces it in place.

### The shortcut (contract §2) — **Shift+S**, and the sentences move house

A new layout popover owns **all six** sentences. The three removals moved out of
Shift+P, where campaign item 13b had parked them for want of anywhere better: a
layout is not a part declaration, and the doc's whole thesis is that it is not a
declaration at all. Shift+S was free (M T U P C K A L R B were taken) and the
mnemonic is score/system; plain `S` stays the slur/slide anchor one layer down.

### The rung (contract §3) — `document`

The presentation layer attaches at the top rung, renamed from `score` by
[core-document-rung.md](../complete/core-document-rung.md) precisely so this
item's sentences could use the word in MNX's sense.

### The grammar

```
layout <id>: <content>       content := node ("," node)*
                             group   := (bracket|brace|group) [barlineStyle] ["label"] "[" content "]"
                             staff   := [("label" | @name | @shortName) ":"] source+
                             source  := partId [.staff] [~voice] [/up|/down] [@name|@shortName]
score "<name>": <systems>    a comma is a SYSTEM BREAK, a `>` a layout change inside one
mmrest m3 x2 [in 2]          the count carries `x` so a bare number is never the score
```

**Evidence (contract §4): every layout in the corpus is written as a sentence in
`harness/conformance/layout-grammar.test.ts` and must parse back to the committed
JSON.** That is the claim worth making — not that the parser accepts strings, but
that it can say what the spec's own examples say. It covers the nested case
(`system-layouts`: group→group→staff, multi-source staves, per-source `labelref`)
and the voice-split case (`organ-layout`: `~Main`/`~Oberwerk`).

### What this cost that the doc did not predict

- **A measure reference had no anchor to point at.** Scores name measures by id,
  and a document built from `{}` has none — so `addMultimeasureRest m3` pointed at
  nothing and the multirest silently did not draw. The fix follows the paste
  planner's existing rule (`selectionPastePlanner.ts:401`): **a reference mints its
  anchor.** `m<N>` means the Nth bar and gets that id if it is carrying none; an id
  that already exists is used as it stands, so hand-authored ids are never
  rewritten. Without this the trace's primitives differed from the golden while
  every note, rest and layout matched — the whole gap was seven missing ids.
- **The model types were wrong about the schema.** `symbol` was typed
  `'bracket'|'brace'|'none'` and `barlineStyle` `'regular'|'individual'|'noBarline'|'mensurstrich'`;
  the schema's enums are `bracket|brace|noSymbol` and
  `individual|instrument|unified|mensurstrich`. The engine compared against
  `'none'`, so `noSymbol` would have drawn a bracket. No scenario exercises it, so
  it was latent — corrected here because the grammar has to emit legal values.
  `staff-source.voice` and `system.layoutChanges` were missing from the types
  entirely.
- **`setPart` is unbound, so a trace cannot use it.** Crossing to a second part is
  Escape then Ctrl+↓ — `jumpDown` walks the flattened part×staff list, but only
  from the event rung upward. The keyboard join caught this, which is exactly the
  join's job.

### Evidence

Six scenarios move `blocked` → constructible: **blocked 7 → 1** (only the
percussion-kit scenario remains), five to `ops-reachable` and
`spec/multimeasure-rests` to **`traced`** — a 136-intent trace that replays from
`{}` and matches the committed primitives. THE BAR closes again at **41 of 41**
kinds with the three new verbs included. 958 tests, `check:scenarios` and `build`
green, and `update:primitives` leaves `scenarios/` byte-identical, so **no
approval was demoted and the verification ledger takes nothing from this item**.

### Left undone, deliberately

`page.layout` (the schema's fourth cascade level) has no sentence: **zero of the
corpus's 8 page objects use it**, and `useWritten` likewise. The ops take whole
values, so both are expressible by a programmatic caller today — only the typed
grammar omits them, and it can gain them the day a document needs one.

## Not in scope

Page geometry beyond what the corpus documents carry, and any layout *rendering*
work — the engine already draws these scenarios.
