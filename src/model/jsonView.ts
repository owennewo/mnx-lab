// Keys come from the canonical walk, not a local restatement of it.
import { noteKeyAt } from './noteWalk.ts';

/**
 * Renders an MNX document to the exact text `JSON.stringify(doc, null, 2)`
 * produces, while recording line numbers for (a) every JSON-pointer path and
 * (b) every note, keyed the same way the layout engines key selection
 * (note id, or the synthesized positional key from noteKeys.ts).
 *
 * This is the binding that makes the note ↔ document cross-highlight work:
 * click a notehead → its key resolves to a line; click an anchored line →
 * its key selects the notehead.
 */

export interface JsonView {
  text: string;
  lines: string[];
  /** note key → 0-based line of the note's `id` (or `pitch`) property. */
  noteLineByKey: Map<string, number>;
  /** 0-based line → note key, for click handling in the document pane. */
  noteKeyByLine: Map<number, string>;
  /** JSON pointer (e.g. /parts/0/measures/0/clefs/0/clef/sign) → 0-based line. */
  lineByPointer: Map<string, number>;
}

interface MnxNoteish {
  id?: string;
  pitch?: { step?: string; octave?: number; alter?: number };
}

interface MnxDocish {
  parts?: {
    measures?: {
      sequences?: {
        staff?: number;
        content?: { notes?: MnxNoteish[] }[];
      }[];
    }[];
  }[];
}

export function buildJsonView(doc: unknown): JsonView {
  const lines: string[] = [];
  const lineByPointer = new Map<string, number>();

  const emit = (value: unknown, pointer: string, indent: string, prefix: string) => {
    const startLine = lines.length;
    if (value === null || typeof value !== 'object') {
      lines.push(indent + prefix + JSON.stringify(value));
      lineByPointer.set(pointer, startLine);
      return;
    }
    if (Array.isArray(value)) {
      lineByPointer.set(pointer, startLine);
      if (value.length === 0) {
        lines.push(indent + prefix + '[]');
        return;
      }
      lines.push(indent + prefix + '[');
      value.forEach((item, i) => {
        // JSON.stringify serializes undefined array items as null
        emit(item === undefined ? null : item, `${pointer}/${i}`, indent + '  ', '');
        if (i < value.length - 1) lines[lines.length - 1] += ',';
      });
      lines.push(indent + ']');
      return;
    }
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined && typeof v !== 'function'
    );
    lineByPointer.set(pointer, startLine);
    if (entries.length === 0) {
      lines.push(indent + prefix + '{}');
      return;
    }
    lines.push(indent + prefix + '{');
    entries.forEach(([key, v], i) => {
      emit(v, `${pointer}/${escapePointerSegment(key)}`, indent + '  ', JSON.stringify(key) + ': ');
      if (i < entries.length - 1) lines[lines.length - 1] += ',';
    });
    lines.push(indent + '}');
  };

  emit(doc === undefined ? null : doc, '', '', '');

  // Anchor every note of parts[0], mirroring the layout engines' traversal:
  // voice index counts only staff-1 (or staff-less) sequences.
  const noteLineByKey = new Map<string, number>();
  const noteKeyByLine = new Map<number, string>();
  const parts = (doc as MnxDocish)?.parts ?? [];
  (parts[0]?.measures ?? []).forEach((measure, m) => {
    let voiceIndex = -1;
    (measure?.sequences ?? []).forEach((seq, seqIdx) => {
      if (!(seq?.staff === 1 || seq?.staff === undefined)) return;
      voiceIndex++;
      (seq?.content ?? []).forEach((event, e) => {
        (event?.notes ?? []).forEach((note, n) => {
          const key = noteKeyAt(note as never, m, voiceIndex, e, n);
          const base = `/parts/0/measures/${m}/sequences/${seqIdx}/content/${e}/notes/${n}`;
          const line =
            lineByPointer.get(`${base}/id`) ??
            lineByPointer.get(`${base}/pitch`) ??
            lineByPointer.get(base);
          if (line !== undefined && !noteLineByKey.has(key)) {
            noteLineByKey.set(key, line);
            noteKeyByLine.set(line, key);
          }
        });
      });
    });
  });

  return { text: lines.join('\n'), lines, noteLineByKey, noteKeyByLine, lineByPointer };
}

function escapePointerSegment(seg: string): string {
  return seg.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Converts an Ajv instancePath to a display path: parts[0].measures[0].clef.sign */
export function pointerToDisplayPath(pointer: string): string {
  return pointer
    .split('/')
    .filter(Boolean)
    .map(seg => (/^\d+$/.test(seg) ? `[${seg}]` : `.${seg}`))
    .join('')
    .replace(/^\./, '');
}

const SHARP = '♯';
const FLAT = '♭';

export interface NoteDescription {
  /** e.g. G♯4 */
  label: string;
  /** 1-based measure number. */
  measure: number;
}

/** Finds a note by selection key and describes it for the status bar. */
export function describeNote(doc: unknown, key: string): NoteDescription | null {
  const parts = (doc as MnxDocish)?.parts ?? [];
  let found: NoteDescription | null = null;
  (parts[0]?.measures ?? []).forEach((measure, m) => {
    let voiceIndex = -1;
    (measure?.sequences ?? []).forEach(seq => {
      if (!(seq?.staff === 1 || seq?.staff === undefined)) return;
      voiceIndex++;
      (seq?.content ?? []).forEach((event, e) => {
        (event?.notes ?? []).forEach((note, n) => {
          const k = noteKeyAt(note as never, m, voiceIndex, e, n);
          if (k !== key || found) return;
          const p = note?.pitch;
          const acc = p?.alter === 1 ? SHARP : p?.alter === -1 ? FLAT : '';
          found = {
            label: p ? `${p.step ?? '?'}${acc}${p.octave ?? ''}` : key,
            measure: m + 1
          };
        });
      });
    });
  });
  return found;
}
