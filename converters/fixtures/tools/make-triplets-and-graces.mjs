#!/usr/bin/env node
/**
 * Authors `converters/fixtures/Triplets-and-graces.gp`.
 *
 * WHY THIS ONE IS GENERATED AND THE OTHERS ARE NOT
 *
 * The corpus rule is that Guitar Pro is the SOURCE: `House-of-the-Rising-Sun`,
 * `Sun-did-glide` and `Vestapol` were authored in the app as `.gpx` (GP6's
 * BCFS container) and everything else is derived from them. None of the three
 * contains a tuplet or a grace note, which is precisely why neither converter
 * carried either — the round trips were honestly lossless on material that
 * never presented the case (roadmap/.../core-tuplets-grace-notes.md).
 *
 * Closing that gap needs a fixture that does present it, and this one is
 * written here rather than exported from the app. That is a deliberate
 * trade, and the thing it must not become is a fixture that agrees with our
 * converter because our converter wrote it. Two properties keep it honest:
 *
 *  - It is a real Guitar Pro file, not a private format. `.gp` is GP7/GP8's
 *    native container — a zip whose `Content/score.gpif` is the GPIF XML the
 *    app itself writes — and the XML below is emitted directly, not through
 *    `exportGuitarPro`. alphaTab parses it with the same production GPIF
 *    reader that opens a file a musician saved, so the import path under test
 *    is the real one.
 *  - Nothing in `src/` is imported. The pitches, string numbers and tuplet
 *    ratios here are written out longhand in Guitar Pro's own terms (GPIF
 *    strings are 0-based from the LOWEST string, the opposite end from
 *    `_x.mnxLab`), so a sign error in `common/tuning.ts` cannot cancel itself
 *    out against this file.
 *
 * The music is four bars of ordinary guitar writing, each bar carrying one
 * thing the other fixtures cannot:
 *
 *   1. four plain quarter notes           — the control: unflagged beats
 *   2. two 3:2 eighth triplets, then two quarters
 *   3. an acciaccatura before a chord, then a 3:2 QUARTER triplet
 *   4. a whole-note E chord               — the control: a six-note chord
 *
 * Bar 3 is the load-bearing one: the grace is `BeforeBeat` (the slashed
 * acciaccatura that is most of guitar idiom), and its quarter triplet spans a
 * half note, so a converter that assumes tuplets are always eighths fails
 * here. Bar 2's triplets sit next to plain quarters in the same bar, so a
 * converter that flags a whole bar rather than a run fails there.
 *
 * Regenerate:  node converters/fixtures/tools/make-triplets-and-graces.mjs
 * Then rederive the two downstream faces, which is what the corpus rule says:
 *   npx guitarpro-mnx --import converters/fixtures/Triplets-and-graces.gp
 *   npx musicxml-mnx  --export converters/fixtures/Triplets-and-graces.mnx.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storedZip } from './zip.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', 'Triplets-and-graces.gp');

/** Standard tuning, written the way GPIF writes it: LOW string first. */
const TUNING_LOW_TO_HIGH = [40, 45, 50, 55, 59, 64];

/**
 * A fingerboard position in GUITAR PRO's numbering: `string` is 0-based from
 * the lowest string (0 = low E), which is the opposite end from `_x.mnxLab`.
 * Deliberately not converted here — see the header.
 */
const at = (string, fret) => ({ string, fret });

/**
 * Beats, in document order. `tuplet: [num, den]` flags the beat the way Guitar
 * Pro does — per beat, not per group — and `grace` marks an un-timed beat.
 */
const BARS = [
  [
    { value: 'Quarter', notes: [at(1, 3)] },
    { value: 'Quarter', notes: [at(2, 2)] },
    { value: 'Quarter', notes: [at(3, 0)] },
    { value: 'Quarter', notes: [at(4, 1)] }
  ],
  [
    { value: 'Eighth', tuplet: [3, 2], notes: [at(3, 0)] },
    { value: 'Eighth', tuplet: [3, 2], notes: [at(4, 0)] },
    { value: 'Eighth', tuplet: [3, 2], notes: [at(5, 0)] },
    { value: 'Eighth', tuplet: [3, 2], notes: [at(5, 0)] },
    { value: 'Eighth', tuplet: [3, 2], notes: [at(4, 0)] },
    { value: 'Eighth', tuplet: [3, 2], notes: [at(3, 0)] },
    { value: 'Quarter', notes: [at(4, 1)] },
    { value: 'Quarter', notes: [at(3, 0)] }
  ],
  [
    // Written as an eighth because that is what an acciaccatura IS on the
    // page — and because alphaTab normalises a grace beat's value by group
    // size anyway (1 grace = eighth, 2 = sixteenth, 3+ = thirty-second), so
    // authoring anything else here would be a value the reader never sees.
    { value: 'Eighth', grace: 'BeforeBeat', notes: [at(3, 1)] },
    { value: 'Quarter', notes: [at(3, 2), at(4, 3)] },
    { value: 'Quarter', notes: [at(2, 0)] },
    { value: 'Quarter', tuplet: [3, 2], notes: [at(1, 3)] },
    { value: 'Quarter', tuplet: [3, 2], notes: [at(2, 2)] },
    { value: 'Quarter', tuplet: [3, 2], notes: [at(2, 0)] }
  ],
  [
    {
      value: 'Whole',
      notes: [at(0, 0), at(1, 2), at(2, 2), at(3, 1), at(4, 0), at(5, 0)]
    }
  ]
];

// ---------- GPIF assembly ----------

const STEPS = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const ALTERS = ['', '#', '', '#', '', '', '#', '', '#', '', '#', ''];

/** GPIF spells a note twice: concert and transposed. Guitars notate 8va. */
function pitchXml(midi, octaveShift) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1 + octaveShift;
  return (
    `<Pitch><Step>${STEPS[pc]}</Step>` +
    `<Accidental>${ALTERS[pc]}</Accidental>` +
    `<Octave>${octave}</Octave></Pitch>`
  );
}

const notes = [];
const rhythms = [];
const rhythmIds = new Map();
const beats = [];
const voices = [];
const bars = [];

/** Rhythms are shared by value in GPIF; the same (value, tuplet) reuses an id. */
function rhythmId(value, tuplet) {
  const key = tuplet ? `${value}:${tuplet[0]}:${tuplet[1]}` : value;
  if (!rhythmIds.has(key)) {
    const id = rhythms.length;
    rhythmIds.set(key, id);
    rhythms.push(
      `<Rhythm id="${id}">` +
        (tuplet ? `<PrimaryTuplet num="${tuplet[0]}" den="${tuplet[1]}"/>` : '') +
        `<NoteValue>${value}</NoteValue>` +
        `</Rhythm>`
    );
  }
  return rhythmIds.get(key);
}

for (const [barIndex, barBeats] of BARS.entries()) {
  const beatIds = [];

  for (const beat of barBeats) {
    const noteIds = [];
    for (const position of beat.notes) {
      const midi = TUNING_LOW_TO_HIGH[position.string] + position.fret;
      noteIds.push(notes.length);
      notes.push(
        `<Note id="${notes.length}"><Properties>` +
          `<Property name="ConcertPitch">${pitchXml(midi, 0)}</Property>` +
          `<Property name="TransposedPitch">${pitchXml(midi, 1)}</Property>` +
          `<Property name="String"><String>${position.string}</String></Property>` +
          `<Property name="Fret"><Fret>${position.fret}</Fret></Property>` +
          `<Property name="Midi"><Number>${midi}</Number></Property>` +
          `</Properties><InstrumentArticulation>0</InstrumentArticulation></Note>`
      );
    }

    beatIds.push(beats.length);
    beats.push(
      `<Beat id="${beats.length}"><Dynamic>MF</Dynamic>` +
        `<Rhythm ref="${rhythmId(beat.value, beat.tuplet)}"/>` +
        (beat.grace ? `<GraceNotes>${beat.grace}</GraceNotes>` : '') +
        `<ConcertPitchStemOrientation>Undefined</ConcertPitchStemOrientation>` +
        (noteIds.length ? `<Notes>${noteIds.join(' ')}</Notes>` : '') +
        `<Properties/><XProperties/></Beat>`
    );
  }

  // One voice per bar; the other three slots stay empty, as Guitar Pro writes
  // them for a single-voice part.
  const voiceId = voices.length;
  voices.push(`<Voice id="${voiceId}"><Beats>${beatIds.join(' ')}</Beats></Voice>`);
  bars.push(`<Bar id="${barIndex}"><Voices>${voiceId} -1 -1 -1</Voices><Clef>G2</Clef></Bar>`);
}

const masterBars = BARS.map(
  (_, index) =>
    `<MasterBar><Key><AccidentalCount>0</AccidentalCount><Mode>Major</Mode>` +
    `<Sharps>Sharps</Sharps></Key><Time>4/4</Time><Bars>${index}</Bars></MasterBar>`
).join('');

const track =
  `<Track id="0"><Name><![CDATA[Guitar]]></Name>` +
  `<ShortName><![CDATA[Guitar]]></ShortName><Color>200 0 0</Color>` +
  `<SystemsDefautLayout>3</SystemsDefautLayout><SystemsLayout></SystemsLayout>` +
  `<AutoBrush/><PalmMute>0</PalmMute><PlayingStyle>StringedPick</PlayingStyle>` +
  `<UseOneChannelPerString/><IconId>1</IconId>` +
  `<InstrumentSet><Name>Steel Guitar</Name><Type>steelGuitar</Type>` +
  `<LineCount>5</LineCount><Elements><Element><Name>Pitched</Name>` +
  `<Type>pitched</Type><SoundbankName></SoundbankName><Articulations>` +
  `<Articulation><Name></Name><StaffLine>0</StaffLine>` +
  `<Noteheads>noteheadBlack noteheadHalf noteheadWhole</Noteheads>` +
  `<TechniquePlacement>outside</TechniquePlacement><TechniqueSymbol></TechniqueSymbol>` +
  `<InputMidiNumbers></InputMidiNumbers><OutputRSESound></OutputRSESound>` +
  `<OutputMidiNumber>0</OutputMidiNumber></Articulation></Articulations>` +
  `</Element></Elements></InstrumentSet>` +
  `<Transpose><Chromatic>0</Chromatic><Octave>-1</Octave></Transpose>` +
  `<ForcedSound>-1</ForcedSound>` +
  `<MidiConnection><Port>1</Port><PrimaryChannel>0</PrimaryChannel>` +
  `<SecondaryChannel>1</SecondaryChannel>` +
  `<ForeOneChannelPerString>false</ForeOneChannelPerString></MidiConnection>` +
  `<PlaybackState>Default</PlaybackState><AudioEngineState>MIDI</AudioEngineState>` +
  `<Staves><Staff><Properties>` +
  `<Property name="CapoFret"><Fret>0</Fret></Property>` +
  `<Property name="FretCount"><Fret>24</Fret></Property>` +
  `<Property name="Tuning"><Pitches>${TUNING_LOW_TO_HIGH.join(' ')}</Pitches>` +
  `<Label><![CDATA[]]></Label><LabelVisible>false</LabelVisible></Property>` +
  `<Property name="PartialCapoFret"><Fret>0</Fret></Property>` +
  `<Property name="PartialCapoStringFlags"><Bitset>000000</Bitset></Property>` +
  `<Property name="DiagramCollection"><Items/></Property>` +
  `</Properties></Staff></Staves></Track>`;

const gpif =
  `<?xml version="1.0" encoding="utf-8"?><GPIF>` +
  `<GPVersion>8.1.3</GPVersion>` +
  `<GPRevision required="12024" recommended="13000">13007</GPRevision>` +
  `<Encoding><EncodingDescription>GP8</EncodingDescription></Encoding>` +
  `<Score><Title><![CDATA[Triplets and graces]]></Title>` +
  `<SubTitle><![CDATA[]]></SubTitle><Artist><![CDATA[]]></Artist>` +
  `<Album><![CDATA[]]></Album><Words><![CDATA[]]></Words>` +
  `<Music><![CDATA[]]></Music><WordsAndMusic><![CDATA[]]></WordsAndMusic>` +
  `<Copyright><![CDATA[]]></Copyright><Tabber><![CDATA[]]></Tabber>` +
  `<Instructions><![CDATA[]]></Instructions><Notices><![CDATA[]]></Notices>` +
  `<ScoreSystemsDefaultLayout><![CDATA[3]]></ScoreSystemsDefaultLayout>` +
  `<ScoreSystemsLayout><![CDATA[]]></ScoreSystemsLayout>` +
  `<ScoreZoomPolicy>Value</ScoreZoomPolicy><ScoreZoom>1</ScoreZoom>` +
  `<MultiVoice>0</MultiVoice></Score>` +
  `<MasterTrack><Tracks>0</Tracks><Automations><Automation>` +
  `<Type>Tempo</Type><Linear>false</Linear><Bar>0</Bar><Position>0</Position>` +
  `<Visible>true</Visible><Value>120 2</Value></Automation></Automations></MasterTrack>` +
  `<AudioTracks/>` +
  `<Tracks>${track}</Tracks>` +
  `<MasterBars>${masterBars}</MasterBars>` +
  `<Bars>${bars.join('')}</Bars>` +
  `<Voices>${voices.join('')}</Voices>` +
  `<Beats>${beats.join('')}</Beats>` +
  `<Notes>${notes.join('')}</Notes>` +
  `<Rhythms>${rhythms.join('')}</Rhythms>` +
  `</GPIF>`;

fs.writeFileSync(
  OUT,
  storedZip([
    { name: 'VERSION', data: '7.0' },
    { name: 'Content/score.gpif', data: gpif }
  ])
);
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${fs.statSync(OUT).size} bytes)`);
