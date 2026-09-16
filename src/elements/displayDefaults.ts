import { DISPLAY_CHOICES, type DisplayOptions } from '../engine/displayOptions.ts';

/**
 * The host defaults the settings card measures "off default" against. Lifted out of
 * the workbench's `displayPreferences.ts` (2026-09-11, roadmap/inprogress/core-score-frame.md)
 * when the card was promoted to `elements/`: the DEFAULTS are the component's business,
 * the localStorage read/write around them stays a shell decision.
 */
export const DEFAULT_DISPLAY_PREFERENCES: Readonly<DisplayOptions> = {
  lyrics: 'current', timeSignatures: 'hide', clefs: 'show', title: 'hide',
  barNumbers: 'every-system', instrumentNames: 'hide', beams: 'slanted'
};

/** Shell-owned rows in the same settings card. Kept beside the engraving
 * defaults so Studio and the workbench give a fresh browser the same score. */
export const DEFAULT_VIEW_PREFERENCE = 'both' as const;
export const DEFAULT_UNROLLED_PREFERENCE = false;

/** Shared product preference migration. Explicit viewer/engine overrides are
 * separate: old saved Clearance must not silently keep a third layout axis. */
export function normalizeDisplayPreferences(input: unknown): DisplayOptions {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const result: Record<string, unknown> = { ...DEFAULT_DISPLAY_PREFERENCES };
  for (const [key, choices] of Object.entries(DISPLAY_CHOICES)) {
    if ((choices as readonly unknown[]).includes(source[key])) result[key] = source[key];
  }
  return result as DisplayOptions;
}
