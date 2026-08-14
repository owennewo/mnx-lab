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
| 2 | [destructibility sweep](core-element-ops-destruct-sweep.md) | Item 1's reverse walk scaled corpus-wide: element walker per kind (noteKeys generalized), attempt address+delete per element; oracles: applies / no new diagnostics / no dangling references / undo byte-identical, **widened** (relative validity, references past ties, a surviving-document check). No trace fixtures — the walk regenerates each run; the report is the artifact. Doubles as ladder addressability audit. Fix the `deleteNote` dangling-reference bug it will catch. | verdicts for all 106 | n/a | n/a | **built 2026-08-14** |
| 3 | [constructibility traces](core-element-ops-construct-traces.md) | Item 1's forward harness scaled: the construct-fixture kind + per-scenario tiers (unreachable → ops-reachable → keyboard-reachable → traced) + the expected-unreachable class. Traces themselves arrive with items 4–13 (recorded via "copy trace", never hand-written); possible workbench coverage map later. Inherits item 1's parked **recording surface** question: "copy trace" stamps a corpus scenario id as the start, so recording from `{}` wants the new-document journey — and with it, the ops tab on non-scenario (IndexedDB) documents. | verdict machinery for all 106; traces accumulate per item | n/a | n/a | **built 2026-08-14** |
| 4 | duration completion | Dots (op already accepts `dots?` — cheapest unlock), capo (read but unwritable), time `display: common\|cut`. | ~10 | dot: single key (`.` candidate); capo/display: popover grammar | event / setup | undrafted |
| 5 | [clef, key & time](core-element-ops-clef-key.md) | Set/change/remove ops; session already *reads* both (`clefAt`, `keyFifthsAt`) for entry. Inherited-attribute removal class; `inherit` is the removal token. | **22 scenarios reachable** (from 1); 101 clefs + 6 key sigs + 95 time sigs removable | **Shift+C** clef, **Shift+K** key | **measure** | **built 2026-08-14** |
| 6 | accidental spelling | Flats (natural-then-sharp policy makes E♭ unwritable), enharmonic respell, `accidentalDisplay`/parentheses. | 9+ | respell: single key | note | undrafted |
| 7 | [bar-attribute family](core-element-ops-bar-attributes.md) | Barlines, repeats, endings, segno/jump/fine, sections, rehearsal, tempo — one typed-popover family on the global measure. ONE op pair for ten kinds; `no <attribute>` strips. | **18 scenarios** (reachable 24 → 42); 56 elements removable | **Shift+B** | **measure** | **built 2026-08-14** |
| 8 | [event adornments](core-element-ops-adornments.md) | Articulations/markings, dynamics, directions — **two** op pairs, because markings are owned by the event and the other two by the part measure. | 13 (reachable 55 → 68); 70 elements | **Shift+A** popover (letter accelerators deferred) | **note/event** | **built 2026-08-14** |
| 9 | [tab technique alphabet](core-element-ops-technique.md) | Bends, slides, hammer/pull, vibrato, palm mute, harmonics — the `B H S V X O` set `keymapDocs.ts` already reserves. Entry side of [core-guitar-technique.md](../proposed/core-guitar-technique.md) (which owns rendering). | 7 (reachable 71 → 78); +fingering | **B H S V X O** — live only in the tab pane layer, so B/S are polymorphic with beam/slur | **note** | **built 2026-08-14** |
| 10 | [spanners](core-element-ops-spanners.md) | Slurs; tie variants (`crossVoice`, `lv`, `arpeggio`). The two-ended **anchor gesture** (press, navigate, press); reference removal class. | 3 (reachable 42 → 45) | **S**, polymorphic by projection: slur in notation, slide in tab (resolves item 9's collision) | **note→note** | **built 2026-08-14** |
| 11 | [rhythm declarations](core-element-ops-rhythm-declarations.md) | **Split at build time**: this item takes the declarations that leave ink where it is — beams (top level), full-measure rests, measure repeats. Beams reuse item 10's anchor at event→event. | 10 (reachable 45 → 55); 22 elements | **B**, polymorphic (beam in notation, bend in tab); rests via the bar popover | **measure**, **event→event** | **built 2026-08-14** |
| 11b | [onset granularity + container descent](core-element-ops-onset-granularity.md) **(built)**; wrap verbs & rest spelling open | The half item 11 deferred, with evidence: tuplets, grace, tremolo, `space`. The cursor grid skips non-timed items, so container content is unaddressable — and the same gap stops a plain run of 32nds being entered. Owns `eventAtOnset`/grid descent first, verbs second. Entry side of [core-tuplets-grace-notes.md](../proposed/core-tuplets-grace-notes.md). | 32 notes addressable | t.b.d. | event | **granularity + descent built 2026-08-14**; wrap verbs + rest spelling open |
| 12 | [lyrics](core-element-ops-lyrics.md) | Lyrics, part names, verse labels — a text *mode* that suspends the keymap, not a binding. | 4 (reachable 78 → 82); 34 elements | **Shift+L** popover — the text *mode* is rejected, see the doc | **note / score** | **built 2026-08-14** |
| 13 | [part declarations](core-element-ops-part-declarations.md) | **Split at build time**: the five keys on `parts[0]` (name, strings, capo, staffKind, staves) get the removal halves their genesis verbs never had, plus constructors for capo and staves. | 2 (reachable 68 → 71); 91 elements | **Shift+P** popover (`capo 3`, `no strings`) | **score** | **built 2026-08-14** |
| 13b | [part addressing](core-element-ops-part-addressing.md) **(built)**; entry + staff 2 open | Voices beyond 0, parts beyond `parts[0]`, staves beyond 1 — plus `layout`, `score` and multimeasure rests (a layout is a tree, a score a presentation; neither is a declaration). **Note the cost**: the ops layer hard-codes `parts[0]` in `findKeyedNote`/`buildGrid`/the note-key traversal, so this changes note keys — which the primitives goldens embed. A corpus re-verification event, not a refactor. The entry-surface ceiling — likely several proposals; the ladder can already *visit* voices it cannot create. | ~15 | t.b.d. | voice/part rungs | undrafted |

Beyond the campaign (recorded, not indexed): layout documents (`spec/orchestral-layout`
et al are layout-only, zero measures — a different surface, not keys), percussion kit,
transposition, harmonies rendering ([core-chord-symbols.md](../proposed/core-chord-symbols.md)).

## Progress + learnings

- **2026-08-14 — nested beams, and the identity oracle they exposed.** The
  report said 26 beams were unremovable; the cause was not second parts but
  **nested levels (17)** — subdivisions and hooks. `removeBeam` takes a path
  now, and the beam key **peels from the inside out**: deepest first, so a
  press walks the 32nd level, then the 16th, then the primary, rather than
  deleting a grouping the player can see and did not aim at.
  - **The sweep was counting a false success.** Peeling changes the document
    while leaving the OUTER beam — the element actually aimed at — in place, and
    the old oracles (doc changed, no dangling refs, undo restores) all passed.
    The oracle set gained an **identity check**: after a removal, the value at
    the element's own path must have changed, else the verdict is `refused`.
    Every kind gets it. **"The document changed" was never the same claim as
    "this element went"** — the same class of error as item 2's wrong-note
    deletion, this time caught by construction rather than by luck.
  - **Beams 15 → 32 removed; corpus 1,333 → 1,351.** The remaining eight are
    staff 2 and beams whose first event sits inside a grace container.

- **2026-08-14 — 13b's addressing half: the cursor learns there is more than one part.**
  Measured first: `parts[0]` was hard-coded in **44 places**, splitting into
  ~10 addressing sites and ~25 writing sites. Removal was already part-agnostic
  (it resolves through the shared walk), so the addressing half alone unlocks
  the blocked set — and the writing half can follow without either being
  half-done. **Removable 1,218 → 1,333**; notes 672 → 772, part-names 46 → 59,
  unaddressable-with-a-verb 183 → 68.
  - **The key grammar generalized without moving a byte**: part 0 and staff 1
    stay silent in the key, because they were the whole world when the scheme
    was written. Every key the goldens embed is unchanged; only new ones appear.
  - **Voices are counted per staff** now, so a second staff cannot shift the
    first staff's voice indices — the kind of silent renumbering that would have
    rewritten keys across the corpus.
  - **The renderer keys per staff rather than "staff 0 of part 0"**, so the
    overlay can paint wherever the cursor can now go. Five more scenarios
    demoted, no geometry moved.
  - **The boundary is stated rather than hidden**: entry still writes to
    `parts[0]`, so you can navigate to part 2 and remove there but a typed note
    lands in part 1. Bounded, documented, and item 13c.

- **2026-08-14 — the last unfinished pair: string annotations.** `setFret` wrote
  a note's string choice and nothing stripped it (34 elements). The model's own
  rule settled the semantics — **the string is the choice, the fret its
  consequence** — so the fret leaves with it rather than surviving as a fret
  belonging to no string, and the note falls back to the derivation ladder.
  Surface: `no string` in the adornment popover, on item 11's reasoning that a
  popover is a surface rather than a data-owner.
  - **Corpus: 1,184 → 1,218 removable elements**, and the audit that prompted it
    now comes back clean: **no kind has a construct verb without a removal**.
    Every remaining `no-op` is a kind with no verbs at all — honest ground rather
    than an oversight, which is a different backlog to work.
  - Remaining, in order: `note` 129 (second parts, staff 2, the seven navigation
    failures), `beam` 26 (nested levels, second parts), `layout`/`score` 23,
    `part-name`/`clef`/`staves` 27 (second parts, mid-measure clefs),
    `accidental-display` 7, the container wrap verbs 15, percussion 6, and one
    ottava.

- **2026-08-14 — item 5's missing third member: time signatures.** The largest
  single gap on the destruct board (99 elements) was an oversight in an item
  already called done: clef and key got their inherited-attribute removals,
  time did not, because `setTimeSignature` existed and nobody noticed the pair
  was half-built. **95 removed, 4 refused; the corpus goes 1,089 → 1,184.**
  - **The corpus sharpened the semantics twice.** Re-padding the governed bars
    failed on `spec/organ-layout` — `padMeasureRests` only fills the entry
    sequence, so other voices keep their old fill — and on
    `lab/rhythm/sequence-space`, where `itemSpan` counts a `space` as zero and
    the padding mis-measured a bar whose meter had not changed at all.
  - **So removal means pure un-declaration**: offered where the meter that would
    govern afterwards equals the one declared, refused where the meter would
    really change, because repairing the bars would mean reshaping music the ops
    layer does not own. Guarded removal, same as containers.
  - **`refused` is not `no-op`, and the report says so** — four time signatures
    now read "the verb declined" rather than "no verb exists". The two-axis
    verdict paying off a fourth time.
  - **The lesson worth generalizing**: an item can be "done" while half a pair
    is missing, because the construct half often pre-dates the campaign. The
    kind table is the place to check — a row with `construct` and no `remove` is
    an unfinished pair, and there are still several.

- **2026-08-14 — 11b cracked: container content is addressable.** The third
  attempt, and the difference was doing the addressing layer first.
  - **Descent was one enumeration plus its consumers**, exactly as move 1
    predicted: `noteWalk` mints the nested key, the ops layer follows for free,
    the grid gains scaled tuplet columns, and the renderer stamps the same keys
    so the overlay can paint what the cursor can reach. **32 container notes
    became addressable and removable** (notes removed 640 → 672, total 1089).
  - **Move 2 turned out to be the prerequisite nobody planned.** Grace and
    tremolo content shares its host's moment, so without the cursor's
    discriminator those notes would have been reachable in principle and
    unreachable in fact. Coincidence is rare in the corpus and *structural* in
    containers.
  - **`LocatedNote` was a bug waiting to happen**: several ops re-derived the
    owning event as `seq.content[eventIndex]`, which for a container returns the
    container. It now carries the event the walk found.
  - **The goldens moved exactly as promised**: seven scenarios gained
    `sourceId`s where ink was anonymous, **no geometry changed**, statuses
    demoted `verified → rendered` for `/verify`. The approved cost was the real
    cost.
  - What remains is an ordinary op-family item — the wrap verbs (`tuplet`,
    `grace`, `tremolo` are still `no-op` as elements) — with nothing structural
    riding on it, which is what "do the addressing first" bought.

- **2026-08-14 — the addressing layer, in two moves; and a number I had wrong.**
  [core-note-address.md](core-note-address.md): one enumeration produces note
  coordinates (`model/noteWalk.ts`, with a corpus-wide join proving the renderer
  agrees), and the cursor gains the discriminator its address was missing
  (`slotIndex`, stepped by `Alt+V`).
  - **Move 1 is what makes 11b safe**: container descent is now one function's
    business instead of five walks kept in lockstep by care, and the join says
    whether they moved together. Goldens byte-identical — the proof it changed
    nothing.
  - **Move 2 closes a correctness hole, not a backlog.** `slotAt` used to return
    whichever coincident note came first, so Delete could act on a neighbour.
    Fixed. But measuring the corpus corrected my own claim that this would
    retire item 2's 162 findings: **154 of them have no key at all** — 100 in
    second parts, 32 in containers, 22 on staff 2 — and only **7** were
    navigation failures, of which coincidence explained one. The mass is the
    `parts[0]`/staff-1 assumption, i.e. items 13b and 11b.
  - **The lesson for the campaign's own bookkeeping**: a finding's *count* and
    its *cause* are different questions, and the report answers the first. When
    an item is chosen because a number is big, check what the number is made of
    before promising the number will move.

- **2026-08-14 — item 12 built: text entry, and the mode was not needed.**
  Syllables (`setSyllable`/`removeSyllable`) and verse metadata
  (`setLyricLine`/`removeLyricLine`), behind `Shift+L`.
  - **The index's "text mode that suspends the keymap" is rejected.** A syllable
    is one short string attached to one note, and the campaign already has a
    surface for typing one short string. A mode would add an input state to
    enter, leave and explain, and a keymap-suspension mechanism nothing else
    needs. The grammar borrows a singer's own notation instead: `sleep-`,
    `-ing`, `-ly-` carry the syllable's role in the word.
  - **Item 7's family test, fifth application, splits again**: a syllable belongs
    to the event, a verse's identity to the document.
  - **The sweep caught a real semantic error immediately.** The first
    `removeLyricLine` also pulled the line out of `lineOrder` — so removing a
    verse's *label* silently reordered the verses. Where a verse sits and what it
    is called are separate declarations. **Sibling declarations are not
    cascades**, and the surviving-document oracle is what makes that rule
    enforceable rather than merely stated.
  - **Reachable 78 → 82, removable 1022 → 1056.**

- **2026-08-14 — item 9 built: the reserved letters, and the collision dissolves.**
  Technique (`setTechnique`/`removeTechnique`) plus fingering, at the note rung.
  - **`B` and `S` needed no conditional at all.** The letters live in the **tab
    pane layer**, and `resolveIntent` tries pane layers before shared ones — so
    B bends in tab and beams in notation, S slides in tab and slurs in notation.
    Item 10 named the principle, item 11 reused it, and here the keymap turns
    out to have had the mechanism all along. **A polymorphic key is a layering
    fact, not a branch.**
  - **`H` is one key because the music decides**: hammer-on when the next note
    is higher, pull-off when lower. Two keys would ask the player to name what
    their fingers already chose.
  - **Reachable 71 → 78, removable 1003 → 1022.** Goldens untouched: nothing
    here draws yet, which is the gap core-guitar-technique.md owns — this item
    is deliberately only the entry half.
  - Fingering rode along: same owner, same rung, same removal — item 7's test
    saying "collapse" for the fourth time.

- **2026-08-14 — 11b's remainder, measured: two findings instead of two features.**
  - **Rest spelling is the entry grid.** Making `padMeasureRests` write one half
    rest instead of two quarters is a five-line change that broke two traces
    instantly: **the cursor's positions come from rest events**, so coarse rests
    delete the places the cursor can aim at (an empty 4/4 bar spelled as one
    whole rest offers exactly one). Beat-rest padding is not naive — it is the
    grid. The real fix decouples grid positions from rest events, which is
    bigger than the spelling it would buy. Reverted.
  - **Container descent is a key-scheme migration.** The goldens were the
    expected cost (7 scenarios, 32 noteheads — an accepted demotion), but they
    are not the blocker: the renderer indexes `sequence.content` per item, so a
    container's inner events would all synthesize the SAME key. Descent needs a
    nested key form (`@m0.v0.e2.c1.n0`) landed simultaneously across
    `noteKeys.ts`, `jsonView.ts`, `cursor.ts`, `notation.ts` and `tabStaff.ts`
    — the five traversals CLAUDE.md requires to stay in lockstep. Half a
    migration desynchronizes the overlay, the JSON pane and the render, so it is
    deliberately left whole and unstarted rather than begun and abandoned.
  - Tuplet/tremolo onsets are not the hard part (`itemSpan` already scales
    them) and grace notes share their host's onset, which the slot list
    supports. **The hard part is agreement between traversals**, which is the
    same lesson the campaign started with: the goldens are the witness that they
    agree.

- **2026-08-14 — item 11b's first half: a run of short notes is enterable at last.**
  Item 11 could not record a beam trace for a reason that had nothing to do with
  beams, and this is the diagnosis: entering eight 32nds produced
  `C5/32nd, D5/quarter, E5/quarter…`.
  - **Two compounding mechanisms.** The duration keys stepped the pending
    duration only on an *entry ghost*, but a padded bar is full of rest EVENTS,
    so they re-valued the rest instead; and entry then inherited the rest's
    duration, ignoring the one it was given.
  - **The campaign's own founding rule settled both**: a rest is absence
    (§8.11). There is nothing there to re-value, so the keys step the pending
    duration over a rest as over a ghost; and entry does not inherit a rest's
    duration — the note takes the pending one and the surplus stays as rest
    **after** it, never by shortening in place (sequence content is sequential,
    so shrinking drags every later event earlier and silently re-times the bar).
  - **The parked trace-maintenance question arrived for the first time.**
    `from-scratch` changed correctly and was regenerated with
    `npm run update:edit-traces`; every bar still sums to its meter. One trace,
    one documented tool, no drama — but the campaign should expect this to scale
    with trace volume, exactly as the opening entry predicted.
  - **And it uncovered the next blocker in the same breath.** Rests are now
    un-re-valuable by keyboard, which is the honest consequence of treating them
    as absence — so `beams-secondary-beam-breaks-implied` is *still* untraceable,
    because it writes one **half** rest where padding spends two **quarters**.
    Legal either way, identical sums, different glyphs. **Rest durations are a
    consequence of padding, not a choice**, and reproducing an authored rest
    pattern needs a rest verb or a smarter `padMeasureRests`. Filed with the
    containers in 11b's remainder.

- **2026-08-14 — item 13 built at a narrower scope: every genesis verb's missing half.**
  The five declarations on `parts[0]` (name, strings, capo, staffKind, staves) get
  `setPartDeclaration`/`removePartDeclaration`; the index row's real subject —
  a *second* part, voice or staff, plus layouts and scores — becomes item 13b.
  - **The biggest remaining `no-op` counts were not exotic.** part-name 59,
    strings 21, staff-kind 20: verbs that shipped without their pair, because
    item 1 built genesis in a hurry for construct traces. **Removable 912 → 1003.**
  - **13b now carries a price tag, which is why it is its own item**: `parts[0]`
    is hard-coded in `findKeyedNote`, `buildGrid` and the note-key traversal, so
    a second part changes note keys — and the primitives goldens embed them. That
    is a corpus re-verification event, and it deserves an explicit decision rather
    than arriving as a side effect.
  - **The sweep refused this item twice and improved it both times.** Removing
    `strings` from a tab part left it declaring an undrawable view (diagnostics
    0 → 2) → a declared cascade: the fingerboard and the preference to show it
    leave together. Then the no-tombstone cleanup read as damage, because
    emptying `_x.mnxLab` collapses `_x` two levels up → the surviving-document
    oracle grew an **ancestor-collapse** rule, precise enough that a sibling can
    never be excused by it. **The sweep is a constraint on the ops, not a report
    about them.**

- **2026-08-14 — item 8 built: the family test says "two pairs", and a new kind of address.**
  Markings (`setMarking`/`removeMarking`) plus dynamics and directions
  (`setPositioned`/`removePositioned`), behind one `Shift+A` popover.
  - **Item 7's test earned its keep by saying NO.** All three read as "something
    attached to this moment", but markings are keys on the *event* while dynamics
    and directions are positioned entries on the *part measure*. Collapsing them
    would have meant a payload whose owner depended on its own discriminant.
    Same test, opposite answer — which is what makes it a test.
  - **The first two-coordinate address.** Every attribute so far was reachable by
    measure index; a dynamic sits at a *moment*, so `ElementRef` grew `onset` and
    the sweep drives `nextPosition` until the cursor's position matches. Later
    positioned families (item 11b's `space`, mid-bar clefs) inherit it.
  - **Reachable 55 → 68, removable 842 → 912**, both predictions exact.
  - **Letter accelerators deliberately deferred.** The index pencilled in an
    "adornment alphabet", but claiming eight letters while the vocabulary is
    unsettled spends the campaign's scarcest budget worst. Keys are the unstable
    layer; the ops and traces will not change when they bind.

- **2026-08-14 — item 11 built, at half its index row's scope, because the code said so.**
  Beams (top level), full-measure rests and measure repeats; the rest of the row
  becomes **item 11b**, with evidence rather than a hunch.
  - **Reachable 45 → 55** (predicted exactly), **removable 820 → 842**. The
    histogram's head is gone; the tail is flat (layout 6, score 6, direction 5,
    dynamic 5, staves 5, technique 5), so ordering-by-evidence has taken the
    campaign as far as it usefully can — from here the question is which surface
    you want, not which number is biggest.
  - **The split was forced twice by the code.** The grid skips non-timed items, so
    a `wrapInTuplet` verb would have removed ink from the addressable surface and
    the sweep would have said so. Then a beam trace failed for an unrelated
    reason: the entry surface cannot lay a run of 32nds — after the first note,
    `nextPosition` lands on the original quarter rest and each subsequent note
    inherits *that* duration. **No beam scenario is traceable today and beams are
    not why.** Onset granularity is the blocker, and it is now item 11b's first
    job.
  - **A verb can be right while its scenarios stay untraceable.** The destruct
    side proves the ops (14 beams removed under all six oracles); the construct
    side proves only the tier. Recording that difference is the campaign's whole
    method — the alternative was shipping verbs that make the scoreboard green
    while the editor gets no better.
  - **The anchor generalized on first contact**: beams reuse item 10's
    `spanAnchorKey` unchanged, resolving to events rather than notes. Two verbs,
    one gesture, no new state.
  - **Nested beams have no verb, and 26 of 40 beam elements say `no-op`** — hooks
    and secondary breaks, plus second-part and staff-2 beams. Reported rather than
    quietly counted, which is what keeps the scoreboard worth reading.

- **2026-08-14 — item 10 built: the first two-ended gesture, and the S collision resolved.**
  Slurs (`setSlur`/`removeSlur`) plus `setTieVariant`, at the note→note rung.
  - **The gesture is an anchor**, because the ladder cannot extend laterally yet:
    press `S` at the start note, navigate, press `S` at the far note; `Esc` drops
    it. That is **the first session state beyond the cursor and entry duration** —
    one nullable note key — and traces stay honest because they record the two
    presses, not a synthesized "slur A→B". When lateral selection lands, "slur the
    selected run" becomes a second route to the same op, not a replacement.
  - **`S` is one key with two meanings, chosen by the active projection** — slur in
    notation, slide in tab. Not a compromise: it is the ladder's decided principle
    (the active projection picks the input dialect) applied to a letter, and it
    joins `Alt+↑↓` and `Del` as polymorphic verbs. Item 9 inherits it; the index
    records `S` as agreed for both.
  - **"Handled" is not "removed."** `toggleSlur` returns true when it merely arms
    an anchor, and the sweep counted that as a removal until the oracle said "the
    document did not change". `attemptElement` now compares the document.
    **Rule for every later gesture item**: an intent returning true has been
    handled, which is not a claim about ink.
  - **Recording a trace is a loop with the session, not a script.** Horizontal
    moves snap to the ink at the destination, so vertical corrections computed in
    advance overshoot — mine left the anchor armed and silently dropped a slur.
    The trace generator now tracks where the cursor actually lands.
  - **Reachable 42 → 45, all 6 slurs removable**, fifth recorded trace
    (`spec/slurs`, 52 intents). The renderer's default curve side matched the
    corpus's explicit `side: up`/`down`, confirming `side` is presentation.
  - **Tie variants close an optimistic prediction rather than unlocking anything**:
    `spec/tie-targets` was already predicted reachable because every kind in it had
    a verb, yet `toggleTie` only makes plain `nextNote` ties. `setTieVariant` fills
    that in — the kind-shaped blindness item 3 warned about, met a second time.

- **2026-08-14 — item 7 built: ten kinds, one verb, and the histogram proved itself.**
  The bar-attribute family (`setMeasureAttribute`/`removeMeasureAttribute`) at
  **Shift+B**, measure rung, `KeyDoc` row in the same change.
  - **Reachable scenarios 24 → 42, removable elements 758 → 814** (all 56 family
    elements). The predicted +18 landed exactly, two items after the histogram
    started choosing the work — it is a planning instrument now, not a curiosity.
  - **One op pair for ten kinds** because they are all *the same thing*: a key on
    the global measure. The union keeps each payload typed (this is not a
    stringly-typed bag) while the sweep gets one address, the panel one row shape
    and the popover one grammar. **Test for a future family: do they share an
    owner?** If not, they will not collapse like this.
  - **The removal token names the removal CLASS.** `inherit` = revert to the
    predecessor's governance (item 5, inherited attributes); `no <attribute>` =
    it is simply not there (here, annotations). The grammar teaches the taxonomy;
    a third class should earn a third word rather than overload these.
  - **`barline` is the family's odd member and the taxonomy already had the word**:
    it is a MODIFIER, not an annotation — every bar draws a barline regardless, so
    removal returns the default stroke rather than removing ink. The ink census
    listing `barline` as structural is what keeps that honest.
  - **Trace-recording gotcha for later items**: the cursor's starting line depends
    on the grid mode, so a fingerboard-less document needs one fewer `lineDown`
    than a tab-mode one. Cost one iteration on `spec/hello-world`, now the fourth
    recorded trace.
  - Correction to item 5's entry: its "1 → 22" counted only untraced scenarios;
    the honest figures are **3 → 24** (the +21 delta is unchanged).

- **2026-08-14 — item 5 built: the first op family, and the campaign's biggest step.**
  The inherited-attribute pair (`setClef`/`removeClef`, `setKeySignature`/
  `removeKeySignature`), popover tier at **Shift+C** / **Shift+K**, measure rung,
  `KeyDoc` rows landed in the same change per the contract.
  - **Both scoreboards moved, as predicted.** Construct: reachable scenarios
    **3 → 24** (`ops-reachable` 1 → 21, plus a promotion to `traced`), and
    clef/key vanish from the blocking histogram — the top blocker is
    now `beam` at 10, down from clef's 96. Destruct: **651 → 758** removable
    elements (101 of 113 clefs, all 6 key signatures). Item 3's histogram picked the
    right item, which is the first real test of ordering-by-evidence.
  - **`inherit` is the removal token**, not a second key. Del at the measure rung
    was already taken (item 1's empty-bar removal), and "revert to the predecessor's
    governance" is what removal MEANS for this class — so the popover grammar says
    it in a word. Later inherited-attribute items inherit the token.
  - **A verb without an address is invisible to the sweep.** Declaring the ops moved
    nothing at first: `attemptElement` knew how to drive notes and note-attached
    elements only, so 113 clefs came back `unaddressable` *with* a verb — the same
    under-attempt ties had one item earlier. **Rule: every op family must teach the
    walk its address**, and `ElementRef` grew `measureIndex` (set only when the ops
    layer can really reach it) the way `noteKey` already worked.
  - **The scope boundary shows up as 12 honest `no-op` clefs** — second part, second
    staff, mid-measure position — rather than as failures. That is the two-axis
    verdict doing its job: an item can ship a family without claiming the whole of it.
  - **Third traced scenario**: `lab/tab-derivation/bare-melody`, 24 intents from
    `{}` through the new clef verb to four pitched notes, matching its goldens.

- **2026-08-14 — item 3 built: the forward verdict, and one verb gates the corpus.**
  `npm run sweep:construct` writes `harness/reports/construct-coverage.json`, drift
  fails the build both ways, and the two harnesses now read ONE table. Baseline:
  **traced 2 · ops-reachable 1 · blocked 98 · expected-unreachable 5**.
  - **`clef` blocks 96 of 106 scenarios.** The next nine blockers together account
    for fewer (beam 10, barline 7, layout 6, repeat-end 6, score 6, section 6,
    direction 5, dynamic 5, key-signature 5). Item 5 was already ranked first on
    taste; it is now ranked first on evidence, and by a margin no other argument
    survives. **Do item 5 next.**
  - **The op pair moved onto the kind table** (`ELEMENT_KINDS` rows now carry
    `construct` and `remove`), because the contract's "defined together" is only
    true when they live together. Two things fell out within minutes: the destruct
    sweep had never attempted `toggleTie` — a removal verb it owned all along, now
    turning 12 of 13 corpus ties into `removed` — and a row claiming `removePart`
    removes a part's *name* was refused by the destruct report's drift test.
    Container verbs are not their contents' verbs.
  - **A prediction is not a verdict, in BOTH directions.** `open-strings-chord`
    traces green while blocked on a clef (invisible to the goldens — the engine
    draws the same default); `empty-tab-canvas` is predicted reachable and is not
    traceable at all, because `appendMeasure` writes four explicit rests where the
    hand-written template has none. Rule for later items: **the tier model is
    kind-shaped and cannot see op semantics** — only a trace can.
  - **New question with evidence attached**: which empty bar is canonical — the
    model's implicit rests or the op's explicit ones? Item 11 (rhythm model)
    inherits it; it already owns what an onset is.

- **2026-08-14 — item 2 built: the corpus has a scoreboard, and it found four bugs.**
  `npm run sweep:destruct` writes `harness/reports/destruct-sweep.json`; `npm test`
  fails on drift in either direction, so a later item's new verb lands as rows
  moving `no-op` → `removed`. **First baseline: 1,460 elements over 106 scenarios —
  639 removed, 821 no-op, 162 unaddressable notes**, every scenario passing its
  invariants. What the run taught the campaign:
  - **The denominator is now real.** 45 element kinds, 44 exercised by the corpus,
    **one** with a removal verb. Ordering evidence for items 4–13 by ink volume:
    clef 113, time-signature 99, part-name 59, dynamic 43, beam 40,
    string-annotation 34, lyric 28, articulation 14, direction 13, tie 13.
  - **"Element = distinguishable ink" is machine-checked now.** Every one of the 63
    primitive classes drawn in the goldens must be claimed by a kind or declared
    structural with a reason (`element-census.test.ts`). A renderer feature that
    draws something new turns that test red until a kind owns it — the census, not
    taste, decides when the walker is complete. Element-vs-structure is drawn by
    *encode the choice, not the consequence* — the same rule that sorts string from
    fret, reused rather than reinvented.
  - **Item 1's addressability test was too weak, and it hid a wrong-note deletion.**
    Comparing cursor coordinates said "arrived"; the editor then deleted a
    DIFFERENT note, because `EditorCursor` carries no voice and `slotAt` takes the
    first slot on the line. Resolve the slot and compare its key instead. The rule
    for the campaign: **an addressability oracle must ask what the editor would act
    on, never where the cursor sits.**
  - **The predicted reference bug was four bugs.** Ties dangled as designed
    (`spec/ties`, `spec/tie-targets`) — and so did slurs, technique relationships
    (a hammer-on to a deleted note), while seven beam scenarios went **inkless**
    instead: the emptied event keeps its id, so the beam does not break, it beams a
    rest. 13 scenarios in total, fixed in `deleteNote` as the *reference* removal
    class (unlink both ends) plus a declared beam cascade. Later items get the
    check for free — `src/model/references.ts` is one list of every id join.
  - **The surviving-document oracle earns its place immediately**: it is what
    proved the new cascades removed only what they should. Array-shift-aware
    diffing was the trick — splicing a chord member must not read as five changes.
  - Two findings handed onward: the cursor's missing voice component (evidence
    filed to [core-selection-ladder.md](core-selection-ladder.md)), and a chord in
    navigation-playground deriving two notes onto one string, which no fingerboard
    can play.
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
