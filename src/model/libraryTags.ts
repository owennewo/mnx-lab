/**
 * The library's derived tags, read from a document: what a piece IS according to
 * its own music — title, artist, tuning, capo — so the library can sort and
 * filter without opening a file. A projection, never stored truth: the document
 * is authoritative and the service replaces the projection wholesale whenever it
 * is sent one (docs/studio-storage.md, invariant 3).
 *
 * The operator ingest (`tools/library-ingest.mjs`) computes the same projection
 * from a validated conversion, except that a Soundslice piece takes its title
 * and artist from the Soundslice sidecar. `harness/conformance/library-tags.test.ts`
 * holds the two to the same answer on the committed scores.
 */
import type { MnxStructure, MnxPitch } from './mnx.ts';

export interface DerivedLibraryTag { dimension: string; value: string }

/** Tunings players have a name for, recited low string first. */
const TUNING_NAMES: Readonly<Record<string, string>> = {
  'E2 A2 D3 G3 B3 E4': 'standard', 'D2 A2 D3 G3 B3 E4': 'drop D', 'D2 A2 D3 G3 B3 D4': 'double drop D', 'D2 A2 D3 G3 A3 D4': 'DADGAD',
  'D2 G2 D3 G3 B3 D4': 'open G', 'D2 A2 D3 F#3 A3 D4': 'open D', 'E2 B2 E3 G#3 B3 E4': 'open E', 'E2 A2 E3 A3 C#4 E4': 'open A',
  'D#2 G#2 C#3 F#3 A#3 D#4': 'half-step down', 'D2 G2 C3 F3 A3 D4': 'whole-step down', 'E1 A1 D2 G2': 'bass standard', 'G4 C4 E4 A4': 'ukulele standard'
};
const WORK_FIELDS = ['title', 'artist', 'subtitle', 'album', 'copyright', 'source', 'notes'] as const;

const pitchName = ({ step, alter, octave }: MnxPitch) =>
  `${step}${(alter ?? 0) > 0 ? '#'.repeat(alter!) : (alter ?? 0) < 0 ? 'b'.repeat(-alter!) : ''}${octave}`;

export function derivedLibraryTags(document: MnxStructure): DerivedLibraryTag[] {
  const tags: DerivedLibraryTag[] = [];
  const add = (dimension: string, value: unknown) => {
    const text = value == null ? '' : String(value).trim();
    if (text && !tags.some(t => t.dimension === dimension && t.value === text)) tags.push({ dimension, value: text });
  };
  const work = document._x?.mnxLab?.work;
  for (const field of WORK_FIELDS) if (typeof work?.[field] === 'string') add(field, work[field]);
  for (const creator of work?.creators ?? []) if (creator?.role && creator?.name) add(`creator.${creator.role}`, creator.name);
  for (const part of document.parts ?? []) add('part', part.name);
  for (const part of document.parts ?? []) if (part._x?.mnxLab?.capo !== undefined) add('capo', part._x.mnxLab.capo);
  for (const part of document.parts ?? []) {
    const strings = part._x?.mnxLab?.strings;
    if (!strings?.length) continue;
    const tuning = [...strings].sort((a, b) => b.string - a.string).map(s => pitchName(s.pitch)).join(' ');
    add('tuning', tuning);
    add('tuning-name', TUNING_NAMES[tuning]);
  }
  return tags;
}
