import { decodeRecordingSync } from './recordingSync.ts';
export const MAX_AUDIO_BYTES = 64 * 1024 * 1024;
export const MAX_SYNC_BYTES = 1024 * 1024;
export const AUDIO_FORMATS: Readonly<Record<string, string>> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac' };
export interface SyncImportChoice { id: string; label: string; syncpoints: unknown; raw: unknown; crop_start: number | null; crop_end: number | null; cropped_duration: number | null }
export interface RecordingProvenance { format: 'soundslice-sync-array' | 'soundslice-sync-wrapper' | 'studio-unsynchronised'; raw: unknown; selectedId: string | null; crop_start: number | null; crop_end: number | null; cropped_duration: number | null }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a sync object.'); return value as Record<string, unknown>; }
function seconds(v: unknown): number | null { if (v == null) return null; if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error('Crop times must be nonnegative seconds.'); return v; }
/** Preserve the entire input, with an explicit stable recording identity for wrappers. */
export function recordingSyncChoices(raw: unknown): SyncImportChoice[] {
  if (Array.isArray(raw)) return [{ id: 'array', label: 'Syncpoint array', syncpoints: raw, raw, crop_start: null, crop_end: null, cropped_duration: null }];
  const wrapper = object(raw);
  if (!Array.isArray(wrapper.recordings) || !wrapper.recordings.length || wrapper.recordings.length > 100) throw new Error('Expected a .sync.json object with 1–100 recordings.');
  const ids = new Set<string>();
  return wrapper.recordings.map(value => {
    const r = object(value);
    if (!(typeof r.id === 'string' && r.id.trim()) && !(typeof r.id === 'number' && Number.isSafeInteger(r.id))) throw new Error('Every imported recording needs an explicit ID.');
    const id = String(r.id); if (ids.has(id)) throw new Error('Imported recording IDs must be unique.'); ids.add(id);
    const start = seconds(r.crop_start), end = seconds(r.crop_end);
    if (start !== null && end !== null && end <= start) throw new Error('Crop end must follow crop start.');
    return { id, label: `${typeof r.name === 'string' ? r.name : 'Recording'} (ID ${id})`, syncpoints: r.syncpoints ?? null, raw, crop_start: start, crop_end: end, cropped_duration: seconds(r.cropped_duration) };
  });
}
export function attachmentSync(raw: unknown, selectedId: string | null): { syncpoints: unknown; provenance: RecordingProvenance } {
  if (raw === null) return { syncpoints: null, provenance: { format: 'studio-unsynchronised', raw: null, selectedId: null, crop_start: null, crop_end: null, cropped_duration: null } };
  const choices = recordingSyncChoices(raw);
  const choice = Array.isArray(raw) ? choices[0] : choices.find(c => c.id === selectedId);
  if (!choice) throw new Error('Choose the recording whose timings should be attached.');
  if (choice.syncpoints !== null) { const decoded = decodeRecordingSync(choice.syncpoints); if (!decoded.ok) throw new Error(decoded.diagnostic.message); }
  return { syncpoints: choice.syncpoints, provenance: { format: Array.isArray(raw) ? 'soundslice-sync-array' : 'soundslice-sync-wrapper', raw, selectedId: Array.isArray(raw) ? null : choice.id, crop_start: choice.crop_start, crop_end: choice.crop_end, cropped_duration: choice.cropped_duration } };
}
