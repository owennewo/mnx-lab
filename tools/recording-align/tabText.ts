// Tab text: a piece written down bar by bar as string/fret, the way a person reads tab
// off a page or a video — and the MNX document studio would have made of it. The format
// exists so that a transcription is a small, reviewable text file rather than a script,
// and so that every bar is checked (each voice fills its bar, every tie lands) before a
// piece is made from it. `align.ts build` reads it; the README documents it.
//
//   title: Smells Like Teen Spirit        header lines first: title, artist, part,
//   time: 4/4                             tuning (low→high, or "standard"), capo,
//   key: 1                                key (fifths), time, tempo (quarter bpm)
//   tempo: 96
//
//   bar 1 section="Intro"                 a bar, numbered in order, then its markers
//     v1: q:r 8:2/12h 8:1/12h~ h:1/12h~    a voice: events `duration:notes`
//     v2: 8:6/0 8:6/0 8:6/0 8:6/0 8:5/0 8:5/0 8:5/0 8:5/0
//   bar 3 = 1                             a copy of bar 1's voices (fresh ids)
//
// Durations w h q 8 16 32, each with dots (`q.`). Notes `string/fret`, string 1 the
// highest-pitched, joined with `+` into a chord; `r` is a rest. A note's suffixes: `~`
// ties it to the same string's next note in its voice (into the next bar, too), `h`
// makes it a natural harmonic, `x` a dead note. Bar markers: `|:` `:|` `:|x3`
// `volta=1` (every bar of the ending; `volta=1,2` for shared), `segno` `coda` `tocoda`
// `ds` `ds-al-coda` `ds-al-fine` `dc` `dc-al-coda` `dc-al-fine` `fine` `final`
// `double` `section="Verse 1"` `time=3/4` `key=2` `tempo=100`.
import { buildNewDocument } from '../../src/edit/newDocument.ts';
import { spellPitch } from '../../src/edit/staffSpace.ts';
import { midiOfPitch } from '../../src/edit/tabStrings.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';
import type { MnxGlobalMeasure, MnxNote, MnxPitch, MnxStructure, MnxTuningEntry } from '../../src/model/mnx.ts';

type Base = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd';
const BASES: Record<string, [Base, number]> = { w: ['whole', 1], h: ['half', 1 / 2], q: ['quarter', 1 / 4], '8': ['eighth', 1 / 8], '16': ['16th', 1 / 16], '32': ['32nd', 1 / 32] };

interface TextNote { string: number; fret: number; tie: boolean; harmonic: boolean; dead: boolean }
interface TextEvent { base: Base; dots: number; length: number; notes: TextNote[] | null }
interface TextBar { number: number; line: number; markers: string[]; voices: Map<string, TextEvent[]>; copyOf?: number }

export interface TabTextPiece {
  title: string;
  artist?: string;
  part: string;
  tuning: MnxTuningEntry[];
  capo: number;
  fifths: number;
  time: { count: number; unit: number };
  tempo?: number;
}

export class TabTextError extends Error {}
const fail = (line: number, message: string): never => { throw new TabTextError(`line ${line}: ${message}`); };

function pitchName(name: string, line: number): MnxPitch {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name) ?? fail(line, `"${name}" is not a pitch like E2 or F#3`);
  return { step: m[1] as MnxPitch['step'], octave: Number(m[3]), ...(m[2] ? { alter: m[2] === '#' ? 1 : -1 } : {}) };
}

function header(lines: [number, string][]): TabTextPiece {
  const fields = new Map<string, [number, string]>();
  for (const [n, text] of lines) {
    const m = /^([a-z]+):\s*(.*)$/.exec(text) ?? fail(n, `expected a header line like "title: …", got "${text}"`);
    fields.set(m[1], [n, m[2].trim()]);
  }
  const get = (k: string) => fields.get(k)?.[1];
  const at = (k: string) => fields.get(k)?.[0] ?? 0;
  const known = ['title', 'artist', 'part', 'tuning', 'capo', 'key', 'time', 'tempo'];
  for (const [k, [n]] of fields) if (!known.includes(k)) fail(n, `unknown header "${k}" (one of ${known.join(', ')})`);
  const title = get('title') || fail(1, 'a piece needs a "title:" line');
  const tuningText = get('tuning') ?? 'standard';
  const names = tuningText === 'standard' ? null : tuningText.split(/\s+/);
  const tuning: MnxTuningEntry[] = names
    ? names.map((name, i) => ({ string: names.length - i, pitch: pitchName(name, at('tuning')) }))
    : STANDARD_GUITAR_STRINGS.map(s => ({ string: s.string, pitch: { ...s.pitch } }));
  const time = /^(\d+)\/(\d+)$/.exec(get('time') ?? '4/4') ?? fail(at('time'), 'time is like 4/4');
  const int = (k: string, fallback: number) => {
    const v = get(k);
    if (v === undefined) return fallback;
    if (!/^-?\d+$/.test(v)) fail(at(k), `${k} is a whole number`);
    return Number(v);
  };
  const tempo = get('tempo');
  return {
    title, artist: get('artist'), part: get('part') ?? 'Guitar', tuning, capo: int('capo', 0), fifths: int('key', 0),
    time: { count: Number(time[1]), unit: Number(time[2]) },
    tempo: tempo === undefined ? undefined : Number(tempo) || fail(at('tempo'), 'tempo is quarter notes per minute'),
  };
}

function event(token: string, line: number): TextEvent {
  const m = /^(w|h|q|8|16|32)(\.*):(.+)$/.exec(token) ?? fail(line, `"${token}" is not an event like q:3/0 or 8:r`);
  const [base, value] = BASES[m[1]];
  const dots = m[2].length;
  const length = value * (2 - 2 ** -dots);
  if (m[3] === 'r') return { base, dots, length, notes: null };
  const notes = m[3].split('+').map(part => {
    const n = /^(\d+)\/(\d+)([~hx]*)$/.exec(part) ?? fail(line, `"${part}" in "${token}" is not a note like 3/0, 1/12h or 2/3~`);
    return { string: Number(n[1]), fret: Number(n[2]), tie: n[3].includes('~'), harmonic: n[3].includes('h'), dead: n[3].includes('x') };
  });
  const strings = notes.map(n => n.string);
  if (new Set(strings).size !== strings.length) fail(line, `"${token}" puts two notes on one string`);
  return { base, dots, length, notes };
}

export function parseTabText(text: string): { piece: TabTextPiece; bars: TextBar[] } {
  const lines = text.split('\n').map((raw, i): [number, string] => [i + 1, raw.replace(/#.*$/, '').trim()]).filter(([, t]) => t);
  const first = lines.findIndex(([, t]) => t.startsWith('bar '));
  const piece = header(first < 0 ? lines : lines.slice(0, first));
  const bars: TextBar[] = [];
  for (const [n, t] of first < 0 ? [] : lines.slice(first)) {
    if (t.startsWith('bar ')) {
      const m = /^bar\s+(\d+)(?:\s*=\s*(\d+))?\s*(.*)$/.exec(t) ?? fail(n, `"${t}" is not a bar line like "bar 3" or "bar 3 = 1"`);
      const number = Number(m[1]);
      if (number !== bars.length + 1) fail(n, `bar ${number} follows bar ${bars.length}: bars are numbered in order, from 1`);
      const copyOf = m[2] === undefined ? undefined : Number(m[2]);
      if (copyOf !== undefined && !(copyOf >= 1 && copyOf < number)) fail(n, `bar ${number} copies bar ${copyOf}, which is not an earlier bar`);
      const markers = [...m[3].matchAll(/(\S+?="[^"]*"|\S+)/g)].map(x => x[1]);
      bars.push({ number, line: n, markers, voices: new Map(), copyOf });
      continue;
    }
    const bar = bars.at(-1) ?? fail(n, 'a voice line before any bar');
    const m = /^(v\d+):\s*(.*)$/.exec(t) ?? fail(n, `"${t}" is not a voice line like "v1: q:3/0 …"`);
    if (bar.copyOf !== undefined) fail(n, `bar ${bar.number} copies bar ${bar.copyOf}; it cannot also have voices of its own`);
    if (bar.voices.has(m[1])) fail(n, `bar ${bar.number} has voice ${m[1]} twice`);
    bar.voices.set(m[1], m[2].split(/\s+/).filter(Boolean).map(token => event(token, n)));
  }
  for (const bar of bars) if (bar.copyOf !== undefined) bar.voices = bars[bar.copyOf - 1].voices;
  return { piece, bars };
}

const measureLength = (time: { count: number; unit: number }) => time.count / time.unit;
const reduce = (num: number, den: number): [number, number] => { const g = (a: number, b: number): number => b ? g(b, a % b) : a; const d = g(num, den); return [num / d, den / d]; };
const fraction = (x: number): [number, number] => reduce(Math.round(x * 1024), 1024);

/** The document: studio's own new-piece genesis (`buildNewDocument`), the bars' music, then
 *  the guitar presentation every Guitar Pro import carries (an octave transposition). */
export function buildTabText(text: string): { document: MnxStructure; warnings: string[] } {
  const { piece, bars } = parseTabText(text);
  if (!bars.length) throw new TabTextError('no bars: a piece needs at least "bar 1"');
  const document = buildNewDocument({ title: piece.title, artist: piece.artist, partName: piece.part, tuning: piece.tuning, capo: piece.capo || undefined, time: piece.time, fifths: piece.fifths, bars: bars.length });
  const part = document.parts[0];
  part.transposition = { interval: { halfSteps: 12, staffDistance: 7 }, prefersWrittenPitches: true } as typeof part.transposition;
  const open = new Map(piece.tuning.map(t => [t.string, midiOfPitch(t.pitch)]));
  const warnings: string[] = [];
  let time = piece.time, fifths = piece.fifths, nextId = 1;
  const endings: { key: string; first: number; count: number }[] = [];
  let ending: typeof endings[number] | undefined;
  // Each voice's notes in written order, for the ties.
  const placed = new Map<string, { bar: number; line: number; event: number; notes: { text: TextNote; mnx: MnxNote }[] }[]>();

  for (const [i, bar] of bars.entries()) {
    const global: MnxGlobalMeasure = document.global.measures[i];
    for (const marker of bar.markers) {
      const kv = /^([a-z-]+)=(?:"([^"]*)"|(\S+))$/.exec(marker);
      const value = kv ? kv[2] ?? kv[3] : '';
      const end = { fraction: fraction(measureLength(time)) };
      const nav = () => ((global._x ??= {}).mnxLab ??= {}).navigation ??= {};
      switch (kv ? kv[1] : marker) {
        case '|:': global.repeatStart = {}; break;
        case 'segno': global.segno = { id: 'segno', location: { fraction: [0, 1] } }; break;
        case 'coda': (nav().marks ??= []).push({ id: 'coda', kind: 'coda', location: { fraction: [0, 1] } }); break;
        case 'tocoda': (nav().jumps ??= []).push({ type: 'toCoda', target: 'coda', text: 'To Coda', location: end }); break;
        case 'ds': global.jump = { type: 'segno', location: end }; break;
        case 'ds-al-fine': global.jump = { type: 'dsalfine', location: end }; break;
        case 'ds-al-coda': (nav().jumps ??= []).push({ type: 'dalSegnoAlCoda', target: 'segno', resumeAt: 'coda', text: 'D.S. al Coda', location: end }); break;
        case 'dc': (nav().jumps ??= []).push({ type: 'daCapo', text: 'D.C.', location: end }); break;
        case 'dc-al-fine': (nav().jumps ??= []).push({ type: 'daCapoAlFine', text: 'D.C. al Fine', location: end }); break;
        case 'dc-al-coda': (nav().jumps ??= []).push({ type: 'daCapoAlCoda', resumeAt: 'coda', text: 'D.C. al Coda', location: end }); break;
        case 'fine': global.fine = { location: end }; break;
        case 'final': global.barline = { type: 'final' }; break;
        case 'double': global.barline = { type: 'double' }; break;
        case 'section': global.section = { label: value }; break;
        case 'volta': {
          if (!/^\d+(,\d+)*$/.test(value)) fail(bar.line, `volta=${value}: numbers like 1 or 1,2`);
          // Consecutive bars marked alike are one ending; its first bar carries it.
          if (ending?.key === value && ending.first + ending.count === i) ending.count++;
          else { ending = { key: value, first: i, count: 1 }; endings.push(ending); global.ending = { numbers: value.split(',').map(Number) }; }
          break;
        }
        case 'time': {
          const t = /^(\d+)\/(\d+)$/.exec(value) ?? fail(bar.line, `time=${value}: like 3/4`);
          time = { count: Number(t[1]), unit: Number(t[2]) };
          global.time = time;
          break;
        }
        case 'key': fifths = Number(value); global.key = { fifths }; break;
        case 'tempo': global.tempos = [{ bpm: Number(value), value: { base: 'quarter' } }]; break;
        default: {
          const end = /^:\|(?:x(\d+))?$/.exec(marker) ?? fail(bar.line, `unknown bar marker "${marker}"`);
          global.repeatEnd = end[1] ? { times: Number(end[1]) } : {};
        }
      }
    }
    if (i === 0 && piece.tempo) global.tempos = [{ bpm: piece.tempo, value: { base: 'quarter' } }];
    if (!bar.voices.size) fail(bar.line, `bar ${bar.number} has no voices`);
    const sequences = [...bar.voices].map(([voice, events]) => {
      const total = events.reduce((sum, e) => sum + e.length, 0);
      if (Math.abs(total - measureLength(time)) > 1e-9) fail(bar.line, `bar ${bar.number} ${voice} holds ${total * time.unit} beats of ${time.count}`);
      const run = placed.get(voice) ?? placed.set(voice, []).get(voice)!;
      const content = events.map((e, k) => {
        const duration = { base: e.base, ...(e.dots ? { dots: e.dots } : {}) };
        if (!e.notes) return { duration, rest: {} };
        const notes = e.notes.map(text => {
          const base = open.get(text.string) ?? fail(bar.line, `bar ${bar.number} ${voice}: string ${text.string} is not one of the tuning's ${open.size}`);
          const mnx: MnxNote = { id: `n${nextId++}`, pitch: spellPitch(base + piece.capo + text.fret, fifths), _x: { mnxLab: { string: text.string, fret: text.fret } } };
          if (text.harmonic || text.dead) mnx._x!.mnxLab!.tab = { technique: { ...(text.harmonic ? { harmonic: { type: 'natural' as const } } : {}), ...(text.dead ? { dead: true } : {}) } };
          return { text, mnx };
        });
        run.push({ bar: bar.number, line: bar.line, event: k, notes });
        return { duration, notes: notes.map(n => n.mnx) };
      });
      return { voice, content };
    });
    part.measures[i] = { ...(i === 0 ? { clefs: [{ clef: { sign: 'G', staffPosition: -2 } }] } : {}), sequences } as typeof part.measures[number];
  }
  for (const { first, count } of endings) document.global.measures[first].ending!.duration = count;

  // A tie lands on the same string's next note in the voice: same pitch, or it is a mistake.
  for (const [voice, run] of placed) {
    for (const [k, here] of run.entries()) {
      for (const { text, mnx } of here.notes) {
        if (!text.tie) continue;
        const next = run.slice(k + 1).find(e => e.notes.some(n => n.text.string === text.string));
        const target = next?.notes.find(n => n.text.string === text.string);
        if (!next || !target) fail(here.line, `bar ${here.bar} ${voice}: the tie on string ${text.string} has no later note on that string`);
        if (midiOfPitch(target!.mnx.pitch) !== midiOfPitch(mnx.pitch)) fail(here.line, `bar ${here.bar} ${voice}: the tie on string ${text.string} lands on a different pitch (bar ${next!.bar})`);
        if (next!.bar > here.bar + 1) warnings.push(`bar ${here.bar} ${voice}: a tie on string ${text.string} reaches over to bar ${next!.bar}`);
        mnx.ties = [{ target: target!.mnx.id }];
      }
    }
  }
  return { document, warnings };
}
