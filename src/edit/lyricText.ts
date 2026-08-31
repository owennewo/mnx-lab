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
//   bar check       | · 6|         asserts position, resyncs, jumps auto-skip
//   header          nl 2:          order-free int (group ordinal) + lang code
//   escape          \              a first syllable that would read as a header
//
// Whitespace is never semantic beyond one boundary. Rests, spaces, grace
// notes and tie continuations are skipped automatically by the walk, so most
// pasted text needs no special tokens at all.

import type { MnxEvent, MnxSequenceItem, MnxStructure } from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';
import { noteKeyAt } from '../model/noteWalk.ts';

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
  const forEachVoiceOneEvent = (fn: (event: MnxEvent, measureIndex: number, eventIndex: number, containerIndex?: number) => void) => {
    (part.measures ?? []).forEach((measure, measureIndex) => {
      const sequence = (measure.sequences ?? []).find(s => (s.staff ?? 1) === 1);
      (sequence?.content ?? []).forEach((item: MnxSequenceItem, eventIndex) => {
        const record = item as { type?: string; content?: MnxSequenceItem[] };
        if (record.type === 'grace') return;
        if (record.type === 'tuplet' || record.type === 'tremolo') {
          (record.content ?? []).forEach((child, containerIndex) => {
            if (isTimedEvent(child)) fn(child as MnxEvent, measureIndex, eventIndex, containerIndex);
          });
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
  ordinalOf: (id: string) => { group: string; ordinal: number };
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
  return {
    groups,
    ordinalOf: id => {
      const key = metadata[id]?.lang ?? '';
      return { group: key, ordinal: (groups.get(key) ?? []).indexOf(id) + 1 };
    }
  };
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

/**
 * The canonical projection: every line that carries a syllable on this part's
 * walk, in stacking order. Headers spell the language for non-primary groups
 * and the ordinal whenever it is not the next implicit one (a sparse group
 * serializes as `2:` so the round trip lands on the same id). Labels stay in
 * `lineMetadata` — the inspector's pills manage them, not this surface.
 */
export function serializeLyricText(doc: MnxStructure, partIndex: number): string {
  const walk = lyricEventWalk(doc, partIndex);
  const { groups, ordinalOf } = lineGroups(doc, walk);
  const lines: string[] = [];
  const counters = new Map<string, number>();
  for (const [group, ids] of groups) {
    for (const id of ids) {
      const syllables = new Map<number, { text: string; type?: string }>();
      walk.forEach((entry, index) => {
        const line = entry.event.lyrics?.lines?.[id];
        if (line?.text !== undefined) syllables.set(index, { text: line.text, ...(line.type ? { type: line.type } : {}) });
      });
      if (syllables.size === 0) continue;
      const { ordinal } = ordinalOf(id);
      const implicit = (counters.get(group) ?? 0) + 1;
      counters.set(group, ordinal);
      const header = [
        ...(group ? [group] : []),
        ...(ordinal !== implicit ? [String(ordinal)] : [])
      ];
      const body = serializeLine(walk, syllables);
      const escaped = /^[^\s\\]*:($|\s)/.test(body) ? `\\${body}` : body;
      lines.push(header.length > 0 ? `${header.join(' ')}: ${escaped}` : escaped);
    }
  }
  return lines.join('\n');
}

// ── Parse: text → assignments + diagnostics ────────────────────────────────

export interface LyricTextDiagnostic {
  /** 0-based text line the problem sits on. */
  textLine: number;
  /** 1-based bar, when the problem is bar-anchored. */
  bar?: number;
  message: string;
}

export interface ParsedLyricLine {
  /** The resolved document line id (existing, or minted). */
  lineId: string;
  minted: boolean;
  lang?: string;
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
}

export interface ParsedLyricText {
  lines: ParsedLyricLine[];
  diagnostics: LyricTextDiagnostic[];
  tokens: LyricTokenSpan[];
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

export function parseLyricText(doc: MnxStructure, partIndex: number, text: string): ParsedLyricText {
  const walk = lyricEventWalk(doc, partIndex);
  const { groups } = lineGroups(doc, walk);
  const diagnostics: LyricTextDiagnostic[] = [];
  const tokens: LyricTokenSpan[] = [];
  const lines: ParsedLyricLine[] = [];
  const counters = new Map<string, number>();
  const minted = new Set<string>();
  const takenIds = new Set<string>([...groups.values()].flat());
  const barCount = walk.reduce((max, entry) => Math.max(max, entry.measureIndex + 1), 0);

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
      while (ids.length < ordinal - 1) ids.push(mintLineId(takenIds));
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
          : (next > 0 ? walk[next - 1]!.measureIndex : barPointer) + 1;
        if (resolved >= barCount && barCount > 0)
          diagnostics.push({ textLine, bar: resolved + 1, message: `bar ${resolved + 1} is beyond the music (${barCount} bars)` });
        if (lastSyllableBar >= resolved)
          diagnostics.push({ textLine, bar: resolved + 1, message: `too many syllables before bar ${resolved + 1} — they spill into it` });
        while (next < walk.length && walk[next]!.measureIndex < resolved) next++;
        barPointer = resolved;
        continue;
      }
      if (/^_+$/.test(token.text)) {
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
        diagnostics.push({ textLine, message: `not a lyric token — “${token.text}”` });
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
            diagnostics.push({ textLine, message: 'more syllables than sung notes — the rest land nowhere' });
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
      if (firstEntry !== null) tokens.push({ from: token.from, to: token.to, entryIndex: firstEntry });
      consumeSkips(extender);
      if (overflowed) break;
    }

    if (trailingHyphenOpen(rawTokens, header?.consumed ?? 0))
      diagnostics.push({ textLine, message: 'the line ends mid-word (a trailing hyphen with nothing after)' });
    lines.push({ lineId, minted: wasMinted, ...(header?.lang ? { lang: header.lang } : {}), syllables });
  }
  return { lines, diagnostics, tokens };
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
  | { op: 'setLyricLine'; line: string; lang?: string };

const normalizeType = (type?: string) => (type === 'whole' ? undefined : type);

/**
 * The buffer is the complete lyric state of the part's walk: a line absent
 * from it clears its syllables on those events; events outside the walk (and
 * other parts, other voices) are untouched. Empty result = nothing to apply.
 */
export function planLyricEdits(doc: MnxStructure, partIndex: number, parsed: ParsedLyricText): LyricPlanEdit[] {
  const walk = lyricEventWalk(doc, partIndex);
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
  for (const line of parsed.lines) {
    if (line.minted && line.lang && line.syllables.size > 0)
      edits.push({ op: 'setLyricLine', line: line.lineId, lang: line.lang });
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
      } else if (current) {
        edits.push({ op: 'removeSyllable', noteKey: entry.noteKey, line: id });
      }
    }
  });
  return edits;
}
