import { DOMParser } from '@xmldom/xmldom';
import { MnxNoteValueBase, MnxPitch, MnxStep } from '../common/types.js';
import { GpScoreInfo } from '../common/scoreMetadata.js';

/**
 * GPIF (`score.gpif`) → typed pools.
 *
 * GPIF is flat pools of id-keyed objects joined by space-separated id lists —
 * see research/gpif-field-notes.md §3 for the graph and per-element evidence.
 * This module only parses; every musical judgement (grouping tuplets, pairing
 * hammer-ons, spelling pitches) belongs to `toMnx.ts`.
 *
 * The GP6 (`.gpx`) and GP7/8 (`.gp`) dialects differ in two places this
 * parser must branch on: track properties live under `Track/Properties` (GP6)
 * or `Track/Staves/Staff/Properties` (GP7+), and GP6 notes may state pitch as
 * `Tone`/`Octave` where GP7+ writes `Midi` + spelled pitches.
 */

export interface GpifDocument {
  /** The `<Score>` header, verbatim. Mapped to `_x.mnxLab.work` by `toMnx`. */
  metadata?: GpScoreInfo;
  masterBars: GpifMasterBar[];
  tracks: GpifTrack[];
  bars: Map<number, GpifBar>;
  voices: Map<number, GpifVoice>;
  beats: Map<number, GpifBeat>;
  notes: Map<number, GpifNote>;
  rhythms: Map<number, GpifRhythm>;
  /** Tempo automations: 0-based master-bar index → bpm values in file order. */
  tempoAutomations: Map<number, number[]>;
}

export interface GpifMasterBar {
  /** One bar id per track, in track order. */
  barIds: number[];
  timeNumerator: number;
  timeDenominator: number;
  /** Signed fifths (`AccidentalCount`), or null when the bar declares no key. */
  fifths: number | null;
  repeatStart: boolean;
  /** Total plays when this bar closes a repeat, else null. */
  repeatCount: number | null;
  doubleBar: boolean;
  /** `Section/Letter` — a rehearsal mark. */
  sectionLetter: string | null;
  /** `Section/Text` — a section name. */
  sectionText: string | null;
  /** Volta numbers as a bitmask (bit 0 = ending 1), 0 when none. */
  alternateEndingsMask: number;
  /** `TripletFeel` — the played feel of this bar's pairs, verbatim. Guitar Pro
   *  stamps it on EVERY bar; `toMnx` states it only where it changes. */
  tripletFeel: string | null;
}

export interface GpifTrack {
  name: string;
  /** Open-string MIDI values ordered low→high — GPIF string 0 is the LOWEST. */
  tuningLowToHigh: number[];
  capo: number;
  /** Chord diagram id → chord name, from `DiagramCollection`. */
  chordNames: Map<number, string>;
}

export interface GpifBar {
  /** Voice ids as declared; -1 is an absent voice, not an authored rest. */
  voiceIds: number[];
  clef: string | null;
}

export interface GpifVoice {
  beatIds: number[];
}

export interface GpifBeat {
  rhythmRef: number;
  /** Note ids, or null when the beat is a rest. */
  noteIds: number[] | null;
  /** `GraceNotes` — 'BeforeBeat' | 'OnBeat' when this is a grace beat. */
  graceKind: string | null;
  /** `FreeText` — bare beat annotation (chord symbols in the wild). */
  freeText: string | null;
  /** `Chord` — id into the track's diagram collection. */
  chordId: number | null;
  /** `Lyrics/Line` texts, one per verse in declaration order; null when absent. */
  lyricLines: string[] | null;
}

export interface GpifRhythm {
  base: MnxNoteValueBase | null;
  dots: number;
  tupletNumerator: number;
  tupletDenominator: number;
}

export interface GpifBend {
  /** Legacy binary curves retain every control point in MNX units. */
  points?: { position: number; alter: number }[];
  originValue: number | null;
  originOffset: number | null;
  middleValue: number | null;
  middleOffset1: number | null;
  middleOffset2: number | null;
  destinationValue: number | null;
  destinationOffset: number | null;
}

export interface GpifNote {
  /** Legacy tie destination; joins the preceding note on this voice/string. */
  tieDestination?: boolean;
  /** Resolved legacy source ID; avoids accidentally tying to an inserted grace. */
  tieOrigin?: number;
  /** GPIF string number: 0-based, 0 = lowest string. Null off the fingerboard. */
  string: number | null;
  /** Fret, capo-relative. */
  fret: number | null;
  /** Sounding MIDI (capo applied) when stated (GP7+ always, GP6 sometimes). */
  midi: number | null;
  /** Legacy formats can state a technique whose sounding pitch differs from
   *  its fingerboard position. This wins over the normal pitch arithmetic. */
  soundingMidiOverride?: number | null;
  /** Authored sounding spelling; GPIF octaves converted to scientific notation. */
  concertPitch?: MnxPitch;
  /** GP6 pitch alternative. */
  tone: number | null;
  octave: number | null;
  vibrato: boolean;
  palmMute: boolean;
  hopoOrigin: boolean;
  /** Slide flag bits (field notes §8), or null when the note has no slide. */
  slideFlags: number | null;
  bend: GpifBend | null;
  /** `HarmonicType/HType` string, e.g. "Natural". */
  harmonicType: string | null;
}

/** GPIF `NoteValue` strings → MNX duration bases. */
const NOTE_VALUES: Record<string, MnxNoteValueBase> = {
  Whole: 'whole',
  Half: 'half',
  Quarter: 'quarter',
  Eighth: 'eighth',
  '16th': '16th',
  '32nd': '32nd',
  '64th': '64th',
  '128th': '128th'
};

export function parseGpif(xml: string): GpifDocument {
  const root = new DOMParser().parseFromString(xml, 'text/xml').documentElement;
  if (!root || root.tagName !== 'GPIF') throw new Error('not a GPIF document');

  return {
    metadata: parseScoreInfo(child(root, 'Score')),
    masterBars: children(child(root, 'MasterBars'), 'MasterBar').map(parseMasterBar),
    tracks: children(child(root, 'Tracks'), 'Track').map(parseTrack),
    bars: pool(root, 'Bars', 'Bar', parseBar),
    voices: pool(root, 'Voices', 'Voice', parseVoice),
    beats: pool(root, 'Beats', 'Beat', parseBeat),
    notes: pool(root, 'Notes', 'Note', parseNote),
    rhythms: pool(root, 'Rhythms', 'Rhythm', parseRhythm),
    tempoAutomations: parseTempoAutomations(root)
  };
}

/**
 * `<Score>` → the dialect-independent header. Every child is plain text (GPIF
 * wraps some in CDATA, which `textContent` already resolves); `<Notices>` is
 * one element whose text may hold several lines.
 */
function parseScoreInfo(node: Element | null): GpScoreInfo {
  const read = (name: string): string => (text(node, name) ?? '').trim();
  const notices = read('Notices');
  return {
    title: read('Title'),
    subtitle: read('SubTitle'),
    artist: read('Artist'),
    album: read('Album'),
    words: read('Words'),
    music: read('Music'),
    wordsAndMusic: read('WordsAndMusic'),
    copyright: read('Copyright'),
    tabber: read('Tabber'),
    instructions: read('Instructions'),
    notices: notices ? notices.split(/\r?\n/).map(line => line.trim()).filter(Boolean) : []
  };
}

function parseMasterBar(node: Element): GpifMasterBar {
  const time = (text(node, 'Time') ?? '4/4').split('/');
  const key = child(node, 'Key');
  const repeat = child(node, 'Repeat');
  const section = child(node, 'Section');

  let mask = 0;
  for (const token of (text(node, 'AlternateEndings') ?? '').split(/\s+/)) {
    const n = Number.parseInt(token, 10);
    if (n >= 1 && n <= 8) mask |= 1 << (n - 1);
  }

  return {
    barIds: intList(text(node, 'Bars')),
    timeNumerator: Number.parseInt(time[0], 10) || 4,
    timeDenominator: Number.parseInt(time[1], 10) || 4,
    fifths: key ? (int(text(key, 'AccidentalCount')) ?? 0) : null,
    repeatStart: repeat?.getAttribute('start') === 'true',
    repeatCount:
      repeat?.getAttribute('end') === 'true'
        ? (int(repeat.getAttribute('count')) ?? 2)
        : null,
    doubleBar: child(node, 'DoubleBar') !== null,
    sectionLetter: section ? (text(section, 'Letter') ?? null) : null,
    sectionText: section ? (text(section, 'Text') ?? null) : null,
    alternateEndingsMask: mask,
    tripletFeel: text(node, 'TripletFeel') ?? null
  };
}

function parseTrack(node: Element): GpifTrack {
  // GP6 keeps the fingerboard directly on the track; GP7+ nests it per staff.
  // Only the first staff is read — mirroring the import contract, which maps
  // one part per track.
  const properties =
    child(node, 'Properties') ??
    child(child(child(node, 'Staves'), 'Staff'), 'Properties');

  let tuning: number[] = [];
  let capo = 0;
  const chordNames = new Map<number, string>();

  for (const property of children(properties, 'Property')) {
    switch (property.getAttribute('name')) {
      case 'Tuning':
        tuning = intList(text(property, 'Pitches'));
        break;
      case 'CapoFret':
        capo = int(text(property, 'Fret')) ?? 0;
        break;
      case 'DiagramCollection':
        for (const item of children(child(property, 'Items'), 'Item')) {
          const id = int(item.getAttribute('id'));
          const name = item.getAttribute('name');
          if (id !== null && name) chordNames.set(id, name);
        }
        break;
    }
  }

  return {
    name: (text(node, 'Name') ?? '').replace(/\n/g, '').trim(),
    tuningLowToHigh: tuning,
    capo,
    chordNames
  };
}

function parseBar(node: Element): GpifBar {
  return {
    voiceIds: intList(text(node, 'Voices')),
    clef: text(node, 'Clef') ?? null
  };
}

function parseVoice(node: Element): GpifVoice {
  return { beatIds: intList(text(node, 'Beats')) };
}

function parseBeat(node: Element): GpifBeat {
  const notesText = text(node, 'Notes');
  const lyrics = child(node, 'Lyrics');
  return {
    rhythmRef: int(child(node, 'Rhythm')?.getAttribute('ref')) ?? 0,
    noteIds: notesText === undefined ? null : intList(notesText),
    graceKind: text(node, 'GraceNotes') ?? null,
    freeText: text(node, 'FreeText') ?? null,
    chordId: int(text(node, 'Chord')),
    lyricLines: lyrics ? children(lyrics, 'Line').map(line => line.textContent ?? '') : null
  };
}

function parseRhythm(node: Element): GpifRhythm {
  const tuplet = child(node, 'PrimaryTuplet');
  return {
    base: NOTE_VALUES[text(node, 'NoteValue') ?? ''] ?? null,
    dots: int(child(node, 'AugmentationDot')?.getAttribute('count')) ?? 0,
    tupletNumerator: int(tuplet?.getAttribute('num')) ?? 1,
    tupletDenominator: int(tuplet?.getAttribute('den')) ?? 1
  };
}

function parseNote(node: Element): GpifNote {
  const note: GpifNote = {
    string: null,
    fret: null,
    midi: null,
    tone: null,
    octave: null,
    vibrato: child(node, 'Vibrato') !== null,
    palmMute: false,
    hopoOrigin: false,
    slideFlags: null,
    bend: null,
    harmonicType: null
  };

  let bendEnabled = false;
  const bend: GpifBend = {
    originValue: null,
    originOffset: null,
    middleValue: null,
    middleOffset1: null,
    middleOffset2: null,
    destinationValue: null,
    destinationOffset: null
  };

  for (const property of children(child(node, 'Properties'), 'Property')) {
    switch (property.getAttribute('name')) {
      case 'String':
        note.string = int(text(property, 'String'));
        break;
      case 'Fret':
        note.fret = int(text(property, 'Fret'));
        break;
      case 'ConcertPitch': {
        const pitch = child(property, 'Pitch');
        const step = text(pitch, 'Step');
        const octave = int(text(pitch, 'Octave'));
        const accidental = text(pitch, 'Accidental') ?? '';
        const alters: Record<string, number> = { '': 0, '#': 1, b: -1, x: 2, '##': 2, bb: -2 };
        if (step && /^[A-G]$/.test(step) && octave !== null && Object.hasOwn(alters, accidental)) {
          const alter = alters[accidental];
          note.concertPitch = { step: step as MnxStep, octave: octave - 1,
            ...(alter ? { alter } : {}) };
        }
        break;
      }
      case 'Midi':
        note.midi = int(text(property, 'Number'));
        break;
      case 'Tone':
        note.tone = int(text(property, 'Step'));
        break;
      case 'Octave':
        note.octave = int(text(property, 'Number'));
        break;
      case 'PalmMuted':
        note.palmMute = child(property, 'Enable') !== null;
        break;
      case 'HopoOrigin':
        note.hopoOrigin = child(property, 'Enable') !== null;
        break;
      case 'Slide':
        note.slideFlags = int(text(property, 'Flags')) ?? 0;
        break;
      case 'Bended':
        bendEnabled = child(property, 'Enable') !== null;
        break;
      case 'BendOriginValue':
        bend.originValue = float(text(property, 'Float'));
        break;
      case 'BendOriginOffset':
        bend.originOffset = float(text(property, 'Float'));
        break;
      case 'BendMiddleValue':
        bend.middleValue = float(text(property, 'Float'));
        break;
      case 'BendMiddleOffset1':
        bend.middleOffset1 = float(text(property, 'Float'));
        break;
      case 'BendMiddleOffset2':
        bend.middleOffset2 = float(text(property, 'Float'));
        break;
      case 'BendDestinationValue':
        bend.destinationValue = float(text(property, 'Float'));
        break;
      case 'BendDestinationOffset':
        bend.destinationOffset = float(text(property, 'Float'));
        break;
      case 'HarmonicType':
        note.harmonicType = text(property, 'HType') ?? null;
        break;
    }
  }

  if (bendEnabled) note.bend = bend;
  return note;
}

function parseTempoAutomations(root: Element): Map<number, number[]> {
  const automations = new Map<number, number[]>();
  const wrapper = child(child(root, 'MasterTrack'), 'Automations');
  for (const automation of children(wrapper, 'Automation')) {
    if (text(automation, 'Type') !== 'Tempo') continue;
    const bar = int(text(automation, 'Bar')) ?? 0;
    // The second token is the 1-based beat unit used by tempoReference().
    // Normalize to quarter BPM without changing playback speed.
    const values = (text(automation, 'Value') ?? '').trim().split(/\s+/);
    const bpm = float(values[0]);
    if (bpm === null) continue;
    const reference = int(values[1]) ?? 2;
    const multiplier = [0.5, 1, 1.5, 2, 3][reference - 1];
    if (multiplier === undefined) throw new Error(`unsupported GPIF tempo reference ${reference}`);
    const list = automations.get(bar) ?? [];
    list.push(bpm * multiplier);
    automations.set(bar, list);
  }
  return automations;
}

// ---------------------------------------------------------------------------
// DOM helpers — first-level element navigation only, namespace-free.
// ---------------------------------------------------------------------------

function child(node: Element | null | undefined, name: string): Element | null {
  if (!node) return null;
  for (let el = node.firstChild; el; el = el.nextSibling) {
    if (el.nodeType === 1 && (el as Element).tagName === name) return el as Element;
  }
  return null;
}

function children(node: Element | null | undefined, name: string): Element[] {
  const out: Element[] = [];
  if (!node) return out;
  for (let el = node.firstChild; el; el = el.nextSibling) {
    if (el.nodeType === 1 && (el as Element).tagName === name) out.push(el as Element);
  }
  return out;
}

/** Text content of the first child element `name`; undefined when absent. */
function text(node: Element | null | undefined, name: string): string | undefined {
  const el = child(node, name);
  return el === null ? undefined : (el.textContent ?? '');
}

/** Space-separated integers (id lists, tunings); unparseable tokens dropped. */
function intList(value: string | null | undefined): number[] {
  if (!value) return [];
  return value
    .trim()
    .split(/\s+/)
    .map(token => Number.parseInt(token, 10))
    .filter(parsed => !Number.isNaN(parsed));
}

function int(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Floats parsed forgivingly: GP6 writes literal "None" for unused values. */
function float(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseFloat(value.trim());
  return Number.isNaN(parsed) ? null : parsed;
}

function pool<T>(
  root: Element,
  wrapper: string,
  item: string,
  parse: (node: Element) => T
): Map<number, T> {
  const map = new Map<number, T>();
  for (const node of children(child(root, wrapper), item)) {
    const id = int(node.getAttribute('id'));
    if (id !== null) map.set(id, parse(node));
  }
  return map;
}
