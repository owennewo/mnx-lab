# Artificial (harp) harmonics: drawn, stored, played, entered

Status: built 2026-11-14; the scenario's approval is registered in
[lab-verify.md](lab-verify.md#artificial-harp-harmonics--2026-11-14), and the owner's piece is
re-encoded after landing (item 8).

## Why

The owner's "Imagine (tab reading)" (Tommy Emmanuel's arrangement as Tim Van Roy teaches it)
ends in harp harmonics: the left hand holds a shape around the 7th fret, and the right hand
touches the string 12 frets higher and plucks, alternating with ordinary plucked notes.
Published tab draws each one as its touch fret in a diamond (◇19). The model could already
say all of this — `tab.technique.harmonic: { type: "artificial", touchingPitch }`, pitch
sounding, string and stopped fret on the note — but nothing drew it, the `.gp` storage round
trip dropped it an octave and lost the touch pitch, playback reported it unsupported, and
nothing could enter one.

The owner's directions (2026-11-14), quoted:

> bars 63-66 have special "diamond shaped" harmonics … Are they supported in our format? The
> diamond shape isn't rendered in your piece

> I'd like to go with option 2 and what ever is needed to support it

and the three choices put to them:

- **Tab:** "Touch fret in diamond" — ◇19 as the tutorial draws it; the stopped fret is
  printed beside the diamond only when the node is not the octave (`7◇17`).
- **Notation:** "Diamond: artificial only" — non-natural harmonics get a diamond notehead at
  the sounding pitch (their label stays); natural harmonics keep the circle, so no verified
  golden moves.
- **Scope:** "Plus editor input" — an artificial harmonic can be entered in the editor.

## The model, as it already stands

A harp harmonic on the D string held at fret 7: `pitch` A4 (sounding, as all MNX pitch is),
`string` 4, `fret` 7 (the stopped fret — stored, because the ladder would derive 19 from the
sounding pitch), `harmonic: { type: "artificial", touchingPitch: A4 }`. The touch fret is
`touchingPitch − open string`; with no `touchingPitch` the node is the octave.

## Work

1. **`.gp` round trip.** Guitar Pro's `HarmonicFret` on a non-natural harmonic is the node
   counted from the stopped fret (12 = octave; alphaTab's `harmonicPitch` agrees). Export
   writes it from `touchingPitch` (default 12) instead of the played fret; import reads it,
   sounds the note at the node and restores `touchingPitch`.
2. **Tab:** the touch fret in a diamond; the stopped fret before it when the node is not 12.
3. **Notation:** diamond notehead (black/white by duration) for non-natural harmonics; the
   circle is natural's mark only; the label stays.
4. **Playback:** validate an artificial harmonic against its node instead of reporting it
   unsupported; the sounding pitch is played, as before.
5. **Editor:** a key and an inspector choice toggle an artificial (octave) harmonic on a tab
   note: pitch up an octave, stopped fret kept, `touchingPitch` set; off reverses it.
6. **Tab text** (`tools/recording-align/tabText.ts`): suffix `a` = artificial harmonic at the
   octave node.
7. **Scenario** `scenarios/lab/25-tab-techniques/09-artificial-harmonics`, registered in
   [lab-verify.md](lab-verify.md) for the owner's approval.
8. The owner's piece: bars 63–66 re-encoded as artificial harmonics by a named checkpoint.

Out of scope, named: MusicXML's `touching-pitch`/diamond notehead (the converter already
carries the artificial type); natural harmonics away from the 12th fret, which the `.gpif`
importer still pitches at the fret rather than the node.
