# Swing feel — a ratio on the global measure, drawn and played

> **Status: COMPLETE 2026-09-09** — built and landed the day it was raised, worktree retired.
> One new scenario and **no moved golden**; the batch is registered in
> [lab-verify.md](../inprogress/lab-verify.md#swing-feel--2026-09-09).
>
> Raised from the first bar of Davy Graham's *Anji* as Guitar Pro engraves it: a swing
> marking over bar 1 that our converter silently dropped and MNX had nowhere to put.

## The complaint

`Davy_Graham_Anji_SYxHc.gp` carries `<TripletFeel>Triplet8th</TripletFeel>` on all 72 of
its master bars. Our GPIF reader never looked at the element — `GpifMasterBar` had no field
for it and `toMnx` never mentioned it — so the feel vanished without even the warning the
*legacy binary* reader emitted for the same fact (`gp345/gp5.ts`). The document that came
out said the piece was straight, and both the engraving and the player agreed with it.

MNX has no swing either. There is no `swing` anywhere in the pinned schema, and the CG's
own notation reference reserves six requirement ids — `struct-swing-triplet-feel`,
`struct-swing-straight-feel`, `struct-swing-dotted-feel`, `struct-swing-ratio`,
`struct-swing-sixteenth`, `struct-swing-text` — every one marked *"Not implemented yet;
planned for 1.0"*. So this is a gap the standard has named and not filled: exactly the
shape of thing `_x.mnxLab` exists to draft.

## The design decision: a ratio, not an enum

Every application offers a menu of named feels. Guitar Pro's `TripletFeel` has seven
values; Soundslice offers the same seven under different words (*Swing eighth notes as
triplet*, *Scottish sixteenth notes*, …). It would have been easy to copy one of those
menus into the schema.

MusicXML settled the question the other way in 3.1, and it settled it correctly.
`<sound><swing>` holds `<first>` and `<second>` — positive integers, "specified with the
smallest integers possible" — plus an optional `<swing-type>` of `eighth` or `16th`, an
optional free-text `<swing-style>`, or `<straight/>`. A ratio on a unit.

The two models are the same space, and alphaTab's own MusicXML importer is the proof: it
maps 2:1 → *triplet*, 3:1 → *dotted*, 1:3 → *Scottish*, at either unit, and that
exhausts the seven names. So a menu is a **view** of the ratio. Storing the name would
store an opinion about the ratio, lose the feels no menu names (a 5:3 shuffle is a real
thing), and force a translation table into every consumer. `_x.mnxLab.swing` stores the
ratio, and `converters/guitarpro-mnx/src/common/swing.ts` owns the one translation table
the Guitar Pro boundary needs.

Two departures from MusicXML, both toward MNX's own conventions:

- `unit` is an MNX `note-value` (`{ "base": "eighth" }`), the same shape as `tempo.value`,
  rather than a two-value enum. It costs nothing and admits units the enum cannot name.
- **It persists.** MusicXML's `<sound>` is a point event and so is a GP master bar's
  stamp; here a declaration holds until another measure declares one, and `[1, 1]` cancels.
  That is what lets Anji's 72 identical stamps collapse to one declaration — and it is the
  same rule that tells the engraver where to print, because the bars that *change* the feel
  are exactly the bars that print it. One rule, two jobs.

It goes on the **global** measure, beside `tempos` and `harmonies`, on the standing test:
can two parts legitimately disagree? Dynamics can; key, time, tempo and swing cannot.

## Playing it: a warp of the metric axis

The implementation choice that made the rest cheap. Swing could have rewritten note
durations; instead `src/audio/swing.ts` builds a piecewise-linear warp of the metric axis,
per bar, counted from the barline: the pair `[0, 2u)` becomes `[0, 2u·a/(a+b))` and the
remainder.

That warp is **bar-local and duration-preserving**. Barlines and beats are fixed points, so
measure spans, the tempo map and the fermata/make-time insertion map all still see the axis
they were written against — the compiler needed no restructuring, only the warp applied
where visits are built, before grace stealing and hold insertion. And because every player
layer downstream consumes the compiled positions, the transport, the native sink, the MIDI
writer and the playback cursor all inherit the feel with **no code of their own**.

A continuous warp is also the more honest reading than MusicXML's. MusicXML only reaches
notes whose duration equals their written type, which leaves a sixteenth inside a swung
eighth pair undefined; the warp puts it where a player would, and a quarter note lying
across a swung pair does not move at all, because `2u` is a fixed point too.

One thing did have to give. A source-map segment must be straight for a consumer to read a
played position back to a written offset by proportion, so swing cuts each measure's
segments at every run edge and each carries an optional `scale`. Absent when it is 1 — so
a document that declares no swing produces byte-identical evidence to what it produced
before swing existed, which is why the whole corpus regenerated clean.

## Drawing it

`emitSwingMark` draws the rhythmic equation rather than naming it: the written pair, an
`=`, and the realisation the ratio implies. The pair spans two units and is redivided into
`first + second` parts, so the parts are notatable exactly when that total is 3 (a triplet,
bracketed) or 4 (dyadic, one part dotted). 2:1 on the eighth draws `♪♪ = ⌐3¬ ♩♪` — which
is precisely what Guitar Pro prints over Anji's bar 1. A ratio with no rhythmic spelling
prints its ratio as words rather than a wrong rhythm; a declaration's own `text` overrides
the equation; a cancellation prints `Straight`.

It sits in the tempo band above the metronome mark, on all three staff kinds, because a
feel describes the bar and not a notation staff.

## What building it taught

- **The seven names are six ratios.** Confirming that against alphaTab's MusicXML importer
  *and* its MIDI generator — which plays `Triplet8th` as a quarter-triplet plus an
  eighth-triplet, `Dotted8th` as a dotted eighth plus a sixteenth, `Scottish8th` as that
  pair reversed — turned a design hunch into a checkable fact, and gave the compiler an
  independent oracle for its arithmetic. Our numbers match exactly.
- **Duration-preserving was the whole trick.** The first sketch had swing changing measure
  lengths and rippling through the tempo map. Noticing that a pair is a *closed*
  rearrangement collapsed the change from "restructure the compiler" to "warp the axis
  before anything reads it".
- **Persistence made the print rule free.** Deciding that a declaration persists was a data
  decision; it turned out to answer the engraving question too. `resolveSwingTimeline` in
  `model/` is the single place that decides, and both the layouts and the compiler read it,
  so they cannot disagree about where a feel starts.
- **It found a placement bug.** The swing marking on a mid-system bar was being
  attributed to the bar before it, because the shared heading anchor led the content
  spring rather than the bar's first ink —
  [core-heading-anchor.md](core-heading-anchor.md), fixed the same day. This
  scenario's goldens moved with that fix, so review it against the newer placement.
- **Two warnings became data.** The binary reader's GP3/4 score-level flag and GP5
  per-measure byte now land on the same extension as the GPIF path, so the loss list in the
  converter README got shorter rather than longer.

## Not done

- **MusicXML `<sound><swing>` is not wired.** The mapping is settled and the table exists;
  `converters/musicxml-mnx` neither reads nor writes it, so a MusicXML round trip still
  drops a feel. The obvious next item.
- **The written pair is drawn unbeamed.** SMuFL has no beamed-pair glyph and faking the
  beam from glyph bounding boxes is not worth the fragility. Legible; not beautiful.
- **No editing verb.** `setMeasureAttribute` reaches every other global-measure field,
  including `harmonies`; swing is walked as an element kind, but no op authors or removes it
  and the rung inspector shows no pill for it, because the attribute grammar would have to
  learn a ratio
  and a note value and that wants its own design. Registered as a deferred kind owned by
  this doc in `harness/conformance/construct-traces.test.ts`, so the element-ops campaign
  is not charged for it.
- **`style` round-trips and nothing reads it**, which is what MusicXML's `<swing-style>`
  deserves until someone can say what "laid back" means in a ratio.
- **No proposal bundle.** This drafts requirement ids the CG has already reserved, so
  `spec/proposals/` may eventually want a `swing` topic; nobody has asked for one.
