import { MnxPart, MnxPartMeasure, MnxSequence, MnxNote } from '../common/types.js';
import { addIdSuffix } from '../common/utils.js';

/**
 * Splits a unified 2-staff MNX part back into a standard notation part
 * and a guitar tablature part, applying transpositions and ID suffixes.
 */
export function splitPart(part: MnxPart): { standardPart: MnxPart; tabPart: MnxPart } {
  const standardMeasures: MnxPartMeasure[] = [];
  const tabMeasures: MnxPartMeasure[] = [];

  for (const measure of part.measures) {
    // standard staff sequences (staff === 1 or undefined)
    const stdSeqs = measure.sequences
      .filter(seq => seq.staff === 1 || seq.staff === undefined)
      .map(seq => copySequenceStd(seq));

    // tab staff sequences (staff === 2)
    const tabSeqs = measure.sequences
      .filter(seq => seq.staff === 2)
      .map(seq => copySequenceWithTabProperties(seq));

    standardMeasures.push({
      clefs: [{ clef: { sign: 'G', staffPosition: -2 } }],
      sequences: stdSeqs
    });

    tabMeasures.push({
      clefs: [{ clef: { sign: 'TAB' } }],
      sequences: tabSeqs
    });
  }

  // Carry transposition from the merged part. If absent, fall back to guitar standard (-12 chromatic, -7 diatonic).
  const transposition = part.transposition ?? {
    interval: {
      halfSteps: -12,
      staffDistance: -7
    }
  };

  const standardPart: MnxPart = {
    id: `${part.id}-std`,
    name: part.name,
    staves: 1,
    measures: standardMeasures,
    transposition,
    _x: part._x
  };

  const tabPart: MnxPart = {
    id: `${part.id}-tab`,
    name: part.name,
    staves: 1,
    measures: tabMeasures,
    _x: part._x
  };

  return { standardPart, tabPart };
}

/**
 * Copies a standard-staff sequence preserving IDs and stripping guitar fret/string annotations.
 * NOTE: Pitches are stored as sounding pitches in MNX. The exporter (mnx.ts) is responsible
 * for converting them back to written pitches using part.transposition when writing XML.
 */
function copySequenceStd(seq: MnxSequence): MnxSequence {
  return {
    ...seq,
    staff: undefined,
    content: seq.content.map(event => ({
      ...event,
      notes: event.notes?.map(note => {
        const copyNote: MnxNote = {
          ...note,
          pitch: { ...note.pitch } // sounding pitch — no octave shift applied here
        };
        if (note.id) {
          copyNote.id = addIdSuffix(note.id, 'std');
        }
        // Strip _x guitar fret/string annotations to keep treble notation clean
        if (copyNote._x?.guitar) {
          delete copyNote._x.guitar;
          if (Object.keys(copyNote._x).length === 0) {
            delete copyNote._x;
          }
        }
        return copyNote;
      })
    }))
  };
}

function copySequenceWithTabProperties(seq: MnxSequence): MnxSequence {
  return {
    ...seq,
    staff: undefined,
    content: seq.content.map(event => ({
      ...event,
      notes: event.notes?.map(note => {
        const copyNote: MnxNote = {
          ...note,
          pitch: { ...note.pitch } // TAB pitch matches sounding pitch
        };
        if (note.id) {
          copyNote.id = addIdSuffix(note.id, 'tab');
        }
        return copyNote;
      })
    }))
  };
}
export function isMergedPart(part: MnxPart): boolean {
  return part.staves === 2;
}
