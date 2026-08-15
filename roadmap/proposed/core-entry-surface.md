# The entry surface — typing anywhere the cursor can already go

Serves the **implementation loop**. Graduated out of
[core-campaign-element-ops.md](../complete/core-campaign-element-ops.md) on
2026-08-15 (it was the campaign's item 13c, and the last thing holding its index
open). The campaign owned *addressing*; this owns *writing*.

## The gap, exactly

The cursor addresses `part → measure → staff → voice → event → note` in full: it
carries `partIndex`, `staffIndex` and `voiceIndex`, the grid is built per part,
the sweep drives across all of them, and every removal verb follows the cursor
where it goes ([core-element-ops-part-addressing.md](../complete/core-element-ops-part-addressing.md),
[core-note-address.md](../inprogress/core-note-address.md),
[core-selection-ladder.md](../inprogress/core-selection-ladder.md)).

**Entry writes to voice 0 of `parts[0]`, staff 1.** `insertNote`,
`insertPitchNote`, `appendMeasure`, `padMeasureRests` and their neighbours all
resolve through `entrySequence`, which takes the first staff-1 sequence of the
first part. So the ladder can *visit* a voice it cannot *create*, and the
asymmetry is now the only one left in the vocabulary.

That asymmetry was deliberate and is recorded in three commits: removal needs
identity, and entry needs a policy. This item is the policy.

## The question that makes it a design item

**What does typing into a second voice mean when the bar is already full?**

Every other verb had a "the document says so" answer available. Entry does not:

- Voice 1 does not exist in this bar yet — does typing create the sequence, and
  with what padding? An empty voice is not the same as a voice of rests, and the
  full-bar invariant (§8.11) was written for one voice per staff.
- The bar's other voice already fills the meter. Entry that pads the new voice
  writes rests nobody asked for; entry that does not leaves a voice that
  underfills and the diagnostic says so on every render.
- Rests are absence, so an empty voice draws nothing — which makes "I am in
  voice 2 of a bar that has no voice 2" a cursor position with no ink and no
  document behind it. The ladder's ghost vocabulary is the natural home for it,
  and that is a selection question as much as an entry one.

A second, smaller one: **which part does `appendMeasure` extend?** Bars are
global; a part's measure array is not. Appending on part 2 today extends part 1.

## Scope

- `entrySequence` and every writing op take the cursor's part, staff and voice.
- The creation policy above, decided once and applied everywhere.
- `appendMeasure` and the structural ops follow the cursor's part.
- The **corpus cost is nil**: no note key changes (the key grammar already
  spells part and staff, silent for 0 and 1), so no golden moves. This is the
  rare item that is pure behaviour.

## Not in scope

Cross-staff beaming and voice *re-assignment* (moving existing music between
voices) — both are edits to music that exists, and this item is about writing
music that does not.

## Evidence when it lands

A construct trace for a multi-voice scenario, which is the one thing the
campaign's trace queue cannot cover today: `spec/multiple-voices` and
`spec/tie-targets` both put ink in a second voice, and both are reachable by
cursor and unbuildable by keyboard. That pair is the acceptance test.
