import { MnxPart, MnxPartMeasure, MnxSequence, MnxNote } from '../common/types.js';
import { addIdSuffix } from '../common/utils.js';

/**
 * Synthesizes the MusicXML notation+TAB pair from a SINGLE-SOURCE MNX part
 * (one note stream annotated with `_x.tab` positions — see
 * docs/tab-extension-spec.md). The duplicated two-staff form exists only at
 * the MusicXML boundary; it never appears in MNX documents.
 *
 * The transient tab part DOES carry a `{sign: 'TAB'}` clef — that is the
 * exporter's trigger for writing MusicXML's <clef> and <staff-details>
 * elements, which legitimately use TAB. These structures are export-internal.
 */
export function splitPart(part: MnxPart): { standardPart: MnxPart; tabPart: MnxPart } {
  const standardMeasures: MnxPartMeasure[] = [];
  const tabMeasures: MnxPartMeasure[] = [];

  for (const measure of part.measures) {
    standardMeasures.push({
      clefs: [{ clef: { sign: 'G', staffPosition: -2 } }],
      sequences: measure.sequences.map(seq => copySequenceStd(seq))
    });

    tabMeasures.push({
      clefs: [{ clef: { sign: 'TAB' } }],
      sequences: measure.sequences.map(seq => copySequenceTab(seq))
    });
  }

  // Carry transposition from the source part. If absent, fall back to guitar standard (-12 chromatic, -7 diatonic).
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
 * Copies a sequence for the notation staff: IDs suffixed `_std`, tab
 * annotations stripped so the treble staff stays clean.
 * NOTE: Pitches are stored as sounding pitches in MNX. The exporter (mnx.ts)
 * converts them back to written pitches using part.transposition.
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
        if (copyNote._x?.tab) {
          const { tab: _tab, ...restX } = copyNote._x;
          if (Object.keys(restX).length > 0) {
            copyNote._x = restX;
          } else {
            delete copyNote._x;
          }
        }
        return copyNote;
      })
    }))
  };
}

/**
 * Copies a sequence for the TAB staff: IDs suffixed `_tab`, tab annotations
 * (positions) kept so the exporter writes <technical><string>/<fret>.
 */
function copySequenceTab(seq: MnxSequence): MnxSequence {
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

/**
 * A part should be exported as a notation+TAB pair when it declares tab
 * content (the single-source form with a part-level `_x.tab` extension whose
 * staffKind asks for a tab view).
 */
export function hasTabContent(part: MnxPart): boolean {
  const kind = part._x?.tab?.staffKind;
  return kind === 'tab' || kind === 'both';
}
