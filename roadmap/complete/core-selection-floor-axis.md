# The selection floor — the gesture's axis picks the rung

Serves the **implementation loop**. Proposed 2026-08-20, and **decided** — the
open questions here are sequencing, not direction. It came out of hands-on
review of the [selection clipboard](../complete/core-selection-clipboard.md):
the typed clipboard made a previously invisible distinction load-bearing, and
the distinction did not survive contact with a user.

> **Status: built 2026-08-20, the same day.** All four rules landed in
> `session.ts` as new resolutions of the ordinary intents (extendSelection
> re-levels before extending, End in the same press; closeSelection closes
> at the event rung; event ↑/↓ descends to the nearest notehead, ties
> breaking in the pressed direction), so traces replay unchanged and one
> committed fixture regenerated exactly along the semantic change. The
> build surfaced one consequence the proposal had not named: **the spanner
> selected-run form rode the ranges to the event rung** — `toggleSlur`/
> `toggleBeam` now read an event range of >1 resolved members (a chord
> event point has two note keys but is one member, and must arm the anchor
> gesture rather than slur itself), the tray's slur/beam tiles widened to
> both rungs, and the S/B cheatsheet rows gained their event meanings.
> `selection-floor-axis.test.ts` pins the invariant (a note selection is
> always exactly one notehead), the one-event first press, descent and its
> rest-event refusal, and replay determinism; the ladder, navigation and
> command-registry suites were re-pinned to the new semantics.

## The finding

A note-rung *range* looks exactly like an event range and is not one. Starting
from one notehead, Shift+→ sweeps horizontally and takes **all** existing note
ink at each covered position — whole chords — so its footprint is pixel-
identical to the event range over the same span. What differs is invisible:
the note range carries no durations and silently skips rests. Nothing on the
score says which rung the highlight means; the first time the difference
becomes material is a paste refusal ("Source and destination note selections
must have equal counts") that reads as arbitrary because the user was never
shown the model it enforces.

Pressed for the note range's value, the honest audit finds almost none:

- **Bulk note-owned edits** (transpose, fingering, technique) act identically
  on an event range — those operations ignore rests anyway.
- **Cut of a full-chord note range** produces the same document as cut of the
  event range (emptied events become equal-duration rests either way).
- **Rhythm-preserving repitch** — the one operation only a note range enables —
  is packaged elsewhere as an explicit mode or paste-special (Dorico's Lock
  Durations, MuseScore's Re-pitch), never as a selection type the user must
  have been standing on at copy time. An event clip already carries the
  pitches *and* the chord structure, so "paste pitches only" over an event
  clip is strictly better-informed than a note-set paste.
- **Chord-member selectivity across a passage** ("the top note of each chord",
  "every note on string 3 through these bars") would be real, distinct value —
  and is exactly what the current range does NOT do, since it flattens to
  whole chords. That feature, if ever wanted, is a different proposal.

No mainstream editor (MuseScore, Dorico, Finale, Guitar Pro) has "a range of
noteheads" as a selection type; their ranges are always passages. The user's
mental model is trained before they arrive.

## The principle

**Below the event rung there is no temporal extent.** The note rung addresses
ink at a single instant — one notehead, vertically navigable through the
chord's members, the staff's positions, the fingerboard's strings. The event
rung is where time-extent begins. At the floor of the ladder the gesture's
axis therefore picks the rung:

- **horizontal gestures are questions about time** — time is event-natured;
- **vertical gestures are questions about pitch/string** — that is
  note-natured.

From the event rung upward the ladder stays exactly as decided in
[core-selection-ladder.md](../complete/core-selection-ladder.md): Esc relaxes,
Enter tightens, rung changes are explicit. The blur is confined to the floor,
where the two rungs are visually indistinguishable and mode-tracking is
precisely what users fail to do.

The resulting invariant is one sentence, and it is the whole point:

> **A note selection is always exactly one notehead.**

## The rules

Four corollaries. The first press of a promoting gesture performs the
re-leveling only — one note becomes one *event*, never two — so the highlight
visibly grows from notehead to chord at the moment the semantics change,
which is the self-teaching this replaces a refusal dialog with.

| Gesture | Today | Under this proposal |
|---|---|---|
| Shift+←/→ at note | extends a notehead range | re-levels to an event **point** (the note's own event); subsequent presses extend the event range |
| Shift+End at note | extends noteheads to the voice's last note | re-levels to event, extends to the voice's last event |
| Ctrl/⌘+A at note | closure over every existing notehead | the **event closure** (every event in this staff/voice timeline) |
| ↑/↓ at event | the voice above/below at this instant | descends to the nearest notehead in the pressed direction; subsequent presses walk lines |

Ctrl/⌘+A must move with Shift+←/→ or the multi-notehead selection this
proposal eliminates survives behind a different key.

Rests get *more* coherent: Shift+→ from a rest re-levels to the rest's event
(a rest IS an event), where today's note range silently skips it.

## The displaced voice jump — the one real cost

Bare ↑/↓ at the event rung currently means "the voice above/below at this
instant". Rule 4 takes that key. The voice remains reachable — descend to
note (↓), then Ctrl+↑/↓ (the climb's voice jump at note), or Alt+V for
coincident notes — but multi-voice navigation at the event rung becomes two
keys where it was one. **Decided: accepted.** Voices are a layer thought
about occasionally; chord members are ink touched constantly; the constant
case gets the bare key. If hands-on time proves the voice jump is missed,
the candidate remedy is Ctrl+↑/↓ at event meaning voice (not staff) — a
keymapDocs data change, not a re-litigation of this principle.

## What it touches

- **`src/edit/session.ts`** — `extendSelection` at note re-levels first;
  `closeSelection` at note produces the event closure; `lineUp`/`lineDown`
  at event tightens to the nearest notehead. All three are session-level, so
  traces record the same intents with new resolutions — replay stays
  deterministic because the resolution is deterministic in the document.
- **`src/edit/keymapDocs.ts`** — the Shift+←/→, Shift+End, Ctrl/⌘+A and ↑/↓
  rows change their note/event meanings; the guard-mirror tests in
  `keymap-docs.test.ts` change with them (this is a
  [cheatsheet stage-4](../complete/core-keymap-cheatsheet.md) landing).
- **The clipboard** — the UI can now only produce single-note `note-set`
  clips. The clip format **keeps** `notes[]`: the extraction/paste planners
  are pure and tested, single-note repitch (point onto point) remains real
  value, and the multi-note seam is where a future chord-member/string-
  selective selection would land if it ever earns its own proposal. The
  Ctrl/⌘+X cheatsheet row's note meaning simplifies to the single notehead.
- **[core-paste-lands.md](../complete/core-paste-lands.md)** consumes this: with note
  ranges gone, its note-set cases collapse to single-notehead rules, which
  is what keeps that proposal's case matrix tractable.

## Explicitly rejected: deleting the note rung structurally

The ontologically pure version — remove `'note'` from `SelectionLevel` and
make the notehead a member-index refinement inside an event selection — was
considered and declined. The note *point* is load-bearing across the system
(fret entry, per-note adornments, delete-note vs clear-event, the tab string
model, traces); restructuring `SelectionState` buys no user-visible change
over the axis rule. Purity that rewrites the substrate for identical
behavior is the kind the ladder effort has consistently declined.

## Evidence when it lands

- A session test pinning the invariant: at note level, `resolveSelection`
  returns exactly one member, from every gesture path that used to widen.
- Shift+→ at note yields an event point first, an event range second;
  Shift+End and Ctrl/⌘+A yield event range/closure; all three recorded in
  traces as their ordinary intents.
- ↑/↓ at event tightens to note and walks lines; the keymap-docs guard
  mirrors assert the new meaning table matches the session's behavior.
- The clipboard actions still round-trip a single-note copy/paste (repitch
  point-to-point), and `selection-clip.test.ts` keeps the multi-note codec
  coverage — format stability is deliberate.
- `npm run update:primitives` stays byte-clean: selection semantics touch no
  layout.
