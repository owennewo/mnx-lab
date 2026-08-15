# Constructibility traces — the forward verdict for all 106

> **Status: built 2026-08-14, same day as proposed.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md), item 3, the
> forward half of the machinery item 2 built backwards
> ([core-element-ops-destruct-sweep.md](core-element-ops-destruct-sweep.md)).
>
> Item 1 built the forward harness for two scenarios: a construct-trace fixture
> kind, replay from `{}`, the keyboard join, the key-normalized primitives verdict.
> This item scales the *verdicts* to all 106 — not the traces, which arrive with
> items 4–13 as each unlocks its scenarios. Like item 2 it is a **harness item**:
> no new op, no new rung, so its agreement block is the decisions below.

## What the two harnesses each know

The destruct axis is generative: the walker enumerates and attempts, so verdicts
for all 106 were free the day it ran. The construct axis cannot be — a trace is a
recorded human performance, and there is no "attempt to build this scenario"
button. So the forward verdict is necessarily **two things**, and the whole design
follows from keeping them apart:

- a **prediction**, computed statically for every scenario from the element
  inventory: could today's verbs build this at all?
- a **verdict**, earned only by a committed trace that replays from `{}` and
  matches the goldens.

Where they disagree, the disagreement is the finding — and item 1 already met the
first one: `open-strings-chord` replays to a passing primitives verdict while its
document declares a clef no op can author. The clef is invisible to the oracle,
because the engine draws the same default anyway. A prediction that called it
unreachable would have been *wrong about the only thing that matters*.

## The decisions

### 1. The verb table lives on the kind table

The campaign contract says an item must define **the op pair — the construct op and
its destruct op — together**. Item 2 put a `kindHasRemovalOp` predicate in the walk;
that was one half of a pair living apart from the other. This item makes the pairing
data: every entry in `ELEMENT_KINDS` declares the ops that build it and the ops that
remove it, so the contract's "defined together" is enforced by where the code lives,
and both harnesses read one table.

Today's honest state, from the op union: **note** (`insertNote`/`insertPitchNote` ·
`deleteNote`), **tie** (`toggleTie` · `toggleTie`), **time-signature**
(`setTimeSignature` · —), **strings** (`setTuning` · —), **staff-kind**
(`setStaffKind` · —), **string-annotation** (`setFret` · —), **part-name**
(`addPart` · `removePart`). Seven kinds of forty-five have a construct verb; one has
a destruct verb. The asymmetry is the campaign's whole thesis, now visible as a
table rather than an argument.

### 2. Four tiers, and they are predictions

Per scenario, computed from the elements it contains:

| tier | meaning |
|---|---|
| `expected-unreachable` | invalid by design — the ops must never be able to author it |
| `blocked` | some element kind has no construct verb; the report names which |
| `ops-reachable` | every element kind present has a construct verb |
| `traced` | a committed trace replays from `{}` and matches the goldens — **the verdict** |

`traced` is not the top of a ladder the others climb: it is a different kind of
claim. A scenario can be `blocked` *and* `traced` (the clef case above), and that
pair is reported, never reconciled — it means the blocking element is invisible to
the goldens, which is exactly the sort of thing this campaign exists to discover.

### 3. Expected-unreachable is invalid-by-design ONLY

The campaign's contract names two candidate groups: the five
`expect.standard: invalid` spec-gap exhibits and the `renderer-gap` fixtures. Only
the first belongs here. An invalid document must stay unauthorable — that is a
statement about the ops, and if a verb ever produces one, the harness must fail. A
renderer gap is a statement about *drawing*: those documents are perfectly valid and
ought to be constructible; what they lack is ink, which the primitives verdict
handles on its own. Note the asymmetry with item 2, which needs **no**
expected-unreachable class at all — an invalid document's ink is still deletable.

### 4. The artifact mirrors item 2

`npm run sweep:construct` writes `harness/reports/construct-coverage.json`
(committed): per-scenario tier, the blocking-kind histogram that orders items 4–13,
and the disagreements. `npm test` fails on drift in either direction, so an item
that lands a construct verb shows up as scenarios moving `blocked` →
`ops-reachable`, and its traces as `ops-reachable` → `traced`. No new verdict
machinery: item 1's four assertions per trace are unchanged.

### 5. The bar is KIND coverage, not scenario coverage (decided 2026-08-15)

The item shipped without saying how much tracing the campaign owes, and the
number turned out to matter: 89 scenarios are ops-reachable and untraced, at a
median of 11 elements and **1,276 elements in total**. Existing traces run
11–52 intents, so "trace everything" is roughly 2,500–3,000 recorded intents —
a project, and precisely the front-loaded authoring push this item's scope
boundary already refused.

**The bar is the symmetric claim to item 2's.** The destruct sweep proves every
kind is *removable*, across the whole corpus. The construct side proves every
kind with a verb has been *built* at least once, from `{}`, through the
keyboard. `ELEMENT_KINDS` is already the shared denominator for both
directions, so the bar uses the same table rather than inventing a second
scoreboard.

It costs a sixth of the alternative. `traceCoverage` in the report computes it,
and the **queue** with it: a greedy cover weighted by *kinds gained per
element*, so the work list prefers small documents — **21 traces, 212
elements**, ordered, ties broken by id so the list is stable across runs.
Today: **38 kinds with a verb, 9 covered by the five existing traces, 29 to
go.**

Why per element and not per kind gained: a trace's cost is roughly its element
count, and `spec/tie-targets` buys five kinds at 35 elements while five small
scenarios buy the same five at 40 between them — but each is a shorter, more
readable performance, and a trace nobody can read is a fixture, not evidence.

The bar was **reported, not asserted**, while the queue drained: a hard
assertion before the work would have reddened the build for nobody's benefit.
**The queue emptied on 2026-08-15 and the bar is now an assertion** — 37 of 38
kinds built at least once from `{}`, the 38th (`staves`) waiting on
`core-entry-surface.md`, and a construct verb landing without a trace fails the
build from here on. That was this item's closing condition, and the
campaign's.

What it buys is also a better sentence than a percentage: *every verb this
campaign built has been driven from an empty document to a human-verified
scenario* beats *23% of scenarios traced*.

### 6. Kinds this campaign will not build name an OWNER (decided 2026-08-15)

Six kinds have no construct verb and are not going to get one here: `layout`,
`score`, `multimeasure-rest` ([core-layout-authoring.md](../proposed/core-layout-authoring.md))
and `kit-component`, `kit-note`, `sound`
([core-percussion-kit.md](../proposed/core-percussion-kit.md)). They block
seven scenarios.

**The tempting move is wrong.** Reclassifying them as `expected-unreachable`
would corrupt the one class whose meaning is load-bearing: decision 3 above
defines it as *invalid by design only* — "the ops must never be able to author
this". A layout document is perfectly valid and ought to be constructible one
day. Whatever the campaign decides about its own scope must not change what the
harness asserts about the schema.

So the cut is made by **naming an owner**. The tier stays `blocked` (no verb
exists — still true), and the row gains `deferredTo`. Two new tests keep it
honest: every deferred kind must name a roadmap doc that **exists on disk**, and
**nothing may be blocked without an owner** — a new verbless kind arriving
unowned fails the build rather than sitting in the report looking finished.

The two decisions interlock: the bar counts kinds *with* a verb (38), and the
deferral covers exactly the six without one. Nothing falls between them, and
`blocked: 7 · deferred: 7` says the campaign's own debt is zero.

## Scope boundary

This item ships the machinery, the report, and traces only for scenarios today's
verbs can already reach. **It does not author traces for the rest** — that is items
4–13's evidence, recorded through "copy trace" as each family lands, and pretending
otherwise would front-load an authoring push the campaign explicitly rejected.

The recording surface stays as item 1 left it: "copy trace" stamps a corpus scenario
id, so recording a construct trace from `{}` wants the new-document journey. Traces
added here are recorded test-first through `replayIntents`, as the exemplars were.

## What the build taught (2026-08-14)

**The first baseline: traced 2 · ops-reachable 1 · blocked 98 · expected-unreachable 5.**

- **One missing verb gates the corpus.** `clef` blocks **96 of 106 scenarios** — the
  next nine blockers together account for fewer. The campaign guessed as much when
  it wrote item 5's row ("gates ~all entry"); the histogram now proves it, and no
  other ordering argument survives that number. Runners-up: beam 10, barline 7,
  layout 6, repeat-end 6, score 6, section 6, direction 5, dynamic 5,
  key-signature 5.
- **Both disagreements between prediction and verdict actually happened**, in
  opposite directions, which is why they are reported rather than reconciled:
  - *Pessimistic*: `open-strings-chord` is `traced` **and** `blockedBy: [clef]`. The
    document declares a clef no verb can author; the engine draws the same default
    anyway, so the primitives verdict never sees it.
  - *Optimistic*: `empty-tab-canvas` is predicted `ops-reachable` and is **not
    traceable today**. Nothing to do with element kinds: `appendMeasure` materializes
    four explicit quarter rests (the full-bar invariant), while the hand-written
    template has a genuinely empty `content: []`. Those rests draw ink, so the
    primitives differ. The tier model is kind-shaped and structurally blind to op
    *semantics* — worth stating plainly rather than patching the model, because the
    fix belongs elsewhere (below).
- **Which empty bar is canonical is now an open question with evidence.** The model
  treats unentered positions as rests, and the corpus's own template writes none —
  yet `appendMeasure` writes four. Both are defensible; they are not both right. Item
  11 (rhythm model) inherits it, since that item already owns what an onset is.
- **The shared verb table found a second understatement.** Moving the op pair onto
  `ELEMENT_KINDS` made item 2's sweep read the same rows, and it immediately showed
  that `toggleTie` had always been a removal verb the sweep never attempted — ties
  were being reported as "no verb exists". Attempting them through their owning note
  turned 12 of 13 corpus ties into `removed`, all six oracles passing. **The table
  is now the single denominator for both directions**, which is what the contract's
  "defined together" was always for.
- **And it caught me overclaiming.** The first draft of the table gave `part-name` a
  removal verb (`removePart`). It does not have one: `removePart` removes an empty
  *part*, which is the container's verb, not the name's. The destruct report's drift
  test failed on the changed verdict within a minute of the refactor.

## Stages

1. The verb table on `ELEMENT_KINDS` (both directions), with `kindHasRemovalOp`
   reading it so item 2's sweep keeps its behaviour exactly.
2. The tier computation over the corpus + the blocking-kind histogram.
3. The report + `npm run sweep:construct` + the drift test, symmetric with
   `sweep:destruct`.
4. Traces for whatever the report says is `ops-reachable` and untraced — the
   machinery proving itself on real scenarios rather than on the two exemplars.
5. Learnings → the campaign log; the histogram becomes items 4–13's ordering
   evidence on the forward axis, beside item 2's per-kind counts on the reverse.

## Open questions

- Does a scenario's tier belong in the workbench (a column on `#/objects`, or a
  badge on the rail)? Deferred, as item 2 deferred its own view: the reports are the
  artifact, and a shell view is worth building once both axes stop moving weekly.
- Should `ops-reachable` distinguish "reachable but the trace would be absurd" (a
  40-note scenario is reachable one note at a time)? Proposed: no. Length is not a
  reachability question, and the trace is the honest cost.
