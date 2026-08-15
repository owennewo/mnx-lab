# Campaign: Modernist — the workbench restyle the tray's art direction leads

> **Status: COMPLETE 2026-08-15.** The index is exhausted: items 1–7 and 9
> built, row 8 (the `<360px` drawer) drafted and **formally declined** — the
> design is complete, the need is not — and kept as a *possible* so the analysis
> is not redone rather than cut outright.
>
> One visual system now runs from the rail to the score: one palette, one accent,
> one face, both themes, and the selection tray no longer sits apart from the
> chrome it led. What the campaign did NOT do is as recorded as what it did — the
> compare tab's computed DIFFERENCES list was refused as a second verdict channel
> competing with `status: verified`, op grouping was refused for breaking
> time-travel's row↔position identity, and two design cells (EDITED, KEY-as-a-name)
> were refused because the corpus does not hold the fact they asked for.
> A campaign (see CLAUDE.md → Conventions): this doc
> is an index over several normal proposals, the shared contract they follow, and the
> running log of progress and learnings as items land. Indexed items are ordinary
> `core-*` / `workbench-*` proposals that name this campaign; rows without a link are
> undrafted.
>
> **This doc fills a slot that was reserved for it.**
> [core-selection-tray-visuals.md](../complete/core-selection-tray-visuals.md) shipped the tray in
> the design's art direction verbatim and recorded why: *"The tray is the leading edge
> of a possible workbench-wide restyle in this direction — that restyle is its own
> future proposal, not smuggled in here. Until it lands the tray will sit visibly apart
> from the surrounding chrome; that contrast is accepted, recorded, and reviewable."*
> [core-selection-tray-residue.md](../proposed/core-selection-tray-residue.md)'s last row names the same
> thing: *"the workbench restyle the tray's art direction leads — its own future
> proposal, raised only if the tray's look wins the review."* The look won.

## The goal

One visual system across the workbench, and a right-hand side panel worth the space it
takes.

Two things arrive together because they arrived together in the design. The Claude
Design project that specified the tray has now specified the **score panel** — the
scenario page's right-hand side — *"in the tray's own language"*. So the campaign has a
look half (the tokens, the type, the dark pass) and a structure half (the panel's five
bands, seven tabs cut to five, the per-tab rebuilds). They are separable in delivery and
inseparable in intent: the panel's structure only reads correctly in the restyled
vocabulary, and the restyle has no showcase without the panel.

**Design provenance.** A Claude Design project, *"Notation selection modes and command
palette"* — `Score Panel.dc.html` ("SPEC · v1"), alongside the `Selection Palette` files
that specified the tray, over the shared `modernist` design-system bundle. As with the
tray, **none of these files exist in this repo**; they are read through the design MCP
and their rulings are transcribed here. The system's own summary: *flat, architectural,
set entirely in Archivo: a near-mono red on white, a visible modular grid, zero corner
radius and strong 2px rules. Nothing floats and nothing is decorated — alignment and the
strength of the dividers do all the organising.*

### Why a campaign and not one proposal

Three properties, per the convention. A **shared contract** every item must obey before
it writes code (below) — without it, six items would each invent their own read of
"Modernist" and the result would be a third dialect rather than one system. An **index**
spanning items that land over weeks, several of which block on the first. And a
**learnings log** later items genuinely need: the tray's de-hexing is the first real
test of whether the token vocabulary can express the design, and the panel work should
inherit whatever that teaches rather than rediscover it.

## The decisions, taken up front

Four questions were settled before drafting, because each changes the shape of every
item:

| Question | Decision | Consequence |
|---|---|---|
| Scope | **Workbench-wide token flip.** Retune `designTokens`; the tray then *drops* its hard-coded hexes and consumes tokens again. | Ends the dialect split. Rejected: panel-only self-contained styles, which would have left three surfaces apart from the chrome and added a *fourth* row to the residue ledger instead of retiring one. |
| Accent | **Red everywhere** — one accent across chrome, score enclosure and status pips. | Forces the five-state pip ramp to be re-derived (item 6) and puts selection-red on the same canvas as the engine's frozen error-red (see the tripwire below). |
| Dark | **Re-cut with a dark pass, and wire it.** | Modernist is light-only, so the dark half must be *authored*, not converted. Retires the residue's dark row **by unblocking** rather than by decision. |
| Type | **Bundle Archivo through `@fontsource`**, the way IBM Plex already arrives. | Changes the appearance of an already-reviewed shipped surface (the tray), so it carries its own review gate. |

## The shared contract

**No item writes code before its agreement block is written down.** Each indexed
proposal opens with, and is reviewed on:

1. **Tokens over literals.** Every colour, rule width, radius and font comes from
   `src/elements/tokens.ts`. No component re-declares the palette — the tray's
   self-contained styles were a deliberate, recorded exception whose whole purpose was
   to be temporary, and item 4 ends it. New semantic names are added to the token sheet
   and justified there, never inlined at the use site.
2. **Zero radius via `--radius-*`, every rule via `--rule-w`.** The design's "do not
   round a corner anywhere" is a *token* decision, not 35 separate edits. Item 1
   tokenizes the existing radius scale as a values-unchanged refactor first, precisely
   so the flip that follows is a one-file diff a human can actually review.
3. **The embeddable surface keeps its contract.** `scoreTokens` and `viewerTokens` carry
   the public `--mnx-*` overrides and the viewer's live `light-dark()` half. A stranger's
   page embedding `<mnx-score-viewer>` did not opt into Modernist. No item may change a
   public override's name or remove one; the workbench-tier accent wins inside the
   workbench without rewriting what the embed ships.
4. **`src/engine/render/svg.ts` is untouchable.** See the tripwire below. An item that
   believes it needs to touch the emitter has found a different proposal.
5. **Selection-red and error-red stay separable, by value and by form.** Checked at the
   hands-on review, never assumed.
6. **Goldens byte-identical, asserted per item** — `npm run update:primitives` then a
   clean `git diff -- scenarios/`. This is the standing repo rule; it is restated here
   because a restyle is exactly the kind of change that *feels* like it cannot touch the
   corpus, and one line of the emitter means that feeling is not quite true.

## Two verified tripwires

**1. A dangling font token is baked into 68 goldens.**
[src/engine/render/svg.ts:12](../../src/engine/render/svg.ts) reads
`const FONT_FAMILY_BODY = 'var(--font-family-sans)'` — and **no such token exists**; the
real one is `--sans`. The reference has always resolved to nothing, and that literal
string is emitted into every text element, so it sits in **68 committed `expected.svg`
files**. Tidying it during a font pass would demote 68 approvals in one commit.

Hence contract rule 4. Fixing the dangling variable is legitimate and probably wanted —
as **its own proposal**, with a deliberate corpus re-approval and the demotion expected
rather than discovered. Not here.

**2. Red is already a reserved semantic in the engine, and it is frozen.**
[src/engine/layout/diagnostics.ts:29-32](../../src/engine/layout/diagnostics.ts) hard-codes the
diagnostic palette — `validation: '#b91c1c'` (red), `warning: '#1d4ed8'` (blue),
`render: '#b45309'` (amber) — and these are emitted as `fill` attributes into the SVG,
so `#b91c1c` is baked into **10 committed goldens**. It cannot move.

Under "red everywhere" the score canvas therefore carries **red-as-selection and
red-as-error at once**, and only the accent side is movable. This does not reverse the
decision — the forms already differ (a diagnostic badge is a filled circle with a white
glyph; the enclosure is a stroked rect and a tinted notehead), and the accent can be
tuned in lightness and chroma away from `#b91c1c`. But "red means error" is the one
place this app already used colour to carry meaning, and the restyle is spending that
colour. Item 1 owns the separation and item 6 owns the queue's half of it.

## The index

Item 1 is the contract; almost everything blocks on it. Items 5–7 are parallel once the
frame exists.

| # | Item | Scope | Blocks on | Status |
|---|------|-------|-----------|--------|
| 1 | [core-modernist-tokens.md](../complete/core-modernist-tokens.md) | **The contract.** Radius tokenization as a values-unchanged no-op refactor, then the OKLCH re-cut, `--rule-w`, the unified red accent, the shared row-state primitives in `sharedChrome`, and the selection-red / error-red separation rule. | — | **built 2026-08-15** |
| 2 | [core-modernist-dark.md](../complete/core-modernist-dark.md) | Authoring Modernist-dark in OKLCH and finally **wiring** `resolved-theme`, which appears once in the codebase and is set by nothing. Split out because it is a design task with an upstream dependency, not a token conversion. | 1 | **built 2026-08-15** |
| 3 | [core-modernist-type.md](../complete/core-modernist-type.md) | Archivo via `@fontsource`, `--serif` retired, the mono voice decided. Carries the tray's re-review, because bundling the font changes a surface that was reviewed in the fallback. | 1 | **built 2026-08-15** |
| 4 | revision on [core-selection-tray-visuals.md](../complete/core-selection-tray-visuals.md) | The tray drops its 55 hard-coded literals for token references — but **keeps inheriting** the palette rather than declaring `designTokens` locally (an early draft said otherwise; a local block would pin the tray light when the theme switches). A revision block on the complete doc, not a new one: same component, same art direction, and that doc already carries the deviations section this closes. | 1, 3 | **built 2026-08-15** |
| 5 | [workbench-score-panel.md](../complete/workbench-score-panel.md) | The score panel: five-band frame, seven tabs cut to five, the width change, and the per-tab rebuilds. The campaign's structure half and its showcase. **Built** except the two halves that belong to other items — the JSON gutter and selection scoping (item 7) and compare's live render/overlay. | 1 | **built 2026-08-15** |
| 6 | [workbench-queue-pips.md](../complete/workbench-queue-pips.md) | Re-deriving the five-state queue ramp under one accent — the bill "red everywhere" runs up. Shape and lightness carry what hue no longer can. | 1 | **built 2026-08-15** |
| 7 | [core-json-view.md](../complete/core-json-view.md) | `buildJsonView()` gains `spanByPointer`; the dormant module finally gets a consumer, a conformance test, and the pinned-error highlight the panel consolidation lost. The only below-the-boundary code change in the campaign. | — (5 for the UI half) | **built 2026-08-15** |
| 8 | [workbench-panel-drawer.md](../proposed/workbench-panel-drawer.md) | The `<360px` drawer. **Drafted and NOT RECOMMENDED** — the design is ready, the need is not: the squeeze only bites below ~1100px, where Ctrl+B already reclaims 270px and the drag handle reaches the 360 floor. Kept as a *possible* so the analysis is not redone. Two findings outlive it: any future overlay gets Escape free at slot 2 (it needs to own its keydown, not a keymap change), and a dismissing click must be swallowed — decide that before `note-selected` gets a consumer, not after. | 5 | **possible — not recommended** |
| 9 | [core-zoom-density-pad.md](../complete/core-zoom-density-pad.md) | The crosshair zoom/density pad over the score's top right — the same design project's `Zoom Control.dc.html`. Also closes the UI half of [core-render-density-zoom.md](../complete/core-render-density-zoom.md): **↑↓ staff** wires `zoom` to `pxPerSp` at last, **←→ spacing** gives the shipped `densityH` a control. The campaign's first item that lands ink **on the score canvas** rather than in the chrome, so contract rule 5 is tested rather than restated. | 1, 3 | **built 2026-08-15** |

Beyond the campaign (recorded, not indexed): whether `<mnx-command-palette>` adopts the
skin — the tray doc already parked this; the emitter's dangling `--font-family-sans` and
its 68-golden re-approval; and any restyle of the embed face, which is deliberately out
of scope by contract rule 3.

## What the design gets right, and the two things it doesn't

Recorded once here so items don't relitigate it.

**Right, and cheaply.** The five-band frame is the mock's best idea and nearly free:
`.panel` is already a flex column with a single scrolling `.panel-body`. The shared row
states are *already implemented* — `ol.ops li.current` (2px accent left border) and
`li.future{opacity:.45}` are literally the design's "current" and "superseded". The HUD
ladder, the "+N more" cap, the status classification and the op time-travel all exist.
Much of this campaign is renaming what the codebase already does into a vocabulary it
can share.

**Right, and clarifying.** The mock's *"the tray edits, the HUD explains"* is a
restatement of `core-score-hud.md`'s content-vs-presentation boundary in better words,
and its "PART rung" turns out to be the HUD's existing part row (see item 5 — the
apparent conflict is terminological).

**Rejected: the compare tab's DIFFERENCES list and its "1 DIFFERENCE" chip.** No
difference data exists, and manufacturing it would contradict the repo's constitutional
rule that *verification is a human assertion with provenance*, written only by
`harness/verify/verify-scenarios.mjs`. A panel that computes a difference count creates a
**second, unowned verdict channel** competing with `status: verified` and the attention
queue — the one thing the corpus machinery is built to prevent. If a differences list is
ever wanted, its honest source is a human-authored note (`loadNotes` exists and is also
currently unconsumed), not a diff engine.

**Rejected for v1: grouping consecutive same-op edits** (the mock's own open question —
three transposes collapsing to "transpose −3", expandable). `jumpToOp(n)` is positional
and traces replay per-op; grouping breaks the row↔position identity that time-travel
depends on. Revisit if a session's queue ever gets long enough to hurt.

## Progress + learnings

*(Appended as items land, per the convention — later items start smarter than earlier
ones.)*

- **2026-08-15 — item 9 lands: the pad, and the first ink this campaign put on the
  score canvas.** Two axes wired to the engine (`zoom` → `pxPerSp` at last, numeric
  `density-h`), a 24×24 idle mark, the 76×100 pad on hover, and the clamp finally
  visible. Verified over CDP in both themes; goldens byte-identical.
  - **The design asked for a feature the architecture had already deleted.** The mock
    specified a floor "recomputed each layout pass — the tightest ratio at which no two
    glyphs overlap". Density scales springs and never rigid columns, so no value can
    make ink collide; the floor is a legibility constant that already existed. **Third
    time in this campaign the design has asked for something the codebase cannot
    honestly provide** (after the KEY name and the EDITED timestamp), and the third time
    the answer was to ship the fact we do have — here, making the *silent* clamp
    visible, which is a real gain the mock never asked for. The ratio the campaign's
    opening entry predicted is holding almost exactly.
  - **A test that passes is not evidence, and mutation-checking cost me two rewrites.**
    The first collision assertion read `voice[i].coreSp` — a property that **does not
    exist** on `EventSlot`. It was `undefined`, every comparison was `NaN`-false, and
    the test passed vacuously. It survived because **`tsconfig.json` includes only
    `src`, so no harness test is ever typechecked** and vitest transpiles without
    checking. Worth generalising: a harness assertion that reads a field off an engine
    type is unverified by anything but your own eyes — typecheck the file by hand
    (`tsc --noEmit --allowImportingTsExtensions …`) before believing a green run.
    **Then measured rather than left as a warning**: typechecking all 25 harness suites
    turns up **5 errors and zero of the `TS2339` "property does not exist" class** — the
    one that makes an assertion vacuous. So the hazard is real in kind and the harness is
    currently clean of it; this bug was the only instance. Recorded so a later item can
    weigh a `tsconfig` include against a gap that has produced exactly one defect.
  - **Then the rewritten test still would not fail under mutation, and that was the
    real finding.** Deliberately scaling the rigid core moved the tightest gap only
    1.745sp → 1.540sp — still clear of `CORE_SP` — because **the justifier is a second,
    independent guard**: when rigid width shrinks, `voiceStretch` grows and hands it
    straight back to the springs. So the no-collision guarantee is over-determined and
    no plan-level assertion can isolate springs-only as its cause. The ruling got
    *stronger* and its evidence got *narrower*, and the doc now says so. **Measure the
    mechanism before claiming it**; "the test passes and my explanation is plausible" is
    two claims, not one.
  - **The pad found a shipped bug by having to drive all three views.** `layoutTab`
    called `planHorizontal(mnx, widthSp)` with no options, so the standalone tab view
    ignored `density=` from the day the axis shipped — invisible while the only consumer
    was a three-button demo on a notation score. **A control that must work everywhere
    audits its own engine**; the preset UI never had to.
  - **`--accent-on-ink` flips the opposite way to `--accent-fg`, and that is not a
    mistake.** `--ink` is dark in light theme and *light* in dark theme, so a band filled
    with it needs a *lighter* accent in light theme and a *darker* one in dark. Every
    other accent token lightens with the theme. Any future token named "X on ink" should
    expect the same inversion rather than copying `--accent-fg`'s ramp.
  - **Contract rule 5 was finally tested rather than restated.** This is the first item
    to put accent-red on the same canvas as the engine's frozen `#b91c1c`, and it passes
    on a third form again — type and a filled arrow inside a bordered card, against a
    filled disc (diagnostic) and a stroked rect (enclosure). The rule's reliance on form
    over hue, recorded at item 1, is now carrying three shapes rather than two.
- **2026-08-15 — item 7 lands: the JSON view gets a consumer, a test, and its promise
  back.** `spanByPointer` on `buildJsonView`; the pane gets a gutter of real document
  line numbers, three inks, a selection scope and a find box; the pinned-error highlight
  works again. With this the campaign's drafted items are all built.
  - **Mutation testing killed two drafts of the test, and the second failure was the
    instructive one.** Round-tripping `noteLineByKey` against `noteKeyByLine` proves
    only that they are mutual inverses — a property that survives every key in them
    being WRONG. Breaking jsonView's staff-1 filter (which shifts every voice index, and
    so every synthesized key) sailed through. The fix was to join against
    `noteWalk.noteKeysOf`, the canonical enumeration `note-keys.test.ts` already binds
    the renderer to. **When a test checks two things against each other, ask what they
    are both allowed to be wrong about.**
  - **Then the same mutation passed again — because the fixtures never reached the
    code.** Neither sample document had a non-staff-1 sequence, so deleting the filter
    was a no-op on that data; only three scenarios in the whole corpus exercise the
    branch. Adding `spec/grand-staff` is what made the assertion bite. A test can be
    correct in its logic and blind in its inputs, and mutation testing is what tells the
    two apart.
  - **The dead primitive is adopted.** `.row-state` / `.row-current` / `.row-past` went
    into `sharedChrome` with item 1 as the campaign's declared shared vocabulary, and
    then item 5 built the panel with its own row styling instead — leaving a contract
    clause nothing obeyed. The ops list now uses the primitives (verified by computed
    style, not by eye: transparent reserved edge, accent edge plus tint on the head,
    0.45 on the redo branch). **A shared primitive nobody adopts is just dead code with
    a good reputation.**
- **2026-08-15 — item 6 lands: the queue pays the accent's bill, and most of the ramp
  turned out to be dead.** One accent on `blocked`; the other three states carry their
  own near-neutral lightness ramp plus the shape encoding the rail already had. The
  campaign's colour work is done.
  - **Half the thing being re-encoded did not exist.** The doc said the status ramp
    "appears anywhere a scenario is listed" through `.pip[data-st]` in `sharedChrome`.
    `.pip` was rendered by nothing — dead, along with `.gapdia` and `.vchip`, and
    between them they were the only consumers of two of the five status tokens. The live
    palette was three tokens, and one (`--st-gap`) had drifted into being the generic
    "something needs you" colour across five unrelated surfaces. **Read the use sites
    before re-encoding a vocabulary**; the doc described the token sheet, not the app.
  - **Grayscale stopped being a review ritual and became an assertion.** The doc named
    it as the acceptance test, which in practice means somebody remembering to squint.
    It is now a conformance test that resolves each state through its token chain to an
    `oklch()` lightness and fails if neighbouring states close to within 0.12 in either
    theme. It caught a real collision on the first run — see below — and it is the kind
    of rule that otherwise decays over a few well-meaning commits.
  - **Aliasing the ink ramp was elegant and wrong.** Pointing the quiet states at
    `--ink`/`--ink-2`/`--line-strong` reads beautifully and put `unseen` within 0.08 of
    the accent in dark, because that ramp is spaced for TEXT contrast, not for four 7px
    marks. The states carry their own values now. **A shared scale is not automatically
    the right scale** — check what it was spaced for.
  - **The corpus could not verify its own queue.** With 99 `current` and 7 `never-seen`
    and nothing blocked or stale, the rail shows two of the four states, so the visual
    check had to be a synthetic swatch rendering all five marks in both themes and
    desaturated. Worth remembering for any state-encoding work here: the attention queue
    being nearly empty is the healthy case and the untestable one.
- **2026-08-15 — item 2 lands: dark is authored, wired, and the mechanism turned out
  to be wrong.** `auto | light | dark`, persisted, resolved against
  `prefers-color-scheme` (verified in both directions by emulating the media query),
  offered in the palette with no new keystroke. The residue's last row retires.
  - **An attribute-selected theme block is a trap in a shadow-DOM app, and it had
    already sprung.** The dark half was `:host([resolved-theme='dark'])` — but every
    workbench component includes `designTokens` and therefore declares the LIGHT
    palette on *its own* host, where that attribute never appears. A closer host beats
    an inherited value, so the first dark screenshot showed a dark header and rail
    around a fully light panel, HUD and palette. `viewerTokens` never had the bug
    because it uses `light-dark()`, which resolves against the *used* `color-scheme`
    — an inherited property that crosses shadow boundaries. `designTokens` is now the
    same mechanism, and the attribute survives only as the switch that *sets*
    `color-scheme`. **Generalisable: in a shadow-DOM app, theme by inherited
    computed value, never by an attribute on one host.**
  - **The stronger test found real drift the weaker one could not.** Comparing only
    the LIGHT halves of the two token blocks passed while their dark halves had
    diverged completely — the viewer's was still the old warm-slate palette at hue
    75–85 against the app's Modernist hue 60. Once both blocks used `light-dark()`,
    comparing *both* halves caught it immediately, along with two accent tokens I had
    aligned in one block and forgotten in the other. An invariant asserted on half the
    data is an invariant you do not have.
  - **Dark improves the campaign's worst tradeoff.** "Red everywhere" put selection-red
    next to the engine's frozen error red at only 4° of hue. In dark the accent
    lightens to L≈0.70 while `#b91c1c` cannot move from L≈0.505, so the separation
    nearly doubles to ΔL 0.195 and the badge becomes the *darker* mark against a
    lighter outline. The riskiest decision in the campaign is safest in its newest
    theme.
  - **Item 4's completeness test passed with nothing to do.** The tray went fully dark
    on the first try, which is the assertion the doc set up: it proves the de-hexing
    left no literals behind. A test that costs nothing to run because an earlier item
    was done properly.
  - **A doc rule lost to a code decision, correctly.** The item's own rule 3 said "the
    score card stays paper, do not invert the staff", written from first principles.
    `scoreTokens` had already decided the opposite on 2026-08-14, from real experience
    — *"a dark page with a blazing white score is the thing the embed app made
    obvious."* The code won. Check the token sheet before legislating about it.
- **2026-08-15 — item 5 lands: the panel gets a frame and loses two tabs.**
  Seven tabs become five, every tab is the same five bands, the widths move to
  360/420/560, and the `actions` tab retires. Verified hands-on over CDP with the panel
  driven through all five tabs, a real two-op edit queue, and a keyboard-opened popover.
  - **The panel was hiding a lie, and the stat strip exposed it.** The design's KEY cell
    was first implemented as a key *name* — and rendered "G major" for
    `twelve-bar-blues`, whose own description says E minor. MNX's `key` object carries
    **`fifths` and nothing else**; there is no mode, so one sharp is both, and naming
    either one invents information the document does not contain. The cell now prints the
    **signature** (`1♯`), which is what the file actually says. The same instinct killed
    the mock's EDITED cell earlier (no backend, no mtime — it shows APPROVED from real
    provenance instead). **Twice now the design has asked for a fact the corpus does not
    have**; the answer both times was to print the fact it does have, not to derive a
    plausible one.
  - **Retiring a tab is mostly about where things RENDER, not what invokes them.** The
    hard part of dropping `actions` was that `openPopover()` force-switched the panel to
    it, so a keyboard-opened popover yanked the panel away from whatever you were
    reading. Rehoming the popover to a page-level overlay over the score fixed a real
    annoyance that had nothing to do with the restyle — and only then was the tab
    deletable. The palette gap closed the same way: it hard-coded four of the nine
    popovers, so both now map over one exported table instead of two hand-kept lists.
  - **`tsc` was the whole safety net for the cut, and it was enough.** Narrowing
    `PanelTab` from seven members to five turned every stale branch into a compile
    error. No test could have covered this — `workbench/` is a leaf nothing may import —
    and promoting a UI table into `elements/` purely to test it would have been the
    wrong trade. Worth remembering the next time a leaf feels untestable: the type
    system is the coverage.
  - **One deferral, recorded rather than fudged.** The JSON tab gets its frame, a copy
    button and an honest line count, but not the gutter, the three inks or the
    selection-scoped slice — those all read `buildJsonView` and belong to item 7. The
    footer says so on screen rather than leaving a half-built control implying more.
- **2026-08-15 — item 4 lands: the tray stops restating the system.** All 55 colour
  literals in `SelectionTray.ts` become token references, plus its font. Two genuinely
  new shared roles were added to the sheet rather than fudged — `--accent-pressed` (the
  design's own "one step past base" instruction) and `--ink-faint` (a step between
  `--ink-3` and `--line-strong`). Verified by **pixel diff** of the tray open, before and
  after: 1.04% of pixels changed, confined exactly to the tray's bounding box, max
  channel delta 15/255, and every transition accounted for.
  - **"No visual change" was not quite true, and the diff is how we know.** Three
    deliberate decisions moved pixels: `#f5f3f1 → --bg-context` (disabled fill),
    `#e6e3e0 → --line` (one of *three* near-identical hairline greys collapsed into
    one), and `#fce7e3 → --row-current` (derived, not pinned). Everything else was text
    antialiasing fringing following those grounds. **Collapsing three hairlines into one
    token is the point of the sweep, not a cost** — and it moves toward the design,
    which says not to soften rules. But the honest claim is "a measured, accounted-for
    2.4% shift", not "no change". Later items should diff rather than assert.
  - **The derived tint cannot hit the designer's hex, and shouldn't chase it.**
    `--row-current` is `color-mix(accent, bg 90%)`; the design's `#fce7e3` was
    hand-picked with a warmer bias than mixing toward a neutral `--bg` can reach. Ratios
    84–96% were computed and 90% is the optimum at delta 6/255. Derivation is worth more
    than the last 6 — it means a future accent carries its own tint instead of leaving a
    stale pink behind.
  - **A leaf must inherit its palette, never re-declare it.** The plan said the tray
    would "add `designTokens`". That would have been a bug: custom properties already
    reach it by inheritance, and the dark half is chosen by an attribute on the *app*
    host, so a local `designTokens` block would pin the tray light and the theme switch
    would skip it. **Generalisable to every remaining item**: only a component that must
    stand alone off-app (the viewer, the embed) declares tokens on its own host.
- **2026-08-15 — item 3 lands: Archivo bundled, the serif retired, and the tray finally
  gets the face it always asked for.** `@fontsource/archivo` latin-{400,500,600} (3
  files, 43KB), `--serif` deleted at seven sites, `--mono` retuned to a deliberate system
  stack, and all three IBM Plex packages dropped — `dist` now carries zero IBM Plex.
  Tray re-reviewed over CDP with the tray actually open: **it survives the face swap
  unchanged** — seven rung tabs still fit one row, the 8.5px corner chips stay legible,
  the readout bar holds, and the recorded 9px/400px deviations need no retuning.
  - **Item 3 belongs BEFORE item 4, and the doc had it backwards.** The tray hard-codes
    `Archivo, system-ui` in eight places, so de-hexing to `var(--sans)` first — while
    `--sans` still said IBM Plex — would have moved its face twice, the first move *away*
    from the design. Landing the font first makes item 4's substitution a genuine no-op.
    **Generalisable**: when a component ships ahead of its system by hard-coding the
    system's values, fix the TOKEN to match the component before pointing the component
    at the token. Otherwise the component takes a detour through whatever the token
    currently says.
  - **The campaign's thesis is visible for the first time.** The tray still carries its
    own literal hexes — item 4 has not run — yet it now reads as part of the app rather
    than a visitor, because the chrome moved to meet it. The contrast the visuals doc
    accepted and recorded is already gone; item 4 is now about deleting duplication, not
    about appearance.
  - **`document.fonts.check()` is not evidence a font loaded.** It returned `true` for
    `"IBM Plex Sans"` after every IBM Plex package had been removed — the API answers
    "can this text be rendered", and a fallback counts. The honest checks are the build
    output (zero IBM Plex woff2 in `dist`) and the visible metrics change.
- **2026-08-15 — item 1 stages 2–4 land: the palette flips, and the goldens don't move.**
  `designTokens` and `viewerTokens` re-cut to Modernist in OKLCH, radius to `0`,
  `--rule-w` defined, the shared row-state primitives added to `sharedChrome`, the
  anti-flash ground brought back into step (and now pinned by a test — it is invisible
  to every other check and would have flashed the *old* palette on every load).
  Verified hands-on in headless Chrome: queue home, `twelve-bar-blues` in `both`, and
  two diagnostic-carrying scenarios.
  - **The central claim held: chrome cannot move a golden.** A full palette flip —
    accent, ground, ink ramp, paper — left all 101 `expected.*` byte-identical. The
    layout path is pure functions over SMuFL metrics and the emitter's only style
    output is the frozen font constant, exactly as argued. **Later items can move fast
    on colour**; the gate is cheap and it is the licence for that speed.
  - **"Red everywhere" spent hue as a redundant channel, and that is a real cost.**
    Checked on `lab/tab-derivation/fret-mismatch`, which puts a selection and a
    validation badge on one stave. They *are* tellable apart — but on **form first**
    (a filled disc with a white glyph against a thin stroked rect with a pale wash)
    and value second (the frozen `#b91c1c` is ~0.11 darker than the accent). Hue no
    longer separates them at all; before the flip, the blue enclosure differed from the
    red badge on hue *and* form. The contract's "separable by value and by form" rule
    passes, but it now rests on form alone, so **no later item may weaken the
    stroked-vs-filled distinction** — that is now load-bearing, not stylistic. Item 6
    inherits the same lesson its grayscale test already encodes.
  - **The accent had to reach the score through the composed block, not an override.**
    `viewerTokens`' light half is documented as identical to `designTokens`' because
    the viewer declares its own host inside the app, and a closer host wins. Flipping
    only the app would have left the score card warm-slate inside a Modernist shell.
    Both halves move together or neither does.
  - **Two of the mock's claims are now visibly true in the running app**: seven tabs
    genuinely do wrap to two rows at the current width (item 5's width bump and tab cut
    are one change, not two), and the blue/green queue dots beside a red accent really
    do read as leftovers rather than as signal (item 6 is not optional polish).
- **2026-08-15 — item 1 stage 1 lands: the corner scale, as a true no-op.**
  39 `border-radius` literals across 8 files become 9 semantic tokens in a new
  `radiusTokens` block. Values unchanged; goldens byte-identical; the diff is
  radius-only in all seven components. Ships with
  `harness/conformance/design-tokens.test.ts` (5 assertions), mutation-checked in both
  directions rather than trusted because it passed.
  - **Not every round corner is a corner.** The sweep stopped at
    `border-radius: 50%` on `.pip` / `.vchip .vdot` and the `1px` on `.gapdia`. Those
    are **shapes carrying meaning** — CLAUDE.md's rail rule varies dot *shape* as well
    as colour precisely so *stale* cannot read as *never seen* — and flattening them
    would have deleted an accessibility affordance under cover of a style sweep. The
    design system independently agrees: its own stylesheet keeps circular radio dots
    while every radius token is `0`. **"Zero radius everywhere" governs corners, not
    marks** — item 6 depends on this distinction holding, since the queue's re-encoding
    leans on shape.
  - **The harness may not import `src/elements/`, and the reason is layering.**
    `harness-not-into-shells` is `severity: error` and covers `elements/` alongside the
    shells, so the planned "just import `tokens.ts` and read `.cssText`" failed
    `check:boundaries` — a rule about architecture, not about whether the import would
    resolve. The token sheet is parsed from source text instead, with `${…}`
    compositions expanded. Cost: nothing, since components already had to be read as
    text. **Later items should assume the token sheet is only ever reachable as text
    from a test.**
  - **Both token blocks needed the scale, not one.** `sharedChrome` and `scrollbars`
    cite radius and are included by the *standalone viewer* as well as the app, so
    declaring the scale only on the app host would have restyled the embed alone —
    the same failure mode `tokens.ts` already records from the pre-`viewerTokens` era.
    Composing one block into both is what the conformance test now pins.
- **2026-08-15 — the campaign opens; two residue rows retire.**
  [core-selection-tray-residue.md](../proposed/core-selection-tray-residue.md) loses both rows this campaign
  was reserved by: *"the workbench restyle the tray's art direction leads"* retires **by
  adoption** (this doc is the proposal that row held a slot for), and *"the tray on a
  dark page"* retires **by unblocking** (item 2 authors the dark half it was waiting
  on). Recorded here per the ledger's retirement rule.
  - **The ledger worked.** Both rows were written when the tray shipped, each naming its
    unblocker, and both were still accurate a day later — the restyle proposal arrived
    exactly where the row said it would. Worth noting because the residue doc's whole
    claim is that a greyed tile should be *"a ledger with addresses instead of a vague
    IOU"*, and this is the first time an address was actually used.
  - **The design mock was read against the code before it was believed.** Two of its
    moves turned out to be already built, one apparent conflict turned out to be
    vocabulary, and one feature turned out to violate a constitutional rule. A spec-grade
    mock is evidence about *intent*, not about fit; the fit has to be checked. Later
    items should assume the same ratio.
