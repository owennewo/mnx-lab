import { DOMParser } from '@xmldom/xmldom';
import {
  MnxBend,
  MnxEvent,
  MnxGlobalMeasure,
  MnxHarmony,
  MnxHarmonyStep,
  MnxNote,
  MnxPart,
  MnxPartMeasure,
  MnxPitch,
  MnxStructure
} from '../common/types.js';
import {
  renderChordSymbol,
  stepToText,
  QUALITY_TO_XML_KIND
} from '../common/harmony.js';
import { serializeXML } from '../common/xml.js';
import { splitPart, hasTabContent } from './splitter.js';
import { flattenSequences, FlatXmlNode } from './flattener.js';
import { divisionsFor, getXmlNoteType } from '../common/utils.js';

// Chromatic semitone offsets for each diatonic step (C=0)
const STEP_SEMITONES_EXP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const STEP_NAMES_EXP = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/**
 * Converts a sounding pitch (as stored in MNX) back to a written pitch (as required by MusicXML).
 * Applies the INVERSE of the transposition interval:
 *   written = sounding - transposition
 */
function transposePitchToWritten(
  pitch: MnxPitch,
  transposition: { interval: { halfSteps: number; staffDistance?: number } }
): MnxPitch {
  const chromatic = transposition.interval.halfSteps;
  const diatonic = transposition.interval.staffDistance ?? 0;
  if (chromatic === 0 && diatonic === 0) return pitch;

  // Invert: written = sounding - transposition
  const invChromatic = -chromatic;
  const invDiatonic = -diatonic;

  const srcStepIdx = STEP_NAMES_EXP.indexOf(pitch.step as any);
  const srcAlter = pitch.alter || 0;

  // Absolute sounding semitone from C0
  const srcAbsSemitone = pitch.octave * 12 + STEP_SEMITONES_EXP[pitch.step] + srcAlter;
  const writtenAbsSemitone = srcAbsSemitone + invChromatic;

  // Apply diatonic step shift
  const newStepRaw = srcStepIdx + invDiatonic;
  const newStepIdx = ((newStepRaw % 7) + 7) % 7;
  const newStep = STEP_NAMES_EXP[newStepIdx];

  // Determine new octave
  const newStepSemitone = STEP_SEMITONES_EXP[newStep];
  const roughOctave = Math.floor(writtenAbsSemitone / 12);
  let newOctave = roughOctave;
  if (newStepSemitone > writtenAbsSemitone - roughOctave * 12 + 6) {
    newOctave = roughOctave - 1;
  }

  const newAlter = writtenAbsSemitone - (newOctave * 12 + newStepSemitone);

  return {
    step: newStep,
    octave: newOctave,
    alter: newAlter !== 0 ? newAlter : undefined
  };
}

export interface ExportOptions {
  splitNotationAndTab?: boolean;
  divisions?: number;
}

export function exportMusicXML(
  mnxJson: MnxStructure,
  options: ExportOptions = {}
): string {
  const splitNotationAndTab = options.splitNotationAndTab !== false; // default true
  // Raised where the document needs it: a triplet's `<duration>` is a third of
  // a written value, and only a divisions count divisible by 3 can state it.
  const divisions = divisionsFor(mnxJson.parts, options.divisions || 8);
  const lyricLineOrder = mnxJson.global?.lyrics?.lineOrder ?? [];

  // MNX states a volta once, on the measure it starts, spanning `duration`.
  // MusicXML needs a bracket opened on that measure and closed on the last one,
  // so precompute both ends. (The importer also accepts the per-measure form
  // Soundslice emits, but writing the standard one keeps the file portable.)
  const endingStartsAt = new Map<number, { numbers?: number[]; open?: boolean }>();
  const endingStopsAt = new Map<number, { numbers?: number[]; open?: boolean }>();
  (mnxJson.global?.measures ?? []).forEach((globalMeasure, index) => {
    const ending = globalMeasure.ending;
    if (!ending) return;
    endingStartsAt.set(index, ending);
    endingStopsAt.set(index + Math.max(1, ending.duration ?? 1) - 1, ending);
  });

  // Sounding-pitch midi per note id — the hammerPull adornment stores no
  // direction (extension v6), so the MusicXML element (<hammer-on> vs
  // <pull-off>) is derived at this boundary from the two pitches.
  const noteMidiById = new Map<string, number>();
  for (const part of mnxJson.parts ?? []) {
    for (const measure of part.measures ?? []) {
      for (const sequence of measure.sequences ?? []) {
        const walk = (items: typeof sequence.content): void => {
          for (const item of items) {
            const content = (item as { content?: typeof sequence.content }).content;
            if (content) { walk(content); continue; }
            for (const note of (item as { notes?: { id?: string; pitch?: MnxPitch }[] }).notes ?? []) {
              if (note.id && note.pitch) {
                noteMidiById.set(
                  note.id,
                  note.pitch.octave * 12 + STEP_SEMITONES_EXP[note.pitch.step] + (note.pitch.alter ?? 0)
                );
              }
            }
          }
        };
        walk(sequence.content ?? []);
      }
    }
  }

  // MusicXML spanner markers per note id, derived from MNX's id references.
  //
  // MNX states a tie or slur ONCE, on the element it starts from, pointing at
  // where it ends. MusicXML states both ends, and numbers its slurs so that
  // overlapping ones can be told apart. So this inverts the references, and
  // allocates slur numbers by interval colouring: the smallest number whose
  // previous slur has already closed. Ties need no number — `<tied>` pairs by
  // pitch and voice, which is exactly what the importer relies on.
  const spannerMarks = new Map<string, SpannerMarks>();
  const markNote = (id: string, apply: (m: SpannerMarks) => void): void => {
    const marks = spannerMarks.get(id) ?? {};
    apply(marks);
    spannerMarks.set(id, marks);
  };
  for (const part of mnxJson.parts ?? []) {
    const eventById = new Map<string, ExportEvent>();
    const noteOrder = new Map<string, number>();
    const events: ExportEvent[] = [];
    let ordinal = 0;
    const collect = (items: ExportEvent[]): void => {
      for (const item of items) {
        const content = (item as { content?: ExportEvent[] }).content;
        if (content) { collect(content); continue; }
        if (item.id) eventById.set(item.id, item);
        events.push(item);
        for (const note of item.notes ?? []) {
          if (note.id) noteOrder.set(note.id, ordinal);
          ordinal++;
        }
      }
    };
    for (const measure of part.measures ?? []) {
      for (const sequence of measure.sequences ?? []) collect((sequence.content ?? []) as ExportEvent[]);
    }

    for (const event of events) {
      for (const note of event.notes ?? []) {
        for (const tie of note.ties ?? []) {
          if (!note.id || !tie.target) continue;
          markNote(note.id, m => { m.tieStart = true; });
          markNote(tie.target, m => { m.tieStop = true; });
        }
      }
    }

    const pairs: { start: string; end: string; side?: 'up' | 'down'; from: number }[] = [];
    for (const event of events) {
      for (const slur of event.slurs ?? []) {
        const target = eventById.get(slur.target);
        const start = slur.startNote ?? event.notes?.[0]?.id;
        const end = slur.endNote ?? target?.notes?.[0]?.id;
        // A slur pointing at an event that is not there is dropped, not
        // guessed at — the same rule the technique targets follow.
        if (!target || !start || !end) continue;
        pairs.push({ start, end, ...(slur.side ? { side: slur.side } : {}), from: noteOrder.get(start) ?? 0 });
      }
    }
    pairs.sort((a, b) => a.from - b.from);
    const freeAfter = new Map<number, number>();
    for (const pair of pairs) {
      let number = 1;
      while ((freeAfter.get(number) ?? -1) >= pair.from) number++;
      freeAfter.set(number, noteOrder.get(pair.end) ?? pair.from);
      markNote(pair.start, m => {
        (m.slurStarts ??= []).push({ number, ...(pair.side ? { side: pair.side } : {}) });
      });
      markNote(pair.end, m => { (m.slurStops ??= []).push(number); });
    }
  }

  const doc = new DOMParser().parseFromString(
    '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"></score-partwise>',
    'text/xml'
  );
  const scoreEl = doc.documentElement;

  // 1. Add Identification/Metadata
  const identificationEl = doc.createElement('identification');
  const encodingEl = doc.createElement('encoding');
  const softwareEl = doc.createElement('software');
  softwareEl.textContent = 'mnx-editor converter';
  const dateEl = doc.createElement('encoding-date');
  dateEl.textContent = new Date().toISOString().split('T')[0];
  encodingEl.appendChild(softwareEl);
  encodingEl.appendChild(dateEl);
  identificationEl.appendChild(encodingEl);
  scoreEl.appendChild(identificationEl);

  // 2. Determine Parts (split standard & TAB if requested)
  const finalParts: MnxPart[] = [];
  const partMap = new Map<string, string>(); // partId -> partName

  for (const part of mnxJson.parts) {
    if (splitNotationAndTab && hasTabContent(part)) {
      const { standardPart, tabPart } = splitPart(part);
      finalParts.push(standardPart, tabPart);
      partMap.set(standardPart.id, `${part.name}`);
      partMap.set(tabPart.id, `${part.name} (TAB)`);
    } else {
      finalParts.push(part);
      partMap.set(part.id, part.name);
    }
  }

  // 3. Create <part-list>
  const partListEl = doc.createElement('part-list');
  for (const [id, name] of partMap.entries()) {
    const scorePartEl = doc.createElement('score-part');
    scorePartEl.setAttribute('id', id);
    const partNameEl = doc.createElement('part-name');
    partNameEl.textContent = name;
    scorePartEl.appendChild(partNameEl);
    partListEl.appendChild(scorePartEl);
  }
  scoreEl.appendChild(partListEl);

  // 4. Create <part> elements
  for (const [partIndex, part] of finalParts.entries()) {
    const partEl = doc.createElement('part');
    partEl.setAttribute('id', part.id);

    // Track active attribute states to avoid duplicate tags
    let activeKeyFifths: number | null = null;
    let activeTimeCount: number | null = null;
    let activeTimeUnit: number | null = null;
    let activeClefSign: string | null = null;

    const numMeasures = part.measures.length;

    for (let m = 0; m < numMeasures; m++) {
      const measure = part.measures[m];
      const globalM = mnxJson.global.measures[m] || {};
      const measureEl = doc.createElement('measure');
      measureEl.setAttribute('number', `${m + 1}`);

      // Check for attribute updates
      const attributesEl = doc.createElement('attributes');
      let attributesChanged = false;

      // Always write divisions in measure 1
      if (m === 0) {
        const divsEl = doc.createElement('divisions');
        divsEl.textContent = `${divisions}`;
        attributesEl.appendChild(divsEl);
        attributesChanged = true;
      }

      // Key signature
      if (globalM.key && globalM.key.fifths !== activeKeyFifths) {
        activeKeyFifths = globalM.key.fifths;
        const keyEl = doc.createElement('key');
        const fifthsEl = doc.createElement('fifths');
        fifthsEl.textContent = `${activeKeyFifths}`;
        keyEl.appendChild(fifthsEl);
        attributesEl.appendChild(keyEl);
        attributesChanged = true;
      }

      // Time signature
      if (globalM.time && (globalM.time.count !== activeTimeCount || globalM.time.unit !== activeTimeUnit)) {
        activeTimeCount = globalM.time.count;
        activeTimeUnit = globalM.time.unit;
        const timeEl = doc.createElement('time');
        const beatsEl = doc.createElement('beats');
        beatsEl.textContent = `${activeTimeCount}`;
        const beatTypeEl = doc.createElement('beat-type');
        beatTypeEl.textContent = `${activeTimeUnit}`;
        timeEl.appendChild(beatsEl);
        timeEl.appendChild(beatTypeEl);
        attributesEl.appendChild(timeEl);
        attributesChanged = true;
      }

      // Clef
      const firstClef = measure.clefs?.[0]?.clef;
      if (firstClef && firstClef.sign !== activeClefSign) {
        activeClefSign = firstClef.sign;
        const clefEl = doc.createElement('clef');
        const signEl = doc.createElement('sign');
        signEl.textContent = activeClefSign;
        clefEl.appendChild(signEl);
        
        if (firstClef.staffPosition !== undefined) {
          const lineEl = doc.createElement('line');
          lineEl.textContent = `${Math.abs(firstClef.staffPosition)}`;
          clefEl.appendChild(lineEl);
        }
        attributesEl.appendChild(clefEl);
        attributesChanged = true;
      }

      // Transposition
      if (m === 0 && part.transposition) {
        const transposeEl = doc.createElement('transpose');
        const chromaticEl = doc.createElement('chromatic');
        chromaticEl.textContent = `${part.transposition.interval.halfSteps}`;
        transposeEl.appendChild(chromaticEl);
        if (part.transposition.interval.staffDistance !== undefined) {
          const diatonicEl = doc.createElement('diatonic');
          diatonicEl.textContent = `${part.transposition.interval.staffDistance}`;
          transposeEl.appendChild(diatonicEl);
        }
        attributesEl.appendChild(transposeEl);
        attributesChanged = true;
      }

      // Staff details (tuning) for TAB clefs
      if (m === 0 && activeClefSign === 'TAB') {
        const tuning = part._x?.mnxLab?.strings;
        const numStrings = tuning?.length || 6;

        const staffDetailsEl = doc.createElement('staff-details');
        const staffLinesEl = doc.createElement('staff-lines');
        staffLinesEl.textContent = `${numStrings}`;
        staffDetailsEl.appendChild(staffLinesEl);

        if (tuning) {
          // MusicXML staff-tuning is keyed by visual line (1 = bottom line =
          // lowest-pitched string); extension entries carry explicit string
          // numbers (1 = highest-pitched). line = numStrings - string + 1.
          const ordered = [...tuning].sort((a, b) => b.string - a.string);
          for (const entry of ordered) {
            const pitch = entry.pitch;
            const staffTuningEl = doc.createElement('staff-tuning');
            staffTuningEl.setAttribute('line', `${numStrings - entry.string + 1}`);

            const stepEl = doc.createElement('tuning-step');
            stepEl.textContent = pitch.step;
            const octaveEl = doc.createElement('tuning-octave');
            octaveEl.textContent = `${pitch.octave}`;

            staffTuningEl.appendChild(stepEl);
            staffTuningEl.appendChild(octaveEl);
            if (pitch.alter !== undefined) {
              const alterEl = doc.createElement('tuning-alter');
              alterEl.textContent = `${pitch.alter}`;
              staffTuningEl.appendChild(alterEl);
            }
            staffDetailsEl.appendChild(staffTuningEl);
          }
        }

        // `<capo>` follows the tunings in the MusicXML content model. Losing it
        // detunes the whole part, since `_x.mnxLab` frets are measured from it.
        const capo = part._x?.mnxLab?.capo;
        if (capo) {
          const capoEl = doc.createElement('capo');
          capoEl.textContent = `${capo}`;
          staffDetailsEl.appendChild(capoEl);
        }

        attributesEl.appendChild(staffDetailsEl);
        attributesChanged = true;
      }

      if (attributesChanged) {
        measureEl.appendChild(attributesEl);
      }

      // Rehearsal mark and section name. MusicXML has `<rehearsal>` for the
      // index; the formal section name has no element of its own and goes in
      // `<words>` of the same direction.
      const rehearsal = globalM.rehearsal;
      const section = globalM.section;
      if (rehearsal || section) {
        const directionEl = doc.createElement('direction');
        directionEl.setAttribute('placement', 'above');
        const typeEl = doc.createElement('direction-type');
        if (rehearsal) {
          const rehearsalEl = doc.createElement('rehearsal');
          rehearsalEl.textContent = rehearsal.label;
          typeEl.appendChild(rehearsalEl);
        }
        if (section) {
          const wordsEl = doc.createElement('words');
          wordsEl.textContent = section.label;
          typeEl.appendChild(wordsEl);
        }
        directionEl.appendChild(typeEl);
        measureEl.appendChild(directionEl);
      }

      // Metronome marks. `<direction>` precedes the notes it sits above;
      // `<sound tempo>` is what players/DAWs actually read.
      for (const tempo of globalM.tempos ?? []) {
        const directionEl = doc.createElement('direction');
        directionEl.setAttribute('placement', 'above');

        const typeEl = doc.createElement('direction-type');
        const metronomeEl = doc.createElement('metronome');
        const beatUnitEl = doc.createElement('beat-unit');
        beatUnitEl.textContent = getXmlNoteType(tempo.value?.base ?? 'quarter');
        metronomeEl.appendChild(beatUnitEl);
        for (let d = 0; d < (tempo.value?.dots ?? 0); d++) {
          metronomeEl.appendChild(doc.createElement('beat-unit-dot'));
        }
        const perMinuteEl = doc.createElement('per-minute');
        perMinuteEl.textContent = `${tempo.bpm}`;
        metronomeEl.appendChild(perMinuteEl);
        typeEl.appendChild(metronomeEl);
        directionEl.appendChild(typeEl);

        const soundEl = doc.createElement('sound');
        soundEl.setAttribute('tempo', `${tempo.bpm}`);
        directionEl.appendChild(soundEl);

        measureEl.appendChild(directionEl);
      }

      // Left barline: a forward repeat and the opening of a volta bracket sit
      // BEFORE the measure's notes.
      const openingEnding = endingStartsAt.get(m);
      if (globalM.repeatStart || openingEnding) {
        const barlineEl = doc.createElement('barline');
        barlineEl.setAttribute('location', 'left');
        if (openingEnding) {
          barlineEl.appendChild(buildEndingElement(doc, openingEnding.numbers, 'start'));
        }
        if (globalM.repeatStart) {
          const repeatEl = doc.createElement('repeat');
          repeatEl.setAttribute('direction', 'forward');
          barlineEl.appendChild(repeatEl);
        }
        measureEl.appendChild(barlineEl);
      }

      // 5. Flatten and append events, interleaving chord symbols.
      //
      // Harmony is global in MNX Lab but per-part in MusicXML, so it is written
      // to the FIRST part only — writing it to every part (including the TAB
      // half of a split) would print the same chord grid twice.
      const flatNodes = flattenSequences(measure.sequences, divisions);
      const pending =
        partIndex === 0
          ? (globalM._x?.mnxLab?.harmonies ?? []).map(harmony => ({
              // fraction of a whole note → divisions (which count per quarter)
              position: Math.round(
                (harmony.location.fraction[0] / harmony.location.fraction[1]) * divisions * 4
              ),
              harmony
            }))
          : [];

      let cursor = 0;
      for (const node of flatNodes) {
        while (pending.length > 0 && pending[0].position <= cursor) {
          measureEl.appendChild(buildHarmonyElement(doc, pending.shift()!.harmony, 0));
        }
        measureEl.appendChild(
          buildXmlNode(doc, node, part.transposition, lyricLineOrder, noteMidiById, spannerMarks)
        );
        if (node.type === 'backup') cursor -= node.duration;
        else if (!node.isChord) cursor += node.duration;
      }
      // Anything left sits past the last note in the measure; `<offset>` places
      // it without inventing a note to hang it on.
      for (const { position, harmony } of pending) {
        measureEl.appendChild(buildHarmonyElement(doc, harmony, position - cursor));
      }

      // Right barline: bar style, the close of a volta, and a backward repeat
      // all belong AFTER the notes.
      const closingEnding = endingStopsAt.get(m);
      if (globalM.barline || closingEnding || globalM.repeatEnd) {
        const barlineEl = doc.createElement('barline');
        barlineEl.setAttribute('location', 'right');
        // MusicXML fixes this order: bar-style, then ending, then repeat.
        if (globalM.barline) {
          const barStyleEl = doc.createElement('bar-style');
          barStyleEl.textContent = mapBarlineStyleToXml(globalM.barline.type);
          barlineEl.appendChild(barStyleEl);
        }
        if (closingEnding) {
          barlineEl.appendChild(
            buildEndingElement(
              doc,
              closingEnding.numbers,
              closingEnding.open ? 'discontinue' : 'stop'
            )
          );
        }
        if (globalM.repeatEnd) {
          const repeatEl = doc.createElement('repeat');
          repeatEl.setAttribute('direction', 'backward');
          // `times` is only meaningful above the implied 2 plays.
          if (globalM.repeatEnd.times && globalM.repeatEnd.times > 2) {
            repeatEl.setAttribute('times', `${globalM.repeatEnd.times}`);
          }
          barlineEl.appendChild(repeatEl);
        }
        measureEl.appendChild(barlineEl);
      }

      partEl.appendChild(measureEl);
    }
    scoreEl.appendChild(partEl);
  }

  return serializeXML(doc);
}

/**
 * `<ending number="1,2" type="start"/>`. The `number` attribute is required and
 * must be a comma-separated list of the volta's numbers; consumers key the
 * bracket's label off it.
 */
function buildEndingElement(
  doc: Document,
  numbers: number[] | undefined,
  type: 'start' | 'stop' | 'discontinue'
): Element {
  const endingEl = doc.createElement('ending');
  endingEl.setAttribute('number', (numbers ?? []).join(',') || '1');
  endingEl.setAttribute('type', type);
  return endingEl;
}

/**
 * One chord symbol → `<harmony>`.
 *
 * `<kind text>` carries the *displayed suffix* (`m7` in `Am7`), so a display
 * override has to be split back into root, suffix and bass — MusicXML has
 * nowhere to put a full literal symbol. A spelling that contradicts the
 * structure (a lowercase root, say) therefore normalises on the way through;
 * the structure itself is preserved exactly.
 */
function buildHarmonyElement(doc: Document, harmony: MnxHarmony, offset: number): Element {
  const harmonyEl = doc.createElement('harmony');

  const appendStep = (parent: Element, step: MnxHarmonyStep, prefix: string) => {
    const stepEl = doc.createElement(`${prefix}-step`);
    stepEl.textContent = step.step;
    parent.appendChild(stepEl);
    if (step.alter) {
      const alterEl = doc.createElement(`${prefix}-alter`);
      alterEl.textContent = `${step.alter}`;
      parent.appendChild(alterEl);
    }
  };

  if (harmony.root) {
    const rootEl = doc.createElement('root');
    appendStep(rootEl, harmony.root, 'root');
    harmonyEl.appendChild(rootEl);
  }

  const kindEl = doc.createElement('kind');
  kindEl.textContent = QUALITY_TO_XML_KIND[harmony.quality] ?? 'other';
  const displayed = harmony.text ?? renderChordSymbol(harmony);
  const suffix = harmonySuffix(displayed, harmony);
  if (suffix !== null) kindEl.setAttribute('text', suffix);
  harmonyEl.appendChild(kindEl);

  if (harmony.bass) {
    const bassEl = doc.createElement('bass');
    appendStep(bassEl, harmony.bass, 'bass');
    harmonyEl.appendChild(bassEl);
  }

  for (const degree of harmony.degrees ?? []) {
    const degreeEl = doc.createElement('degree');
    const valueEl = doc.createElement('degree-value');
    valueEl.textContent = `${degree.value}`;
    const alterEl = doc.createElement('degree-alter');
    alterEl.textContent = `${degree.alter ?? 0}`;
    const typeEl = doc.createElement('degree-type');
    typeEl.textContent = degree.type;
    degreeEl.appendChild(valueEl);
    degreeEl.appendChild(alterEl);
    degreeEl.appendChild(typeEl);
    harmonyEl.appendChild(degreeEl);
  }

  if (offset !== 0) {
    const offsetEl = doc.createElement('offset');
    offsetEl.textContent = `${offset}`;
    harmonyEl.appendChild(offsetEl);
  }

  return harmonyEl;
}

/** The part of a displayed symbol that sits between root and slash-bass. */
function harmonySuffix(displayed: string, harmony: MnxHarmony): string | null {
  if (!harmony.root) return null;
  const root = stepToText(harmony.root);
  const bass = harmony.bass ? `/${stepToText(harmony.bass)}` : '';
  if (!displayed.toLowerCase().startsWith(root.toLowerCase())) return null;
  const tail = displayed.slice(root.length);
  return bass && tail.endsWith(bass) ? tail.slice(0, -bass.length) : tail;
}

/**
 * A bend curve → the run of `<bend>` elements MusicXML uses to describe it.
 *
 * Each element states a signed interval from the current bent pitch, so the
 * absolute points are differenced. A first point already off the unbent pitch
 * is a `<pre-bend/>`; any downward step is a `<release/>`, whose interval
 * MusicXML writes unsigned.
 */
function buildBendElements(doc: Document, bend: MnxBend | undefined): Element[] {
  const points = bend?.points ?? [];
  if (points.length < 2) return [];

  const elements: Element[] = [];
  const push = (semitones: number, kind?: 'pre-bend' | 'release') => {
    const bendEl = doc.createElement('bend');
    const alterEl = doc.createElement('bend-alter');
    alterEl.textContent = `${semitones}`;
    // <pre-bend>/<release> must follow <bend-alter> per the content model.
    bendEl.appendChild(alterEl);
    if (kind) bendEl.appendChild(doc.createElement(kind));
    elements.push(bendEl);
  };

  if (points[0].alter !== 0) push(Math.abs(points[0].alter), 'pre-bend');
  for (let index = 1; index < points.length; index++) {
    const delta = points[index].alter - points[index - 1].alter;
    if (delta === 0) continue;
    if (delta > 0) push(delta);
    else push(Math.abs(delta), 'release');
  }
  return elements;
}

/** The MusicXML spanner markers one note carries, inverted from MNX's
 *  single-ended id references. */
interface SpannerMarks {
  tieStart?: boolean;
  tieStop?: boolean;
  slurStarts?: { number: number; side?: 'up' | 'down' }[];
  slurStops?: number[];
}

/** The event shape this file walks: MNX events, possibly nested in containers. */
type ExportEvent = MnxEvent & { content?: ExportEvent[] };

/** MNX barline type → MusicXML bar-style (inverse of the importer's mapping). */
function mapBarlineStyleToXml(type?: string): string {
  switch (type) {
    case 'regular': return 'regular';
    case 'dotted': return 'dotted';
    case 'dashed': return 'dashed';
    case 'heavy': return 'heavy';
    case 'double': return 'light-light';
    case 'final': return 'light-heavy';
    case 'heavyLight': return 'heavy-light';
    case 'heavyHeavy': return 'heavy-heavy';
    case 'tick': return 'tick';
    case 'short': return 'short';
    case 'noBarline': return 'none';
    default: return 'regular';
  }
}

function buildXmlNode(
  doc: Document,
  node: FlatXmlNode,
  transposition?: MnxPart['transposition'],
  lineOrder: string[] = [],
  noteMidiById: Map<string, number> = new Map(),
  spannerMarks: Map<string, SpannerMarks> = new Map()
): Element {
  if (node.type === 'backup') {
    const el = doc.createElement('backup');
    const durEl = doc.createElement('duration');
    durEl.textContent = `${node.duration}`;
    el.appendChild(durEl);
    return el;
  }
  if (node.type === 'forward') {
    const el = doc.createElement('forward');
    const durEl = doc.createElement('duration');
    durEl.textContent = `${node.duration}`;
    el.appendChild(durEl);
    return el;
  }

  const noteEl = doc.createElement('note');

  // MusicXML fixes the child order of <note>:
  //   grace?, chord?, (pitch|rest|unpitched), duration, voice?, type?, dot*,
  //   accidental?, time-modification?, notations*
  // so <accidental>, <time-modification> and <notations> are built here but
  // appended below, after <duration>/<voice>/<type>/<dot>.
  let accidentalEl: Element | undefined;
  let notationsEl: Element | undefined;

  if (node.grace) {
    // `<grace>` opens the note and REPLACES `<duration>` — a grace note is
    // un-timed, and giving it a duration is what makes a bar overflow.
    //
    // The steal direction rides on `slash`, which is the universal convention
    // and the only one real exporters write: a slashed grace is the
    // acciaccatura crushed in before the beat, an unslashed one the
    // appoggiatura that delays what follows. MNX names the two independently,
    // so an unusual pairing normalises here — the same trade this converter
    // already makes for legato slides, which MusicXML also cannot say directly.
    const graceEl = doc.createElement('grace');
    graceEl.setAttribute('slash', node.grace.graceType === 'stealFollowing' ? 'no' : 'yes');
    noteEl.appendChild(graceEl);
  }

  if (node.isChord) {
    noteEl.appendChild(doc.createElement('chord'));
  }

  if (node.type === 'rest') {
    noteEl.appendChild(doc.createElement('rest'));
  } else if (node.note) {
    // Convert sounding pitch (MNX) → written pitch (MusicXML) if transposition is defined
    const writtenPitch: MnxPitch = transposition
      ? transposePitchToWritten(node.note.pitch, transposition)
      : node.note.pitch;

    // Pitch
    const pitchEl = doc.createElement('pitch');
    const stepEl = doc.createElement('step');
    stepEl.textContent = writtenPitch.step;
    const octaveEl = doc.createElement('octave');
    octaveEl.textContent = `${writtenPitch.octave}`;
    
    pitchEl.appendChild(stepEl);
    pitchEl.appendChild(octaveEl);
    if (writtenPitch.alter !== undefined) {
      const alterEl = doc.createElement('alter');
      alterEl.textContent = `${writtenPitch.alter}`;
      pitchEl.appendChild(alterEl);
    }
    noteEl.appendChild(pitchEl);

    // ID attribute on note (MusicXML 3.0+ support)
    if (node.note.id) {
      noteEl.setAttribute('id', node.note.id);
    }

    // Accidental
    if (node.note.accidentalDisplay?.show) {
      accidentalEl = doc.createElement('accidental');
      accidentalEl.textContent =
        writtenPitch.alter === 1 ? 'sharp' : writtenPitch.alter === -1 ? 'flat' : 'natural';
    }

    // Technical (fingerboard position + playing technique)
    const noteExt = node.note._x?.mnxLab;
    const position =
      noteExt?.string !== undefined && noteExt?.fret !== undefined
        ? { string: noteExt.string, fret: noteExt.fret }
        : undefined;
    const technique = noteExt?.tab?.technique;
    if (position || technique) {
      notationsEl = doc.createElement('notations');

      // <slide> is a child of <notations>, NOT <technical>, and the content
      // model orders these slur → slide → technical.
      if (technique?.slide) {
        // MusicXML has no legato/shift distinction of its own: the convention
        // is that a LEGATO slide is slurred (picked once) while a shift slide
        // is not. Without the slur the two are indistinguishable on re-import.
        if (technique.slide.type === 'legato') {
          const slurEl = doc.createElement('slur');
          slurEl.setAttribute('type', 'start');
          slurEl.setAttribute('number', '1');
          notationsEl.appendChild(slurEl);
        }
        const slideEl = doc.createElement('slide');
        slideEl.setAttribute('type', 'start');
        notationsEl.appendChild(slideEl);
      }

      const techEl = doc.createElement('technical');

      if (position) {
        // MusicXML orders <technical> children string-then-fret in practice;
        // both are read by tag, so order only matters for readability.
        const fretEl = doc.createElement('fret');
        fretEl.textContent = `${position.fret}`;
        const stringEl = doc.createElement('string');
        stringEl.textContent = `${position.string}`;
        techEl.appendChild(fretEl);
        techEl.appendChild(stringEl);
      }

      if (technique?.hammerPull) {
        // ONE adornment in the extension (v6); MusicXML wants the direction
        // named, so derive it here: up hammers, down pulls. An unresolvable
        // target defaults to hammer-on — the commoner gesture.
        const here = node.note.pitch
          ? node.note.pitch.octave * 12 +
            STEP_SEMITONES_EXP[node.note.pitch.step] +
            (node.note.pitch.alter ?? 0)
          : undefined;
        const there = noteMidiById.get(technique.hammerPull.target);
        const el = doc.createElement(
          here !== undefined && there !== undefined && there < here ? 'pull-off' : 'hammer-on'
        );
        el.setAttribute('type', 'start');
        el.setAttribute('number', '1');
        techEl.appendChild(el);
      }
      // A bend CURVE becomes a run of `<bend>` gestures, one per change of
      // pitch, each stating the interval to travel from where the string
      // currently is. MusicXML has no way to say WHEN each point falls, so the
      // timing is the one thing this round trip normalises.
      for (const bendEl of buildBendElements(doc, technique?.bend)) {
        techEl.appendChild(bendEl);
      }

      if (technique?.harmonic) {
        const harmonicEl = doc.createElement('harmonic');
        harmonicEl.appendChild(
          doc.createElement(technique.harmonic.type === 'natural' ? 'natural' : 'artificial')
        );
        techEl.appendChild(harmonicEl);
        // MusicXML knows only natural and artificial; Guitar Pro's other four
        // kinds ride along so a round trip does not silently downgrade them.
        if (technique.harmonic.type !== 'natural' && technique.harmonic.type !== 'artificial') {
          const otherEl = doc.createElement('other-technical');
          otherEl.textContent = `harmonic:${technique.harmonic.type}`;
          techEl.appendChild(otherEl);
        }
      }

      // MusicXML 4.0 has no palm-mute element — exactly the "techniques ride on
      // generic elements" complaint w3c-cg/mnx#63 was opened about.
      if (technique?.palmMute) {
        const otherEl = doc.createElement('other-technical');
        otherEl.textContent = 'palm-mute';
        techEl.appendChild(otherEl);
      }

      if (techEl.childNodes.length > 0) notationsEl.appendChild(techEl);
    }
  }

  // Duration — omitted for grace notes, which have none by definition.
  if (!node.grace) {
    const durEl = doc.createElement('duration');
    durEl.textContent = `${node.duration}`;
    noteEl.appendChild(durEl);
  }

  // `<tie>` is the SOUND of a tie and belongs here, immediately after
  // `<duration>` and before `<voice>`, per MusicXML's fixed child order; its
  // notated twin `<tied>` goes in `<notations>` below. Writing both is what
  // the spec's own examples do, and readers differ on which one they trust.
  const marks = node.note?.id ? spannerMarks.get(node.note.id) : undefined;
  if (marks?.tieStop) {
    const tieEl = doc.createElement('tie');
    tieEl.setAttribute('type', 'stop');
    noteEl.appendChild(tieEl);
  }
  if (marks?.tieStart) {
    const tieEl = doc.createElement('tie');
    tieEl.setAttribute('type', 'start');
    noteEl.appendChild(tieEl);
  }

  // Voice
  if (node.voice) {
    const voiceEl = doc.createElement('voice');
    voiceEl.textContent = node.voice;
    noteEl.appendChild(voiceEl);
  }

  // Note type + dots, from the MNX duration this node was flattened from.
  if (node.base) {
    const typeEl = doc.createElement('type');
    typeEl.textContent = getXmlNoteType(node.base);
    noteEl.appendChild(typeEl);

    for (let d = 0; d < (node.dots || 0); d++) {
      noteEl.appendChild(doc.createElement('dot'));
    }
  }

  if (accidentalEl) noteEl.appendChild(accidentalEl);

  // Stop before start on both, so a chain reads end-then-begin the way every
  // MusicXML writer emits it.
  if (marks?.tieStop || marks?.tieStart || marks?.slurStops || marks?.slurStarts) {
    notationsEl = notationsEl ?? doc.createElement('notations');
    for (const type of ['stop', 'start'] as const) {
      if (type === 'stop' ? marks.tieStop : marks.tieStart) {
        const tiedEl = doc.createElement('tied');
        tiedEl.setAttribute('type', type);
        notationsEl.appendChild(tiedEl);
      }
    }
    for (const number of marks.slurStops ?? []) {
      const slurEl = doc.createElement('slur');
      slurEl.setAttribute('number', `${number}`);
      slurEl.setAttribute('type', 'stop');
      notationsEl.appendChild(slurEl);
    }
    for (const start of marks.slurStarts ?? []) {
      const slurEl = doc.createElement('slur');
      slurEl.setAttribute('number', `${start.number}`);
      if (start.side) slurEl.setAttribute('placement', start.side === 'up' ? 'above' : 'below');
      slurEl.setAttribute('type', 'start');
      notationsEl.appendChild(slurEl);
    }
  }

  if (node.tuplet) {
    // The arithmetic half of a tuplet, on EVERY member: `<duration>` is
    // already the performed value, and `<time-modification>` is what tells a
    // reader the written `<type>` above it is not a contradiction.
    const modEl = doc.createElement('time-modification');
    const actualEl = doc.createElement('actual-notes');
    actualEl.textContent = `${node.tuplet.actualNotes}`;
    const normalEl = doc.createElement('normal-notes');
    normalEl.textContent = `${node.tuplet.normalNotes}`;
    modEl.appendChild(actualEl);
    modEl.appendChild(normalEl);
    // `<normal-type>` is only meaningful when it differs from the written
    // `<type>`; writing it always is legal and makes the ratio readable on its
    // own, which matters because importers in the wild lean on it.
    const normalTypeEl = doc.createElement('normal-type');
    normalTypeEl.textContent = node.tuplet.normalType;
    modEl.appendChild(normalTypeEl);
    noteEl.appendChild(modEl);

    // The visual half: one bracket per group, opened and closed on its outer
    // notes. `<time-modification>` alone would still play correctly — plenty
    // of exporters stop there, which is why the importer accepts that form —
    // but nothing would draw the bracket or the number.
    if (node.tuplet.start || node.tuplet.stop) {
      notationsEl = notationsEl ?? doc.createElement('notations');
      const tupletEl = doc.createElement('tuplet');
      tupletEl.setAttribute('type', node.tuplet.start ? 'start' : 'stop');
      tupletEl.setAttribute('number', '1');
      if (node.tuplet.start) tupletEl.setAttribute('bracket', 'yes');
      notationsEl.appendChild(tupletEl);
    }
  }

  if (notationsEl) noteEl.appendChild(notationsEl);

  // <lyric> closes the note (after <notations>, per the MusicXML content model).
  for (const lyricEl of buildLyricElements(doc, node, lineOrder)) {
    noteEl.appendChild(lyricEl);
  }

  return noteEl;
}

/** MNX `event.lyrics.lines` → one `<lyric number="…">` per verse. */
function buildLyricElements(
  doc: Document,
  node: FlatXmlNode,
  lineOrder: string[]
): Element[] {
  const lines = node.lyrics?.lines;
  if (!lines) return [];

  // Emit verses in document order so `number="1"` really is the first verse.
  const ids = Object.keys(lines).sort((a, b) => {
    const ia = lineOrder.indexOf(a);
    const ib = lineOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  const elements: Element[] = [];
  for (const id of ids) {
    const line = lines[id];
    if (!line?.text) continue;

    const lyricEl = doc.createElement('lyric');
    lyricEl.setAttribute('number', id);

    const syllabicEl = doc.createElement('syllabic');
    syllabicEl.textContent =
      line.type === 'start'
        ? 'begin'
        : line.type === 'middle'
          ? 'middle'
          : line.type === 'end'
            ? 'end'
            : 'single';
    lyricEl.appendChild(syllabicEl);

    const textEl = doc.createElement('text');
    textEl.textContent = line.text;
    lyricEl.appendChild(textEl);

    elements.push(lyricEl);
  }
  return elements;
}
