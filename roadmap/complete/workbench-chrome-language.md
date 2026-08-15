# The rail and the headers, in the panel's language

> **Status: COMPLETE 2026-08-15.** Built in a worktree, landed on `main` at
> `98ebaea` with all gates green and the goldens byte-identical.
>
> The landing is worth a line of its own, because it is the first time this
> repo's parallel-work contract was tested against a genuinely occupied `main`.
> The primary checkout held ~1,240 lines of another session's uncommitted work
> touching two of the same files, so `merge --ff-only` refused — correctly, and
> that refusal is the contract working rather than an obstacle. Resolved by
> stash → fast-forward → pop, with the two conflicts (`roadmap/README.md`,
> `ScenarioPage.ts`) settled by keeping **both** sides: their `.panel-toggle`
> needed the flex head this item's band styling had removed the padding from,
> so the merge produced a change neither side wrote — the toggle centres in the
> band now, which also lines it up with `.rail-toggle`, its mirror. See the
> **Landing** section at the end.
>
> A **post-campaign** item against [core-campaign-modernist.md](../complete/core-campaign-modernist.md),
> whose index closed with the look half done everywhere and the *structure* half
> done in exactly one place. It inherits that campaign's contract (below) rather
> than reopening its index — the campaign is complete and should stay so.

## The gap

Item 1 of the campaign flipped the tokens **workbench-wide**: one palette, one
accent, one face, both themes. Item 5 then gave the right-hand side panel a
**frame** — the five bands, the 2px ink rules, the flush tab strip, the inset
accent underline, the pinned `--bg-context` bar
([workbench-score-panel.md](../complete/workbench-score-panel.md)).

Nothing did that for the left. The rail and the two headers took the new colours
and kept their old *structure*, so the app reads as one palette across two
grammars:

| | Right panel | Rail + headers, before this |
|---|---|---|
| Structural divider | `var(--rule-w)` solid `--ink` | `1px solid var(--line)` |
| Section label | Archivo 600 10px, uppercase, 0.11em | mono 10–12px |
| Active mark | `--accent-fg` + `inset 0 -2px` accent | a background tint |
| Pinned band | `--bg-context`, one scrolling body | no bands; the whole nav scrolls |

Corners are **not** on that list, and that is worth recording: every
`--radius-*` token is already `0px` (item 1, stage 1), so the rail's
`--radius-tab` / `--radius-input` / `--radius-chip` references were already flat.
The rounding this item looked for had been gone for a day. **Read the token
values before listing a symptom** — the third time in this campaign's lineage
that a design-shaped complaint turned out to be already answered.

## The agreement block

Per the campaign's shared contract, written before any code:

1. **Tokens over literals.** No new colour, rule width or face is invented; every
   value here already exists in `src/elements/tokens.ts`.
2. **One new shared primitive, and it is adopted three times or not added.**
   `.band-label` goes into `sharedChrome` and is used by the rail's group
   headings, the queue home's section headings and the coverage map's — the
   campaign's own learning that *"a shared primitive nobody adopts is just dead
   code with a good reputation"* is treated as a rule, not a remark.
3. **The rail adopts `.row-state` / `.row-current` rather than restating them.**
   Those primitives were added by item 1 for exactly this vocabulary and, until
   item 7, nothing used them. The rail's current item is the same "this row is
   the one" state the ops list draws.
4. **The embeddable surface is untouched.** No `--mnx-*` override is renamed or
   removed, and nothing in `elements/ScoreViewer.ts` or the viewer's own
   stylesheet moves. `sharedChrome` is included by the standalone viewer, so the
   one addition there is a class the viewer never renders — additive, inert.
5. **`src/engine/` is untouched.** Chrome only.
6. **Goldens byte-identical**, asserted rather than assumed.

## What changes

**Structure, in three moves.** They are the same three moves the panel made, run
against the other side of the window.

1. **A rule is 2px of ink.** The header's bottom edge and the rail's right edge
   become `var(--rule-w) solid var(--ink)` — the rail's right edge is now the
   mirror of `.panel`'s left edge, so the score sits between two rules of equal
   weight instead of a hairline on one side and a rule on the other. Hairlines
   survive *inside* lists, where they separate rows rather than regions; that
   distinction is the whole reason there are two weights.
2. **The rail gets bands.** `nav` stops being one long scroll. The attention
   link and the filter box move into a pinned `--bg-context` band with a 2px
   rule under it, and the grouped list becomes the **one** scrolling region
   below — band 3 and band 4 of the panel's frame, in the same order, on the
   other side.
3. **The headers become bands.** The app header takes the `--bg-context` ground
   it always structurally was, and the scenario page's view tabs adopt the
   panel's tab strip exactly: flush left, no gaps, uppercase 600 10px, the
   active one marked by `inset 0 -2px 0 var(--accent)` rather than by a box.

   The two tab strips **do not line up horizontally**, and an earlier draft of
   this doc claimed they would. They cannot: `.head` spans the page *above*
   `.body`, so the panel's strip necessarily sits one band lower. What makes
   them read as one control is that they are the same shape carrying the same
   mark — which the screenshots bear out, and which is the point. Recorded
   because "the strips align" is the kind of claim that sounds like a
   requirement and would have sent someone restructuring the page to satisfy a
   sentence.

**Type, in one move.** Every *section label* becomes Archivo 600 uppercase and
tracked; mono stays where the two-voices rule puts it — ids, versions, counts,
anything the machine owns. The header's facts strip is rebuilt as the panel's
`fact-k` / `fact-v` pair for the same reason: it is a stat strip, and the panel
already decided what a stat strip looks like.

## Not this

- **Not the command palette.** The campaign parked its skin deliberately
  ("recorded, not indexed"); this item does not un-park it.
- **Not the selection tray or the HUD.** Both already speak the language.
- **Not a responsive pass.** [workbench-panel-drawer.md](workbench-panel-drawer.md)
  remains declined, and nothing here creates a breakpoint.
- **Not a token change.** If a value looked wrong, that is item 1's business,
  not this item's.

## Verification

- `npm test`, `npm run check:scenarios`, `npm run build` — all green.
- `npm run update:primitives` then a clean `git diff -- scenarios/`: the
  campaign's standing claim is that chrome cannot move a golden, and this item
  re-earns it rather than citing it.
- Hands-on in headless Chrome, **both themes**: the queue home, a scenario page
  in `both` with the rail open and folded, and the coverage map — checking that
  the rail's pinned band does not scroll, that the two 2px rules framing the
  score read as one decision, and that the active rail row and the active panel
  tab are recognisably the same state in two shapes.

All done, plus 670/670 harness tests before the landing and 676/676 after (the
extra six are the other session's, and they pass against this item's tree —
which is the useful half of that number).

## Landing

Kept because this is the first landing to meet an occupied `main`, and the
lessons are about the contract rather than about chrome.

**The refusal is the feature.** `merge --ff-only` declined because three files
were dirty in the primary checkout. That is exactly what the rule is for: a
forced merge would have silently discarded another session's afternoon. The
stash → fast-forward → pop cycle is the whole remedy, and `git stash` keeps the
entry on a conflicting pop, so there is no window in which the work is only in
one place.

**Verify the restoration file-by-file, not by eye.** After the pop, diffing
every stashed path against its stashed blob showed exactly three differing —
the two conflicts plus `WorkbenchApp.ts`, which differs *legitimately* because
the working tree is now their version plus this item's. Grepping for a marker
from each side (`togglePanel` and `scenarioPage()` for theirs, `rail-context`
and `fact-k` for ours) is what turns "it seems fine" into a check.

**Three files vanished from the dirty set between the status check and the
stash**, all of them `src/edit/*` selection-ladder files, and a
`.claude/worktrees/selection-ladder-nav/` had appeared. A live session moved its
own work into its own worktree mid-landing. Nothing was lost and nothing needed
doing — but it is worth knowing that on this repo **the dirty set is not stable
across a five-minute test run**, so a landing plan built on a stale `git status`
is built on sand.

**A conflict resolution can only be judged by building the combined tree.**
Taking both sides left a comment containing backticks inside a `` css` ` ``
template literal, which terminated the literal and produced five parser errors
in a file that had compiled on both sides of the merge. The landed commit never
contained it — it existed only in the working tree — but it would have been the
next session's mystery. **Build after the pop, not only before the merge.**
