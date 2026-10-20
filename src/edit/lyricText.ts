import { containerEventsWithPaths } from '../model/noteWalk.ts';
import type { ContainerIndex } from '../model/noteKeys.ts';
// The lyric text surface's format engine (one-surface item 6, phase 2:
// roadmap/inprogress/workbench-one-surface-lyrics.md).
//
// One text buffer holds a part's whole lyric — a projection, never a second
// store. The canonical direction is document → text (`serializeLyricText` is
// deterministic); the parser maps the buffer back onto the same event walk,
// and `planLyricEdits` diffs the result against the document into ordinary
// setSyllable/removeSyllable/setLyricLine edits so apply goes through the one
// intent funnel (`applyLyricPlan` batches them — traces record syllables,
// never keystrokes).
//
// The token set (locked in the roadmap doc; kin to LilyPond lyric mode, every
// token mirrors what engravers draw):
//   word split      fant--as-tic   n hyphens = split + (n−1) held events
//   extender        day__ next     suffix underscores, one held event each
//   bare skip       ____           standalone run, one untexted event each
//   elision         you~are        two words on one event (stored as a space)
//   bar line        |             the next bar played, including bars nobody sings
//   empty bars      ×4  x4         that many bars nobody sings, standing where a bar starts
//   header          nl 2:          on a line's start: another verse or language, from bar 1 again
//   escape          \              a first syllable that would read as a header or a run
//
// The text is in the order the words are sung and names no bars: it runs from
// the first bar played, and the editor's margin says where each line starts.
// Canonical text ends each line on its bar line and wraps at four bars / 80
// columns and at navigation boundaries; newlines are whitespace. Rests, spaces,
// grace notes and tie continuations are skipped automatically by the walk, so
// most pasted text needs no special tokens at all.

import type { MnxEvent, MnxSequenceItem, MnxStructure } from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';
import { noteKeyAt } from '../model/noteWalk.ts';
import { hasRepeatStructure, linearizePasses } from '../model/passes.ts';
import { add, compare, divide, multiply, noteDuration, rational, tupletScale, ZERO, ONE, type Rational } from '../model/time.ts';

export type SyllableType = 'start' | 'middle' | 'end' | 'whole';

/** One sung position: an event the lyric walk can attach a syllable to. */
export interface LyricEventEntry {
  noteKey: string;
  measureIndex: number;
  event: MnxEvent;
}

/**
 * The lyric-eligible events of one part, in document order: staff-1 voice 1
 * (the convention the format reserves a header token to widen later), tuplet
 * and tremolo content included, grace content skipped (not sung), rests and
 * `space` items skipped (no notes), tie continuations skipped (one syllable
 * spans the tie). Events outside the walk keep whatever lyrics they carry —
 * the surface never touches what it cannot express.
 */
export function lyricEventWalk(doc: MnxStructure, partIndex: number): LyricEventEntry[] {
  const part = doc.parts?.[partIndex];
  if (!part) return [];
  // A tie continuation is an event whose every note is some tie's target.
  const tieTargets = new Set<string>();
  const collectTies = (event: MnxEvent) => {
    for (const note of event.notes ?? [])
      for (const tie of note.ties ?? []) if (tie.target) tieTargets.add(tie.target);
  };
  const forEachVoiceOneEvent = (fn: (event: MnxEvent, measureIndex: number, eventIndex: number, containerIndex?: ContainerIndex) => void) => {
    (part.measures ?? []).forEach((measure, measureIndex) => {
      const sequence = (measure.sequences ?? []).find(s => (s.staff ?? 1) === 1);
      (sequence?.content ?? []).forEach((item: MnxSequenceItem, eventIndex) => {
        const record = item as { type?: string; content?: MnxSequenceItem[] };
        if (record.type === 'grace') return;
        if (record.type === 'tuplet' || record.type === 'tremolo') {
          for (const {event,containerIndex} of containerEventsWithPaths(item)) fn(event,measureIndex,eventIndex,containerIndex);
          return;
        }
        if (isTimedEvent(item)) fn(item as MnxEvent, measureIndex, eventIndex);
      });
    });
  };
  forEachVoiceOneEvent(collectTies);
  const entries: LyricEventEntry[] = [];
  forEachVoiceOneEvent((event, measureIndex, eventIndex, containerIndex) => {
    const notes = event.notes ?? [];
    if (notes.length === 0) return; // rests and authored silence are not sung
    if (notes.every(note => note.id !== undefined && tieTargets.has(note.id))) return;
    entries.push({
      noteKey: noteKeyAt(notes[0]!, measureIndex, 0, eventIndex, 0, containerIndex, partIndex, 1),
      measureIndex,
      event
    });
  });
  return entries;
}

// ── Line identity: ordinals within language groups ─────────────────────────
// Line ids are arbitrary strings the format never spells; a text line maps to
// a document line by its ordinal within a language group (decision A). Ids in
// stacking order: lineOrder first, then the rest sorted — the renderer's own
// rule (notation.ts collectLyricLineIds), widened to include metadata-only
// ids so a declared-but-empty verse still owns its ordinal.

interface LineGroups {
  /** group key ('' = primary, else the lang code) → ids in stacking order */
  groups: Map<string, string[]>;
}

function lineGroups(doc: MnxStructure, walk: LyricEventEntry[]): LineGroups {
  const metadata = doc.global?.lyrics?.lineMetadata ?? {};
  const order = doc.global?.lyrics?.lineOrder ?? [];
  const present = new Set<string>(Object.keys(metadata));
  for (const entry of walk)
    for (const id of Object.keys(entry.event.lyrics?.lines ?? {})) present.add(id);
  const stacked = [
    ...order.filter(id => present.has(id)),
    ...[...present].filter(id => !order.includes(id)).sort()
  ];
  const groups = new Map<string, string[]>();
  for (const id of stacked) {
    const key = metadata[id]?.lang ?? '';
    const ids = groups.get(key) ?? [];
    ids.push(id);
    groups.set(key, ids);
  }
  return { groups };
}

/** The smallest positive-integer id not yet taken — the lab's own convention;
 *  resolution never depends on it. */
function mintLineId(taken: Set<string>): string {
  for (let n = 1; ; n++) if (!taken.has(String(n))) return String(n);
}

// ── Serialize: document → canonical text ───────────────────────────────────

const HEADER_TOKEN = /^(\d+|[A-Za-z]{2,3})$/;
const LANG_TOKEN = /^[A-Za-z]{2,3}$/;

function escapeSyllable(text: string): string {
  return text.replace(/ /g, '~');
}

/** Serialize one line's syllables over the walk into bar-checked tokens. */
function serializeLine(walk: LyricEventEntry[], syllables: Map<number, { text: string; type?: string }>): string {
  const indices = [...syllables.keys()].sort((a, b) => a - b);
  if (indices.length === 0) return '';
  const firstBar = walk[indices[0]!]!.measureIndex;
  const barStart = new Map<number, number>(); // measureIndex → first walk index
  walk.forEach((entry, index) => {
    if (!barStart.has(entry.measureIndex)) barStart.set(entry.measureIndex, index);
  });
  const textedBars = [...new Set(indices.map(i => walk[i]!.measureIndex))];
  const pieces: string[] = [];
  if (firstBar > 0) pieces.push(`${firstBar + 1}|`);
  let previousBar: number | null = null;
  for (const bar of textedBars) {
    if (previousBar !== null) {
      const gap = bar - previousBar;
      // Small gaps read as empty checks; long ones jump by number.
      if (gap > 3) pieces.push(`${bar + 1}|`);
      else for (let i = 0; i < gap; i++) pieces.push('|');
    }
    previousBar = bar;
    // The bar's tokens: leading skips stand alone; a skip after an open word
    // is a hyphen (held), after a closed one an underscore (extender). Skips
    // after the bar's last syllable are never emitted — the next check
    // resyncs, and skips are absence either way.
    const tokens: string[] = [];
    let cursor = barStart.get(bar)!;
    const barIndices = indices.filter(i => walk[i]!.measureIndex === bar);
    for (const index of barIndices) {
      const gapBefore = index - cursor;
      const syllable = syllables.get(index)!;
      const lead = syllable.type === 'middle' || syllable.type === 'end';
      const trail = syllable.type === 'start' || syllable.type === 'middle';
      const last = tokens.length - 1;
      if (gapBefore > 0) {
        if (last >= 0 && tokens[last]!.endsWith('-')) tokens[last] += '-'.repeat(gapBefore);
        else if (last >= 0 && !/^_+$/.test(tokens[last]!) && !lead) tokens[last] += '_'.repeat(gapBefore);
        else tokens.push('_'.repeat(gapBefore));
      }
      const text = escapeSyllable(syllable.text);
      if (lead && tokens.length > 0 && tokens[tokens.length - 1]!.endsWith('-')) {
        tokens[tokens.length - 1] += text;
      } else {
        tokens.push((lead ? '-' : '') + text);
      }
      if (trail) tokens[tokens.length - 1] += '-';
      cursor = index + 1;
    }
    pieces.push(...tokens);
  }
  return pieces.join(' ');
}

// ── Parse: text → assignments + diagnostics ────────────────────────────────

export interface LyricTextDiagnostic {
  /** 0-based text line the problem sits on. */
  textLine: number;
  /** 1-based written bar, when the problem is in one. */
  bar?: number;
  /** …and the 1-based bar played, which names which visit of it. */
  played?: number;
  message: string;
  /** Absent = error (blocks apply). `warning` is the blue lane — the pass
   *  bound (decision A): worth naming, never worth refusing over. */
  severity?: 'warning';
}

export interface ParsedLyricLine {
  /** The resolved document line id (existing, or minted). */
  lineId: string;
  minted: boolean;
  lang?: string;
  /** 1-based ordinal within the line's language group — the pass number the
   *  verse maps onto (decision A). */
  ordinal: number;
  /** The 0-based buffer line this came from, for anchoring diagnostics. */
  textLine: number;
  /** walk index → syllable. */
  syllables: Map<number, { text: string; type?: SyllableType }>;
}

/** A token's place, for caret ↔ score cross-highlight. */
export interface LyricTokenSpan {
  /** Character offsets into the whole buffer. */
  from: number;
  to: number;
  /** The first walk entry the token's syllables land on. */
  entryIndex: number;
  /** Where that syllable is sung, in anchored text: the performed visit and its note's onset in the bar
   *  (whole notes) — what the editor's cursor is moved to when the caret is on the token. */
  ordinal?: number;
  onset?: [number, number];
}

export interface ParsedLyricText {
  lines: ParsedLyricLine[];
  diagnostics: LyricTextDiagnostic[];
  tokens: LyricTokenSpan[];
  /** Where each line of the text starts (header-only lines have none). */
  starts?: LyricLineStart[];
  /** The text lines that open a block with a header (`2:`, `nl:`). */
  headers?: number[];
  /** Explicit declarations retain empty preceding rows and stable row order. */
  newRows?: { id: string; lang?: string }[];
  lineOrder?: string[];
}

interface RawToken {
  text: string;
  from: number;
  to: number;
}

function tokenize(line: string, lineOffset: number): RawToken[] {
  const tokens: RawToken[] = [];
  const pattern = /\S+/g;
  for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
    tokens.push({ text: match[0], from: lineOffset + match.index, to: lineOffset + match.index + match[0].length });
  }
  return tokens;
}

/** `nl 2:` — order-free int + lang tokens closed by a colon, all shape-valid
 *  or it is not a header (the parseLyric shape trick, reused). */
function takeHeader(tokens: RawToken[]): { ordinal?: number; lang?: string; consumed: number } | null {
  const parts: string[] = [];
  for (let i = 0; i < Math.min(tokens.length, 3); i++) {
    const raw = tokens[i]!.text;
    const closes = raw.endsWith(':');
    const body = closes ? raw.slice(0, -1) : raw;
    if (body !== '' && !HEADER_TOKEN.test(body)) return null;
    if (body !== '') parts.push(body);
    if (closes) {
      if (parts.length === 0) return null;
      const ordinalToken = parts.find(p => /^\d+$/.test(p));
      const langToken = parts.find(p => LANG_TOKEN.test(p) && !/^\d+$/.test(p));
      if (parts.some(p => p !== ordinalToken && p !== langToken)) return null;
      return {
        ...(ordinalToken !== undefined ? { ordinal: Number(ordinalToken) } : {}),
        ...(langToken !== undefined ? { lang: langToken.toLowerCase() } : {}),
        consumed: i + 1
      };
    }
  }
  return null;
}

/**
 * The syllable grammar over a walk whose bars are `measureIndex`es: `|` is the
 * next bar, `×N` that many bars without words, and words land on the walk's
 * entries in order. `places`, when given, collects the bar each token starts in
 * (a bar line: the bar it leads into), keyed by the token's offset.
 */
function parseWrittenLyricText(doc: MnxStructure, partIndex: number, text: string, walk = lyricEventWalk(doc, partIndex),
  allowOpenWord = false, measureCount?: number, places?: Map<number, number>): Omit<ParsedLyricText, 'diagnostics'> & { diagnostics: (LyricTextDiagnostic & { at?: number })[] } {
  const { groups } = lineGroups(doc, walk);
  const diagnostics: (LyricTextDiagnostic & { at?: number })[] = [];
  const tokens: LyricTokenSpan[] = [];
  const lines: ParsedLyricLine[] = [];
  const counters = new Map<string, number>();
  const minted = new Set<string>();
  const takenIds = new Set<string>([...groups.values()].flat());
  const barCount = measureCount ?? walk.reduce((max, entry) => Math.max(max, entry.measureIndex + 1), 0);

  let offset = 0;
  const textLines = text.split('\n');
  for (let textLine = 0; textLine < textLines.length; textLine++) {
    const raw = textLines[textLine]!;
    const lineOffset = offset;
    offset += raw.length + 1;
    const rawTokens = tokenize(raw, lineOffset);
    if (rawTokens.length === 0) continue;

    const header = takeHeader(rawTokens);
    const group = header?.lang ?? '';
    const ordinal = header?.ordinal ?? (counters.get(group) ?? 0) + 1;
    counters.set(group, ordinal);
    const existing = groups.get(group) ?? [];
    let lineId = existing[ordinal - 1];
    let wasMinted = false;
    if (lineId === undefined) {
      lineId = mintLineId(takenIds);
      takenIds.add(lineId);
      wasMinted = true;
      minted.add(lineId);
      // The minted id joins its group so a later explicit ordinal finds it.
      const ids = groups.get(group) ?? [];
      while (ids.length < ordinal - 1) { const id = mintLineId(takenIds); takenIds.add(id); ids.push(id); }
      ids[ordinal - 1] = lineId;
      groups.set(group, ids);
    }

    const syllables = new Map<number, { text: string; type?: SyllableType }>();
    let next = 0; // next unconsumed walk index
    let barPointer = -1; // 0-based bar the walk has been asserted through
    let lastSyllableBar = -1;
    let overflowed = false;

    const consumeSkips = (count: number) => {
      next = Math.min(next + count, walk.length);
    };

    for (let i = header?.consumed ?? 0; i < rawTokens.length; i++) {
      const token = rawTokens[i]!;
      const check = /^(\d*)\|$/.exec(token.text);
      if (check) {
        // `N|` asserts bar N; a bare `|` asserts "the current bar is done" —
        // the bar after the last touched entry (or the last assertion).
        const resolved = check[1] !== ''
          ? Number(check[1]) - 1
          : (barPointer >= 0 ? barPointer : next > 0 ? walk[next - 1]!.measureIndex : -1) + 1;
        if (resolved >= barCount && barCount > 0)
          diagnostics.push({ textLine, at: token.from, message: `a bar line past the end of the music (${barCount} bars)` });
        else if (lastSyllableBar >= resolved)
          diagnostics.push({ textLine, at: token.from, bar: resolved + 1, message: 'too many syllables before this bar — they spill into it' });
        while (next < walk.length && walk[next]!.measureIndex < resolved) next++;
        barPointer = resolved;
        places?.set(token.from, resolved);
        continue;
      }
      const run = EMPTY_RUN.exec(token.text);
      if (run) {
        // Bars nobody sings, standing where a bar starts: the next `|` leads past them.
        const count = Number(run[1]), here = Math.max(barPointer, 0);
        places?.set(token.from, here);
        if (count < 1) diagnostics.push({ textLine, at: token.from, message: `“${token.text}” — a run is at least one bar` });
        else if (lastSyllableBar >= here)
          diagnostics.push({ textLine, at: token.from, bar: here + 1, message: `“${token.text}” stands for whole bars without words — put it after a |` });
        else if (barCount > 0 && here + count > barCount)
          diagnostics.push({ textLine, at: token.from, message: `“${token.text}” runs past the end of the music (${barCount} bars)` });
        barPointer = here + Math.max(count, 1) - 1;
        while (next < walk.length && walk[next]!.measureIndex <= barPointer) next++;
        continue;
      }
      if (/^_+$/.test(token.text)) {
        places?.set(token.from, next < walk.length ? walk[next]!.measureIndex : Math.max(barPointer, 0));
        consumeSkips(token.text.length);
        continue;
      }
      // A word token: optional escape, leading/trailing hyphen runs, internal
      // hyphen runs splitting syllables, trailing underscores as extenders.
      let body = token.text.startsWith('\\') ? token.text.slice(1) : token.text;
      const extender = /_+$/.exec(body)?.[0].length ?? 0;
      if (extender) body = body.slice(0, -extender);
      const leadRun = /^-+/.exec(body)?.[0].length ?? 0;
      const trailRun = /-+$/.exec(body)?.[0].length ?? 0;
      const core = body.slice(leadRun, trailRun ? -trailRun : undefined);
      if (core === '') {
        diagnostics.push({ textLine, at: token.from, message: `not a lyric token — “${token.text}”` });
        continue;
      }
      if (leadRun > 1) consumeSkips(leadRun - 1);
      const segments: { text: string; skipsAfter: number }[] = [];
      const splitter = /-+/g;
      let cursor = 0;
      for (let match = splitter.exec(core); match; match = splitter.exec(core)) {
        segments.push({ text: core.slice(cursor, match.index), skipsAfter: match[0].length - 1 });
        cursor = match.index + match[0].length;
      }
      segments.push({ text: core.slice(cursor), skipsAfter: 0 });
      const lead = leadRun > 0;
      const trail = trailRun > 0;
      let firstEntry: number | null = null;
      for (let s = 0; s < segments.length; s++) {
        const segment = segments[s]!;
        if (segment.text === '') continue;
        const isFirst = s === 0;
        const isLast = s === segments.length - 1;
        const joinBefore = lead || !isFirst;
        const joinAfter = trail || !isLast;
        const type: SyllableType | undefined =
          joinBefore && joinAfter ? 'middle' : joinAfter ? 'start' : joinBefore ? 'end' : undefined;
        if (next >= walk.length) {
          if (!overflowed) {
            diagnostics.push({ textLine, at: token.from, message: 'more syllables than sung notes — the rest land nowhere' });
            overflowed = true;
          }
          break;
        }
        const entry = walk[next]!;
        syllables.set(next, { text: segment.text.replace(/~/g, ' '), ...(type ? { type } : {}) });
        lastSyllableBar = entry.measureIndex;
        if (firstEntry === null) firstEntry = next;
        next++;
        consumeSkips(segment.skipsAfter);
      }
      if (firstEntry !== null) {
        tokens.push({ from: token.from, to: token.to, entryIndex: firstEntry });
        places?.set(token.from, walk[firstEntry]!.measureIndex);
      }
      consumeSkips(extender);
      if (overflowed) break;
    }

    if (!allowOpenWord && trailingHyphenOpen(rawTokens, header?.consumed ?? 0))
      diagnostics.push({ textLine, message: 'the line ends mid-word (a trailing hyphen with nothing after)' });
    lines.push({ lineId, minted: wasMinted, ...(header?.lang ? { lang: header.lang } : {}), ordinal, textLine, syllables });
  }
  return { lines, diagnostics, tokens };
}

// ── The pass bound (phase 3, decision A) ───────────────────────────────────

/**
 * The blue diagnostic: a verse whose pass number the repeat structure never
 * sings for its bar. Fewer verses than passes leaves the later passes unsung;
 * a verse on a bar that only sounds on other passes — volta text on the
 * wrong ending, a third verse on a twice-played strain — is worth naming.
 * Silent when the document declares no repeat structure at all: stacked
 * verses over unrepeated music carry the repetition implicitly, and there is
 * nothing written down to disagree with. Translations are exempt by
 * construction — ordinals run within a language group.
 */
export function lyricPassWarnings(
  doc: MnxStructure,
  partIndex: number,
  parsed: ParsedLyricText
): LyricTextDiagnostic[] {
  if (!hasRepeatStructure(doc)) return [];
  const model = linearizePasses(doc);
  const walk = lyricEventWalk(doc, partIndex);
  const warnings: LyricTextDiagnostic[] = [];
  for (const line of parsed.lines) {
    const flagged = new Set<number>();
    for (const entryIndex of line.syllables.keys()) {
      const measureIndex = walk[entryIndex]?.measureIndex;
      if (measureIndex === undefined || flagged.has(measureIndex)) continue;
      // The verses this bar sings — counting on through a D.S. return, as playback does.
      const sounding = [...new Set(model.entries.filter(e => e.measureIndex === measureIndex).map(e => e.verse))];
      if (sounding.includes(line.ordinal)) continue;
      flagged.add(measureIndex);
      const verse = `verse ${line.ordinal}${line.lang ? ` (${line.lang})` : ''}`;
      warnings.push({
        textLine: line.textLine,
        bar: measureIndex + 1,
        severity: 'warning',
        message: sounding.length === 0
          ? `${verse} has text on a bar the repeat structure never sounds`
          : `${verse} has text, but this bar only sings verse${sounding.length === 1 ? '' : 's'} ${sounding.join(', ')}`
      });
    }
  }
  return warnings;
}

/** Does the line's last word token end with a hyphen (an unfinished word)? */
function trailingHyphenOpen(tokens: RawToken[], start: number): boolean {
  for (let i = tokens.length - 1; i >= start; i--) {
    const text = tokens[i]!.text;
    if (/^(\d*)\|$/.test(text) || /^_+$/.test(text)) continue;
    return /-$/.test(text.replace(/_+$/, ''));
  }
  return false;
}

// ── Diff: parsed buffer vs document → the plan ─────────────────────────────

export type LyricPlanEdit =
  | { op: 'setSyllable'; noteKey: string; line: string; text: string; syllableType?: SyllableType }
  | { op: 'removeSyllable'; noteKey: string; line: string }
  | { op: 'setLyricLine'; line: string; lang?: string; lineOrder?: string[] };

/** The plan's edits as EditOps — ONE mapping, shared by the session's
 *  `applyLyricPlan` arm and the editor's live preview (`applyOp` over a
 *  scratch document), so what the preview shows is what apply commits. */
export function lyricPlanOps(edits: LyricPlanEdit[]): import('./ops.ts').EditOp[] {
  return edits.map(edit =>
    edit.op === 'setSyllable'
      ? {
          type: 'setSyllable' as const,
          noteKey: edit.noteKey,
          line: edit.line,
          text: edit.text,
          ...(edit.syllableType ? { syllableType: edit.syllableType } : {})
        }
      : edit.op === 'removeSyllable'
        ? { type: 'removeSyllable' as const, noteKey: edit.noteKey, line: edit.line }
        : {
            type: 'setLyricLine' as const,
            line: edit.line,
            ...(edit.lang !== undefined ? { lang: edit.lang } : {}),
            ...(edit.lineOrder ? { lineOrder: edit.lineOrder } : {})
          }
  );
}

const normalizeType = (type?: string) => (type === 'whole' ? undefined : type);

/**
 * The buffer is the complete lyric state of the part's walk: a line absent
 * from it clears its syllables on reachable events; events outside navigation,
 * outside the walk (and
 * other parts, other voices) are untouched. Empty result = nothing to apply.
 */
export function planLyricEdits(doc: MnxStructure, partIndex: number, parsed: ParsedLyricText): LyricPlanEdit[] {
  if (parsed.diagnostics.length) return [];
  const walk = lyricEventWalk(doc, partIndex);
  const reachable = new Set(lyricPerformance(doc, partIndex).sources);
  const desired = new Map<string, Map<number, { text: string; type?: SyllableType }>>();
  for (const line of parsed.lines) {
    const merged = desired.get(line.lineId) ?? new Map();
    for (const [index, syllable] of line.syllables) merged.set(index, syllable);
    desired.set(line.lineId, merged);
  }
  const lineIds = new Set<string>(desired.keys());
  for (const entry of walk)
    for (const id of Object.keys(entry.event.lyrics?.lines ?? {})) lineIds.add(id);

  const edits: LyricPlanEdit[] = [];
  const metadataAdded = new Set<string>();
  for (const row of parsed.newRows ?? []) {
    metadataAdded.add(row.id);
    edits.push({ op: 'setLyricLine', line: row.id, ...(row.lang ? { lang: row.lang } : {}),
      ...(metadataAdded.size === 1 && parsed.lineOrder ? { lineOrder: parsed.lineOrder } : {}) });
  }
  for (const line of parsed.lines) {
    if (line.minted && line.lang && line.syllables.size > 0 && !metadataAdded.has(line.lineId)) {
      metadataAdded.add(line.lineId);
      edits.push({ op: 'setLyricLine', line: line.lineId, lang: line.lang });
    }
  }
  walk.forEach((entry, index) => {
    for (const id of lineIds) {
      const current = entry.event.lyrics?.lines?.[id];
      const wanted = desired.get(id)?.get(index);
      if (wanted) {
        const sameText = current?.text === wanted.text;
        const sameType = normalizeType(current?.type) === normalizeType(wanted.type);
        if (!current || !sameText || !sameType)
          edits.push({
            op: 'setSyllable', noteKey: entry.noteKey, line: id, text: wanted.text,
            ...(wanted.type ? { syllableType: wanted.type } : {})
          });
      } else if (current && reachable.has(index)) {
        edits.push({ op: 'removeSyllable', noteKey: entry.noteKey, line: id });
      }
    }
  });
  return edits;
}

/** Four written bars or 80 characters, wrapping only at a bar boundary. */
const TEXT_BARS = 4;
const TEXT_COLUMNS = 80;

/** Performance identities are independent of the stored lyric-row identity.
 * Returns through navigation may reuse a row; an occurrence is never a verse. */
/** Each performed visit's name in the text, `bar.occurrence`, by performance ordinal. */
export function lyricVisitLabels(doc: MnxStructure): string[] {
  return linearizePasses(doc).entries.map(visit => `${visit.measureIndex + 1}.${visit.occurrence}`);
}

function lyricPerformance(doc: MnxStructure, partIndex: number) {
  const written = lyricEventWalk(doc, partIndex);
  const visits = linearizePasses(doc).entries;
  const walk: LyricEventEntry[] = [];
  const sources: number[] = [];
  const starts: number[] = [];
  // Navigation may enter/leave inside a bar. Keep only onsets in that slice.
  const onsets = new Map<MnxEvent, Rational>();
  const timeItems = (items: MnxSequenceItem[], start: Rational, scale: Rational): Rational => {
    let cursor = start;
    for (const item of items) {
      if (isTimedEvent(item)) {
        onsets.set(item, cursor);
        const duration = item.duration as MnxEvent['duration'] | [number, number];
        cursor = add(cursor, multiply(Array.isArray(duration)
          ? rational(BigInt(duration[0]), BigInt(duration[1])) : noteDuration(duration), scale));
      } else if (item.type === 'tuplet') cursor = timeItems(item.content, cursor, multiply(scale, tupletScale(item)));
      else if (item.type === 'tremolo') {
        const total = multiply(item.outer ? multiply(noteDuration(item.outer.duration), rational(BigInt(item.outer.multiple ?? 1)))
          : item.content[0] ? noteDuration(item.content[0].duration) : ZERO, scale);
        const step = divide(total, rational(BigInt(item.content.length || 1)));
        for (const child of item.content) { onsets.set(child, cursor); cursor = add(cursor, step); }
      }
    }
    return cursor;
  };
  for (const measure of doc.parts[partIndex]?.measures ?? []) {
    timeItems(measure.sequences?.find(s => (s.staff ?? 1) === 1)?.content ?? [], ZERO, ONE);
  }
  for (const [ordinal, visit] of visits.entries()) {
    starts.push(walk.length);
    written.forEach((entry, index) => {
      if (entry.measureIndex !== visit.measureIndex) return;
      const onset = onsets.get(entry.event) ?? ZERO;
      if (visit.from && compare(onset, rational(BigInt(visit.from[0]), BigInt(visit.from[1]))) < 0) return;
      if (visit.until && compare(onset, rational(BigInt(visit.until[0]), BigInt(visit.until[1]))) >= 0) return;
      walk.push({ ...entry, measureIndex: ordinal });
      sources.push(index);
    });
  }
  starts.push(walk.length);
  return { written, visits, walk, sources, starts, onsets };
}

/** A run of bars nobody sings: `×4`, or `x4` as typed. */
const EMPTY_RUN = /^[x×](\d+)$/i;
/** What anchored text used to start a run with, and a written bar check: neither exists any more. */
const OLD_BAR_NUMBER = /^\d+(?:\.\d+)?\|$/;

/**
 * Canonical text, in the order the words are sung. Each block runs from the
 * first bar played: the main text sings each visit's own verse; a header line
 * (`2:`, `nl:`, `nl 2:`) starts a verse no pass reaches (a hymn's), or another
 * language, from the first bar played again. Nothing in the text says which bar
 * it is in — the margin beside it does, worked out from the bar lines.
 *
 * A line ends on the bar line after its last bar, so every line opens on a word.
 * Bars nobody sings close the line before them as one run (`| ×4 |`), a lead-in
 * stands on a line of its own (`×16 |`), and trailing silence is left off.
 * Lines break at repeats and jumps, at four bars, and before 80 characters.
 */
export function serializeLyricText(doc: MnxStructure, partIndex: number): string {
  const { written, visits, walk, sources, starts } = lyricPerformance(doc, partIndex);
  const { groups } = lineGroups(doc, written);
  const result: string[] = [];
  for (const [group, ids] of groups) {
    const represented = new Set<string>();
    const emit = (override?: number) => {
      const bodies = visits.map((visit, ordinal) => {
        const id = ids[(override ?? visit.verse) - 1];
        if (!id) return null;
        const syllables = new Map<number, { text: string; type?: string }>();
        for (let i = starts[ordinal]!; i < starts[ordinal + 1]!; i++) {
          const key = `${id}:${sources[i]}`;
          const syllable = written[sources[i]!]!.event.lyrics?.lines?.[id];
          if (!syllable || (override !== undefined && represented.has(key))) continue;
          syllables.set(i - starts[ordinal]!, syllable);
          represented.add(key);
        }
        if (!syllables.size) return null;
        const body = serializeLine(walk.slice(starts[ordinal], starts[ordinal + 1]).map(e => ({ ...e, measureIndex: 0 })), syllables);
        // A first word that would read as a header or a run of empty bars is escaped.
        const first = tokenize(body, 0);
        return takeHeader(first) || EMPTY_RUN.test(first[0]?.text ?? '') ? `\\${body}` : body;
      });
      if (bodies.every(body => body === null)) return;
      const header = [group, override === undefined ? '' : String(override)].filter(Boolean).join(' ');
      if (header) result.push(`${header}:`);
      let line = '', lineStart = 0, next = 0;
      const close = () => { if (line) result.push(line); line = ''; };
      bodies.forEach((body, ordinal) => {
        if (body === null) return;
        const gap = ordinal - next;
        const visit = visits[ordinal]!;
        const boundary = ordinal > 0 && (visit.via || doc.global.measures[visit.measureIndex]?.repeatStart
          || visit.measureIndex !== visits[ordinal - 1]!.measureIndex + 1);
        if (gap > 0) {
          // Silence closes the line before it — or, before the first words, stands alone.
          if (line) line += ` | ×${gap} |`; else line = `×${gap} |`;
          close();
        } else if (line && (boundary || ordinal - lineStart >= TEXT_BARS || line.length + body.length + 3 > TEXT_COLUMNS)) {
          line += ' |';
          close();
        }
        if (line) line += ` | ${body}`;
        else { line = body; lineStart = ordinal; }
        next = ordinal + 1;
      });
      close();
    };
    emit();
    // Rows the performance never reaches are still editable and must never
    // disappear simply because the score has no repeat signs (a hymn).
    ids.forEach((_, index) => emit(index + 1));
  }
  return result.join('\n');
}

/** Where a line of the text starts: the bar played that its first token sits in. */
export interface LyricLineStart {
  /** 0-based line of the text. */
  textLine: number;
  /** 0-based bar played (the performance ordinal). */
  ordinal: number;
  /** Which block of the text it is in: 0 is the main text, then one per header line. */
  block: number;
  /** The line puts words on notes (rather than only crossing empty bars). */
  sung: boolean;
  /** The line holds a run of empty bars, so the next line starts further on than it ends. */
  gap: boolean;
}

/**
 * Text in the order the words are sung, back onto the notes. Each block runs
 * from the first bar played; `|` is the next bar played and `×N` that many bars
 * nobody sings; newlines are whitespace. A header line (`2:`, `nl:`, `nl 2:`)
 * starts another block, from the first bar played again, writing that stored
 * row or language rather than each visit's own verse.
 */
export function parseLyricText(doc: MnxStructure, partIndex: number, text: string): ParsedLyricText {
  const { written, visits, walk, sources, onsets } = lyricPerformance(doc, partIndex);
  const { groups } = lineGroups(doc, written);
  const taken = new Set([...groups.values()].flat());
  const minted = new Set<string>();
  const result: ParsedLyricText = { lines: [], diagnostics: [], tokens: [], starts: [] };
  const atLine = (offset: number) => text.slice(0, offset).split('\n').length - 1;
  const assigned = new Map<string, { text: string; type?: SyllableType; index: number }>();
  const visitLabel = (index: number) => {
    const visit = visits[walk[index]!.measureIndex]!;
    return `${visit.measureIndex + 1}.${visit.occurrence}`;
  };
  // The blocks: the main text, then one per header line.
  const blocks: { header: ReturnType<typeof takeHeader>; textLine: number; name: string; tokens: RawToken[] }[] =
    [{ header: null, textLine: 0, name: 'the main text', tokens: [] }];
  let offset = 0;
  text.split('\n').forEach((line, textLine) => {
    const tokens = tokenize(line, offset);
    offset += line.length + 1;
    const header = takeHeader(tokens);
    if (header) blocks.push({ header, textLine, name: `“${tokens.slice(0, header.consumed).map(t => t.text).join(' ')}”`, tokens: tokens.slice(header.consumed) });
    else blocks[blocks.length - 1]!.tokens.push(...tokens);
  });
  // Who has written each place (a stored row at one sung position), so two blocks that write
  // the same words twice are named — and two passes of a bar that share one row's words too.
  const claims = new Map<string, { block: number; text: string; index: number }>();
  const twice = new Map<string, { a: number; b: number; row: number; label: string }>();
  const shares = new Map<string, { textLine: number; bar: number; row: number; first: string; second: string; words: [string[], string[]] }>();
  blocks.forEach((block, b) => {
    const { header, textLine } = block;
    if (header?.ordinal !== undefined && (!Number.isSafeInteger(header.ordinal) || header.ordinal < 1)) {
      result.diagnostics.push({ textLine, message: 'verse number must be a positive integer' });
      return;
    }
    const group = header?.lang ?? '';
    const ids = groups.get(group) ?? [];
    groups.set(group, ids);
    const rowId = (verse: number): { id: string; row: number } => {
      const row = header?.ordinal ?? verse;
      while (ids.length < row) {
        const id = mintLineId(taken); taken.add(id); minted.add(id); ids.push(id);
      }
      return { id: ids[row - 1]!, row };
    };
    // Reuse the syllable grammar against the performed walk. Its bar numbers are
    // performance ordinals; `1|` sets it at the first bar played.
    let buffer = '1|';
    const offsets: { from: number; to: number; source: RawToken }[] = [];
    for (const token of block.tokens) {
      if (OLD_BAR_NUMBER.test(token.text)) {
        result.diagnostics.push({ textLine: atLine(token.from),
          message: `“${token.text}” — the text has no bar numbers: it runs from the first bar played, | is the next bar and ×4 four bars nobody sings` });
        continue;
      }
      if (token.text.endsWith('|') && token.text !== '|') {
        result.diagnostics.push({ textLine: atLine(token.from), message: `put a space before the | in “${token.text}”` });
        continue;
      }
      const from = buffer.length + 1;
      buffer += ` ${token.text}`;
      offsets.push({ from, to: buffer.length, source: token });
    }
    const places = new Map<number, number>();
    const parsed = parseWrittenLyricText(doc, partIndex, buffer, walk, true, visits.length, places);
    const sourceAt = (from: number | undefined) => offsets.find(o => o.from === from)?.source;
    result.diagnostics.push(...parsed.diagnostics.map(({ at, ...d }) => {
      const source = sourceAt(at), played = d.bar;
      const visit = played === undefined ? undefined : visits[played - 1];
      return { ...d, textLine: source ? atLine(source.from) : textLine,
        ...(visit ? { bar: visit.measureIndex + 1, played } : {}) };
    }));
    // Where each line of this block starts.
    const sung = new Set(parsed.tokens.map(token => token.from));
    const byLine = new Map<number, typeof offsets>();
    for (const offset of offsets) {
      const at = atLine(offset.source.from);
      byLine.set(at, [...byLine.get(at) ?? [], offset]);
    }
    for (const [at, tokens] of byLine) {
      // A line starts where its first word or run is; one that opens on a bar line, in the bar it leads into.
      const lead = tokens.find(t => t.source.text !== '|') ?? tokens[tokens.length - 1]!;
      const ordinal = places.get(lead.from);
      if (ordinal !== undefined) result.starts!.push({ textLine: at, ordinal, block: b,
        sung: tokens.some(t => sung.has(t.from)), gap: tokens.some(t => EMPTY_RUN.test(t.source.text)) });
    }
    const rows = new Map<string, ParsedLyricLine>();
    for (const [index, syllable] of parsed.lines[0]?.syllables ?? []) {
      const source = sources[index]!;
      const visit = visits[walk[index]!.measureIndex]!;
      const { id, row } = rowId(visit.verse);
      const place = `${id}:${index}`, claim = claims.get(place);
      if (claim && claim.block !== b) {
        // Two blocks write the same row at the same place: agreeing is no mistake.
        if (claim.text !== syllable.text) twice.set(`${claim.block}>${b}:${id}`, { a: claim.block, b, row, label: visitLabel(index) });
        continue;
      }
      claims.set(place, { block: b, text: syllable.text, index });
      const key = `${id}:${source}`;
      const previous = assigned.get(key);
      if (previous && previous.index !== index && (previous.text !== syllable.text || normalizeType(previous.type) !== normalizeType(syllable.type))) {
        // Two passes of a bar that sing the same verse row store one set of words.
        const first = visitLabel(previous.index), second = visitLabel(index), pair = `${id}:${first}>${second}`;
        const share = shares.get(pair) ?? { textLine, bar: visit.measureIndex + 1, row, first, second, words: [[], []] as [string[], string[]] };
        shares.set(pair, share);
        share.words[0].push(previous.text); share.words[1].push(syllable.text);
      }
      assigned.set(key, { ...syllable, index });
      let line = rows.get(id);
      if (!line) {
        line = { lineId: id, minted: minted.has(id), ...(group ? { lang: group } : {}), ordinal: row, textLine, syllables: new Map() };
        rows.set(id, line);
      }
      line.syllables.set(source, syllable);
    }
    result.lines.push(...rows.values());
    for (const token of parsed.tokens) {
      const original = sourceAt(token.from);
      const sungAt = walk[token.entryIndex], at = sungAt && onsets.get(sungAt.event);
      if (original) result.tokens.push({ from: original.from, to: original.to, entryIndex: sources[token.entryIndex]!,
        ...(sungAt && at ? { ordinal: sungAt.measureIndex, onset: [Number(at.num), Number(at.den)] as [number, number] } : {}) });
    }
  });
  const quoted = (words: string[]) => `“${words.join(' ')}”`;
  for (const { a, b, row, label } of twice.values()) {
    result.diagnostics.push({ textLine: blocks[b]!.textLine,
      message: `verse ${row} at ${label} is written twice, differently — in ${blocks[a]!.name} and under ${blocks[b]!.name}; keep one` });
  }
  for (const share of shares.values()) {
    result.diagnostics.push({ textLine: share.textLine, bar: share.bar,
      message: `${share.first} sings ${quoted(share.words[0])} and ${share.second} sings ${quoted(share.words[1])}, ` +
        `but both are verse ${share.row} of the same written notes, which hold one set of words — make them match` });
  }
  result.starts!.sort((x, y) => x.textLine - y.textLine);
  result.headers = blocks.slice(1).map(block => block.textLine);
  // New rows are declared only where words alone would not keep them: an empty row holding a
  // later one's verse number, or an order the ids would not sort into. A declaration nobody
  // needs is metadata a Guitar Pro save cannot keep.
  if (minted.size) {
    const existing = new Set([...groups.values()].flat().filter(id => !minted.has(id)));
    const ordered = doc.global.lyrics?.lineOrder ?? [];
    const filled = new Set(result.lines.filter(line => line.syllables.size > 0).map(line => line.lineId));
    const wanted = [...ordered, ...[...existing].filter(id => !ordered.includes(id)).sort(), ...minted];
    const present = new Set([...existing, ...[...minted].filter(id => filled.has(id))]);
    const inferred = [...ordered.filter(id => present.has(id)), ...[...present].filter(id => !ordered.includes(id)).sort()];
    const reordered = inferred.join() !== wanted.filter(id => present.has(id)).join();
    if (reordered || [...minted].some(id => !filled.has(id))) {
      result.newRows = [...groups].flatMap(([lang, ids]) => ids.filter(id => minted.has(id)).map(id => ({ id, ...(lang ? { lang } : {}) })));
      if (reordered) result.lineOrder = wanted;
    }
  }
  return result;
}
