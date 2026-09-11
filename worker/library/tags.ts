import { documentWork, type MnxStructure } from '../../src/model/mnx.ts';
import validateMnx from '../generated/validate-mnx.mjs';
import { validatePartExt, validateRootExt } from '../generated/validate-extensions.mjs';
import { LibraryError, type Rendition } from './types.ts';

const WORK_FIELDS = ['title', 'subtitle', 'artist', 'album', 'copyright', 'source', 'notes'] as const;
export function isDerivedDimension(dimension: string) {
  return [...WORK_FIELDS, 'tuning', 'capo'].includes(dimension) || dimension.startsWith('creator.');
}
export function parseMnx(content: ArrayBuffer): MnxStructure {
  let doc: MnxStructure;
  try { doc = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(content)); }
  catch { throw new LibraryError('invalid', 'Invalid MNX JSON'); }
  if (!validateMnx(doc) || (doc._x?.mnxLab && !validateRootExt(doc._x.mnxLab)) ||
      doc.parts.some(p => p._x?.mnxLab && !validatePartExt(p._x.mnxLab))) {
    throw new LibraryError('invalid', 'MNX or its metadata does not match the published schema');
  }
  return doc;
}
export function deriveTags(doc: MnxStructure): { dimension: string; value: string }[] {
  const tags = new Map<string, { dimension: string; value: string }>();
  const add = (dimension: string, raw: string) => {
    const value = raw.trim();
    if (value) tags.set(JSON.stringify([dimension, value]), { dimension, value });
  };
  const work = documentWork(doc);
  for (const field of WORK_FIELDS) if (work?.[field]) add(field, work[field]);
  for (const creator of work?.creators ?? []) add(`creator.${creator.role}`, creator.name);
  for (const part of doc.parts) {
    const ext = part._x?.mnxLab;
    if (ext?.strings?.length) {
      add('tuning', [...ext.strings].sort((a, b) => b.string - a.string).map(({ pitch: p }) =>
        `${p.step}${p.alter ? `[${p.alter > 0 ? '+' : ''}${p.alter}]` : ''}${p.octave}`
      ).join(' '));
    }
    if (ext?.capo !== undefined) add('capo', String(ext.capo));
  }
  return [...tags.values()];
}
// Versions are selected by the caller, never inferred from lexical version ordering.
export function canonicalMnx(canonical: string | null, rows: Rendition[], versions: Readonly<Record<string, string>>): Rendition | null {
  if (!canonical) return null;
  const parent = rows.find(r => r.id === canonical);
  if (!parent) throw new LibraryError('invalid', 'Canonical rendition must belong to the piece');
  if (parent.format === 'mnx') return parent;
  const children = rows.filter(r => r.format === 'mnx' && r.derived_from === parent.id);
  const selected = rows.filter(r => r.format === 'mnx' && r.derived_from === parent.id &&
    r.producer_version !== null && versions[r.producer] === r.producer_version)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0] ?? null;
  if (!selected && children.length) throw new LibraryError('invalid', 'Specify the current converter version and provide its MNX child');
  return selected;
}
