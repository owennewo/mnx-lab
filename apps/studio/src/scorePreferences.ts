// Shared by the score page and library PDF export.
import { normalizeDisplayOptions, type DisplayOptions } from '../../../src/engine/displayOptions.ts';
import { DEFAULT_DISPLAY_PREFERENCES } from '../../../src/elements/displayDefaults.ts';
import type { ViewSetting } from '../../../src/elements/DocumentViewer.ts';

export const VIEW_KEY = 'mnx-studio.view';
export const DISPLAY_KEY = 'mnx-studio.display';
export const UNROLLED_KEY = 'mnx-studio.unrolled';
export const STAFF_SCALE_KEY = 'mnx-studio.staff-scale';
export const DENSITY_H_KEY = 'mnx-studio.density-h';
export const SPACING_MODE_KEY = 'mnx-studio.spacing-mode';
export const VIEWS: ViewSetting[] = ['auto', 'notation', 'tab', 'both'];

export function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function write(key: string, value: string | null) {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* a convenience only */ }
}
export function readView(): ViewSetting {
  const value = read(VIEW_KEY);
  return VIEWS.includes(value as ViewSetting) ? (value as ViewSetting) : 'auto';
}
export function readDisplay(): DisplayOptions {
  try {
    const { selectedVerse: _transient, ...validated } = normalizeDisplayOptions(JSON.parse(read(DISPLAY_KEY) ?? '{}'));
    return { ...DEFAULT_DISPLAY_PREFERENCES, ...validated };
  } catch { return { ...DEFAULT_DISPLAY_PREFERENCES }; }
}
export function readNumber(key: string): number | null {
  const raw = read(key);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

