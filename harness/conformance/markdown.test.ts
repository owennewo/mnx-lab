// The assistant's markdown subset (core-assist-byok.md): parsed to an AST,
// never to HTML. Pinned: the block grammar, the inline grammar, and the two
// behaviours that matter for a streaming chat — an unclosed fence is still
// code, and anything the parser does not know stays literal text.
import { describe, expect, it } from 'vitest';
import { parseInlines, parseMarkdown } from '../../src/assist/markdown.ts';

describe('blocks', () => {
  it('headings, paragraphs, rules', () => {
    expect(parseMarkdown('# Title\n\nsome text\nmore\n\n---\n## Sub')).toEqual([
      { kind: 'heading', level: 1, inlines: [{ kind: 'text', text: 'Title' }] },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'some text more' }] },
      { kind: 'rule' },
      { kind: 'heading', level: 2, inlines: [{ kind: 'text', text: 'Sub' }] }
    ]);
  });

  it('fenced code keeps its contents literal, with a language tag', () => {
    const [b] = parseMarkdown('```json\n{"a": **1**}\n# not a heading\n```');
    expect(b).toEqual({ kind: 'code', lang: 'json', text: '{"a": **1**}\n# not a heading' });
  });

  it('an unclosed fence (mid-stream) is still a code block', () => {
    expect(parseMarkdown('text\n```\nlet x = 1;')).toEqual([
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'text' }] },
      { kind: 'code', lang: '', text: 'let x = 1;' }
    ]);
  });

  it('lists: bullet and numbered, with indented continuation', () => {
    expect(parseMarkdown('- one\n- two\n  continued\n\n1. a\n2) b')).toEqual([
      { kind: 'list', ordered: false, items: [[{ kind: 'text', text: 'one' }], [{ kind: 'text', text: 'two continued' }]] },
      { kind: 'list', ordered: true, items: [[{ kind: 'text', text: 'a' }], [{ kind: 'text', text: 'b' }]] }
    ]);
  });

  it('blockquotes merge their lines', () => {
    expect(parseMarkdown('> a\n> b')).toEqual([{ kind: 'quote', inlines: [{ kind: 'text', text: 'a b' }] }]);
  });
});

describe('inlines', () => {
  it('code, strong, em, links — leftmost wins, code is literal', () => {
    expect(parseInlines('a `**x**` **b _c_** *d* [e](https://x.y) f')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'code', text: '**x**' },
      { kind: 'text', text: ' ' },
      { kind: 'strong', children: [{ kind: 'text', text: 'b ' }, { kind: 'em', children: [{ kind: 'text', text: 'c' }] }] },
      { kind: 'text', text: ' ' },
      { kind: 'em', children: [{ kind: 'text', text: 'd' }] },
      { kind: 'text', text: ' ' },
      { kind: 'link', href: 'https://x.y', children: [{ kind: 'text', text: 'e' }] },
      { kind: 'text', text: ' f' }
    ]);
  });

  it('underscores inside words and lone asterisks stay text', () => {
    expect(parseInlines('snake_case_name and 2 * 3')).toEqual([{ kind: 'text', text: 'snake_case_name and 2 * 3' }]);
  });

  it('HTML is just text — there is no HTML', () => {
    expect(parseInlines('<img src=x onerror=alert(1)>')).toEqual([{ kind: 'text', text: '<img src=x onerror=alert(1)>' }]);
  });
});
