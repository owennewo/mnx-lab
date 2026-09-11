import { normalizeDisplayOptions, type DisplayOptions } from '../engine/displayOptions.ts';

import { DEFAULT_DISPLAY_PREFERENCES } from '../elements/displayDefaults.ts';

export { DEFAULT_DISPLAY_PREFERENCES };
export const DISPLAY_PREFERENCES_KEY = 'mnx-lab:display';
export function displayPreferences(input: unknown): DisplayOptions {
  const { selectedVerse: _transient, ...validated } = normalizeDisplayOptions(input);
  return { ...DEFAULT_DISPLAY_PREFERENCES, ...validated };
}
export function readDisplayPreferences(): DisplayOptions {
  try { return displayPreferences(JSON.parse(localStorage.getItem(DISPLAY_PREFERENCES_KEY) ?? '{}')); }
  catch { return { ...DEFAULT_DISPLAY_PREFERENCES }; }
}
export function writeDisplayPreferences(input: unknown): DisplayOptions {
  const preferences = displayPreferences(input);
  try { localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Private storage can be unavailable. */ }
  return preferences;
}
