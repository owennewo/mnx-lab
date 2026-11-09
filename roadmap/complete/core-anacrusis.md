# Anacrusis: a pickup bar that reads, numbers and saves as one

> **Status: complete, 2026-11-09.** Serves the implementation loop, with a spec-loop
> note at the end. Raised by the owner while glowing up *Strolling Down the Highway*
> (library `4cc190c6b61e55f2`). Decisions 1 and 2 were taken as recommended; decision 3
> stays open (see *Record*).

## Why

*Strolling Down the Highway* opens with a one-beat pickup. Nothing in the lab knows a
pickup exists, so the piece fakes it:

- **Bar 1 is written in 1/4**, bar 2 changes to 4/4 and the final bar to 3/4, so the
  timing is right. A reader, though, sees three time signatures the music doesn't have.
  A printed copy would show 4/4 once, at the start.
- **The pickup is numbered 1**, where printed music numbers it 0 (or not at all) and
  calls the first full bar 1.
- **Guitar Pro has a pickup marker that we ignore.** It is a score-level
  **Anacrusis** setting, stored as `<Anacrusis/>` in the GPIF master track.
  `converters/` never reads or writes it.
- **MusicXML marks its pickups** `number="0" implicit="yes"`. Import drops that today,
  and the viewer then badges the deliberate pickup as an underfilled 4/4 bar
  ([chord-fidelity P1](../proposed/core-musicxml-chord-fidelity.md), fixture `21e`).

The owner's questions that set the direction (2026-11-09):

> I'm not sure if we (or mnx) supports pickup bar. in this case the 1st bar has been
> changed to 1/4 timing and not marked specifically as pickup.

> I don't understand how guitar pro would no how many beats the pickup bar would have
> if it isn't shortened like we did

> e.g. write might assume that a first bar numberered zero should be treated as an
> anacrusis and steal time signature of next bar??

**How Guitar Pro knows the length:** from the notes. An anacrusis bar keeps the
piece's signature (4/4), holds only the pickup notes, and is as long as its longest
voice. alphaTab, our differential oracle, does the same:
`MasterBar.calculateDuration` returns the longest voice of an anacrusis bar across every
track and staff, and the time signature only for other bars.

## How it works

**The stored bar keeps its real length; the 4/4 is "stolen" only at the edges.** This
is the owner's suggestion, and it works because it confines the knowledge of a pickup
to the few places that show or write a time signature.

1. **Model.** The first bar's time signature stays its true length (1/4). A pickup is
   **marked by `number: 0` on the first global measure**, which is published MNX
   (`measure-number`), so no extension is needed. A first bar counts as a pickup when it
   is numbered 0 **and** its signature is shorter than the one that follows. A
   numbered-0 first bar that is full length is only a numbering choice.
2. **Why not store 4/4 with one beat in it?** Because then "a bar's signature is its
   length" would stop being true. The performance compiler, swing, sync shape, editor
   fill and the underfill badge (`src/engine/layout/validate.ts`) would each have to learn
   "unless it's a pickup". Keeping the true length means none of them change. This piece
   already plays, swings and syncs its pickup correctly.
3. **Engraving.** At a pickup, the signature drawn is the next bar's (4/4), the next
   bar's own identical signature is not drawn, and the short one (1/4) is never drawn.
   **The complementary final bar** (no single standard name; books call it "shortened" or
   "incomplete") loses its drawn change too, with no cautionary signature. That applies
   when it is the last bar and its length plus the pickup's makes the prevailing
   signature, which is 3/4 + 1/4 = 4/4 here. Both shells and both staff views follow
   this, through the existing time-signature emission. Nothing is forked.
4. **Numbering.** This needs nothing new: `displayedMeasureNumbers`
   (`src/engine/displayOptions.ts`) already honours a declared 0 and counts on from it.
5. **Guitar Pro, writing.** For a pickup, bar 1's `<Time>` is the next bar's
   signature (the steal), and the master track gets `<Anacrusis/>`. The notes are
   unchanged. The final bar is an open question (decision 3).
6. **Guitar Pro, reading.** `<Anacrusis/>` makes bar 1's signature its longest voice's
   length, expressed in the next bar's unit (one beat of 4/4 is 1/4), falling back to a
   finer unit when needed (1½ beats is 3/8). It also sets `number: 0`. This is the same
   rule alphaTab uses, so alphaTab is the oracle for the reader.
7. **MusicXML** does the same in both directions: `number="0" implicit="yes"` with the
   stolen signature on export, and the reverse on import. That resolves `21e`'s
   underfill badge without suppressing underfill warnings generally.
8. **Editor.** The first bar's inspector gets a **Pickup** toggle that sets or clears
   `number: 0`. On a full-length first bar it is refused, with the reason: "a pickup
   is shorter than the bar after it". Entry inside the pickup is unchanged, because the
   bar's own signature still bounds it.
9. **Storage register.** Today, `global/measures/[]/number` is recorded as lost on every
   Guitar Pro save. A pickup's 0 now survives through `<Anacrusis/>`. Other declared
   numbers stay lost, and `update:roundtrip-register` remeasures it.

**What doesn't move.** Sync data is stored as beats and cut times
(`src/model/syncSegments.ts`), not bar numbers, so renumbering leaves every sync
intact. Lyric placement, playback and swing see the same bar lengths as now.

## Decisions for the owner

1. **Is the marker `number: 0`, or a separate flag?** `number: 0` is standard MNX,
   matches the books and MusicXML, and costs nothing to store. The catch is that a
   pickup is then always numbered 0. A vendor flag (`_x.mnxLab.pickup`) would keep
   numbering a separate display choice, at the price of an extension MNX may never
   adopt. **Recommended: `number: 0`.** For this piece that means bars display as
   0–17. The bar numbers already written in `GLOWUP_LOG.md` and `RUNS.md` stay as
   history, and a log line notes the change.
2. **Should files without the flag become pickups on read?** This piece is one: 1/4 then
   4/4, with no `<Anacrusis/>`. Inferring a pickup from that shape is convenient, but it
   changes how existing library pieces display without anyone asking.
   **Recommended: no inference.** Marking a pickup takes one toggle, and the next save
   writes the flag.
3. **How is the final bar written to Guitar Pro?** It could stay 3/4, as now, so Guitar
   Pro shows a signature change. Or it could be written as 4/4 holding three beats, if
   Guitar Pro accepts an incomplete last bar after an anacrusis. Decide after probe 1.

## Probes before building

1. **A Guitar Pro file with Anacrusis set,** saved from Guitar Pro itself. The owner's,
   if they have Guitar Pro, otherwise one written by alphaTab as a stand-in. Check four
   things: the GPIF it writes, how Guitar Pro numbers the pickup, whether Guitar Pro
   shortens or flags the last bar, and whether bar 1's `<Time>` is the full signature.
2. **The other formats.** Check whether `.gpx` (GP6) and GP3–5 binary carry an anacrusis
   at all. If they don't, those readers stay as they are, and the doc says so.

## Acceptance

- **A lab scenario** with a pickup plus a complementary final bar, engraved in the
  standard, tab and both views. These are new goldens, so the batch is registered in
  [lab-verify](../inprogress/lab-verify.md).
- **Existing goldens are byte-identical.** No scenario declares `"number": 0` today
  (checked 2026-11-09).
- **Conformance tests:**
  - a pickup document round-trips through storage export unchanged (number 0 and the
    1/4 kept)
  - the reader gives alphaTab's lengths on an anacrusis file
  - MusicXML `21e` imports with no underfill badge
  - a full-length first bar refuses the toggle
- **On the owner's piece:**
  - mark the pickup, save and reload
  - 4/4 is drawn once, with no 3/4 at the end
  - bars are numbered 0–17
  - playback, the sync and the lyrics are unchanged

## Spec loop

MNX has no pickup concept. `number` is only a display label, and nothing says a short
first bar is an anacrusis. This item's encoding (true-length signature, `number: 0`,
signature stolen for display) is a lab convention. Whether MNX should state it, or
carry an explicit pickup, is the `pickup-measure-state` question that
[core-musicxml-chord-fidelity](../proposed/core-musicxml-chord-fidelity.md) already names. The
scenario above is the evidence a proposal would start from. Making that proposal is out
of scope here.

## Record — 2026-11-09

**The owner's decisions.** On decision 1, *"Sure - by "turn on" you mean set first bar to
0"* — `number: 0` is the marker. Decision 2 was taken as recommended: nothing is converted
on read without a flag, so *Strolling Down the Highway* is marked by hand. Lyrics on that
piece are parked until this landed: *"lets park the lyrics until the pickup bar converter
and renderer changes have been implemented"*.

**What the probes found.**
- *Three Ultimate Guitar downloads* (Happy Birthday `.gpx`, Greensleeves `.gp5`, Danny Boy
  `.gp`) carry no flag: each author wrote the pickup as a FULL bar padded with leading
  rests, and Ultimate Guitar's renderer draws what is in the file. A padded bar cannot
  safely be read as a pickup (a bar that opens with rests is ordinary music), so it is
  left alone; an editor action that strips the rests and shortens the bar is a possible
  follow-up, not built.
- *alphaTab's `test-data/guitarpro7/anacrusis.gp`*, written by Guitar Pro 7 itself
  (revision 12024): `<Anacrusis />` first in `<MasterTrack>`, `<Time>4/4</Time>` on a bar
  of two quarters. It confirmed the steal; it is two bars long, so it cannot say whether
  Guitar Pro shortens the LAST bar. **Decision 3 stays open**: the last bar is written as
  stored (3/4), which is always valid — at worst Guitar Pro shows a signature change there.
- alphaTab leaves the pickup unnumbered and counts from the first full bar; the lab does
  the same (the 0 is stored, not printed).

**What was built.**
- `src/model/pickup.ts` — the rule (`pickupSignature`, `completesPickup`); standalone
  copies in `converters/guitarpro-mnx/src/common/pickup.ts` and
  `converters/musicxml-mnx/src/common/pickup.ts`.
- Engraving: `timeSigShown` beside `timeSig` in `spacing.ts`'s plan; the emitters draw it.
  No existing golden moved. New scenario `lab/11-rhythm/06-pickup-bar`, registered in
  [lab-verify](../inprogress/lab-verify.md).
- Guitar Pro: the reader turns `<Anacrusis />` into the notes' length (alphaTab's rule),
  numbered 0; the writer steals the next bar's `<Time>` and writes the flag. `.gpx` shares
  the GPIF reader, so it is covered; the gp3–5 binaries have no such flag.
- MusicXML: an `implicit="yes"` first measure with a DECLARED meter becomes a pickup;
  export writes `number="0" implicit="yes"` with the stolen signature and numbers on from 1.
  Four files in the pinned suite (`02e`, `45h`, `46d` — a 3/8 pickup in 4/4 — and `46g`)
  now import as pickups. **`21e` does not**: it declares no meter, and making it a pickup
  would draw a 4/4 the source never shows — its underfill badge stays with
  [core-musicxml-chord-fidelity](../proposed/core-musicxml-chord-fidelity.md).
- Editor: typing `pickup` on the bar rung sets `number: 0` (`no pickup` removes it), and
  the chip reads `pickup` when the first bar is one.

**Not done, and worth knowing.** Studio's own bar labels (the crumb's `bar 1 of 18`, the
lyric margin's `26 (10.3)`, the sync bar's names) count written bars from 1 and do not
follow the printed numbering; nothing stored depends on them.
