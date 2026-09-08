/** Pure presentation controls. Omitted label modes preserve historical engraving. */
export interface DisplayOptions {
  lyrics?: 'all' | 'current' | 'hide';
  timeSignatures?: 'show' | 'hide';
  clefs?: 'show' | 'hide';
  title?: 'show' | 'hide';
  barNumbers?: 'every-bar' | 'every-system' | 'hide';
  instrumentNames?: 'every-system' | 'first-system' | 'hide';
  /** Transient document-global verse ID; never a repeat count. */
  selectedVerse?: string;
}

export const DISPLAY_CHOICES = {
  lyrics: ['all', 'current', 'hide'],
  timeSignatures: ['show', 'hide'],
  clefs: ['show', 'hide'],
  title: ['show', 'hide'],
  barNumbers: ['every-bar', 'every-system', 'hide'],
  instrumentNames: ['every-system', 'first-system', 'hide']
} as const;

/** Unknown values defer to defaults. Explicit legacy hide always wins. */
export function normalizeDisplayOptions(input: unknown = {}, hide: readonly string[] = []): DisplayOptions {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const result: Record<string, unknown> = { lyrics: 'all', timeSignatures: 'show', clefs: 'show', title: 'show' };
  for (const [key, choices] of Object.entries(DISPLAY_CHOICES)) {
    if ((choices as readonly unknown[]).includes(source[key])) result[key] = source[key];
  }
  if (typeof source.selectedVerse === 'string' && source.selectedVerse.length) result.selectedVerse = source.selectedVerse;
  if (hide.includes('lyrics')) result.lyrics = 'hide';
  return result as DisplayOptions;
}
