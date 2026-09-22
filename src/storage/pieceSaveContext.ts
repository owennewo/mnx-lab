import type { MnxStructure } from '../model/mnx.ts';
import { derivedLibraryTags } from '../model/libraryTags.ts';
import type { LibrarySnapshot, ProjectedTag } from './libraryClient.ts';
import type { PreparedCheckpoint } from './saveSession.ts';
// The name a stored score goes by.
/** A filename the service will accept: the title, without what a path or a header could misread. */
export const pieceFilename = (title: string) => `${title.trim().replace(/[\\/\x00-\x1f"<>|:*?]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Untitled'}.gp`;

/** The storage checker is a port: converters and their worker stay outside storage. */
interface CheckedScore<L> {
  bytes: Uint8Array;
  options: Record<string, unknown>;
  check: PreparedCheckpoint['check'];
  losses: readonly L[];
}

/** Sidecar metadata belongs to the piece being saved, including after its page has gone. */
export function projectPieceTags(doc: MnxStructure, heldTags: LibrarySnapshot['tags']): ProjectedTag[] {
  const tags: ProjectedTag[] = derivedLibraryTags(doc);
  for (const held of heldTags)
    if (held.origin === 'derived' && (held.source_ref === 'sidecar' || (held.source_ref === 'library-title' && held.dimension === 'title')) && ['title', 'artist'].includes(held.dimension) && !tags.some(t => t.dimension === held.dimension))
      tags.push({ dimension: held.dimension, value: held.value, kept: true });
  return tags;
}

/** A saving session's metadata and evidence history; never reads the active page. */
export class PieceSaveContext<L> {
  private reported = new Set<string>();
  private pending = new WeakMap<PreparedCheckpoint['file'], { losses: readonly L[]; kind: string | null }>();
  private tags: LibrarySnapshot['tags'];
  constructor(tags: LibrarySnapshot['tags'], private readonly build: string,
    private readonly check: (doc: MnxStructure) => Promise<CheckedScore<L>>) {
    this.tags = tags.map(tag => ({ ...tag }));
  }

  /** Refresh only from this piece's own save/read response. */
  updateTags(tags: LibrarySnapshot['tags']): void { this.tags = tags.map(tag => ({ ...tag })); }

  async prepare(doc: MnxStructure): Promise<PreparedCheckpoint> {
    const derivedTags = projectPieceTags(doc, this.tags);
    const result = await this.check(doc);
    const title = derivedTags.find(t => t.dimension === 'title')?.value ?? 'Untitled';
    const kind = result.check.verdict === 'differs'
      ? JSON.stringify([result.check.differences.filter(d => d.kind !== 'gained').map(d => `${d.kind} ${d.path}`).sort(), result.check.warnings.map(w => w.replace(/\d+/g, '#')).sort()]) : null;
    const text = kind && !this.reported.has(kind) ? JSON.stringify(doc) : null;
    const evidence = text && text.length <= 1024 * 1024 ? text : null;
    const file = { filename: pieceFilename(title), bytes: result.bytes, producerVersion: this.build, producerOptions: result.options };
    this.pending.set(file, { losses: result.losses, kind });
    return { file, check: result.check, derivedTags, evidence };
  }

  /** Failed saves retain their evidence; only the successful checkpoint acknowledges it. */
  saved(checkpoint: PreparedCheckpoint): readonly L[] {
    const pending = this.pending.get(checkpoint.file);
    if (checkpoint.evidence && pending?.kind) this.reported.add(pending.kind);
    return pending?.losses ?? [];
  }
}

/** The release callback belongs to this acquisition, never to the current page. */
export function acquirePieceLock(pieceId: string, locks?: Pick<LockManager, 'request'>): Promise<{ writable: boolean; release: () => void }> {
  if (!locks) return Promise.resolve({ writable: true, release: () => {} });
  return new Promise(resolve => {
    void locks.request(`mnx-studio.piece.${pieceId}`, { ifAvailable: true }, lock => {
      if (!lock) { resolve({ writable: false, release: () => {} }); return; }
      return new Promise<void>(release => resolve({ writable: true, release }));
    }).catch(() => resolve({ writable: true, release: () => {} }));
  });
}
