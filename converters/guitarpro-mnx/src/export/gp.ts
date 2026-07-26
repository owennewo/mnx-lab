import * as alphaTab from '@coderline/alphatab';
import {
  MnxStructure,
  MnxPart,
  MnxSequence,
  MnxEvent,
  MnxNote,
  MnxHarmony,
  isTimedEvent
} from '../common/types.js';
import { renderChordSymbol } from '../common/harmony.js';
import {
  mnxBaseToAlphaTab,
  mnxDurationToWholes,
  wholesToFraction
} from '../common/duration.js';
import {
  mnxStringToAlphaTab,
  mnxTuningToAlphaTab,
  pitchToMidi,
  choosePosition
} from '../common/tuning.js';

const M = alphaTab.model;

/** General MIDI program 25 — Acoustic Guitar (steel). */
export const DEFAULT_GUITAR_MIDI_PROGRAM = 25;

export interface ExportOptions {
  /** Called for anything the Guitar Pro format or this converter cannot carry. */
  onWarning?: (message: string) => void;
  /**
   * General MIDI program for tab parts. Guitar Pro derives the instrument name,
   * staff line count and playback sound from this — leaving it at the default 0
   * makes a guitar tab open as an Acoustic Piano on a 5-line staff.
   */
  midiProgram?: number;
  /**
   * Collapse a note written in two voices at one fingerboard position down to
   * a single note (default true).
   *
   * A string is one physical object. When the same string+fret appears in two
   * voices at the same instant — standard fingerstyle engraving for a note
   * shared between a bass line and the melody — Guitar Pro cannot show it, and
   * consumers disagree: Ultimate Guitar silently re-frets the duplicate onto
   * another string, producing a note nobody plays. Writing it once removes the
   * ambiguity. Set false to reproduce the document literally.
   */
  collapseTabUnisons?: boolean;
}

/**
 * Verse order for lyric lines: the document's declared `lineOrder` when present,
 * otherwise the line ids in first-appearance order. Guitar Pro identifies verses
 * only by position, so this ordering IS the mapping.
 */
function resolveLyricLineOrder(mnx: MnxStructure): string[] {
  const declared = mnx.global?.lyrics?.lineOrder;
  if (declared?.length) return [...declared];

  const seen: string[] = [];
  for (const part of mnx.parts)
    for (const measure of part.measures)
      for (const sequence of measure.sequences ?? [])
        for (const item of sequence.content ?? [])
          if (isTimedEvent(item))
            for (const id of Object.keys(item.lyrics?.lines ?? {}))
              if (!seen.includes(id)) seen.push(id);
  return seen;
}

/**
 * Decides which notes to drop so no string is claimed twice at one instant.
 *
 * Only exact unisons are collapsed (same string AND same fret) — those are one
 * note written twice. Two *different* frets on one string is unplayable however
 * it renders, so it is left alone and reported rather than silently "fixed".
 *
 * Which copy survives matters: dropping the melody's note would leave a hole in
 * the melodic line. So the keeper is the one standing alone in its event, over
 * one that is a member of a chord (which keeps its other notes either way);
 * ties go to the lower voice.
 */
function planUnisonCollapse(
  sequences: MnxSequence[],
  onCollapse: (stringNumber: number, fret: number) => void
): Set<MnxNote> {
  interface Claim {
    note: MnxNote;
    fret: number;
    voiceIndex: number;
    chordSize: number;
  }

  const byOnsetAndString = new Map<string, Claim[]>();

  sequences.forEach((sequence, voiceIndex) => {
    let onset = 0;
    for (const item of sequence.content ?? []) {
      if (!isTimedEvent(item)) return; // timing unknowable from here on
      for (const note of item.notes ?? []) {
        const position = note._x?.mnxLab?.tab?.position;
        if (position) {
          const key = `${Math.round(onset * 1e6)}:${position.string}`;
          const list = byOnsetAndString.get(key) ?? [];
          list.push({
            note,
            fret: position.fret,
            voiceIndex,
            chordSize: item.notes?.length ?? 1
          });
          byOnsetAndString.set(key, list);
        }
      }
      onset += mnxDurationToWholes(item.duration.base, item.duration.dots ?? 0);
    }
  });

  const suppressed = new Set<MnxNote>();
  for (const claims of byOnsetAndString.values()) {
    if (claims.length < 2) continue;
    if (new Set(claims.map(c => c.fret)).size > 1) continue; // real conflict — leave it

    const keeper = [...claims].sort(
      (a, b) => a.chordSize - b.chordSize || a.voiceIndex - b.voiceIndex
    )[0];
    for (const claim of claims) {
      if (claim.note !== keeper.note && !suppressed.has(claim.note)) {
        suppressed.add(claim.note);
        onCollapse(claim.note._x!.mnxLab!.tab!.position!.string, claim.fret);
      }
    }
  }
  return suppressed;
}

/**
 * The `reference` argument of `Automation.buildTempoAutomation` is an INDEX
 * into alphaTab's multiplier table `[1, .5, 1, 1.5, 2, 3]`, not a note-value
 * denominator — it says which note value the BPM counts. Passing the
 * denominator (4 for a quarter) selects multiplier 2 and silently DOUBLES the
 * tempo: 180 bpm became 360.
 *
 *   1 → ×0.5  (eighth)        2 → ×1    (quarter, the default)
 *   3 → ×1.5  (dotted quarter) 4 → ×2   (half)      5 → ×3 (dotted half)
 */
function tempoReference(value: { base?: string; dots?: number } | undefined): number {
  const dotted = (value?.dots ?? 0) > 0;
  switch (value?.base) {
    case 'eighth':
      return 1;
    case 'half':
      return dotted ? 5 : 4;
    case 'quarter':
    default:
      return dotted ? 3 : 2;
  }
}

/** MNX clef sign → alphaTab Clef. */
function toAlphaTabClef(sign: string | undefined): number {
  switch (sign) {
    case 'F':
      return M.Clef.F4;
    case 'C':
      return M.Clef.C3;
    case 'G':
    default:
      return M.Clef.G2;
  }
}

/**
 * Converts an MNX document to a Guitar Pro 7 (`.gp`) file.
 *
 * `.gp` is the only Guitar Pro format anything can still *write* — alphaTab
 * ships a GP7 exporter but no gp3/gp4/gp5 writer, and neither does anything
 * else maintained. Guitar Pro 7/8 and Ultimate Guitar all read `.gp`.
 */
export function exportGuitarPro(mnx: MnxStructure, options: ExportOptions = {}): Uint8Array {
  const warn = options.onWarning ?? (() => {});
  const score = buildScore(mnx, warn, options);

  const settings = new alphaTab.Settings();
  score.finish(settings);

  return new alphaTab.exporter.Gp7Exporter().export(score, settings);
}

/** Builds the alphaTab `Score` graph. Exposed for tests and for reuse. */
export function buildScore(
  mnx: MnxStructure,
  warn: (message: string) => void = () => {},
  options: ExportOptions = {}
): alphaTab.model.Score {
  const score = new M.Score();

  const globalMeasures = mnx.global?.measures ?? [];
  const measureCount = Math.max(
    globalMeasures.length,
    ...mnx.parts.map(p => p.measures.length),
    1
  );

  // --- master bars: time signature, repeats, endings, tempo ---
  // MNX declares these change-only, so carry them forward.
  let numerator = 4;
  let denominator = 4;

  // MNX states a volta ONCE, on the bar it opens, spanning `duration`. Guitar
  // Pro instead flags every bar in the span: alphaTab draws the bracket's open
  // hook where a bar's mask differs from the previous bar's, and closes it
  // where it differs from the next. Flagging only the first bar would render a
  // one-bar bracket.
  const endingMaskByMeasure = new Map<number, number>();
  globalMeasures.forEach((globalMeasure, index) => {
    const numbers = globalMeasure.ending?.numbers;
    if (!numbers?.length) return;
    const mask = numbers.reduce((acc, n) => acc | (1 << (n - 1)), 0);
    const span = Math.max(1, globalMeasure.ending?.duration ?? 1);
    for (let offset = 0; offset < span; offset++) {
      endingMaskByMeasure.set(index + offset, mask);
    }
  });

  for (let index = 0; index < measureCount; index++) {
    const global = globalMeasures[index] ?? {};
    const masterBar = new M.MasterBar();

    if (global.time) {
      numerator = global.time.count;
      denominator = global.time.unit;
    }
    masterBar.timeSignatureNumerator = numerator;
    masterBar.timeSignatureDenominator = denominator;

    // Guitar Pro has one `Section` holding both a short marker and a name; MNX
    // Lab keeps them as separate objects because they are separate concepts.
    const rehearsal = global._x?.mnxLab?.rehearsal;
    const section = global._x?.mnxLab?.section;
    if (rehearsal || section) {
      masterBar.section = new M.Section();
      masterBar.section.marker = rehearsal?.label ?? '';
      masterBar.section.text = section?.label ?? '';
    }

    if (global.repeatStart) masterBar.isRepeatStart = true;
    if (global.repeatEnd) {
      // alphaTab's repeatCount is the number of PLAYS of the repeated section.
      masterBar.repeatCount = Math.max(2, global.repeatEnd.times ?? 2);
    }
    // Bitmask: ending "1" is bit 0, "2" is bit 1, … Set on every bar of the
    // span, not just the one MNX declares it on (see endingMaskByMeasure).
    const endingMask = endingMaskByMeasure.get(index);
    if (endingMask) masterBar.alternateEndings = endingMask;
    for (const tempo of global.tempos ?? []) {
      masterBar.tempoAutomations.push(
        M.Automation.buildTempoAutomation(false, 0, tempo.bpm, tempoReference(tempo.value))
      );
    }

    score.addMasterBar(masterBar);
  }

  // --- tracks ---
  const lyricLineOrder = resolveLyricLineOrder(mnx);
  for (const [index, part] of mnx.parts.entries()) {
    score.addTrack(buildTrack(part, mnx, measureCount, index, warn, options, lyricLineOrder));
  }

  return score;
}

function buildTrack(
  part: MnxPart,
  mnx: MnxStructure,
  measureCount: number,
  trackIndex: number,
  warn: (message: string) => void,
  options: ExportOptions,
  lyricLineOrder: string[]
): alphaTab.model.Track {
  const track = new M.Track();
  track.name = part.name ?? 'Guitar';

  // Guitar Pro reads the instrument (name, staff line count, playback sound)
  // from the MIDI program. Left at 0 it writes "Acoustic Piano" on a 5-line
  // staff, which is wrong for every tab document this converter produces.
  track.playbackInfo.program = options.midiProgram ?? DEFAULT_GUITAR_MIDI_PROGRAM;
  // Channel 9 is percussion in General MIDI; skip it when assigning channels.
  const channel = trackIndex * 2 >= 9 ? trackIndex * 2 + 2 : trackIndex * 2;
  track.playbackInfo.primaryChannel = channel;
  track.playbackInfo.secondaryChannel = channel + 1;

  const staff = new M.Staff();
  track.addStaff(staff);

  const tunings = mnxTuningToAlphaTab(part._x?.mnxLab?.tab?.tuning);
  staff.stringTuning.tunings = tunings;
  const capo = part._x?.mnxLab?.tab?.capo ?? 0;
  if (capo) staff.capo = capo;

  // `staffKind` is an MNX view flag; map it onto Guitar Pro's two staff toggles.
  const staffKind = part._x?.mnxLab?.tab?.staffKind ?? 'notation';
  staff.showTablature = staffKind === 'tab' || staffKind === 'both';
  staff.showStandardNotation = staffKind === 'notation' || staffKind === 'both';

  // Guitar notation sounds an octave below where it is written; Guitar Pro
  // stores this on the staff rather than as an MNX-style part transposition.
  staff.displayTranspositionPitch = -12;

  let clef = M.Clef.G2;
  let fifths = 0;

  for (let index = 0; index < measureCount; index++) {
    const measure = part.measures[index];
    const global = mnx.global?.measures?.[index];
    if (global?.key) fifths = global.key.fifths;

    const bar = new M.Bar();
    staff.addBar(bar);

    if (measure?.clefs?.length) clef = toAlphaTabClef(measure.clefs[0].clef.sign);
    bar.clef = clef;
    bar.keySignature = fifths;

    const sequences = measure?.sequences ?? [];
    if (sequences.length === 0) {
      // Guitar Pro has no concept of an absent bar — emit a silent one.
      const voice = new M.Voice();
      bar.addVoice(voice);
      voice.addBeat(makeRestBeat(4));
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
    // hangs them off a beat — so they are written onto the first voice of the
    // first track only. Writing them per track would restate one chord N times.
    const harmonyText =
      trackIndex === 0 ? harmonyTextByOnset(global?._x?.mnxLab?.harmonies) : undefined;

    for (const [voiceIndex, sequence] of sequences.entries()) {
      bar.addVoice(
        buildVoice(
          sequence,
          tunings,
          capo,
          index,
          warn,
          lyricLineOrder,
          suppressed,
          voiceIndex === 0 ? harmonyText : undefined
        )
      );
    }
  }

  return track;
}

function makeRestBeat(duration: number, dots = 0): alphaTab.model.Beat {
  const beat = new M.Beat();
  beat.duration = duration;
  beat.dots = dots;
  return beat; // a beat with no notes IS a rest in alphaTab
}

/** Chord symbols for one measure, keyed by the `location` fraction they sit at,
 *  so a beat can look up whether a chord starts on it. */
function harmonyTextByOnset(
  harmonies: MnxHarmony[] | undefined
): Map<string, string> | undefined {
  if (!harmonies?.length) return undefined;
  const map = new Map<string, string>();
  for (const harmony of harmonies) {
    const [numerator, denominator] = harmony.location.fraction;
    map.set(`${numerator}/${denominator}`, harmony.text ?? renderChordSymbol(harmony));
  }
  return map;
}

function buildVoice(
  sequence: MnxSequence,
  tunings: number[],
  capo: number,
  measureIndex: number,
  warn: (message: string) => void,
  lyricLineOrder: string[],
  suppressed: Set<MnxNote>,
  harmonyText?: Map<string, string>
): alphaTab.model.Voice {
  const voice = new M.Voice();

  if (sequence.fullMeasure) {
    voice.addBeat(makeRestBeat(M.Duration.Whole));
    return voice;
  }

  let onset = 0;
  for (const item of sequence.content) {
    if (!isTimedEvent(item)) {
      // Grace notes and tuplets are not modelled yet; dropping them silently
      // would shift every following beat, so say so.
      warn(
        `measure ${measureIndex + 1}: skipped an unsupported ` +
          `"${(item as { type?: string }).type ?? 'unknown'}" container ` +
          `(grace notes and tuplets are not exported yet).`
      );
      continue;
    }
    const beat = buildBeat(item, tunings, capo, measureIndex, warn, lyricLineOrder, suppressed);
    if (beat) {
      const [numerator, denominator] = wholesToFraction(onset);
      const chord = harmonyText?.get(`${numerator}/${denominator}`);
      if (chord) beat.text = chord;
      voice.addBeat(beat);
    }
    onset += mnxDurationToWholes(item.duration.base, item.duration.dots ?? 0);
  }

  if (voice.beats.length === 0) voice.addBeat(makeRestBeat(M.Duration.Whole));
  return voice;
}

function buildBeat(
  event: MnxEvent,
  tunings: number[],
  capo: number,
  measureIndex: number,
  warn: (message: string) => void,
  lyricLineOrder: string[],
  suppressed: Set<MnxNote>
): alphaTab.model.Beat | null {
  const duration = mnxBaseToAlphaTab(event.duration.base);
  if (duration === null) {
    warn(
      `measure ${measureIndex + 1}: duration "${event.duration.base}" has no ` +
        `Guitar Pro equivalent; the event was skipped.`
    );
    return null;
  }

  const beat = new M.Beat();
  beat.duration = duration;
  beat.dots = event.duration.dots ?? 0;
  applyLyrics(beat, event, lyricLineOrder);

  // A rest, or an event with no notes, stays an empty beat.
  if (event.rest || !event.notes?.length) return beat;

  for (const note of event.notes) {
    if (suppressed.has(note)) continue; // same string+fret already written by another voice
    const midi = pitchToMidi(note.pitch);
    // Prefer the authored fingering; fall back to a playable one so pitches
    // from non-tab documents still export.
    let position = note._x?.mnxLab?.tab?.position;
    if (!position) {
      const chosen = choosePosition(midi, tunings, 24, capo);
      if (!chosen) {
        warn(
          `measure ${measureIndex + 1}: pitch is outside the instrument's range ` +
            `on this tuning; the note was skipped.`
        );
        continue;
      }
      position = chosen;
    }

    const alphaTabNote = new M.Note();
    alphaTabNote.string = mnxStringToAlphaTab(position.string, tunings.length);
    alphaTabNote.fret = position.fret;

    applyTechniques(alphaTabNote, note._x?.mnxLab?.tab?.technique);
    if (note.ties?.some(tie => !tie.lv)) alphaTabNote.isTieDestination = false;

    beat.addNote(alphaTabNote);
  }

  return beat;
}

/**
 * MNX `event.lyrics` → alphaTab `beat.lyrics` (one entry per verse, by index).
 *
 * Guitar Pro stores lyrics as ONE text blob per verse at track level, which
 * alphaTab re-splits on whitespace; a syllable that continues into the next one
 * is marked by a trailing `-` (`par-` + `ting`). That is precisely MNX's
 * `start`/`middle` line type, so hyphenation survives — see the round-trip
 * caveats in roadmap/inprogress/guitar-pro.md for what does not.
 */
function applyLyrics(
  beat: alphaTab.model.Beat,
  event: MnxEvent,
  lyricLineOrder: string[]
): void {
  const lines = event.lyrics?.lines;
  if (!lines || lyricLineOrder.length === 0) return;

  const slots = new Array<string>(lyricLineOrder.length).fill('');
  let any = false;

  for (const [lineId, line] of Object.entries(lines)) {
    const index = lyricLineOrder.indexOf(lineId);
    if (index < 0 || !line?.text) continue;
    const continues = line.type === 'start' || line.type === 'middle';
    // A space inside a syllable would be read as a syllable break.
    slots[index] = line.text.replace(/\s+/g, '+') + (continues ? '-' : '');
    any = true;
  }

  if (any) beat.lyrics = slots;
}

function applyTechniques(
  note: alphaTab.model.Note,
  technique: import('../common/types.js').MnxTabTechnique | undefined
): void {
  if (!technique) return;

  if (technique.vibrato) note.vibrato = M.VibratoType.Slight;
  if (technique.hammerOn || technique.pullOff) note.isHammerPullOrigin = true;
  if (technique.palmMute) note.isPalmMute = true;
  if (technique.harmonic) {
    note.harmonicType = HARMONIC_TYPES[technique.harmonic.type] ?? M.HarmonicType.Natural;
  }

  if (technique.slide) {
    // MNX's four slide kinds split across alphaTab's two enums. A `shift`
    // (slide between two fretted notes) is NOT a `slide-out` (sliding off the
    // end into nothing) — mapping shift onto OutUp silently changes the
    // technique.
    switch (technique.slide.type) {
      case 'legato':
        note.slideOutType = M.SlideOutType.Legato;
        break;
      case 'slideOut':
        note.slideOutType =
          technique.slide.direction === 'down'
            ? M.SlideOutType.OutDown
            : M.SlideOutType.OutUp;
        break;
      case 'slideIn':
        note.slideInType =
          technique.slide.direction === 'down'
            ? M.SlideInType.IntoFromAbove
            : M.SlideInType.IntoFromBelow;
        break;
      case 'shift':
      default:
        note.slideOutType = M.SlideOutType.Shift;
        break;
    }
  }

  if (technique.bend?.points?.length) {
    // The curve goes across verbatim: alphaTab's offsets run 0..60 and its
    // values are in quarter tones, against MNX Lab's 0..1 and semitones.
    for (const point of technique.bend.points) {
      note.addBendPoint(
        new M.BendPoint(Math.round(point.position * 60), Math.round(point.alter * 2))
      );
    }
    note.bendType = classifyBend(technique.bend.points);
  }
}

/**
 * Guitar Pro also wants the curve summarised as a `BendType`, which is a closed
 * list of shapes rather than a free curve — so it is derived from the points
 * rather than stored, and anything more elaborate than the named shapes falls
 * back to `Bend` (the points themselves still carry the detail).
 */
function classifyBend(points: { position: number; alter: number }[]): number {
  const first = points[0];
  const peak = Math.max(...points.map(point => point.alter));
  const last = points[points.length - 1];
  const prebent = first.position === 0 && first.alter > 0;

  if (prebent) return last.alter < peak ? M.BendType.PrebendRelease : M.BendType.PrebendBend;
  if (last.alter < peak) return M.BendType.BendRelease;
  return M.BendType.Bend;
}

const HARMONIC_TYPES: Record<string, number> = {
  natural: M.HarmonicType.Natural,
  artificial: M.HarmonicType.Artificial,
  pinch: M.HarmonicType.Pinch,
  tap: M.HarmonicType.Tap,
  semi: M.HarmonicType.Semi,
  feedback: M.HarmonicType.Feedback
};
