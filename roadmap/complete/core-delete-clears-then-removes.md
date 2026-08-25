# Delete clears, then removes — the guarded rungs get their second press

> **Status: complete, 2026-08-25. Proposed, built and closed the same day.**
> Serves the **implementation loop**. Grew
> out of hands-on testing: select a bar, press `Del`, and nothing happens —
> no removal, no refusal, no message. The verb exists and the guard is
> correct; what is missing is the *first* press. The `event` rung has had the
> answer since [core-campaign-element-ops.md](core-campaign-element-ops.md)
> — clear the ink, then remove the empty thing — and this item carries that
> rule up the rest of the ladder.

## The gap, exactly

Every rung has a delete. From `container` outward every one of them is
**guarded**: the structure goes only once it holds no ink.

| rung | op | guard | what a full selection does today |
|---|---|---|---|
| note | `deleteNote` / `removeKitNote` | none | deletes the ink |
| event | `clearEvent` → `removeEvent` | **two presses** | clears to a rest, then removes |
| container | `removeContainer` | `eventHasInk` on children | **nothing** |
| voiceMeasure | `removeVoiceMeasure` | `content.some(itemHasInk)` | **nothing** |
| partMeasure | `removePartMeasure` | same, per staff | **nothing** |
| measure | `removeMeasure` | `measureHasInk` | **nothing** |
| section | `removeMeasureAttribute` | none | removes the label, bars stay |
| document | `removePart` | `partHasInk` | **nothing** |

Five rungs answer a keystroke with silence. The guard is not the bug — the
rule it enforces is right, and it is argued out at
[core-campaign-element-ops.md](core-campaign-element-ops.md)
(2026-08-14): *cascades never delete notes*. The bug is that the guard is a
**dead end** rather than a **branch**, so the ladder stops one rung above the
bottom and the user is told nothing.

## The rule

> **Press 1 clears what the rung itself owns. Press 2 removes the rung.**

That is not a new rule. It is what `event` already does, stated so that it
covers the whole ladder.

| rung | the rung owns | press 1 | press 2 |
|---|---|---|---|
| note | itself | delete the note | — the rung is ink; there is no structure under it |
| event | its notes | clear to a rest (time survives) | `removeEvent` |
| container | its children's ink | clear children to rests | `removeContainer` (pads the sequence back) |
| voiceMeasure | its events' ink | clear to a bar of rests | `removeVoiceMeasure` |
| partMeasure | every voice on the staff | clear them all to rests | `removePartMeasure` |
| measure | every part's copy of the bar | clear the column to rests | `removeMeasure` |
| section | **its label** | remove the label — see below | — collapses into press 1 |
| document | all ink in the score | clear every event to rests | `removePart`, then trailing bars |

**Clearing preserves time.** `clearEvent` leaves a rest of the same duration,
so no press ever reshapes a bar or under-fills a voice. This is the rule
`addVoiceMeasure` already follows in the other direction — a created voice
arrives *full* of rests precisely so it is legal the instant it exists
([ops.ts](../../src/edit/ops.ts) — "a verb must never manufacture the
diagnostic that says you made a mistake"). Delete owes the same courtesy on
the way out.

### Why the two presses need no hidden state

The press counter **is the document**. Press 1 visibly removes the ink, so
press 2 is evaluated against a genuinely different document by the *same
guards that exist today*. Nothing remembers "you already pressed Del once",
there is no mode to fall out of, and an interleaved edit, undo or navigation
cannot desynchronise a counter that was never kept.

This also means the guards in [ops.ts](../../src/edit/ops.ts) **stay exactly
where they are**. The branch is taken one level up, in the session; the ops
keep refusing an inky removal as defence in depth, and nothing about their
contract changes.

### What the invariant becomes

The anti-cheat rule is not abandoned, it is restated:

- **was** — a wide command may never destroy ink.
- **is** — a wide command may never destroy ink **and** structure in one press.

What it was protecting is untouched: you never lose notes you were not shown
losing. `Cut` remains the deliberate one-press ink-destroyer, and it pays a
clipboard for the privilege.

### The footprint rule

> The second press may remove **only what the selection's own footprint
> covers.**

This is what keeps the rule honest at the middle rungs, and it is the reason
`voiceMeasure` and `partMeasure` **keep** their removal rather than stopping
at "cleared". Both ops are already footprint-exact:
[`removeVoiceMeasure`](../../src/edit/ops.ts) splices one sequence out of one
measure and never touches that voice in any other bar;
[`removePartMeasure`](../../src/edit/ops.ts) empties one staff's copy of one
bar and never removes the part. Neither has ever deleted a voice or a part
wholesale, and `removeVoiceMeasure` is the declared destruct partner of
`addVoiceMeasure` — take it away and creating a second voice by accident
becomes a one-way door.

The same rule is what (correctly) forbids removing a whole part when a single
part-measure is selected, which is the case worth guarding.

It also settles the measure rung with no extra condition: the measure rung's
selection is already the whole bar column across every part — the same
footprint `Cut` uses via `removeSelectionMeasureColumns` — so removing it
after clearing is inside the footprint by definition, however many parts
exist.

## Section: the exception that isn't

Section looks like it needs special handling and turns out to need less than
any other rung.

A section **owns exactly one thing: its label.** It does not own its bars —
[`sectionMembers`](../../src/edit/selection.ts) *derives* the span by walking
boundary to boundary, so the bars are borrowed from the measure rung. And the
presence rule is literally `if (sectionRangeAt(doc, cursor.measureIndex))
present.add('section')`: the rung exists *because* the label does.

So removing the label is simultaneously "clear what this rung owns" and "this
rung ceases to exist" — the two presses collapse into one, because there is no
structure left over to remove. The rung then vanishes, the cursor is standing
on a range of bars, and pressing `Del` again continues down the ladder:

**`Del`** removes the label and drops to the bar range → **`Del`** clears the
ink in those bars → **`Del`** removes the bars.

Nothing is lost: "delete the boundary, keep the music" is still one keystroke,
exactly as today. It just stops being the *only* thing the section rung can
do.

### The re-anchor, and the one dangerous default

[`applyDestructive`](../../src/edit/session.ts) re-anchors with
[`relaxLevel`](../../src/edit/selection.ts), which walks **up** only. Section
sits directly below `document` in `SELECTION_LADDER`, so a vanished section
re-anchors to **`document`** — and the next `Del` means *clear every note in
the score*. That is the single genuinely dangerous outcome in this design and
it arrives by default if the re-anchor is left alone.

The fix is to **descend, carrying the range**: `level: 'measure'`, anchor at
`member.start`, extent at `member.end - 1`. `tightenLevel` already exists, and
the measure rung takes multi-bar ranges natively —
[`resolveSelection`](../../src/edit/selection.ts) clips an ordered universe by
two endpoint cursors and `measureMembers(doc)` is the whole bar list, so a
range is just two cursors. **The footprint does not move; only the rung name
changes.**

Descending is right *here* and relaxing stays right everywhere else, for a
reason worth writing down: every other rung's disappearance means its
container is now the correct address — the last note goes, and the event is
what you were actually pointing at. Section is the only rung that is a *label
on a borrowed range* rather than a container of music, so when it dies the
music survives and the correct address is the same span, one rung down.

The transition is visible: the tray renders the ladder as a tablist with an
active rung ([SelectionTray.ts](../../src/workbench/SelectionTray.ts)), so the
highlight moves Section → Measure under the keystroke.

## Delete and Cut, after this

Every rung ends up with the two verbs sharing a footprint, which is the tidy
outcome and a good check on the design:

| | Delete | Cut |
|---|---|---|
| footprint | the selection | the selection |
| ink | cleared on press 1 | taken |
| structure | removed on press 2 | taken |
| clipboard | no | yes |
| presses | two | one |

Delete is "make it go away, and show me each step"; Cut is "take it away and
keep it". The second press is the confirmation Cut does not ask for because
its clipboard is the undo.

## Feedback

The silent refusal that started this item mostly dissolves — after the change
almost nothing refuses. What replaces it is better than either silence or a
refusal: press 1 should say what it did and what the next press means, e.g.

> cleared 12 notes — `Del` again to remove the bar

[ScenarioPage.ts](../../src/workbench/ScenarioPage.ts) currently discards
`handled === false` for every intent except `relaxSelection`; the clipboard
already has a feedback channel ([clipboardFeedback.ts](../../src/edit/clipboardFeedback.ts))
and this should use the same one rather than invent a second.

## Work list

- **[session.ts](../../src/edit/session.ts)** — the bulk of it. The `delete`
  branch turns each guard into a fork: rung holds ink → emit clear ops; rung
  empty → emit the existing removal op.
- **A shared "events under these members" helper.** The clear path needs
  every `EventAddress` beneath the resolved selection.
  `selectedEventAddresses()` covers only `note`/`event` members;
  `visitEvents` in
  [selectionStructuralEdit.ts](../../src/edit/selectionStructuralEdit.ts) is
  private and walks a document, not a selection. One helper, used by the
  branch test (`does this rung hold ink?`) and the clear itself.
- **[applyDestructive](../../src/edit/session.ts)** — the descend-on-section
  re-anchor above.
- **[ops.ts](../../src/edit/ops.ts)** — ideally untouched. The guards stay as
  the safety net.
- **[commandRegistry.ts](../../src/edit/commandRegistry.ts)** and
  **[keymapDocs.ts](../../src/edit/keymapDocs.ts)** — every
  `(only when empty)` label and per-rung string is rewritten to the two-press
  meaning.
- **Feedback line** through the existing channel.

## Risks

- **[destructWalk.ts](../../src/edit/destructWalk.ts) is the one to watch.**
  Phase 1 deletes all ink element-by-element and phase 2 tears down
  scaffolding, so it normally reaches phase 2 already ink-free and should
  behave identically. But phase 2 breaks its loop on
  `JSON.stringify(session.doc) === before`; if any ink survives phase 1 as
  `unaddressed`, the measure-rung `Del` will now *clear* it instead of
  refusing, so the walk keeps going rather than stopping. That is arguably an
  improvement, but it changes the walk from "scaffolding only" to "also mops
  up", and the `{}` round-trip sweep is what will say so.
- **Document-rung press 1 clears the whole score.** Consistent, undoable, and
  reachable only by deliberately climbing to the top rung. Left consistent
  rather than special-cased, but it is the press most likely to want a second
  look in testing.
- No golden movement is expected — this is editor behaviour, not layout. The
  edit-ops conformance suite is where the change should show.

## Built — 2026-08-25

Landed as proposed, with the section descent exactly as argued. What the build
taught, beyond the design:

- **`ops.ts` was never touched.** The prediction held: turning each guard from
  a dead end into a fork is a change in `session.ts` alone, and every op still
  refuses an inky removal underneath it. The safety net and the branch are now
  two different things in two different places, which is why the branch could
  be rewritten without re-arguing any of the removal rules.
- **`destructWalk.ts` needed no change at all** — the flagged risk did not
  fire. Phase 1 still strips every element before phase 2 climbs, so phase 2
  arrives ink-free and its guard-driven loop behaves exactly as before. The
  `{}` round-trip sweep passed untouched, which is the assertion that would
  have caught it.
- **Five tests encoded the dead end, and all five got better.** They asserted
  `delete → false` at the guarded rungs; they now walk the whole two-press
  ladder and assert what each press did. `counts container children as ink
  when guarding bar removal` became `reaches container children when the bar
  rung clears its ink` — the same fact, one rung further along.
- **The staff ordinal was the one real trap.** `EventAddress.voiceIndex`
  counts sequences ON A STAFF, not raw array position, so the walk has to
  filter by staff before it counts. A grand staff whose second staff carries
  two voices is the shape that catches it, and it is now a test
  (`selection-events.test.ts`).
- **The event rung changed slightly and deliberately.** A mixed range — some
  events inky, some already rests — used to clear and remove in the same
  press, one decision per member. It now clears on press 1 and removes on
  press 2 like every other rung. Strictly safer, and the rule is uniform.
- **The score rung's press 1 clears the whole score**, so the old "remove this
  one empty part" behaviour now costs a press to reach. That is consistent
  with the rung's painted footprint, and the user-facing way to delete a part
  was never this rung anyway — it is the part closure at `partMeasure`
  (Ctrl+A), which `Cut` already treats as `clip.kind: 'part'`. **Del at a
  part closure still only empties the bars rather than removing the part** —
  a pre-existing gap this item did not touch, and the obvious next question.

### Files

`src/edit/selectionEvents.ts` (new — the member→event walk and the ink test),
`src/edit/session.ts` (the fork, `deleteSectionLabels`, `DeleteOutcome`),
`src/edit/clipboardFeedback.ts` (the sentences), `src/workbench/ScenarioPage.ts`
(three lines of wiring), `src/edit/commandRegistry.ts` + `src/edit/keymapDocs.ts`
(labels), `harness/conformance/selection-events.test.ts` (new),
`harness/conformance/selection.test.ts` + `clipboard-feedback.test.ts`.

No golden moved and none could: nothing under `src/model/` or `src/engine/`
changed, so the corpus carries no verification debt out of this item.
