import type { DisplayOptions } from '../engine/displayOptions.ts';

/**
 * The host defaults the settings card measures "off default" against. Lifted out of
 * the workbench's `displayPreferences.ts` (2026-09-11, roadmap/inprogress/core-score-frame.md)
 * when the card was promoted to `elements/`: the DEFAULTS are the component's business,
 * the localStorage read/write around them stays a shell decision.
 */
export const DEFAULT_DISPLAY_PREFERENCES: Readonly<DisplayOptions> = {
  lyrics: 'all', timeSignatures: 'show', clefs: 'show', title: 'show',
  barNumbers: 'every-system', instrumentNames: 'first-system', beams: 'slanted', clearance: 2
};
