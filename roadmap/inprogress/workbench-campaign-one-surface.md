# One editing surface — retire the popovers and the tray into the inspector

> **Status: in progress 2026-08-31 — campaign; items 1–5 and 7 built the same day, item 6 proposed (design open).** The three-surface experiment run by
> [workbench-rung-inspector.md](workbench-rung-inspector.md) ("a third
> editing surface, to be tried *beside* the tray and the popovers so that use decides
> which wins") has its verdict: **the inspector wins.** The user's ruling, 2026-08-31:
> all `Shift+letter` popovers and the selection tray retire — but only once the
> inspector covers each one's features, or a better home is found for what does not
> fit. Coverage first, removal second, one surface per item.

## Why a campaign

The popovers are feature-first by accident of campaign order (each landed with the
element-ops item that needed it); the tray is rung-first; the inspector is both — the
rung window gives it the tray's scoping, the typed slot gives it the popovers'
grammars, and the pills answer the question neither predecessor could ("what is set on
this thing?"). Running three surfaces was the experiment; maintaining three surfaces
indefinitely is drag: every new op needs three registrations, the keymap spends ten
`Shift+letter` chords on grammars the slot already speaks, and the seam between them
(popover-tier tray tiles that *open* popovers) is the asymmetry
workbench-rung-inspector.md documented and nobody can name.

Retirement is per-surface because coverage is per-surface: six of the ten grammar
parsers are already reused by `src/edit/inspector.ts` (`time`, `key`, `clef`,
`barAttribute`, `adornment`, `lyric`), four never were (`rhythm`, `tuning`, `part`,
`layout`), and the tray holds things the inspector excludes **by its own charter**
(verbs). The gap between "already spoken by the slot" and "needs a new op before the
surface can even represent it" is exactly the simplest-to-hardest order below.

## The shared contract

Every item makes these agreements before code:

1. **Census before coverage, coverage before removal.** The item opens with a feature
   census: every sentence its popover's parser accepts (its arm of
   `src/edit/setupGrammar.ts`), every op it can fire, every rung the registry
   cross-lists it at. Each row of the census maps to an inspector pill or typed word —
   existing or built by the item — and the popover is deleted only when the census
   reads fully covered *at the right rung*. "Covered" is demonstrated, not asserted:
   `npm run smoke:inspector` or a conformance join exercises each family the item
   migrates.
2. **The inspector stays a state surface.** Verbs (insert, split, delete, wrap,
   transpose) stay in the keymap and are not smuggled in as pills that fire and vanish.
   An item whose popover is verb-shaped (part genesis, the tray itself) must *argue*
   its answer — a construct affordance with precedent (the ghost bar of
   core-rung-insert.md), a keymap binding, or an explicit, recorded exception — rather
   than quietly widening the inspector's charter.
3. **Ops land before surfaces retire.** Where the census finds the inspector
   *structurally* unable to represent a feature (container properties, tuning writes,
   part construction, layout authoring), the missing op or pill class is part of the
   item and lands first. A popover is never removed while it is the only path to an op.
4. **Removal is the full sweep.** The shell binding and `ShellAction` arm, the popover
   component, the palette row (`ScenarioPage`), the registry's `popover`-tier tiles for
   that family, the `KEY_DOCS` rows, and — when the inspector does not reuse it — the
   `setupGrammar.ts` parser arm. Parsers the inspector *does* reuse survive; retirement
   removes the surface, not the grammar. Recorded traces that drove the popover
   regenerate along the change (the floor-axis precedent).
5. **Freed keys are recorded, not squatted.** Each retirement frees a `Shift+letter`;
   the campaign log records it. Reassignment is its own decision per key — `Shift+S`
   is already spoken for (the tab projection's shift slide; ruled 2026-08-31, with
   layout moving to `Shift+E` in the interim, ahead of item 10). A freed key may also
   become an inspector *accelerator* (open at the family's rung, slot pre-filtered) —
   the possibility workbench-rung-inspector.md left open — but that too is per-item
   evidence, not a default.
6. **Goldens byte-identical.** This is a surface campaign; nothing touches `model/`
   layout or `engine/`. Any item that finds itself needing to move layout code has
   left the campaign's scope and stops.

Out of scope: the viewer's instrument-override setup popovers (presentation, not
document editing — the page-level overlay CLAUDE.md describes), the palette, go-to
(`Ctrl+G`), and the side panel. "Except the inspector" also means the inspector's own
open questions (textual addresses, embed) stay with its doc.

## The index — simplest to migrate/remove, first to last

Rows graduate to ordinary proposal docs when picked up (campaign convention); each row
is one popover or the tray, and one work item.

| # | Surface (key) | Inspector coverage today | What the item must close | Status |
|---|---|---|---|---|
| 1 | **Key signature** (~~`Shift+K`~~ freed) | `key` pill, stage 3 — reuses `parseKeySignature`, `inherit` = Backspace floor | census + removal sweep only | ✅ [built 2026-08-31](../complete/workbench-one-surface-key.md) |
| 2 | **Time signature** (~~`Shift+T`~~ freed) | `time` pill, stage 3 — reuses `parseTimeSignature`, floor when declared | census + removal sweep only | ✅ [built 2026-08-31](../complete/workbench-one-surface-time.md) |
| 3 | **Clef** (~~`Shift+C`~~ freed) | `clef` pill at partMeasure, stage 4 — reuses `parseClef` | verify the registry's `measure` cross-listing loses nothing; sweep | ✅ [built 2026-08-31](../complete/workbench-one-surface-clef.md) |
| 4 | **Bar attributes** (~~`Shift+B`~~ freed) | one pill per declared attribute, stage 3 — reuses `parseBarAttribute`; the rhythm riders live as voiceMeasure pills | verify all ten kinds + `tempo#n` array + segno/fine `at` forms; sweep | ✅ [built 2026-08-31](../complete/workbench-one-surface-bar.md) |
| 5 | **Adornments** (~~`Shift+A`~~ freed) | markings/positioned pills, stage 4 — reuses `parseAdornment` | verify breadth (all markings, dynamics, directions incl. glyphs); sweep | ✅ [built 2026-08-31](../complete/workbench-one-surface-adornment.md) |
| 6 | **Lyrics** (`Shift+L`) | syllable pills per line (`lyric 2: Am`), stage 4 — reuses `parseLyric` | **gap: line management** — plus two design investigations (lines × repeats, WYTIWYG entry) | 📝 [proposed 2026-08-31](../proposed/workbench-one-surface-lyrics.md) — design open |
| 7 | **Tuning** (~~`Shift+U`~~ freed) | `capo` pill writable; `strings` is a **read-only** reading | **gap: the tuning write path** — `parseTuning`'s sentence has no inspector form; a strings pill that writes (part rung), refusals for strings in use; sweep | ✅ [built 2026-08-31](../complete/workbench-one-surface-tuning.md) |
| 8 | **Rhythm** (`Shift+R`) | container pills are **read-only** (`tuplet: 3:2`, dotted, refuse Enter); full-measure rest / measure repeat pills exist at voiceMeasure | **gap: the missing verb** — the `setContainerProperties`-class op the residue ledger names, plus a construction story for tuplet/grace/authored-silence declarations (contract §2: construction is a verb) | row |
| 9 | **Part** (`Shift+P`) | nothing — part genesis is a pure construct verb | a construct affordance with the ghost-bar's shape (a ghost part the inspector's window can stand on), or a keymap verb; `parsePartDeclaration` migrates or retires with it | row |
| 10 | **Layout** (`Shift+E`, moved from `Shift+S`) | nothing — no document-rung pills exist | the document rung grows its pill families from `parseLayoutSentence`'s grammar (sources, systems, quoted names — the largest parser in the file); likely splits into sub-items when picked up | row |
| 11 | **The selection tray** (`/`) | verbs are excluded from the inspector by charter; the `global` tab and the triage ledger (../proposed/core-selection-tray-residue.md) have no inspector form | **last, and gated by 1–10** (its popover-tier tiles open the popovers). Re-home the verbs (keymap + the `?` legend + palette), decide the `global` tab's successor, absorb or retire the triage ledger, free `/` | row |

The order inside 1–5 is near-arbitrary (all five are census-and-sweep); they are
ranked by grammar size. 6–7 each carry one bounded gap. 8–10 each need design and at
least one new op. 11 is a different kind of item — it retires a *charter*, not a
grammar — and cannot start until the popover-tier tiles have nothing left to open.

## Relations

- [workbench-rung-inspector.md](workbench-rung-inspector.md) — the
  surface everything consolidates onto; its "What this does not decide → whether the
  popovers retire" is decided here. Its container-verb dependency is item 8's core.
- [core-selection-tray-mechanism.md](../complete/core-selection-tray-mechanism.md),
  [core-selection-tray-residue.md](../proposed/core-selection-tray-residue.md) — the tray trio;
  item 11 is their sunset, and the residue doc's triage ledger must be settled by it.
- [core-element-ops-bar-attributes.md](../complete/core-element-ops-bar-attributes.md)
  and siblings — the campaign that built the popovers; this one retires their
  surfaces while keeping their ops and (mostly) their grammars.
- [core-rung-insert.md](../complete/core-rung-insert.md) — the
  parent-constructs-child rule and the ghost bar; item 9's precedent.

## Progress + learnings log

- **2026-08-31 — item 7 (tuning) built.** First coverage-building item, and the
  census caught a bug parity would have carried: `setTuning` wrote `parts[0]`
  unconditionally — fixed (op takes `partIndex`, session passes the cursor's
  part, two-part pin added) rather than logged, because contract §3 makes the
  moment before a surface exists the cheap moment to fix its op. The typed
  `tuning` word is offered on ANY part (the `needsTab` guard was surface-only;
  declaring a fingerboard is the user's call), so the inspector ends strictly
  more capable than the popover. Learning: grammar consumers are not all
  editing surfaces — the viewer's TabSetup overlay imports `parseTuning` too;
  sweep by reference, not module (items 9–10 take note).
- **2026-08-31 — item 6 (lyrics) proposal written, design open.** Not a sweep:
  beyond the line-metadata gap, the doc frames two investigations for a fresh
  conversation — how verse lines relate to repeat passes/voltas (data vs
  derived), and a WYTIWYG lyric lane (which would partially reopen item 12's
  popover-not-a-mode ruling; precedents and open questions recorded). The
  Shift+L accelerator exception is explicitly deferred to that design. The
  popover stays until coverage is demonstrated.
- **2026-08-31 — item 5 (adornments) built.** The census-and-sweep five are
  done. Broadest grammar (eight parser arms, thirteen intents), purest sweep —
  parity automatic through `parseAdornmentLine`, zero new assertions needed.
  Item 4's lesson applied in advance: the badge census found four stray
  `Shift+A` badges on intent tiles and stripped them before the join went red.
  Standing learning: where the inspector reuses the popover's parser, coverage
  disputes never materialize — the risk lives entirely in registry metadata
  (badges, twins, groups). Items 6–10 do not share that guarantee.
- **2026-08-31 — item 4 (bar attributes) built.** The biggest sweep so far: six
  popover-tier tiles and three group trims (no group emptied — the intent-tier
  tiles keep every family visible until item 11). The seam its predecessors
  flagged is repaired: the measure rung's rider refusal now signposts the voice
  rung instead of pointing at the deleted Shift+B, and the assertion pins the
  new message. Learning: a popover that was a surface for another rung's ops
  retires into a *signpost* — the refusal message is coverage too. Second
  learning, from two red tests: the registry joins bill a sweep for more than
  its tiles — intent tiles wearing the popover's `Shift+B` badge (all six
  stripped), and `KNOWN_TWINS` glyph clashes the deletions resolved (two
  pruned).
- **2026-08-31 — item 3 (clef) built.** The first rung casualty: the tile's
  `measure` cross-listing dies with it — a clef edit from the bar rung is one ↓
  first, the rung discipline applied. A two-scope tile costs two group entries
  (`staff` at partMeasure, `signatures` at measure). Ops residue recorded, not
  fixed: on a multi-staff part the inspector's per-staff clef pills all
  set/remove at the *cursor's* staff — the popover had the identical
  limitation, so parity held; fixing it means staff-addressed `setClef`/
  `removeClef` intents, an ops item beside the `parts[0]` full-measure-rest gap.
- **2026-08-31 — item 2 (time signature) built.** First global-tab casualty:
  `doc-time` (scope `session`) deleted along with the measure tile — the
  session-scope `doc-*` tiles are ungrouped, so removal is tile-only; items 7
  and 9 meet the same shape (`doc-tuning`, `doc-add-part`). Two assertions
  added for the display/`inherit` forms; otherwise coverage pre-existed, as
  item 1 predicted.
- **2026-08-31 — item 1 (key signature) built.** Ruling: freed keys are **freed,
  not accelerators** — no inspector pre-fill on the retired mnemonic; a key edit
  is Enter → bar rung → `key Bb`. The ruling is the campaign default for items
  2–10 (lyrics flagged as the possible exception), so later items inherit it
  rather than re-ask. Learnings: coverage evidence for the stage-3/4 families
  largely pre-exists in `rung-inspector.test.ts` — check before writing new
  smoke; the inspector's full-measure-rest refusal message says "Shift+B", which
  item 4 must rewrite; the `ElementKind` names (`key-signature`) look like
  surface ids but are the document census — leave them.
- **2026-08-31 — campaign created.** Standing key decisions folded in from the
  proposing conversation: layout's popover moves `Shift+S` → `Shift+E` immediately
  (independent of item 10) so `Shift+S` can become the tab projection's shift slide;
  the slur surfaces (`S` key, tray tile) are notation-projection-gated and the tray's
  slur tile must not be lost in item 11's sweep — slur reachability from the tab
  projection is an open question that item 11 inherits.
