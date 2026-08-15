# The selection command tray — the residue

> **Status: proposed 2026-08-14; a living ledger, not a work item. Revised
> 2026-08-15** after the campaign's vocabulary sweep — items 5, 7–13 of
> [core-campaign-element-ops.md](../inprogress/core-campaign-element-ops.md) all
> built on 2026-08-14/15, so the ledger's **first retirement wave predates the
> tray itself** (recorded below). Third of the trio behind
> [core-selection-tray-visuals.md](../complete/core-selection-tray-visuals.md) and
> [core-selection-tray-mechanism.md](../inprogress/core-selection-tray-mechanism.md):
> everything the design draws or implies that **cannot be hooked up yet**, each
> row naming what unblocks it and where that work is tracked. Nothing in this
> doc is new work — every unblocker has an owner; the doc exists so the tray's
> greyed tiles are a *ledger with addresses* instead of a vague IOU.
>
> **Retirement rule** (mirroring the campaign index): a row leaves when its
> unblocker lands and the tile goes live — the closing change deletes the row
> and notes it in the campaign's learnings log. When the table is empty the doc
> moves to `complete/`. The mechanism's registry carries each row's id in its
> `blockedBy` field, so the table and the greyed tiles cannot drift apart
> silently.

## Retired 2026-08-15 — the vocabulary wave

Drafted 2026-08-14 against a 15-op vocabulary, the original "verbs ahead of the
op vocabulary" table listed thirteen rows. One day later most were dead, their
verbs landed by the campaign sweep ("every kind now has its verb" — corpus
removability 1,434/1,460, `no-op` down to seven notes). Retired, with their
unblockers: articulations, dynamics **including hairpins**, and directions →
[item 8](../inprogress/core-element-ops-adornments.md) (Shift+A); slurs and tie
variants → [item 10](../inprogress/core-element-ops-spanners.md) (`S`,
polymorphic slur/slide by projection); tab technique →
[item 9](../inprogress/core-element-ops-technique.md) (the `B H S V X O`
letters, tab pane); barlines, repeats, endings/voltas, segno/coda/jump/fine,
sections, rehearsal marks, tempo →
[item 7](../inprogress/core-element-ops-bar-attributes.md) (ten kinds behind
Shift+B); key change and clef →
[item 5](../inprogress/core-element-ops-clef-key.md) (Shift+K / Shift+C, plus
time-signature removal); lyrics →
[item 12](../inprogress/core-element-ops-lyrics.md) (Shift+L — the text *mode*
was rejected as unnecessary); full-measure rests and beams →
[item 11](../inprogress/core-element-ops-rhythm-declarations.md) (`B`,
polymorphic beam/bend); part name/strings/capo/staffKind/staves →
[item 13](../inprogress/core-element-ops-part-declarations.md) (the Shift+P
grammar). These now sit in the mechanism's wired tables instead.

## Retired 2026-08-15 — the restyle

Two rows from the geometry-and-surface table, retired the day
[core-campaign-modernist.md](../inprogress/core-campaign-modernist.md) opened.

**"the workbench restyle the tray's art direction leads"** — retired **by adoption, and
now by delivery**. The row read *"its own future proposal, raised only if the tray's look
wins the review."* The look won, the campaign is that proposal, and its **item 4 landed
2026-08-15**: the tray's 55 colour literals became token references, so it consumes the
system instead of restating it. The recorded contrast between the tray and the chrome
around it is gone — though not the way anyone expected. The chrome moved to meet the
tray, so by the time the literals were swapped there was **nothing left to reconcile**:
the change was pure de-duplication, measured at a 1.04% pixel delta confined to three
deliberate decisions (see the campaign's learnings log).

One correction to the row's own assumption, worth keeping: it presumed the tray would
end up *including* `designTokens`. It does not, and must not. Tokens reach a workbench
leaf by **inheritance** from `<mnx-workbench>`'s host, while the dark half is selected by
a `resolved-theme` attribute on that host — so re-declaring the block inside the tray
would plant a light-only `:host` between the app and the component and pin it light
forever, making the theme switch visibly skip it. A conformance assertion now holds
that line in both directions (no literals, no local `designTokens`).

**"the tray on a dark page"** — retired **by unblocking**. The row named two possible
unblockers, *"the restyle proposal, or a dark pass on the spec — whichever comes first"*;
the restyle came first, and it chose to author the dark half rather than cut it
([core-modernist-dark.md](core-modernist-dark.md)). Note the road not taken, since the row
permitted it: had dark been cut, this row would have retired **by decision** under the
"what this doc is not" rule below, converting into the recorded choice that the workbench
is light-only. It was kept instead, on the grounds that a restyle should not quietly
remove a capability on its way past — the dark half was authored and never wired, which
is a bug in the wiring rather than evidence nobody wanted it.

Worth recording for the ledger's own sake: **both rows were written when the tray
shipped, each naming its unblocker, and both were still accurate a day later.** This is
the first time an address in this table was actually used, which is the whole claim the
doc makes for itself.

## Retired 2026-08-15 — the second wave, one day later still

Two more rows went the same way before the tray's own review, which is the
retirement rule working as designed rather than a coincidence worth
celebrating: **respell** → [item 6](../inprogress/core-element-ops-clef-key.md)'s
sibling (`respellNote`, `J` — and note the tile became ONE cycling command,
not the flat/sharp pair this ledger imagined, because "the other spelling"
has no single answer); **duration dots, capo write, time `display`** → item 4
(`.` cycles 0 → 1 → 2 → none), with capo already writable since item 13 and
`common`/`cut` carried by the time popover's grammar. Both are wired tiles
now.

## Still greyed: the vocabulary tail

| Tray surface | Rung(s) | Blocked by | Unblocked when |
|---|---|---|---|
| grace note, tuplet, tremolo (construction) | event | the **wrap verbs** are the open half of [item 11b](../inprogress/core-element-ops-onset-granularity.md); note the removal half is now `refused` **by design** for inked containers (unwrapping re-times the music) — a verb that declines, not a missing verb | item 11b's wrap verbs + rest spelling |
| voice / staff entry beyond the first | voice / part | *addressing* landed with [item 13b](../inprogress/core-element-ops-part-addressing.md) (cursor `partIndex`/`staffIndex`, Alt+V cycles slots) — the **entry surface** (creating a second voice or staff-2 ink) is the open half; "the ladder can visit voices it cannot create" | item 13b's entry stages |
| layout / score authoring (system breaks, layouts) | score | removal landed (presentation layer); construction needs a surface that can express a **tree** — the popover grammar cannot, and the palette was ruled out because it cannot see the document. The tray *can* see the document (it is fed from the session), so it is a candidate surface — recorded, not claimed | its own proposal, per the campaign's "beyond" list |
| transpose (part row: instrument transposition) | part | not a campaign item | the campaign's "beyond" list — needs its own proposal |
| mute (part row) | part | no audio surface at all (no player element — [core-viewer-embedded-app.md](core-viewer-embedded-app.md) records why); until then the row renders value-less | audio's own decision |
| percussion kit authoring | note | kit removal + grid slots landed with the tail; construction stays beyond the campaign | the campaign's "beyond" list |

## Selection-model gaps: the ladder's half

Unchanged by the sweep — and reinforced by it: the campaign's closing finding is
that the seven remaining `no-op` notes are **navigation failures that belong to
the ladder's per-level pass**, not vocabulary.

| Tray behavior | Blocked by | Unblocked when |
|---|---|---|
| **mixed tile state** (some members carry the mark; click = apply-to-all) | selection is `{level}` + cursor — no range, so "some but not all" is inexpressible | the ladder's `{level, anchor, extent}` state |
| **Shift+←→ / Shift+End extension**, **Ctrl+A closure** reachable from the tray | `extend`/`closure` intents do not exist (the strokes are free — reserved by the ladder doc) | the ladder's horizontal-axis pass |
| **container tab** (tuplet ratio, grace slash, tremolo marks at their true rung) | the cursor now *descends into* containers (item 11b), but `container` is still not a `SelectionLevel` | the container rung, riding the wrap verbs |
| meta line counts for multi-member selections ("4 events · …") | single-position selection | `{level, anchor, extent}` again |
| **part rows as the closure's surface** (the design's PART tab is really Ctrl+A at part-measure) | the row *values* are wireable since item 13; what is missing is the closure as the way to **reach** them | ladder closure + [core-score-hud.md](../inprogress/core-score-hud.md) stage 4 |
| clicking a note to move the selection under the tray | `note-selected` still has no consumer — the mouse cannot place the cursor | a click→cursor intent path through the funnel; the ladder's mouse-parity story |

## Geometry and surface gaps

| Tray behavior | Blocked by | Unblocked when |
|---|---|---|
| shaft geometry for selections **wider than the tray** (multi-bar, cross-part) | the design's own open question — no rule drawn | decided at the mechanism's hands-on review once wide selections exist (needs `extent` first) |
| dashed on-score preview of a **wider** scope than the enclosure can show today (e.g. score frame previewed from a note) | preview rides `SelectionContext.preview` + `drawEnclosure`'s dashed variant — mechanism stage 3 | lands with the mechanism; listed here only until then |
| score-rung `↑↓` escalating to the host (`score-navigate`) | the event is specified in the ladder's navigation map but not built | the ladder's score-level pass |
| the tray in the **embed / studio** | `elements/` promotion is parked — trigger 2 (a real editing consumer) belongs to studio | [core-editor-element-promotion.md](core-editor-element-promotion.md); scope-only promotion is the recorded interim option |

## What this doc is not

- **Not a backlog.** Rows have owners elsewhere; this table adds no obligations,
  only addresses. If a row's unblocker is cut, the row converts into the design
  decision to drop the tile — recorded, either way.
- **Not the campaign index.** The campaign orders its items by scenarios unlocked;
  this table is keyed by what a user sees greyed in the tray. Same work, two
  scoreboards — and after the sweep, the smaller one.
