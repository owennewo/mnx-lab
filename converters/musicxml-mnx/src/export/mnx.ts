import { DOMParser } from '@xmldom/xmldom';
import { MnxStructure, MnxPart, MnxPartMeasure, MnxGlobalMeasure, MnxPitch, MnxNote } from '../common/types.js';
import { serializeXML } from '../common/xml.js';
import { splitPart, isMergedPart } from './splitter.js';
import { flattenSequences, FlatXmlNode } from './flattener.js';
import { getXmlNoteType } from '../common/utils.js';

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
  const divisions = options.divisions || 8;

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
    if (splitNotationAndTab && isMergedPart(part)) {
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
  for (const part of finalParts) {
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
        const staffDetailsEl = doc.createElement('staff-details');
        const staffLinesEl = doc.createElement('staff-lines');
        staffLinesEl.textContent = '6';
        staffDetailsEl.appendChild(staffLinesEl);

        const tuning = part._x?.guitar?.tuning;
        if (tuning && tuning.strings) {
          const strings = tuning.strings;
          // MusicXML strings are 1-indexed, E2 is string 6, E4 is string 1
          for (let i = 0; i < strings.length; i++) {
            const pitch = strings[i];
            const staffTuningEl = doc.createElement('staff-tuning');
            staffTuningEl.setAttribute('line', `${i + 1}`);
            
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
        attributesEl.appendChild(staffDetailsEl);
        attributesChanged = true;
      }

      if (attributesChanged) {
        measureEl.appendChild(attributesEl);
      }

      // Check barline style
      if (globalM.barline) {
        const barlineEl = doc.createElement('barline');
        const barStyleEl = doc.createElement('bar-style');
        barStyleEl.textContent = mapBarlineStyleToXml(globalM.barline.type);
        barlineEl.appendChild(barStyleEl);
        measureEl.appendChild(barlineEl);
      }

      // 5. Flatten and append events
      const flatNodes = flattenSequences(measure.sequences, divisions);
      for (const node of flatNodes) {
        measureEl.appendChild(buildXmlNode(doc, node, part.transposition));
      }

      partEl.appendChild(measureEl);
    }
    scoreEl.appendChild(partEl);
  }

  return serializeXML(doc);
}

function mapBarlineStyleToXml(type?: string): string {
  switch (type) {
    case 'regular': return 'regular';
    case 'dotted': return 'dotted';
    case 'dashed': return 'dashed';
    case 'double': return 'double';
    case 'light-heavy': return 'light-heavy';
    case 'final': return 'final';
    default: return 'regular';
  }
}

function buildXmlNode(
  doc: Document,
  node: FlatXmlNode,
  transposition?: MnxPart['transposition']
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
      const accEl = doc.createElement('accidental');
      accEl.textContent = writtenPitch.alter === 1 ? 'sharp' : writtenPitch.alter === -1 ? 'flat' : 'natural';
      noteEl.appendChild(accEl);
    }

    // Technical (guitar frets, strings)
    if (node.note._x?.guitar) {
      const guitar = node.note._x.guitar;
      const notationsEl = doc.createElement('notations');
      const techEl = doc.createElement('technical');
      
      const fretEl = doc.createElement('fret');
      fretEl.textContent = `${guitar.fret}`;
      const stringEl = doc.createElement('string');
      stringEl.textContent = `${guitar.string}`;
      
      techEl.appendChild(fretEl);
      techEl.appendChild(stringEl);
      notationsEl.appendChild(techEl);
      noteEl.appendChild(notationsEl);
    }
  }

  // Duration
  const durEl = doc.createElement('duration');
  durEl.textContent = `${node.duration}`;
  noteEl.appendChild(durEl);

  // Voice
  if (node.voice) {
    const voiceEl = doc.createElement('voice');
    voiceEl.textContent = node.voice;
    noteEl.appendChild(voiceEl);
  }

  // Note type
  const typeEl = doc.createElement('type');
  typeEl.textContent = getXmlNoteType(node.note?.pitch ? 'quarter' : 'quarter'); // simplified
  noteEl.appendChild(typeEl);

  return noteEl;
}
