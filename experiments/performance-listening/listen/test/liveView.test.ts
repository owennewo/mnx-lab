import { describe, expect, it } from 'vitest';
import { liveView } from '../liveView.ts';

const d = (id: string, refersTo: number, madeAt: number, kind = 'position') => ({ id, kind, refersTo, madeAt });

describe('the display rule', () => {
  it('shows nothing before the first statement is made', () => {
    expect(liveView([d('a', 0.1, 0.2)], 0.15)).toBeUndefined();
    expect(liveView([d('a', 0.1, 0.2)], 0.2)?.id).toBe('a');
  });
  it('holds a statement until a later one replaces it, without extrapolating', () => {
    const record = [d('a', 0.1, 0.1), d('b', 0.3, 0.3)];
    expect(liveView(record, 0.25)?.id).toBe('a');
    expect(liveView(record, 0.3)?.id).toBe('b');
  });
  it('lets a revision about the same time replace it, but a backdated one never displaces a later time', () => {
    const record = [d('a', 0.1, 0.1), d('b', 0.2, 0.2), d('a2', 0.1, 0.25)];
    expect(liveView(record, 0.3)?.id).toBe('b');
    expect(liveView([d('a', 0.1, 0.1), d('a2', 0.1, 0.15)], 0.2)?.id).toBe('a2');
  });
  it('never lets a note verdict move the cursor', () => {
    expect(liveView([d('a', 0.1, 0.1), d('n', 0.2, 0.2, 'note')], 0.3)?.id).toBe('a');
  });
});
