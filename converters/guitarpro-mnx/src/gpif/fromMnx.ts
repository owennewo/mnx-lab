import {
  MnxStructure,
  MnxPart,
  MnxEvent,
  MnxNote,
  MnxPitch,
  MnxNoteValueBase,
  MnxBendPoint,
  isGrace,
  isTimedEvent,
  isTuplet
} from '../common/types.js';
import {
  resolveLyricLineOrder,
  lyricSlots,
  tempoReference,
  harmonyTextByOnset,
  planUnisonCollapse
} from '../common/exportPlan.js';
import { mnxDurationToWholes, tupletFlags, wholesToFraction } from '../common/duration.js';
import { mnxTuningToAlphaTab, pitchToMidi, choosePosition } from '../common/tuning.js';
import { writeGpContainer } from './container.js';

/**
 * MNX → GPIF (`.gp`), clean-room.
 *
 * The MNX-side decisions are shared with the alphaTab-backed exporter through
 * `common/exportPlan.ts`; this file serializes them as the GPIF dialect the
 * repo has already proven Guitar Pro and alphaTab both accept — the
 * hand-authored `Triplets-and-graces` fixture (`converters/fixtures/tools/`)
 * and the shapes documented in research/gpif-field-notes.md.
 * `tests/gpif-writer-parity.test.ts` holds the output to drop-in equivalence:
 * alphaTab's reader must see exactly what it sees in `Gp7Exporter` output.
 */

export interface GpifExportOptions {
  /** Called for anything the Guitar Pro format or this converter cannot carry. */
  onWarning?: (message: string) => void;
  /** General MIDI program for tab parts (default 25, steel guitar) — Guitar
   *  Pro derives the instrument name and playback sound from it. */
  midiProgram?: number;
  /** Collapse a note written in two voices at one fingerboard position down to
   *  a single note (default true) — see `exportPlan.planUnisonCollapse`. */
  collapseTabUnisons?: boolean;
}

/** General MIDI program 25 — Acoustic Guitar (steel). */
const DEFAULT_MIDI_PROGRAM = 25;

/** Every bar declares four voice slots; unused ones are `-1`, which readers
 *  materialize as a rest voice — the shape Guitar Pro itself writes. */
const VOICE_SLOTS = 4;

const NOTE_VALUES: Partial<Record<MnxNoteValueBase, string>> = {
  whole: 'Whole',
  half: 'Half',
  quarter: 'Quarter',
  eighth: 'Eighth',
  '16th': '16th',
  '32nd': '32nd',
  '64th': '64th',
  '128th': '128th'
};

const CLEFS: Record<string, string> = { G: 'G2', F: 'F4', C: 'C3' };

const HARMONIC_TYPES: Record<string, string> = {
  natural: 'Natural',
  artificial: 'Artificial',
  pinch: 'Pinch',
  tap: 'Tap',
  semi: 'Semi',
  feedback: 'Feedback'
};

/** Slide flag bits — research/gpif-field-notes.md §8. */
const SLIDE_FLAGS = {
  shift: 0x01,
  legato: 0x02,
  outDown: 0x04,
  outUp: 0x08,
  inFromBelow: 0x10,
  inFromAbove: 0x20
};

interface WriterBend {
  originValue: number;
  originOffset: number | null;
  middleValue: number | null;
  middleOffset1: number | null;
  middleOffset2: number | null;
  destinationValue: number;
  destinationOffset: number | null;
}

interface WriterNote {
  pitch: MnxPitch;
  midi: number;
  /** GPIF string number (0 = lowest), fret capo-relative. */
  string: number;
  fret: number;
  vibrato: boolean;
  palmMute: boolean;
  hopoOrigin: boolean;
  hopoDestination: boolean;
  slideFlags: number;
  bend: WriterBend | null;
  harmonicType: string | null;
  /** The touch fret. Guitar Pro states it on every harmonic note, and alphaTab
   *  mis-pitches a harmonic that lacks it; MNX carries no touch fret, so the
   *  played fret stands in — exactly what GP itself writes for naturals. */
  harmonicFret: number | null;
}

interface WriterBeat {
  rhythmId: number;
  /** Note pool ids; null = rest. */
  noteIds: number[] | null;
  graceKind: 'BeforeBeat' | 'OnBeat' | null;
  freeText: string | null;
  lyricSlots: string[] | null;
}

interface WriterMasterBar {
  timeNumerator: number;
  timeDenominator: number;
  fifths: number;
  rehearsal: string | null;
  sectionText: string | null;
  repeatStart: boolean;
  repeatCount: number | null;
  doubleBar: boolean;
  endingNumbers: number[];
  barIds: number[];
}

interface WriterTrack {
  name: string;
  /** Open-string MIDI values, low → high (GPIF order). */
  tuningLowToHigh: number[];
  capo: number;
  program: number;
  primaryChannel: number;
}

class Pools {
  bars: { clef: string; voiceIds: number[] }[] = [];
  voices: { beatIds: number[] }[] = [];
  beats: WriterBeat[] = [];
  notes: WriterNote[] = [];
  rhythms: { value: string; dots: number; numerator: number; denominator: number }[] = [];
  private rhythmIds = new Map<string, number>();

  rhythm(value: string, dots: number, numerator: number, denominator: number): number {
    const key = `${value}|${dots}|${numerator}|${denominator}`;
    let id = this.rhythmIds.get(key);
    if (id === undefined) {
      id = this.rhythms.length;
      this.rhythms.push({ value, dots, numerator, denominator });
      this.rhythmIds.set(key, id);
    }
    return id;
  }
}

/** Converts an MNX document to a Guitar Pro (`.gp`) file without alphaTab. */
export function exportGuitarProGpif(
  mnx: MnxStructure,
  options: GpifExportOptions = {}
): Uint8Array {
  return writeGpContainer(mnxToGpifXml(mnx, options));
}

/** The GPIF XML alone — exposed for tests and debugging. */
export function mnxToGpifXml(mnx: MnxStructure, options: GpifExportOptions = {}): string {
  const warn = options.onWarning ?? (() => {});
  const pools = new Pools();

  const globalMeasures = mnx.global?.measures ?? [];
  const measureCount = Math.max(
    globalMeasures.length,
    ...mnx.parts.map(part => part.measures.length),
    1
  );

  // --- master bars: change-only MNX attributes carried forward ---
  let numerator = 4;
  let denominator = 4;
  let fifths = 0;

  // MNX states a volta once with a span; Guitar Pro flags every bar of it.
  const endingMaskByMeasure = new Map<number, number>();
  globalMeasures.forEach((globalMeasure, index) => {
    const numbers = globalMeasure.ending?.numbers;
    if (!numbers?.length) return;
    const mask = numbers.reduce((acc, n) => acc | (1 << (n - 1)), 0);
    const span = Math.max(1, globalMeasure.ending?.duration ?? 1);
    for (let offset = 0; offset < span; offset++) endingMaskByMeasure.set(index + offset, mask);
  });

  const masterBars: WriterMasterBar[] = [];
  const tempoAutomations: { bar: number; bpm: number; reference: number }[] = [];

  for (let index = 0; index < measureCount; index++) {
    const global = globalMeasures[index] ?? {};
    if (global.time) {
      numerator = global.time.count;
      denominator = global.time.unit;
    }
    if (global.key) fifths = global.key.fifths;

    const mask = endingMaskByMeasure.get(index) ?? 0;
    const endingNumbers: number[] = [];
    for (let bit = 0; bit < 8; bit++) if (mask & (1 << bit)) endingNumbers.push(bit + 1);

    masterBars.push({
      timeNumerator: numerator,
      timeDenominator: denominator,
      fifths,
      rehearsal: global.rehearsal?.label ?? null,
      sectionText: global.section?.label ?? null,
      repeatStart: global.repeatStart !== undefined,
      repeatCount: global.repeatEnd ? Math.max(2, global.repeatEnd.times ?? 2) : null,
      doubleBar: global.barline?.type === 'double',
      endingNumbers,
      barIds: []
    });

    for (const tempo of global.tempos ?? []) {
      tempoAutomations.push({ bar: index, bpm: tempo.bpm, reference: tempoReference(tempo.value) });
    }
  }

  // --- tracks ---
  const lyricLineOrder = resolveLyricLineOrder(mnx);
  const noteIdsByMnxId = new Map<string, number>();
  const hammerTargets: string[] = [];

  const tracks: WriterTrack[] = mnx.parts.map((part, trackIndex) => {
    const channel = trackIndex * 2 >= 9 ? trackIndex * 2 + 2 : trackIndex * 2;
    const tunings = mnxTuningToAlphaTab(part._x?.mnxLab?.strings); // high → low
    const track: WriterTrack = {
      name: part.name ?? 'Guitar',
      tuningLowToHigh: [...tunings].reverse(),
      capo: part._x?.mnxLab?.capo ?? 0,
      program: options.midiProgram ?? DEFAULT_MIDI_PROGRAM,
      primaryChannel: channel
    };

    buildTrackBars(
      part,
      mnx,
      trackIndex,
      measureCount,
      masterBars,
      tunings,
      track.capo,
      pools,
      lyricLineOrder,
      noteIdsByMnxId,
      hammerTargets,
      warn,
      options
    );

    return track;
  });

  // The file stores no hammer-on link; Guitar Pro marks both ends. The MNX
  // side knows the destination explicitly, so mark it rather than leave the
  // reader to re-derive one.
  for (const mnxId of hammerTargets) {
    const poolId = noteIdsByMnxId.get(mnxId);
    if (poolId !== undefined) pools.notes[poolId].hopoDestination = true;
  }

  return serialize(masterBars, tracks, tempoAutomations, pools);
}

function buildTrackBars(
  part: MnxPart,
  mnx: MnxStructure,
  trackIndex: number,
  measureCount: number,
  masterBars: WriterMasterBar[],
  tuningsHighToLow: number[],
  capo: number,
  pools: Pools,
  lyricLineOrder: string[],
  noteIdsByMnxId: Map<string, number>,
  hammerTargets: string[],
  warn: (message: string) => void,
  options: GpifExportOptions
): void {
  let clef = 'G2';

  for (let index = 0; index < measureCount; index++) {
    const measure = part.measures[index];
    if (measure?.clefs?.length) clef = CLEFS[measure.clefs[0].clef.sign ?? 'G'] ?? 'G2';

    const barId = pools.bars.length;
    const bar = { clef, voiceIds: [] as number[] };
    pools.bars.push(bar);
    masterBars[index].barIds.push(barId);

    const sequences = measure?.sequences ?? [];
    if (sequences.length === 0) {
      // Guitar Pro has no concept of an absent bar — emit a silent one.
      bar.voiceIds.push(makeRestVoice(pools, 'Quarter'));
      continue;
    }

    // A string can only be fretted once — resolve same-position unisons across
    // this measure's voices before any of them are built.
    const suppressed =
      options.collapseTabUnisons === false
        ? new Set<MnxNote>()
        : planUnisonCollapse(sequences, (stringNumber, fret) =>
            warn(
              `measure ${index + 1}: string ${stringNumber} fret ${fret} was written in ` +
                `two voices at the same time; wrote it once (it is played once). ` +
                `Pass collapseTabUnisons: false to keep both.`
            )
          );

    // Chord symbols live on the GLOBAL timeline in MNX Lab, but Guitar Pro
    // hangs them off a beat — first voice of the first track only.
    const global = mnx.global?.measures?.[index];
    const harmonyText =
      trackIndex === 0 ? harmonyTextByOnset(global?._x?.mnxLab?.harmonies) : undefined;

    for (const [voiceIndex, sequence] of sequences.entries()) {
      const voiceId = pools.voices.length;
      const voice = { beatIds: [] as number[] };
      pools.voices.push(voice);
      bar.voiceIds.push(voiceId);

      if (sequence.fullMeasure) {
        voice.beatIds.push(makeRestBeat(pools, 'Whole'));
        continue;
      }

      buildVoiceBeats(
        sequence.content ?? [],
        voice.beatIds,
        tuningsHighToLow,
        capo,
        index,
        pools,
        lyricLineOrder,
        suppressed,
        voiceIndex === 0 ? harmonyText : undefined,
        noteIdsByMnxId,
        hammerTargets,
        warn
      );

      if (voice.beatIds.length === 0) voice.beatIds.push(makeRestBeat(pools, 'Whole'));
    }
  }
}

function makeRestBeat(pools: Pools, value: string): number {
  const id = pools.beats.length;
  pools.beats.push({
    rhythmId: pools.rhythm(value, 0, 1, 1),
    noteIds: null,
    graceKind: null,
    freeText: null,
    lyricSlots: null
  });
  return id;
}

function makeRestVoice(pools: Pools, value: string): number {
  const id = pools.voices.length;
  pools.voices.push({ beatIds: [makeRestBeat(pools, value)] });
  return id;
}

function buildVoiceBeats(
  content: import('../common/types.js').MnxSequenceItem[],
  beatIds: number[],
  tuningsHighToLow: number[],
  capo: number,
  measureIndex: number,
  pools: Pools,
  lyricLineOrder: string[],
  suppressed: Set<MnxNote>,
  harmonyText: Map<string, string> | undefined,
  noteIdsByMnxId: Map<string, number>,
  hammerTargets: string[],
  warn: (message: string) => void
): void {
  let onset = 0;

  const addTimed = (
    event: MnxEvent,
    flags: { numerator: number; denominator: number } | null
  ) => {
    const beatId = buildBeat(
      event,
      flags,
      null,
      tuningsHighToLow,
      capo,
      measureIndex,
      pools,
      lyricLineOrder,
      suppressed,
      noteIdsByMnxId,
      hammerTargets,
      warn
    );
    if (beatId === null) return;
    const [n, d] = wholesToFraction(onset);
    const chord = harmonyText?.get(`${n}/${d}`);
    if (chord) pools.beats[beatId].freeText = chord;
    beatIds.push(beatId);
  };

  for (const item of content) {
    if (isGrace(item)) {
      // The graces sit ahead of their principal in both models; un-timed, so
      // `onset` does not move.
      const graceKind = item.graceType === 'stealFollowing' ? 'OnBeat' : 'BeforeBeat';
      for (const inner of item.content) {
        const beatId = buildBeat(
          inner,
          null,
          graceKind,
          tuningsHighToLow,
          capo,
          measureIndex,
          pools,
          lyricLineOrder,
          suppressed,
          noteIdsByMnxId,
          hammerTargets,
          warn
        );
        if (beatId !== null) beatIds.push(beatId);
      }
      continue;
    }

    if (isTuplet(item)) {
      // One MNX container becomes N beats each carrying the same num:den —
      // Guitar Pro's way of saying "these belong to one group".
      const flags = tupletFlags(item);
      if (!flags) {
        warn(
          `measure ${measureIndex + 1}: a tuplet whose ratio Guitar Pro cannot ` +
            `flag per beat (${item.inner.multiple}:${item.outer.multiple}) was written ` +
            `without it; its notes keep their written values.`
        );
      }
      for (const inner of item.content) {
        addTimed(inner, flags);
        onset +=
          mnxDurationToWholes(inner.duration.base, inner.duration.dots ?? 0) *
          (flags ? flags.denominator / flags.numerator : 1);
      }
      continue;
    }

    if (!isTimedEvent(item)) {
      warn(
        `measure ${measureIndex + 1}: skipped an unsupported ` +
          `"${(item as { type?: string }).type ?? 'unknown'}" container.`
      );
      continue;
    }

    addTimed(item, null);
    onset += mnxDurationToWholes(item.duration.base, item.duration.dots ?? 0);
  }
}

function buildBeat(
  event: MnxEvent,
  flags: { numerator: number; denominator: number } | null,
  graceKind: 'BeforeBeat' | 'OnBeat' | null,
  tuningsHighToLow: number[],
  capo: number,
  measureIndex: number,
  pools: Pools,
  lyricLineOrder: string[],
  suppressed: Set<MnxNote>,
  noteIdsByMnxId: Map<string, number>,
  hammerTargets: string[],
  warn: (message: string) => void
): number | null {
  const value = NOTE_VALUES[event.duration.base];
  if (value === undefined) {
    warn(
      `measure ${measureIndex + 1}: duration "${event.duration.base}" has no ` +
        `Guitar Pro equivalent; the event was skipped.`
    );
    return null;
  }

  const beat: WriterBeat = {
    rhythmId: pools.rhythm(
      value,
      event.duration.dots ?? 0,
      flags?.numerator ?? 1,
      flags?.denominator ?? 1
    ),
    noteIds: null,
    graceKind,
    freeText: null,
    lyricSlots: lyricSlots(event, lyricLineOrder)
  };
  const beatId = pools.beats.length;
  pools.beats.push(beat);

  if (event.rest || !event.notes?.length) return beatId;

  const stringCount = tuningsHighToLow.length;
  const noteIds: number[] = [];

  for (const note of event.notes) {
    if (suppressed.has(note)) continue; // already written by another voice
    const midi = pitchToMidi(note.pitch);
    const x = note._x?.mnxLab;
    // Prefer the authored fingering; fall back to a playable one so pitches
    // from non-tab documents still export.
    let position =
      x?.string !== undefined && x?.fret !== undefined
        ? { string: x.string, fret: x.fret }
        : undefined;
    if (!position) {
      const chosen = choosePosition(midi, tuningsHighToLow, 24, capo);
      if (!chosen) {
        warn(
          `measure ${measureIndex + 1}: pitch is outside the instrument's range ` +
            `on this tuning; the note was skipped.`
        );
        continue;
      }
      position = chosen;
    }

    const technique = note._x?.mnxLab?.tab?.technique;
    const writerNote: WriterNote = {
      pitch: note.pitch,
      midi,
      // MNX string 1 = highest; GPIF 0 = lowest.
      string: stringCount - position.string,
      fret: position.fret,
      vibrato: technique?.vibrato === true,
      palmMute: technique?.palmMute === true,
      hopoOrigin: technique?.hammerPull !== undefined,
      hopoDestination: false,
      slideFlags: slideFlagsOf(technique?.slide),
      bend: bendOf(technique?.bend?.points, measureIndex, warn),
      harmonicType: technique?.harmonic ? (HARMONIC_TYPES[technique.harmonic.type] ?? null) : null,
      harmonicFret: technique?.harmonic ? position.fret : null
    };

    const poolId = pools.notes.length;
    pools.notes.push(writerNote);
    noteIds.push(poolId);
    if (note.id) noteIdsByMnxId.set(note.id, poolId);
    if (technique?.hammerPull?.target) hammerTargets.push(technique.hammerPull.target);
  }

  beat.noteIds = noteIds;
  return beatId;
}

function slideFlagsOf(
  slide: { type: string; direction?: string } | undefined
): number {
  switch (slide?.type) {
    case 'shift':
      return SLIDE_FLAGS.shift;
    case 'legato':
      return SLIDE_FLAGS.legato;
    case 'slideOut':
      return slide.direction === 'down' ? SLIDE_FLAGS.outDown : SLIDE_FLAGS.outUp;
    case 'slideIn':
      return slide.direction === 'down' ? SLIDE_FLAGS.inFromAbove : SLIDE_FLAGS.inFromBelow;
    default:
      return 0;
  }
}

/**
 * The inverse of the reader's curve assembly: endpoints become origin and
 * destination values (semitones × 50 = percent of a whole tone); an interior
 * point holding the origin or destination value becomes that end's offset;
 * up to two remaining interior points become the middle. A curve more
 * elaborate than the seven floats can state is simplified with a warning.
 */
function bendOf(
  points: MnxBendPoint[] | undefined,
  measureIndex: number,
  warn: (message: string) => void
): WriterBend | null {
  if (!points?.length) return null;

  const toValue = (alter: number) => Math.round(alter * 50);
  const toOffset = (position: number) => Math.round(position * 100);

  const first = points[0];
  const last = points[points.length - 1];
  const interior = points.slice(1, -1);

  const bend: WriterBend = {
    originValue: toValue(first.alter),
    originOffset: null,
    middleValue: null,
    middleOffset1: null,
    middleOffset2: null,
    destinationValue: toValue(last.alter),
    destinationOffset: null
  };

  if (interior.length && interior[0].alter === first.alter) {
    bend.originOffset = toOffset(interior.shift()!.position);
  }
  if (interior.length && interior[interior.length - 1].alter === last.alter) {
    bend.destinationOffset = toOffset(interior.pop()!.position);
  }
  if (interior.length) {
    const [middle, extra] = interior;
    bend.middleValue = toValue(middle.alter);
    bend.middleOffset1 = toOffset(middle.position);
    if (extra && extra.alter === middle.alter) {
      bend.middleOffset2 = toOffset(extra.position);
    } else {
      bend.middleOffset2 = bend.middleOffset1;
      if (extra) {
        warn(
          `measure ${measureIndex + 1}: a bend curve with more turns than Guitar ` +
            `Pro's origin/middle/destination model was simplified.`
        );
      }
    }
  }

  return bend;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cdata(text: string): string {
  return `<![CDATA[${text.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
}

function accidentalOf(pitch: MnxPitch): string {
  switch (pitch.alter ?? 0) {
    case 1:
      return '#';
    case -1:
      return 'b';
    case 2:
      return 'x';
    case -2:
      return 'bb';
    default:
      return '';
  }
}

/** GPIF spells octaves one higher than scientific pitch notation. */
function pitchXml(name: string, pitch: MnxPitch, octaveShift: number): string {
  const accidental = accidentalOf(pitch);
  return (
    `<Property name="${name}"><Pitch>` +
    `<Step>${pitch.step}</Step>` +
    (accidental ? `<Accidental>${accidental}</Accidental>` : '<Accidental/>') +
    `<Octave>${pitch.octave + 1 + octaveShift}</Octave>` +
    `</Pitch></Property>`
  );
}

function floatProperty(name: string, value: number | null): string {
  return value === null ? '' : `<Property name="${name}"><Float>${value}</Float></Property>`;
}

function serialize(
  masterBars: WriterMasterBar[],
  tracks: WriterTrack[],
  tempoAutomations: { bar: number; bpm: number; reference: number }[],
  pools: Pools
): string {
  const lines: string[] = [];
  const push = (text: string) => lines.push(text);

  push('<?xml version="1.0" encoding="UTF-8"?>');
  push('<GPIF>');
  push('<GPVersion>8.1.3</GPVersion>');
  push('<GPRevision required="12024" recommended="13000">13007</GPRevision>');
  push('<Encoding><EncodingDescription>GP8</EncodingDescription></Encoding>');
  push(
    '<Score><Title/><SubTitle/><Artist/><Album/><Words/><Music/><WordsAndMusic/>' +
      '<Copyright/><Tabber/><Instructions/><Notices/>' +
      '<ScoreSystemsDefaultLayout>3</ScoreSystemsDefaultLayout><ScoreSystemsLayout/>' +
      '<ScoreZoomPolicy>Value</ScoreZoomPolicy><ScoreZoom>1</ScoreZoom>' +
      '<MultiVoice>0</MultiVoice></Score>'
  );

  // MasterTrack
  push('<MasterTrack>');
  push(`<Tracks>${tracks.map((_, index) => index).join(' ')}</Tracks>`);
  push('<Automations>');
  for (const automation of tempoAutomations) {
    push(
      '<Automation><Type>Tempo</Type><Linear>false</Linear>' +
        `<Bar>${automation.bar}</Bar><Position>0</Position><Visible>true</Visible>` +
        `<Value>${automation.bpm} ${automation.reference}</Value></Automation>`
    );
  }
  push('</Automations>');
  push('</MasterTrack>');

  // Tracks
  push('<Tracks>');
  for (const [index, track] of tracks.entries()) {
    push(`<Track id="${index}">`);
    push(`<Name>${cdata(track.name)}</Name>`);
    push(`<ShortName>${cdata(track.name)}</ShortName>`);
    push('<Color>200 0 0</Color>');
    push('<SystemsDefautLayout>3</SystemsDefautLayout><SystemsLayout/>');
    push('<AutoBrush/><PalmMute>0</PalmMute><PlayingStyle>StringedPick</PlayingStyle>');
    push('<UseOneChannelPerString/><IconId>1</IconId>');
    push(
      '<InstrumentSet><Name>Steel Guitar</Name><Type>steelGuitar</Type><LineCount>5</LineCount>' +
        '<Elements><Element><Name>Pitched</Name><Type>pitched</Type><SoundbankName/>' +
        '<Articulations><Articulation><Name/><StaffLine>0</StaffLine>' +
        '<Noteheads>noteheadBlack noteheadHalf noteheadWhole</Noteheads>' +
        '<TechniquePlacement>outside</TechniquePlacement><TechniqueSymbol/>' +
        '<InputMidiNumbers/><OutputRSESound/><OutputMidiNumber>0</OutputMidiNumber>' +
        '</Articulation></Articulations></Element></Elements></InstrumentSet>'
    );
    // Guitar notation sounds an octave below where it is written.
    push('<Transpose><Chromatic>0</Chromatic><Octave>-1</Octave></Transpose>');
    push('<ForcedSound>-1</ForcedSound>');
    push(
      `<MidiConnection><Port>1</Port><PrimaryChannel>${track.primaryChannel}</PrimaryChannel>` +
        `<SecondaryChannel>${track.primaryChannel + 1}</SecondaryChannel>` +
        '<ForeOneChannelPerString>false</ForeOneChannelPerString></MidiConnection>'
    );
    push('<PlaybackState>Default</PlaybackState><AudioEngineState>MIDI</AudioEngineState>');
    push('<Staves><Staff><Properties>');
    push(`<Property name="CapoFret"><Fret>${track.capo}</Fret></Property>`);
    push('<Property name="FretCount"><Fret>24</Fret></Property>');
    push(
      `<Property name="Tuning"><Pitches>${track.tuningLowToHigh.join(' ')}</Pitches>` +
        '<Label/><LabelVisible>false</LabelVisible></Property>'
    );
    push('<Property name="PartialCapoFret"><Fret>0</Fret></Property>');
    push(
      `<Property name="PartialCapoStringFlags"><Bitset>${'0'.repeat(
        Math.max(1, track.tuningLowToHigh.length)
      )}</Bitset></Property>`
    );
    push('<Property name="DiagramCollection"><Items/></Property>');
    push('</Properties></Staff></Staves>');
    push(
      `<Sounds><Sound><Name>${cdata(`Track_${index}_Initial`)}</Name>` +
        `<Label>${cdata(`Track_${index}_Initial`)}</Label>` +
        `<Path>${cdata(`Midi/${track.program}`)}</Path><Role>${cdata('Factory')}</Role>` +
        `<MIDI><LSB>0</LSB><MSB>0</MSB><Program>${track.program}</Program></MIDI></Sound></Sounds>`
    );
    push(
      '<Automations><Automation><Type>Sound</Type><Linear>false</Linear>' +
        '<Bar>0</Bar><Position>0</Position><Visible>true</Visible>' +
        `<Value>${cdata(`Midi/${track.program};Track_${index}_Initial;Factory`)}</Value>` +
        '</Automation></Automations>'
    );
    push('</Track>');
  }
  push('</Tracks>');

  // MasterBars
  push('<MasterBars>');
  for (const masterBar of masterBars) {
    push('<MasterBar>');
    push(
      `<Key><AccidentalCount>${masterBar.fifths}</AccidentalCount>` +
        '<Mode>Major</Mode><Sharps>Sharps</Sharps></Key>'
    );
    push(`<Time>${masterBar.timeNumerator}/${masterBar.timeDenominator}</Time>`);
    if (masterBar.doubleBar) push('<DoubleBar/>');
    if (masterBar.repeatStart || masterBar.repeatCount !== null) {
      push(
        `<Repeat start="${masterBar.repeatStart}" end="${masterBar.repeatCount !== null}"` +
          (masterBar.repeatCount !== null ? ` count="${masterBar.repeatCount}"` : '') +
          '/>'
      );
    }
    if (masterBar.endingNumbers.length) {
      push(`<AlternateEndings>${masterBar.endingNumbers.join(' ')}</AlternateEndings>`);
    }
    if (masterBar.rehearsal !== null || masterBar.sectionText !== null) {
      push(
        '<Section>' +
          (masterBar.rehearsal ? `<Letter>${cdata(masterBar.rehearsal)}</Letter>` : '<Letter/>') +
          (masterBar.sectionText ? `<Text>${cdata(masterBar.sectionText)}</Text>` : '<Text/>') +
          '</Section>'
      );
    }
    push(`<Bars>${masterBar.barIds.join(' ')}</Bars>`);
    push('</MasterBar>');
  }
  push('</MasterBars>');

  // Bars
  push('<Bars>');
  for (const [id, bar] of pools.bars.entries()) {
    const slots = [...bar.voiceIds];
    while (slots.length < VOICE_SLOTS) slots.push(-1);
    push(
      `<Bar id="${id}"><Clef>${bar.clef}</Clef><Voices>${slots.join(' ')}</Voices></Bar>`
    );
  }
  push('</Bars>');

  // Voices
  push('<Voices>');
  for (const [id, voice] of pools.voices.entries()) {
    push(`<Voice id="${id}"><Beats>${voice.beatIds.join(' ')}</Beats></Voice>`);
  }
  push('</Voices>');

  // Beats
  push('<Beats>');
  for (const [id, beat] of pools.beats.entries()) {
    push(`<Beat id="${id}">`);
    push('<Dynamic>MF</Dynamic>');
    push(`<Rhythm ref="${beat.rhythmId}"/>`);
    if (beat.graceKind) push(`<GraceNotes>${beat.graceKind}</GraceNotes>`);
    if (beat.freeText !== null) push(`<FreeText>${cdata(beat.freeText)}</FreeText>`);
    push('<ConcertPitchStemOrientation>Undefined</ConcertPitchStemOrientation>');
    if (beat.noteIds?.length) push(`<Notes>${beat.noteIds.join(' ')}</Notes>`);
    push('<Properties/><XProperties/>');
    if (beat.lyricSlots) {
      push(
        '<Lyrics>' +
          beat.lyricSlots.map(slot => (slot ? `<Line>${cdata(slot)}</Line>` : '<Line/>')).join('') +
          '</Lyrics>'
      );
    }
    push('</Beat>');
  }
  push('</Beats>');

  // Notes
  push('<Notes>');
  for (const [id, note] of pools.notes.entries()) {
    push(`<Note id="${id}">`);
    push('<Properties>');
    push(pitchXml('ConcertPitch', note.pitch, 0));
    push(pitchXml('TransposedPitch', note.pitch, 1));
    push(`<Property name="String"><String>${note.string}</String></Property>`);
    push(`<Property name="Fret"><Fret>${note.fret}</Fret></Property>`);
    push(`<Property name="Midi"><Number>${note.midi}</Number></Property>`);
    if (note.palmMute) push('<Property name="PalmMuted"><Enable/></Property>');
    if (note.hopoOrigin) push('<Property name="HopoOrigin"><Enable/></Property>');
    if (note.hopoDestination) push('<Property name="HopoDestination"><Enable/></Property>');
    if (note.slideFlags) {
      push(`<Property name="Slide"><Flags>${note.slideFlags}</Flags></Property>`);
    }
    if (note.harmonicType) {
      push(`<Property name="HarmonicType"><HType>${escapeXml(note.harmonicType)}</HType></Property>`);
      if (note.harmonicFret !== null) {
        push(`<Property name="HarmonicFret"><HFret>${note.harmonicFret}</HFret></Property>`);
      }
    }
    if (note.bend) {
      push('<Property name="Bended"><Enable/></Property>');
      push(floatProperty('BendOriginValue', note.bend.originValue));
      push(floatProperty('BendOriginOffset', note.bend.originOffset));
      push(floatProperty('BendMiddleValue', note.bend.middleValue));
      push(floatProperty('BendMiddleOffset1', note.bend.middleOffset1));
      push(floatProperty('BendMiddleOffset2', note.bend.middleOffset2));
      push(floatProperty('BendDestinationValue', note.bend.destinationValue));
      push(floatProperty('BendDestinationOffset', note.bend.destinationOffset));
    }
    push('</Properties>');
    if (note.vibrato) push('<Vibrato>Slight</Vibrato>');
    push('<InstrumentArticulation>0</InstrumentArticulation>');
    push('</Note>');
  }
  push('</Notes>');

  // Rhythms
  push('<Rhythms>');
  for (const [id, rhythm] of pools.rhythms.entries()) {
    push(`<Rhythm id="${id}">`);
    if (rhythm.numerator !== 1 || rhythm.denominator !== 1) {
      push(`<PrimaryTuplet num="${rhythm.numerator}" den="${rhythm.denominator}"/>`);
    }
    push(`<NoteValue>${rhythm.value}</NoteValue>`);
    if (rhythm.dots > 0) push(`<AugmentationDot count="${rhythm.dots}"/>`);
    push('</Rhythm>');
  }
  push('</Rhythms>');

  push('</GPIF>');
  return lines.join('\n');
}
