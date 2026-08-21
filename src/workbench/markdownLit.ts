// Markdown AST → Lit templates. Every string lands as a text binding, so the
// model's output is escaped by construction; only http(s) hrefs become links
// (anything else renders as its text), and links never inherit the page's
// opener.
import { html, nothing, type TemplateResult } from 'lit';
import { parseMarkdown, type Block, type Inline } from '../assist/markdown.ts';

const SAFE_HREF = /^https?:\/\//i;

function inlines(nodes: Inline[]): unknown[] {
  return nodes.map(n => {
    switch (n.kind) {
      case 'text':
        return n.text;
      case 'code':
        return html`<code>${n.text}</code>`;
      case 'strong':
        return html`<strong>${inlines(n.children)}</strong>`;
      case 'em':
        return html`<em>${inlines(n.children)}</em>`;
      case 'link':
        return SAFE_HREF.test(n.href)
          ? html`<a href=${n.href} target="_blank" rel="noopener noreferrer">${inlines(n.children)}</a>`
          : html`${inlines(n.children)}`;
    }
  });
}

function block(b: Block): TemplateResult | typeof nothing {
  switch (b.kind) {
    case 'heading': {
      const body = inlines(b.inlines);
      return b.level === 1
        ? html`<h1>${body}</h1>`
        : b.level === 2
          ? html`<h2>${body}</h2>`
          : html`<h3>${body}</h3>`;
    }
    case 'paragraph':
      return html`<p>${inlines(b.inlines)}</p>`;
    case 'code':
      return html`<pre data-lang=${b.lang || nothing}><code>${b.text}</code></pre>`;
    case 'list':
      return b.ordered
        ? html`<ol>${b.items.map(i => html`<li>${inlines(i)}</li>`)}</ol>`
        : html`<ul>${b.items.map(i => html`<li>${inlines(i)}</li>`)}</ul>`;
    case 'quote':
      return html`<blockquote>${inlines(b.inlines)}</blockquote>`;
    case 'rule':
      return html`<hr />`;
  }
}

export function renderMarkdown(src: string): TemplateResult {
  return html`${parseMarkdown(src).map(block)}`;
}
