import type { MnxStructure, MnxPart } from '../model/mnx.ts';
/** Pure presentation controls. Omitted label modes preserve historical engraving. */
export interface DisplayOptions {
  lyrics?: 'all' | 'current' | 'hide';
  timeSignatures?: 'show' | 'hide';
  clefs?: 'show' | 'hide';
  title?: 'show' | 'hide';
  barNumbers?: 'every-bar' | 'every-system' | 'hide';
  instrumentNames?: 'every-system' | 'first-system' | 'hide';
  /** Beam slant: `slanted` follows the outer noteheads, `flat` is the
   *  horizontal house style. A viewer's choice, never a document field. */
  beams?: 'slanted' | 'flat';
  /** Transient document-global verse ID; never a repeat count. */
  selectedVerse?: string;
}

export const DISPLAY_CHOICES = {
  lyrics: ['all', 'current', 'hide'],
  timeSignatures: ['show', 'hide'],
  clefs: ['show', 'hide'],
  title: ['show', 'hide'],
  barNumbers: ['every-bar', 'every-system', 'hide'],
  instrumentNames: ['every-system', 'first-system', 'hide'],
  beams: ['slanted', 'flat']
} as const;

/** Unknown values defer to defaults. Explicit legacy hide always wins. */
export function normalizeDisplayOptions(input: unknown = {}, hide: readonly string[] = []): DisplayOptions {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const result: Record<string, unknown> = { lyrics: 'all', timeSignatures: 'show', clefs: 'show', title: 'show', beams: 'slanted' };
  for (const [key, choices] of Object.entries(DISPLAY_CHOICES)) {
    if ((choices as readonly unknown[]).includes(source[key])) result[key] = source[key];
  }
  if (typeof source.selectedVerse === 'string' && source.selectedVerse.length) result.selectedVerse = source.selectedVerse;
  if (hide.includes('lyrics')) result.lyrics = 'hide';
  return result as DisplayOptions;
}

/** Declared numbers reset the displayed sequence, including a declared pickup 0. */
export function displayedMeasureNumbers(mnx: MnxStructure): number[] {
  let number = 0;
  return mnx.global.measures.map(measure => {
    number = measure.number ?? number + 1;
    return number;
  });
}

export function instrumentName(part: MnxPart, firstSystem: boolean): string | null {
  const short = (part as MnxPart & { shortName?: string }).shortName;
  const name = firstSystem ? part.name : short?.trim() ? short : part.name;
  return name?.trim() ? name : null;
}
