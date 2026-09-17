/**
 * A piece's versions, as its renditions tell them (roadmap: studio-piece-lifecycle).
 *
 * The service keeps every save as an immutable rendition and one pointer names
 * the current one, so "version history" is a reading of rows that already exist:
 * what the piece started as (an `original` Studio made, or the `export` the
 * ingest stored) and every `edit` since. Derived files and evidence are not
 * versions — nobody can go back to a defect report.
 */
import type { LibraryRendition } from './libraryClient.ts';

export interface PieceVersion {
  id: string;
  current: boolean;
  /** `start`: what the piece began as. `named`: a version the owner asked for. `automatic`: a checkpoint nobody asked for. */
  kind: 'start' | 'named' | 'automatic';
  /** The owner's name for it, or what to call it when they gave none. */
  label: string;
  createdAt: string;
  format: string;
  /** How many things that save could not keep; 0 for the start and for a clean save. */
  unkept: number;
}

interface Checkpoint { name?: string | null; check?: { differences?: { kind: string; count: number }[] } }
function checkpointOf(provenance: string | null): Checkpoint {
  if (!provenance) return {};
  try { const value = JSON.parse(provenance); return value && typeof value === 'object' ? value : {}; } catch { return {}; }
}

/** Newest first. A revert moves the pointer, not the dates, so `current` can be any row. */
export function pieceVersions(renditions: readonly LibraryRendition[], canonicalId: string | null | undefined): PieceVersion[] {
  return renditions
    .filter(r => r.role === 'edit' || r.role === 'original' || r.role === 'export')
    .map(r => {
      const checkpoint = r.role === 'edit' ? checkpointOf(r.provenance) : {};
      const name = typeof checkpoint.name === 'string' && checkpoint.name.trim() ? checkpoint.name.trim() : null;
      const kind: PieceVersion['kind'] = r.role !== 'edit' ? 'start' : name ? 'named' : 'automatic';
      return {
        id: r.id, current: r.id === canonicalId, kind,
        label: name ?? (kind === 'automatic' ? 'Saved automatically' : r.producer === 'studio' ? 'As first made' : 'As imported'),
        createdAt: r.created_at, format: r.format,
        unkept: (checkpoint.check?.differences ?? []).filter(d => d.kind !== 'gained').reduce((sum, d) => sum + (Number(d.count) || 0), 0)
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
