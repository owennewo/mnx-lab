// Markdown AST → Lit templates. Every string lands as a text binding, so the
// model's output is escaped by construction; only http(s) hrefs become links
// (anything else renders as its text), and links never inherit the page's
// opener.
import { html, nothing, type TemplateResult } from 'lit';
import { parseMarkdown, type Align, type Block, type Inline } from '../assist/markdown.ts';

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

/** Alignment as an inline style, absent when the column declared none. */
function alignStyle(a: Align | undefined) {
  return a ? `text-align:${a}` : nothing;
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
    case 'table':
      // The panel is 410–560px and owns exactly ONE scrolling region, so a
      // wide table scrolls inside its own wrapper rather than making the
      // panel body scroll sideways.
      return html`<div class="md-table">
        <table>
          <thead>
            <tr>
              ${b.header.map((c, i) => html`<th style=${alignStyle(b.align[i])}>${inlines(c)}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${b.rows.map(
              r => html`<tr>
                ${r.map((c, i) => html`<td style=${alignStyle(b.align[i])}>${inlines(c)}</td>`)}
              </tr>`
            )}
          </tbody>
        </table>
      </div>`;
    case 'rule':
      return html`<hr />`;
  }
}

export function renderMarkdown(src: string): TemplateResult {
  return html`${parseMarkdown(src).map(block)}`;
}
