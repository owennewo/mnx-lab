# The unrolled engraving — an occurrence-aware layout plan

> **Status: complete 2026-09-09; unrolled engraving review pending.** Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 10. Needs items 1, 2 and 7.
> **Moved after the player** on review: this is a layout-plan change, not an
> emission-loop change, and the reviewer hears trustworthy playback sooner without
> it. Still a **toggle**, not a fourth view mode.

## Agreement block (campaign contract)

- **Pure before audible (§1).** A layout concern: `planHorizontal` (`spacing.ts`)
  gains `entries?: PerformedEntry[]`; with none it plans document order and emits
  byte-identically. The toggle is presentation state, never persisted into a document.
- **Identities (§3).** Each **occurrence** gets its own geometry — its own
  `MeasurePlan` — because the plan's measure indexes underpin curves, beams, dynamics,
  lyrics and ottavas, and a repeated bar cannot share one set of them. Primitives carry
  an occurrence-qualified `sourceId` (`noteKey` + ordinal); the highlight and the
  note↔JSON cross-highlight (`jsonView.ts`, kept in lockstep per
  [docs/rendering.md](../../docs/rendering.md)) map every occurrence to its written
  note. Selecting selects the written note; all its occurrences light.
- **Proof (§4) — the path owned.** Toggle off: no existing golden moves. Toggle on:
  opt-in `expected.unrolled.svg` (and `.unrolled.tab.svg` for tab-opting scenarios)
  for the 14 navigation scenarios, hashed as `unrolledHash`; this item adds the flag
  and hash to `meta.schema.json`, the stale rule and writer in `verify-scenarios.mjs`,
  and the side-by-side on the review page. New opt-in output without its hash is
  unseen evidence, even for a scenario whose written engraving is approved; missing
  required output is blocked. Only presentation and approval of this view stamps its
  hash, preserving unrelated approvals (item 5's evidence lifecycle tests). Registered in
  [lab-verify.md](../inprogress/lab-verify.md).
- **Dependencies (§5).** None.
- **Reviewer gain (§7).** The performed order on the page: a wrong volta is a bar in
  the wrong place, seen in a second.

## Design

- **Plan extension, not an expanded document.** An expanded document would prototype
  fast but needs every id, reference (ties, slurs, technique targets, beams) and
  inherited state rewritten per copy. The plan already resolves clef, key and time
  **in force** per measure; with entries it resolves them at the **jump target** (the
  clef in force at the segno, not at the bar before the D.S.), which is the one
  correctness rule an expanded document would get wrong silently.
- **Spanners across occurrences.** A tie or slur into a bar that is performed twice is
  drawn twice, once per occurrence pair; a `crossJump` tie is drawn only on the
  occurrence pair the traversal actually joins.
- **Drawn differences.** Repeat barlines regular; ending brackets, segno, Fine, D.S.
  glyphs omitted; an **occurrence label** (`2×`) above the first beat of any bar on
  occurrence ≥ 2; written bar numbers kept. Partial measures (`from`/`until`) drawn
  whole with a badge. Multi-measure-rest collapses and forced breaks from `layouts`
  are written-order facts and are ignored when unrolled — badge, not clamp.
- **Surface.** One toggle in the view controls, deep-linked `&unrolled=1`. All three
  views share the entries through one helper so they cannot disagree about order.

## Done bar

- Toggle off: `update:primitives` clean. Toggle on: the 14 opt-in goldens generated,
  queued, registered with "look for: bar order equals `traversal.test.ts`'s
  hand-stated entries; clef/key at the segno; labels only on occurrence ≥ 2".
- `note-keys.test.ts` extended: every visible unrolled `sourceId` resolves to a
  written note on its entry. Keep **visible** occurrences separate from **performed**
  occurrences: whole-bar drawing of a partial entry can show notes outside its slice.
  Those receive an explicit unperformed marker and cannot be seek/highlight targets.
  For supported note geometry, the performed occurrence set equals the compiler's
  written occurrences; unsupported geometry is diagnosed separately. Clip crossing
  spans by the same half-open bounds as the compiler. Under D.S. al Fine, neither
  assertion requires reaching every note in the document.

## Implementation and review

Landed as `a0fd152` on `main`; the isolated `core-player-unrolled-view`
worktree was removed before this document moved to `complete/`. The
[contract](../../docs/player-unrolled.md) records the public entry/toggle API,
written/occurrence identity mapping, partial-bar semantics and independent
approval lifecycle. Sixteen cases cover the original fourteen plus the two
later traversal regressions; 18 new SVGs are registered in the
[standing review ledger](../inprogress/lab-verify.md#unrolled-engraving--2026-09-09).
No human approval has been inferred or written. After rebasing, all goldens
regenerated cleanly; 1,601 tests across 92 files, corpus validation and the
production build passed. Headless Chrome unrolled interaction/review and the
installed Node library smoke checks also passed. Existing written goldens and
approval records are unchanged.

The closeout regression also excludes ID-less notes outside a partial slice from
slur/tie starts and technique-site collection, preserving visible whole-bar ink.
