import {
  MnxStructure,
  MnxPart,
  MnxPartMeasure,
  MnxGlobalMeasure,
  MnxSequence,
  MnxSequenceItem,
  MnxEvent,
  MnxGrace,
  MnxNote,
  MnxTabTechnique,
  MnxEventLyricLine,
  MnxHarmony,
  MnxHarmonicType,
  MnxBendPoint
} from '../common/types.js';
import { parseChordSymbol } from '../common/harmony.js';
import { mnxDurationToWholes, tupletRatio, wholesToFraction } from '../common/duration.js';
import { alphaTabTuningToMnx, midiToPitch } from '../common/tuning.js';
import {
  GpifDocument,
  GpifBeat,
  GpifNote,
  GpifTrack,
  GpifRhythm
} from './document.js';

/**
 * GPIF document → MNX, clean-room.
 *
 * This mirrors the mapping semantics of `../import/gp.ts` (the alphaTab-backed
 * importer) deliberately, decision for decision — sections split into
 * rehearsal + section, voltas collapsed from per-bar flags, tuplet groups
 * filled by written duration, grace runs buffered ahead of their principal,
 * harmony deduplicated globally. `tests/gpif-parity.test.ts` holds the two
 * importers to identical output (modulo note-id naming) over every Guitar Pro
 * fixture; where this file makes a judgement the format leaves open, the
 * evidence is research/gpif-field-notes.md.
 */

export interface GpifImportOptions {
  /** Called for anything in the source this converter cannot represent. */
  onWarning?: (message: string) => void;
}

/** GPIF `Clef` strings → MNX clef signs. Defaults to treble, like the source. */
const CLEFS: Record<string, { sign: string; staffPosition?: number }> = {
  G2: { sign: 'G', staffPosition: -2 },
  F4: { sign: 'F', staffPosition: -4 },
  C3: { sign: 'C', staffPosition: -3 },
  C4: { sign: 'C', staffPosition: -4 }
};

const HARMONIC_TYPES: Record<string, MnxHarmonicType> = {
  Natural: 'natural',
  Artificial: 'artificial',
  Pinch: 'pinch',
  Tap: 'tap',
  Semi: 'semi',
  Feedback: 'feedback'
};

/** Slide flag bits — research/gpif-field-notes.md §8. */
const SLIDE_SHIFT = 0x01;
const SLIDE_LEGATO = 0x02;
const SLIDE_OUT_DOWN = 0x04;
const SLIDE_OUT_UP = 0x08;
const SLIDE_IN_FROM_BELOW = 0x10;
const SLIDE_IN_FROM_ABOVE = 0x20;

/** A note instance awaiting a technique target (hammer-on / slide-to). */
interface NoteRecord {
  /** Beat ordinal within the voice chain — targets resolve strictly forward. */
  order: number;
  /** GPIF string number (0 = lowest); targets pair on the same string. */
  gpString: number | null;
  id: string;
  technique: MnxTabTechnique | null;
  note: MnxNote;
  wantsHammerTarget: boolean;
  wantsSlideTarget: boolean;
}

export function gpifToMnx(doc: GpifDocument, options: GpifImportOptions = {}): MnxStructure {
  const warn = options.onWarning ?? (() => {});

  const fifthsByMeasure = resolveFifths(doc);
  const globalMeasures = buildGlobalMeasures(doc, fifthsByMeasure);
  applyHarmonies(doc, globalMeasures);

  const state = { nextNoteId: 0 };
  const parts = doc.tracks.map((track, trackIndex) =>
    buildPart(doc, track, trackIndex, fifthsByMeasure, state, warn)
  );

  // Verse ids are 1..N by position; declare only verses that carry a syllable.
  const usedVerses = new Set<number>();
  for (const [trackIndex] of doc.tracks.entries()) {
    for (const masterBar of doc.masterBars) {
      const bar = doc.bars.get(masterBar.barIds[trackIndex] ?? -1);
      for (const voiceId of bar?.voiceIds ?? []) {
        for (const beatId of doc.voices.get(voiceId)?.beatIds ?? []) {
          (doc.beats.get(beatId)?.lyricLines ?? []).forEach((chunk, index) => {
            if (chunk && chunk.trim()) usedVerses.add(index);
          });
        }
      }
    }
  }
  const lineOrder = [...usedVerses].sort((a, b) => a - b).map(i => `${i + 1}`);

  return {
    mnx: { version: 1 },
    global: {
      measures: globalMeasures,
      ...(lineOrder.length > 0 ? { lyrics: { lineOrder } } : {})
    },
    parts
  };
}

/** Key signature carried forward across bars that declare none. */
function resolveFifths(doc: GpifDocument): number[] {
  const fifths: number[] = [];
  let current = 0;
  for (const masterBar of doc.masterBars) {
    if (masterBar.fifths !== null) current = masterBar.fifths;
    fifths.push(current);
  }
  return fifths;
}

function buildGlobalMeasures(
  doc: GpifDocument,
  fifthsByMeasure: number[]
): MnxGlobalMeasure[] {
  const measures: MnxGlobalMeasure[] = [];

  // MNX declares attributes change-only; track what has been emitted.
  let lastTime = '';
  let lastFifths: number | null = null;

  for (const [barIndex, masterBar] of doc.masterBars.entries()) {
    const measure: MnxGlobalMeasure = {};

    const fifths = fifthsByMeasure[barIndex] ?? 0;
    if (fifths !== lastFifths) {
      measure.key = { fifths };
      lastFifths = fifths;
    }

    const timeKey = `${masterBar.timeNumerator}/${masterBar.timeDenominator}`;
    if (timeKey !== lastTime) {
      measure.time = { count: masterBar.timeNumerator, unit: masterBar.timeDenominator };
      lastTime = timeKey;
    }

    if (masterBar.repeatStart) measure.repeatStart = {};
    if (masterBar.repeatCount !== null && masterBar.repeatCount > 1) {
      measure.repeatEnd = { times: masterBar.repeatCount };
    }
    if (masterBar.doubleBar) measure.barline = { type: 'double' };

    // Section / rehearsal labels: Guitar Pro conflates the two into one
    // `Section{Letter, Text}`; split, because a rehearsal mark is an index
    // into the score while a section name states what the music IS.
    const marker = masterBar.sectionLetter?.trim();
    const sectionText = masterBar.sectionText?.trim();
    if (marker) measure.rehearsal = { label: marker };
    if (sectionText) measure.section = { label: sectionText };

    for (const bpm of doc.tempoAutomations.get(barIndex) ?? []) {
      measure.tempos = measure.tempos ?? [];
      measure.tempos.push({ bpm, value: { base: 'quarter' } });
    }

    measures.push(measure);
  }

  collapseAlternateEndings(doc, measures);
  return measures;
}

/**
 * Guitar Pro flags EVERY bar of a volta with the same ending mask; MNX states
 * the bracket once with a `duration`. Collapse each run of identical masks.
 */
function collapseAlternateEndings(doc: GpifDocument, measures: MnxGlobalMeasure[]): void {
  const maskAt = (index: number) => doc.masterBars[index]?.alternateEndingsMask ?? 0;

  for (let index = 0; index < measures.length; index++) {
    const mask = maskAt(index);
    if (!mask || mask === maskAt(index - 1)) continue; // not the start of a run

    let last = index;
    while (last + 1 < measures.length && maskAt(last + 1) === mask) last++;

    const numbers: number[] = [];
    for (let bit = 0; bit < 8; bit++) if (mask & (1 << bit)) numbers.push(bit + 1);

    const duration = last - index + 1;
    measures[index].ending = { numbers, ...(duration > 1 ? { duration } : {}) };
  }
}

/**
 * Chord symbols → `global.measures[i]._x.mnxLab.harmonies`. Guitar Pro states
 * a chord as a `Chord` diagram reference or a bare `FreeText`; both are read,
 * collected across every track, and deduplicated by position — harmony is
 * global in MNX Lab, and Guitar Pro stores it per beat per track.
 */
function applyHarmonies(doc: GpifDocument, measures: MnxGlobalMeasure[]): void {
  const byMeasure = new Map<number, Map<string, MnxHarmony>>();

  for (const [trackIndex, track] of doc.tracks.entries()) {
    for (const [measureIndex, masterBar] of doc.masterBars.entries()) {
      const bar = doc.bars.get(masterBar.barIds[trackIndex] ?? -1);
      for (const voiceId of bar?.voiceIds ?? []) {
        let onset = 0;
        for (const beatId of doc.voices.get(voiceId)?.beatIds ?? []) {
          const beat = doc.beats.get(beatId);
          if (!beat) continue;
          const rhythm = doc.rhythms.get(beat.rhythmRef);

          const chordName = beat.chordId !== null ? track.chordNames.get(beat.chordId) : undefined;
          const symbol = chordName?.trim() || beat.freeText?.trim() || '';
          const parsed = symbol ? parseChordSymbol(symbol) : null;
          if (parsed) {
            const fraction = wholesToFraction(onset);
            const key = `${fraction[0]}/${fraction[1]}`;
            const slot = byMeasure.get(measureIndex) ?? new Map<string, MnxHarmony>();
            // First track wins; a later track restating the same chord is the
            // same musical fact, not a second one.
            if (!slot.has(key)) slot.set(key, { location: { fraction }, ...parsed });
            byMeasure.set(measureIndex, slot);
          }

          if (rhythm?.base) onset += mnxDurationToWholes(rhythm.base, rhythm.dots);
        }
      }
    }
  }

  for (const [index, slot] of byMeasure) {
    const measure = measures[index];
    if (!measure) continue;
    const harmonies = [...slot.values()].sort(
      (a, b) =>
        a.location.fraction[0] / a.location.fraction[1] -
        b.location.fraction[0] / b.location.fraction[1]
    );
    measure._x = { ...measure._x, mnxLab: { ...measure._x?.mnxLab, harmonies } };
  }
}

function buildPart(
  doc: GpifDocument,
  track: GpifTrack,
  trackIndex: number,
  fifthsByMeasure: number[],
  state: { nextNoteId: number },
  warn: (message: string) => void
): MnxPart {
  const tuning = track.tuningLowToHigh;
  const stringCount = tuning.length;

  const measures: MnxPartMeasure[] = [];
  let lastClefKey = '';
  // Per-voice state that outlives a measure: lyric hyphen continuation, the
  // technique-target records, and the beat ordinal the records are ordered by.
  const lyricContinuation = new Map<number, boolean[]>();
  const voiceRecords = new Map<number, NoteRecord[]>();
  const voiceOrder = new Map<number, number>();

  for (const [measureIndex, masterBar] of doc.masterBars.entries()) {
    const fifths = fifthsByMeasure[measureIndex] ?? 0;
    const measure: MnxPartMeasure = { sequences: [] };

    const bar = doc.bars.get(masterBar.barIds[trackIndex] ?? -1);

    // Clefs are emitted change-only, matching the rest of the project.
    const clef = CLEFS[bar?.clef ?? ''] ?? CLEFS.G2;
    const clefKey = `${clef.sign}/${clef.staffPosition}`;
    if (clefKey !== lastClefKey) {
      measure.clefs = [{ clef }];
      lastClefKey = clefKey;
    }

    for (const [voiceIndex, voiceId] of (bar?.voiceIds ?? []).entries()) {
      const beats =
        voiceId < 0
          ? []
          : (doc.voices.get(voiceId)?.beatIds ?? [])
              .map(id => doc.beats.get(id))
              .filter((beat): beat is GpifBeat => beat !== undefined);
      // An empty slot (-1, or a voice with no beats) still occupies its place:
      // it becomes a voice holding one quarter rest, matching observed
      // alphaTab behavior — which is why a voice consisting entirely of
      // authored rests is indistinguishable downstream, and real.
      if (beats.length === 0) {
        measure.sequences.push({
          voice: `v${voiceIndex + 1}`,
          content: [{ duration: { base: 'quarter' }, rest: {} }]
        });
        continue;
      }

      if (!lyricContinuation.has(voiceIndex)) lyricContinuation.set(voiceIndex, []);
      if (!voiceRecords.has(voiceIndex)) voiceRecords.set(voiceIndex, []);

      measure.sequences.push(
        buildSequence(doc, beats, voiceIndex, track, fifths, measureIndex, state, warn, {
          lyricContinuation: lyricContinuation.get(voiceIndex)!,
          records: voiceRecords.get(voiceIndex)!,
          nextOrder: () => {
            const value = voiceOrder.get(voiceIndex) ?? 0;
            voiceOrder.set(voiceIndex, value + 1);
            return value;
          }
        })
      );
    }

    if (measure.sequences.length === 0) {
      measure.sequences.push({ voice: 'v1', content: [], fullMeasure: {} });
    }

    measures.push(measure);
  }

  for (const records of voiceRecords.values()) resolveTargets(records);

  const part: MnxPart = {
    id: `P${trackIndex + 1}`,
    name: track.name || 'Guitar',
    measures
  };

  if (stringCount > 0) {
    part._x = {
      mnxLab: {
        // MNX tuning entries run string 1 = highest; GPIF pitches run low→high.
        strings: alphaTabTuningToMnx([...tuning].reverse(), fifthsByMeasure[0] ?? 0),
        ...(track.capo ? { capo: track.capo } : {}),
        // Guitar Pro scores are single-source tab+notation, exactly the tab
        // extension's model.
        tab: { staffKind: 'both' as const }
      }
    };
  }

  return part;
}

interface VoiceState {
  lyricContinuation: boolean[];
  records: NoteRecord[];
  nextOrder: () => number;
}

function buildSequence(
  doc: GpifDocument,
  beats: GpifBeat[],
  voiceIndex: number,
  track: GpifTrack,
  fifths: number,
  measureIndex: number,
  state: { nextNoteId: number },
  warn: (message: string) => void,
  voice: VoiceState
): MnxSequence {
  const content: MnxSequenceItem[] = [];
  const groups = groupTuplets(doc, beats);

  // Grace beats and tuplet beats are both RUNS in Guitar Pro — a per-beat flag
  // repeated across neighbours — and both are single CONTAINERS in MNX, so the
  // walk buffers a run and flushes it when the run ends.
  let graceRun: MnxEvent[] = [];
  let graceKind: string | null = null;
  let tupletRun: { events: MnxEvent[]; group: TupletGroup } | null = null;

  /** A finished grace run, emitted immediately BEFORE the beat it decorates. */
  const flushGrace = () => {
    if (graceRun.length === 0) return;
    if (tupletRun) {
      warn(
        `measure ${measureIndex + 1}: a grace note inside a tuplet was moved ahead ` +
          `of the group (MNX tuplets contain events, not containers).`
      );
    }
    const grace: MnxGrace = { type: 'grace', content: graceRun };
    // `BeforeBeat` is the acciaccatura crushed in ahead of the beat; `OnBeat`
    // lands on the beat and delays its principal. MNX names the same two
    // `stealPrevious` and `stealFollowing`.
    grace.graceType = graceKind === 'OnBeat' ? 'stealFollowing' : 'stealPrevious';
    content.push(grace);
    graceRun = [];
    graceKind = null;
  };

  const flushTuplet = () => {
    if (!tupletRun) return;
    const { events, group } = tupletRun;
    tupletRun = null;
    const ratio = tupletRatio(
      events.map(e => mnxDurationToWholes(e.duration.base, e.duration.dots ?? 0)),
      group.numerator,
      group.denominator
    );
    if (!ratio) {
      // An incomplete group performs in a time no MNX duration × multiple
      // spells; emit the events flat and say what was lost.
      warn(
        `measure ${measureIndex + 1}: a ${group.numerator}:${group.denominator} ` +
          `tuplet of ${events.length} beat(s) does not fill a whole group; its notes ` +
          `were written without the tuplet.`
      );
      content.push(...events);
      return;
    }
    content.push({ type: 'tuplet', content: events, ...ratio });
  };

  for (const [beatIndex, beat] of beats.entries()) {
    const order = voice.nextOrder();
    const rhythm = doc.rhythms.get(beat.rhythmRef);
    const base = rhythm?.base ?? null;
    if (base === null) {
      warn(
        `measure ${measureIndex + 1}: unsupported Guitar Pro duration; the beat was skipped.`
      );
      continue;
    }
    const dots = rhythm?.dots ?? 0;

    const event: MnxEvent = {
      duration: dots > 0 ? { base, dots } : { base }
    };

    const noteIds = beat.noteIds ?? [];
    if (noteIds.length === 0) {
      event.rest = {};
    } else {
      event.notes = noteIds
        .map(id => doc.notes.get(id))
        .filter((note): note is GpifNote => note !== undefined)
        .map(note => buildNote(note, track, fifths, order, state, voice.records));
    }

    const lyrics = buildLyrics(beat, voice.lyricContinuation);
    if (lyrics) event.lyrics = lyrics;

    if (beat.graceKind !== null) {
      // A grace beat is un-timed: it neither joins a tuplet group nor ends one.
      graceRun.push(event);
      graceKind = graceKind ?? beat.graceKind;
      continue;
    }

    const group = groups.get(beatIndex);
    if (tupletRun && tupletRun.group !== group) flushTuplet();
    if (group) {
      flushGrace();
      if (!tupletRun) tupletRun = { events: [], group };
      tupletRun.events.push(event);
      continue;
    }

    flushGrace();
    content.push(event);
  }

  flushTuplet();
  flushGrace();

  return { voice: `v${voiceIndex + 1}`, content };
}

interface TupletGroup {
  numerator: number;
  denominator: number;
}

/**
 * GPIF flags each beat's rhythm with `num:den` and groups nothing; a group is
 * re-derived by filling with written duration, so six flagged eighths are two
 * triplets and not one six-note tuplet: a group closes when its beats sum to
 * `num` × the written duration of its first beat. Grace beats are un-timed and
 * pass through without joining or breaking a group.
 */
function groupTuplets(doc: GpifDocument, beats: GpifBeat[]): Map<number, TupletGroup> {
  const groups = new Map<number, TupletGroup>();
  let current: TupletGroup | null = null;
  let target = 0;
  let filled = 0;

  for (const [index, beat] of beats.entries()) {
    if (beat.graceKind !== null) continue;
    const rhythm = doc.rhythms.get(beat.rhythmRef);
    const flagged =
      rhythm && rhythm.base !== null &&
      (rhythm.tupletNumerator !== 1 || rhythm.tupletDenominator !== 1);

    if (!flagged || !rhythm) {
      current = null;
      continue;
    }

    if (
      !current ||
      current.numerator !== rhythm.tupletNumerator ||
      current.denominator !== rhythm.tupletDenominator ||
      filled >= target
    ) {
      current = { numerator: rhythm.tupletNumerator, denominator: rhythm.tupletDenominator };
      target = rhythm.tupletNumerator * mnxDurationToWholes(rhythm.base!, rhythm.dots);
      filled = 0;
    }

    groups.set(index, current);
    filled += mnxDurationToWholes(rhythm.base!, rhythm.dots);
  }

  return groups;
}

/**
 * GPIF beat `Lyrics/Line` entries → MNX `event.lyrics.lines`. A syllable that
 * continues into the next one ends with `-`; MNX says the same with
 * `type: 'start' | 'middle'`, which needs the previous chunk of the same
 * verse — carried across beats (and barlines) in `previousContinued`.
 */
function buildLyrics(
  beat: GpifBeat,
  previousContinued: boolean[]
): { lines: Record<string, MnxEventLyricLine> } | undefined {
  const chunks = beat.lyricLines;
  if (!chunks?.length) return undefined;

  const lines: Record<string, MnxEventLyricLine> = {};

  for (const [index, raw] of chunks.entries()) {
    const chunk = (raw ?? '').trim();
    if (!chunk) {
      previousContinued[index] = false;
      continue;
    }

    const continues = chunk.endsWith('-');
    // `+` is Guitar Pro's escape for a space inside a single syllable.
    const text = (continues ? chunk.slice(0, -1) : chunk).replace(/\+/g, ' ');
    if (!text) {
      previousContinued[index] = false;
      continue;
    }

    const started = previousContinued[index] === true;
    lines[`${index + 1}`] = {
      text,
      type: continues ? (started ? 'middle' : 'start') : started ? 'end' : 'whole'
    };
    previousContinued[index] = continues;
  }

  return Object.keys(lines).length > 0 ? { lines } : undefined;
}

function buildNote(
  gpNote: GpifNote,
  track: GpifTrack,
  fifths: number,
  order: number,
  state: { nextNoteId: number },
  records: NoteRecord[]
): MnxNote {
  const id = `n${state.nextNoteId++}`;
  const mnxNote: MnxNote = {
    id,
    pitch: midiToPitch(soundingMidi(gpNote, track), fifths)
  };

  const stringCount = track.tuningLowToHigh.length;
  const onFingerboard = gpNote.string !== null && stringCount > 0;
  if (onFingerboard) {
    mnxNote._x = {
      mnxLab: {
        // GPIF string 0 = lowest; MNX string 1 = highest.
        string: stringCount - gpNote.string!,
        fret: gpNote.fret ?? 0
      }
    };
  }

  const { technique, wantsHammerTarget, wantsSlideTarget } = readTechniques(gpNote);
  if (technique) {
    mnxNote._x = mnxNote._x ?? {};
    mnxNote._x.mnxLab = { ...mnxNote._x.mnxLab, tab: { technique } };
  }

  records.push({
    order,
    gpString: gpNote.string,
    id,
    technique,
    note: mnxNote,
    wantsHammerTarget,
    wantsSlideTarget
  });

  return mnxNote;
}

/**
 * Sounding pitch, in preference order: the fingerboard arithmetic the field
 * notes verified on every fixture note (`tuning[string] + fret + capo`), then
 * the stated `Midi`, then GP6's `Tone`/`Octave` pair.
 */
function soundingMidi(note: GpifNote, track: GpifTrack): number {
  if (note.soundingMidiOverride !== null && note.soundingMidiOverride !== undefined) {
    return note.soundingMidiOverride;
  }
  if (note.string !== null && note.fret !== null) {
    const open = track.tuningLowToHigh[note.string];
    if (open !== undefined) return open + note.fret + track.capo;
  }
  if (note.midi !== null) return note.midi;
  if (note.tone !== null && note.octave !== null) return note.tone + 12 * note.octave - 12;
  return 60;
}

function readTechniques(note: GpifNote): {
  technique: MnxTabTechnique | null;
  wantsHammerTarget: boolean;
  wantsSlideTarget: boolean;
} {
  const technique: MnxTabTechnique = {};
  let found = false;
  let wantsHammerTarget = false;
  let wantsSlideTarget = false;

  if (note.vibrato) {
    technique.vibrato = true;
    found = true;
  }
  if (note.hopoOrigin) {
    // ONE adornment (extension v6): direction stays implicit in the pitches.
    // The file stores no link; the destination — the next note on the same
    // string in this voice — is resolved by `resolveTargets`, and an origin
    // with no destination drops the adornment rather than dangle a reference.
    wantsHammerTarget = true;
  }
  const flags = note.slideFlags;
  if (flags !== null) {
    if (flags & (SLIDE_SHIFT | SLIDE_LEGATO)) {
      technique.slide = { type: flags & SLIDE_LEGATO ? 'legato' : 'shift' };
      wantsSlideTarget = true;
      found = true;
    } else if (flags & (SLIDE_OUT_DOWN | SLIDE_OUT_UP)) {
      technique.slide = {
        type: 'slideOut',
        direction: flags & SLIDE_OUT_DOWN ? 'down' : 'up'
      };
      found = true;
    } else if (flags & (SLIDE_IN_FROM_BELOW | SLIDE_IN_FROM_ABOVE)) {
      technique.slide = {
        type: 'slideIn',
        direction: flags & SLIDE_IN_FROM_ABOVE ? 'down' : 'up'
      };
      found = true;
    }
  }
  const bend = buildBend(note);
  if (bend) {
    technique.bend = bend;
    found = true;
  }
  if (note.harmonicType !== null) {
    const type = HARMONIC_TYPES[note.harmonicType];
    if (type) {
      technique.harmonic = { type };
      found = true;
    }
  }
  if (note.palmMute) {
    technique.palmMute = true;
    found = true;
  }

  return {
    technique: found || wantsHammerTarget ? technique : null,
    wantsHammerTarget,
    wantsSlideTarget
  };
}

/**
 * The bend CURVE from GPIF's seven floats. Values are percent of a whole tone
 * (100 = 2 semitones, so semitones = value / 50); offsets are percent of the
 * note's duration. Fixture evidence (field notes §8): a plain bend states only
 * origin and destination values, and the curve is the two endpoints.
 */
function buildBend(note: GpifNote): { points: MnxBendPoint[] } | null {
  const bend = note.bend;
  if (!bend) return null;

  const origin = (bend.originValue ?? 0) / 50;
  const destination = (bend.destinationValue ?? 0) / 50;

  const points: MnxBendPoint[] = [{ position: 0, alter: origin }];
  if (bend.originOffset !== null) {
    points.push({ position: bend.originOffset / 100, alter: origin });
  }
  if (bend.middleValue !== null) {
    // A middle with no explicit offset sits at the default midpoint of a
    // linear ramp — pure interpolation, carrying nothing the endpoints don't
    // (fixture evidence: origin 0 / middle 50 / destination 100, no offsets,
    // observed importing as the two endpoints alone). Only an offset-placed
    // middle bends the curve.
    const middle = bend.middleValue / 50;
    for (const offset of [bend.middleOffset1, bend.middleOffset2]) {
      if (offset !== null) points.push({ position: offset / 100, alter: middle });
    }
  }
  if (bend.destinationOffset !== null && bend.destinationOffset < 100) {
    points.push({ position: bend.destinationOffset / 100, alter: destination });
  }
  points.push({ position: 1, alter: destination });

  points.sort((a, b) => a.position - b.position);
  const deduped = points.filter(
    (point, index) =>
      index === 0 ||
      point.position !== points[index - 1].position ||
      point.alter !== points[index - 1].alter
  );

  // A curve that never leaves zero is no bend.
  if (!deduped.some(point => point.alter !== 0)) return null;
  return { points: deduped };
}

/**
 * Pairs hammer-on/slide origins with their destinations: the first later note
 * on the same string in the same voice chain. An origin with no destination
 * loses the adornment (a `hammerPull` without a target would dangle); a
 * shift/legato slide keeps its type and merely omits the target.
 */
function resolveTargets(records: NoteRecord[]): void {
  for (const [index, record] of records.entries()) {
    if (!record.wantsHammerTarget && !record.wantsSlideTarget) continue;

    let target: NoteRecord | null = null;
    for (let later = index + 1; later < records.length; later++) {
      const candidate = records[later];
      if (candidate.order > record.order && candidate.gpString === record.gpString) {
        target = candidate;
        break;
      }
    }

    const technique = record.technique;
    if (!technique) continue;

    if (record.wantsHammerTarget && target) technique.hammerPull = { target: target.id };
    if (record.wantsSlideTarget && target && technique.slide) {
      technique.slide.target = target.id;
    }

    // A hammer origin with no destination may leave the technique empty.
    if (Object.keys(technique).length === 0) {
      const mnxLab = record.note._x?.mnxLab;
      if (mnxLab?.tab) {
        delete mnxLab.tab;
        if (Object.keys(mnxLab).length === 0) delete record.note._x;
      }
    }
  }
}
