# Repeat barlines — and the final-barline default, which is upstream's question

> **Status: BUILT 2026-09-04** (the repeat half). Item 4 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md). **Oracle 16 → 18 of
> 27.** The other half — what an absent final barline means — is **deliberately not
> built**, and the evidence for why is below.

The oracle reported five scenarios differing by a single extra `rect` with nothing
missing, and they looked like one cause. They were two, and only one of them was a bug.

## The bug: a repeat is not a barline plus a repeat

MusicXML draws a repeat by putting **both** things on one `<barline>`:

```xml
<barline location="left">
  <bar-style>heavy-light</bar-style>
  <repeat direction="forward"/>
</barline>
```

The `bar-style` there is *how the repeat is drawn* — heavy-light opening, light-heavy
closing. It is not an independent barline. MNX says it once, with `repeatStart` /
`repeatEnd`, and the spec's own examples carry no `barline` beside them.

We were emitting both, so the repeat was drawn and then a thick bar was drawn over it.
The fix is one condition: **a `<bar-style>` on a barline that also carries a `<repeat>`
belongs to the repeat.** `repeats-alternate-endings-simple` and
`repeats-alternate-endings-advanced` both go to `match`.

A related fidelity fix rode along: an explicit `<bar-style>regular</bar-style>` used to be
dropped as "the default" and is now kept, because — as the rest of this document
argues — the two formats do not agree on what the default is, so a source that says
which one it wants is stating something worth carrying.

## The non-bug: the final barline, and why the fix was reverted

The other three (`hello-world`, `two-bar-c-major-scale`,
`three-note-chord-and-half-rest`) have MusicXML with **no `<barline>` element at all**,
and the W3C's paired MNX writes `barline: {type: "regular"}` explicitly on the last
measure.

The formats disagree on the default:

| | absent barline on the last measure means |
|---|---|
| MusicXML | a **thin** barline — the format's default |
| MNX, as our engine renders it | a **final (thick)** barline |

So silence cannot be carried across as silence, and the obvious fix is for the importer
to say `regular` out loud. **That fix was written, measured, and reverted.**

> **It took the oracle from 18 match to 10.** It fixed the three scenarios that motivated
> it and broke eight that were already passing — `ties`, `slurs`, `beams`,
> `key-signatures`, `time-signatures`, `dotted-notes`, `multiple-voices` and
> `slurs-chords` — every one of which has **no barline at all** on its last measure and
> is engraved with a final one.

**The spec's own corpus contradicts itself.** Three of its 27 comparisons convert an
absent MusicXML barline into an explicit `regular`; roughly fifteen convert the same
absence into nothing at all and are engraved thick. No importer rule can satisfy both,
because the disagreement is in the reference data, not in our reading of it.

That makes it a question for upstream rather than a bug here: **what does an absent
`barline` on the last measure of an MNX document mean?** Until it has an answer, the
three scenarios stay `content`, which is the honest verdict — the oracle is reporting a
real disagreement, and papering over it would cost five times what it bought.

This is the campaign's first genuine **spec-loop** finding: not a gap in MNX's
vocabulary, but an ambiguity in its defaults that its own examples resolve two ways.

## The agreement block

1. **The oracle** — the two repeats scenarios, plus the structural assertion in
   `spanners.test.ts` that no measure carries both a repeat and a barline.
2. **The MNX verdict** — standard objects; nothing proposed. The *finding* about defaults
   is spec-loop material, recorded above rather than encoded.
3. **The dependency budget** — no new dependency.
4. **The matrix row** — none yet.
5. **The losslessness bar** — the two scenarios at `match`; converter suite green at 71.

## Result

| | Before | After |
|---|---|---|
| Oracle `match` | 16 / 27 | **18 / 27** |
| Converter suite | 69 tests | 71 tests |
| Remaining | 10 content, 1 spacing | **8 content, 1 spacing** — 3 of them the deferred default |
