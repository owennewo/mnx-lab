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
import { readBinaryBend } from './bend.js';
import { readBinaryChord } from './chord.js';
import { readBinaryBeatEffects } from './beatEffects.js';
import { readBinaryMix } from './mix.js';
import { splitBinaryLyrics } from './lyrics.js';
import { readGpBinaryPreambleFromReader } from './song.js';
import { sniffGpBinaryVersion } from './version.js';

interface ParsedTrack {
  percussion: boolean;
  gpif: GpifTrack;
  stringCount: number;
  clef: string;
}

interface BinaryGrace {
  fret: number;
  duration: number;
  transition: number;
  onBeat: boolean;
  dead: boolean;
}

interface ParsedNote extends GpifNote {
  grace?: BinaryGrace | null;
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
 * GP5-only compatibility entry point for the shared clean-room binary reader.
 * The shared parser handles GP3/4/5 revision layouts and normalizes musical
 * data into GpifDocument. Unsupported musical effects produce warnings.
 */
export function parseGuitarPro5(data: Uint8Array, options: GpifImportOptions = {}): GpifDocument {
  const version = sniffGpBinaryVersion(data);
  if (version.major !== 5) throw new Error(`GP5 reader cannot read ${version.raw}`);
  return parseGuitarProBinary(data, options);
}

export function parseGuitarProBinary(data: Uint8Array, options: GpifImportOptions = {}): GpifDocument {
  const reader = new GpBinaryReader(data);
  const { version, scoreInfo } = readGpBinaryPreambleFromReader(reader);
  const major = version.major;

  const warn = options.onWarning ?? (() => {});
  if (major < 5 && reader.readBool('triplet feel')) {
    warn('Score triplet feel is not represented; written durations are retained.');
  }
  const lyrics = major >= 4 ? readLyrics(reader) : { trackChoice: 0, lines: [] };

  if (major === 5 && version.revision > 0) {
    reader.skip(4, 'RSE master volume');
    reader.skip(4, 'RSE master reserved value');
    reader.skip(11, 'RSE master equalizer');
  }
  if (major === 5) skipPageSetup(reader);

  if (major === 5) reader.readIntByteSizeString('tempo name');
  const tempo = reader.readInt32('tempo');
  if (major === 5 && version.revision > 0) reader.readBool('hide tempo');
  const initialFifths = major === 5 ? reader.readInt8('initial key') : reader.readInt32('initial key');
  if (major === 5) reader.skip(4, 'octave');
  else if (major === 4) reader.skip(1, 'octave');
  const instruments = readMidiChannels(reader);
  if (major === 5) {
    for (const direction of [
      'Coda', 'Double Coda', 'Segno', 'Segno Segno', 'Fine', 'Da Capo',
      'Da Capo al Coda', 'Da Capo al Double Coda', 'Da Capo al Fine',
      'Da Segno', 'Da Segno al Coda', 'Da Segno al Double Coda', 'Da Segno al Fine',
      'Da Segno Segno', 'Da Segno Segno al Coda', 'Da Segno Segno al Double Coda',
      'Da Segno Segno al Fine', 'Da Coda', 'Da Double Coda'
    ]) {
      const measure = reader.readInt16(`direction ${direction}`);
      if (measure !== -1) warn(`Measure ${measure}: navigation direction ${direction} is not represented.`);
    }
    reader.skip(4, 'master reverb');
  }

  const measureCount = checkedCount(reader.readInt32('measure count'), 'measure', 100_000);
  const trackCount = checkedCount(reader.readInt32('track count'), 'track', 1_000);
  const masterBars = readMeasureHeaders(reader, measureCount, trackCount, initialFifths, major, warn);
  const tracks = Array.from({ length: trackCount }, (_, index) =>
    readTrack(reader, index, version.revision, major, instruments)
  );
  if (major === 5) reader.skip(version.revision === 0 ? 2 : 1, 'post-track padding');

  const bars = new Map<number, GpifBar>();
  const primaryVoiceByBar = new Map<number, number>();
  const voices = new Map<number, GpifVoice>();
  const beats = new Map<number, GpifBeat>();
  const notes = new Map<number, GpifNote>();
  const rhythms = new Map<number, GpifRhythm>();
  const ids = { voice: 0, beat: 0, note: 0, rhythm: 0 };
  const tempoAutomations = new Map<number, number[]>([[0, [tempo, tempo]]]);
  const previousNotes = new Map<string, Map<number, { id: number; note: GpifNote }>>();

  for (let measureIndex = 0; measureIndex < measureCount; measureIndex++) {
    for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
      const barId = measureIndex * trackCount + trackIndex;
      const track = tracks[trackIndex];
      const voiceIds: number[] = [];

      for (let voiceSlot = 0; voiceSlot < (major === 5 ? 2 : 1); voiceSlot++) {
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
        const voiceKey = `${trackIndex}/${voiceSlot}`;
        if (!previousNotes.has(voiceKey)) previousNotes.set(voiceKey, new Map());
        for (let beatIndex = 0; beatIndex < beatCount; beatIndex++) {
          beatIds.push(
            ...readBeat(reader, track, notes, rhythms, beats, ids, {
              measure: measureIndex + 1,
              track: trackIndex + 1,
              voice: voiceSlot + 1,
              beat: beatIndex + 1
            }, warn, major, version.revision, tempoAutomations, previousNotes.get(voiceKey)!)
          );
        }
        voices.set(voiceId, { beatIds });
      }

      if (major === 5) {
        // Real GP5 scores accepted by TuxGuitar can end immediately after
        // the final voice. Only this terminal layout byte may be absent.
        const terminal = measureIndex === measureCount - 1 && trackIndex === trackCount - 1;
        if (!terminal || reader.remaining > 0) {
          reader.skip(1, `measure ${measureIndex + 1} track ${trackIndex + 1} line break`);
        }
      }
      bars.set(barId, { voiceIds, clef: track.clef });
    }
  }

  attachLyrics(lyrics, masterBars, primaryVoiceByBar, voices, beats, trackCount, warn);

  // GP3 fixtures and ecosystem GP4 files append one zero integer after the score.
  // Accept that observed trailer only; arbitrary trailing data still fails.
  if (major < 5 && reader.remaining === 4) {
    if (reader.readInt32(`GP${major} trailing reserved integer`) !== 0) {
      throw new Error(`nonzero GP${major} trailing reserved integer`);
    }
  }

  if (reader.remaining !== 0) {
    throw new Error(`GP${major} score has ${reader.remaining} unconsumed bytes at 0x${reader.offset.toString(16)}`);
  }

  return {
    metadata: {
      title: scoreInfo.title,
      subtitle: scoreInfo.subtitle,
      artist: scoreInfo.artist,
      album: scoreInfo.album,
      words: scoreInfo.words,
      music: scoreInfo.music,
      // GP3-5 has no combined words-and-music field; GPIF's is left empty.
      wordsAndMusic: '',
      copyright: scoreInfo.copyright,
      tabber: scoreInfo.tab,
      instructions: scoreInfo.instructions,
      notices: scoreInfo.notice
    },
    masterBars,
    tracks: tracks.map(track => track.gpif),
    bars,
    voices,
    beats,
    notes,
    rhythms,
    tempoAutomations
  };
}

export function importGuitarPro5(
  data: Uint8Array,
  options: GpifImportOptions = {}
): MnxStructure {
  return gpifToMnx(parseGuitarPro5(data, options), options);
}

export function importGuitarProBinary(data: Uint8Array, options: GpifImportOptions = {}): MnxStructure {
  return gpifToMnx(parseGuitarProBinary(data, options), options);
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
    const chunks = splitBinaryLyrics(line.text);
    if (chunks.length === 0) return;
    const start = Math.max(0, line.startingMeasure - 1);

    for (let measureIndex = start; measureIndex < masterBars.length && chunks.length > 0; measureIndex++) {
      const barId = masterBars[measureIndex].barIds[trackIndex];
      const voiceId = primaryVoiceByBar.get(barId) ?? -1;
      if (voiceId < 0) continue;
      for (const beatId of voices.get(voiceId)?.beatIds ?? []) {
        if (chunks.length === 0) break;
        const beat = beats.get(beatId);
        if (!beat?.noteIds?.length || beat.graceKind) continue;
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

function readMidiChannels(reader: GpBinaryReader): number[] {
  const instruments: number[] = [];
  for (let index = 0; index < 64; index++) {
    instruments.push(reader.readInt32(`MIDI channel ${index + 1} instrument`));
    reader.skip(8, `MIDI channel ${index + 1} controls`);
  }
  return instruments;
}

function readMeasureHeaders(
  reader: GpBinaryReader,
  measureCount: number,
  trackCount: number,
  initialFifths: number,
  major: number,
  warn: (message: string) => void
): GpifMasterBar[] {
  const result: GpifMasterBar[] = [];
  let numerator = 4;
  let denominator = 4;
  let fifths = initialFifths;
  let completedEndings = 0;

  for (let index = 0; index < measureCount; index++) {
    if (major === 5 && index > 0) reader.skip(1, `measure ${index + 1} leading padding`);
    const flags = reader.readUint8(`measure ${index + 1} flags`);
    if (flags & 0x04) completedEndings = 0;
    if (flags & 0x01) numerator = reader.readInt8(`measure ${index + 1} numerator`);
    if (flags & 0x02) denominator = reader.readInt8(`measure ${index + 1} denominator`);
    const repeatCount = flags & 0x08
      ? reader.readUint8(`measure ${index + 1} repeat count`) + (major < 5 ? 1 : 0)
      : null;
    let endingValue = major < 5 && (flags & 0x10)
      ? reader.readUint8(`measure ${index + 1} alternate endings`)
      : 0;
    if (major < 5 && endingValue > 8) {
      throw new Error(`measure ${index + 1}: invalid legacy ending number ${endingValue}`);
    }
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
    if (major === 5) {
      if (flags & 0x03) reader.skip(4, `measure ${index + 1} time-signature beams`);
      // GP5 moved the ending mask after marker, key and time-signature beams.
      if (flags & 0x10) endingValue = reader.readUint8(`measure ${index + 1} alternate endings`);
      if (!(flags & 0x10)) reader.skip(1, `measure ${index + 1} alternate-ending padding`);
      const tripletFeel = reader.readUint8(`measure ${index + 1} triplet feel`);
      if (tripletFeel !== 0) warn(`Measure ${index + 1}: triplet feel ${tripletFeel} is not represented; written durations are retained.`);
    }
    // GP3/4 store the highest ending number, not GP5's explicit bitmask.
    // Remove endings already taken at earlier repeat closes in this group.
    const alternateEndingsMask = major === 5 ? endingValue
      : ((1 << endingValue) - 1) & ~completedEndings;
    if (repeatCount !== null) completedEndings |= alternateEndingsMask;

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

function readTrack(reader: GpBinaryReader, index: number, revision: number, major: number, instruments: number[]): ParsedTrack {
  if (major === 5 && (index === 0 || revision === 0)) reader.skip(1, `track ${index + 1} leading padding`);
  const flags = reader.readUint8(`track ${index + 1} flags`);
  const name = reader.readByteSizeString(`track ${index + 1} name`, 40);
  const stringCount = checkedCount(reader.readInt32(`track ${index + 1} string count`), 'string', 7);
  const tuningHighToLow = Array.from({ length: 7 }, (_, string) =>
    reader.readInt32(`track ${index + 1} tuning ${string + 1}`)
  );
  reader.skip(4, `track ${index + 1} MIDI port`);
  const channel = reader.readInt32(`track ${index + 1} MIDI channel`) - 1;
  const percussion = Boolean(flags & 1) || channel % 16 === 9;
  const instrument = instruments[channel] ?? 0;
  const bass = instrument >= 32 && instrument <= 39;
  reader.skip(4, `track ${index + 1} MIDI effect channel`);
  reader.skip(4, `track ${index + 1} fret count`);
  const capo = reader.readInt32(`track ${index + 1} capo`);
  reader.skip(4, `track ${index + 1} color`);
  if (major < 5) return {
    gpif: { name, tuningLowToHigh: percussion ? [] : tuningHighToLow.slice(0, stringCount).reverse(), capo: percussion ? 0 : capo, chordNames: new Map() },
    percussion,
    stringCount,
    clef: bass && !percussion ? 'F4' : 'G2'
  };
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
      tuningLowToHigh: percussion ? [] : tuningHighToLow.slice(0, stringCount).reverse(),
      capo: percussion ? 0 : capo,
      chordNames: new Map()
    },
    stringCount,
    percussion,
    clef: !percussion && (bass || clefTranspose >= 12) ? 'F4' : 'G2'
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
  warn: (message: string) => void,
  major: number,
  revision: number,
  tempoAutomations: Map<number, number[]>,
  previousNotes: Map<number, { id: number; note: GpifNote }>
): number[] {
  const where = `measure ${at.measure} track ${at.track} voice ${at.voice} beat ${at.beat}`;
  const flags = reader.readUint8(`${where} flags`);
  const status = flags & 0x40 ? reader.readUint8(`${where} status`) : 1;
  const durationCode = reader.readInt8(`${where} duration`);
  const base = DURATION_BASES.get(durationCode);
  if (!base) throw new Error(`${where}: unsupported duration code ${durationCode}`);
  const tuplet = flags & 0x20 ? reader.readInt32(`${where} tuplet`) : 1;

  let chordId: number | null = null;
  if (flags & 0x02) {
    const name = readBinaryChord(reader, major, where);
    chordId = track.gpif.chordNames.size;
    track.gpif.chordNames.set(chordId, name);
    warn(`${where}: chord name retained; diagram fingering is not represented.`);
  }
  const freeText = flags & 0x04 ? reader.readIntByteSizeString(`${where} text`) : null;
  const beatEffects = flags & 0x08 ? readBinaryBeatEffects(reader, major, where, warn) : null;
  if (flags & 0x10) {
    const tempo = readBinaryMix(reader, major, revision, where, warn);
    if (tempo !== null) {
      const values = tempoAutomations.get(at.measure - 1) ?? [];
      values.push(tempo);
      tempoAutomations.set(at.measure - 1, values);
    }
  }

  const playedStrings = reader.readUint8(`${where} played strings`);
  const noteIds: number[] = [];
  const graceBeatIds: number[] = [];
  const graceGroups = new Map<string, number>();
  for (let sourceString = 1; sourceString <= 7; sourceString++) {
    const mask = 1 << (7 - sourceString);
    if (!(playedStrings & mask)) continue;
    if (sourceString > track.stringCount) {
      throw new Error(`${where}: note uses string ${sourceString}, track has ${track.stringCount}`);
    }
    const noteId = ids.note++;
    const note = readNote(reader, track, sourceString, where, warn, major);
    if (beatEffects?.vibrato) note.vibrato = true;
    if (beatEffects?.harmonicType) {
      note.harmonicType = beatEffects.harmonicType;
      note.soundingMidiOverride = harmonicSoundingMidi(
        track, sourceString, note.fret ?? 0, note.harmonicType,
        note.harmonicType === 'Artificial' ? { interval: harmonicInterval(note.fret ?? 0) ?? 12 } : null,
        warn, where
      );
    }
    if (note.tieDestination) {
      const previous = previousNotes.get(sourceString);
      if (previous) {
        note.fret = previous.note.fret;
        note.midi = previous.note.midi;
        note.soundingMidiOverride = previous.note.soundingMidiOverride;
        note.tieOrigin = previous.id;
      } else {
        // Observed consumer recovery for orphan ties: retain the stored note,
        // never guess a source in another voice or manufacture a dangling link.
        warn(`${where}: tie has no preceding note on string ${sourceString}; stored fret retained without a tie link.`);
        delete note.tieDestination;
      }
    }
    if (status !== 2) previousNotes.set(sourceString, { id: noteId, note });
    const grace = note.grace;
    delete note.grace;
    notes.set(noteId, note);
    if (grace) {
      const graceNoteId = ids.note++;
      notes.set(graceNoteId, {
        string: note.string, fret: track.percussion ? null : grace.fret,
        midi: track.percussion ? grace.fret : null, tone: null, octave: null,
        vibrato: false, palmMute: false, hopoOrigin: grace.transition === 3,
        slideFlags: grace.transition === 1 ? 2 : null,
        bend: null, harmonicType: null
      });
      const graceKey = `${grace.onBeat}/${grace.duration}`;
      const existingGrace = graceGroups.get(graceKey);
      if (existingGrace !== undefined) {
        beats.get(existingGrace)!.noteIds!.push(graceNoteId);
      } else {
        const graceRhythmId = ids.rhythm++;
        rhythms.set(graceRhythmId, {
          base: grace.duration === 3 ? '16th' : '32nd',
          dots: 0, tupletNumerator: 1, tupletDenominator: 1
        });
        const graceBeatId = ids.beat++;
        beats.set(graceBeatId, {
          rhythmRef: graceRhythmId, noteIds: [graceNoteId],
          graceKind: grace.onBeat ? 'OnBeat' : 'BeforeBeat',
          freeText: null, chordId: null, lyricLines: null
        });
        graceGroups.set(graceKey, graceBeatId);
        graceBeatIds.push(graceBeatId);
      }
      if (grace.duration === 2) warn(`${where}: 24th-note grace duration is not representable; using 32nd-note display duration.`);
      if (grace.dead) warn(`${where}: dead grace-note styling is not represented.`);
      if (grace.transition === 2) warn(`${where}: grace bend transition is not represented.`);
    }
    noteIds.push(noteId);
  }

  if (graceGroups.size > 1) {
    warn(`${where}: grace notes with differing placement or duration are represented as separate grace events.`);
  }
  if (major === 5) {
    const displayFlags = reader.readUint16(`${where} display flags`);
    if (displayFlags & 0x0800) reader.skip(1, `${where} secondary beam break`);
  }

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
    // Some legacy writers mark a populated beat as empty (status zero).
    // The string mask is authoritative for notes; only status two is a rest.
    noteIds: status !== 2 && noteIds.length > 0 ? noteIds : null,
    graceKind: null,
    freeText,
    chordId,
    lyricLines: null
  });
  return [...graceBeatIds, beatId];
}

function readNote(
  reader: GpBinaryReader,
  track: ParsedTrack,
  sourceString: number,
  where: string,
  warn: (message: string) => void,
  major: number
): ParsedNote {
  const flags = reader.readUint8(`${where} string ${sourceString} note flags`);
  let type = 1;
  let fret = 0;
  if (flags & 0x20) {
    type = reader.readUint8(`${where} string ${sourceString} note type`);
  }
  if (major < 5 && (flags & 0x01)) reader.skip(2, `${where} note duration`);
  if (flags & 0x10) reader.skip(1, `${where} string ${sourceString} dynamics`);
  if (flags & 0x20) fret = reader.readInt8(`${where} string ${sourceString} fret`);
  if (flags & 0x80) reader.skip(2, `${where} string ${sourceString} fingering`);
  if (major === 5) {
    if (flags & 0x01) reader.skip(8, `${where} string ${sourceString} duration percent`);
    reader.skip(1, `${where} string ${sourceString} accidental flags`);
  }
  const effects = flags & 0x08
    ? readNoteEffects(reader, where, sourceString, warn, major)
    : { vibrato: false, palmMute: false, hopoOrigin: false, slideFlags: null, harmonicType: null, harmonicData: null, bend: null, grace: null };
  if (type < 1 || type > 3) throw unsupported(reader, where, `note type ${type}`);
  if (type === 3) warn(`${where} string ${sourceString}: dead-note styling is not represented.`);

  if (flags & 0x02) warn(`${where} string ${sourceString}: heavy accent is not represented yet.`);
  if (flags & 0x04) warn(`${where} string ${sourceString}: ghost note is not represented yet.`);
  if (flags & 0x40) warn(`${where} string ${sourceString}: accent is not represented yet.`);
  const soundingMidiOverride = harmonicSoundingMidi(
    track,
    sourceString,
    fret,
    effects.harmonicType,
    effects.harmonicData,
    warn,
    where
  );

  return {
    // Legacy file strings are 1-based high→low; GPIF uses 0-based low→high.
    string: track.percussion ? null : track.stringCount - sourceString,
    ...(type === 2 ? { tieDestination: true } : {}),
    fret: track.percussion ? null : fret,
    midi: track.percussion ? fret : null,
    ...(soundingMidiOverride !== null ? { soundingMidiOverride } : {}),
    tone: null,
    octave: null,
    vibrato: effects.vibrato,
    palmMute: effects.palmMute,
    hopoOrigin: effects.hopoOrigin,
    slideFlags: effects.slideFlags,
    bend: effects.bend,
    harmonicType: effects.harmonicType,
    grace: effects.grace
  };
}

function harmonicSoundingMidi(
  track: ParsedTrack,
  sourceString: number,
  fret: number,
  type: string | null,
  data: { interval?: number; tappedFret?: number; pitch?: number; octave?: number } | null,
  warn: (message: string) => void,
  where: string
): number | null {
  const open = track.gpif.tuningLowToHigh[track.stringCount - sourceString];
  if (open === undefined) return null;
  const fundamental = open + fret;
  if (type === 'Artificial' && data?.pitch !== undefined) {
    const shift = [0, 12, 24, -12, -24][data.octave ?? 0];
    if (shift === undefined) throw new Error(`${where}: invalid artificial harmonic octave ${data.octave}`);
    return fundamental + ((data.pitch - fundamental % 12 + 12) % 12) + shift + track.gpif.capo;
  }
  if (type === 'Artificial') return fundamental + track.gpif.capo + (data?.interval ?? 12);
  if (type === 'Pinch' || type === 'Semi') return fundamental + track.gpif.capo + 12;
  if (type === 'Tap') {
    const node = data?.tappedFret === undefined ? 12 : data.tappedFret - fret;
    const interval = harmonicInterval(node);
    if (interval === undefined) {
      warn(`${where}: unrecognized tapped harmonic node ${node}; sounding pitch uses the fundamental.`);
      return fundamental + track.gpif.capo;
    }
    return fundamental + track.gpif.capo + interval;
  }
  if (type !== 'Natural') return null;

  // Harmonic-node sounding intervals above the open string. Fret 7 is
  // deliberately exercised by the fixture because ordinary fret arithmetic
  // would place it an octave too low.
  const interval = harmonicInterval(fret);
  if (interval === undefined) warn(`${where}: unrecognized natural harmonic node ${fret}; sounding pitch uses fret arithmetic.`);
  return interval === undefined ? null : open + interval + track.gpif.capo;
}

function harmonicInterval(fret: number): number | undefined {
  return new Map<number, number>([
    [12, 12],
    [7, 19],
    [5, 24],
    [4, 28],
    [9, 28],
    [3, 31],
    [2, 36]
  ]).get(fret);
}

function readNoteEffects(
  reader: GpBinaryReader,
  where: string,
  sourceString: number,
  warn: (message: string) => void,
  major: number
): {
  vibrato: boolean;
  palmMute: boolean;
  hopoOrigin: boolean;
  slideFlags: number | null;
  harmonicType: string | null;
  harmonicData: { interval?: number; tappedFret?: number; pitch?: number; octave?: number } | null;
  bend: GpifNote['bend'];
  grace: BinaryGrace | null;
} {
  const label = `${where} string ${sourceString}`;
  const first = reader.readUint8(`${label} effect flags 1`);
  const second = major >= 4 ? reader.readUint8(`${label} effect flags 2`) : 0;

  const bend = first & 0x01 ? readBinaryBend(reader, `${label} bend`, warn) : null;
  let grace: BinaryGrace | null = null;
  if (first & 0x10) {
    const fret = reader.readInt8(`${label} grace fret`);
    reader.readUint8(`${label} grace dynamics`);
    const transition = reader.readUint8(`${label} grace transition`);
    const duration = reader.readUint8(`${label} grace duration`);
    if (duration < 1 || duration > 3) throw new Error(`${label}: invalid grace duration ${duration}`);
    const flags = major === 5 ? reader.readUint8(`${label} grace flags`) : 0;
    grace = { fret, transition, duration, onBeat: Boolean(flags & 2), dead: Boolean(flags & 1) };
  }
  if (second & 0x04) {
    reader.readUint8(`${label} tremolo picking speed`);
    warn(`${label}: tremolo picking is not represented.`);
  }

  if (first & 0x08) warn(`${label}: let-ring is not represented yet.`);
  if (second & 0x01) warn(`${label}: staccato is not represented yet.`);

  let slideFlags: number | null = major === 3 && (first & 0x04) ? 1 : null;
  if (second & 0x08) {
    const raw = reader.readInt8(`${label} slide flags`);
    slideFlags = major === 5 ? raw : ({ 1: 1, 2: 2, 3: 4, 4: 8, '-1': 16, '-2': 32 } as Record<number, number>)[raw] ?? 0;
  }
  let harmonicType: string | null = null;
  let harmonicData: { interval?: number; tappedFret?: number; pitch?: number; octave?: number } | null = null;
  if (second & 0x10) {
    const type = reader.readUint8(`${label} harmonic type`);
    if (type === 1) harmonicType = 'Natural';
    else if (type === 4) harmonicType = 'Pinch';
    else if (type === 5) harmonicType = 'Semi';
    else if (type === 3) {
      harmonicType = 'Tap';
      harmonicData = major === 5 ? { tappedFret: reader.readUint8(`${label} tapped fret`) } : null;
    } else if (major === 5 && type === 2) {
      harmonicType = 'Artificial';
      const pitch = reader.readUint8(`${label} harmonic pitch`);
      const accidental = reader.readInt8(`${label} harmonic accidental`);
      const octave = reader.readUint8(`${label} harmonic octave`);
      harmonicData = { pitch: (pitch + accidental + 12) % 12, octave };
    } else if (major === 4 && [15, 17, 22].includes(type)) {
      harmonicType = 'Artificial';
      harmonicData = { interval: ({ 15: 24, 17: 19, 22: 12 } as Record<number, number>)[type] };
    }
    else {
      const names: Record<number, string> = { 2: 'artificial', 3: 'tapped', 5: 'semi' };
      throw unsupported(
        reader,
        where,
        `string ${sourceString} ${names[type] ?? `type ${type}`} harmonics`
      );
    }
  }
  if (second & 0x20) {
    reader.readInt8(`${label} trill fret`);
    reader.readUint8(`${label} trill speed`);
    warn(`${label}: trill is not represented.`);
  }

  return {
    vibrato: Boolean(second & 0x40),
    palmMute: Boolean(second & 0x02),
    hopoOrigin: Boolean(first & 0x02),
    bend,
    grace,
    slideFlags,
    harmonicType,
    harmonicData
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
