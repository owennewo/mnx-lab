# Roadmap

Planning docs for MNX Lab, filed by their status **relative to the current codebase**. This
is an archive of intent, not a live task board. The recent driver — the spec-approval sweep —
is now complete ([complete/lab-spec-approval.md](complete/lab-spec-approval.md), 57/57 verified); the
corpus contract is [complete/lab-04-scenario-library.md](complete/lab-04-scenario-library.md), closed
2026-08-09 — corpus growth now arrives as its own tickets, not through that doc.

The big picture: the `clean_room_impl/` **pivot plan** (library-first: scenarios → gallery →
render → tab → playback → editing → AI-last) was **executed by refactoring the existing app
in place**, *not* by the from-scratch monorepo of packages it proposed. So most of that plan
is "done," its scenario-library structure is the living corpus contract, and its package
architecture was dropped. The older pre-pivot docs (AI-first UI, VexFlow stack) are superseded.

## Buckets

| Bucket | Meaning |
|--------|---------|
| `proposed/` | Described but not built. |
| `inprogress/` | Actively being worked / a living contract. |
| `complete/` | Built and shipped (kept for provenance; may be aspirational in tense). |
| `superseded/` | Overtaken by reality or a later decision; kept for history, **not current**. |

Every doc is prefixed by what it serves (all buckets renamed 2026-08-11):

| Prefix | Serves |
|--------|--------|
| `studio-` / `workbench-` | one of the two shells |
| `core-` | the shared apparatus beneath them (model/engine/audio/edit/elements/converters) |
| `spec-` | the spec loop — arguments about the standard, aimed upstream |
| `lab-` | the repo itself — structure, process, corpus machinery |

Another prefix is admitted only when it earns its keep: separate *and* important.

A doc named `<prefix>-campaign-<name>.md` is a **campaign**: an index over many normal
proposals sharing one goal, carrying their shared contract and a running progress +
learnings log (convention: CLAUDE.md → Conventions). Indexed items are ordinary
proposals that name their campaign.

## Contents

### proposed/
- **[spec-mnx-cg-proposals.md](proposed/spec-mnx-cg-proposals.md)** — **where** chord symbols, section
  labels and technique should live, designed to be adoptable by the MNX CG rather than to stay
  private `_x` fields. Checked against the CG's live issues: #109 chord symbols, #112/#377
  rehearsal marks (the spec editor asked for a proposal and nobody wrote one), #63 guitar tab,
  #110 fretboard diagrams — all open, all unclaimed. Derives an acceptance template from the
  dynamics rework (#518, proposed → merged in three weeks). **The designs are now built**
  (`_x.mnxLab` v3 — see [docs/mnx-extensions.md](../docs/mnx-extensions.md)); what is left here
  is the outward half: join the CG, sign the CLA, and post the three proposals.
- **[spec-score-text.md](proposed/spec-score-text.md)** — **where text belongs in MNX.** v27 allows free
  text in seven places (lyrics, naming, two dynamics decorations) and a bar can carry no text
  at all, so rehearsal marks, section names and performance directions have nowhere to go.
  Proposes typed `rehearsal`/`section` on the global measure beside `segno`/`fine`/`jump`, plus
  generic `directions[]` on the part measure shaped like `dynamic-group`. Key argument: typing
  makes placement derivable, which is why Soundslice needs an inner/outer axis and MNX would
  not. Includes a round-trip stress test — 3 of 4 directions are destroyed or misclassified
  today, and the corpus never catches it. Supersedes the placement half of
  [spec-mnx-cg-proposals.md](proposed/spec-mnx-cg-proposals.md) §3.
- **[core-chord-symbols.md](proposed/core-chord-symbols.md)** — chord symbols. **Data path shipped**
  (2026-07-26) as `global.measures[i]._x.mnxLab.harmonies[]`: structured *and* literal, read
  from Guitar Pro `beat.text` **and** `Chord` objects, written and read as MusicXML
  `<harmony>`, lossless both ways (`Vestapol` 25, `House-of-the-Rising-Sun` 14). Remaining:
  **rendering** — nothing draws a chord symbol yet.
- **[core-guitar-technique.md](proposed/core-guitar-technique.md)** — playing technique. **Data path
  complete** (2026-07-26): hammer-ons, pull-offs, slides, vibrato, **harmonics** and **palm
  mute** all survive `MNX ⇄ .gp` and `MNX ⇄ MusicXML`, and bends are now **curves**
  (`points: [{position, alter}]` in semitones) rather than a single interval that flattened
  anything more elaborate. Remaining: **rendering** — nothing draws technique yet.
- **[spec-instrument-position.md](proposed/spec-instrument-position.md)** — **where a note is played**:
  the string declaration, capo, `note.string`, `note.fingering`. Thesis: **the string and the
  finger are choices, the fret and the hand position are consequences** — given tuning, string
  and pitch, the fret is arithmetic (and on violin, string + pitch + finger derives the hand
  position). Argued from the conflict rule MNX already used against MusicXML's duplicated tab
  staves, not from "derivable data shouldn't be stored". Names are tested against **piano**,
  which sorts them: only `fingering` is universal, so it must not nest under a `tab` namespace.
  Records upstream state (#63 open with a standing invitation from the spec editor, **no
  discussion exists**), natural/artificial harmonic derivation, and the divergence from the
  built `_x.mnxLab.tab.position`, which stores the fret. Scope is bounded by a principle
  rather than a list — **encode the choice, not the consequence** — which maps the same shape
  onto brass (valve combination selects a fundamental, pitch determines the partial) and
  excludes tin whistle by the same rule that excludes storing the fret. Design only — nothing built, nothing
  posted; complements [core-guitar-technique.md](proposed/core-guitar-technique.md) (what the hands do).
- **[core-derived-positions.md](proposed/core-derived-positions.md)** — the execution half of
  [spec-instrument-position.md](proposed/spec-instrument-position.md): migrate `_x.mnxLab` to the
  proposal's shape (v5: string authoritative, `fret` optional and non-authoritative, `fingering`
  un-nested, `tuning[]` → `strings[]`) **and specify the derivation ladder** so unannotated
  guitar notation still renders valid tab — lowest-playable-fret assignment, default standard
  tuning, capo-aware (the current fallback in `guitarPositions.ts` ignores both; MNX pitch is
  sounding, so no transposition term — `part.transposition` is display-only). The pitch-only
  assignment is ruled **presentation, not content** — never written back, not proposed as
  normative spec text; our renderer's determinism is owned by the
  `lab/tab-derivation` scenario family, so heuristic changes become reviewed golden
  demotions instead of silent drift. **Stages 2–4 shipped 2026-08-07** — the v5 reshape
  (schema, v4→v5 upgrade hop, converters, corpus, edit layer, Worker prompt), the
  hardened derivation (tuning/capo-aware authority ladder, red mismatch/unplayable badges,
  no silent clamp), and nine rendered scenarios pinning it (bare melody/chord, string-only,
  partial annotation, drop-D, capo, transposition-is-display-only, out-of-range, fret
  mismatch); goldens byte-identical throughout. **Instrument neutrality followed the same
  day**: the assume-standard-guitar default is retired — tab requires declared `strings[]`
  or a viewer override (`<mnx-score-viewer>` `stringsOverride`/`capoOverride`, surfaced as
  the workbench's instrument selector with presets incl. open D/bass/uke/mandolin); the
  shim materializes the old implicit default into saved documents.
- **[core-editor-focus-scope.md](proposed/core-editor-focus-scope.md)** — **who owns the next
  keystroke, and how you can tell.** Raised from an embed question (when do PgUp/PgDn reach
  the component vs the host page?) whose honest answer was "almost always the component":
  both listeners are `window`-scoped with no focus check, and a custom element isn't even
  focusable by default — so "while focused" wasn't expressible. Names the four-scope ladder
  (browser/OS → document → host element → regions within), notes that **shadow DOM retargets
  but never scopes key events**, and sets one rule: handle a key iff focus is inside the host
  — `tabindex`, a host-scoped listener, containment tested across shadow roots, and
  `preventDefault()` only on keys actually consumed. Plus the visible signal (a
  `:host(:focus-within)` ring on the public `--mnx-focus-ring` token — an unfocused component
  drawing a cursor is lying about who gets the keystroke) and the rule that **shell bindings
  don't travel** (an embed must not eat a host page's Ctrl+K). **Stages 1, 3 and 4 built
  2026-08-12** (the ring + `--mnx-focus-ring` token, `keyScope.ts`'s shared
  `editorHasKeyboard` predicate driving both the key gate and the overlay's `selection-inactive`
  fade, the binding-split assertion) and verified in headless Chrome over CDP — `dimmed` and
  `keyLanded` are exact inverses at every focus step. Records a reusable finding: headless
  Chrome delivers no focus events to `window` even for real clicks, so ownership is re-read
  from `activeElement` on the *causes* of focus change. Stage 2 — moving the listener onto
  the host element — rides
  [core-editor-element-promotion.md](proposed/core-editor-element-promotion.md).
- **[core-viewer-surface.md](inprogress/core-viewer-surface.md)** — name and define **the viewer
  surface**: `<mnx-score-viewer>`'s public contract (props/attributes/events), today an
  undesigned accretion. Layered rule (engine `RenderOptions` → element bindings → workbench
  chrome), attribute-first, the `view="auto"` precedence chain (user > host > document
  `staffKind` hint > default), a set-valued `hide` knob, and eviction of workbench leakage
  (`pinnedErrors` et al). Subsumes render-density-zoom's "where do the levers live" question.
- **[core-render-density-zoom.md](inprogress/core-render-density-zoom.md)** — configurable horizontal +
  vertical **density / zoom levers** ("see more music on less page"). Feasible today: layout is
  in staff-space units (uniform zoom = `pxPerSp`), horizontal density = `spacing.ts` knobs,
  vertical density = layout gap/padding constants. Not started. Where the levers are *exposed*
  is now owned by [core-viewer-surface.md](inprogress/core-viewer-surface.md).
- **[core-editor-ai-prompt.md](proposed/core-editor-ai-prompt.md)** — the command palette's **third
  mode**: `Ctrl+K` text routing to `/api/edit-notation` when it reads as a sentence rather than
  a command (research §6.2), inheriting the `ui/ → assist/` boundary. Owns the deeper
  convergence `src/edit/ops.ts` has always named: the assist loop emitting **`EditOp[]`
  through `applyOp`** instead of replacing whole documents, so AI edits land in the session's
  undo history and op log like keyboard edits. Split out of
  [core-editor-input-layer.md](complete/core-editor-input-layer.md); the voice half stays in
  [core-open-router.md](proposed/core-open-router.md).
- **[core-editor-element-promotion.md](proposed/core-editor-element-promotion.md)** — promoting the
  editor's mount layer out of `workbench/` into `elements/`, making it consumable by the
  embed face and studio. Split out of [core-editor-input-layer.md](complete/core-editor-input-layer.md)
  when that closed. **Deliberately parked** behind a two-part trigger — the intent
  vocabulary stabilising AND a real second consumer asking for editing (a check, not a
  debate) — with the costs of moving early recorded (API pressure on the public surface,
  the shadow-DOM focus story coming due, embed bundle weight; testing is unchanged either
  way). The promotion review's work list: the `elements/ → edit/` boundary change, the
  element contract under [core-viewer-surface.md](inprogress/core-viewer-surface.md)'s layered rule,
  focus story, code-splitting, and the palette's `elements → assist` question from
  [core-editor-ai-prompt.md](proposed/core-editor-ai-prompt.md).
- **[core-selection-tray-visuals.md](proposed/core-selection-tray-visuals.md)** — the **selection
  command tray**, part 1 of 3: Ctrl+K stops opening a document-wide list and opens a tray
  **planted under the selection** — scope tabs that are the ladder's rungs (not the design's
  four; presence-rule filtered, HUD vocabulary), a Bravura glyph grid with shortcut and
  current state on every tile, shaft+plinth connector, hover readout, scoped search — built
  whole on demo data, firing nothing, so look and feel get a hands-on review before any
  wiring. From a Claude Design spec ("SPEC · v1"), shipped **faithful to its art direction**
  (Archivo / `#ec3013` / zero radius, deliberately apart from current chrome — the leading
  edge of a possible restyle, which would be its own proposal). Incubates as a dumb
  `<mnx-selection-tray>` in `workbench/` (ScoreHud posture); the one `elements/` change is a
  `selection-anchored` rect event on the viewer, satisfying
  [core-viewer-surface.md](inprogress/core-viewer-surface.md)'s layering.
- **[core-selection-tray-mechanism.md](proposed/core-selection-tray-mechanism.md)** — part 2:
  the tray wired. One ruling — tiles fire **intents through `session.handleIntent`, nothing
  else** — so tray clicks land in the op queue and replay through traces like keystrokes. A
  command registry in `src/edit/` (testable below the harness boundary) whose rows are the
  *surface half* of [campaign](inprogress/core-campaign-element-ops.md) agreement blocks:
  id, rungs, glyph, key/tier, `isActive`, `toIntent` — `toIntent: null` renders greyed, so
  the greyed tiles *are* the campaign's remaining index, visible in the product. Joins both
  ways (stroke ⇒ keymap + `KEY_DOCS` at every claimed rung; ops panel gains `tray`
  provenance). Scope preview/commit via `SelectionContext.preview` + a dashed enclosure and
  the HUD's shared level-walk; Ctrl+K → tray / Ctrl+Shift+K → global palette; **Escape
  precedence stated once** in the keymap layer, answering the ladder's open question.
- **[core-selection-tray-residue.md](proposed/core-selection-tray-residue.md)** — part 3: the
  **ledger of what cannot be wired yet**, each greyed tile with an address — adornments,
  dynamics, spanners, rhythm, bar attributes, clef/key, text, voices-beyond-one map to
  campaign items 5–13; mixed state, extension/closure, the container tab and mouse
  selection wait on the ladder's `{level, anchor, extent}`; part transposition, mute, the
  embed/studio tray and wide-selection shaft geometry each name their own blocker. Rows
  retire as unblockers land (registry `blockedBy` keeps table and tiles from drifting);
  empty table ⇒ `complete/`.
- **[core-tuplets-grace-notes.md](proposed/core-tuplets-grace-notes.md)** — tuplets and grace notes
  **across both converters and on tab**. Split out of
  [core-guitar-pro.md](complete/core-guitar-pro.md) when that closed, at its real scope: the model
  and the notation renderer already support both (`MnxTuplet`/`MnxGrace`, drawn, with spec
  scenarios), but **neither converter carries them** (Guitar Pro flattens with a `warn()`;
  MusicXML never looks) and the tab staff reserves their columns without drawing them.
  Step zero is a **fixture** — none of the three reference scores contains a tuplet or a
  grace note, which is why the round trips are honestly lossless and still never present
  the case. Import/export follows the collapse-expand precedent already solved for voltas.
- **[core-open-router.md](proposed/core-open-router.md)** — two-stage **voice** input + structured edit.
  The *text* edit path shipped (worker `/api/edit-notation` NDJSON self-correcting loop); the
  **voice/transcription stage was never built**. What's left here is the voice half.
- **[studio-storage-sync.md](proposed/studio-storage-sync.md)** — **studio's storage, sync
  and sharing**: a hand-rolled op-log sync engine in the Replicache mold (server-authoritative
  rebase over `EditOp`/`applyOp` — CRDTs rejected with reasons), persisted as a SQLite Durable
  Object per document + D1 library layer + R2 snapshots, IndexedDB demoted to replica. Library
  model is **multi-dimensional tags** (path/setlist asserted; tuning/artist derived by the doc
  DO, never stale) and **the tag is the unit of share** — live sets, materialized grants,
  capability URLs — over a tier ladder (URL-fragment → tag-shares → git/jsDelivr publish →
  Drive as export only). Records the adoption-day snapshot barrier, the worker/`applyOp`
  boundary question, free-tier→$5 cost shape, and a five-stage build order starting with
  whole-document LWW through the existing `DocumentRepository` seam.

### inprogress/
- **[core-campaign-element-ops.md](inprogress/core-campaign-element-ops.md)** — **campaign**
  (the first): every corpus element constructible from an empty score and *individually*
  destructible (surgical removal, no coarse delete-measure/voice/part cheats). Opened from
  the 2026-08-11 gap analysis: the op vocabulary, not the keymap, is the bottleneck — 12
  `EditOp` types vs ~40 corpus constructs, one true removal op, no genesis ops. The shared
  contract makes every indexed item open with an **agreement block** — the construct/destruct
  op pair (with a removal class: no tombstones, no dangling references), the shortcut (or
  popover/palette tier), and **which selection rung the ops attach to** — before any code.
  Thirteen indexed items: the exemplar first (**complete 2026-08-14** — in `complete/`
  below; the campaign moved here with it), then the corpus-wide harnesses (a generative
  destructibility sweep and
  empty→scenario constructibility traces), then the element families ordered by scenarios
  unlocked. Construct traces start from **the literal `{}`**; verdicts ride the committed
  primitives goldens and the byte-identical undo-all contract. Feeds the `EditOp[]`
  convergence in [core-editor-ai-prompt.md](proposed/core-editor-ai-prompt.md).
- **[core-element-ops-destruct-sweep.md](inprogress/core-element-ops-destruct-sweep.md)** —
  campaign item 2: **the destructibility sweep at corpus scale**, item 1's reverse walk
  over all 106 scenarios and every kind of ink in them. A harness item, so its agreement
  block is four decisions rather than the contract's op/key/rung. **Built 2026-08-14**,
  same day as proposed: the element inventory (45 kinds, each declaring the primitive
  classes it claims) and the reference map (15 join kinds over 8 id spaces); the **ink
  census join** proving every one of the 63 drawn classes is claimed by a kind or
  declared structural with a reason — "an element is anything the renderer draws
  distinguishable ink for", made checkable, with element-vs-structure sorted by the
  repo's own *encode the choice, not the consequence* rule; the sweep's **two verdict
  axes** (addressed? removed?) where only a broken oracle reddens a build, so `no-op`
  and `unaddressable` can be the scoreboard instead of a permanently red suite; six
  oracles including relative validity (invalid-by-design exhibits stay judgeable), the
  reference check and the new **surviving-document** check that finally asserts
  "byte-identical except forced cascades"; and a committed report
  (`npm run sweep:destruct`) whose drift fails the build in either direction. **First
  baseline: 1,460 elements — 639 removed, 821 no-op, 162 unaddressable notes**, with
  clef 113 / time-signature 99 / part-name 59 / dynamic 43 as the ordering evidence for
  items 4–13. It caught four real bugs on its first run: the predicted dangling tie
  **plus** slurs, technique relationships and seven beam scenarios going *inkless* (an
  emptied event keeps its id, so the beam beams a rest) — 13 scenarios, fixed in
  `deleteNote`; and an addressability oracle so weak it hid a **wrong-note deletion**
  (the cursor carries no voice, so Delete could remove the other voice's note — evidence
  now filed to [core-selection-ladder.md](inprogress/core-selection-ladder.md)).
- **[core-element-ops-rhythm-declarations.md](inprogress/core-element-ops-rhythm-declarations.md)** —
  campaign item 11, **built 2026-08-14** at deliberately **half its index row's
  scope, because the code made the split**. Beams (top level), full-measure rests
  and measure repeats land; tuplets, grace and tremolo become item 11b. The reason:
  the cursor grid skips non-timed items, so container content is invisible to the
  editor — a `wrapInTuplet` verb would have *removed ink from the addressable
  surface* and the sweep would have said so. Beams reuse item 10's anchor verbatim
  (arm at the first note, press again at the last), resolving to events rather than
  notes — two verbs, one gesture, no new state — and `B` is the second customer of
  item 10's projection rule (beam in notation, bend in tab). The rest declarations
  ride the bar popover, which now writes both global- and part-measure keys because
  **a popover is a surface, not a data-owner**. Results: reachable scenarios
  **45 → 55** (predicted exactly), removable elements **820 → 842**, with 26 of 40
  beams honestly `no-op` (nested levels, second parts, staff 2). Then a beam trace
  failed for an unrelated reason worth more than the trace: the entry surface
  cannot lay a run of 32nds — after the first note, `nextPosition` lands on the
  original quarter rest and each subsequent note inherits *that* duration. **No
  beam scenario is traceable today and beams are not why**; onset granularity is,
  which is now item 11b's first job.
- **[core-element-ops-spanners.md](inprogress/core-element-ops-spanners.md)** —
  campaign item 10: **the first two-ended gesture**, **built 2026-08-14** the same
  day as proposed. Items 5 and 7 were attributes at the cursor; a slur has two ends
  and the ladder cannot extend laterally yet, so the keyboard names two places in
  two presses: `S` arms an anchor at the start note, navigate, `S` completes it,
  `Esc` drops it — **the first session state beyond the cursor and entry duration**,
  and traces stay honest because they record the two presses rather than a
  synthesized "slur A→B". It also **resolves the `S` collision** the campaign index
  flagged against item 9's slide: one key, two meanings, chosen by the active
  projection (slur in notation, slide in tab) — the ladder's own "the projection
  picks the input dialect" principle applied to a letter. A slur is one object
  holding both ends (the *reference* removal class made concrete), so removal takes
  both, and chord pins make three slurs on one event independently addressable.
  Results: reachable scenarios **42 → 45**, all 6 slur elements removable, and a
  fifth recorded trace (`spec/slurs`, 52 intents). Two rules for later items fell
  out: **"handled" is not "removed"** (an intent returning true has been handled,
  which is not a claim about ink — the sweep now compares documents), and
  **recording a trace is a loop with the session**, since horizontal moves snap to
  ink and pre-computed vertical corrections overshoot.
- **[core-element-ops-bar-attributes.md](inprogress/core-element-ops-bar-attributes.md)** —
  campaign item 7: **ten bar attributes behind one popover**, the second op-family
  item, **built 2026-08-14** the same day as proposed and again chosen by item 3's
  histogram. Barline, repeat start/end, ending, segno, fine, jump, tempo, rehearsal
  and section are all *the same thing* — a key on the global measure — so they share
  **one op pair** (`setMeasureAttribute`/`removeMeasureAttribute`, payload typed per
  kind, never a stringly-typed bag), one address in the sweep, one row shape in the
  ops panel and one typed grammar at **Shift+B** (`barline double`, `repeat end 3`,
  `ending 1,2`, `tempo half=80`, `section Verse 1`). Removal is **`no <attribute>`**,
  because the token names the removal *class*: item 5's `inherit` says "revert to the
  predecessor", an annotation's removal says "it is not there". `barline` is the odd
  member and the taxonomy already had the word — a **modifier**, since every bar
  draws a barline regardless, so removal returns the default stroke rather than
  removing ink. Results: reachable scenarios **24 → 42** (the predicted +18, exactly),
  removable elements **758 → 814** (all 56 family elements, no `broken` verdicts), and
  a fourth recorded trace (`spec/hello-world`, 14 intents from `{}`).
- **[core-element-ops-clef-key.md](inprogress/core-element-ops-clef-key.md)** —
  campaign item 5, **the first op-family item** and the campaign's biggest single step.
  **Built 2026-08-14**, same day as proposed, chosen by item 3's histogram rather than
  taste: `clef` blocked 96 of 106 scenarios. Ships the **inherited-attribute pair** —
  `setClef`/`removeClef`, `setKeySignature`/`removeKeySignature` — at the popover tier
  (**Shift+C**, **Shift+K**) on the **measure rung**, with `KeyDoc` rows landed in the
  same change per the contract. The removal half is the interesting half: removing a
  clef removes a *declaration*, so the bar reverts to its predecessor's governance (or
  the engine default, which for a tab part is the guitar treble-8) — never to "no
  clef" — and the grammar says so in a word, **`inherit`**, because Del at the measure
  rung already means "remove the empty bar". Results: reachable scenarios **3 → 24**,
  removable elements **651 → 758** (101 of 113 clefs, all 6 key signatures), a third
  recorded trace, and the next blocker down to `beam` at 10. It also taught the
  campaign a rule: **a verb without an address is invisible to the sweep** — declaring
  the ops moved nothing until the walk learned to navigate to a bar.
- **[core-element-ops-construct-traces.md](inprogress/core-element-ops-construct-traces.md)** —
  campaign item 3: **the forward verdict for all 106**, the half item 2 built backwards.
  **Built 2026-08-14**, same day as proposed. A trace cannot be generated — it is a
  recorded performance — so the forward answer is deliberately two things: a
  **prediction** computed statically from the element inventory (does every kind this
  scenario contains have a construct verb?) and a **verdict** earned only by a committed
  trace replaying from `{}` against the goldens. Where they disagree, the disagreement is
  the finding, and both directions turned up immediately: `open-strings-chord` traces
  green while blocked on a clef the goldens never see, and `empty-tab-canvas` is
  predicted reachable yet untraceable because `appendMeasure` writes four explicit rests
  where the template has none (the tier model is kind-shaped and blind to op semantics).
  The campaign contract's **op pair moved onto the kind table** — one row per kind
  carrying both `construct` and `remove` — which promptly showed the destruct sweep had
  never attempted `toggleTie`, a removal verb it owned all along (12 of 13 corpus ties
  now `removed`). Baseline: **traced 2 · ops-reachable 1 · blocked 98 ·
  expected-unreachable 5**, and one number settles the campaign's ordering: **`clef`
  blocks 96 of 106 scenarios**, so item 5 is next on evidence rather than taste.
- **[core-keymap-cheatsheet.md](inprogress/core-keymap-cheatsheet.md)** — a **selection-mode-
  dependent keyboard cheatsheet**, built by making the ladder's per-level navigation map DATA.
  The keymap's binding tables are already data, but the *meaning* of a key at each rung lives
  in `session.navigate` (arrows move by the rung's unit, voice jumps only at note level) — a
  cheatsheet from bindings alone would say "→: next position" at every rung. **Stages 1–3
  built 2026-08-11** (same day as proposed): the `KeyDoc` meaning table over all 45 bound
  strokes (`src/edit/keymapDocs.ts`, seven groups Navigation → Adornments → Workbench), the
  hud-tab "keys · at this level" section
  ([core-score-hud.md](inprogress/core-score-hud.md) — rows are the nouns, keys are the
  verbs), the actions tab's drifting hand-written hint retired, and
  `harness/conformance/keymap-docs.test.ts`: both joins (every binding documented, every doc
  bound) plus guard mirrors (voice jump note-only, toggleNote notation-only, arrows inert at
  score) so the cheatsheet cannot lie. Static meaning, not a live enablement oracle;
  physical-key labels per the keymap's `KeyboardEvent.code` decision. **Remaining: stage 4**
  — each [core-selection-ladder.md](inprogress/core-selection-ladder.md) per-level review
  pass lands its key decisions here as data (event next).
- **[core-score-hud.md](inprogress/core-score-hud.md)** — a **HUD companion** beside the viewer:
  the selection ladder's missing *property surface* as one row per containment level (score /
  section / bar / part / voice / event / note), active rung highlighted, rows clickable for
  mouse parity with Escape/Enter. Rows are the *address chain*, highlight is the *rung* (part
  is deliberately not a rung); presence rule drops absent rows. The part row is an **ensemble
  table** owning the **per-part strings/capo override** — the global `TabSetup` reshaped into
  a per-part map, closing the multi-part gap (a global override clobbers declared parts and
  infects the rest — twelve-bar-blues). **Stages 1–3 built 2026-08-11** (same day as
  proposed): `mnx-score-hud` + the session→`HudRow[]` mapping, click-to-level through the
  intent funnel, engine `PartTabSetups` end to end, the override's `staffKind` intent (an
  explicit entry opts a part's fingerboard in), and the kind-less both-view fallback
  generalized to every known-strings part — goldens byte-identical, verified hands-on in
  headless Chrome (bass override gains its own 4-string staff beside the guitar's declared
  tab). **Same-day revision**: the HUD anchored a full **side-panel consolidation** — the
  scenario page's chrome became one tabbed rail (description | tags | actions | hud |
  compare | json), the edit strip's duplicated cursor readout deleted, compare reduced to
  the reference pane, legacy `?view=compare|json` links opening the matching panel tab.
  Incubates in `workbench/` against a neutral contract (`elements/` never imports
  `edit/`); the selection half promotes with the editor
  ([core-editor-element-promotion.md](proposed/core-editor-element-promotion.md)), the
  instrument half is viewer-tier and may promote earlier. **Remaining: stage 4** — rung
  property edits through ops, parked behind the ladder's per-level pass.
- **[core-selection-ladder.md](inprogress/core-selection-ladder.md)** — **progressive selection as
  the input-mode system**: input modes *are* the selection level, and each level offers
  exactly the properties the data model puts there. One containment ladder (note → event →
  [container] → voice-measure → part-measure → measure → [section] → score) walked
  vertically by Escape/Enter (breadcrumb descent, relative addresses), with the horizontal
  axis as a second gesture family — Shift+arrows extend, **Ctrl+A is the closure** (closure
  at part-measure = the part, which is why part is not a rung). Presence rule skips absent
  rungs; ghost enclosures let the cursor address what *could* exist (selection addresses
  what is). One visual vocabulary — the enclosure — from a square note cell through column
  slices, voice-run hulls and growing panels to the score frame, so Escape/Enter
  animate as a single shape tween that teaches containment. Both view shows primary +
  echo per projection (the active-projection bit also picks the input dialect: ↑↓ = pitch
  vs string). Builds on [core-editor-input-layer.md](complete/core-editor-input-layer.md)'s
  intents/traces/overlay substrate; the section rung is live evidence for
  [spec-score-text.md](proposed/spec-score-text.md)'s proposed field. **Phases 1–2 built
  2026-08-09**: the vertical ladder as session state (`src/edit/selection.ts`,
  Escape/Enter intents, level-scaled arrows with section jumps) pinned by
  `harness/conformance/selection.test.ts`, and the enclosure vocabulary
  (`src/elements/enclosure.ts` — cell → slice → run → panel → panel-wide → frame from
  the rendered SVG's own geometry; the both view's part-measure panel spans the
  notation+tab pair via the shared-barline join; voice-measure revised to a single run
  hull, part-measure/measure to the ink/space principle). **Next: the per-level
  navigation map** — decide what every key means at each rung (e.g. ↑↓ at event level =
  next voice?), built one level at a time with a hands-on review after each. Then:
  extension/closures, the relax/tighten animation, primary/echo asymmetry, ghost cells,
  container rungs.

### complete/
- **[core-element-ops-exemplar.md](complete/core-element-ops-exemplar.md)** — campaign
  item 1 of [core-campaign-element-ops.md](inprogress/core-campaign-element-ops.md):
  **the forward/reverse harness algorithm proven small** over `minimal-single-note`
  and `open-strings-chord`, **complete 2026-08-14** (stages 1–4 built 2026-08-12, the
  same day as proposed; stage 5 — the hands-on pass and the learnings threading —
  closed on the 14th). Landed: the genesis ops (`addPart` skeleton-on-demand +
  `setStaffKind` — discovered necessary: the kind gates the tab/both projections, so
  the goldens see it) and `{}` hardening across `edit/`; the construct-trace fixture
  kind + forward harness (schema, undo-to-`{}`, the static **keyboard join** over
  `SURFACE_INTENTS`, the key-normalized **primitives verdict**, informational
  doc-delta); the destruct sweep v0 (per-element address → delete → oracles from fresh
  sessions, two-order exhaustive pass); and the **ops panel** — a side-panel tab
  rendering the intent-stamped op queue as provenance rows (op · intent · key via the
  `opRows.ts` reverse join), click-to-jump undo/redo, the baseline "start" row, and the
  replay-construct / run-destruct buttons, plus the Shift+P part popover. Results:
  `minimal-single-note` replays **byte-identical** from `{}` (11 intents → 5 ops); the
  chord passes the primitives verdict with a doc delta of exactly its note ids +
  declared clef. The destruct terminal was revised mid-review from ink-free to **the
  literal `{}`** (a container is removable only once empty, so teardown never destroys
  ink), closing the round trip both ways. Goldens untouched throughout; the walk is
  shared verbatim by harness and panel (`src/edit/destructWalk.ts`). Its v0 limits are
  logged as items 2–3's inheritance in the campaign.
- **[lab-04-scenario-library.md](complete/lab-04-scenario-library.md)** — the scenario corpus
  structure (`spec/` + `lab/`, path-derived ids, `meta.json`, dual-verdict `expect`, the
  primitives/SVG/both goldens, `check-scenarios`), **closed 2026-08-09** fully populated
  against the pinned spec: 104 scenarios (52 mirrored + 52 lab), 18 lab categories
  including tab-fingering, tab-techniques, five invalid-by-design spec-gap exhibits,
  percussion and layout, and **feature-def coverage 105/108** with the plumbing
  exclusion list shared between the checker and `#/objects` via `manifest.json`. The
  three uncovered defs are recorded in the doc with reasons (`line-type`,
  `slur-tie-end-location` — an orphan def nothing references, `smufl-font`). New spec
  pins, proposals and renderer features open their own tickets from here.
- **[core-editor-input-layer.md](complete/core-editor-input-layer.md)** — the **editor's input layer**,
  complete 2026-08-09: a declarative keymap (key → intent), a pure state machine
  (intent + selection → `EditOp`), and **intent-trace fixtures** that are also recordings
  ("copy trace" → `harness/fixtures/edit-traces/`, replayed by vitest, undo-all must
  round-trip byte-identically). Editor edits the model, renderer reacts; the cursor is a
  **rhythmic position, not a note id** (empty measures must be navigable). Shipped across
  2026-08-03: string-mode cursor with entry ghosts, note entry/deletion/duration, two-digit
  fret combining, **setup-as-ops** (`setTuning`/`setTimeSignature`) behind Shift+T/Shift+U
  popovers, **rests & ties** (§8.11's no-rest-key model), the **command palette**
  (`Ctrl+K` commands / `Ctrl+G` go-to, bar jumps as a traceable `goToMeasure` intent), the
  `lab/document/empty-tab-canvas` template and the from-scratch flagship trace. Both
  descendants live in proposed/: the AI mode
  ([core-editor-ai-prompt.md](proposed/core-editor-ai-prompt.md)) and the `elements/` promotion
  ([core-editor-element-promotion.md](proposed/core-editor-element-promotion.md)). Grounded in
  [research/notation-editor-keyboard-models.md](../research/notation-editor-keyboard-models.md).
- **[core-guitar-pro.md](complete/core-guitar-pro.md)** — **Guitar Pro ⇄ MNX** conversion at
  `converters/guitarpro-mnx/`, using **alphaTab** as a headless format codec (no binary
  parsing hand-written), complete 2026-08-09 with **56 tests**. Reads gp3/gp4/gp5/gpx/gp,
  writes `.gp` (GP7 — the only format anything can still write). The score corpus is
  **authored as `.gpx`**, with `.mnx.json` and `.xml` derived from it — and
  `tests/import.test.ts` now pins that derivation byte for byte, so the import side is
  exercised against real Guitar-Pro-authored binaries rather than only our own output.
  `MNX → .gp → MNX` round-trips **all three reference scores with zero differences** —
  notes, technique (bends as curves, harmonics, palm mute), chord symbols, lyrics,
  repeats, voltas, sections, tempo, tuning, capo, key — schema-valid. Scoped out with
  reasons recorded: gp3/gp4/gp5 reader coverage (alphaTab's code, not ours) and manual
  acceptance in the GP *application* (downgraded to a caveat — the container is
  alphaTab's contract, and the one real-consumer finding came from an Ultimate Guitar
  upload, which needs no desktop app).
- **[core-both-view-single-system.md](complete/core-both-view-single-system.md)** — the notation+tab
  `both` view as **one engraved system**, complete 2026-08-08. Tab is a **native display
  staff** in the notation layout's system walk (`includeTabStaves`; seam `layoutBothSystem`) —
  single-stroke shared barlines, interleaved multi-system wrap, fret emission shared with the
  standalone tab layout via `tabStaff.ts`. Phase 3 added the **`expected.both.svg` golden**
  (SVG-only, optional `bothHash` provenance — zero demotions), tab repeat dots, the
  content-driven lyrics gap, and the compare-pane preference; all 13 both goldens
  human-approved and `bothHash`-stamped the same day. Deferred out: scores-doc injection
  (awaits a real fixture) and grace/tremolo tab parity (owned by the tab renderer).
- **[lab-structure-lab.md](complete/lab-structure-lab.md)** — **the adopted repo structure,
  executed 2026-07-31 as a fresh-slate rebuild of main** (pre-rebuild history on the
  `legacy` branch + `pre-rebuild` tag). Capability layers with machine-enforced
  boundaries (`model → engine · audio · edit · corpus · storage; elements; ui/entries
  as leaves; worker ≤ model+assist`); one scenario format with two axes
  (origin: mirrored/local × schema: published/proposed); the symmetric
  `sync:spec`/`push:proposal` spec-loop pipeline with `spec/proposals/<topic>/`
  evidence bundles and the submodule as pin-only (proposal branches in worktrees);
  scores moved to `converters/fixtures/`; the backend-less, review-first **workbench**
  (attention-queue home, compare view, deep links) with approval as the conversational
  `/verify` skill over `verification` provenance; embed + `mnx-lab` library build
  faces; reserved studio/edit/storage seams. Execution deviations recorded in the
  doc's appendix.
- **[lab-spec-approval.md](complete/lab-spec-approval.md)** — the spec-by-spec renderer verification
  sweep, **complete (57/57 verified: 49/49 spec + 8/8 lab)**. The per-scenario scoreboard, the
  approval bar, the renderer's capability list + deferred-polish backlog, and the "how to add a
  renderer feature" recipe — still the process for verifying any newly-added scenario.
- **[lab-clean-room-plan.md](complete/lab-clean-room-plan.md)** — index/methodology for the pivot plan
  (was `clean_room_impl/README.md`).
- **[lab-00-vision.md](complete/lab-00-vision.md)** — goals 1–8; all realized (AI demoted to the
  sketches-only Assist drawer, as designed).
- **[lab-01-principles.md](complete/lab-01-principles.md)** — P1–P10; all honored **except P2**
  ("every capability is a package / monorepo"), which reality contradicts.
- **[lab-03-rollout.md](complete/lab-03-rollout.md)** — the 7-phase sequence; all phases shipped
  in-place (phase-3 spec coverage is the ongoing part, tracked in
  [lab-spec-approval.md](complete/lab-spec-approval.md)).
- **[lab-module-specs.md](complete/lab-module-specs.md)** — planned just-in-time module specs; **none
  written** (moot without the monorepo).
- **[core-musicxml.md](complete/core-musicxml.md)** — MusicXML⇄MNX assessment; the converter is built at
  `converters/musicxml-mnx/`.

### superseded/
- **Structure sketches** — three of the four self-contained restructuring sketches
  (alternatives for a single decision), superseded by the adopted
  [lab-structure-lab.md](complete/lab-structure-lab.md), which composes two of them:
  - **[lab-structure-toolchain.md](superseded/lab-structure-toolchain.md)** — an npm-workspaces
    monorepo of publishable `@mnx-lab/*` packages with a one-way dependency graph; apps
    become thin consumers. *Deferred, not rejected* — the recorded trigger for revisiting
    is a real external consumer needing independent versioning.
  - **[lab-structure-platform.md](superseded/lab-structure-platform.md)** — one deployable modular
    monolith: capability layers inside `src/` with machine-enforced import boundaries;
    embed and library as extra build faces. *Absorbed into structure-lab* (the code half).
  - **[lab-structure-workbench.md](superseded/lab-structure-workbench.md)** — reorganize around the
    data and evidence (`spec/` / `corpus/` / `harness/` / `cli/`). *Absorbed into
    structure-lab* (the data half).
- **[lab-02-architecture.md](superseded/lab-02-architecture.md)** — the **monorepo package split**
  (`mnx-core`/`mnx-render`/`gallery`/…). Not adopted: the app stayed a single `mnx-lab` in
  `src/`. The *contracts* (C1 validate, C2 layout→primitives→draw, C6 loader) live on as
  internal `src/` modules, just not as packages.
- **[lab-tech-stack.md](superseded/lab-tech-stack.md)** — pre-pivot "locked-in" stack; names **VexFlow**
  (since replaced by the custom SVG engine — CLAUDE.md now forbids notation libraries).
- **[workbench-ux-layout.md](superseded/workbench-ux-layout.md)** — pre-pivot AI-first glassmorphic UI; replaced by
  the 2026-06 reading-room redesign (`mnx-library-rail` + `mnx-scenario-header` +
  `mnx-assist-drawer`).

## Not here (reference docs, left in place)

`CLAUDE.md`, `README.md`, `SVG_RENDERING_ENGING.md`, `docs/mnx-extensions.md`,
`schemas/HISTORY.md`, `research/mnx_format.md` — these are current reference, not plans.
