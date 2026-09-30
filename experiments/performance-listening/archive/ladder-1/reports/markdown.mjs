import { dirname, relative, resolve } from 'node:path';

export const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function inline(text, source, here) {
  const tokens = /`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*/g;
  let html = '', cursor = 0;
  for (const match of text.matchAll(tokens)) {
    html += escape(text.slice(cursor, match.index));
    if (match[1] !== undefined) html += `<code>${escape(match[1])}</code>`;
    else if (match[2] !== undefined) {
      const target = match[3];
      if (/^https?:\/\//.test(target)) html += `<a href="${escape(target)}" rel="noreferrer">${escape(match[2])}</a>`;
      else if (!/^[a-z][a-z\d+.-]*:|^\/\//i.test(target)) {
        const [path, hash] = target.split('#');
        const link = relative(here, resolve(dirname(source), path)) + (hash ? `#${hash}` : '');
        html += `<a href="${escape(link)}">${escape(match[2])}</a>`;
      } else throw new Error(`Unsupported link protocol in ${source}`);
    } else html += `<strong>${escape(match[4])}</strong>`;
    cursor = match.index + match[0].length;
  }
  return html + escape(text.slice(cursor));
}

// Deliberately limited to the headings, paragraphs, bullets and tables in our sources.
export function markdown(input, here) {
  const lines = input.text.trim().split(/\r?\n/);
  const render = text => inline(text, input.path, here);
  const cells = line => line.trim().slice(1, -1).split(/(?<!\\)\|/).map(s => s.trim().replaceAll('\\|', '|'));
  const seen = new Map();
  const blocks = [];
  for (let i = 0; i < lines.length;) {
    if (!lines[i].trim()) { i++; continue; }
    if (lines[i].startsWith('```')) {
      const code = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      if (i === lines.length) throw new Error(`Unclosed code block in ${input.path}`);
      i++; blocks.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`); continue;
    }
    const heading = /^(#{1,6}) (.+)$/.exec(lines[i]);
    if (heading) {
      const slug = heading[2].toLowerCase().replace(/[^a-z\d]+/g, '-').replace(/^-|-$/g, '');
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      const id = `${input.id}-${slug}${count ? `-${count}` : ''}`;
      const level = Math.min(6, heading[1].length + (input.id === 'summary' ? 0 : 1));
      blocks.push(`<h${level} id="${id}">${render(heading[2])}</h${level}>`);
      i++; continue;
    }
    if (lines[i].startsWith('|')) {
      const headers = cells(lines[i++]);
      if (!/^\|[\s:|\-]+\|$/.test(lines[i] ?? '')) throw new Error(`Missing table separator in ${input.path}`);
      i++;
      const rows = [];
      while (lines[i]?.startsWith('|')) {
        const row = cells(lines[i++]);
        if (row.length !== headers.length) throw new Error(`Table width mismatch in ${input.path}`);
        rows.push(`<tr>${row.map(c => `<td>${render(c)}</td>`).join('')}</tr>`);
      }
      blocks.push(`<div class="table-wrap" tabindex="0" role="region" aria-label="${escape(headers.join(', '))}"><table><thead><tr>${headers.map(c => `<th scope="col">${render(c)}</th>`).join('')}</tr></thead><tbody>${rows.join('\n')}</tbody></table></div>`);
      continue;
    }
    if (lines[i].startsWith('- ')) {
      const items = [];
      while (lines[i]?.startsWith('- ')) {
        let item = lines[i++].slice(2);
        while (lines[i]?.startsWith('  ')) item += ' ' + lines[i++].trim();
        items.push(`<li>${render(item)}</li>`);
      }
      blocks.push(`<ul>${items.join('\n')}</ul>`); continue;
    }
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||- )/.test(lines[i])) paragraph.push(lines[i++]);
    if (!paragraph.length) throw new Error(`Unsupported block in ${input.path}: ${lines[i]}`);
    blocks.push(`<p>${render(paragraph.join(' '))}</p>`);
  }
  return blocks.join('\n');
}

