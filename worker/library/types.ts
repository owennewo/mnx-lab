export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Format = 'gp' | 'gpx' | 'gp5' | 'gp4' | 'gp3' | 'musicxml' | 'mnx';
export interface Piece {
  id: string; owner: string; canonical_rendition_id: string | null;
  source_kind: string | null; source_id: string | null; source_url: string | null;
  revision: number; created_at: string; updated_at: string;
}
export interface Rendition {
  id: string; piece_id: string; format: Format; role: 'original' | 'export' | 'derived';
  filename: string | null; sha256: string; r2_key: string; bytes: number;
  producer: string; producer_version: string | null; producer_options: string | null;
  provenance: string | null; derived_from: string | null; fetched_at: string | null;
  created_at: string;
}
export interface Recording {
  id: string; piece_id: string; kind: 'audio' | 'video' | 'youtube'; name: string | null;
  r2_key: string | null; sha256: string | null; bytes: number | null; mime: string | null;
  external_id: string | null; duration_s: number | null; syncpoints: string | null;
  source_id: string | null; created_at: string; updated_at: string;
}
export interface Tag {
  owner: string; piece_id: string; dimension: string; value: string;
  origin: 'derived' | 'asserted'; sort_key: number | null; source_ref: string | null;
}
export interface Alias { owner: string; dimension: string; raw_value: string; canonical_value: string }
export interface Snapshot { piece: Piece; renditions: Rendition[]; recordings: Recording[]; tags: Tag[] }
export interface BlobInput { content: ArrayBuffer; sha256?: string }
export interface RenditionInput extends BlobInput {
  id: string; format: Format; role: Rendition['role']; producer: string;
  // Explicit null records that upstream did not supply a version/options.
  producer_version: string | null; producer_options: Json;
  filename?: string | null; provenance?: Json; derived_from?: string | null; fetched_at?: string | null;
}
export interface RecordingInput {
  id: string; kind: Recording['kind']; name?: string | null; blob?: BlobInput;
  mime?: string | null; external_id?: string | null; duration_s?: number | null;
  syncpoints?: Json; source_id?: string | null;
}
export interface AssertedTag {
  dimension: string; value: string; sort_key?: number | null; source_ref?: string | null;
}
/** A projection computed OUTSIDE the service — by the ingest tool from the
 *  Soundslice sidecar and from a validated conversion — never stored truth.
 *  `source_ref` names what produced it (`sidecar`, `guitarpro-mnx@<version>`). */
export interface DerivedTag { dimension: string; value: string; source_ref: string }
export interface PieceWrite {
  id: string;
  // null creates a new piece, including all its rows in the same batch.
  expected_revision: number | null;
  source?: { kind: string; id: string; url?: string | null };
  renditions?: RenditionInput[]; recordings?: RecordingInput[]; tags?: AssertedTag[];
  /** When present, REPLACES the piece's derived projection wholesale; when
   *  absent, the previous projection is retained. Rebuildable, so replaceable. */
  derived_tags?: DerivedTag[];
  canonical?: { mode: 'initialize' | 'replace'; rendition_id: string };
  rename_tags?: { dimension: string; value: string; to_dimension: string; to_value: string }[];
}
export class LibraryError extends Error {
  constructor(public readonly code: 'invalid' | 'not_found' | 'conflict' | 'immutable' | 'blob', message: string) {
    super(message); this.name = 'LibraryError';
  }
}
export function requireText(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new LibraryError('invalid', `${field} must be nonempty`);
}
export function json(value: Json): string {
  const normalize = (v: Json): Json => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (Array.isArray(v)) return v.map(normalize);
    if (typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, normalize(v[k])]));
    throw new LibraryError('invalid', 'Expected finite JSON data');
  };
  return JSON.stringify(normalize(value));
}
