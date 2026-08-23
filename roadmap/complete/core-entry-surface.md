# The entry surface — typing anywhere the cursor can already go

Serves the **implementation loop**. Graduated out of
[core-campaign-element-ops.md](../complete/core-campaign-element-ops.md) on
2026-08-15 (it was the campaign's item 13c, and the last thing holding its index
open). The campaign owned *addressing*; this owns *writing*.

Sibling boundary: [core-tab-digit-resolution.md](../complete/core-tab-digit-resolution.md)
owns how raw tab digits become one resolved fret without moving the cursor.
This item owns **where** that fret and the notation action write — the cursor's
part, staff and voice plus the new-sequence policy. They are independent and
neither is a prerequisite for the other.

## The gap, exactly

The cursor addresses `part → measure → staff → voice → event → note` in full: it
carries `partIndex`, `staffIndex` and `voiceIndex`, the grid is built per part,
the sweep drives across all of them, and every removal verb follows the cursor
where it goes ([core-element-ops-part-addressing.md](../complete/core-element-ops-part-addressing.md),
[core-note-address.md](../complete/core-note-address.md),
[core-selection-ladder.md](../complete/core-selection-ladder.md)).

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

---

## What landed — 2026-08-23

**Status: complete.** Both gates the doc asked for are green, plus the one the
campaign was waiting on.

### The policy: a created voice arrives full

`addVoiceMeasure` is the verb, and it is the construct half of the
`removeVoiceMeasure` that already existed — the same rung ("this voice in this
bar"), the same guard on the way out. Typing never creates a voice as a side
effect: `entrySequence` creates voice 0 of any (part, staff) on demand as it
always did, and returns nothing for a voice beyond the first.

**The voice is padded to the meter with rests at birth**, and the three
consequences are the argument for it:

- Every position in the new voice is REAL, so the cursor addresses the whole
  bar at once and each keystroke converts a rest. Unpadded, beat 3 would be
  unreachable until beats 1 and 2 were typed, because the grid's entry ghost
  belongs to voice 0.
- **So there is no ghost voice to invent.** The doc expected the ladder's ghost
  vocabulary to have to grow a "position with no document behind it"; the
  padding policy means one never exists. That is the cheapest of the three
  options the doc laid out, and it was not obvious in advance.
- The bar is legal the instant it exists. An underfilled voice draws the
  duration-mismatch badge on every render, and a verb must not manufacture the
  diagnostic that tells you you made a mistake.

Rests nobody typed are the price; `Del` at the voice rung takes the whole voice
back while it is still rests-only, so the round trip closes.

The `new-voice` tray tile was already drawn, unavailable, `blockedBy:
'voice-entry'` — the last residue row in the registry. It is wired.

### Where writes land

`EntryTarget` (`{partIndex?, staffIndex?, voiceIndex?}`) rides on every writing
op, and **absent means the first of its kind**, so an op log written yesterday
still says the same thing. That is what made the corpus cost actually nil
rather than merely predicted.

Seven writing verbs turned out to be resolving to `parts[0]`, staff 1, voice 0
while their removal twins had taken an address since item 13b:

| verb | was | now |
|---|---|---|
| `insertNote` / `insertPitchNote` | voice 0, part 0 | the cursor's |
| `setDuration` / `nudgeRest` / `setRestSpelling` | voice 0, part 0 | the cursor's |
| `appendMeasure` | padded part 1's copy | pads the cursor's part |
| `setClef` | `parts[0]`, staff 1 | the cursor's part and staff |
| `setPartDeclaration` | `parts[0]` | the cursor's part |
| `setBeam` | staff 1, voice 0 | the run's own address |
| `setPositioned` | `parts[0]`, no staff | the cursor's part, writes `staff` |
| `setFret` | part 0's tuning | the owning part's fingerboard |
| `wrapInContainer` | padded voice 0 | pads the sequence it addressed |

Two of those were latent wrong-answer bugs rather than missing reach:
`setFret` sounded a fret against part 0's strings for a note in part 2, and
`tieTarget` looked in part 0 staff 1 for the next bar's same voice.

### The finding that unblocked everything

`coincidentSlots` fell back to the whole line when the cursor's voice had
nothing on it. Standing in voice 2 over its rest therefore resolved to voice
1's note — so `Delete` removed music from a voice you were not in, the duration
keys re-valued it, and (the way it surfaced) the pending entry duration would
not step, because a rest looked like ink. **An empty line in your voice is
empty.** Scoping it strictly broke no test; the fallback was load-bearing for
nothing, and multi-voice entry was impossible until it went.

### Evidence

- **`spec/multiple-voices` traces green** — the acceptance test named above,
  and both voices of both bars reproduce the golden exactly.
- **`lab/score-text/directions-multi-staff` traces green** — two staves,
  per-staff clefs, per-staff directions, built from `{}`. This is the scenario
  the element-ops campaign explicitly parked here ("its music lives on a second
  staff, which is exactly what core-entry-surface.md owns").
- **THE BAR closed: 37/38 → 38/38 kinds.** `staves` was the campaign's last
  uncovered kind and its only report exemption. `awaitingEntrySurface`,
  `needsEntrySurface` and the two tests that guarded the exemption are deleted
  — the assertion is now plain, with nothing subtracted from it.
- `git diff -- scenarios/` clean after `update:primitives`. **No golden moved,
  so there is no verification debt and no ledger entry.**

### `spec/tie-targets` is still unbuildable — and not by this item

The doc named it as the second half of the acceptance pair. Its second voice
now enters fine; the scenario is blocked entirely on the **tie vocabulary**:

1. a tie cannot name a target in another voice — `toggleTie` finds the same
   pitch in the same voice's next event, and `crossVoice` is a re-TYPE of a tie
   that must already exist, so the tie is never created to re-type;
2. a note cannot carry more than one tie (`ev33n1` holds an `arpeggio` and a
   `crossJump`), because `setTieVariant` writes `ties[0]`;
3. `side` cannot be authored on a tie at all (`setSlur` has it; ties do not).

Three gaps of one kind — "what can a tie say" — which is a different question
from "where does a write land". Left named rather than filed, per the roadmap's
own rule about proposals nobody asked for.

### Not done, still not in scope

Cross-staff beaming and voice re-assignment, as declared. One more, learned on
the way: **`spec/grand-staff` can never trace green** — its own staff-1 bar 2
sums to 7/8, and §8.11 padding fills any bar entry touches. A spec example that
underfills is unreachable by construction, which is a fact about the corpus
rather than a gap in the ops.
