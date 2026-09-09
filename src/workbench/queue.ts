// The attention queue, derived from corpus metadata — the workbench's home
// surface answers "how is the work getting on?" from provenance alone.
//
// This mirrors the classification in harness/verify/verify-scenarios.mjs
// (the only writer of the underlying state), minus the primitives-hash
// re-check: update:primitives demotes `status` whenever a golden changes, so
// committed status + verification record carry the verdict. The workbench
// displays the queue; every mutation goes through the harness scripts.
import type { ScenarioEntry } from '../corpus/corpus.ts';

export type QueueState = 'blocked' | 'stale' | 'never-seen' | 'current';

export interface QueueItem {
  entry: ScenarioEntry;
  state: QueueState;
  detail: string;
}

export interface AttentionQueue {
  blocked: QueueItem[];
  stale: QueueItem[];
  neverSeen: QueueItem[];
  currentCount: number;
}

export function classify(entry: ScenarioEntry): QueueItem {
  const { status, verification } = entry.meta;
  const renderable = entry.meta.expect.standard === 'valid';

  if (renderable && (status === 'valid' || status === 'draft')) {
    return {
      entry,
      state: 'blocked',
      detail:
        verification !== undefined
          ? 'no longer renders — was verified ' + verification.at
          : 'not rendered yet'
    };
  }
  if (entry.meta.unrolled && !entry.unrolledAvailable) return { entry, state: 'blocked', detail: 'Unrolled evidence has not been generated.' };
  if (verification?.unrolledHash && !entry.meta.unrolled) return { entry, state: 'blocked', detail: 'Approved unrolled obligation was removed.' };
  if (entry.meta.unrolled && !verification?.unrolledHash) return { entry, state: 'never-seen', detail: 'Unseen unrolled evidence; written approval retained.' };
  if (entry.meta.performance && !entry.performanceAvailable) return { entry, state: 'blocked', detail: 'Performance evidence has not been generated.' };
  if (verification?.performanceHash && !entry.meta.performance) return { entry, state: 'blocked', detail: 'Approved performance obligation was removed.' };
  if (entry.meta.performance && !verification?.performanceHash) return { entry, state: 'never-seen', detail: 'Unseen performance evidence; engraving approval retained.' };
  if (status === 'verified') {
    return {
      entry,
      state: 'current',
      detail: verification ? `approved ${verification.at}` : 'approved (pre-provenance)'
    };
  }
  if (verification !== undefined) {
    return {
      entry,
      state: 'stale',
      detail: `output changed since approval on ${verification.at} — re-verify`
    };
  }
  return { entry, state: 'never-seen', detail: 'renders, but no human has approved it yet' };
}

export function buildQueue(corpus: ScenarioEntry[]): AttentionQueue {
  const queue: AttentionQueue = { blocked: [], stale: [], neverSeen: [], currentCount: 0 };
  for (const entry of corpus) {
    const item = classify(entry);
    if (item.state === 'blocked') queue.blocked.push(item);
    else if (item.state === 'stale') queue.stale.push(item);
    else if (item.state === 'never-seen') queue.neverSeen.push(item);
    else queue.currentCount++;
  }
  return queue;
}
