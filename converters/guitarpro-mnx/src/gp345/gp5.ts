import {
  GpifBar,
  GpifBeat,
  GpifDocument,
  GpifMasterBar,
  GpifNote,
  GpifRhythm,
  GpifTrack,
  GpifVoice
} from '../gpif/document.js';
import { gpifToMnx, GpifImportOptions } from '../gpif/toMnx.js';
import { MnxNoteValueBase, MnxStructure } from '../common/types.js';
import { GpBinaryReader } from './binary.js';
import { readGpBinaryPreambleFromReader } from './song.js';

interface ParsedTrack {
  gpif: GpifTrack;
  stringCount: number;
  clef: string;
}

interface LegacyLyricLine {
  startingMeasure: number;
  text: string;
}

interface LegacyLyrics {
  /** GP stores this as a 1-based track number; zero means unbound. */
  trackChoice: number;
  lines: LegacyLyricLine[];
}

const DURATION_BASES = new Map<number, MnxNoteValueBase>([
  [-2, 'whole'],
  [-1, 'half'],
  [0, 'quarter'],
  [1, 'eighth'],
  [2, '16th'],
  [3, '32nd'],
  [4, '64th'],
  [5, '128th']
]);

/**
 * Clean-room GP5.00/5.10 baseline reader.
 *
 * This slice covers structural score data, tracks/tunings/capo, two voice
 * slots, ordinary notes and rests, dots, tuplets, marker text, track-level
 * lyrics, simple note techniques, and initial tempo. The remaining
 * variable-length effect records are refused precisely until their feature
 * fixtures land; they are never guessed or silently skipped.
 */
export function parseGuitarPro5(data: Uint8Array, options: GpifImportOptions = {}): GpifDocument {
  const reader = new GpBinaryReader(data);
  const { version } = readGpBinaryPreambleFromReader(reader);
  if (version.major !== 5) {
    throw new Error(`GP5 reader cannot read ${version.raw}`);
  }

  const warn = options.onWarning ?? (() => {});
  const lyrics = readLyrics(reader);

  if (version.revision > 0) {
    reader.skip(4, 'RSE master volume');
    reader.skip(4, 'RSE master reserved value');
    reader.skip(11, 'RSE master equalizer');
  }
  skipPageSetup(reader);

  reader.readIntByteSizeString('tempo name');
  const tempo = reader.readInt32('tempo');
  if (version.revision > 0) reader.readBool('hide tempo');
  const initialFifths = reader.readInt8('initial key');
  reader.skip(4, 'octave');
  skipMidiChannels(reader);
  reader.skip(19 * 2, 'directions');
  reader.skip(4, 'master reverb');

  const measureCount = checkedCount(reader.readInt32('measure count'), 'measure', 100_000);
  const trackCount = checkedCount(reader.readInt32('track count'), 'track', 1_000);
  const masterBars = readMeasureHeaders(reader, measureCount, trackCount, initialFifths, tempo);
  const tracks = Array.from({ length: trackCount }, (_, index) =>
    readTrack(reader, index, version.revision)
  );
  reader.skip(version.revision === 0 ? 2 : 1, 'post-track padding');

  const bars = new Map<number, GpifBar>();
  const primaryVoiceByBar = new Map<number, number>();
  const voices = new Map<number, GpifVoice>();
  const beats = new Map<number, GpifBeat>();
  const notes = new Map<number, GpifNote>();
  const rhythms = new Map<number, GpifRhythm>();
  const ids = { voice: 0, beat: 0, note: 0, rhythm: 0 };

  for (let measureIndex = 0; measureIndex < measureCount; measureIndex++) {
    for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
      const barId = measureIndex * trackCount + trackIndex;
      const track = tracks[trackIndex];
      const voiceIds: number[] = [];

      for (let voiceSlot = 0; voiceSlot < 2; voiceSlot++) {
        const beatCount = checkedCount(
          reader.readInt32(`measure ${measureIndex + 1} track ${trackIndex + 1} voice ${voiceSlot + 1} beat count`),
          'beat',
          100_000
        );
        if (beatCount === 0) continue;

        const voiceId = ids.voice++;
        const beatIds: number[] = [];
        voiceIds.push(voiceId);
        if (voiceSlot === 0) primaryVoiceByBar.set(barId, voiceId);
        for (let beatIndex = 0; beatIndex < beatCount; beatIndex++) {
          beatIds.push(
            readBeat(reader, track, notes, rhythms, beats, ids, {
              measure: measureIndex + 1,
              track: trackIndex + 1,
              voice: voiceSlot + 1,
              beat: beatIndex + 1
            }, warn)
          );
        }
        voices.set(voiceId, { beatIds });
      }

      reader.skip(1, `measure ${measureIndex + 1} track ${trackIndex + 1} line break`);
      bars.set(barId, { voiceIds, clef: track.clef });
    }
  }

  attachLyrics(lyrics, masterBars, primaryVoiceByBar, voices, beats, trackCount, warn);

  if (reader.remaining !== 0) {
    throw new Error(`GP5 score has ${reader.remaining} unconsumed bytes at 0x${reader.offset.toString(16)}`);
  }

  return {
    masterBars,
    tracks: tracks.map(track => track.gpif),
    bars,
    voices,
    beats,
    notes,
    rhythms,
    tempoAutomations: new Map([[0, [tempo, tempo]]])
  };
}

export function importGuitarPro5(
  data: Uint8Array,
  options: GpifImportOptions = {}
): MnxStructure {
  return gpifToMnx(parseGuitarPro5(data, options), options);
}

function readLyrics(reader: GpBinaryReader): LegacyLyrics {
  return {
    trackChoice: reader.readInt32('lyrics track'),
    lines: Array.from({ length: 5 }, (_, index) => ({
      startingMeasure: reader.readInt32(`lyric line ${index + 1} starting measure`),
      text: reader.readIntSizeString(`lyric line ${index + 1}`)
    }))
  };
}

/**
 * Legacy lyrics are five whitespace-delimited text streams, not per-beat
 * records. Mirror the GP3–5 consumer convention: starting at each line's
 * 1-based measure, attach chunks to voice slot zero and skip rests.
 */
function attachLyrics(
  lyrics: LegacyLyrics,
  masterBars: GpifMasterBar[],
  primaryVoiceByBar: Map<number, number>,
  voices: Map<number, GpifVoice>,
  beats: Map<number, GpifBeat>,
  trackCount: number,
  warn: (message: string) => void
): void {
  if (!lyrics.lines.some(line => line.text.trim())) return;
  const trackIndex = lyrics.trackChoice - 1;
  if (trackIndex < 0 || trackIndex >= trackCount) {
    warn(`GP5 lyrics target invalid track ${lyrics.trackChoice}; lyrics were not attached.`);
    return;
  }

  lyrics.lines.forEach((line, lineIndex) => {
    const chunks = line.text.trim().split(/\s+/).filter(Boolean);
    if (chunks.length === 0) return;
    const start = Math.max(0, line.startingMeasure - 1);

    for (let measureIndex = start; measureIndex < masterBars.length && chunks.length > 0; measureIndex++) {
      const barId = masterBars[measureIndex].barIds[trackIndex];
      const voiceId = primaryVoiceByBar.get(barId) ?? -1;
      if (voiceId < 0) continue;
      for (const beatId of voices.get(voiceId)?.beatIds ?? []) {
        if (chunks.length === 0) break;
        const beat = beats.get(beatId);
        if (!beat?.noteIds?.length) continue;
        const slots = beat.lyricLines ?? [];
        while (slots.length <= lineIndex) slots.push('');
        slots[lineIndex] = chunks.shift()!;
        beat.lyricLines = slots;
      }
    }

    if (chunks.length > 0) {
      warn(
        `GP5 lyric line ${lineIndex + 1} has ${chunks.length} syllable(s) beyond the score; ` +
          'the trailing text was not attached.'
      );
    }
  });
}

function skipPageSetup(reader: GpBinaryReader): void {
  reader.skip(2 * 4, 'page size');
  reader.skip(4 * 4, 'page margins');
  reader.skip(4, 'score size proportion');
  reader.skip(2, 'header and footer flags');
  for (const field of [
    'title',
    'subtitle',
    'artist',
    'album',
    'words',
    'music',
    'words and music',
    'copyright line 1',
    'copyright line 2',
    'page number'
  ]) {
    reader.readIntByteSizeString(`page ${field}`);
  }
}

function skipMidiChannels(reader: GpBinaryReader): void {
  for (let index = 0; index < 64; index++) {
    reader.skip(4, `MIDI channel ${index + 1} instrument`);
    reader.skip(8, `MIDI channel ${index + 1} controls`);
  }
}

function readMeasureHeaders(
  reader: GpBinaryReader,
  measureCount: number,
  trackCount: number,
  initialFifths: number,
  tempo: number
): GpifMasterBar[] {
  const result: GpifMasterBar[] = [];
  let numerator = 4;
  let denominator = 4;
  let fifths = initialFifths;

  for (let index = 0; index < measureCount; index++) {
    if (index > 0) reader.skip(1, `measure ${index + 1} leading padding`);
    const flags = reader.readUint8(`measure ${index + 1} flags`);
    if (flags & 0x01) numerator = reader.readInt8(`measure ${index + 1} numerator`);
    if (flags & 0x02) denominator = reader.readInt8(`measure ${index + 1} denominator`);
    const repeatCount = flags & 0x08
      ? reader.readUint8(`measure ${index + 1} repeat count`)
      : null;
    const alternateEndingsMask = flags & 0x10
      ? reader.readUint8(`measure ${index + 1} alternate endings`)
      : 0;

    let sectionText: string | null = null;
    if (flags & 0x20) {
      sectionText = reader.readIntByteSizeString(`measure ${index + 1} marker`);
      reader.skip(4, `measure ${index + 1} marker color`);
    }

    const declaresKey = Boolean(flags & 0x40);
    if (declaresKey) {
      fifths = reader.readInt8(`measure ${index + 1} key`);
      reader.skip(1, `measure ${index + 1} key mode`);
    }
    if (flags & 0x03) reader.skip(4, `measure ${index + 1} time-signature beams`);
    if (!(flags & 0x10)) reader.skip(1, `measure ${index + 1} alternate-ending padding`);
    reader.skip(1, `measure ${index + 1} triplet feel`);

    result.push({
      barIds: Array.from({ length: trackCount }, (_, track) => index * trackCount + track),
      timeNumerator: numerator,
      timeDenominator: denominator,
      fifths: index === 0 || declaresKey ? fifths : null,
      repeatStart: Boolean(flags & 0x04),
      repeatCount,
      doubleBar: Boolean(flags & 0x80),
      sectionLetter: null,
      sectionText,
      alternateEndingsMask
    });
  }

  return result;
}

function readTrack(reader: GpBinaryReader, index: number, revision: number): ParsedTrack {
  if (index === 0 || revision === 0) reader.skip(1, `track ${index + 1} leading padding`);
  reader.readUint8(`track ${index + 1} flags`);
  const name = reader.readByteSizeString(`track ${index + 1} name`, 40);
  const stringCount = checkedCount(reader.readInt32(`track ${index + 1} string count`), 'string', 7);
  const tuningHighToLow = Array.from({ length: 7 }, (_, string) =>
    reader.readInt32(`track ${index + 1} tuning ${string + 1}`)
  );
  reader.skip(4, `track ${index + 1} MIDI port`);
  reader.skip(4, `track ${index + 1} MIDI channel`);
  reader.skip(4, `track ${index + 1} MIDI effect channel`);
  reader.skip(4, `track ${index + 1} fret count`);
  const capo = reader.readInt32(`track ${index + 1} capo`);
  reader.skip(4, `track ${index + 1} color`);
  reader.skip(2, `track ${index + 1} display flags`);
  reader.skip(1, `track ${index + 1} auto accentuation`);
  reader.skip(1, `track ${index + 1} MIDI bank`);
  reader.skip(1, `track ${index + 1} humanize`);
  const clefTranspose = reader.readInt32(`track ${index + 1} clef transpose`);
  reader.skip(4, `track ${index + 1} secondary clef transpose`);
  reader.skip(4, `track ${index + 1} RSE sentinel`);
  reader.skip(12, `track ${index + 1} RSE reserved values`);
  reader.skip(12, `track ${index + 1} RSE instrument`);
  if (revision === 0) {
    reader.skip(2, `track ${index + 1} RSE effect number`);
    reader.skip(1, `track ${index + 1} RSE effect padding`);
  } else {
    reader.skip(4, `track ${index + 1} RSE effect number`);
    reader.skip(4, `track ${index + 1} RSE equalizer`);
    reader.readIntByteSizeString(`track ${index + 1} RSE effect name`);
    reader.readIntByteSizeString(`track ${index + 1} RSE effect category`);
  }

  return {
    gpif: {
      name,
      tuningLowToHigh: tuningHighToLow.slice(0, stringCount).reverse(),
      capo,
      chordNames: new Map()
    },
    stringCount,
    clef: clefTranspose >= 12 ? 'F4' : 'G2'
  };
}

function readBeat(
  reader: GpBinaryReader,
  track: ParsedTrack,
  notes: Map<number, GpifNote>,
  rhythms: Map<number, GpifRhythm>,
  beats: Map<number, GpifBeat>,
  ids: { beat: number; note: number; rhythm: number },
  at: { measure: number; track: number; voice: number; beat: number },
  warn: (message: string) => void
): number {
  const where = `measure ${at.measure} track ${at.track} voice ${at.voice} beat ${at.beat}`;
  const flags = reader.readUint8(`${where} flags`);
  const status = flags & 0x40 ? reader.readUint8(`${where} status`) : 1;
  const durationCode = reader.readInt8(`${where} duration`);
  const base = DURATION_BASES.get(durationCode);
  if (!base) throw new Error(`${where}: unsupported duration code ${durationCode}`);
  const tuplet = flags & 0x20 ? reader.readInt32(`${where} tuplet`) : 1;

  if (flags & 0x02) throw unsupported(reader, where, 'chord diagrams');
  const freeText = flags & 0x04 ? reader.readIntByteSizeString(`${where} text`) : null;
  if (flags & 0x08) throw unsupported(reader, where, 'beat effects');
  if (flags & 0x10) throw unsupported(reader, where, 'mix-table changes');

  const playedStrings = reader.readUint8(`${where} played strings`);
  const noteIds: number[] = [];
  for (let sourceString = 1; sourceString <= 7; sourceString++) {
    const mask = 1 << (7 - sourceString);
    if (!(playedStrings & mask)) continue;
    if (sourceString > track.stringCount) {
      throw new Error(`${where}: note uses string ${sourceString}, track has ${track.stringCount}`);
    }
    const noteId = ids.note++;
    notes.set(noteId, readNote(reader, track, sourceString, where, warn));
    noteIds.push(noteId);
  }

  const displayFlags = reader.readUint16(`${where} display flags`);
  if (displayFlags & 0x0800) reader.skip(1, `${where} secondary beam break`);

  const rhythmId = ids.rhythm++;
  rhythms.set(rhythmId, {
    base,
    dots: flags & 0x01 ? 1 : 0,
    tupletNumerator: tuplet,
    tupletDenominator: tupletDenominator(tuplet)
  });
  const beatId = ids.beat++;
  beats.set(beatId, {
    rhythmRef: rhythmId,
    noteIds: status === 1 && noteIds.length > 0 ? noteIds : null,
    graceKind: null,
    freeText,
    chordId: null,
    lyricLines: null
  });
  return beatId;
}

function readNote(
  reader: GpBinaryReader,
  track: ParsedTrack,
  sourceString: number,
  where: string,
  warn: (message: string) => void
): GpifNote {
  const flags = reader.readUint8(`${where} string ${sourceString} note flags`);
  let type = 1;
  let fret = 0;
  if (flags & 0x20) {
    type = reader.readUint8(`${where} string ${sourceString} note type`);
  }
  if (flags & 0x10) reader.skip(1, `${where} string ${sourceString} dynamics`);
  if (flags & 0x20) fret = reader.readInt8(`${where} string ${sourceString} fret`);
  if (flags & 0x80) reader.skip(2, `${where} string ${sourceString} fingering`);
  if (flags & 0x01) reader.skip(8, `${where} string ${sourceString} duration percent`);
  reader.skip(1, `${where} string ${sourceString} accidental flags`);
  const effects = flags & 0x08
    ? readNoteEffects(reader, where, sourceString, warn)
    : { vibrato: false, palmMute: false, hopoOrigin: false, slideFlags: null, harmonicType: null };
  if (type !== 1) throw unsupported(reader, where, `note type ${type}`);

  if (flags & 0x02) warn(`${where} string ${sourceString}: heavy accent is not represented yet.`);
  if (flags & 0x04) warn(`${where} string ${sourceString}: ghost note is not represented yet.`);
  if (flags & 0x40) warn(`${where} string ${sourceString}: accent is not represented yet.`);
  const soundingMidiOverride = harmonicSoundingMidi(
    track,
    sourceString,
    fret,
    effects.harmonicType
  );

  return {
    // Legacy file strings are 1-based high→low; GPIF uses 0-based low→high.
    string: track.stringCount - sourceString,
    fret,
    midi: null,
    ...(soundingMidiOverride !== null ? { soundingMidiOverride } : {}),
    tone: null,
    octave: null,
    vibrato: effects.vibrato,
    palmMute: effects.palmMute,
    hopoOrigin: effects.hopoOrigin,
    slideFlags: effects.slideFlags,
    bend: null,
    harmonicType: effects.harmonicType
  };
}

function harmonicSoundingMidi(
  track: ParsedTrack,
  sourceString: number,
  fret: number,
  type: string | null
): number | null {
  const open = track.gpif.tuningLowToHigh[track.stringCount - sourceString];
  if (open === undefined) return null;
  if (type === 'Pinch') return open + fret + track.gpif.capo + 12;
  if (type !== 'Natural') return null;

  // Harmonic-node sounding intervals above the open string. Fret 7 is
  // deliberately exercised by the fixture because ordinary fret arithmetic
  // would place it an octave too low.
  const interval = new Map<number, number>([
    [12, 12],
    [7, 19],
    [5, 24],
    [4, 28],
    [9, 28],
    [3, 31],
    [2, 36]
  ]).get(fret);
  return interval === undefined ? null : open + interval + track.gpif.capo;
}

function readNoteEffects(
  reader: GpBinaryReader,
  where: string,
  sourceString: number,
  warn: (message: string) => void
): {
  vibrato: boolean;
  palmMute: boolean;
  hopoOrigin: boolean;
  slideFlags: number | null;
  harmonicType: string | null;
} {
  const label = `${where} string ${sourceString}`;
  const first = reader.readUint8(`${label} effect flags 1`);
  const second = reader.readUint8(`${label} effect flags 2`);

  if (first & 0x01) throw unsupported(reader, where, `string ${sourceString} bends`);
  if (first & 0x10) throw unsupported(reader, where, `string ${sourceString} grace notes`);
  if (second & 0x04) throw unsupported(reader, where, `string ${sourceString} tremolo picking`);
  if (second & 0x20) throw unsupported(reader, where, `string ${sourceString} trills`);

  if (first & 0x08) warn(`${label}: let-ring is not represented yet.`);
  if (second & 0x01) warn(`${label}: staccato is not represented yet.`);

  const slideFlags = second & 0x08 ? reader.readUint8(`${label} slide flags`) : null;
  let harmonicType: string | null = null;
  if (second & 0x10) {
    const type = reader.readUint8(`${label} harmonic type`);
    if (type === 1) harmonicType = 'Natural';
    else if (type === 4) harmonicType = 'Pinch';
    else {
      const names: Record<number, string> = { 2: 'artificial', 3: 'tapped', 5: 'semi' };
      throw unsupported(
        reader,
        where,
        `string ${sourceString} ${names[type] ?? `type ${type}`} harmonics`
      );
    }
  }

  return {
    vibrato: Boolean(second & 0x40),
    palmMute: Boolean(second & 0x02),
    hopoOrigin: Boolean(first & 0x02),
    slideFlags,
    harmonicType
  };
}

function tupletDenominator(numerator: number): number {
  if (numerator <= 1) return 1;
  if (numerator === 3) return 2;
  if (numerator === 5 || numerator === 6 || numerator === 7) return 4;
  if (numerator >= 9 && numerator <= 13) return 8;
  return Math.max(1, 2 ** Math.floor(Math.log2(numerator)));
}

function checkedCount(value: number, label: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`invalid Guitar Pro ${label} count ${value}`);
  }
  return value;
}

function unsupported(reader: GpBinaryReader, where: string, feature: string): Error {
  return new Error(
    `${where}: GP5 ${feature} are not implemented yet (at 0x${reader.offset.toString(16)})`
  );
}
