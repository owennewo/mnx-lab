# Chord symbols (`_x.mnxLab.harmonies`)

> **Status: data path SHIPPED (2026-07-26); rendering not started.**
>
> Built as `global.measures[i]._x.mnxLab.harmonies[]` — the design argued in
> [spec-mnx-cg-proposals.md](spec-mnx-cg-proposals.md) §4 and specified in
> [docs/mnx-extensions.md](../../docs/mnx-extensions.md). What landed:
>
> | | |
> |---|---|
> | Guitar Pro import/export | ✅ both `beat.text` and `Chord` objects |
> | MusicXML import/export | ✅ proper `<harmony>` both ways |
> | Round trips | ✅ lossless, with one documented normalisation (below) |
> | Rendering | ❌ nothing draws a chord symbol yet |
>
> **The design questions below are all answered.** (1) Structured *and* literal:
> `root`/`quality`/`bass`/`degrees` plus a `text` override kept only when the
> source spelling differs from the canonical rendering. (2) It attaches to the
> **global** measure, not the event — two parts cannot legitimately disagree
> about the chord on a beat. (3) Fretboard diagrams stay out: they belong on the
> *part* (a diagram depends on the tuning) and no corpus file fills one in.
>
> One documented loss: MusicXML's `<kind text>` holds only the *suffix*, so a
> literal that contradicts the structure — `c/G`, with a lowercase root, which
> is how one chord in House of the Rising Sun really is spelled — normalises to
> `C/G` through MusicXML. The structure survives exactly; Guitar Pro keeps the
> literal.
>
> The rest of this doc is the evidence the design rests on.

## The goal

Carry chord symbols — `D`, `G`, `A7`, `Am7♭5/G` — from source files, through
MNX, out to both export formats, and eventually onto the page above the staff.
For a guitar score they are not decoration: for a large share of players the
chord symbols *are* the chart, and a lead sheet without them is unusable.

## MNX has no chord symbols at all

Checked against `schemas/mnx-schema.json` (**version 19**): there is no
`harmony`, no `chord`, no `root`/`kind`, and no general text mechanism. The only
free-text constructs in all 188 `$defs` are `event-lyric-line.text`,
`lyric-line-label` and `staff-label`. `measure-global` allows exactly
`barline, ending, fermata, fine, jump, key, number, repeatEnd, repeatStart,
segno, tempos, time`.

So this needs a vendor extension, exactly like `_x.tab` and the `_x.section`
labels added in the same sweep. `_x` is schema-legal wherever `global-attrs` is
composed in, so an extension validates without touching the MNX schema.

## The data is already in our fixtures

`Vestapol` carries **25 chord symbols**, and both source formats have them —
this is not hypothetical:

| Source | How it stores them |
|---|---|
| `Vestapol.gpx` | 25 `beat.text` values (`D`, `G`, `D`, `G`, …) |
| Soundslice MusicXML export | 25 `<direction><direction-type><words>` |

Neither reaches MNX today. Note that Guitar Pro *also* has a proper
`Chord`/`chordId` model (name + fretboard diagram), which Soundslice does not
use — it writes plain beat text. A converter should read both.

## Design questions to settle first

1. **Structured or literal?** MusicXML models `<root-step>` + `<kind>` +
   `<bass>`; Guitar Pro (via Soundslice) has only a display string. A structured
   form transposes and re-spells correctly; a literal string always round-trips.
   Probably **both**: a required `text` plus optional parsed parts.
2. **Where does it attach?** Chord symbols are metrically positioned but belong
   to the score, not to a voice. Candidates: `global.measures[i]._x.harmony[]`
   with a fractional position (matches how MNX places `segno`/`fine`), or on the
   event (`event._x.harmony`), which is simpler but wrongly implies voice
   ownership.
3. **Fretboard diagrams.** Guitar Pro's `Chord` carries string/fret shapes.
   Out of scope for a first pass, but the shape of `_x.harmony` should not
   preclude adding `diagram` later.

## Related open extension questions

This is now the **third** thing guitar scores need that MNX v19 lacks, and they
should be decided together rather than one at a time:

| Missing from MNX | Status | Evidence |
|---|---|---|
| Tab (positions, tuning, capo) | ✅ shipped as `_x.tab` v2 | the whole corpus |
| Section / rehearsal labels | ✅ shipped as `_x.section` | Sun-did-glide (5), Vestapol (4) |
| **Chord symbols** | ❌ this doc | Vestapol (25) |
| **Harmonics, palm mute** | ❌ [core-guitar-technique.md](core-guitar-technique.md) | Vestapol (42 + 4) |

Worth writing up as input to the MNX CG alongside the tab-clef finding that
already feeds [w3c-cg/mnx#63](https://github.com/w3c/mnx/issues/63) — "what a
guitar score needs that MNX cannot yet express" is a stronger contribution as
one coherent list than as four separate gaps.

## Not this

Not chord *recognition* (deriving symbols from the notes), and not playback of
strummed voicings. Just carrying what the source already states.
