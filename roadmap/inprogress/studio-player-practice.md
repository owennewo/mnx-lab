# Practice mode — loop it, slow it, count it in

> **Status: built 2026-10-22, awaiting the owner's hands-on check.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 13. Proposed 2026-09-08; designed
> and decided in conversation on 2026-10-22 on the *Loop practice design* canvas
> (https://claude.ai/artifact/LoDr6D44xfHoPakWYEVZiV). Built in `elements/` and `audio/`, so
> the workbench has it too; the `studio-` prefix records who it serves.

## The owner's directions (2026-10-22)

- Not an implicit loop on Play: *"I don't want to reverse rule 4 so something like B + C"* —
  the loop is its own state, set from the selection (B) or on the rail (C);
  [core-single-cursor](core-single-cursor.md) rule 4 (*Play collapses a selection*) stands.
- *"start off simpler by looping prefers whole bars. If you click on the loop button in the
  tray then either the current selection is promoted to the loop or if the selection is single
  event then the selection expands to the whole of the current bar."* Built with one change,
  agreed in the same conversation: the **loop** takes the bar, the **selection** is left as it
  is — the loop has its own mark and outlives the selection.
- *"Do you think the loop selection can have drag handles"* → handles on the rail; the score
  shows the loop and is not dragged (a written bar there has several passes; the rail's lanes
  do not).
- *"The loop earns its place in the tray."*
- *"Can we have another option for then called "advance" - this causes the current loop range
  (start and end) to move forward 1 bar."* — *"The speed should drop each advance. at end of
  the piece we should stop not shrink."*
- *"in the options i'd prefer to avoid the word "pass" due to its conatations with bar passes.
  Maybe use "repeat" instead"* — the options say *repeat*; *pass* stays where it means a pass
  through a repeated section (the rail's lanes, "Loop · pass 2").
- *"in the tray maybe the drag markers can be made considerably larger (twice as wide, twice
  as tall)"* — a 20px grip on a 6px stem, 88px tall, rising above the tray; caught 48 × 96.
- After the first hands-on look (2026-10-22): *"I think a pause and play should jump cursor to
  start of loop maintaining the same repeat number"*; the handles' stems *"should 1) be thinner
  and 2 reach down to touch the bottom of the pad/bar it refers to"*; *"the horizontal line
  between the start/end verticals should be lower it is obscuring some of the section text"*;
  *"the loop colours should match, its blue in the score but red in the play tray"*; and the
  score's chip *"is a little high it is obscuring the bar above"*. All five built the same day:
  Play goes back to the loop's first bar on the repeat it had reached; a 2px stem ends at the foot
  of the lane it holds; the bracket runs between the section names and the lanes, and a looping
  rail keeps its rows at its foot rather than stretching them; the tray's loop is playback blue
  (the playhead's lane keeps the accent); the score's bracket is 2 sp over the system with a
  smaller chip that starts after the bar number.
- 2026-10-30: *"when loop mode is on and the user clicks into a bar outside the loop then loop
  should move i.e. start at the bar clicked."* Built for a press on the score or the rail,
  playing or paused: the loop keeps its length and is shorter only where the piece ends first.
- This item's start gate (campaign clause 7: reviewer items 1–10 verified first) was lifted by
  the owner's *"Can you implement this please"*.

## What was built

**A loop is whole performed bars**, first and last ordinal (`LoopBars`). The tray's **Loop**
field (between Rate and Mix): its body turns the loop on — taking the bar playing while the
music plays, otherwise the selection's bars as the editor reports them
(`CursorPlayback.range`), otherwise the bar the cursor or playhead is on — and off; its chevron
opens the options. The mapping from a written selection to performed bars is one rule: from
where Play would start (the selection's first bar on the anchor's pass) to the first playing of
its last bar after that. A selection across a repeat sign therefore loops what is played between
them, in performed order — the rail shows that order before Play.

**On the rail**: the loop's lanes tinted, a bracket over its written columns and a handle at
each end, dragged to a bar (the lane by height while over the cells, so a handle can move to
another pass) or moved with ←/→ when focused. **On the score** (`elements/loopMarker.ts`,
marker A): a wash behind its bars and a bracket over them that runs off a system's end and picks
up on the next, a chip at its start naming it (*Loop 2–5 · repeat 3 of 8*) and counting a
count-in (*Count-in ●●○○*). The marker is in playback's colour, not the accent: on the score
the accent is the selection. The tray's loop takes the same blue. Drawn from the rendered SVG after the engine is done, so no golden
moves.

**Behaviour**: a press on a bar outside the loop, on the score or the rail, moves the loop to
start at that bar (`loopMovedTo`), its repeats and trainer starting again; playing, the music goes
straight to the place pressed, with no count-in. Paused, the loop stays where the keys walk the
cursor and Play starts at its first bar — the bars Advance has reached, on the repeat it was on —
counting in again; playing, a key's seek out of the loop leaves it. In the run-out after a loop
(Carry on), Play carries on from the pause.

**The options** (`audio/practice.ts`, pure): count-in (off / 1 / 2 bars, when playback starts and
whenever the loop advances), repeats (∞ / 2 / 4 / 8), then (Stop — parked at the loop's start;
Carry on — on to the end of the piece; Advance — the loop moves on a bar, the trainer drops back
to its start, it counts in again, and it stops where it cannot move), gap between repeats (none
/ 1 bar of silence), speed trainer (start, step, every *n* repeats, up to). The click through
the loop moved to the mix on 2026-10-22 — a layer on every beat, wherever the time comes from
([studio-mix-layers.md](studio-mix-layers.md)). A rate chosen by hand switches the trainer off. Options are a per-browser preference
(`mnx-player-practice`); the loop itself is not persisted.

**How it plays**: the transport's loop became a run of **visits** (`LoopRegion.visits`), each
with its own bars, rate and lead (count-in or gap); a plain loop is the old seamless one. The
synth's host reads the same visits (`Transport.planned`), so notes, cursor and clicks share one
timeline; clicks go into the host's own audio context (`HostPort.click`), a lead ahead like its
notes. **A recording** loops the bars plainly by seeking; the options say the rest plays with
the synth.

## Proof

- `harness/conformance/practice.test.ts` — the takes (repeats, trainer, advance, carry on) and
  the transport on a fake clock: count-in, repeats then stop at the start, the gap, the
  trainer's rates, advance and its count-in, carry on to the end, a pause keeping the repeat, the
  seamless loop unchanged.
- `harness/conformance/host-backend.test.ts` — on the real synth core: count-in clicks a lead
  ahead with the accent on 1, the first note after them, repeat 2 at the trainer's next rate, a
  click on each beat.
- `harness/verify/loop-smoke.mjs` (`npm run smoke -- loop`) — the workbench in Chrome: selection
  → Loop field, the score's marker and chip, a count-in on the chip, a mouse drag of the end
  handle, Play after a pause going back to the loop's first bar on the same repeat, a press outside the
  loop moving it (score paused and playing, rail) and one inside not, a paused cursor keeping the
  loop, a seek out while playing leaving it, Clear.

## Left for later (not filed)

Event-level loop edges; score-side handles (the unrolled view is where they would be honest);
count-in and repeats for recordings; saved loops per piece in the library; the drag zoom for
long pieces on touch, where a bar is narrower than a finger.
