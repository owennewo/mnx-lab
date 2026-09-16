// Shared by the score page and library PDF export.
import { type DisplayOptions } from '../../../src/engine/displayOptions.ts';
import {
  DEFAULT_DISPLAY_PREFERENCES,
  DEFAULT_UNROLLED_PREFERENCE,
  DEFAULT_VIEW_PREFERENCE,
  normalizeDisplayPreferences
} from '../../../src/elements/displayDefaults.ts';
import type { ViewSetting } from '../../../src/elements/DocumentViewer.ts';
import { isSamplePreset } from '../../../src/audio/sampleSelection.ts';
import type { PartMix, PartMixEntry } from '../../../src/audio/partMix.ts';
import { clampStaffSp } from '../../../src/engine/render/scale.ts';

export const VIEW_KEY = 'mnx-studio.view';
export const DISPLAY_KEY = 'mnx-studio.display';
export const UNROLLED_KEY = 'mnx-studio.unrolled';
export const STAFF_SP_KEY = 'mnx-studio.staff-sp';
const RETIRED_STAFF_SCALE_KEY = 'mnx-studio.staff-scale';
/** Space in staff spaces (core-space-units-sp.md). */
export const SPACE_SP_KEY = 'mnx-studio.space-sp';
export const SPACING_MODE_KEY = 'mnx-studio.spacing-mode';
/** The score frame: whether the reader left the score focused, its strips hidden. */
export const FOCUSED_KEY = 'mnx-studio.focused';
export const VIEWS: ViewSetting[] = ['auto', 'notation', 'tab', 'both'];

export function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function write(key: string, value: string | null) {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* a convenience only */ }
}
export function readView(): ViewSetting {
  const value = read(VIEW_KEY);
  return VIEWS.includes(value as ViewSetting) ? (value as ViewSetting) : DEFAULT_VIEW_PREFERENCE;
}
export function readDisplay(): DisplayOptions {
  try {
    return normalizeDisplayPreferences(JSON.parse(read(DISPLAY_KEY) ?? '{}'));
  } catch { return { ...DEFAULT_DISPLAY_PREFERENCES }; }
}
export function readUnrolled(): boolean {
  const value = read(UNROLLED_KEY);
  return value === null ? DEFAULT_UNROLLED_PREFERENCE : value === 'true';
}
export function readFocused(): boolean {
  // The strips' own keys (each drawn out on its own) retired with the edge
  // grips, 2026-09-15; a browser that still carries them is tidied here.
  write('mnx-studio.tools-open', null);
  write('mnx-studio.player-open', null);
  return read(FOCUSED_KEY) === 'true';
}
/** The Space preference. The multiplier it replaced (2026-09-15) lived under
 *  `mnx-studio.density-h`; a browser still carrying it is tidied here rather
 *  than converted — the value was a convenience. */
export function readSpaceSp(): number | null {
  write('mnx-studio.density-h', null);
  return readNumber(SPACE_SP_KEY);
}
/** Staff in canonical staff spaces. The retired percentage multiplier has the
 * same numeric meaning (`1sp` = 100%), so migrate it one-for-one. */
export function readStaffSp(): number | null {
  const current = read(STAFF_SP_KEY);
  const legacy = read(RETIRED_STAFF_SCALE_KEY);
  if (current === null && legacy !== null) write(STAFF_SP_KEY, legacy);
  write(RETIRED_STAFF_SCALE_KEY, null);
  return clampStaffSp(readNumber(STAFF_SP_KEY));
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
