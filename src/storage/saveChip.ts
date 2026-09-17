/**
 * What the save chip says (studio authoring campaign, clause 7): the RISK first
 * — edits that exist only on this device — then the freshness. Age alone
 * misleads: "saved 40 min ago" with nothing since is safe, and the same age
 * with sixty edits since is not.
 */
import type { SaveState } from './saveSession.ts';

export type SaveChipTone = 'quiet' | 'risk' | 'warn';

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** "just now", "4 min ago", "2 h ago" — coarse on purpose; the chip ticks every half minute. */
export function savedAge(savedAt: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - savedAt) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

/** How many things the last save could not keep: lost or changed, never the gains. */
export function unkept(state: SaveState): number {
  return (state.check?.differences ?? []).filter(d => d.kind !== 'gained').reduce((sum, d) => sum + d.count, 0);
}

export function saveChip(state: SaveState, now: number): { text: string; tone: SaveChipTone } {
  const age = state.savedAt === null ? null : savedAge(state.savedAt, now);
  switch (state.status) {
    case 'conflict':
      return { text: `Saved on another device · ${count(state.edits, 'edit')} here`, tone: 'warn' };
    case 'failed':
      return { text: `Not saved · ${count(state.edits, 'edit')} on this device only · retrying`, tone: 'warn' };
    case 'saving':
      return { text: 'Saving…', tone: 'quiet' };
    case 'dirty':
      if (state.recovered !== null) return { text: `Recovered ${count(state.recovered, 'edit')} from this device`, tone: 'risk' };
      return { text: `${count(state.edits, 'edit')} unsaved${age ? ` · last saved ${age}` : ''}`, tone: 'risk' };
    case 'clean': {
      const lost = unkept(state);
      if (lost) return { text: `Saved · ${count(lost, 'item')} won’t persist`, tone: 'warn' };
      return { text: age ? `Saved · ${age}` : 'Saved', tone: 'quiet' };
    }
  }
}
