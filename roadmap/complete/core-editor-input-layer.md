# The editor input layer — intents, traces, and a testable MVP

> **Status: complete 2026-08-09. Phases 1 AND 2 built 2026-08-03** — intents + declarative
> keymap (`src/edit/intents.ts`, `keymap.ts`), position cursor with string-mode
> vertical axis and entry ghosts (`cursor.ts`), session with note entry, digit
> combining and pending entry duration (`session.ts`), ops incl. `insertNote` /
> `deleteNote` / `setDuration` / `setTimeSignature` / `setTuning` (`ops.ts`),
> op-retaining `EditHistory`, trace fixtures with replay test
> (`harness/fixtures/edit-traces/`, `npm run update:edit-traces`), the
> `lab/document/empty-tab-canvas` template scenario, the from-scratch flagship
> trace, and the scenario-page mount (edit strip, per-note cursor highlight, copy
> trace). **Setup popovers shipped** (Shift+T time signature, Shift+U tuning —
> typed grammar in `src/edit/setupGrammar.ts`, shell-action table in `keymap.ts`
> so the keymap stays the sole KeyboardEvent interpreter; popovers emit the setup
> INTENTS, so traces record them). **Rests & ties shipped** per the survey's
> §8.11 model: no rest key — ops maintain the **full-bar invariant** (a touched
> measure always sums to its meter; unentered positions ARE beat rests, entry
> converts them), `Alt+↑↓` is the polymorphic vertical verb (pitch on a note,
> `staffPosition` on a rest), `T` toggles a tie to the next same-pitch event
> (minting deterministic target ids), and `Alt+←→` is duration's primary
> binding with `-`/`=` as the alias. **Command palette shipped**
> (`src/workbench/CommandPalette.ts`): one widget, two entry points — `Ctrl+K`
> prefills the `>` command prefix, `Ctrl+G` opens bare go-to — with one
> grammar shared with the rail filter (`matchesQuery`): bar numbers move the
> cursor via a `goToMeasure` NAVIGATION INTENT (traceable, clamped), `def:`
> opens the coverage map, anything else jumps to a scenario; command items
> feed the session through the same intent funnel as keys. The **AI prompt
> mode** is split out to
> [roadmap/proposed/core-editor-ai-prompt.md](../proposed/core-editor-ai-prompt.md), and
> the one item that outlived this doc — the **`elements/` promotion**, gated on
> the intent vocabulary stabilising and a real second consumer — is split out to
> [roadmap/proposed/core-editor-element-promotion.md](../proposed/core-editor-element-promotion.md)
> with its own trigger and brief. The keybinding research behind it is
> [research/notation-editor-keyboard-models.md](../../research/notation-editor-keyboard-models.md)
> (the survey, and §6 for its MNX Lab implications). The input layer is expected to stay
> **experimental for a while** — this design's job is to make that churn cheap.

## The relationship being committed to

The editor **edits the data model; the renderer reacts**. The repo has already half-said
this — the [src/edit/ops.ts](../../src/edit/ops.ts) header names `applyOp` as the seam
the editor UI and the AI loop converge on — and this doc commits to the rest:

```
document → layout → (SVG + geometry) → input interpretation → EditOp → new document
```

One-directional, every arrow a pure function. The coupling between editor and renderer
is real but flows one way and concerns **input interpretation only**: the editor
consumes layout primitives (hit-testing, caret placement, traversal order) and the
`model/noteKeys.ts` identity — the same machinery the note↔JSON cross-highlight already
uses — but its *output* is only `EditOp`s against the model. The cursor and selection
render as an **overlay keyed by note keys**; the renderer never learns about editor
state. This is also what keeps the goldens safe: `expected.primitives.json` must never
depend on session state.

## The three-stage split (where brittleness goes to die)

Keystroke→JSON tests would be brittle *only* because the keymap is experimental. Split
the input layer into its three natural stages and the churn is quarantined in stage 1:

1. **Keymap: `KeyboardEvent` → intent** (`nextNote`, `setFret(7)`, `toggleVibrato`…).
   A **declarative binding table** — data, not `keydown` switches — which is also what
   emulation presets ("Like Guitar Pro", survey §6.2) require later. Rebinding a key
   changes only this table and its mechanical key-in/intent-out tests. The
   `KeyboardEvent.code` vs `.key` decision (survey §6.3) is made here, once, before the
   first binding.
2. **Editor state machine: intent + (doc, selection) → `EditOp[]` + new selection.**
   The real logic. All fixtures are written **in terms of intents, never keys**, so they
   survive every rebinding and every preset. Selection is a first-class *output*: the
   "bare arrows never mutate" rule (survey §3.2) is only testable if fixtures assert the
   expected selection, not just the JSON.
3. **`applyOp`: op → doc.** Already pure, already pinned by
   [harness/conformance/edit-ops.test.ts](../../harness/conformance/edit-ops.test.ts).

The intent vocabulary will stabilise long before the bindings do — that is the survey's
own finding, and the entire reason emulation presets exist in the field.

## The cursor is a position, not a note — decided up front

A `noteKeys`-based cursor can only stand *on notes* — but note entry requires standing
on rhythmic positions where nothing exists yet, and an empty measure has no note keys at
all, so a from-scratch document would be unnavigable. Therefore the cursor is
**(measure, rhythmic position, string/staff-line) with an optional resolved note**, not
a note id. `noteKeys` remains the identity bridge for resolved notes (and the highlight
overlay), but traversal walks the beat grid, not the note list. This is decided now, in
phase 1, because the trace fixtures' `expect.selection` shape depends on it — the one
part of the fixture format you do not want to migrate after recordings exist.

## Traces: fixtures that are also recordings

**Not** a second scenario corpus. The render corpus's machinery (meta status,
`verification` provenance, the attention queue, `/verify`) exists because render
correctness is a *human aesthetic judgment* that goes stale. An edit trace is fully
machine-checkable — vitest is the whole jury — so it gets none of that ceremony and
stays out of `scenarios/` ("one corpus format, two axes" holds).

A trace fixture lives at `harness/fixtures/edit-traces/<name>.json` and contains:

- **`scenario`** — the starting document, *by corpus scenario id* (the corpus is the
  score library; never copy scores into fixtures — the existing edit-ops test already
  loads `scenarios/lab/00-document/01-minimal-single-note` this way);
- **`intents`** — the intent list (optionally with the raw key log alongside as
  provenance, never as the thing replayed);
- **`expect`** — final document + final selection.

Replay test (`harness/conformance/edit-traces.test.ts`): replay intents from the base
scenario, assert final doc + selection, assert the final doc is **schema-valid** (the
precompiled validators in `worker/generated/` are importable from any layer — a trace
that mutates a document into invalidity must fail loudly), and assert **undo-all
returns the initial document byte-identically** — the determinism invariant that makes
recording trustworthy.

The one idea borrowed from the goldens is the update script: when ops legitimately
change behavior, `npm run update:edit-traces` regenerates expected docs and **git diff
is the review** — JSON doc diffs are human-readable in a way SVG never was, so the
honesty mechanism arrives without a queue.

**Recording is the same stream as undo.** Prerequisite refactor, done before anything
grows on top: `EditHistory` ([src/edit/ops.ts](../../src/edit/ops.ts)) currently
snapshots whole documents; change it to **retain the ops it applied**. Then undo
history, replay fixtures, and the AI loop's future `EditOp[]` output are three consumers
of one log, and the recorder is just serialisation. Capture mechanism, fully consistent
with git-as-database: a **"copy trace" button** puts the trace JSON on the clipboard;
the human pastes it into `harness/fixtures/edit-traces/` and commits. No dev
middleware, no write API, no backend.

## Where the code lives — incubate in `workbench/`, promote later

The layer order says `engine · audio · model → elements` — **`elements/` may not import
`edit/` today**. Rather than change that boundary while the input layer is experimental,
the editor surface **incubates in `workbench/`** (workbench-only), and the move into
`elements/` — which is what makes it consumable by studio and the embed face — happens
as the deliberate, reviewed *promotion* the repo already prescribes, when the intent
vocabulary has stabilised. This answers the survey's own open question (§6.3, review
keymap in `workbench/` or `elements/`): `workbench/` now, `elements/` when stable, and the
dependency-cruiser change is part of that promotion review. Stages 1–2 are DOM-free
pure modules regardless (candidates: keymap table + `selection.ts` beside `ops.ts` in
`edit/`), so the promotion moves mount-point code, not logic.

Edits in the workbench are **in-memory only** with undo — the workbench has no backend
by rule, and this is a bench for testing the *editor*, not for authoring corpus files.

## Phase 1 — the loop, demoably

Deliberately narrow: phase 1 proves the architecture loop with the three ops that
already exist; it is **not yet an editor** (no note entry — that is phase 2, named and
scoped below, not an afterthought). Open any scenario in the workbench, then:

1. arrows walk the beat grid with a **visible cursor in both notation and tab panes**
   (position-based cursor as above; resolved notes highlight via the cross-highlight
   overlay);
2. `Esc` and `/` behave per the survey's §6.1 review keymap;
3. in the tab pane, **digits set the fret** on the note under the cursor; a key
   transposes (`transposeSelection`, `setFret`, `appendMeasure` become the first
   mutating intents);
4. `Ctrl+Z` / `Ctrl+Y` undo/redo through `EditHistory`;
5. **"copy trace"** yields JSON that, pasted into `harness/fixtures/edit-traces/`,
   `npm test` replays forever after.

That is the whole loop — input layer, state machine, ops funnel, undo, record, replay —
each piece in its final architectural position, with nothing thrown away when the
keymap churns, because every fixture is written in intents.

One layering rule from the survey (§6.1) is load-bearing for steps 2–3 coexisting and
is adopted here: **digits are a sense-3 layer owned by the active pane** — views in the
review shell, frets in a tab pane, durations in a notation pane. Deciding that now
costs nothing; retrofitting it re-binds everything.

Two behaviors settled by first hands-on testing (2026-08-03):

- **The note stack is ordered visually, top line first** — annotated string
  ascending (string 1 = the top tab line, printed-tab convention), pitch as
  tie-break — never document order, which typically runs low→high and makes
  the Down arrow walk *up* the page. `nextNote` = Down = down.
- **A digit keeps the note's line.** On an unannotated note, `setFret` derives
  the string from pitch + tuning (`src/edit/tabStrings.ts`, a small echo of
  the engine's lowest-reasonable-position heuristic, which `edit/` may not
  import) — so the digit lands where the renderer was already drawing the
  note instead of defaulting to string 1. Cursor-owned string choice (up/down
  = strings in the tab pane) remains phase 2.

The selection highlight is **per note**, not per event, in both layouts — the
cursor must stay visible inside a chord. (Shared geometry — stem, ledger
lines — still highlights at event level.)

Build order (each step useful even if the next stalls):

1. Intent vocabulary + declarative keymap table (navigation-only intents first —
   survey §6.1: review is pure sense-0, so no key mutates and the keymap discipline is
   established at zero risk).
2. Selection/cursor state machine over the position cursor; cursor overlay in the
   scenario page.
3. Enable the three mutating intents; in-memory doc + undo in the scenario page.
4. `EditHistory` retains ops; "copy trace" button.
5. Trace replay test + `update:edit-traces` script.

## Phase 2 — entry & genesis (what makes it an editor)

The core tab-entry loop, and the answer to "can I start from scratch". Two decisions
made here rather than discovered later:

- **Setup is ops, not chrome.** Instrument, tuning, capo, time signature, key, tempo
  are document mutations like any other — they join the `EditOp` union (`setTuning`,
  `setTimeSignature`, …) and flow through the same funnel, so they are undoable,
  traceable, and (later) AI-emittable for free. No parallel "document properties"
  side-channel that bypasses `applyOp`.
- **Setup gets no single keys.** The survey's economics: frequency buys keys — technique
  is constant, setup happens once per document. Setup's keyboard story is the
  **palette/popover tier** (Dorico's `Shift+`letter popovers, which §6.2 already maps
  onto the `_x.mnxLab` domains), so from-scratch authoring is fully keyboard-drivable
  without burning the scarce single-key budget.

The work:

1. **Note entry and deletion** — the loop phase 1 dodges: standing on an empty beat and
   typing a digit *creates* the note on the current string (the Guitar Pro muscle
   memory users arrive with, survey §3.4); `Delete` removes it; two-digit frets by the
   double-tap disambiguator (§6.2). Ops: `insertNote`, `deleteNote`.
2. **Duration** — `setDuration` op; `-`/`=` per the survey's unanimous finding (§3.3),
   as the notation pane's digit-layer complement.
3. **Setup ops** — the union entries above, reachable through the palette/popovers.
4. **An empty/minimal template as a lab corpus scenario** (the existing `00-document`
   category) — traces reference starting documents by scenario id, so the empty
   document must be one; it gets render goldens as a bonus.
5. **The flagship trace**: empty template → set tuning → set time signature → enter
   four bars → expected doc. One recording exercising the entire vocabulary — the
   integration fixture everything else is a slice of.

## Not this (non-goals, both phases)

- **No persistence of edits** — in-memory only; IndexedDB documents and anything
  cloud-shaped stay with studio's seams.
- **No editor element in `elements/`** yet — that is the post-stabilisation promotion.
- **No emulation presets** — the declarative table merely keeps them nearly free later.
- **No single-key bindings for setup** — palette/popovers only, per the frequency rule.
- **No keyboard instruments / grand staff** — guitar-first, per charter; the instrument
  generalisation argument lives in
  [spec-instrument-position.md](../proposed/spec-instrument-position.md), not here.
- **No keystroke-level goldens, ever** — fixtures are intents; keys are tested only in
  the keymap table's own tiny tests.
- **No AI-loop convergence yet** — the worker loop still replaces whole documents; it
  emitting `EditOp[]` through this same funnel is the big later payoff, and nothing in
  the MVP needs it.
- **No new scenario axis or verify machinery** — traces are deterministic harness
  fixtures, full stop.

## Open questions

- Intent naming/versioning: when an intent's *meaning* changes (not its binding), do old
  traces get migrated (like `upgradeTabExtension`) or re-recorded? Cheap to defer while
  traces are few; decide before recording anything precious.
- Range and multi-selection (measures, passages — survey §3.11 says selection is where
  deep modality hides): the position cursor is decided; when ranges arrive and what
  their `expect.selection` shape is in traces is not.
- Where exactly the geometry index for hit-testing/caret placement lives — a derived
  view over primitives in `engine/`, or computed in the mount layer. (Traversal needs no
  geometry; only mouse hit-testing and caret drawing do, so this can trail the MVP.)
- The shadow-DOM focus story (survey §6.3) — contained for now to the one thin smoke
  test the real components get; stages 1–2 stay DOM-free in root vitest.
