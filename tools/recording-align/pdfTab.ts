// A tab PDF's frets, read off its drawing rather than by eye: each page's lines (from
// `pdftocairo -svg`) give the tab staves and the barlines, and each fret number is a
// word with a box (`pdftotext -bbox`). A number is snapped to the string line it sits
// on and the bar it falls in, and numbers at one x are one column — so a draft tab text
// comes out with every bar's frets in order and only the rhythm and the voices left to
// read from the page. Works on PDFs whose tab numbers are text (notation programs'
// exports); a scan has none, and is refused. `align.ts pdf` runs it; the README says how.
//
//   bar 11                       a draft bar: its columns, each at its place in the bar
//     # 0.04 5/0 · 0.13 5/0 · 0.21 2/5+5/0 · …
//     v1: ?                      (0 = the barline, 1 = the next) — durations to fill in
//
// An X (a dead note) is kept as `x`. Brackets round a number are drawn, not text, so a
// bracketed note reads as a plain one; and the first bar's places count from the staff's
// left edge, clef and time signature included.

export interface PdfLine { x1: number; y1: number; x2: number; y2: number }
export interface PdfWord { text: string; xMin: number; yMin: number; xMax: number; yMax: number }
export interface PdfPage { lines: PdfLine[]; words: PdfWord[] }

/** The straight strokes of a `pdftocairo -svg` page, transformed into page points. */
export function svgLines(svg: string): PdfLine[] {
  const lines: PdfLine[] = [];
  for (const [path] of svg.matchAll(/<path\b[^>]*>/g)) {
    const m = /\bd="M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) ?"/.exec(path);
    if (!m) continue;
    const matrix = /\btransform="matrix\(([^)]*)\)"/.exec(path)?.[1];
    const [a, b, c, d, e, f] = matrix ? matrix.split(/[ ,]+/).map(Number) : [1, 0, 0, 1, 0, 0];
    const at = (x: number, y: number) => [a * x + c * y + e, b * x + d * y + f];
    const [x1, y1] = at(Number(m[1]), Number(m[2]));
    const [x2, y2] = at(Number(m[3]), Number(m[4]));
    lines.push({ x1: Math.min(x1, x2), y1: Math.min(y1, y2), x2: Math.max(x1, x2), y2: Math.max(y1, y2) });
  }
  return lines;
}

/** One page's words from `pdftotext -bbox` (every page, in order). */
export function bboxPages(xhtml: string): PdfWord[][] {
  const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  return xhtml.split(/<page\b/).slice(1).map(page => [...page.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
    .map(m => ({ xMin: Number(m[1]), yMin: Number(m[2]), xMax: Number(m[3]), yMax: Number(m[4]), text: unescape(m[5]) })));
}

export interface TabStaff { top: number; spacing: number; strings: number; left: number; right: number; bars: [number, number][] }

/** Horizontal lines grouped into staves of equal spacing; those of `strings` lines are tab. */
export function tabStaves(lines: PdfLine[], strings = 6): TabStaff[] {
  const horizontal = lines.filter(l => l.y2 - l.y1 < 0.5 && l.x2 - l.x1 > 100).sort((p, q) => p.y1 - q.y1);
  const rows: PdfLine[] = [];
  for (const l of horizontal) {
    const last = rows.at(-1);
    if (last && Math.abs(last.y1 - l.y1) < 0.5 && l.x1 < last.x2 && last.x1 < l.x2) { last.x1 = Math.min(last.x1, l.x1); last.x2 = Math.max(last.x2, l.x2); }
    else rows.push({ ...l });
  }
  const staves: PdfLine[][] = [];
  for (const row of rows) {
    const staff = staves.at(-1);
    const gap = staff && row.y1 - staff.at(-1)!.y1;
    const spacing = staff && staff.length > 1 ? staff[1].y1 - staff[0].y1 : undefined;
    const fits = staff && gap! < 20 && Math.abs(row.x1 - staff[0].x1) < 2 && (spacing === undefined || Math.abs(gap! - spacing) < 0.6);
    if (fits) staff!.push(row); else staves.push([row]);
  }
  const vertical = lines.filter(l => l.x2 - l.x1 < 1.5 && l.y2 - l.y1 > 5);
  return staves.filter(s => s.length === strings).map(s => {
    const top = s[0].y1, bottom = s.at(-1)!.y1, left = s[0].x1, right = s[0].x2;
    // Barlines: strokes spanning the staff, inside it; a double or repeat bar is one.
    const xs = vertical.filter(v => v.y1 <= top + 1 && v.y2 >= bottom - 1 && v.x1 > left + 2 && v.x1 < right - 2)
      .map(v => (v.x1 + v.x2) / 2).sort((p, q) => p - q)
      .filter((x, i, all) => i === 0 || x - all[i - 1] > 8);
    const edges = [left, ...xs, right];
    const bars = edges.slice(1).map((x, i): [number, number] => [edges[i], x]).filter(([a, b]) => b - a > 15);
    return { top, spacing: (bottom - top) / (strings - 1), strings, left, right, bars };
  });
}

const FRET = /^(\d{1,2}|[xX])$/;

export interface DraftColumn { at: number; notes: string[] }
export interface DraftBar { page: number; columns: DraftColumn[] }

/** Each tab staff's bars, in reading order, with their fret columns. */
export function draftBars(pages: PdfPage[], strings = 6): DraftBar[] {
  const bars: DraftBar[] = [];
  pages.forEach((page, p) => {
    for (const staff of tabStaves(page.lines, strings)) {
      const frets = page.words.flatMap(w => {
        const m = FRET.exec(w.text);
        if (!m) return [];
        const cy = (w.yMin + w.yMax) / 2, cx = (w.xMin + w.xMax) / 2;
        const string = Math.round((cy - staff.top) / staff.spacing) + 1;
        if (string < 1 || string > staff.strings || Math.abs(cy - (staff.top + (string - 1) * staff.spacing)) > staff.spacing * 0.45) return [];
        const fret = /[xX]/.test(m[1]) ? 'x' : m[1];
        return [{ cx, string, fret }];
      });
      const widths = staff.bars.map(([a, b]) => b - a).sort((a, b) => a - b);
      for (const [k, [start, end]] of staff.bars.entries()) {
        const inside = frets.filter(f => f.cx > start && f.cx < end).sort((a, b) => a.cx - b.cx);
        // A start repeat after the clef leaves the clef's width as a 'bar' before it.
        if (k === 0 && !inside.length && end - start < widths[widths.length >> 1] / 2) continue;
        const columns: { cx: number; notes: { string: number; fret: string }[] }[] = [];
        for (const f of inside) {
          const column = columns.at(-1);
          if (column && f.cx - column.cx < staff.spacing * 0.6 && !column.notes.some(n => n.string === f.string)) column.notes.push(f);
          else columns.push({ cx: f.cx, notes: [f] });
        }
        bars.push({ page: p + 1, columns: columns.map(c => ({
          at: (c.cx - start) / (end - start),
          notes: c.notes.sort((a, b) => a.string - b.string).map(n => `${n.string}/${n.fret}`),
        })) });
      }
    }
  });
  return bars;
}

const STANDARD = [40, 45, 50, 55, 59, 64];
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** The tuning a tab staff's string letters name (high string first on the page), low→high,
 *  each in the octave nearest standard guitar tuning's — or undefined without six letters. */
export function staffTuning(pages: PdfPage[]): string | undefined {
  for (const page of pages) {
    const staff = tabStaves(page.lines)[0];
    if (!staff) continue;
    const letters = page.words.filter(w => /^[A-G][#b]?$/.test(w.text) && w.xMax < staff.left + 40 && w.xMin > staff.left - 20)
      .map(w => ({ cy: (w.yMin + w.yMax) / 2, text: w.text }))
      .filter(w => w.cy > staff.top - staff.spacing / 2 && w.cy < staff.top + (staff.strings - 0.5) * staff.spacing)
      .sort((a, b) => a.cy - b.cy);
    if (letters.length !== 6) return undefined;
    return letters.reverse().map(({ text }, i) => {
      const pc = (CLASS[text[0]] + (text[1] === '#' ? 1 : text[1] === 'b' ? -1 : 0) + 12) % 12;
      const midi = [-1, 0, 1].map(o => STANDARD[i] - ((STANDARD[i] - pc) % 12 + 12) % 12 + 12 * o)
        .reduce((best, m) => Math.abs(m - STANDARD[i]) < Math.abs(best - STANDARD[i]) ? m : best);
      return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
    }).join(' ');
  }
  return undefined;
}

/** The draft tab text: a header to correct, then every bar's columns over a voice to fill in. */
export function draftTabText(bars: DraftBar[], header: { title?: string; tuning?: string } = {}): string {
  const out = [`title: ${header.title ?? '?'}`, `tuning: ${header.tuning ?? 'standard'}        # check: low→high, as the staff's letters say`, 'key: 0', 'time: 4/4', 'tempo: ?', ''];
  bars.forEach((bar, i) => {
    if (i === 0 || bars[i - 1].page !== bar.page) out.push(`# page ${bar.page}`);
    out.push(`bar ${i + 1}`);
    out.push(`  # ${bar.columns.map(c => `${c.at.toFixed(2)} ${c.notes.join('+')}`).join(' · ') || '(no frets)'}`);
    out.push('  v1: ?');
  });
  return out.join('\n') + '\n';
}

interface NoteLike { id?: string; ties?: { target?: string }[]; _x?: { mnxLab?: { string?: number; fret?: number; tab?: { technique?: { dead?: boolean } } } } }
interface ItemLike { content?: ItemLike[]; notes?: NoteLike[] }

/**
 * A built transcription against the PDF's frets, bar by bar: the notes each bar strikes
 * (a tie's landing is not struck, and tab leaves it unwritten) against the numbers the
 * page prints there. A note the transcription has and the page lacks — or the reverse —
 * is a misreading or a deliberate departure; either way it is named.
 */
export function compareFrets(bars: DraftBar[], document: { parts: { measures: { sequences: { content: ItemLike[] }[] }[] }[] }):
    { bar: number; transcriptionOnly: string[]; pdfOnly: string[] }[] {
  const landings = new Set<string>();
  const struck = document.parts[0].measures.map(m => {
    const notes: NoteLike[] = [];
    const walk = (items: ItemLike[]) => items.forEach(item => { if (item.content) walk(item.content); notes.push(...item.notes ?? []); });
    m.sequences.forEach(s => walk(s.content));
    notes.forEach(n => n.ties?.forEach(t => t.target && landings.add(t.target)));
    return notes;
  });
  const found: { bar: number; transcriptionOnly: string[]; pdfOnly: string[] }[] = [];
  for (let i = 0; i < Math.max(struck.length, bars.length); i++) {
    const mine = (struck[i] ?? []).filter(n => !n.id || !landings.has(n.id)).map(n => {
      const x = n._x?.mnxLab;
      return `${x?.string}/${x?.tab?.technique?.dead ? 'x' : x?.fret}`;
    });
    const page = bars[i]?.columns.flatMap(c => c.notes) ?? [];
    const pdfOnly = [...page];
    const transcriptionOnly = mine.filter(note => { const k = pdfOnly.indexOf(note); if (k < 0) return true; pdfOnly.splice(k, 1); return false; });
    if (transcriptionOnly.length || pdfOnly.length) found.push({ bar: i + 1, transcriptionOnly, pdfOnly });
  }
  return found;
}
