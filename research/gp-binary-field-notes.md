# Guitar Pro 3–5 binary field notes

**Research, not roadmap.** This is the docs-first specification for the clean-room
legacy reader tracked in `roadmap/complete/core-guitarpro-binary-import.md`. It records
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

## 6. 2026-09-07 continuation: bend and grace evidence

Generated `bends-5.00.gp5` and `bends-5.10.gp5` confirm binary positions
0–60 and values divided by 50 for MNX semitones. PyGuitarPro's public model
instead uses positions 0–12 and quarter tones. Preserve the binary's full
point list in `GpifBend.points`; compressing it to GPIF's seven scalar fields
would lose the five-point rise/release fixture. Both revisions match AlphaTab
exactly. Point-level vibrato currently warns; malformed counts, descending
positions and positions outside 0–60 fail with a location.

The two `graces` fixtures alternate before/on-beat placement and 32nd/16th
durations. **DIVERGENT:** AlphaTab imports all four as before-beat eighth-note
graces. The clean-room reader preserves the authored placement and duration;
the parity test first proves the oracle loss, corrects only those two fields,
then compares the whole MNX document, including hammer/pull target references.
Multi-string grace grouping, dead graces, bend transitions and the duration-2
case still need dedicated coverage. These results do not close GP5 Phase 1.

## 7. Older dialect structural parity (2026-09-08)

GP3.00 and GP4.00/4.06 generated structural fixtures now reach EOF and match
the AlphaTab oracle. GP3/4 omit GP5 page/RSE fields and display bytes, use one
voice per bar, and encode the initial key as an integer; GP4 adds the lyric
block and one octave byte. GP3 note effects use one flag byte; GP4 uses two
and encodes slides as a signed enumeration, converted to the shared bitmask.
Repeat-close bytes in these older versions are incremented to total plays.

The recovered GP3 and GP4 feature suites also match exactly. Their writer
left status zero on populated beats, so note presence follows the string mask
unless status explicitly says rest. GP3 fixtures have a trailing zero integer;
the reader accepts exactly that observed trailer and rejects nonzero data.
These findings are fixture evidence, not a claim of complete corpus coverage.

## 8. Chord, beat-effect and mixer records (2026-09-08)

All five revision fixtures now exercise old/new chord layouts, fade-in,
brushes, slap and tremolo-bar records, and a tempo plus volume change.
Normalized MNX equals AlphaTab for every fixture. Chord names become harmony;
diagram fingering and unsupported mixer/beat-effect data produce warnings.
Tempo changes enter the shared per-measure automation map.

The GP4/5 new-style chord record uses byte-sized root/type/extension and
alterations, seven fret integers, five barre slots, seven fingerings and a
display byte; GP3's new-style layout uses integer fields and two barre slots.
All include first-fret data before the fret list. An old-style first-fret zero
omits the six-string fret list. GP3 slap/tremolo-bar records include a four-byte
value after their kind byte. GP5.00 mix records omit the hide-tempo byte and
trailing RSE strings present in GP5.10. These distinctions are exercised by
fixture EOF checks, not guessed skips.

## 9. Tie links and source identity (2026-09-08)

The five `ties` fixtures encode a normal note followed by two tied notes,
including a barline crossing, then a dead note. **DIVERGENT:** the existing
AlphaTab-backed MNX mapper resolves the repeated fret/pitch but emits no MNX
tie links. Tests prove the missing links before correcting only the authored
two-link chain for full-document comparison. The clean-room reader retains
the chain; dead-note styling remains an explicit warning.

The binary reader resolves source IDs per track/voice/string. The shared
mapper uses that explicit ID rather than searching backward by string:
normalization can insert a same-string grace between source and destination.
An intermediate-level regression exercises this insertion for each revision
and proves the tie still starts at the principal note, not the grace. This
test is not evidence of binary multi-string-grace coverage. Rest/voice edge
cases and richer harmonic ties still need dedicated authored fixtures.

## 10. Harmonic payloads and consumer acceptance (2026-09-08)

The GP4/5 harmonic fixtures contain stopped fret 5 on the high E string,
capo 2, and artificial/tapped/semi/pinch octave harmonics. All four revisions
are accepted by installed TuxGuitar through its public reader API.
GP4 returns B5 for all four through AlphaTab. GP5 instead returns A7 for the
artificial and B7 for the tap. Its public note model reports harmonic values
9.6 and 17 respectively. PyGuitarPro's public decoded model confirms stored
artificial pitch A / octave-up and tapped fret 17. TuxGuitar decodes both
versions to the corresponding harmonic types with data zero; this does not
independently prove its playback pitch.

**DIVERGENT / authored interpretation:** preserve the octave above stopped
A4, transposed by capo 2, as B5. The tap is at fret 17 over stopped fret 5,
so its relative node is 12. Tests prove the two AlphaTab pitch differences,
correct only those fields, then require whole-document equality. GP5's three
artificial bytes and single tapped byte follow the published format reference.
GP4 discriminators 15/17/22 map to intervals 24/19/12; only the octave variant
is currently fixture-proven. Other artificial pitch/octave combinations,
tap nodes and harmonic ties remain coverage work, not established parity.
Unrecognized natural/tapped nodes warn rather than silently claiming fidelity.

The dev-time `check-binary-tuxguitar.py` opens the fixture collection through
installed TuxGuitar's Java API via JPype (no implementation reading). The run
accepted all 38 files, including recovered Binary-suite files, and printed
their SHA-256 hashes and track/measure counts. This establishes independent
consumer acceptance, not visual approval or wild-corpus robustness.

## 11. GP3 beat effects and malformed-prefix coverage (2026-09-08)

The GP3 `legacy-note-effects` fixture exercises two notes per beat with
vibrato, natural harmonic, artificial harmonic, then no effect. Beat flags
are normalized onto all notes of that beat only. **DIVERGENT:** AlphaTab's
current path loses the GP3 vibrato flag; the test proves its absence, restores
only that authored flag in the oracle, then compares the full document.
At fret 7, the GP3 artificial flag produces the stopped pitch plus 19
semitones through AlphaTab; the reader uses the fret's harmonic node interval
for this legacy form. Wider GP3 harmonic-node coverage remains needed.
TuxGuitar independently accepted the generated file (SHA-256
`f282c1c925c61b78938b54db281b15f3fc7d439b2b888d314e2a97b214996d9b`).

The recovered GP5 Binary-suite now has a whole-document parity test. The only
masked difference is its 32nd grace duration, independently covered by the
dedicated grace fixtures. Target references compare after ID normalization.

Malformed-input tests try every shorter prefix of each structural fixture
across all five revisions, requiring an Error and excluding native RangeError.
The sole valid shorter prefix is GP3 without its optional four-byte trailer.
An extra trailing byte is rejected for each revision. This is boundary evidence,
not a substitute for count/flag fuzzing or real-world corpus smoke.

## 12. Legacy ending numbers versus bitmasks (2026-09-08)

GP3/4 ending bytes encode the highest ending number, not GP5's explicit mask.
The reader expands the range through that number, subtracts endings completed
at previous repeat closes, and resets at a new repeat start. Ten fixtures cover
three consecutive endings, grouped endings 1+2, a two-bar ending, and a new
repeat group. All are accepted by TuxGuitar; 49 binary fixtures now pass that
consumer check in total.

**DIVERGENT:** AlphaTab decodes the legacy third-ending byte as mask 5
(endings 1+3); TuxGuitar and the authored score agree on mask 4 (ending 3).
The parity test proves the oracle's extra number before removing only it.
For the repeated first-ending marker in a two-bar legacy span, both consumers
decode the second marker to zero, unlike their GP5 result. The clean-room
normalizer preserves the authored two-bar span through its repeat close;
the test explicitly proves and repairs only the oracle's missing duration.
This span interpretation is authored-score evidence, not consumer agreement.

## 13. First uncommitted corpus smoke (2026-09-08)

`smoke-gp-binary.mjs` fetches 32 GP5 studies from the original `gp5/` folders
(not DadaGP-regenerated folders) of `otnemrasordep/gp-classical-guitar`, pinned
to `1a54990e905b68bdf0676bd75a1b7c013e3d5490`. Transcriptions live only in
gitignored `.gp-corpus/`; the script prints hashes, note/warning counts and
checks aligned measure counts, unique note IDs, finite pitch octaves and
resolving tie/technique targets. It is a robustness smoke, not fidelity parity.

Initially 31 files failed at the missing terminal GP5 layout byte and one
failed earlier on a tie. TuxGuitar accepts the sampled first/last studies and
the tie case. The reader now permits EOF only at the final track's final
measure layout byte; all voice/note data remains bounds-checked. Generated
GP5 tests prove dropping one terminal byte preserves the document and dropping
two still fails. The offline smoke now passes **31/32**.

**Next failure:** `brouwer_estudio16.gp5`, measure 5, track 1, voice 2, beat 1,
tie on string 3 has no earlier note in that voice. Investigate the source and
consumer models before changing tie resolution; no permissive fallback has
been added. Its SHA-256 is
`18cd8fb239d78be2fa7e9065e6da2449571f5d43dbc7e1759cb6d4a9722dc9e3`.
Older-version and multi-track wild coverage remain absent from this sample.

## 14. Orphan tie recovery and instrument tracks (2026-09-08)

Inspection of AlphaTab's public note model for the failing study shows no
cross-voice source: the first notes of measure 5 voice 2 have no tie origin
and are no longer marked as tie destinations. The reader now retains the
stored fret for such an orphan and warns that its link was dropped. It never
guesses another voice's source. Five authored orphan fixtures match the oracle
and assert the warning. The 32-score smoke consequently passes **32/32**.

Five two-track fixtures pair a four-string bass (GM instrument 33) with a
percussion track (channel 10, percussion flag). Exact oracle parity confirms
bass clef selection from the MIDI channel's instrument and percussion note
values as MIDI pitches rather than frets. Percussion does not acquire string
metadata or capo transposition. This follows the existing pitched-MNX surrogate
used by the converter; it is not new unpitched-notation support. TuxGuitar
accepts all 59 generated fixtures including these and the orphan fixtures.

## 15. Grace chords and a fixture-writer discrepancy (2026-09-08)

Equal-duration, equal-placement per-note graces on one principal beat now
form one grace chord. AlphaTab produces sequential grace events instead;
tests explicitly assert that structure before merging only the grace notes
and correcting duration for the authored GP5 32nd-note chord. Hammer targets
still resolve separately on each string. The shared mapper separates adjacent
before/on-beat grace groups rather than inheriting the first placement.
Mixed duration/placement records warn when represented as separate events;
the unrepresentable duration code 2 warns about its 32nd display approximation.
Invalid duration codes are rejected.

**Fixture caution:** PyGuitarPro's older-format writer/reader round-trips the
new chord's grace model as duration 32 / hammer, but TuxGuitar decodes those
GP3/4 bytes as duration 16 / bend. The clean-room reader follows the documented
field order, agreeing with TuxGuitar and the oracle's absent hammer targets.
Tests retain these stored semantics rather than changing the parser to follow
the writer's self-consistent round trip. A correctly authored older hammer
fixture is still needed; these files do not prove older grace-hammer support.
All 64 generated fixtures are accepted by TuxGuitar.

## 16. Legacy lyric controls (2026-09-08)

`splitBinaryLyrics` replaces whitespace-only splitting. Hyphens terminate
syllables (retaining a trailing hyphen for the shared start/middle/end mapper),
plus signs retain joined-word semantics, bracketed comments are removed, and
repeated spaces retain empty note slots. Four GP4/5 fixtures use
`Hel-lo two+words [comment]  end`; the exact oracle comparison confirms two
skipped notes before the final word across a barline. The existing spaced
`Shin- ing` fixture remains unchanged. TuxGuitar accepts all 68 fixtures.
These controls are documented by Arobas's lyric editor guide:
<https://www.guitar-pro.com/docs/gp8/score/lyrics>.

## 17. Percussion grace pitch (2026-09-08)

Five two-track fixtures now put a MIDI-36 grace before a MIDI-38 drum note,
with an ordinary bass part alongside. The regression first failed because
grace expansion stored the percussion key as a fret with no string or MIDI
pitch. It now follows the principal-note rule: percussion has `midi`, no
`string` or `fret`. MNX retains both C2 grace and D2 principal without tab data.

The fixture generator explicitly authors the grace record as `[36, 6, 0, 1]`
(key, dynamics, no transition, duration code 1), following the published format
table linked below. It asserts a unique writer-produced record before replacing
it, rather than depending on hardcoded whole-file offsets. This isolates the
GP3/4 field-order discrepancy from §15 and the writer's duration-code choice.
TuxGuitar's public reader accepts all five fixtures and confirms principal 38,
grace 36, transition 0 and stored duration 1. No consumer implementation sources
were used. These fixtures prove pitch retention, not comprehensive drum styling
or percussion playback fidelity.

## 18. Explicitly authored grace hammers (2026-09-08)

Five additional `grace-hammer` fixtures retain the original grace-chord
fixture structure but explicitly author both grace records as `[2, 6, 3, 1]`:
fret 2, dynamics 6, hammer transition 3, duration code 1. The original
writer-discrepancy files remain unchanged as separate regression evidence.
TuxGuitar confirms two principal fret-4 notes, each with the authored grace
fields, across GP3.00, GP4.00/4.06 and GP5.00/5.10. MNX tests prove a single
simultaneous grace chord with separate hammer targets on strings 1 and 2,
and no grace-loss warning. This closes the older grace-hammer evidence gap
in §15; it does not claim coverage of every grace transition or duration.

## 19. Declared-count corruption (2026-09-08)

Malformed tests observe labelled integer-read offsets on valid files, restore
the reader, then mutate only the file bytes. Every structural count encountered
in each of the five revision baselines is tested with -1 and signed-int maximum;
the parser must reject with a controlled Error, not a native RangeError. The
same mutations cover all point-list counts in both GP5 bend fixtures. These
seven tests supplement the existing exhaustive-prefix/trailing-byte checks;
they are not a claim of exhaustive flag fuzzing or resource-exhaustion proof.

## 20. Binary tie source scope (2026-09-08)

Five `tie-scope` fixtures cover a normal note, rest, and tied destination in
one measure, followed by a natural harmonic and its tied destination with
capo 2. GP5 adds another voice on the same string at a different stopped fret.
All five files pass TuxGuitar reader acceptance. MNX tests assert that each
voice keeps its own source pitch and ID, the rest is retained, and the harmonic
destination inherits MIDI 73 rather than recomputing the stopped-fret pitch.
Every non-tie-link field equals the independent AlphaTab-backed import; its
known loss of MNX tie links is the only excluded field. No parser change was
needed. This replaces the earlier intermediate-only evidence with actual
binary coverage for these source-scope cases.

## 21. Broader ecosystem corpus and combined GP5 headers (2026-09-08)

The smoke script now includes 39 binary-only ecosystem test/demo files from
`Perlence/PyGuitarPro` at `b0a74102cf25a316f2c4ae3d03ffec3c03521358`, in
addition to the 32 classical GP5 scores. Only GitHub tree metadata and binary
files were read; no reader implementation was consulted. Downloads remain
gitignored. The set includes GP3/4 features and a five-track GP5 demo (1,925
notes), but is not a statistically representative Ultimate Guitar sample.

The initial result was 66/71. Four GP4 files (Chords, Harmonics, Key, Vibrato)
end with exactly one zero integer, accepted by TuxGuitar. The parser now accepts
that specific GP4 trailer as it already does for GP3. Regression tests reject
nonzero, partial and oversized trailers rather than accepting arbitrary padding.

The fifth failure, GP5 Measure Header, combined an ending with a marker/key
change. GP5's ending mask is **after marker, key and optional four beam bytes**;
GP3/4 put their ending number before marker/key. The previous shared ordering
misread the marker length. Five generated combined-header fixtures now pin
revision-specific traversal and exact AlphaTab parity. TuxGuitar agrees.
The public writer has another ordering discrepancy: when beams are present,
it places the requested ending 1 before them, and both consumers see ending 2.
The fixture deliberately preserves those bytes and asserts their consumer
meaning; do not use the writer's requested ending as an oracle. This also
shows why successful EOF traversal alone is insufficient evidence of fidelity.

## 22. Navigation and swing loss reporting (2026-09-08)

The corpus's Directions file exposed silent musical loss: the GP5 navigation
table was skipped with no warning. Each of its 19 signed-short slots is now
read under its documented name; a value other than the absent sentinel -1
reports the stored measure and direction as unrepresented. Likewise, nonzero
GP3/4 score-level triplet feel and GP5 per-measure triplet feel now warn that
written durations are retained. This is explicit loss reporting, not navigation
or swing implementation. Five tests mutate every relevant field separately,
restore cursor observers before parsing, and assert one specific loss warning
with unchanged retained notation. The converter has 246 passing tests and the
expanded 71-file smoke still passes.

## 23. Harmonic register and node coverage (2026-09-08)

Four artificial-register fixtures exercise GP4's three legacy discriminators
and GP5's explicit pitch class, accidental and all five octave-enum values,
with stopped fret 5 and capo 2. GP4's writer translates the requested first
two registers differently from the input model; the clean-room and AlphaTab
readers agree on stored MIDI values 90, 95, 83. GP5 tests explicitly assert
the oracle's differing pitches before correcting pitch alone for comparison;
register resolution uses the explicit pitch class, octave shift and capo once.
TuxGuitar accepts all four files; its GP5 public harmonic model discards the
register details, so acceptance is not independent pitch-fidelity proof there.

Five further node fixtures exercise 12, 7, 5, 4, 9, 3 and 2, whose supported
semitone intervals are 12, 19, 24, 28, 28, 31 and 36. GP5 also carries a second
voice of tapped harmonics three frets above the open string; the tapped node
is measured from the stopped fret. Tests assert both sounding pitches and
unchanged physical fret choices with capo. TuxGuitar accepts these five files.
These tests cover the implemented node table, not arbitrary fractional nodes
or every physically possible harmonic.

## 24. Grace duration/transition matrix (2026-09-08)

Five `grace-matrix` fixtures explicitly author all 12 combinations of three
duration codes and four transition values. GP5 cycles all four dead/on-beat
flag combinations as well. The generator locates each unique writer record
before replacing any bytes, then authors only the small documented record;
this avoids the known writer field-order and duration-code discrepancies.
TuxGuitar confirms every stored fret, duration and transition in all five files.

MNX tests prove physical fret retention, separate grace/principal events,
same-string slide/hammer targets, before/on-beat placement, and display bases.
Each file warns exactly four times for duration code 2's approximation and
three times for unrepresented bend transitions; GP5 additionally reports six
dead-grace styling losses. These are tested limitations, not preservation
claims. No new parser behavior was needed for the valid matrix.

## Sources

- Arobas Music, *Guitar Pro 4.06 File Format Description* (historical official spec):
  <https://dguitar.sourceforge.net/GP4format.html>
- PyGuitarPro, *Guitar Pro File Format* (published format reference):
  <https://pyguitarpro.readthedocs.io/en/v0.5/pyguitarpro/format.html>
- alphaTab, *Guitar Pro 3–5* (coverage oracle, not an implementation source):
  <https://alphatab.net/docs/formats/guitar-pro-3-5>
