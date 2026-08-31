# Roadmap

Planning docs for MNX Lab, filed by their status **relative to the current codebase**. This
is an archive of intent, not a live task board. The recent driver — the spec-approval sweep —
is now complete ([complete/lab-spec-approval.md](complete/lab-spec-approval.md), 57/57 verified); the
corpus contract is [complete/lab-04-scenario-library.md](complete/lab-04-scenario-library.md), closed
2026-08-09 — corpus growth now arrives as its own tickets, not through that doc. Ongoing
verification debt is tracked in [inprogress/lab-verify.md](inprogress/lab-verify.md), a
standing ledger rather than a work item.

The big picture: the `clean_room_impl/` **pivot plan** (library-first: scenarios → gallery →
render → tab → playback → editing → AI-last) was **executed by refactoring the existing app
in place**, *not* by the from-scratch monorepo of packages it proposed. So most of that plan
is "done," its scenario-library structure is the living corpus contract, and its package
architecture was dropped. The older pre-pivot docs (AI-first UI, VexFlow stack) are superseded.

## Buckets

| Bucket | Meaning |
|--------|---------|
| `proposed/` | Described but not built. |
| `proposed/low-priority/` | Described, still wanted — but **unlikely to be worked on soon**. A priority signal, not a verdict: nothing here has been argued against, and a doc moves back up to `proposed/` the moment it is picked up. "What's next" answers from `proposed/` itself. |
| `inprogress/` | Actively being worked / a living contract. |
| `complete/` | Built and shipped (kept for provenance; may be aspirational in tense). |
| `superseded/` | Overtaken by reality or a later decision; kept for history, **not current**. |
| `rejected/` | Judged **not worth building** — kept so the next person to raise the idea finds the case against it instead of redoing the analysis. A `proposed/` item of near-zero value or "will never do" status may be demoted here (by Claude on its own judgement — see CLAUDE.md → Conventions); the doc's status records the reason and date. |

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
- **[core-editor-element-promotion.md](proposed/core-editor-element-promotion.md)** — promoting the
  editor's mount layer out of `workbench/` into `elements/`, making it consumable by the
  embed face and studio. Split out of [core-editor-input-layer.md](complete/core-editor-input-layer.md)
  when that closed. **Deliberately parked** behind a two-part trigger — the intent
  vocabulary stabilising AND a real second consumer asking for editing (a check, not a
  debate) — with the costs of moving early recorded (API pressure on the public surface,
  the shadow-DOM focus story coming due, embed bundle weight; testing is unchanged either
  way). The promotion review's work list: the `elements/ → edit/` boundary change, the
  element contract under [core-viewer-surface.md](complete/core-viewer-surface.md)'s layered rule,
  focus story, code-splitting, and the palette's `elements → assist` question from
  [core-editor-ai-prompt.md](proposed/low-priority/core-editor-ai-prompt.md).
- **[core-selection-tray-residue.md](proposed/core-selection-tray-residue.md)** — part 3,
  **repurposed 2026-08-24** from the ledger of what cannot be wired yet into the **triage
  ledger**: the registry's 86 rows across 98 placements, each carrying three marks —
  **tested** (clicking it does what the label promises, a human verdict), **grouped** (it
  sits with its relatives; the bar rung's repeat family is one thing and does not read as
  one today), **ordered** (the natural index inside that group, not the order the rows
  were typed in). **The purple half is built**: a placement with none of the three draws
  in `--tile-untriaged`, a flag deliberately *orthogonal* to `TrayTileState` (a tile can
  be untriaged and already active), so with the ledger empty **every tile in the tray is
  purple** — the tray's own *never seen*, in the vocabulary the corpus already uses for
  `valid` vs `verified`. Six decisions recorded (one purple not three; purple never
  overrides `unavailable`, enforced upstream in `isTriaged` so the CSS never arbitrates;
  the mark lives in the registry beside `blockedBy` where conformance can hold it honest;
  `tested` is per placement because twelve rows appear at two rungs; the colour is a
  `light-dark()` token, never a literal; two cascade exceptions for the active glyph and
  the keyboard cursor), one left open (does purple ship to embed/studio). What remains is
  the ticking, which is human work. The old residue survives as an **appendix** of seven
  blocked placements, so every `blockedBy` id still resolves — and it caught two
  (`arpeggio`, `section-colour`) greyed with **no address at all**, which the existing
  test could not see because it asserts a blocker exists, not that it resolves. Both
  halves must close for `complete/`.


### proposed/low-priority/
Still wanted, still described — just not next. Nothing here has been argued against
(that is `rejected/`); these are the items unlikely to be picked up soon. A doc moves
back up to `proposed/` the moment it is.

- **[core-assist-evals.md](proposed/low-priority/core-assist-evals.md)** — rank models on **our
  corpus instead of on reputation**. Split out of the model selector (2026-08-22) as
  the one thing it deliberately did not build. `MODEL_PRIORS` is seventeen families of
  hand-read leaderboard numbers; `worker/editLoop.ts` was factored for evals and
  already computes the metric that matters — first-attempt schema-valid rate, retries
  consumed, terminal failures — because an intelligence index is a claim about a model
  in general and the edit loop asks something far narrower. `/api/v1/generation`'s
  realized `total_cost` is also the measured answer to the token-mix estimate
  `DEFAULT_TOKEN_MIX` currently guesses. Open decisions: what an eval case is (a
  scenario is a document, not an edit — the edit-op traces are the nearest shape), who
  pays, how measured numbers land as committed data **distinguishable** from declared
  priors, and sampling under non-determinism. Not a general benchmark; no automatic
  promotion.
- **[core-percussion-kit.md](proposed/low-priority/core-percussion-kit.md)** — the `kit-component`,
  `kit-note` and `sound` kinds, handed over alongside it. A kit part has no pitch axis
  (the vertical axis is a component NAME the document declares, so there is nothing to
  derive — the no-instrument-assumed rule one level up) and a component is referenced
  rather than placed, so the verb order is fixed by the reference. One scenario.
- **[spec-mnx-cg-proposals.md](proposed/low-priority/spec-mnx-cg-proposals.md)** — **where** chord symbols, section
  labels and technique should live, designed to be adoptable by the MNX CG rather than to stay
  private `_x` fields. Checked against the CG's live issues: #109 chord symbols, #112/#377
  rehearsal marks (the spec editor asked for a proposal and nobody wrote one), #63 guitar tab,
  #110 fretboard diagrams — all open, all unclaimed. Derives an acceptance template from the
  dynamics rework (#518, proposed → merged in three weeks). **The designs are now built**
  (as `_x.mnxLab` v3, since evolved to v5 — see [docs/mnx-extensions.md](../docs/mnx-extensions.md));
  rehearsal/section labels are now drawn, and §3's placement half is superseded by
  [spec-score-text.md](proposed/low-priority/spec-score-text.md) — post from there. What is left here
  is the outward half: join the CG, sign the CLA, and post the proposals.
- **[spec-score-text.md](proposed/low-priority/spec-score-text.md)** — **where text belongs in MNX.** v27 allows free
  text in seven places (lyrics, naming, two dynamics decorations) and a bar can carry no text
  at all, so rehearsal marks, section names and performance directions have nowhere to go.
  Proposes typed `rehearsal`/`section` on the global measure beside `segno`/`fine`/`jump`, plus
  generic `directions[]` on the part measure shaped like `dynamic-group`. Key argument: typing
  makes placement derivable, which is why Soundslice needs an inner/outer axis and MNX would
  not. Includes a round-trip stress test — 3 of 4 directions are destroyed or misclassified
  today, and the corpus never catches it. Supersedes the placement half of
  [spec-mnx-cg-proposals.md](proposed/low-priority/spec-mnx-cg-proposals.md) §3.
- **[spec-instrument-position.md](proposed/low-priority/spec-instrument-position.md)** — **where a note is played**:
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
  posted; complements [core-guitar-technique.md](complete/core-guitar-technique.md) (what the hands do).
- **[core-editor-ai-prompt.md](proposed/low-priority/core-editor-ai-prompt.md)** — the **third input
  mode**: typed text routing to `/api/edit-notation` when it reads as a sentence rather
  than a command (research §6.2), inheriting the `ui/ → assist/` boundary. Where it
  lives is a design question the item owns — the original `Ctrl+K` home predates the
  tray split (`/` = commands, Ctrl+G = go-to; Chrome reclaimed Ctrl+K). Owns the deeper
  convergence `src/edit/ops.ts` has always named: the assist loop emitting **`EditOp[]`
  through `applyOp`** instead of replacing whole documents, so AI edits land in the session's
  undo history and op log like keyboard edits. Split out of
  [core-editor-input-layer.md](complete/core-editor-input-layer.md); absorbed the
  **voice stage** (two-stage transcribe-review-submit, Worker-side transcription) from
  the retired [core-open-router.md](superseded/core-open-router.md) on 2026-08-20.
- **[studio-storage-sync.md](proposed/low-priority/studio-storage-sync.md)** — **studio's storage, sync
  and sharing**: a hand-rolled op-log sync engine in the Replicache mold (server-authoritative
  rebase over `EditOp`/`applyOp` — CRDTs rejected with reasons), persisted as a SQLite Durable
  Object per document + D1 library layer + R2 snapshots, IndexedDB demoted to replica. Library
  model is **multi-dimensional tags** (path/setlist asserted; tuning/artist derived by the doc
  DO, never stale) and **the tag is the unit of share** — live sets, materialized grants,
  capability URLs — over a tier ladder (URL-fragment → tag-shares → git/jsDelivr publish →
  Drive as export only). Records the adoption-day snapshot barrier, the worker/`applyOp`
  boundary question, free-tier→$5 cost shape, and a five-stage build order starting with
  whole-document LWW through the existing `DocumentRepository` seam.
- **[core-lowvision-reflow.md](proposed/low-priority/core-lowvision-reflow.md)** — should the plan's
  line width be measured in **ink**, so growing the staff reflows the music instead of
  overflowing it? Left open by the 2026-08-21 low-vision range (staff ceiling 160% → 640%,
  density 2 → 8, both landed). Measured: at 640% the vertical arm alone makes a system
  ×2.6 the line width (sideways scrolling per system); with the horizontal arm too it is
  ×1.1 (one bar per system, scrolling down) — so the good outcome exists but needs both
  arms, and reaching only for the obvious one is the worst of the three. The tension is
  live: reflow re-couples the axes that core-zoom-density-pad ruling 2 separated and that
  core-ink-priced-columns froze packing to keep separated. Four options costed, from "do
  nothing, document it" to "always ink-measured", with coupling-in-the-control carrying
  the best precedent.

### inprogress/
- **[workbench-one-surface-lyrics.md](inprogress/workbench-one-surface-lyrics.md)** —
  one-surface campaign item 6, **phase 1 built 2026-08-31** (design settled the same
  day): the lyric popover retired — verse-line metadata (`line 2 Nederlands nl`) lives as
  document-rung pills, syllables stay at the event rung, and `Shift+L` is freed,
  earmarked for the phase-2 surface. Remaining: phase 2, a paste-and-tweak lyric **text
  surface** (LilyPond-kin format — hyphen/underscore runs, `~` elision, bar checks,
  language headers — applied as ordinary ops); phase 3, the derived **pass model** (a
  shared repeat-linearization walk feeding pass-aware line resolution, labels and a blue
  diagnostic — the future player's foundation).
- **[workbench-campaign-one-surface.md](inprogress/workbench-campaign-one-surface.md)** —
  **campaign**, item 1 built 2026-08-31: retire the ten `Shift+letter` popovers and the
  selection tray onto the rung inspector, one surface per item, ordered simplest to
  hardest. Every retirement is gated on demonstrated coverage: census before coverage,
  coverage before removal, ops before surfaces. Items 1–5 (key ✅, time ✅, clef ✅, bar
  attributes ✅, adornments ✅) are census-and-sweep — all five done; 6–7 (lyrics 🔧 phase 1
  built, tuning ✅) each close one bounded gap; 8–10 (rhythm ✅, part ✅, layout ✅) need new ops or a construct story; 11 (the
  tray) retires a charter, re-homes the verbs, and goes last. Standing ruling from item
  1: freed keys are freed, not accelerators.
- **[core-selection-range-grain.md](inprogress/core-selection-range-grain.md)** — **decisions 1–4 built 2026-08-30** (section and container rungs retired, staff off
  partMeasure identity; spanner work remains); the
  ladder's rungs re-read as **range grains**, out of a 2026-08-30 rung-by-rung review:
  the `section` rung goes (a label with an emergent span, the same test that excludes
  `voice`) with its value reabsorbed at the bar rungs — Ctrl+Shift+←/→ extends to the
  section boundary; the `container` rung goes via the **coincidence rule** (an event
  range exactly covering a tuplet's content offers its settings/unwrap; partial
  coverage says "part of a tuplet"); `staffIndex` comes off partMeasure's identity
  (staff is an address, not a thing — the member covers all staves as one panel, ↑↓
  walks parts, part-wide tiles become honest); spanners get three add models (implied
  next-item end, press-again-to-extend, range-sets-extent), delete from any referenced
  position, and the coincidence rule generalized — a container is just a spanner the
  schema promoted into the tree. The voiceMeasure/partMeasure collapse was considered
  and parked: do nothing, the doc records why. Resulting ladder:
  `note → event → voiceMeasure → partMeasure → measure → document`.
- **[core-measure-attributes-gaps.md](inprogress/core-measure-attributes-gaps.md)** — **in progress 2026-08-28; items 1–2 (badge, four bugs) built the same day.** A census of every measure-level attribute (`measure-global`, `part-measure`,
  the three proposed objects the engine draws, `_x.mnxLab.harmonies`) across five columns —
  render / badge / op / pill / corpus — cited to file and line, then a ranked work list.
  Prompted by `spec/measure-repeats-with-counters` reading as a regression once the rung
  inspector named `measure repeat: 1` on an empty bar: it never was one, the engine has
  never drawn a measure repeat and the verified golden pins an empty staff. The finding
  above the others: **no measure-level attribute ever produces the amber renderer-gap
  badge** — four scenarios tagged `renderer-gap` render as bare staves with zero
  diagnostics. Not rendered at all: measure repeats, arpeggios, fermatas, measure numbers,
  harmonies. Partial: hairpins and relative dynamics draw nothing, the C clef draws as
  treble, `tempos[0]` only, tab lacks repeats/voltas/dynamics. Four confirmed bugs, two of
  them the inspector's (a dropped tempo index, a staff-blind `removePositioned`). Work
  order: badge first, bugs second, then the engraving items through the ledger.
- **[core-chord-symbols.md](inprogress/core-chord-symbols.md)** — chord symbols. **Data path
  shipped** (2026-07-26) as `global.measures[i]._x.mnxLab.harmonies[]`, lossless through both
  converters; **rendering and editing shipped** (2026-08-29): each symbol over its column,
  `chord Am7` writes one. Open: fretboard diagrams, transposing a symbol with the notes.
- **[workbench-rung-inspector.md](inprogress/workbench-rung-inspector.md)** — **in progress 2026-08-28; all five stages built the same day** (open only on the container verb) — [design canvas](https://claude.ai/code/artifact/6d09ff2a-d82a-4cba-a653-3d4245fa26a3);
  placed over the score where the tray sits, keyboard-first — a vertical three-row rung window beside a hard three-row attribute area, identity as floor pills; machinery in `edit/inspector.ts`,
  driven hands-on by `npm run smoke:inspector`. A third editing surface, tried *beside* the tray and the Shift+letter
  popovers so use decides which wins: **Enter opens an inspector on the current rung** —
  the cursor's path as a breadcrumb of identity pills (the HUD's rows, horizontal), the
  rung's attributes as deletable pills derived from the ops' typed unions, a blank slot
  with typeahead. One rule resolves the add/go-to/amend collision: bare typing always
  adds, everything else is reached by opening a pill first (crumbs are pills whose value
  is a reference, so go-to is Enter-arrow-Enter). Two-step Backspace maps onto the
  removal classes — annotation pills clear then remove, modifier pills revert to a floor.
  Verbs stay in the tray (`/` widens to it); Ctrl+G's contract untouched. Records that the
  popovers are feature-first by accident of campaign order and that adornments are five
  op shapes, not one; bend's op must widen to the model's curve before technique pills.
- **[lab-verify.md](inprogress/lab-verify.md)** — **the standing verification ledger**, and
  the only doc here that never moves to `complete/`. `verified` is a human assertion, so
  verification is the one gate an agent cannot pass alone, and any change under `model/`,
  `engine/` or `scenarios/` leaves a pile of demoted scenarios behind it. The contract:
  **a work item may close owing verification, provided the debt is registered here with its
  cause** — what moved, which scenarios, and what a reviewer should be looking at. It is
  deliberately *not* a copy of the queue (that is derived and always current via
  `npm run verify:scenarios -- --list`); it holds the *why*, which provenance cannot record.
  Opened 2026-08-22 with 37 stale + 8 never-seen in three batches: `core-ink-measured-gaps`
  (33, across stages A/C/D and the tab row pads), the barline-default fix (4, no owning
  doc), and the never-reviewed corpus-closure technique set (8). Batches 4
  (`core-guitar-technique`, 5) and 5 (`core-tuplets-grace-notes`, 3) followed on
  2026-08-24 — both never-seen rather than demoted, so the stale count is unchanged.

### complete/
- **[workbench-one-surface-layout.md](complete/workbench-one-surface-layout.md)** —
  one-surface campaign item 10, **built 2026-08-31**: the LAST popover retired — the
  layout grammar moved wholesale to the document rung (summary pills, sentence amends,
  slot/id resolution via the parse context; the `layout-authoring` residue row closes) —
  and the campaign's founding debt is paid: **`Shift+S` is the shift slide**, with
  `slideType` on the technique union and typed `slide shift`/`slide legato` forms.
- **[workbench-one-surface-part.md](complete/workbench-one-surface-part.md)** —
  one-surface campaign item 9, **built 2026-08-31**: the part popover retired; part facts
  (name — the rename that never existed — staves, staff kind) live at the part-bar rung,
  the document rung earns its first words (`part <name>` as construction-by-declaration,
  the explicit-marking flags as pills), and `setStaffKind` joins the parts[0]-widening
  family; five tiles and two glyph twins retire with it.
- **[workbench-one-surface-rhythm.md](complete/workbench-one-surface-rhythm.md)** —
  one-surface campaign item 8, **built 2026-08-31**: the rhythm popover retired on the
  campaign's first new verb — `setContainerProperties` (presentation fields only,
  address-free, resolved from the coincidence), closing the residue ledger's
  `container-properties` row; construction landed as typed declarations at the honest
  rungs, plus two derived readings: `at` on events, `fill` on voice-bars.
- **[workbench-one-surface-tuning.md](complete/workbench-one-surface-tuning.md)** —
  one-surface campaign item 7, **built 2026-08-31**: the tuning popover retired after the
  write path was built — a `tuning` word (presets or pitch lists) offered on any part, the
  read-only strings pill made a removable annotation, and the `setTuning` parts[0] bug
  fixed with a partIndex widening before the surface shipped; both tiles and the
  `needsTab` machinery died with it.
- **[workbench-one-surface-adornment.md](complete/workbench-one-surface-adornment.md)** —
  one-surface campaign item 5, **built 2026-08-31**: the adornment popover retired — the
  broadest grammar of the easy five (eight parser arms, thirteen intents) and the purest
  sweep, with parity automatic through `parseAdornmentLine`. Five tiles deleted, four
  stray badges stripped pre-emptively; the census-and-sweep half of the campaign closes.
- **[workbench-one-surface-bar.md](complete/workbench-one-surface-bar.md)** — one-surface
  campaign item 4, **built 2026-08-31**: the bar-attribute popover retired — the largest
  census of the easy five (every measure-attribute kind plus the two rhythm riders), six
  popover-tier tiles deleted, and the seam repaired: the measure rung's rider refusal now
  signposts the voice rung instead of the deleted Shift+B.
- **[workbench-one-surface-clef.md](complete/workbench-one-surface-clef.md)** — one-surface
  campaign item 3, **built 2026-08-31**: the clef popover retired; the partMeasure rung's
  per-staff pills and typed `clef` word cover the grammar (`inherit` and the octave forms
  now asserted). First rung casualty — the tile's `measure` cross-listing dies, and the
  cursor-staff wart on multi-staff parts is logged as ops residue, popover parity held.
- **[workbench-one-surface-time.md](complete/workbench-one-surface-time.md)** — one-surface
  campaign item 2, **built 2026-08-31**: the time-signature popover retired; coverage
  pre-existed (the `time` pill's floor semantics plus the typed branch's full grammar,
  `common`/`cut`/`inherit` included — two assertions added). First global-tab casualty:
  the `doc-time` tile went with the measure tile.
- **[workbench-one-surface-key.md](complete/workbench-one-surface-key.md)** — one-surface
  campaign item 1, **built 2026-08-31**: the key-signature popover retired — the
  inspector's `key` pill/word already covered the whole grammar (evidence pre-existed in
  `rung-inspector.test.ts`), so the item is the pure sweep, plus the campaign's standing
  ruling: freed keys are **freed, not accelerators** (`Shift+K` is unbound; lyrics may
  later argue the exception).
- **[workbench-document-focus-mode.md](complete/workbench-document-focus-mode.md)** — **finished
  2026-08-30** with two honest fullscreen levels. `Ctrl+Alt+F` toggles transient **document
  focus**: header, rail, view strip and panel disappear while the document viewer fills the
  browser viewport; the zoom pad remains, with a permanent focus/exit toggle, and invoked
  editing overlays stay usable. Remembered pane preferences remain untouched. Native `F11`
  stays browser-owned, with a separate feature-detected Fullscreen API palette action. A
  real-Chrome smoke holds the viewport geometry, resizing/repacking, controls, restoration
  and route contracts.
- **[core-bend-stops.md](complete/core-bend-stops.md)** — **finished 2026-08-30**
  (proposed and built the same day). Bends typed as the curve they are:
  `bend 0>full>1/2>0` — every stop explicit (a non-zero first stop *is* the pre-bend),
  equal neighbours a hold, `>>` a slower segment; fractions/`full` at the keyboard,
  semitones in storage. The op widened to `{alters[], weights?[]}`, the reader marks
  foreign curves `≈`, and the old `pre/semitones/release` forms retired. Engraving:
  bend curves now arrive VERTICALLY so the arrowheads sit on their own tangent, and
  every arrival off the written pitch is labelled — a partial release reads as what it
  is. Scenario `06-bend-shapes` covers the newly sayable shapes; ledger batch 8.
- **[core-rung-addressing.md](complete/core-rung-addressing.md)** — **Escape stops walking the
  ladder**, **finished 2026-08-28** (proposed, built and closed the same day). Hands-on,
  reaching for Escape as "back out of what I'm doing" widened the selection instead, and the reflex being violated is older than the ladder — so the
  2026-08-20 scrub alias, which added Shift+↑/↓ but kept Esc/Enter on the semantic
  argument, fixed the feel and left the misfire. Three jobs come apart onto three keys:
  Shift+↑/↓ steps one rung (unchanged), **Shift+1–8** jumps to a named rung (the last
  clean global tier — Ctrl/Alt+digit is browser tab selection and not preventable,
  Alt+letter is the menu accelerators, Ctrl+letter and the bare letters are already
  spent), and **Escape/Enter become the pending-gesture pair**: abandon and commit the
  innermost open thing, stated once as a mirror of `ESCAPE_PRECEDENCE`. Two defects fall
  out of making that possible — the spanner anchor is kindless, so cross-kind completion
  is reachable (arm with `S`, finish with `B`) and the HUD says "slur from" over an armed
  beam — plus a third found while closing an open question: `toggleSlur` tests "a slur
  already starts here" **above** "an anchor is armed elsewhere", so completing onto a note
  that already carries a slur deletes that slur and throws the anchor away. One gap
  closes too: `TabDigitResolver.cancel()` finally gets a key, where Escape mid-fret-entry
  currently *writes* the fret. `walkToLevel` stops parking on an absent
  rung (a `goToLevel` intent, presence-guarded, one trace entry per keypress), and the
  tray's ladder column prints the ordinals so the slow surface is the legend for the fast
  one — and the digits reach **into** the open tray, inheriting the preview/commit split
  Shift+↑/↓ already has there. `/{n}` rejected with reasons; the AZERTY shifted-digit-row cost accepted with eyes
  open. Carries the stale-doc sweep: eight normative code comments and four complete
  roadmap docs needing dated amendment notes.
  Landed with the presence refusal replacing `walkToLevel`'s park, the digits reaching
  into the open tray, both stale-doc sweeps done (eight code comments, four complete
  roadmap docs), and no golden moved. The mount's cascade is the part no test can hold —
  the UI has none by rule — so the doc names what to press by hand.
- **[core-delete-clears-then-removes.md](complete/core-delete-clears-then-removes.md)** —
  **Delete's two presses, all the way up the ladder**, **finished 2026-08-25** (proposed,
  built and closed the same day). Found by hands-on testing: select a bar, press `Del`,
  and nothing happens — the guard at five rungs was a **dead end rather than a branch**,
  so the verb answered a keystroke with silence. Generalises the `event` rung's existing
  rule — **press 1 clears what the rung owns, press 2 removes the rung** — with the press
  counter being *the document*, so there is no hidden state and no mode. The anti-cheat
  rule from [core-campaign-element-ops.md](complete/core-campaign-element-ops.md) is
  restated rather than abandoned (never ink **and** structure in one press), and a
  **footprint rule** keeps `removeVoiceMeasure`/`removePartMeasure`. **Section needed less
  than any rung**: it owns only its label, so its two presses collapse into one and the
  ladder *descends* to the bar range beneath it — the one dangerous default found in
  review, since `applyDestructive` relaxes upward and would have landed a vanished section
  on `document`, where the next `Del` means *clear the score*. Built without touching
  `ops.ts` (the guards stay as defence in depth) and without touching `destructWalk.ts`
  (the flagged risk did not fire — phase 1 still strips ink before phase 2 climbs). The
  refusal that started it now speaks: `cleared 12 notes — Del again to remove the bar`.
- **[core-rung-insert.md](complete/core-rung-insert.md)** — **`I` / `Shift+I` insert at
  the cursor's rung, and a ghost bar past the end of the score**, **finished 2026-08-24**
  (proposed, built and closed the same day). Found by hands-on testing of
  [core-entry-surface.md](complete/core-entry-surface.md): `Shift+M` appended a bar at the
  END, never at the cursor, and **there was no `insertMeasure` op at all**, so a pickup bar
  was unauthorable — the same asymmetry the entry surface closed one tier down, where every
  structural rung removed positionally and constructed by appending. Insert makes sense at
  **five rungs, a side at three** (event, measure, part): a chord is an unordered set, a
  voice ordinal is identity not layout, a container's construct verb is a wrap. Landed with
  `insertMeasure`, an optional `addPart` position, `insertAtRung` (every other rung
  **refuses rather than climbing**) and `widenSpansCovering` for the one silent hazard —
  `ending.duration`, `measureRepeat.number` and `multimeasureRests[].duration` are **bar
  counts anchored at a start bar**, and everything else in the model is id-based and safe.
  **`Shift+M` retired**: it meant "insert at the end", and the end is a place the cursor can
  go — `End` then `I`, with `goToEdge` on Home/End, is the same act spelled out of parts
  that already exist; `appendMeasure` survives keyless for **genesis** (an insert needs a
  bar to sit beside). **§8.11 ruled**: insert MAY overfill the bar and the existing
  per-voice badge is the warning — making room would mean shortening music nobody named,
  which this repo refuses more strongly than it insists on a full bar, so the invariant is
  a property of *entry*, not of the document at rest. `removeEvent` is the symmetric twin.
  **The ghost past the end** closes it, and is **navigation, not mutation**: `→` at the last
  position steps onto a bar the document does not contain, the rung survives the step, and
  the KEYSTROKE materialises it — bar and content in ONE `batch`, so undo returns
  byte-identically. Autorepeat is harmless (one ghost, you stop on it), selection extension
  may not reach it, and "go to bar 99" still means the last bar. Drawn as a vacancy in the
  last system's **ragged** right margin on the **cursor's own staff** — system-tall in a
  thin margin is a sliver, a correction the smoke test's numbers made before the screenshot
  did. Four bugs earlier in this item taught that the overlay layer can only be judged in a
  browser, so `npm run smoke:selection` walks off the end and asserts the panel's geometry.
  `←` at the *start* is left **deliberately unspecified**.
- **[core-tuplets-grace-notes.md](complete/core-tuplets-grace-notes.md)** — tuplets and grace
  notes **across both converters and on tab**, **finished 2026-08-24**. Split out of
  [core-guitar-pro.md](complete/core-guitar-pro.md) at its real scope: the model and the
  notation renderer already drew both, but neither converter carried them and the tab staff
  reserved their columns without drawing them. Step zero was a **fixture** —
  `Triplets-and-graces`, the only one not authored in Guitar Pro (hand-written GPIF, the
  app's own native XML, emitted by a tool that imports nothing from `src/`), because none
  of the three reference scores contains a tuplet or a grace note and so the round trips
  were honestly lossless while never presenting the case. Both converters follow the
  collapse-expand precedent from voltas; MusicXML additionally raises `<divisions>` per
  document (a triplet eighth is not an integer at 8) and accepts both wild conventions on
  import (`<tuplet>` brackets, or `<time-modification>` alone). On tab, grace digits are
  small and a tuplet bracket is drawn **once per system** — the standalone view draws its
  own, the `both` view lets the notation staff carry it. Uncovered a real bug: `validate.ts`
  stopped at the first container, so an unplayable note inside one would have drawn nothing
  AND carried no badge. **Not one committed golden moved** — the corpus could not see this
  class of content at all until the three new `lab/tab-rhythm/` scenarios arrived, which are
  ledger batch 5 in [lab-verify.md](inprogress/lab-verify.md).
- **[core-guitar-technique.md](complete/core-guitar-technique.md)** — playing technique,
  **finished 2026-08-24**. The data path landed 2026-07-26 and then a month passed with
  nothing drawing any of it, which is a failure that *looks like a clean render*: a
  document carrying 42 harmonics engraved as an instruction to pick every note. All seven
  are now drawn on **both** staves — bends as curves with a labelled arrowhead (pre-bend a
  vertical arrow, release a downward head), slides as the line between two positions,
  hammer/pull as a lettered slur, vibrato as a wiggle, palm mute as the span its run reads
  as, harmonics as `<12>` in the tab digit and a circle over the notation note. **Both
  staves was decided by the model, not by taste**: `technique` is drafted for standard MNX,
  so a document declaring no strings has no tab staff and would have had its technique go
  unrenderable rather than merely unfretted. Runs as a POST-PASS, like slurs and ties,
  because three of the seven name their destination by note id. **Nothing reserves vertical
  room and nothing needed to** — [core-ink-measured-gaps.md](complete/core-ink-measured-gaps.md)
  opens the system for a bend arrow it has never seen. Two engraving rules the pictures
  caught and the tests did not: a slide along one string must be SLANTED (flat, it lands on
  the string line and vanishes — every slide in the corpus is that case), and a notation
  technique slur takes the side away from the stem. Approvals owed:
  [lab-verify.md](inprogress/lab-verify.md) batch 4.
- **[core-layout-authoring.md](complete/core-layout-authoring.md)** — **done 2026-08-24.**
  The `layout`, `score` and multimeasure-rest kinds, handed over by the element-ops campaign
  (2026-08-15) because its verbs all attach to a **place** and a layout is a **tree**. The
  addressing question is answered by evidence already in the tree: the destruct sentences
  (`no layout 2`) had always parsed as typed text at a 1-based slot, so the construct halves
  are their positive form — **no tree addressing scheme invented, the ladder stays
  one-dimensional**, and a panel is still possible later since all three candidates emit these
  intents. All six sentences live in one **Shift+S** popover. Three surprises: a measure
  reference had **no anchor to point at** (fixed by the paste planner's rule — a reference
  mints its id), the model types were **wrong about the schema** (`none` vs `noSymbol`, no
  `unified`), and `setPart` is unbound so a trace crosses parts with Escape then Ctrl+↓.
  **blocked 7 → 1**, `spec/multimeasure-rests` traced from `{}` in 136 intents, THE BAR closes
  at 41/41, goldens byte-identical.
- **[core-document-rung.md](complete/core-document-rung.md)** — **done 2026-08-24.** The
  ladder's top rung was called `score` and meant **the whole document**; MNX means a **named
  presentation** by the word (0..N per document; 102 of 108 scenarios have none). Renamed the
  rung to `document`, added **no** score rung — every rung is a widening range over the
  timeline, a presentation is a projection over parts — and settled the open question from the
  code: the rung is a singleton member with no coordinates, so a view has nothing to bound.
  **Two silent breakages tsc could not see**: `CommandScope` already had a `'document'` scope
  ABOVE the rung, which the union absorbed (undo/redo leaking onto a selection), now `session`;
  and the clipboard envelope carries the rung name, so the format moved to v2. Goldens
  byte-identical. Unblocks the vocabulary
  [core-layout-authoring.md](complete/core-layout-authoring.md) needs.
- **[core-entry-surface.md](complete/core-entry-surface.md)** — **typing anywhere the
  cursor can already go**, built 2026-08-23; the last piece of the element-ops campaign,
  graduated out of it on 2026-08-15. The cursor addressed part → staff → voice in full
  and every removal verb followed it, while every WRITING verb still resolved to voice 0
  of `parts[0]`, staff 1 — so the ladder could visit a voice it could not create. Seven
  verbs took an address (`EntryTarget`, where **absent means the first of its kind**, so
  no op log or trace moved a byte), and two latent wrong-answer bugs fell out with them:
  `setFret` sounded frets against part 0's strings, `tieTarget` looked in part 0 staff 1.
  **The policy — a created voice arrives padded to the meter** — answers the design
  question the doc existed to ask, and its best consequence was not predicted: because
  every position in the new voice is real, **there is no ghost voice to invent**, so the
  selection ladder needed no new vocabulary at all. The unblocking finding was elsewhere:
  `coincidentSlots` fell back across voices, so standing in voice 2 over its rest
  resolved to voice 1's note — Delete removed music from a voice you were not in. **THE
  BAR closed 37/38 → 38/38**: `spec/multiple-voices` and `lab/score-text/directions-multi-staff`
  trace green, `staves` is covered, and `awaitingEntrySurface` is deleted rather than
  merely emptied. Corpus cost nil, as predicted — no golden moved, no verification debt.
  `spec/tie-targets` is still unbuildable, on three gaps in what a TIE can say (a target
  in another voice, a second tie on one note, `side`) — named, not filed.
- **[core-tab-digit-resolution.md](complete/core-tab-digit-resolution.md)** — physical tab
  digits now stop at the workbench mount and compose for **500 ms** into one replayable
  `enterFret {fret}` intent. A visible cursor candidate resolves one digit on expiry,
  resolves 10–24 immediately on the second digit, and flushes before navigation, focus,
  projection and lifecycle boundaries; the session has no clock or digit-correction undo.
  Completed 2026-08-23 with 946 tests, 108 scenario checks and the production build green.
  Deliberately narrowed from `core-entry-mode`: no advance toggle, Space review or A–G
  layer landed in the minimal UX.
- **[workbench-selection-chip-ladder.md](complete/workbench-selection-chip-ladder.md)** —
  **the chip is one rung of the ladder.** Built 2026-08-22 from a Claude Design spec drawn
  1:1 over crops of this build. The rung chip and the tray were built two days apart and
  did not know they were the same object: closed, the level read as a lowercase mono word;
  open, that word came back **re-cased to `NOTE`** in an uppercase tab strip, at a different
  size and x. So the scope selector becomes a **vertical 74px ladder column** at the tray's
  leading edge — the current rung occupying the chip's own box and x — and the chip grows the
  **▲▼ pair** that is that ladder collapsed to two keys (same `walkToLevel`, so ▲ and clicking
  `voice` are one act). Edge-anchoring, never centring: near the right edge the whole object
  **mirrors**, decided once by the page at open and held. The connector drops 30px → 8px and
  the plinth goes with it. Departures from the spec are recorded in the doc — the tile panel
  stays 396px (the drawn 222px was mocked with six tiles; `event` carries eighteen), search
  stays, and the readout band becomes a tooltip that captions the keyboard cursor only once it
  has been *moved*. Leaves the spec's two open questions open and adds a third: ▲ now walks
  **down** the drawn column, the inverse of the HUD's.
- **[core-selection-clipboard.md](complete/core-selection-clipboard.md)** — typed
  copy, cut and paste over every selection rung, range and closure. **Stages 1–6 built
  2026-08-16 and 2026-08-20; closed 2026-08-22 without stage 7.** The clip is a
  versioned DOM-free union behind one strict codec and one asynchronous, string-only
  store, so replacing the internal transport later leaves clip, extraction, planning,
  cut ordering, history and trace semantics untouched. Extraction, the paste planner
  and the cut planner are pure; `selectionStructuralEdit.ts` is the one repair module
  both mutating sides share, so their semantics cannot drift. Cut writes before it
  removes and refuses on a stale session. Ctrl/⌘+C/X/V are **shell actions**, not
  EditorIntents — the trace records the materialized plan, never the keypress — and
  feedback is a transient notice strip, not a clipboard panel. The first hands-on pass
  retired two of its own contracts on the spot
  ([core-selection-floor-axis.md](complete/core-selection-floor-axis.md),
  [core-paste-lands.md](complete/core-paste-lands.md)). **Stage 7's full cross-score
  walk was never run** and the doc says so: the item's one unpaid piece of named
  evidence. System clipboard, reload persistence and paste-special stay deferred.
- **[workbench-rung-legibility.md](complete/workbench-rung-legibility.md)** — knowing
  which selection rung you are in without moving your eyes. The enclosure's two channels
  (extent, fill ratio) are *relative* — read by comparison with the shape just left — and
  they degenerate exactly at the confusable trio (voice/part-bar/bar in single-voice,
  single-part documents). **Both phases built 2026-08-20.** Phase 1: the rung chip the
  ladder doc promised, in the HUD's own `ROW_BY_LEVEL` vocabulary — revised same day into
  the tray's collapsed handle (below the selection, click = `/`, flips by the tray's own
  room test). Phase 2: the **extent ladder on both axes** — the voice hull hugs the
  notehead contour (no staff-band floor), the part-bar owns its music's span, and the bar
  becomes the first full-width rung; vertical monotonicity deliberately traded at
  event→voice (*a moment is tall, a run is long*). Phase 3 (2026-08-22) settled **bar vs
  section** by lighting the label: the re-examination found that two of the pair's three
  supposed channels (the section's own colour, outside-dimming) had never been built, and
  that the third — extent — is *identical* for the two rungs when a section is exactly one
  bar. Growing the box cannot fix it, because `panel-wide` already covers the label strip
  by design (a bar owns its rehearsal mark and tempo there). The label is the channel that
  does not degenerate with length, and it was the ladder's own unbuilt promise (*"label
  chip lit"*). A chip on the cap box, in its own layer over the wash and under the ink,
  claimed by the label's anchor so a long overhanging name still counts; a flag rather than
  an eighth `EnclosureKind`, since the shape genuinely does not change. No golden moved;
  one scenario added for the degeneracy nothing exercised. Colour
  ladders, border styles and whole-page scope dimming considered and rejected (reasons in
  the doc).
- **[core-assist-model-selector.md](complete/core-assist-model-selector.md)** — **the model
  roster as a query, not a list**: a pure assessment/selection module that takes a
  requirements definition (hard filters — tool support, context floor, price ceiling,
  free-only — plus weighted soft preferences) and returns an ordered list of matching
  OpenRouter models. The ordering is the interesting half: per-dimension *headroom over
  the requirement* (`log(actual/required)`, so exactly-meeting scores 0), weighted sum,
  with Pareto dominance as the pinned test invariant and unknown dimensions scoring as
  "requirement exactly met", flagged. Effective price is a **workload blend** computed by
  the module — the catalog is per-meter only (prompt/completion/cache), so the
  requirements profile declares the expected token mix and the blend is its dot product
  with the model's meters. Quality enters first as a curated prior table,
  later from edit-loop evals (`editLoop.ts` is already factored for them). First
  consumer is dev-time — stored queries regenerate
  [worker/models.json](../worker/models.json) so curation is articulated rather than
  embedded; second is the edit loop's ordered `models: []` fallback array, where free-tier
  rate limits make fallback real; third is the **picker surface** both shells want — the
  assist surface heads with the current model, and switching opens a query dialog whose
  criteria widgets (effective-price slider, min tokens/sec, min intelligence index) are
  the requirements definition wearing controls, returning top-n with the best
  pre-selected. Choice and query params persist in localStorage (presentation, like the
  theme — the committed roster stays the reviewed default), and the two-shell claim
  routes the dialog through the promotion rule onto the `elements → assist` boundary
  question core-editor-ai-prompt already carries. Motivated by the 2026-08-20 free-model
  question the repo couldn't answer. **Scoring core and
  picker surface built 2026-08-20**: `src/assist/modelSelect.ts` (contract pinned by
  `model-select.test.ts`, dominance invariant included), the 413-model committed catalog
  snapshot (router pseudo-models excluded — they price as −1), the workbench's sixth
  panel tab with the switch-model CTA over a placeholder chat, and the
  `<mnx-model-picker>` dialog, verified hands-on over CDP. **Closed 2026-08-22**: the
  roster is generated — `worker/models.query.json` holds the stored queries, `roster.ts`
  runs them, `npm run update:roster` writes `worker/models.json` and
  `harness/conformance/roster.test.ts` asserts the two agree, so hand-editing the roster
  is a red build. Articulating the curation took one new hard constraint, `requireKnown`
  (pass-and-flag an unknown is right for a human reading the picker's `?`, wrong for an
  unattended generator), plus canonical endpoints only (`:free` rotates, `:batch` is the
  async API, `~x` floats). The queries reproduce **7 of the 9** hand-picks — and the two
  they drop are the finding, since nothing in the catalog separates `claude-3-haiku` from
  `nemotron-3-super` on any dimension, so part of the nine was simply arbitrary. The
  fallback array is wired through both paths (`streamChat` and the edit loop's transport,
  which became possible when the loop moved to `src/assist/` mid-item): the picker hands
  over the three ranked *below* the choice, `models: []` replaces `model`, and the context
  bar says *served by* whenever the answer came from further down. Eval-fed quality and
  the `elements/` promotion were handed off rather than built — to
  [core-assist-evals.md](proposed/low-priority/core-assist-evals.md) and
  [core-editor-element-promotion.md](proposed/core-editor-element-promotion.md)'s existing
  gate — because neither was this item's work waiting, but other items' triggers not yet
  met.
- **[core-assist-byok.md](complete/core-assist-byok.md)** — **bring your own
  OpenRouter key**, completing the workbench's no-backend rule by deleting its one
  asterisk ("minus live AI edits"): the key is obtained by **OAuth PKCE** (a distinct
  per-app key, master never seen) or by **paste**, held in the shell's localStorage —
  never in `elements/`, the embed runs on foreign pages — and spent browser-direct;
  OpenRouter permits CORS from any origin including localhost. **Built 2026-08-20**:
  `src/assist/openrouter.ts` (PKCE pinned to the RFC 7636 vector, SSE delta parser,
  streamed chat), `workbench/assistCredentials.ts` (the redirect round trip — callback
  carries no hash, code scrubbed before exchange), and the assist tab's connect block
  + tool-less chat, verified over CDP against the live API. Dissolves the model
  selector's "must the Worker honour any model id" question — it is the user's money.
  Remaining: move the edit loop behind this transport, a CSP header, the Worker as
  explicit demo mode. **Closed 2026-08-22**: the loop moved to `src/assist/editLoop.ts` behind a `ChatTransport` it declares itself (10 network-free tests it could not have had before), `streamEditNotation` picks browser-direct vs Worker from whether a key is held, the CSP shipped in `public/_headers` with a mutation-checked `smoke:csp`, the Worker stamps every frame `demoMode`/`mockMode`, and studio's adoption is a deferred promotion with its trigger named.
- **[core-ink-measured-gaps.md](complete/core-ink-measured-gaps.md)** — **vertical distance
  is measured ink to ink**. **Stages A–C built 2026-08-21** (labels/tempo one clearance above the
  ink under their footprint; every display gap ink-measured via a probe pass, gap-centred
  `between` directions held with a clearance each side) — 9 text scenarios + 12 multi-staff
  scenarios demoted for the sweeps, 20 both goldens earned; D (density-1 ruling) open.
  Principle: with two clearance constants: cohesion (label→its staff, ≈1sp)
  and separation (staff→staff, system→system, ≈3sp). Raised 2026-08-21 from two screenshots
  of one score: the section label crowds the treble stems in `both` and floats over a
  stemless tab staff in tab-only; the tab crowds the notation while the bass floats below —
  and those two staff gaps are *geometrically identical* (6sp), one full of ink and one of
  air. The label scan reads `p.y` and so cannot see stems. The engine already has the
  principle in `tightenRows` (*"the frame follows the ink"*), confined to between-systems
  at non-default density; this generalizes it to the label row and the display staves
  within a system, as the same post-pass one level down. Staged A (labels, 8 scenarios) →
  B (`both` display gaps, 21 both goldens) → C (grand-staff gaps) → D (a recorded ruling:
  density 1 becomes ink-measured). Two decisions fixed up front: staff gaps per system,
  label rises per bar; `padDensity` scales the clearances, not the pads. **Closed 2026-08-22** owing only its `/verify` sweep, which is registered as batch 1 of [lab-verify.md](inprogress/lab-verify.md); stage D landed 2026-08-21 in `018073d` and the status header simply outlived the commit.
- **[core-ragged-last.md](complete/core-ragged-last.md)** — the last system borrows its
  stretch from the page. **Built 2026-08-21; owes its `/verify` sweep.** A sparse final row
  justified into the `MAX_STRETCH = 2.5` cap — 2.5× the texture of the rows above, still
  short of the margin. Rule, in one exported helper used by the packer and the ink-priced
  path alike: the last row may not be looser than the loosest other row
  (`min(computed, max(1, others))`), page-relative rather than a fill threshold, inert on a
  single system. Measured: 5 multi-system scenarios moved, 0 single-system; 3 demoted to
  stale (`navigation-playground`, `rest-gallery`, `tie-targets`) — that sweep is what keeps
  this in `inprogress/`. Per-system layouts cap each multi-row segment's last row. Five
  corpus-wide assertions in `ragged-last.test.ts`. Appendix on
  [core-render-density-zoom.md](complete/core-render-density-zoom.md). **Closed 2026-08-22.** *"BUILT, awaiting the `/verify` sweep"* was its whole remainder; the sweep now lives in [lab-verify.md](inprogress/lab-verify.md) as batch 1's second owner.
- **[core-keymap-cheatsheet.md](complete/core-keymap-cheatsheet.md)** — a **selection-mode-
  dependent keyboard cheatsheet**, built by making the ladder's per-level navigation map DATA.
  The keymap's binding tables are already data, but the *meaning* of a key at each rung lives
  in `session.navigate` (arrows move by the rung's unit, voice jumps only at note level) — a
  cheatsheet from bindings alone would say "→: next position" at every rung. **Stages 1–3
  built 2026-08-11** (same day as proposed): the `KeyDoc` meaning table over all 45 bound
  strokes (`src/edit/keymapDocs.ts`, seven groups Navigation → Adornments → Workbench), the
  hud-tab "keys · at this level" section
  ([core-score-hud.md](complete/core-score-hud.md) — rows are the nouns, keys are the
  verbs), the actions tab's drifting hand-written hint retired, and
  `harness/conformance/keymap-docs.test.ts`: both joins (every binding documented, every doc
  bound) plus guard mirrors (voice jump note-only, toggleNote notation-only, arrows inert at
  score) so the cheatsheet cannot lie. Static meaning, not a live enablement oracle;
  physical-key labels per the keymap's `KeyboardEvent.code` decision. The ladder's
  complete per-rung bare/Ctrl navigation map and Shift-extension/Ctrl-or-Meta closure
  gestures are mirrored here as data, including the container rung and explicit
  rung-first Delete meanings through section. **Closed 2026-08-22.** What was filed as stage 4 is a standing maintenance obligation, not a deliverable — and `keymap-docs.test.ts` enforces both directions of the join, so a ladder pass that adds a stroke without a row turns the build red. A test already tracked it.
- **[core-ink-offset-fields.md](complete/core-ink-offset-fields.md)** — **ink offsets are a
  field, not a convention.** Built 2026-08-21 after the same bug class surfaced a fourth
  time: at 640% staff scale a double barline's two strokes OVERLAPPED and drew as one line,
  because the strokes are ink (vertical scale) and the gap separating them was a position
  (horizontal scale). `dx`/`dx1`/`dx2` put the currency in the type, so the call site decides
  it by which field it types into; the barlines and repeat clusters use it. The other half is
  a **non-square sweep** over the corpus at ratios 1/4/6.4, asserting scale-invariant
  RELATIONSHIPS — the goldens are all square and are structurally blind to this class. Two
  notes worth keeping: `rounded()` folds offsets before rounding, which is what stopped a
  representation change from moving 158 goldens and demoting 54 approvals for zero visual
  change; and the three earlier hand-priced fixes stay as they are, deliberately.
- **[core-ink-priced-columns.md](complete/core-ink-priced-columns.md)** — rigid columns are
  **ink**; price them on the ink scale. **Built 2026-08-21.** The decision `fd6b06e` left
  open: staff scale grows every glyph dimension on the vertical scale while the plan priced
  its columns horizontally, so above ~1.2 ink ratio the ink outgrew its columns — first seen
  as the TAB clef running into the time signature, latent in every rigid column. Resolved
  with the plan's own rigid-vs-spring taxonomy: `planHorizontal` takes an `inkRatio`, rigid
  ink re-prices by it, each row re-justifies over the scaled rigids with its **square**
  membership (`packSystems` never sees the ratio — bars never jump systems under zoom), the
  renderers derive the ratio after the square fit. Goldens byte-identical; five mutation-
  checked assertions in `zoom-density.test.ts`, including the square-anchor counterfactual
  colliding. The within-column residue (stems drifting off heads, short ledgers at staff
  scale) was retired the same day: every head-relative offset in the four emitters is
  ink-priced too, goldens still byte-identical. Appendix on
  [core-zoom-density-pad.md](complete/core-zoom-density-pad.md) records ruling 1's
  square-scale premise.
- **[core-derived-positions.md](complete/core-derived-positions.md)** — the execution half of
  [spec-instrument-position.md](proposed/low-priority/spec-instrument-position.md): migrate `_x.mnxLab` to the
  proposal's shape (v5: string authoritative, `fret` optional and non-authoritative, `fingering`
  un-nested, `tuning[]` → `strings[]`) **and specify the derivation ladder** so unannotated
  guitar notation still renders valid tab — lowest-playable-fret assignment, capo-aware
  (MNX pitch is sounding, so no transposition term — `part.transposition` is display-only).
  The pitch-only assignment is ruled **presentation, not content**; the renderer's
  determinism is owned by the `lab/tab-derivation` scenario family, so heuristic changes
  become reviewed golden demotions instead of silent drift. **All four stages executed
  2026-08-07** — the v5 reshape (schema, v4→v5 upgrade hop, converters, corpus, edit
  layer, Worker prompt), the hardened derivation (tuning/capo-aware authority ladder, red
  mismatch/unplayable badges, no silent clamp), and the ten-scenario
  `lab/22-tab-derivation` family pinning it, goldens byte-identical throughout.
  **Instrument neutrality followed the same day**: the assume-standard-guitar default is
  retired — tab requires declared `strings[]` or a viewer override, surfaced as the
  workbench's instrument selector; the shim materializes the old implicit default into
  saved documents. **Closed 2026-08-20 by decision, without the `/verify` sweep** — the
  family stays `rendered` and in the attention queue as never-seen; a review that finds
  issues reopens the item.
- **[core-viewer-embedded-app.md](complete/core-viewer-embedded-app.md)** — the **third
  app** (`apps/viewer-embedded/`), a read-only foreign host page consuming
  `dist/embed/mnx-lab.js` only — the embed contract's first real consumer, and the
  answer to the promotion fork: **embeds view; studio edits**. Built 2026-08-16: the
  self-locating asset fix (the artifact derives `smuflBase` from its own script URL,
  registers Bravura via `FontFace`, `smufl-base` attribute as override — before this,
  "one script tag" was untrue off-origin), the cross-origin `smoke:embed` harness
  (structural assertions, never the goldens — a browser embed goes through
  `fitPxPerSp`), and the viewer's own `viewerTokens` split with `light-dark()` paper
  (on a host page every token was undefined: staff lines simply did not draw). Settled
  [core-editor-focus-scope.md](complete/core-editor-focus-scope.md)'s stage 2 as
  *not wanted* and gave [core-viewer-surface.md](complete/core-viewer-surface.md) its
  consumer.
- **[core-editor-focus-scope.md](complete/core-editor-focus-scope.md)** — **who owns the next
  keystroke, and how you can tell.** Raised from an embed question (when do PgUp/PgDn reach
  the component vs the host page?) whose honest answer was "almost always the component":
  both listeners were `window`-scoped with no focus check, and a custom element isn't even
  focusable by default — so "while focused" wasn't expressible. Names the four-scope ladder
  (browser/OS → document → host element → regions within), notes that **shadow DOM retargets
  but never scopes key events**, and sets one rule: handle a key iff focus is inside the host
  — `tabindex`, containment tested across shadow roots, and `preventDefault()` only on keys
  actually consumed. Plus the visible signal (a `:host(:focus-within)` ring on the public
  `--mnx-focus-ring` token — an unfocused component drawing a cursor is lying about who gets
  the keystroke) and the rule that **shell bindings don't travel** (an embed must not eat a
  host page's Ctrl+K). **Complete for its scope 2026-08-14**: stages 1, 3 and 4 built
  (the ring + token, `keyScope.ts`'s shared `editorHasKeyboard` predicate driving both the
  key gate and the overlay's `selection-inactive` fade, the binding-split assertion),
  verified in headless Chrome over CDP — `dimmed` and `keyLanded` are exact inverses at
  every focus step; **stage 2 retired as "not wanted"** when
  [core-viewer-embedded-app.md](complete/core-viewer-embedded-app.md) settled *embeds view;
  studio edits* (should studio bring the editor into `elements/`, the host-scoped listener
  returns on the promotion's work list). Records a reusable finding: headless Chrome
  delivers no focus events to `window` even for real clicks, so ownership is re-read
  from `activeElement` on the *causes* of focus change.
- **[core-paste-lands.md](complete/core-paste-lands.md)** — proposed and built
  2026-08-20, D1–D7 as blessed: **a decodable clip always lands**, undo the license as
  it was for cut. Paste is a footprint write — the selection contributes only an
  anchor, partially covered units are consumed whole with greedy-binary rest fill, and
  the document extends (bars, even parts) rather than clipping. Metric/fingerboard
  conflicts land and are flagged by the forgiving renderer's diagnostics; the
  planner's refusals shrank to the decode tier, every yielded accommodation is
  counted in the plan, and the notice strip reads the record out clause by clause.
  The same-evening D8 amendment made runs **flow**: source distances linearize against
  the clip's recorded effective meters and re-bin at the destination's barlines, so
  four quarters pasted at beat 3 continue into the next bar instead of overfilling.
  Supersedes Contract 3 of the clipboard item.
- **[core-selection-floor-axis.md](complete/core-selection-floor-axis.md)** — proposed,
  decided and built 2026-08-20 out of the clipboard review: the note-rung *range* proved
  valueless and confusing (pixel-identical to an event range, invisibly rhythm-free), so
  the gesture's axis now picks the rung at the ladder's floor — Shift+←/→, Shift+End and
  Ctrl/⌘+A re-level to the event rung (the first press grows one notehead into its own
  ONE event), and ↑/↓ at event descends to the nearest notehead. Invariant:
  **a note selection is always exactly one notehead.** The spanner selected-run form
  rode the ranges to the event rung (session gates, tray tiles, S/B cheatsheet rows).
  The one cost, accepted by name: the event rung's voice jump is two keys now.
- **[core-selection-ladder.md](complete/core-selection-ladder.md)** — **progressive selection as
  the input-mode system**: input modes *are* the selection level, and each level offers
  exactly the properties the data model puts there. One containment ladder (note → event →
  [container] → voice-measure → part-measure → measure → [section] → score) walked
  vertically by Escape/Enter (breadcrumb descent, relative addresses), with the horizontal
  axis as a second gesture family — Shift+arrows extend, **Ctrl+A is the closure** (closure
  at part-measure = the part, which is why part is not a rung). Presence rule skips absent
  rungs; ghost enclosures let the cursor address what *could* exist (selection addresses
  what is). One visual vocabulary — the enclosure — from a square note cell through column
  slices, container lassos, voice-run hulls and growing panels to the score frame, so Escape/Enter
  animate as a single shape tween that teaches containment. Both view shows primary +
  echo per projection (the active-projection bit also picks the input dialect: ↑↓ = pitch
  vs string). Builds on [core-editor-input-layer.md](complete/core-editor-input-layer.md)'s
  intents/traces/overlay substrate; the section rung is live evidence for
  [spec-score-text.md](proposed/low-priority/spec-score-text.md)'s proposed field. **Phases 1–2 built
  2026-08-09**: the vertical ladder as session state (`src/edit/selection.ts`,
  Escape/Enter intents, level-scaled arrows with section jumps) pinned by
  `harness/conformance/selection.test.ts`, and the enclosure vocabulary
  (`src/elements/enclosure.ts` — cell → slice → run → panel → panel-wide → frame from
  the rendered SVG's own geometry; the both view's part-measure panel spans the
  notation+tab pair via the shared-barline join; voice-measure revised to a single run
  hull, part-measure/measure to the ink/space principle). **Navigation complete
  2026-08-15; address/footprint consistency pass 2026-08-16** — every rung now has
  bare/Ctrl meanings, container children keep their event identity, global scopes cover
  every part/staff, Delete is rung-first, and the HUD follows the addressed part/staff.
  The **horizontal state foundation completed 2026-08-16**: sessions now carry
  anchor/extent/closure state, a rung-aware live resolver exposes structural members plus
  note/kit keys (including rests and empty bar copies), and traces assert final selection.
  Gesture intents and Shift+←/→, Shift+End, Ctrl+A/Meta+A bindings completed the same day,
  including collapse, reversal, projection preservation and trace replay. Range presentation,
  mixed/bulk commands, the container rung and every rung's Delete meaning followed. The
  relax/tighten enclosure now morphs from the geometry actually on screen across same-kind
  extent changes and one↔many both-view echoes, with interruption continuity and reduced-motion
  fallback. Primary/echo asymmetry now keeps the active projection's ink and fine-rung
  enclosure full strength, dims the other rendering, and resolves to one panel at
  part-measure while preserving roles through the split/merge tween. Generalized ghosts
  now cover silent/rest-only columns from structural row/bar/staff geometry and give a
  measureless part a larger “place for a bar” vacancy until its first measure exists.
  **Completed 2026-08-16.** Its separate input-resolution axis graduated the same day;
  advance and letter modes were later cut, leaving
  [core-tab-digit-resolution.md](complete/core-tab-digit-resolution.md).
- **[core-vertical-density.md](complete/core-vertical-density.md)** — **systems per page
  without shrinking the staff**: the third axis of
  [core-render-density-zoom.md](complete/core-render-density-zoom.md), proposed and built
  the same day (2026-08-15) because both reasons it had been deferred dissolved on
  contact. It needed no `ROW_HEIGHT_SP` refactor — the pass runs *after* a layout, over
  the finished `LayoutResult`, so one implementation serves notation, tab and the `both`
  system and no row arithmetic became per-instance. And it needed no stem-length clamp
  first, because it does not tighten toward a chosen constant: measuring the goldens
  showed a notation staff reserves 6sp above itself and uses a **median of 0.5**, a tab
  staff reserves 4sp and uses **0.0**, so a plain multiplier would clip the p90 score
  while helping the median one. It tightens toward each row's **measured ink** instead —
  real SMuFL glyph boxes, not baselines, since a clef's ink reaches 2.5sp above its own
  baseline — which turns the collision question `densityH` answers structurally into one
  this axis answers by assertion. The control question answered itself too: the coupling
  sits on the element (`density-pad` unset ⇒ derived from `density-h` by a square root),
  so the zoom pad's existing ←→ arms drive both axes and its ruling-4 "no third arm pair"
  still holds. Tab loses 51% of its height at the tight end, notation 25%; density 1
  does not run the pass at all, so every golden is byte-identical by construction.
- **[workbench-chrome-language.md](complete/workbench-chrome-language.md)** — **the rail and
  the headers in the panel's language**, a post-campaign item against
  [core-campaign-modernist.md](complete/core-campaign-modernist.md) rather than a reopening
  of its closed index. That campaign flipped the tokens workbench-wide but gave only the
  right-hand side panel a *frame*, so the app ran one palette across two grammars: 2px ink
  rules and tracked Archivo labels on the right, hairlines and mono on the left. Three
  moves, all the panel's own — a rule is 2px of ink (the rail's right edge now mirrors
  `.panel`'s left, so the score sits between equals), the rail gains the panel's pinned
  context band over ONE scrolling body, and both tab strips become the same control. Adds
  exactly one shared primitive (`.band-label`, adopted at three sites, per the campaign's
  own *"a shared primitive nobody adopts is just dead code with a good reputation"*), and
  the rail's current row finally adopts `.row-state`/`.row-current` instead of spelling it
  a fourth way. Records two corrections: every `--radius-*` was **already** `0px`, so the
  rounding this item set out to remove had been gone for a day; and the two tab strips
  cannot align horizontally, because `.head` spans above `.body`. **Landed on `main` 2026-08-15**
  at `98ebaea`, gates green and goldens byte-identical. Its landing is the first to
  have met an occupied `main`, so the doc keeps a **Landing** section: the ff-only
  refusal is the contract working, the stash/pop restoration wants a file-by-file
  check rather than an eyeball, the dirty set is not stable across a five-minute
  test run, and a conflict resolution is only judged by building the combined tree.
- **[core-render-density-zoom.md](complete/core-render-density-zoom.md)** — configurable
  **density / zoom levers** ("see more music on less page"). Horizontal density shipped
  2026-08-14 (a multiplier on the springs, never the rigid columns), uniform zoom and the
  control surface with [core-zoom-density-pad.md](complete/core-zoom-density-pad.md), and
  **closed 2026-08-15** with the two corrections that came out of using the pad: the
  legibility floor retuned **0.5 → 0.02**, the point where packing bottoms out (0.5 stopped
  a reader two systems short of what the engraver draws readably), and the **density
  ladder** — the answer to why
  clicking *tighter* usually did nothing. It isn't a control bug: every x is
  `spring × densityH × stretch` and the justifier's `stretch` is inversely proportional
  to `densityH`, so most of the range is *exactly* degenerate. `packSystems()` (factored
  out of `planHorizontal`, goldens unmoved) + `densityLadder()` return the values that do
  something; the pad's arms walk those. The third axis landed the next day —
  [core-vertical-density.md](complete/core-vertical-density.md).
- **[core-campaign-modernist.md](complete/core-campaign-modernist.md)** — **campaign**: the
  workbench restyle the tray's art direction leads, plus the score panel it was drawn for.
  Fills the slot [core-selection-tray-residue.md](proposed/core-selection-tray-residue.md)
  reserved for it ("its own future proposal, raised only if the tray's look wins the
  review") and retires that row plus the dark-page one. Four decisions taken up front:
  **workbench-wide token flip** (the tray drops its hexes and consumes `designTokens` again
  — panel-only styling was rejected as adding a *fourth* dialect); **one red accent** across
  chrome, enclosure and pips; **a dark pass authored and finally wired**; Archivo bundled.
  Two verified tripwires the contract freezes: `src/engine/render/svg.ts` holds a **dangling
  `var(--font-family-sans)` baked into 68 goldens**, and `diagnostics.ts`'s error red
  `#b91c1c` is frozen in 10 more — so "red everywhere" puts selection-red and error-red on
  one canvas with only the accent movable. Records what the mock gets right (much of it is
  already built), and **rejects two of its features with reasons**: a computed DIFFERENCES
  list (a second, unowned verdict channel competing with `status: verified`) and op grouping
  (breaks time-travel's row↔position identity).
- **[core-note-address.md](complete/core-note-address.md)** — **one note
  enumeration**, built 2026-08-14 as the prerequisite that makes campaign item
  11b's container descent safe. `noteKeys.ts` was always a shared *formatter*,
  but the coordinates fed to it were derived independently in **six** places
  (cursor ×2, ops ×2, jsonView ×2, plus both layouts) — which is why CLAUDE.md
  has to ask that they be "kept in lockstep", and why teaching the editor to see
  inside containers looked like a five-file migration with the goldens as the
  only witness. Now `model/noteWalk.ts` produces coordinates once, three walks
  are thin wrappers over it, and `harness/conformance/note-keys.test.ts` checks
  the agreement over all 106 scenarios (every synthesized key the renderer stamps
  must be one the walk produced; the walk must produce no duplicates — a
  duplicate being the container collision in miniature). Goldens byte-identical,
  which is the proof it changed nothing. **Move 2 followed the same day**: the
  cursor address `{measure, onset, line}` was the same shortcut one level up, so
  `EditorCursor` gained a `slotIndex` and `Alt+V` steps between notes sharing a
  moment and a line — closing the hole that let the editor act on a *neighbour*.
  Measuring it also corrected an over-attribution: of 161 unaddressable notes only
  **7** are navigation failures, while **154 have no key at all** (100 in second
  parts, 32 in containers, 22 on staff 2) — the `parts[0]`/staff-1 assumption,
  which is items 13b and 11b, not coincidence.
- **[core-viewer-surface.md](complete/core-viewer-surface.md)** — name and define **the viewer
  surface**: `<mnx-document-viewer>`'s public contract (props/attributes/events), today an
  undesigned accretion. Layered rule (engine `RenderOptions` → element bindings → workbench
  chrome), attribute-first, the `view="auto"` precedence chain (user > host > document
  `staffKind` hint > default), a set-valued `hide` knob, and eviction of workbench leakage
  (`pinnedErrors` et al). Subsumes render-density-zoom's "where do the levers live" question.
- **[core-document-viewer-rename.md](complete/core-document-viewer-rename.md)** — the public
  face now names the unit it consumes: `DocumentViewer` / `<mnx-document-viewer>`, with
  `score` reserved for genuine `MnxScore` presentations and rendered output named as a
  projection/engraving. Clean `0.3.0` break (no external host required an alias), all in-repo
  embeds/demos/contracts updated, `renderProjection()` / `#projection-container` /
  `notationTokens` behind it, and the obsolete tag rejected by browser smoke. **Landed
  2026-08-30** at `4039904`; goldens byte-identical.
- **[lab-corpus-document-filename.md](complete/lab-corpus-document-filename.md)** — all 119
  scenario roots now use `document.mnx.json`, including the generator-owned spec mirror and
  every runtime, harness and proposal consumer. Every fixture is a 100% rename, the normalized
  id→JSON digest and 552,016 bytes are unchanged, and no golden or verification record moved.
  **Landed 2026-08-30** at `8502e3f`.
- **[core-score-hud.md](complete/core-score-hud.md)** — a **HUD companion** beside the viewer:
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
- **[core-zoom-density-pad.md](complete/core-zoom-density-pad.md)** — campaign item 9, and the UI
  half core-render-density-zoom.md's status line still names as missing. A crosshair pad at the
  score's top right: **↑↓ staff** (a true scale, finally wiring `zoom` to `pxPerSp` instead of the
  paper card) and **←→ spacing** (the shipped `densityH`), magnifier resets. Five rulings the
  spec-grade mock left open, two of which delete work: the "computed collision floor" **cannot
  happen** — density scales springs, never the rigid columns — so it stays the existing
  `MIN_DENSITY` constant and the pad's contribution is making the silent clamp *visible*; and the
  ⌘+/⌘− question answers itself against keymap.ts's own Ctrl+K precedent (browser-claimed, don't
  take it). Staff is **fitted until first touched**, so the readout is honest on first paint.
  Vertical density is formally **cut** from this control — the arms are spent, and axis 3 needs
  the stem-length clamp first. One revision to the design: idle collapses to a 24×24 mark, 89%
  less score obscured.
- **[core-json-view.md](complete/core-json-view.md)** — campaign item 7. `src/model/jsonView.ts`
  is a **complete JSON-view engine with no UI consumer and no test**, while the panel renders
  raw text; `errorPointer` is set and never read, so the exhibit's "highlighted in document
  →" has been a false promise since the panel consolidation. Adds one field
  (`spanByPointer`, ~10 lines) to unlock the selection-scoped view, and the conformance test
  CLAUDE.md's "keep `jsonView` and `noteKeys` in lockstep" rule has always implied. The only
  below-the-boundary change in the campaign, hence the only properly testable one.
- **[workbench-queue-pips.md](complete/workbench-queue-pips.md)** — campaign item 6, the bill
  "red everywhere" runs up. Four status hues and four queue states do not fit through a
  one-accent system, and `--st-verified` (blue) beside a red accent reads as a leftover while
  `--st-gap` reads as an accident. Kept out of item 1 deliberately: the queue is the
  workbench's primary information display, and re-encoding semantics inside a repaint is how
  meaning gets lost. The opening is that **shape is already load-bearing** — the rail's dots
  vary shape as well as colour, for exactly this reason. Grayscale is the acceptance test.
- **[core-modernist-dark.md](complete/core-modernist-dark.md)** — campaign item 2. The
  workbench has a **complete dark theme nothing can turn on**: `resolved-theme` appears
  exactly once in the codebase, in its own selector. And Modernist is light-only by
  construction, so this is a *design* task, not a conversion — preferably drawn upstream in
  the design project rather than invented in CSS. Keeps rather than cuts, on the grounds
  that a restyle should not quietly remove a capability on its way past. Dark doubles as the
  completeness test for the tray's de-hexing.
- **[core-element-ops-part-addressing.md](complete/core-element-ops-part-addressing.md)** —
  campaign item 13b's addressing half, **built 2026-08-14**: `parts[0]` was hard-coded in
  **44 places**, splitting cleanly into ~10 that ADDRESS (cursor, grid, clef lookup,
  selection, the sweep) and ~25 that WRITE. Only the first half landed, and it unlocked the
  whole blocked set on its own, because removal was already part-agnostic through the shared
  walk. The key grammar generalized **without moving a byte** — part 0 and staff 1 stay
  silent — so 115 more elements became removable with no golden touched. The writing half
  became [core-entry-surface.md](complete/core-entry-surface.md), built 2026-08-23.
- **[core-element-ops-the-tail.md](complete/core-element-ops-the-tail.md)** — not an indexed
  item but the sweep of everything the board still called "no verb exists": **26 elements
  across seven kinds in one pass** (space, a beam inside a grace, ottava, kit notes,
  accidental display, a mid-measure clef), with kit components and sounds ending as
  **refused** rather than removable — guarded while a note still plays them. Corpus
  1,415 → 1,434 removed of 1,460.
- **[core-campaign-element-ops.md](complete/core-campaign-element-ops.md)** — **campaign**
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
  convergence in [core-editor-ai-prompt.md](proposed/low-priority/core-editor-ai-prompt.md).
- **[core-element-ops-destruct-sweep.md](complete/core-element-ops-destruct-sweep.md)** —
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
  now filed to [core-selection-ladder.md](complete/core-selection-ladder.md)).
- **[core-element-ops-lyrics.md](complete/core-element-ops-lyrics.md)** —
  campaign item 12, **built 2026-08-14**: syllables and verse metadata, and the
  index's proposed "text *mode* that suspends the keymap" is **rejected** — a
  syllable is one short string attached to one note, and the campaign already has
  a surface for typing one short string. The grammar borrows a singer's own
  notation (`sleep-`, `-ing`, `-ly-` carry the syllable's role; `2: Am` picks the
  verse; `line 2 Nederlands nl` names it). Two pairs, because a syllable belongs
  to the event and a verse's identity to the document. The sweep caught a real
  semantic error at once: the first `removeLyricLine` also pulled the line from
  `lineOrder`, so removing a verse's *label* silently reordered the verses —
  **sibling declarations are not cascades**. Reachable scenarios **78 → 82**,
  removable elements **1022 → 1056**.
- **[core-element-ops-technique.md](complete/core-element-ops-technique.md)** —
  campaign item 9, **built 2026-08-14**: the entry half of tab technique (bends as
  curves, slides, hammer-ons, pull-offs, vibrato, palm mute, harmonics) plus
  fingering. The `S` collision item 10 flagged **dissolves without a conditional**:
  the reserved letters `B H S V X O` live in the tab *pane layer*, and pane layers
  resolve before shared ones — so `B` bends in tab and beams in notation, `S`
  slides in tab and slurs in notation. A polymorphic key turns out to be a
  layering fact, not a branch. `H` is one key for hammer-on and pull-off because
  the interval decides which — you hammer up and pull off downward. Reachable
  scenarios **71 → 78**, removable elements **1003 → 1022**, goldens untouched
  (drawing was [core-guitar-technique.md](complete/core-guitar-technique.md)'s
  gap, closed 2026-08-24).
- **[core-element-ops-accidental-spelling.md](complete/core-element-ops-accidental-spelling.md)** —
  campaign item 6, **built 2026-08-15**: the row was **two questions wearing one name**.
  SPELLING is a policy — `spellPitch` in `staffSpace.ts`, where the key context already
  lives: a letter the key alters wins, else the key's sign, else the DIRECTION of the
  move (down spells flat), which is what finally makes E♭ writable after a placeholder
  that answered "natural, then sharp" in every key. `J` cycles the policy's own
  candidate list to overrule it, sound held fixed. DISPLAY is ink — `accidental parens`
  joins the adornment popover rather than earning a sixth one, and writes the
  `enclosure` the corpus has carried all along (the renderer's gap is unchanged).
  One recorded trace changed correctly: `chord-stack-fret`'s downward transpose now
  spells B♭ where it spelled A♯.
- **[core-element-ops-duration-completion.md](complete/core-element-ops-duration-completion.md)** —
  campaign item 4, **built 2026-08-15**: the dot (`.`, cycling 0→1→2→none, splitting
  ink from absence exactly as the duration ladder does) and the time signature's
  **glyph** (`common`, `2/2 cut` — `display` is what it is DRAWN as, not the meter).
  Capo turned out to have been closed by item 13, so the row was two verbs, not
  three — check the index before building from it. The dot uncovered a silent clamp:
  entry took the shorter of the pending duration and the rest it landed on, so a
  dotted quarter over beat-rest padding came out plain. Entry now eats following
  RESTS to make room and refuses when ink is in the way. Dotted rests stay with
  11b's spelling verb (`rest half.`), because a rest is absence.
- **[core-element-ops-onset-granularity.md](complete/core-element-ops-onset-granularity.md)** —
  campaign item 11b's first half, **built 2026-08-14**: the bug that stopped item
  11 recording a beam trace, and it had nothing to do with beams — **a run of short
  notes was unenterable** (eight 32nds came out `32nd, quarter, quarter…`). Two
  compounding mechanisms: the duration keys stepped the pending duration only on an
  *entry ghost*, but a padded bar is full of rest EVENTS, so they re-valued the rest
  instead; and entry then inherited the rest's duration, ignoring the one it was
  given. The campaign's own founding rule settles both — **a rest is absence**
  (§8.11) — so the keys step the pending duration over a rest as over a ghost, and
  entry takes the pending duration with the surplus staying as rest *after* it
  (never by shortening in place, which would drag every later event earlier and
  re-time the bar). It also triggered the campaign's parked trace-maintenance case
  for the first time: `from-scratch` changed correctly and was regenerated through
  `npm run update:edit-traces`. And it uncovered the next blocker in the same
  breath — rest durations are a *consequence of padding, not a choice*, so a
  scenario writing one half rest where padding spends two quarters is still
  untraceable. Containers and rest spelling remain 11b's open half.
- **[core-element-ops-part-declarations.md](complete/core-element-ops-part-declarations.md)** —
  campaign item 13, **built 2026-08-14** at a narrower scope the numbers chose:
  the five keys on `parts[0]` (name, strings, capo, staffKind, staves) finally get
  **the removal halves their genesis verbs never had** — part-name alone was 59
  unremovable elements, because item 1 built genesis in a hurry for construct
  traces. Removable elements **912 → 1003**, reachable **68 → 71**. The sweep
  refused the first version twice and sharpened it both times: removing `strings`
  from a tab-projecting part left it declaring a view it could not draw
  (diagnostics 0 → 2), which became a **declared cascade** — fingerboard and tab
  preference are one decision; and the no-tombstone cleanup then read as damage,
  since emptying `_x.mnxLab` collapses `_x` two levels up, which became the
  oracle's **ancestor-collapse** rule. The index row's real subject (a second
  part, voice or staff, plus layouts and scores) is now **item 13b**, and it
  carries a price tag: `parts[0]` is hard-coded in the note-key traversal, so it
  changes keys the primitives goldens embed — a corpus re-verification event that
  deserves its own decision.
- **[core-element-ops-adornments.md](complete/core-element-ops-adornments.md)** —
  campaign item 8: markings, dynamics and directions, **built 2026-08-14**. The
  first item where the campaign's own family test says **do not collapse**: all
  three read as "attached to this moment", but a marking is a key on the *event*
  while dynamics and directions are positioned entries on the *part measure*, so
  they land as two op pairs behind one `Shift+A` popover. It also introduces the
  **first two-coordinate address** — a dynamic sits at a moment, not just a bar, so
  `ElementRef` grew an `onset` and the sweep drives to the cursor's position before
  firing. Results: reachable scenarios **55 → 68**, removable elements
  **842 → 912**, both predictions exact. Single-letter accelerators are deferred on
  purpose: keys are the unstable layer, and no op or trace changes when they bind.
- **[core-element-ops-rhythm-declarations.md](complete/core-element-ops-rhythm-declarations.md)** —
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
- **[core-element-ops-spanners.md](complete/core-element-ops-spanners.md)** —
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
- **[core-element-ops-bar-attributes.md](complete/core-element-ops-bar-attributes.md)** —
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
- **[core-element-ops-clef-key.md](complete/core-element-ops-clef-key.md)** —
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
- **[core-element-ops-construct-traces.md](complete/core-element-ops-construct-traces.md)** —
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
- **[workbench-score-panel.md](complete/workbench-score-panel.md)** — campaign item 5, the
  structure half and the campaign's showcase. **Seven tabs become five** (`description ·
  ops · hud · compare · json` — authored, changed, current, expected, raw), all in one
  five-band frame where only the body scrolls. Adopts the design's rule **"the tray edits,
  the HUD explains"** as the user-facing half of the HUD doc's content/presentation
  boundary. Resolves the apparent PART-rung conflict as **vocabulary, not substance** (the
  mock's "rung" is the HUD's existing part row) — and takes the one real consequence: the
  HUD's stage 4 is **cut and redirected to the tray**. Sequences the `actions` retirement so
  nothing is removed before its replacement exists, keeps `?view=compare|json` untouched,
  and defers the `<360px` drawer for want of a panel toggle nobody has drawn.
- **[core-modernist-type.md](complete/core-modernist-type.md)** — campaign item 3. Corrects
  the record: fonts **are** bundled, via `@fontsource/*` in `src/entries/main.ts` ("no font
  CDN"), so Archivo is a dependency plus three imports — no `@font-face`, no `public/`
  asset. `--serif` retired (Modernist has no serif); mono stays a **deliberate** system
  stack, recorded so nobody adds a second webfont back. Flags that bundling the real face
  **changes an already-reviewed shipped surface** — the tray was tuned against the fallback
  — so it carries a full tray re-review.
- **[core-modernist-tokens.md](complete/core-modernist-tokens.md)** — campaign item 1, **the
  contract everything blocks on**. Radius tokenized first as a values-unchanged no-op
  refactor precisely so the palette flip is a one-file diff a human can review; then the
  OKLCH re-cut, `--rule-w`, five new semantic names, and the accent. Argues *against*
  importing the design's numeric 100–900 ramps — the repo's vocabulary is semantic and is
  the contract with the public `--mnx-*` overrides, and a numeric ramp invites use-site
  guessing. Deliberately does **not** touch the pip ramp (item 6): the job is to flip the
  surface without changing what anything means.
- **[core-selection-tray-visuals.md](complete/core-selection-tray-visuals.md)** — the **selection
  command tray**, part 1 of 3, **complete 2026-08-15** (stages 1–4 in one day): `/` stops
  opening a document-wide list and opens a tray **planted under the selection** — scope tabs
  that are the ladder's rungs (presence-rule filtered, HUD vocabulary), a Bravura glyph grid
  with shortcut and state per tile, shaft+plinth connector, hover readout, scoped search —
  on demo data, firing nothing, per the visuals/mechanism split. Faithful to the Claude
  Design spec's art direction (Archivo / `#ec3013` / zero radius); a dumb
  `<mnx-selection-tray>` incubating in `workbench/` (ScoreHud posture); the one `elements/`
  change is the viewer's `selection-anchored` rect event + `selectionAnchorRect()` method;
  `/` → tray via a cancelable `mnx-tray-intent` that falls through to go-to on editorless
  pages (rebound from Ctrl+K on 2026-08-15: Chrome owns that chord and took it back from
  every text field; the rail filter's `/` retired to Ctrl+G, and Ctrl+Shift+K retired when
  the global commands became a tray tab). The stage-4 UX review revised two things, both in the
  component: **ink-box glyph normalization** (each glyph drawn into its own font-metadata
  bounding box, 34px target with a 30px/sp ceiling — a palette normalizes optical size
  where a score must not) and **the shortcut as a corner chip** on 66×64 tiles. Parts 2–3
  ([mechanism](complete/core-selection-tray-mechanism.md) and its
  [global tab](complete/core-selection-tray-global-tab.md) also complete; the
  [residue ledger](proposed/core-selection-tray-residue.md) stays open).
- **[core-selection-tray-mechanism.md](complete/core-selection-tray-mechanism.md)** — part 2:
  the tray wired, **stages 1–4 built 2026-08-15** (hands-on review open). One ruling — tiles
  fire **intents through `session.handleIntent`, nothing else** — so tray clicks land in the
  op queue and replay through traces like keystrokes. `src/edit/commandRegistry.ts` holds 56
  commands over all seven rungs, each row the *surface half* of a
  [campaign](complete/core-campaign-element-ops.md) agreement block (rungs, glyph,
  key/tier, `isActive`, `action`), pinned by 18 conformance joins: shortcuts some table
  really binds, surfaces that exist, intent types the session handles, glyph names the font
  carries with bounding boxes, and the ledger agreement that keeps greyed tiles and the
  residue doc from drifting. Drafted against a 15-op vocabulary; the sweep inverted the
  emphasis — the verbs exist and their only human surface was typed popover grammars, so the
  tray fronts a nearly complete vocabulary and the greyed set is the residue's short tail.
  Scope preview draws a dashed candidate enclosure found through the renderer's existing
  `data-source-id`, so **no layout code and no golden moved**; commit walks the ladder via a
  `walkToLevel` shared with the HUD. **Escape precedence declared once** as
  `ESCAPE_PRECEDENCE` and asserted, answering the ladder's open question. Two findings: the
  tray must call `followProjection` on open (it offers a *dialect* — `S` slurs in notation,
  slides in tab), and the ops panel credits **the key, not the emitter**, which is its
  existing contract — so the tray registers as a surface only for `setAccidentalDisplay`,
  the one intent it adds to keyboard reachability. **Complete 2026-08-15** — the hands-on review ran through the build, so later findings arrive as their own proposals rather than reopening it.
- **[core-selection-tray-global-tab.md](complete/core-selection-tray-global-tab.md)** — a fourth
  tray item, **built 2026-08-15 the day it was proposed**: should the command palette just be
  another tab? **Half yes** — and the half is only visible once you notice the palette is two
  things wearing one coat. Its `>` half is a small fixed set of **commands**; its bare half is a
  ranked, unbounded **destination** finder over scenarios, bars and objects. The commands become
  the tray's always-present `global` tab (the scope above `score` — the word the design spec
  itself used, and the top of the containment chain the tabs already are); go-to stays on Ctrl+G,
  because it must run where the tray cannot exist at all — the queue, the coverage map — and
  because "commands for what is selected" and "search everything" are the two halves of the
  tray's whole claim. The line that falls out: **`/` is commands, escalating outward; Ctrl+G is
  destinations**, so `//` now moves one scope further rather than switching widgets, and
  **Ctrl+Shift+K retires**. Landed the `CommandScope = SelectionLevel | 'document'` axis, nine
  document commands, and the page's own chrome tiles (copy trace, revert) joining that tab under
  a `page:` prefix — `edit/` keeps only editor verbs. The build taught one rule: a tab outside
  the ladder must be **non-committable**, or it inherits the "↵ to widen selection" hint and
  Enter silently does nothing. **Complete the day it was proposed**; review comments become new proposals.
- **[core-element-ops-exemplar.md](complete/core-element-ops-exemplar.md)** — campaign
  item 1 of [core-campaign-element-ops.md](complete/core-campaign-element-ops.md):
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
  ([core-editor-ai-prompt.md](proposed/low-priority/core-editor-ai-prompt.md)) and the `elements/` promotion
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
- **[core-open-router.md](superseded/core-open-router.md)** — pre-rebuild two-stage
  **voice + structured edit** plan (Express proxy, VexFlow, chat panel). Superseded
  twice, 2026-08-20: its text-edit half shipped long ago in a different shape (the
  Worker's `/api/edit-notation` NDJSON self-correcting loop), and its surviving idea —
  the two-stage transcribe-review-submit voice UX — was merged into
  [core-editor-ai-prompt.md](proposed/low-priority/core-editor-ai-prompt.md) as that item's voice
  stage. Do not build from this document.

### rejected/
- **[core-density-ladder-ink.md](rejected/core-density-ladder-ink.md)** — the density
  ladder deliberately re-packs a square `PackingInput`, so its rungs become approximate
  once ink pricing diverges from square packing at extreme staff scales. The mismatch is
  measured and understood, but the control works well enough in practice; rejected
  2026-08-23 because correcting it would add planning complexity or paint-time cost
  without a concrete navigation failure. The measurements and four alternatives remain
  recorded if real use makes the approximation consequential later.
- **[workbench-panel-drawer.md](rejected/workbench-panel-drawer.md)** — item 8 of the
  Modernist campaign: the score panel as a drawer on narrow windows. Drafted 2026-08-15
  complete with the closing design (Escape at the `overlay` tier, click-away via the
  palette's `.backdrop`), and **rejected 2026-08-20** on its own analysis: the squeeze
  only bites below ~1100px, where Ctrl+B already reclaims the rail's 270px and the drag
  handle reaches the panel's 360 floor — a new mode, breakpoint and control buy little,
  and nobody has ever hit the case. The bucket's first occupant; the full design is kept
  so the next "the panel should collapse on narrow windows" finds the case against it.
  Two findings outlive the rejection: **any future overlay gets Escape for free** at
  slot 2 of `ESCAPE_PRECEDENCE` (it must own its keydown; no keymap change, no
  arbitration code), and **a dismissing click should be swallowed** — worth deciding
  before `note-selected` gets a consumer, because afterwards it presents as an
  intermittent "the cursor jumped" bug.

## Not here (reference docs, left in place)

`CLAUDE.md`, `README.md`, `SVG_RENDERING_ENGING.md`, `docs/mnx-extensions.md`,
`schemas/HISTORY.md`, `research/mnx_format.md` — these are current reference, not plans.
