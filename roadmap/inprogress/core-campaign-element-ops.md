# Campaign: element ops — every corpus element constructible and destructible

> **The first campaign** (see CLAUDE.md → Conventions): this doc is an index over
> many normal proposals, the shared contract they follow, and the running log of
> progress and learnings as items land. Indexed items are ordinary `core-*` proposals
> that name this campaign; rows below without a link are undrafted.

## The goal

Two dual thought experiments over the scenario corpus, run as one program of work:

- **Constructibility**: starting from an empty score, can the keyboard alone take us
  to each of the 106 scenarios?
- **Destructibility**: given a scenario document, can every *individual* element be
  removed — surgical removal, no cheating with coarse ops (delete-measure/voice/part),
  everything else surviving byte-identically except forced cascades?

The 2026-08-11 gap analysis (learnings below) showed the bottleneck is not the keymap
but the **op vocabulary**: 12 `EditOp` types against ~40 distinct constructs in the
corpus, exactly **one** true removal op, and no genesis ops at all (nothing creates a
part or a clef — from a true empty document, zero scenarios are reachable; from the
`lab/00-document/02-empty-tab-canvas` template, roughly 6–10). Closing that gap is too
big for one proposal and too coherent to scatter: a campaign.

**Verdicts and traces (decided 2026-08-11).** The goal is a per-scenario *verdict* on
both axes for all 106, plus a replayable *trace* for every **reachable** scenario —
but the two axes earn them differently. Destructibility records no traces at all: the
sweep is generative (the walker enumerates and attempts each deletion at run time), so
full-corpus verdicts are free from day one and the durable artifact is the report.
Constructibility traces are **recorded, not hand-written** — play the scenario in the
workbench, "copy trace" (`harness/fixtures/edit-traces/`, the mechanism already
exists) — and **accumulate item by item**: each item's evidence is traces for the
scenarios it unlocks, so full coverage is the campaign's end state, never a standalone
authoring push. Exemplar-only coverage is rejected for the same reason the corpus
mirrors all 52 spec examples instead of sampling: the tail is where gaps hide, and
replayed traces are the edit layer's only regression surface at scale. Open question,
deferred until trace volume makes it real: intended semantic changes will break many
traces "correctly", which wants the golden treatment (a stale-vs-never-recorded
attention queue, per `verify-scenarios`) rather than a red build — and if maintenance
bites, the escape hatch is a trace synthesizer (doc → intents, the planner inverse of
`applyOp`) regenerating traces the way `update:primitives` regenerates goldens.

Every item serves the same convergence [core-editor-ai-prompt.md](../proposed/core-editor-ai-prompt.md)
already names: the assist loop emitting `EditOp[]` through `applyOp`. An op lands for
the AI loop the moment it exists; its key can bind later. Removal verbs arguably come
first — corpus documents arrive history-less, so undo can never remove anything from a
loaded score, and missing deletes are why assist must rewrite whole documents today.

## The shared contract

**No item writes code before its agreement block is written down.** Each indexed
proposal opens with, and is reviewed on:

1. **The op pair** — the construct op and its destruct op, defined together. Removal
   is not creation reversed: the destruct half must name its **removal class** —
   *ink* (→ rest, grid preserved), *inherited attribute* (→ revert to predecessor's
   governance: time/key/clef), *annotation* (strip the key — **no tombstones**: no
   `staffPosition: 0` residue, no orphaned minted ids), *reference* (unlink **both**
   ends — no dangling `ties[].target`, `slurs[].startNote/endNote`, technique
   `target`s), or *container* (what happens to children).
2. **The shortcut** — the physical key (`KeyboardEvent.code`, per the keymap's
   decided discipline), or the explicit verdict that the element is popover-tier
   (Shift+letter typed grammar) or palette-tier instead. Free-key budget is shared
   across the campaign; claims are recorded here in the index so items don't collide.
3. **The rung** — which selection-ladder level(s) the ops attach to, decided with the
   [core-selection-ladder.md](core-selection-ladder.md) per-level review
   (its navigation map and this campaign are two halves of one set of decisions), and
   landed as `KeyDoc` rows in `src/edit/keymapDocs.ts` in the same change so the
   cheatsheet joins ([core-keymap-cheatsheet.md](core-keymap-cheatsheet.md)
   stage 4) keep it honest.
4. **The evidence** — which scenarios the item unlocks, proven by the campaign's two
   harnesses: the constructibility trace (replay from empty, judge against the
   committed `expected.primitives.json` — byte equality of `score.mnx.json` is the
   wrong oracle: mirrors carry no ids, ties mint them) and the destructibility sweep
   (op applies, no *new* diagnostics, undo restores byte-identically — the oracle the
   session already guarantees). Goldens stay byte-identical throughout, as always.

Deliberately out of contract: scenarios *supposed* to be unreachable
(`lab/24-tab-spec-gaps/*`, `renderer-gap` fixtures) — the harnesses need an
expected-unreachable class mirroring those tags, not ops that can author invalid
documents.

## The index

An exemplar first — the algorithm proven small before the corpus commits to it —
then the harnesses, then families ordered by scenarios unlocked. "Keys" records
agreed or candidate claims; **bold** = agreed.

| # | Item | Scope | Unlocks | Keys / tier | Rung | Status |
|---|------|-------|---------|-------------|------|--------|
| 1 | [exemplar](../complete/core-element-ops-exemplar.md) | Both harness halves built end-to-end over two simple scenarios (`minimal-single-note`, `open-strings-chord`). Start is **decided: the literal `{}`** — so the campaign's first new ops are the genesis verbs (`addPart`, skeleton-on-demand; score rung, setup tier) and the session is hardened for zero parts/measures. Settles key normalization; adds the **op-queue panel** (side-panel ops tab: `appliedOps` as a visible undo/redo queue) so command sequences can be read and reviewed. | the algorithm + genesis ops + 2 traced scenarios | **Shift+P** part popover; staffKind: palette | **score** | **complete 2026-08-14** |
| 2 | [destructibility sweep](../proposed/core-element-ops-destruct-sweep.md) | Item 1's reverse walk scaled corpus-wide: element walker per kind (noteKeys generalized), attempt address+delete per element; oracles: applies / no new diagnostics / no dangling references / undo byte-identical, **widened** (relative validity, references past ties, a surviving-document check). No trace fixtures — the walk regenerates each run; the report is the artifact. Doubles as ladder addressability audit. Fix the `deleteNote` dangling-reference bug it will catch. | verdicts for all 106 | n/a | n/a | **drafted 2026-08-14** |
| 3 | constructibility traces | Item 1's forward harness scaled: the construct-fixture kind + per-scenario tiers (unreachable → ops-reachable → keyboard-reachable → traced) + the expected-unreachable class. Traces themselves arrive with items 4–13 (recorded via "copy trace", never hand-written); possible workbench coverage map later. Inherits item 1's parked **recording surface** question: "copy trace" stamps a corpus scenario id as the start, so recording from `{}` wants the new-document journey — and with it, the ops tab on non-scenario (IndexedDB) documents. | verdict machinery for all 106; traces accumulate per item | n/a | n/a | undrafted |
| 4 | duration completion | Dots (op already accepts `dots?` — cheapest unlock), capo (read but unwritable), time `display: common\|cut`. | ~10 | dot: single key (`.` candidate); capo/display: popover grammar | event / setup | undrafted |
| 5 | clef & key signature | Set/change/remove ops; session already *reads* both (`clefAt`, `keyFifthsAt`) for entry. Inherited-attribute removal class. | gates ~all entry; F-clef + 5 key-sig scenarios | popover tier (Shift+letter) | measure | undrafted |
| 6 | accidental spelling | Flats (natural-then-sharp policy makes E♭ unwritable), enharmonic respell, `accidentalDisplay`/parentheses. | 9+ | respell: single key | note | undrafted |
| 7 | bar-attribute family | Barlines, repeats, endings, segno/jump/fine, sections, rehearsal, tempo — one typed-popover family on the global measure. | ~20 | popover tier | measure | undrafted |
| 8 | event adornments | Articulations/markings, dynamics, directions. | ~14 | adornment alphabet (letter keys) | note/event | undrafted |
| 9 | tab technique alphabet | Bends, slides, hammer/pull, vibrato, palm mute, harmonics — the `B H S V X O` set `keymapDocs.ts` already reserves. Entry side of [core-guitar-technique.md](../proposed/core-guitar-technique.md) (which owns rendering). | 5 | **B H S V X O** (reserved) | note | undrafted |
| 10 | spanners | Slurs; tie variants (`crossVoice`, `lv`, `arpeggio`). Needs the two-ended target gesture; reference removal class. | 4 | S candidate (collides with slide — resolve here) | note→note | undrafted |
| 11 | rhythm model | Tuplets, grace notes, tremolo, `space`, full-measure/multimeasure rests, measure repeats. Changes what an onset is (cursor grid, `eventAtOnset`). Entry side of [core-tuplets-grace-notes.md](../proposed/core-tuplets-grace-notes.md) (converters/tab). | ~12 | t.b.d. per sub-family | event | undrafted |
| 12 | text entry | Lyrics, part names, verse labels — a text *mode* that suspends the keymap, not a binding. | ~8 | Enter-into-text candidate | event / part | undrafted |
| 13 | structural surface | Voices beyond 0, parts beyond `parts[0]`, staves beyond 1 (first-part genesis lands with item 1; this item owns the *second* of everything). The entry-surface ceiling — likely several proposals; the ladder can already *visit* voices it cannot create. | ~15 | t.b.d. | voice/part rungs | undrafted |

Beyond the campaign (recorded, not indexed): layout documents (`spec/orchestral-layout`
et al are layout-only, zero measures — a different surface, not keys), percussion kit,
transposition, harmonies rendering ([core-chord-symbols.md](../proposed/core-chord-symbols.md)).

## Progress + learnings

- **2026-08-14 — item 1 closed; what items 2–3 inherit.** The exemplar moves to
  `complete/`. The pieces it settled are now campaign rules, and its v0
  shortcuts are item 2's opening punch list rather than debt to rediscover:
  - **The walker interface** is three exported functions in `src/edit/destructWalk.ts`
    — `elementKeys(doc) → string[]`, `driveToElement(session, key) → boolean`,
    `runDestructWalk(session) → {deleted, unaddressed}`. Two rules are
    load-bearing and item 2 keeps both: addressing goes through **navigation
    intents only** (the grid is read to aim, never to teleport — that is what
    makes the sweep an addressability audit), and the key list is **recomputed
    after every deletion** (positional keys shift as chord siblings go).
    Elements the cursor cannot reach are recorded, never skipped.
  - **v0's deliberate limits, now item 2's work list**: the walker sees keyed
    notes of `parts[0]`/staff 1 only; the dangling-reference oracle scans
    `ties[].target` alone and has therefore never fired (no exemplar has an
    inbound reference — the `deleteNote` bug remains uncaught **as designed**,
    waiting for `spec/ties`); `unaddressed` findings surface in the console,
    where item 2's report replaces them; and the two-order commute check has
    only ever met chord members, never voices or parts.
  - **The panel button IS the sweep** — one implementation, so a corpus-wide
    finding is reproducible by hand on the scenario page. Item 2 should keep
    that property when the walk grows a report: the report is the harness's
    rendering of the walk, not a second walk.
  - **The exemplar's own oracle set transfers unchanged**: applies · still
    schema-valid · no *new* diagnostics beyond the loaded doc's baseline · no
    dangling references · undo-all byte-identical. Nothing in it was
    exemplar-specific, which is the evidence that the algorithm is corpus-ready.
  - Two threads forwarded rather than dropped: the ops tab on non-scenario
    documents rides item 3's recording surface (indexed on its row), and
    "an empty part draws nothing" is recorded in
    [core-selection-ladder.md](core-selection-ladder.md) as ghost-vocabulary
    work (corpus-neutral — no scenario is measureless).
- **2026-08-14 — destruct tears down to `{}` (revision, stage-5 feedback).**
  The "ink-free terminal" read as principled asymmetry but conflated two
  things: the anti-cheat rule forbids destroying *ink through* a container,
  not removing an *empty* container — an empty bar's deletion destroys only
  itself. Refined rule: **a container is removable only once it is empty**;
  cascades never delete notes. Landed as guarded `removeMeasure`/`removePart`
  ops, the skeleton dissolving in reverse symmetry with skeleton-on-demand
  (`{}` when no parts and no measures remain — no tombstones), and Del
  gaining its upper-rung meanings (measure rung: the empty bar; score rung:
  the empty part, then trailing bars) — the ladder's polymorphic delete,
  keyboard-reachable through the existing binding. The round trip now closes:
  `{}` →construct→ score →destruct→ `{}`, byte-identical undo-all both ways,
  asserted by the sweep. The walk lives in `src/edit/destructWalk.ts`, shared
  verbatim by the harness and the ops panel's button.
- **2026-08-12 — exemplar stages 1–4 built** (the campaign's first landing; the
  campaign moves to `inprogress/` with it). What the build taught:
  - **`tab.staffKind` is document data, not view state**: it gates the tab/both
    projections in `engine/headless.ts`, so the goldens see it — a `setStaffKind`
    op was added (palette-tier) the moment the chord verdict failed without it.
    The "is it invisible to the ink verdict?" open question died in an hour of
    contact with the harness — exactly what the exemplar was for.
  - **The engine's default clef for a tab part IS the guitar treble-8**, so a
    clef-less trace-built doc renders identically to the scenario that declares
    it. Doc-delta shows the clef; primitives don't. Item 5 (clef & key sig) is
    about clef-*bearing* notation scenarios, not tab.
  - **`minimal-single-note` replays byte-identical** — not just primitives-equal
    — from `{}` in 11 intents / 5 ops. `open-strings-chord`: primitives-equal,
    doc delta = its note ids + the clef above (24 intents / 13 ops).
  - **Key normalization**: map real ids → positional keys on BOTH sides of the
    primitives compare (`sourceId` fields; golden side has ids, replay side may
    mint them via ties later). Items 2–3 inherit this rule.
  - **Construct fixtures are their own kind** (`harness/fixtures/construct-traces/`,
    `{target, intents}`): no inline expectations — the goldens are the oracle, so
    there is nothing for an update mode to write, unlike edit-traces.
  - The dangling-reference oracle is in the sweep but untested by these
    exemplars (no inbound refs) — the `deleteNote` bug remains for item 2's
    corpus-wide run to catch, as designed.
- **2026-08-12 — what layer do traces test? Intents, plus a static keyboard join.**
  Raised when genesis entered scope (score creation needs UI, not chords): traces
  were never keys (the input layer's standing rule — intents survive rebinding) and
  are not ops (navigation is in the trace, absent from the op log). The replay
  proves intent-reachability; a new static **keyboard join** (every intent type in
  a trace ↔ a binding or a documented popover/palette surface) proves
  keyboard-reachability — making that tier machine-checked, not assumed. Key-level
  proof is the emulation-preset completeness test, deliberately deferred to that
  work.
- **2026-08-12 — construct traces start from the literal `{}`** (decided in item 1).
  No blank scenario, no per-family templates: every trace builds its own scaffolding,
  pulling document genesis into the op funnel — undoable, traceable, and the assist
  loop gains authoring-from-nothing the day the ops exist. Genesis verbs are
  setup-tier and attach at the **score rung** (the rung that was honestly
  near-empty gets its verbs). The asymmetry is deliberate: destruct still terminates
  at ink-free, not `{}` — scaffolding teardown is the excluded coarse-op territory.
  Recording consequence: the workbench's *new-document* journey becomes the
  recording surface for construct traces (test-first until it lands).
  *(The "destruct stops at ink-free" clause below was superseded the same
  day — see the teardown entry above.)*
- **2026-08-11 — campaign opened** from the constructibility/destructibility gap
  analysis. Findings that shaped the contract:
  - The keymap has spare keys; the op union is the constraint. Ranking by
    scenario-unlock count beats taste for ordering.
  - Creation and removal are asymmetric: `setTimeSignature`/`setTuning` can overwrite
    but never *un-declare*; `setFret` annotates but nothing strips; `nudgeRest` back
    to center writes a `staffPosition: 0` tombstone; `toggleTie` mints ids that
    removal leaves behind. Hence the removal-class taxonomy in the contract.
  - `deleteNote` splices the note without scanning inbound references — delete the
    second note of `spec/ties` and the first note's tie dangles. Latent today; the
    sweep (item 1) is designed to catch exactly this class.
  - Rests are indestructible *by design* (§8.11: a rest is absence, not an element) —
    the walker must enumerate ink, not JSON nodes; granularity is fractal (bend
    points, ending numbers, syllables), so "element = anything the renderer draws
    distinguishable ink for".
  - Both oracles already exist in the repo: primitives goldens for construct,
    byte-identical undo-all for destruct. Neither harness needs new verdict machinery.
