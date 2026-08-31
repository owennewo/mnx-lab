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
  /**
   * JSON pointer → the INCLUSIVE `[first, last]` lines its value occupies.
   *
   * `lineByPointer` says where a subtree starts, which is enough to jump to
   * something and not enough to *show* it. This is what lets a reader ask for
   * the eight lines behind the current selection instead of scrolling a
   * thousand-line document (roadmap/proposed/core-json-view.md). For a scalar
   * both entries are the same line; for a container the range runs to its
   * closing brace or bracket.
   */
  spanByPointer: Map<string, [number, number]>;
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
  const spanByPointer = new Map<string, [number, number]>();

  /* Wraps the walk so the span is recorded on EVERY exit path — `emitValue`
     returns from four places (scalar, empty array, array, empty object), and a
     span set per-branch is a span that will be forgotten by whoever adds the
     fifth. */
  const emit = (value: unknown, pointer: string, indent: string, prefix: string) => {
    const startLine = lines.length;
    emitValue(value, pointer, indent, prefix);
    spanByPointer.set(pointer, [startLine, lines.length - 1]);
  };

  const emitValue = (value: unknown, pointer: string, indent: string, prefix: string) => {
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

  return {
    text: lines.join('\n'),
    lines,
    noteLineByKey,
    noteKeyByLine,
    lineByPointer,
    spanByPointer
  };
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
