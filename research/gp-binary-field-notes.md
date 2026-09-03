# Guitar Pro 3–5 binary field notes

**Research, not roadmap.** This is the docs-first specification for the clean-room
legacy reader tracked in `roadmap/inprogress/core-guitarpro-binary-import.md`. It records
only claims needed by the implementation and labels their evidence; PyGuitarPro's LGPL
implementation remains unread.

Evidence labels:

- **CONFIRMED** — the official Arobas GP4.06 format description and PyGuitarPro's
  published format documentation agree.
- **DOCUMENTED** — stated by one of those documents but not yet fixture-tested here.
- **OPEN** — must be settled by a generated fixture or differential test.

## 1. Family and dispatch

**CONFIRMED.** GP3, GP4, and GP5 form a sequential little-endian binary lineage,
distinct from the GP6+ GPIF formats. Every file starts with a byte-sized string in a
fixed 30-byte field, making the version header 31 bytes total.

Accepted file headers:

| Header | Internal version |
|---|---:|
| `FICHIER GUITAR PRO v3.00` | 3.00 |
| `FICHIER GUITAR PRO v4.00` | 4.00 |
| `FICHIER GUITAR PRO v4.06` | 4.06 |
| `FICHIER GUITAR PRO L4.06` | 4.06 variant |
| `FICHIER GUITAR PRO v5.00` | 5.00 |
| `FICHIER GUITAR PRO v5.10` | 5.10 |

Clipboard headers exist, but clipboard payloads are not `.gp3`/`.gp4`/`.gp5` files and
are outside the reader's current scope. GP1/2 remain a precise unsupported-version error.

## 2. Primitive encodings

**CONFIRMED.** Integers and shorts are little-endian. Bytes, signed bytes, booleans,
32-bit floats, and 64-bit doubles also occur. Text uses a caller-selected 8-bit encoding;
Windows-1252 is the interoperability default.

**CONFIRMED.** Three string shapes must remain distinct:

| Name | Encoding |
|---|---|
| `ByteSizeString` | `u8 length`, then that many characters; some fields reserve a fixed-width payload |
| `IntSizeString` | `i32 length`, then that many characters |
| `IntByteSizeString` | `i32 (length + 1)`, `u8 length`, then characters |

The fixed version field is the first exercised cursor invariant. The score-information
strings use `IntByteSizeString`; GP4/5 lyrics use `IntSizeString`.

**CONFIRMED by generated GP5.00 and GP5.10 fixtures.** With the field values in
`make-gp5-basics.py`, both revisions place the lyric block at byte offset 298. The
clean-room preamble reader arrives at that offset and preserves the Windows-1252 `é`.

## 3. Top-level GP5.00/5.10 order

**CONFIRMED for the baseline fixtures.** The GP5 body is sequential:

1. version; score information (GP5 adds a separate music-author field);
2. five lyric lines and their starting measures;
3. master RSE data, tempo name/value/visibility, key and octave;
4. 64 MIDI channel records, directions and master reverb;
5. measure and track counts; all measure headers; all tracks;
6. every measure × track pair, holding two voice sub-measures, followed by line-break data.

**CONFIRMED.** GP5.00 and GP5.10 differ in padding and RSE records. In particular,
GP5.00 reads two bytes after the track table (and one before the first track), while
later GP5 reads one byte after the table. These skips are named and version-gated in
`src/gp345/gp5.ts`; both fixtures are consumed to exactly EOF.

## 4. Implemented GP5 structural, lyric and simple-technique baseline

**CONFIRMED by exact differential parity against alphaTab on both revisions:**

- page setup, RSE and MIDI records are traversed without importing presentation data;
- initial tempo/key, measure-level time/key changes, repeats, double bars and markers;
- track names, high→low tuning arrays, capo and treble/bass clef choice;
- both voice slots, ordinary notes and rests, dots, complete tuplets and beat text;
- all five track-level lyric streams, split on whitespace and dispatched from each
  1-based starting measure onto voice-zero note beats while skipping rests; `+` inside
  a chunk remains available to the shared mapper as Guitar Pro's escaped space;
- hammer/pull origins, palm mute, vibrato, the GP5 slide bitmask, and natural/pinch
  harmonics normalize into the shared note-technique fields (the committed fixture
  exercises four of the six slide directions and both supported harmonic kinds);
- legacy high→low string bits normalize into GPIF's low→high indices, after which the
  shared `gpifToMnx` mapping produces the same MNX string/fret and sounding pitches;
- GP5.00 and GP5.10 normalize to exactly the same MNX structure, and the unified
  `importGuitarProCleanRoom` dispatch now selects this reader for GP5 binaries.

The lyric/simple-technique fixture also confirms two pitch details that plain fret
arithmetic would lose: a natural harmonic at fret 7 sounds an octave above the fretted
pitch, and a pinch harmonic sounds one octave above its fretted pitch. GP5-only
`soundingMidiOverride` carries those cases through the shared intermediate without
changing modern GPIF pitch precedence.

The reader still deliberately throws, with the musical location and byte offset, on
variable-length chord-diagram, beat-effect, mix-table, bend, grace, tremolo-picking,
trill, artificial/tapped/semi-harmonic and tied/dead-note records. Let-ring, staccato,
ghost and accent flags have no
current MNX-Lab technique representation and produce warnings rather than disappearing
silently. That boundary defines the next fixtures.

One compatibility quirk is intentionally mirrored for replacement parity: alphaTab emits
the file's initial tempo twice for these legacy fixtures, so the normalized document does
the same. Revisit this only as an explicit normalization change across both paths.

## 5. Next fixture questions

- **OPEN:** Whether malformed hybrid-string outer lengths occur in wild files. Start
  strict; relax only with a captured fixture and an explicit warning.
- **CONFIRMED:** GP5 note-effect flags are two bytes. Payload-free hammer/pull, palm
  mute and vibrato flags plus the one-byte slide and harmonic discriminators match the
  published layout and exact AlphaTab output in both 5.00 and 5.10 fixtures.
- **CONFIRMED:** Attach GP3–5's five track-level lyric strings to voice-zero non-rest
  beats, starting from each stored 1-based measure number. This matches AlphaTab in
  both GP5 revisions; attachment is inherently less precise than GPIF per-beat lyrics.
- **OPEN:** Add effect-scoped fixtures for chord diagrams, grace notes, bend point
  lists, tremolo picking, trills, beat effects, let-ring and dead/tied notes.

## Sources

- Arobas Music, *Guitar Pro 4.06 File Format Description* (historical official spec):
  <https://dguitar.sourceforge.net/GP4format.html>
- PyGuitarPro, *Guitar Pro File Format* (published format reference):
  <https://pyguitarpro.readthedocs.io/en/v0.5/pyguitarpro/format.html>
- alphaTab, *Guitar Pro 3–5* (coverage oracle, not an implementation source):
  <https://alphatab.net/docs/formats/guitar-pro-3-5>
