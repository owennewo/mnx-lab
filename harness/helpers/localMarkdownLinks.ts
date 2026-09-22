import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Current reference surfaces only: roadmap archives remain historical evidence. */
export function currentReferenceFiles(root: string): string[] {
  const walk = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true })
    .flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name))
      : entry.name.endsWith('.md') ? [join(dir, entry.name)] : []);
  return ['README.md', 'CLAUDE.md', 'apps/studio/README.md', ...walk('docs')];
}

/** File destinations in inline links/images and reference definitions; anchors are not checked. */
export function localMarkdownDestinations(markdown: string): string[] {
  const prose = markdown.replace(/<!--[^]*?-->/g, '').replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[^]*?^ {0,3}\1[^\n]*$/gm, '')
    .replace(/(`+)[^]*?\1/g, '');
  const destinations: string[] = [];
  const pattern = /\]\(\s*(?:<([^>]+)>|((?:[^\s()]|\([^()]*\))+))(?:\s+"[^"]*")?\s*\)|^ {0,3}\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/gm;
  for (const match of prose.matchAll(pattern)) {
    const target = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/i.test(target)) continue;
    const path = target.split(/[?#]/, 1)[0];
    if (path) destinations.push(decodeURIComponent(path));
  }
  return destinations;
}

export function brokenLocalMarkdownLinks(root: string, files = currentReferenceFiles(root)): string[] {
  return files.flatMap(file => localMarkdownDestinations(readFileSync(join(root, file), 'utf8'))
    .filter(target => !existsSync(target.startsWith('/') ? resolve(root, `.${target}`) : resolve(root, dirname(file), target)))
    .map(target => `${file}: ${target}`));
}
