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
import {
  DEFAULT_SPACE_SP,
  DEFAULT_SPACING_MODE,
  DEFAULT_STAFF_SP
} from '../../../src/elements/zoomDefaults.ts';

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
export function readSpacingMode(): 'natural' | 'fill' {
  return read(SPACING_MODE_KEY) === 'natural' ? 'natural' : DEFAULT_SPACING_MODE;
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
  return readNumber(SPACE_SP_KEY) ?? DEFAULT_SPACE_SP;
}
/** Staff in canonical staff spaces. The retired percentage multiplier has the
 * same numeric meaning (`1sp` = 100%), so migrate it one-for-one. */
export function readStaffSp(): number | null {
  const current = read(STAFF_SP_KEY);
  const legacy = read(RETIRED_STAFF_SCALE_KEY);
  if (current === null && legacy !== null) write(STAFF_SP_KEY, legacy);
  write(RETIRED_STAFF_SCALE_KEY, null);
  return clampStaffSp(readNumber(STAFF_SP_KEY)) ?? DEFAULT_STAFF_SP;
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
/** Parts as stored, checked value by value. The same function serves this
 *  browser's copy and the library's, because neither is trusted: localStorage is
 *  editable and the service keeps preferences opaque (it may not import
 *  `src/audio`, so a sample preset means nothing to it). */
export function normalizeParts(raw: unknown): PartsPreference {
  const source = (raw && typeof raw === 'object' ? raw : {}) as { hidden?: unknown; mix?: unknown };
  const hidden = Array.isArray(source.hidden) ? source.hidden.filter((i): i is number => Number.isInteger(i) && i >= 0) : [];
  const mix: Record<number, PartMixEntry> = {};
  for (const [key, value] of Object.entries(source.mix && typeof source.mix === 'object' ? source.mix : {})) {
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
}
export function readParts(pieceId: string): PartsPreference {
  try { return normalizeParts(JSON.parse(read(partsKey(pieceId)) ?? '{}')); }
  catch { return { hidden: [], mix: {} }; }
}
/** What the library keeps for this owner and piece (`piece_views.prefs`): the
 *  source they last played, where they left the video divider (a percentage of
 *  the score frame's width) and how they left the Instruments sheet. A plain
 *  object type, not an interface, so it travels as the client's opaque JSON.
 *
 *  `parts.count` is the number of parts the mix was left against. A mix is keyed
 *  by part INDEX, which a new canonical rendition can renumber, so a mix whose
 *  count no longer matches the document is dropped rather than misapplied — the
 *  source, which is named by id, survives that. */
export type PiecePreferences = {
  source?: string;
  videoDividerPercent?: number;
  rendition?: string;
  parts?: { hidden: readonly number[]; mix: PartMix; count: number };
};
export function normalizePiecePrefs(raw: unknown): PiecePreferences {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const parts = source.parts && typeof source.parts === 'object' ? source.parts as { count?: unknown } : null;
  const count = typeof parts?.count === 'number' && Number.isInteger(parts.count) && parts.count >= 0 ? parts.count : null;
  const divider = source.videoDividerPercent;
  return {
    ...(typeof source.source === 'string' && source.source ? { source: source.source } : {}),
    ...(typeof divider === 'number' && divider > 0 && divider <= 100 ? { videoDividerPercent: divider } : {}),
    ...(typeof source.rendition === 'string' && source.rendition ? { rendition: source.rendition } : {}),
    ...(parts && count !== null ? { parts: { ...normalizeParts(parts), count } } : {}),
  };
}
/** Key order never decides whether preferences changed. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v);
}
export function writeParts(pieceId: string, value: PartsPreference) {
  const empty = !value.hidden.length && !Object.keys(value.mix).length;
  write(partsKey(pieceId), empty ? null : JSON.stringify(value));
}
