// A small markdown subset parsed to an AST — never to HTML. The assistant's
// replies render through Lit templates built from this tree, so model output
// can never become markup (core-assist-byok.md: with a key in localStorage,
// an HTML sink is a credential vector). Pure and dependency-free, so it tests
// from the harness; the Lit half lives in workbench/markdownLit.ts.
//
// Subset: ATX headings, fenced code (an unclosed fence while streaming is
// still a code block), unordered/ordered lists (one level), blockquotes,
// thematic breaks, paragraphs; inline code, **strong**, *em*/_em_, [links].
// Anything else is text.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'link'; href: string; children: Inline[] };

export type Block =
  | { kind: 'heading'; level: number; inlines: Inline[] }
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'quote'; inlines: Inline[] }
  | { kind: 'rule' };

const FENCE = /^\s*```\s*([\w+-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;

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
