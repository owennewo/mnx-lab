import * as alphaTab from '@coderline/alphatab';
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
  MnxHarmonicType
} from '../common/types.js';
import { parseChordSymbol } from '../common/harmony.js';
import {
  alphaTabDurationToMnx,
  mnxDurationToWholes,
  tupletRatio,
  wholesToFraction
} from '../common/duration.js';
import { alphaTabStringToMnx, alphaTabTuningToMnx, midiToPitch } from '../common/tuning.js';

const M = alphaTab.model;

/** Stable MNX note id derived from alphaTab's (score-unique) note id. */
function noteId(note: alphaTab.model.Note): string {
  return `n${note.id}`;
}

export interface ImportOptions {
  /** Called for anything in the source this converter cannot represent. */
  onWarning?: (message: string) => void;
}

/** alphaTab Clef → MNX clef sign + staff position. */
function fromAlphaTabClef(clef: number): { sign: string; staffPosition?: number } {
  switch (clef) {
    case M.Clef.F4:
      return { sign: 'F', staffPosition: -4 };
    case M.Clef.C3:
      return { sign: 'C', staffPosition: -3 };
    case M.Clef.C4:
      return { sign: 'C', staffPosition: -4 };
    case M.Clef.G2:
    default:
      return { sign: 'G', staffPosition: -2 };
  }
}

/**
 * Reads any Guitar Pro file alphaTab understands — gp3/gp4/gp5 (binary),
 * gpx (GP6) and gp (GP7+) — into MNX.
 *
 * The whole binary/zip layer belongs to alphaTab; this converter only maps its
 * object model onto MNX. That is why the family is supported for free: alphaTab
 * normalises all five formats into one `Score` shape before we see it.
 */
export function importGuitarPro(data: Uint8Array, options: ImportOptions = {}): MnxStructure {
  const settings = new alphaTab.Settings();
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(data, settings);
  return scoreToMnx(score, options);
}

/** Converts an already-loaded alphaTab `Score` to MNX. */
export function scoreToMnx(
  score: alphaTab.model.Score,
  options: ImportOptions = {}
): MnxStructure {
  const warn = options.onWarning ?? (() => {});

  // Key signature per measure drives enharmonic spelling AND is emitted into
  // global.measures — Guitar Pro stores it per bar, MNX change-only.
  const fifthsByMeasure = resolveFifths(score, score.masterBars.length);
  const globalMeasures = buildGlobalMeasures(score, fifthsByMeasure);
  applyHarmonies(score, globalMeasures);

  const parts = score.tracks.map(track =>
    buildPart(track, fifthsByMeasure, warn)
  );

  // Guitar Pro identifies verses only by position, so line ids are 1..N. It
  // also allocates a slot per lyric line declared in the file, including empty
  // ones — declare only the verses that actually carry a syllable.
  const usedVerses = new Set<number>();
  for (const track of score.tracks)
    for (const staff of track.staves)
      for (const bar of staff.bars)
        for (const voice of bar.voices)
          for (const beat of voice.beats)
            (beat.lyrics ?? []).forEach((chunk, index) => {
              if (chunk && chunk.trim()) usedVerses.add(index);
            });

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

function buildGlobalMeasures(
  score: alphaTab.model.Score,
  fifthsByMeasure: number[]
): MnxGlobalMeasure[] {
  const measures: MnxGlobalMeasure[] = [];

  // MNX declares attributes change-only; track what has been emitted.
  let lastTime = '';
  let lastFifths: number | null = null;

  for (const [barIndex, masterBar] of score.masterBars.entries()) {
    const measure: MnxGlobalMeasure = {};

    const fifths = fifthsByMeasure[barIndex] ?? 0;
    if (fifths !== lastFifths) {
      measure.key = { fifths };
      lastFifths = fifths;
    }

    const timeKey = `${masterBar.timeSignatureNumerator}/${masterBar.timeSignatureDenominator}`;
    if (timeKey !== lastTime) {
      measure.time = {
        count: masterBar.timeSignatureNumerator,
        unit: masterBar.timeSignatureDenominator
      };
      lastTime = timeKey;
    }

    if (masterBar.isRepeatStart) measure.repeatStart = {};
    if (masterBar.repeatCount > 1) {
      measure.repeatEnd = { times: masterBar.repeatCount };
    }
    if (masterBar.isDoubleBar) measure.barline = { type: 'double' };

    // Section / rehearsal labels. Guitar Pro conflates the two into one
    // `Section{marker, text}`; we split them, because a rehearsal mark is an
    // arbitrary index into the score while a section name states what the music
    // IS. Written as the PROPOSED standard objects — see
    // roadmap/proposed/low-priority/spec-score-text.md; they validate against
    // schemas/mnx-schema.proposed.json until the CG adopts them.
    const marker = masterBar.section?.marker?.trim();
    const sectionText = masterBar.section?.text?.trim();
    if (marker) measure.rehearsal = { label: marker };
    if (sectionText) measure.section = { label: sectionText };

    for (const automation of masterBar.tempoAutomations ?? []) {
      measure.tempos = measure.tempos ?? [];
      measure.tempos.push({ bpm: automation.value, value: { base: 'quarter' } });
    }

    measures.push(measure);
  }

  collapseAlternateEndings(score, measures);
  return measures;
}

/**
 * Chord symbols → `global.measures[i]._x.mnxLab.harmonies`.
 *
 * Guitar Pro states a chord in two unrelated ways and this corpus uses both:
 * `beat.text` (a bare annotation string — all 25 in Vestapol) and a `Chord`
 * object referenced by `beat.chordId`, which carries a name and, optionally, a
 * fretboard diagram (all 14 in House of the Rising Sun). Both are read; the
 * diagram is not, because nothing in the corpus fills one in.
 *
 * Harmony is GLOBAL in MNX Lab — two parts cannot legitimately disagree about
 * the chord on a beat — so symbols are collected across every track and
 * de-duplicated by position. Guitar Pro stores them per beat, so the same chord
 * appears once per track in a multi-track score.
 */
function applyHarmonies(
  score: alphaTab.model.Score,
  measures: MnxGlobalMeasure[]
): void {
  const byMeasure = new Map<number, Map<string, MnxHarmony>>();

  for (const track of score.tracks) {
    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        for (const voice of bar.voices) {
          let onset = 0;
          for (const beat of voice.beats) {
            const symbol = beat.chord?.name?.trim() || beat.text?.trim() || '';
            const parsed = symbol ? parseChordSymbol(symbol) : null;
            if (parsed) {
              const fraction = wholesToFraction(onset);
              const key = `${fraction[0]}/${fraction[1]}`;
              const slot = byMeasure.get(bar.index) ?? new Map<string, MnxHarmony>();
              // First track wins; a later track restating the same chord is the
              // same musical fact, not a second one.
              if (!slot.has(key)) slot.set(key, { location: { fraction }, ...parsed });
              byMeasure.set(bar.index, slot);
            }
            const base = alphaTabDurationToMnx(beat.duration as number);
            if (base !== null) onset += mnxDurationToWholes(base, beat.dots);
          }
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

/**
 * Guitar Pro flags EVERY bar of a volta with the same ending mask; MNX states
 * the bracket once, on the bar it opens, with a `duration`. Collapse each run
 * of identical masks into a single ending so a round trip is stable rather than
 * fanning one 22-bar volta into 22 one-bar ones.
 */
function collapseAlternateEndings(
  score: alphaTab.model.Score,
  measures: MnxGlobalMeasure[]
): void {
  const maskAt = (index: number) => score.masterBars[index]?.alternateEndings ?? 0;

  for (let index = 0; index < measures.length; index++) {
    const mask = maskAt(index);
    if (!mask || mask === maskAt(index - 1)) continue; // not the start of a run

    let last = index;
    while (last + 1 < measures.length && maskAt(last + 1) === mask) last++;

    const numbers: number[] = [];
    for (let bit = 0; bit < 8; bit++) if (mask & (1 << bit)) numbers.push(bit + 1);

    const duration = last - index + 1;
    measures[index].ending = {
      numbers,
      ...(duration > 1 ? { duration } : {})
    };
  }
}

/** Key signature is per-bar in Guitar Pro; flatten to one value per measure. */
function resolveFifths(score: alphaTab.model.Score, measureCount: number): number[] {
  const fifths = new Array<number>(measureCount).fill(0);
  const bars = score.tracks[0]?.staves[0]?.bars ?? [];
  let current = 0;
  for (let index = 0; index < measureCount; index++) {
    const bar = bars[index];
    if (bar) current = bar.keySignature as number;
    fifths[index] = current;
  }
  return fifths;
}

function buildPart(
  track: alphaTab.model.Track,
  fifthsByMeasure: number[],
  warn: (message: string) => void
): MnxPart {
  const staff = track.staves[0];
  const tunings = staff?.stringTuning?.tunings ?? [];
  const stringCount = tunings.length;

  const measures: MnxPartMeasure[] = [];
  let lastClefKey = '';
  // Hyphen continuation state per voice — a syllable can continue across a
  // barline, so this must outlive a single measure.
  const lyricContinuation = new Map<number, boolean[]>();

  for (const [index, bar] of (staff?.bars ?? []).entries()) {
    const fifths = fifthsByMeasure[index] ?? 0;
    const measure: MnxPartMeasure = { sequences: [] };

    // Clefs are emitted change-only, matching the rest of the project.
    const clef = fromAlphaTabClef(bar.clef as number);
    const clefKey = `${clef.sign}/${clef.staffPosition}`;
    if (clefKey !== lastClefKey) {
      measure.clefs = [{ clef }];
      lastClefKey = clefKey;
    }

    for (const [voiceIndex, voice] of bar.voices.entries()) {
      // Only genuinely empty voice slots are dropped. A voice consisting
      // entirely of rests is real content — an earlier "skip all-rest voices"
      // filter silently deleted two such voices from the Sun-did-glide fixture.
      if (voice.beats.length === 0) continue;

      if (!lyricContinuation.has(voiceIndex)) lyricContinuation.set(voiceIndex, []);
      measure.sequences.push(
        buildSequence(
          voice,
          voiceIndex,
          tunings,
          stringCount,
          fifths,
          index,
          warn,
          lyricContinuation.get(voiceIndex)!
        )
      );
    }

    if (measure.sequences.length === 0) {
      measure.sequences.push({ voice: 'v1', content: [], fullMeasure: {} });
    }

    measures.push(measure);
  }

  const part: MnxPart = {
    id: `P${track.index + 1}`,
    name: track.name || 'Guitar',
    measures
  };

  if (stringCount > 0) {
    part._x = {
      mnxLab: {
        strings: alphaTabTuningToMnx(tunings, fifthsByMeasure[0] ?? 0),
        ...(staff?.capo ? { capo: staff.capo } : {}),
        // Guitar Pro scores are single-source tab+notation, which is exactly
        // the tab extension's model — no merge step needed.
        tab: { staffKind: 'both' }
      }
    };
  }

  return part;
}

function buildSequence(
  voice: alphaTab.model.Voice,
  voiceIndex: number,
  tunings: number[],
  stringCount: number,
  fifths: number,
  measureIndex: number,
  warn: (message: string) => void,
  previousChunks: boolean[]
): MnxSequence {
  const content: MnxSequenceItem[] = [];

  // Grace beats and tuplet beats are both RUNS in Guitar Pro — a per-beat flag
  // repeated across neighbours — and both are single CONTAINERS in MNX. So the
  // walk buffers a run and flushes it when the run ends, the same shape the
  // volta import already uses for its per-bar flags.
  let graceRun: MnxEvent[] = [];
  let tupletRun: { events: MnxEvent[]; group: alphaTab.model.TupletGroup } | null = null;

  /** A finished grace run, emitted immediately BEFORE the beat it decorates —
   *  which is where MNX puts the container and where Guitar Pro's own
   *  `BeforeBeat` graces already sit in beat order. */
  const flushGrace = (beat: alphaTab.model.Beat | null) => {
    if (graceRun.length === 0) return;
    if (tupletRun) {
      // MNX tuplet content is events, not containers, so a grace decorating an
      // inner note of a tuplet has nowhere to nest. It is emitted ahead of the
      // whole group instead — the notes survive, their attachment point does
      // not, and that is worth a line rather than a silent move.
      warn(
        `measure ${measureIndex + 1}: a grace note inside a tuplet was moved ahead ` +
          `of the group (MNX tuplets contain events, not containers).`
      );
    }
    const grace: MnxGrace = { type: 'grace', content: graceRun };
    // Guitar Pro's two grace kinds say WHERE the time comes from: `BeforeBeat`
    // is the acciaccatura crushed in ahead of the beat (it borrows from what
    // came before), `OnBeat` lands on the beat and delays its principal.
    // MNX names the same two `stealPrevious` and `stealFollowing`. Slash is
    // left unstated: both render slashed by default, and Guitar Pro carries no
    // separate flag to contradict that with.
    if (beat?.graceType === M.GraceType.OnBeat) grace.graceType = 'stealFollowing';
    else grace.graceType = 'stealPrevious';
    content.push(grace);
    graceRun = [];
  };

  const flushTuplet = () => {
    if (!tupletRun) return;
    const { events, group } = tupletRun;
    tupletRun = null;
    const first = group.beats[0];
    const ratio = tupletRatio(
      events.map(e => mnxDurationToWholes(e.duration.base, e.duration.dots ?? 0)),
      first.tupletNumerator,
      first.tupletDenominator
    );
    if (!ratio) {
      // An incomplete group — Guitar Pro will happily leave two beats flagged
      // 3:2 — performs in a time no MNX duration × multiple spells. Emitting
      // the events flat keeps the pitches and says what was lost, rather than
      // inventing a ratio that changes the rhythm silently.
      warn(
        `measure ${measureIndex + 1}: a ${first.tupletNumerator}:${first.tupletDenominator} ` +
          `tuplet of ${events.length} beat(s) does not fill a whole group; its notes ` +
          `were written without the tuplet.`
      );
      content.push(...events);
      return;
    }
    content.push({ type: 'tuplet', content: events, ...ratio });
  };

  for (const beat of voice.beats) {
    const base = alphaTabDurationToMnx(beat.duration as number);
    if (base === null) {
      warn(
        `measure ${measureIndex + 1}: unsupported Guitar Pro duration ` +
          `(${beat.duration}); the beat was skipped.`
      );
      continue;
    }

    const event: MnxEvent = {
      duration: beat.dots > 0 ? { base, dots: beat.dots } : { base }
    };

    if (beat.notes.length === 0) {
      event.rest = {};
    } else {
      event.notes = beat.notes.map(note =>
        buildNote(note, tunings, stringCount, fifths)
      );
    }

    const lyrics = buildLyrics(beat, previousChunks);
    if (lyrics) event.lyrics = lyrics;

    if (beat.graceType !== M.GraceType.None) {
      // A grace beat inside a tuplet's span is still un-timed, so it neither
      // joins the group nor ends it — alphaTab's own TupletGroup.check() takes
      // the same view.
      graceRun.push(event);
      continue;
    }

    // alphaTab has already decided which flagged beats form one group
    // (`TupletGroup`, filled by written duration, so six flagged eighths are
    // two triplets and not one six-note tuplet). Following its grouping rather
    // than re-deriving one from the flags is what keeps the two agreeing.
    const group = beat.tupletGroup;
    if (tupletRun && tupletRun.group !== group) flushTuplet();
    if (group) {
      flushGrace(beat);
      if (!tupletRun) tupletRun = { events: [], group };
      tupletRun.events.push(event);
      continue;
    }

    flushGrace(beat);
    content.push(event);
  }

  flushTuplet();
  flushGrace(null);

  return { voice: `v${voiceIndex + 1}`, content };
}

/**
 * alphaTab `beat.lyrics` (one entry per verse, by index) → MNX
 * `event.lyrics.lines`.
 *
 * Guitar Pro marks a syllable that continues into the next one with a trailing
 * `-`; MNX says the same thing with `type: 'start' | 'middle'`. Telling *start*
 * from *middle* needs the previous chunk of the same verse, so
 * `previousContinued` is carried across beats.
 */
function buildLyrics(
  beat: alphaTab.model.Beat,
  previousContinued: boolean[]
): { lines: Record<string, MnxEventLyricLine> } | undefined {
  const chunks = beat.lyrics;
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
  note: alphaTab.model.Note,
  tunings: number[],
  stringCount: number,
  fifths: number
): MnxNote {
  // `realValue` is alphaTab's resolved sounding pitch — it already accounts for
  // tuning, capo and transposition, so it is more reliable than recomputing.
  //
  // Every note gets an id: technique targets (hammer-on/pull-off destinations)
  // are id REFERENCES, so without ids on the notes themselves every target
  // dangles. alphaTab's note id is already unique across the score.
  const mnxNote: MnxNote = {
    id: noteId(note),
    pitch: midiToPitch(note.realValue, fifths)
  };

  if (note.string > 0) {
    mnxNote._x = {
      mnxLab: {
        string: alphaTabStringToMnx(note.string, stringCount),
        fret: note.fret
      }
    };
  }

  const technique = readTechniques(note);
  if (technique) {
    mnxNote._x = mnxNote._x ?? {};
    mnxNote._x.mnxLab = { ...mnxNote._x.mnxLab, tab: { technique } };
  }

  return mnxNote;
}

/**
 * Guitar Pro carries playing technique natively, so this is the first converter
 * in the project able to populate `_x.mnxLab.tab.technique` (the MusicXML importer
 * still leaves it empty).
 */
function readTechniques(note: alphaTab.model.Note): MnxTabTechnique | undefined {
  const technique: MnxTabTechnique = {};
  let found = false;

  if (note.vibrato !== M.VibratoType.None) {
    technique.vibrato = true;
    found = true;
  }
  if (note.isHammerPullOrigin) {
    // ONE adornment (extension v6): the direction stays implicit in the two
    // pitches, exactly as alphaTab's own single origin flag has it.
    const destination = note.hammerPullDestination;
    if (destination) {
      technique.hammerPull = { target: noteId(destination) };
      found = true;
    }
  }
  // The inverse of the export mapping: alphaTab splits slides across two enums,
  // and `Shift`/`Legato` (between two notes) are distinct from `Out*` (off the
  // end) and `Into*` (onto the note from nowhere).
  if (note.slideOutType === M.SlideOutType.Shift || note.slideOutType === M.SlideOutType.Legato) {
    technique.slide = {
      type: note.slideOutType === M.SlideOutType.Legato ? 'legato' : 'shift',
      // Only these kinds have a destination.
      ...(note.slideTarget ? { target: noteId(note.slideTarget) } : {})
    };
    found = true;
  } else if (
    note.slideOutType === M.SlideOutType.OutUp ||
    note.slideOutType === M.SlideOutType.OutDown
  ) {
    technique.slide = {
      type: 'slideOut',
      direction: note.slideOutType === M.SlideOutType.OutDown ? 'down' : 'up'
    };
    found = true;
  } else if (note.slideInType !== M.SlideInType.None) {
    technique.slide = {
      type: 'slideIn',
      direction: note.slideInType === M.SlideInType.IntoFromAbove ? 'down' : 'up'
    };
    found = true;
  }
  // The bend CURVE, not just its peak. alphaTab's points are (offset 0..60,
  // value in quarter tones); MNX Lab's are (position 0..1, alter in semitones).
  // Reading only the maximum — as this converter used to — silently flattens a
  // bend that rises, releases and rises again into a single ramp.
  if (note.bendType !== M.BendType.None && note.bendPoints?.length) {
    const points = note.bendPoints.map(point => ({
      position: point.offset / 60,
      alter: point.value / 2
    }));
    if (points.some(point => point.alter !== 0)) {
      // A single point is not a curve: a lone peak means "bend to here".
      if (points.length === 1) points.unshift({ position: 0, alter: 0 });
      technique.bend = { points };
      found = true;
    }
  }
  if (note.harmonicType !== M.HarmonicType.None) {
    const type = HARMONIC_TYPES[note.harmonicType as number];
    if (type) {
      technique.harmonic = { type };
      found = true;
    }
  }
  if (note.isPalmMute) {
    technique.palmMute = true;
    found = true;
  }

  return found ? technique : undefined;
}

const HARMONIC_TYPES: Record<number, MnxHarmonicType> = {
  [M.HarmonicType.Natural]: 'natural',
  [M.HarmonicType.Artificial]: 'artificial',
  [M.HarmonicType.Pinch]: 'pinch',
  [M.HarmonicType.Tap]: 'tap',
  [M.HarmonicType.Semi]: 'semi',
  [M.HarmonicType.Feedback]: 'feedback'
};
