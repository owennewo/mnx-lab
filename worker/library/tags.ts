// The service derives nothing from music: MNX is the lab's working format, not
// (yet) its storage format (roadmap: studio-storage-source-canonical). Derived
// tags arrive from the ingest tool as a projection; this module only knows
// which dimensions ARE that projection, and validates any MNX that is stored.
import type { MnxStructure } from '../../src/model/mnx.ts';
import validateMnx from '../generated/validate-mnx.mjs';
import validateLabel from '../generated/validate-library-label.mjs';
import { validatePartExt, validateRootExt } from '../generated/validate-extensions.mjs';
import { LibraryError } from './types.ts';

const WORK_FIELDS = ['title', 'subtitle', 'artist', 'album', 'copyright', 'source', 'notes'] as const;
/** Dimensions that describe the music itself. They are never asserted by hand:
 *  they come from a source (the sidecar, a validated conversion) and are
 *  corrected through aliases, so a fixed converter or a re-read sidecar can
 *  rebuild them without losing a person's correction. */
export function isDerivedDimension(dimension: string) {
  return [...WORK_FIELDS, 'tuning', 'tuning-name', 'capo'].includes(dimension) || dimension.startsWith('creator.');
}
export function parseMnx(content: ArrayBuffer): MnxStructure {
  let doc: MnxStructure;
  try { doc = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(content)); }
  catch { throw new LibraryError('invalid', 'Invalid MNX JSON'); }
  // The converters retain proposed section/rehearsal labels. Validate those narrowly,
  // and the remainder against published MNX; never rewrite stored bytes or admit all
  // fields from the experimental proposal schema. The AI path does not use this parser.
  const standard = structuredClone(doc);
  if (Array.isArray(standard?.global?.measures)) for (const measure of standard.global.measures) {
    for (const field of ['section', 'rehearsal'] as const) if (measure?.[field] !== undefined) {
      if (!validateLabel(measure[field])) throw new LibraryError('invalid', 'Invalid section/rehearsal label');
      delete measure[field];
    }
  }
  if (!validateMnx(standard) || (doc._x?.mnxLab !== undefined && !validateRootExt(doc._x.mnxLab)) ||
      doc.parts.some(p => p._x?.mnxLab !== undefined && !validatePartExt(p._x.mnxLab))) {
    throw new LibraryError('invalid', 'MNX or its metadata does not match the storage schema');
  }
  return doc;
}
