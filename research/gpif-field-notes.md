# GPIF field notes

**Research, not roadmap.** The Guitar Pro 6/7/8 XML score format (`score.gpif`),
reconstructed for the subset `converters/guitarpro-mnx` consumes — background for the
clean-room Guitar Pro converter investigation (replacing alphaTab). No official
specification of this format exists; Arobas published only a GP4-era doc, and the
alphaTab maintainer confirms ([alphaTab discussion #464](https://github.com/CoderLine/alphaTab/discussions/464))
their reader came from trial and error. This page is the working substitute for the
spec, for the subset MNX + `_x.mnxLab` v6 can carry.

Evidence gathered 2026-09-01. Fixture dialect: GPVersion 8.1.3.

Every claim carries one of four evidence tags:

- **CONFIRMED** — verified against fixture XML arithmetic
- **AGREED** — two independent readers concur
- **DIVERGENT** — the readers disagree; trust neither
- **OPEN** — unresolved; settle by GP8 diffing (§9)

## 1. Sources & how far to trust them

| Source | License | Use as | Caveat |
|---|---|---|---|
| **Fixture XML** — `score.gpif` extracted from `converters/fixtures/Sun-did-glide.gp` and `Triplets-and-graces.gp` | ours | Ground truth for element shapes and arithmetic | Neither was written by Guitar Pro itself: one by alphaTab 1.8.4's exporter (its `<Encoding>` comment says so), one by `converters/fixtures/tools/`. GP8 accepts both, but for pristine GP output re-export from GP8 or use the three BCFS `.gpx` sources. |
| **scorelib** ([slundi/guitarpro](https://github.com/slundi/guitarpro), canonical [codeberg.org/slundi/scorelib](https://codeberg.org/slundi/scorelib)) — `guitarpro/src/io/gpif_import.rs`, `gpif_export.rs` | MIT | Readable reference; legally portable with attribution | Young, single-author. Carries at least one real bug (§5 string orientation) and one wrong comment (§8 bend units). Its in-tree MNX model is unwired and tab-blind. |
| **ruxguitar** ([agourlay/ruxguitar](https://github.com/agourlay/ruxguitar)) — `src/parser/gp67/document_reader.rs`, `song_builder.rs` | Apache-2.0 | Behavioral documentation of the TuxGuitar lineage | Its own header says "Port of the GP6 path of TuxGuitar's `GPXDocumentReader`" — LGPL-derived, so treat it as documentation of behavior, **never** a porting source. |
| **alphaTab, observed** — via `converters/guitarpro-mnx/src/import/gp.ts` + fixture round trips | MPL-2.0 (unread) | Black-box oracle: what the current importer receives | Behavior only — its source stays unopened, which keeps the clean-room story simple. |

Written prose about GPIF is nearly worthless: the MuseScore "GP7 file format" doc is
423 words of orientation, and the jpirie GSoC posts stop at element names. The method
that produced every existing reader — and this page — is **change one thing in Guitar
Pro, unzip, diff the XML**.

## 2. Containers: .gp, .gpx, and dialects

- **`.gp` (GP7/8)** — a plain ZIP. The score is `Content/score.gpif`; alongside it sit
  `VERSION`, `BinaryStylesheet`, `PartConfiguration`, `LayoutConfiguration`,
  `Preferences.json` — all ignorable for conversion.
- **`.gpx` (GP6)** — a proprietary container, magic `BCFS` (uncompressed sector
  filesystem — all three of our `.gpx` fixtures) or `BCFZ` (same filesystem, LZ-style
  compressed: header, u32-LE decompressed length, then a bit-stream of raw and
  back-reference chunks). Both hold a `score.gpif`. Soundslice exports arrive as
  `.gpx`, so the BCFZ/BCFS layer is required, not optional.
- **Dispatch rule** (ruxguitar's, sound): magic `BCFS`/`BCFZ` → GP6 container;
  `PK\x03\x04` → GP7+ zip; anything else → the gp3–5 binary family.

**GP6 vs GP7/8 gpif dialect.** Same document graph, differences a reader must branch
on (AGREED):

- Track properties (Tuning, CapoFret, DiagramCollection) sit directly under
  `Track/Properties` in GP6, but under `Track/Staves/Staff/Properties` in GP7+.
- MIDI program: GP6 `Track/GeneralMidi` (Program, PrimaryChannel, SecondaryChannel);
  GP7+ `Track/Sounds/Sound/MIDI/Program` plus `Track/MidiConnection` for channels.
- GP6 notes may carry pitch as `Tone`/`Octave` properties where GP7+ writes
  `ConcertPitch`; percussion uses `Element`/`Variation` in both.

```xml
<GPIF>
  <GPVersion>8.1.3</GPVersion>
  <GPRevision required="12024" recommended="13000">13007</GPRevision>
  <Score> … <MasterTrack> … <Tracks> … <MasterBars> … <Bars> … <Voices> … <Beats> … <Notes> … <Rhythms>
```

## 3. The document graph

GPIF is not a tree of music — it is flat pools of id-keyed objects joined by
space-separated id lists. Build the five lookup maps first; then walk.

```
MasterBar ──Bars──────▶ Bar        one id per TRACK, in track order
Bar ───────Voices─────▶ Voice      up to 4 slots; -1 = empty slot
Voice ─────Beats──────▶ Beat       in playing order
Beat ──────Notes──────▶ Note       absent or empty = rest
Beat ──────Rhythm ref─▶ Rhythm     durations are SHARED, by reference
```

- All ids are non-negative integers; `-1` in a voice list means "no voice in this
  slot." Text content is routinely CDATA-wrapped. **An empty slot still counts**
  (CONFIRMED by differential testing 2026-09-01): alphaTab materializes every
  declared slot as a voice holding a single quarter rest, so a four-slot bar
  with two `-1`s imports as four MNX sequences — `converters/guitarpro-mnx`'s
  clean-room reader mirrors this, and the committed fixtures embed it.
- `MasterBar/Bars` is the track join: the *n*-th id belongs to the *n*-th `Track`.
  One MasterBar per measure of the piece.
- `Rhythm` objects are deduplicated — hundreds of beats reference a handful of
  rhythms. A converter reads durations only through the `ref`.
- `Score` metadata: `Title, SubTitle, Artist, Album, Words, Music, WordsAndMusic,
  Copyright, Tabber, Instructions, Notices` — plain text children (AGREED).
- Tempo lives on `MasterTrack/Automations/Automation`: `Type=Tempo`, `Bar` (0-based
  MasterBar index), `Position` (offset within the bar), `Linear`, and `Value` =
  `"bpm unit"` — fixture: `<Value>160 2</Value>` with unit `2` = quarter note
  (CONFIRMED); the full unit enum is OPEN (§9). GP8 adds `Type=SyncPoint`
  automations for audio-track alignment — safe to ignore.

## 4. MasterBar: time, key, repeats, sections

**Time · Key (CONFIRMED).** `<Time>4/4</Time>` — literal fraction, per bar (MNX wants
change-only: dedupe on emit). `<Key>` holds `AccidentalCount` (signed fifths — maps
straight onto MNX `key.fifths`), `Mode` (`Major|Minor`), and a `Sharps` element the
readers ignore.

**Repeat (AGREED).** `<Repeat start="true" end="false" count="…"/>` — attributes, not
children. `count` is the **total number of plays** (alphaTab's exporter comment and
observed `repeatCount` agree). ruxguitar stores `count − 1` only because TuxGuitar's
internal model counts *re*-plays — a model convention, not file semantics.

**AlternateEndings (AGREED).** Space-separated volta numbers
(`<AlternateEndings>1 2</AlternateEndings>`), repeated on **every bar the volta
spans** — same shape as the gp5 binary's per-bar flags. The run-collapsing walk in
`import/gp.ts` (identical mask → one MNX `ending` with `duration`) ports unchanged.

**Section — the rehearsal/section split (CONFIRMED).**

```xml
<Section>
  <Letter/>                      <!-- rehearsal mark → _x.mnxLab rehearsal.label -->
  <Text><![CDATA[Intro]]></Text> <!-- section name  → _x.mnxLab section.label -->
</Section>
```

Both children exist and are independent — exactly the two `{label}` objects of the v6
extension (alphaTab surfaces them as `section.marker` / `section.text`). **Both
permissive readers under-read this element**: ruxguitar keeps only `Text` and drops
`Letter`; scorelib collapses the two into one marker with a fallback chain. Neither is
a model for us.

**The rest of the bar (AGREED).** `<DoubleBar/>` and `<FreeTime/>` are presence flags.
`<TripletFeel>` is a string. `<Fermatas>` wraps typed fermatas with rhythmic offsets.
`<Directions>` carries jump/target words from a fixed vocabulary (`Coda, Segno, Fine,
DaCapo, DaCapoAlCoda, DaSegno…` — scorelib enumerates nineteen). None are in the
current MNX subset; noted for completeness.

## 5. Track: tuning, capo, strings

**Property name="Tuning" (CONFIRMED).**

```xml
<Property name="Tuning">
  <Pitches>40 45 50 55 57 64</Pitches>   <!-- MIDI, ordered LOW → HIGH -->
  <Label/> <LabelVisible>false</LabelVisible>
</Property>
```

**GPIF string numbers are 0-based indices into this array — string 0 is the LOWEST
string.** Proven by fixture arithmetic on *Sun did glide* (capo 4): every note
satisfies `Pitches[string] + fret + capo = Midi`, e.g. string 1, fret 3 →
45+3+4 = 52 ✓. This settles a live disagreement: ruxguitar/TuxGuitar convert
correctly; **scorelib's `+1` shift maps GPIF 0 onto its own 1 = highest convention — a
genuine orientation bug**. Note this is the *opposite* end from `_x.mnxLab` (string 1
= highest) and from the gp3–5 binary family — the same inversion
`converters/guitarpro-mnx/src/common/tuning.ts` already guards, now with a third
numbering in play. Never open-code it.

**CapoFret · PartialCapo (CONFIRMED).**
`<Property name="CapoFret"><Fret>4</Fret></Property>` → `_x.mnxLab.capo`. Fret numbers
on notes are **relative to the capo**; the note's `Midi` is the true sounding pitch
with capo applied (§8). `PartialCapoFret` + `PartialCapoStringFlags` exist in both
fixtures; no reader anywhere consumes them — flag, don't silently drop, if non-zero.

**Bar-level: Clef · SimileMark (AGREED).** `<Clef>` per Bar, vocabulary
`G2 | F4 | C3 | C4` (+ `Neutral` for percussion), matching `fromAlphaTabClef`'s exact
set. `<SimileMark>` marks repeat-previous-bar shorthand.

## 6. Rhythm, tuplets & grace beats

**Rhythm (CONFIRMED).**

```xml
<Rhythm id="1">
  <PrimaryTuplet num="3" den="2"/>
  <NoteValue>Eighth</NoteValue>
  <AugmentationDot count="1"/>      <!-- count ∈ {1, 2} -->
</Rhythm>
```

`NoteValue` vocabulary: `Whole, Half, Quarter, Eighth, 16th, 32nd, 64th` agreed by
both readers, `128th` from scorelib only; longa/breve OPEN. Tuplet membership is
per-beat via the shared rhythm — GPIF does not group tuplets. **Grouping is the
converter's job**, and the current rule is proven: fill groups by written duration so
six flagged eighths are two triplets (`buildSequence`'s run-buffering walk ports
as-is, minus alphaTab's pre-computed `TupletGroup`, which must be re-derived the same
way).

**Grace beats (CONFIRMED).** A grace note is a **separate Beat** carrying
`<GraceNotes>BeforeBeat</GraceNotes>` or `OnBeat`, placed in voice order immediately
before its principal. Runs of consecutive grace beats decorate one principal. Mapping
(unchanged from today): `BeforeBeat` → `stealPrevious`, `OnBeat` → `stealFollowing`.

## 7. Beat: lyrics, harmony, dynamics

**Lyrics — per beat, per verse (CONFIRMED).**

```xml
<Beat id="205"> …
  <Lyrics>
    <Line><![CDATA[I]]></Line>     <!-- verse 1 -->
    <Line><![CDATA[I]]></Line>     <!-- verse 2 -->
    <Line><![CDATA[And]]></Line>   <!-- verse 3 -->
  </Lyrics>
</Beat>
```

GP7+ attaches syllables to the beat, one `Line` per verse in declaration order — no
track-level lyric offsets to resolve (that is the gp3–5 model). **Neither Rust reader
parses beat lyrics at all** — this section exists because the fixtures show it. The
trailing-`-` continuation and `+`-as-space conventions handled by `buildLyrics` are
authoring conventions inside the syllable text and carry over verbatim; OPEN for edge
cases.

**Harmony: two unrelated encodings (AGREED).** As in the alphaTab model today: a beat
may carry `<FreeText>` (bare annotation string — how Vestapol states all 25 chords) or
a `<Chord>` id referencing the track property `DiagramCollection → Items → Item`
(attrs `id`, `name`; optional `Diagram` with `stringCount/fretCount/baseFret` +
per-string `Fret` children, string attr 0-based). Read both, parse through
`parseChordSymbol`, dedupe globally — the existing `applyHarmonies` logic is already
GPIF-shaped.

**Dynamics · beat effects (AGREED).** `<Dynamic>` ∈ `PPP PP P MP MF F FF FFF`, sticky
until changed (scorelib carries velocity forward across beats). Beat-level
`Properties`: `Brush`/`PickStroke` (child `Direction` = `Up|Down`),
`Slapped`/`Popped` (presence of `Enable`), `Rasgueado`, and the whammy-bar family —
`WhammyBar` enable + `Origin/Middle/Destination` × `Value/Offset` floats, same unit
system as bends (§8). `<Fadding>FadeIn</Fadding>` (sic — the misspelling is the
format's), `<Tremolo>n/d</Tremolo>` for tremolo picking. None of these are in the MNX
subset yet except via future technique extensions.

## 8. Note: pitch, techniques, bends

**The pitch quartet (CONFIRMED).**

```xml
<Note id="1">
  <Properties>
    <Property name="ConcertPitch"><Pitch> <Step>G</Step><Accidental>#</Accidental><Octave>4</Octave> </Pitch></Property>
    <Property name="TransposedPitch">…octave +1 (guitar written pitch)…</Property>
    <Property name="String"><String>2</String></Property>   <!-- 0-based, 0 = lowest (§5) -->
    <Property name="Fret"><Fret>2</Fret></Property>         <!-- relative to capo -->
    <Property name="Midi"><Number>56</Number></Property>    <!-- sounding, capo applied -->
  </Properties>
</Note>
```

Cross-checks that all hold in the fixtures: `Midi = Pitches[String] + Fret + CapoFret`,
and `ConcertPitch` spells the same sounding pitch — with **GPIF octaves one higher
than scientific notation** (MIDI 56 = G#3 scientific is written `Octave 4`; i.e.
GPIF's C5 = MIDI 60). `TransposedPitch` is the written pitch (guitar: an octave up).
Accidental strings observed: `#`, empty; `b`/`x`/`bb` OPEN. GP6 files may state pitch
as `Tone`/`Octave` properties instead, and percussion as `Element`/`Variation`
(AGREED).

**Simple techniques (AGREED).**

| GPIF | Shape | MNX destination |
|---|---|---|
| `<Vibrato/>` | direct child, presence | `technique.vibrato` |
| `Property PalmMuted` | `<Enable/>` presence | `technique.palmMute` |
| `Property Muted` | `<Enable/>` — dead/ghost-fret note | not yet modeled |
| `Property Tapped` | `<Enable/>` | not yet modeled |
| `<LetRing/>` · `<AntiAccent>` · `<Accent>` | children; Accent int is DIVERGENT (§9) | not yet modeled |
| `<Tie origin="…" destination="…"/>` | boolean attrs; destination marks the tied-into note | MNX `ties` (pair by same string, next note) |
| `<Trill>midi</Trill>` + XProperty `688062467` | trill-with pitch + duration in 480-per-quarter ticks | not yet modeled |

**Hammer-on / pull-off (AGREED).** `Property HopoOrigin` (`<Enable/>`) marks the
origin; `HopoDestination` redundantly marks the target. The file stores **no explicit
link** — the pairing rule, observed through alphaTab's `hammerPullDestination`: the
destination is the **next note on the same string** in the same voice. That resolution
step is the converter's, and it is what makes `technique.hammerPull.target` an id
reference.

**Slide — one property, six flag bits (AGREED).**
`<Property name="Slide"><Flags>2</Flags></Property>`

| Bit | Meaning | MNX slide type |
|---|---|---|
| `0x01` | shift slide to next note | `shift` + target |
| `0x02` | legato slide to next note | `legato` + target |
| `0x04` | slide out, downward | `slideOut` dir `down` |
| `0x08` | slide out, upward | `slideOut` dir `up` |
| `0x10` | slide in from below | `slideIn` dir `up` |
| `0x20` | slide in from above | `slideIn` dir `down` |

Same encoding as the gp5 binary. Targets for shift/legato resolve like hammer-pulls:
next note, same string. Bits ≥ `0x40` (pick slides?) OPEN.

**Bend — seven floats, one curve (AGREED).**

```xml
<Property name="Bended"><Enable/></Property>
<Property name="BendOriginValue"><Float>0</Float></Property>
<Property name="BendOriginOffset"><Float>…</Float></Property>
<Property name="BendMiddleValue">… + MiddleOffset1, MiddleOffset2
<Property name="BendDestinationValue">… + DestinationOffset
```

**Units.** Values are percent of a whole tone: `100` = 2 semitones, so `_x.mnxLab`
semitone `alter = value / 50`. (Consistent with alphaTab feeding quarter-tone units
that `import/gp.ts` halves; scorelib's "1/100 semitone" comment is **wrong** — its own
÷25 code contradicts it.) Offsets are percent of the note's duration, `0–100` →
`position = offset / 100`. The curve is origin-hold → middle (twice, offsets 1/2) →
destination — up to 5 points once assembled; sort by position before emitting.
TuxGuitar-lineage code skips a middle offset equal to `12` as a sentinel — OPEN (§9).
The whammy-bar family on the beat uses the same value/offset system.

**Harmonics (AGREED).** `Property HarmonicType` → child `<HType>` with string
vocabulary `Natural | Artificial | Pinch | Tap | Semi | Feedback` — a 1:1 match for
`MnxHarmonicType` (keep Feedback distinct; scorelib folding it into Pinch is its
choice, not the file's). `Property HarmonicFret` → `<HFret>`, the touch fret, possibly
fractional (e.g. 3.2).

## 9. The GP8 diffing worklist

Where the sources disagree or fall silent. Each row is one session with Guitar Pro 8:
author the feature, unzip, diff.

| # | Question | What the sources say |
|---|---|---|
| 1 | **Accent encoding** (DIVERGENT) | ruxguitar tests equality (1 = staccato, 4 = heavy, 8 = accent); scorelib treats it as a bitmask and also maps `0x02`. Author staccato + accent together and read the int. |
| 2 | **Bend middle-offset 12 sentinel** (OPEN, narrowed) | TuxGuitar lineage skips `MiddleOffset == 12`; scorelib ignores middles entirely. Differential testing against alphaTab (2026-09-01, Vestapol note 388: origin 0 / middle 50 / destination 100, no offsets) established one rule: **a middle value with no explicit offset is dropped** — it sits at the default midpoint of a linear ramp and carries nothing. Whether an offset of literal `12` is additionally a sentinel remains open. |
| 3 | **Tempo unit enum** (OPEN) | `2` = quarter is confirmed. Author eighth-, dotted-quarter- and half-based tempos to fill the table. |
| 4 | **Slide bits ≥ 0x40** (OPEN) | Neither reader handles pick slides. Author one. |
| 5 | **NoteValue extremes** (OPEN) | `128th` (scorelib only), longa/breve unknown. |
| 6 | **Accidental vocabulary** (OPEN) | `#` and empty observed; flat, double-sharp (`x`?), double-flat unverified. |
| 7 | **Lyric continuation in-file** (OPEN) | Confirm trailing `-` and `+`-as-space appear verbatim in GP-written CDATA (fixtures suggest yes, but both are non-GP writers). |
| 8 | **Whammy vs bend unit parity** (OPEN) | TuxGuitar lineage divides whammy by 50 but bends by 25 into differently-scaled models; confirm the file units really are identical (percent of whole tone) for both. |
| 9 | **Pristine GP8 fixture** | Both `.gp` fixtures were machine-written (alphaTab / our tool). Re-save one in GP8 and diff — any element GP8 adds or reorders is dialect knowledge for free, and the saved file becomes the corpus's first GP-written `.gp`. |

## 10. Where clean-room beats alphaTab

Reading GPIF directly isn't only parity — the file holds information alphaTab's model
never hands over.

- **Author's spelling, not respelled pitch.** Today `import/gp.ts` reconstructs
  spelling from `realValue` MIDI + key fifths. `ConcertPitch` carries the author's
  actual `Step/Accidental/Octave` — MNX can preserve it exactly, enharmonics included.
- **Written octave.** `TransposedPitch` states the notation-staff octave explicitly
  instead of assuming the guitar transposition.
- **Fret is validation for free.** The file states string, fret, capo *and* sounding
  MIDI; the v6 rule (string authoritative, fret validation-only) gets a native
  cross-check on every note at import time.
- **Partial capo** is in the files now and invisible through the current pipeline.
- **Trills and ornaments** are parseable (trill-with pitch plus XProperty duration)
  whenever `MnxTabTechnique` grows to want them.
- **The one-model architecture holds.** Both container families and both dialects
  normalize into the same flat graph; a single GPIF→MNX mapping layer serves .gp and
  .gpx alike — the same shape that made the alphaTab path cheap, without the
  dependency.

---

**Method.** Readers: ruxguitar `src/parser/gp67/` (document_reader.rs,
song_builder.rs) and scorelib `guitarpro/src/io/gpif_import.rs`, read in full.
Fixtures: `score.gpif` extracted from `Sun-did-glide.gp` (499 notes, capo 4, 3 verses,
sections, repeats) and `Triplets-and-graces.gp` (tuplets, grace beats); arithmetic
checks run over the parsed XML. alphaTab observed only through
`converters/guitarpro-mnx/src/import/gp.ts` and the committed fixture round trips —
its source was not read. Prepared 2026-09-01 for the clean-room Guitar Pro converter
investigation.
