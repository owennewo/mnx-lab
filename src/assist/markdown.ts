// A small markdown subset parsed to an AST — never to HTML. The assistant's
// replies render through Lit templates built from this tree, so model output
// can never become markup (core-assist-byok.md: with a key in localStorage,
// an HTML sink is a credential vector). Pure and dependency-free, so it tests
// from the harness; the Lit half lives in workbench/markdownLit.ts.
//
// Subset: ATX headings, fenced code (an unclosed fence while streaming is
// still a code block), unordered/ordered lists (one level), blockquotes,
// GFM pipe tables, thematic breaks, paragraphs; inline code, **strong**,
// *em*/_em_, [links]. Anything else is text.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'link'; href: string; children: Inline[] };

/** A column's declared alignment; null is the renderer's default. */
export type Align = 'left' | 'center' | 'right' | null;

export type Block =
  | { kind: 'heading'; level: number; inlines: Inline[] }
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'quote'; inlines: Inline[] }
  | { kind: 'table'; align: Align[]; header: Inline[][]; rows: Inline[][][] }
  | { kind: 'rule' };

const FENCE = /^\s*```\s*([\w+-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const DELIM_CELL = /^:?-+:?$/;

/** Split one table row into trimmed cells. A `\|` is a literal pipe, so the
 *  scan is character-wise rather than a `split`. Leading/trailing pipes are
 *  optional, per GFM. */
function splitCells(line: string): string[] {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && text[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

/** The delimiter row's alignments, or null if this is not one. A pipe is
 *  REQUIRED — without it `---` is a thematic break, and a table is not worth
 *  making that ambiguous; a one-column table writes `| --- |`. */
function parseDelimiter(line: string): Align[] | null {
  if (!line.includes('|')) return null;
  const cells = splitCells(line);
  const align: Align[] = [];
  for (const cell of cells) {
    if (!DELIM_CELL.test(cell)) return null;
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    align.push(left && right ? 'center' : right ? 'right' : left ? 'left' : null);
  }
  return align.length ? align : null;
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'paragraph', inlines: parseInlines(para.join(' ')) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = FENCE.exec(line);
    if (fence) {
      flushPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      blocks.push({ kind: 'code', lang: fence[1] ?? '', text: body.join('\n') });
      continue;
    }
    if (line.trim() === '') {
      flushPara();
      continue;
    }
    if (RULE.test(line)) {
      flushPara();
      blocks.push({ kind: 'rule' });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flushPara();
      blocks.push({ kind: 'heading', level: heading[1].length, inlines: parseInlines(heading[2]) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = ordered ? NUMBERED.exec(lines[i]) : BULLET.exec(lines[i]);
        if (!m) break;
        let text = m[1];
        // lazy continuation: indented lines belong to the item
        while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !BULLET.test(lines[i + 1]) && !NUMBERED.test(lines[i + 1])) {
          text += ' ' + lines[++i].trim();
        }
        items.push(parseInlines(text));
        i++;
      }
      i--;
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    // A table is only a table once its DELIMITER row exists — mid-stream the
    // header alone is still a paragraph, and re-renders as a grid when the
    // second line lands (the fenced-code flicker, deliberately).
    if (line.includes('|') && i + 1 < lines.length) {
      const align = parseDelimiter(lines[i + 1]);
      const header = align ? splitCells(line) : null;
      if (align && header && header.length === align.length) {
        flushPara();
        i += 2;
        const rows: Inline[][][] = [];
        while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
          const cells = splitCells(lines[i]);
          // Ragged rows are padded and truncated to the header's width, so a
          // model's slightly-off output cannot break the grid.
          rows.push(Array.from({ length: align.length }, (_, c) => parseInlines(cells[c] ?? '')));
          i++;
        }
        i--;
        blocks.push({ kind: 'table', align, header: header.map(parseInlines), rows });
        continue;
      }
    }
    const quote = QUOTE.exec(line);
    if (quote) {
      flushPara();
      const parts = [quote[1]];
      while (i + 1 < lines.length && QUOTE.test(lines[i + 1])) parts.push(QUOTE.exec(lines[++i])![1]);
      blocks.push({ kind: 'quote', inlines: parseInlines(parts.join(' ')) });
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  return blocks;
}

/** Inline grammar, leftmost-match, no nesting of the same delimiter. Code
 *  spans win over everything (their contents are literal). */
export function parseInlines(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  const pushText = (t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.kind === 'text') last.text += t;
    else out.push({ kind: 'text', text: t });
  };
  while (rest.length) {
    const code = /`([^`]+)`/.exec(rest);
    const strong = /\*\*(.+?)\*\*/.exec(rest);
    const em = /(?<![\w*])(\*|_)(?!\s)(.+?)(?<!\s)\1(?![\w*])/.exec(rest);
    const link = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
    const candidates = [code, strong, em, link].filter((m): m is RegExpExecArray => !!m);
    if (!candidates.length) {
      pushText(rest);
      break;
    }
    const first = candidates.reduce((a, b) => (b.index < a.index ? b : a));
    pushText(rest.slice(0, first.index));
    if (first === code) out.push({ kind: 'code', text: first[1] });
    else if (first === strong) out.push({ kind: 'strong', children: parseInlines(first[1]) });
    else if (first === em) out.push({ kind: 'em', children: parseInlines(first[2]) });
    else out.push({ kind: 'link', href: first[2], children: parseInlines(first[1]) });
    rest = rest.slice(first.index + first[0].length);
  }
  return out;
}
