// Shared by the score page and library PDF export.
import { normalizeDisplayOptions, type DisplayOptions } from '../../../src/engine/displayOptions.ts';
import { DEFAULT_DISPLAY_PREFERENCES } from '../../../src/elements/displayDefaults.ts';
import type { ViewSetting } from '../../../src/elements/DocumentViewer.ts';
import { isSamplePreset } from '../../../src/audio/sampleSelection.ts';
import type { PartMix, PartMixEntry } from '../../../src/audio/partMix.ts';

export const VIEW_KEY = 'mnx-studio.view';
export const DISPLAY_KEY = 'mnx-studio.display';
export const UNROLLED_KEY = 'mnx-studio.unrolled';
export const STAFF_SCALE_KEY = 'mnx-studio.staff-scale';
export const DENSITY_H_KEY = 'mnx-studio.density-h';
export const SPACING_MODE_KEY = 'mnx-studio.spacing-mode';
/** The score frame's strips: whether the tools row / the player tray was left drawn out. */
export const TOOLS_OPEN_KEY = 'mnx-studio.tools-open';
export const PLAYER_OPEN_KEY = 'mnx-studio.player-open';
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

/** A piece's parts as the reader left them — hidden from the score, and the
 *  Instruments sheet's mix. Per piece, because part indices mean nothing across
 *  pieces; an untouched piece stores nothing. */
export interface PartsPreference { hidden: readonly number[]; mix: PartMix }
const partsKey = (pieceId: string) => `mnx-studio.parts.${pieceId}`;
export function readParts(pieceId: string): PartsPreference {
  try {
    const raw = JSON.parse(read(partsKey(pieceId)) ?? '{}') as { hidden?: unknown; mix?: unknown };
    const hidden = Array.isArray(raw.hidden) ? raw.hidden.filter((i): i is number => Number.isInteger(i) && i >= 0) : [];
    const mix: Record<number, PartMixEntry> = {};
    for (const [key, value] of Object.entries(raw.mix && typeof raw.mix === 'object' ? raw.mix : {})) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || !value || typeof value !== 'object') continue;
      const { volume, muted, sound } = value as Record<string, unknown>;
      mix[index] = {
        ...(typeof volume === 'number' && volume >= 0 && volume <= 1 ? { volume } : {}),
        ...(muted === true ? { muted } : {}),
        ...(sound === 'synth' || isSamplePreset(sound) ? { sound } : {}),
      };
    }
    return { hidden, mix };
  } catch { return { hidden: [], mix: {} }; }
}
export function writeParts(pieceId: string, value: PartsPreference) {
  const empty = !value.hidden.length && !Object.keys(value.mix).length;
  write(partsKey(pieceId), empty ? null : JSON.stringify(value));
}

