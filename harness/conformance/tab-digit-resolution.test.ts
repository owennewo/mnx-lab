import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';
import { EditorSession, replayIntents } from '../../src/edit/session.ts';
import {
  TAB_DIGIT_LAYER,
  resolveIntent,
  resolveKeyAction
} from '../../src/edit/keymap.ts';
import {
  ENTRY_DIGIT_WINDOW_MS,
  TabDigitResolver,
  type TabDigitClock
} from '../../src/edit/tabDigitResolver.ts';

class ManualClock implements TabDigitClock {
  private now = 0;
  private nextId = 1;
  private tasks = new Map<number, { at: number; callback: () => void }>();

  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.now + delayMs, callback });
    return id as unknown as ReturnType<typeof setTimeout>;
  }

  clearTimeout(handle: ReturnType<typeof setTimeout>): void {
    this.tasks.delete(handle as unknown as number);
  }

  advance(delayMs: number): void {
    const target = this.now + delayMs;
    while (true) {
      const due = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      this.tasks.delete(due[0]);
      this.now = due[1].at;
      due[1].callback();
    }
    this.now = target;
  }
}

function resolverHarness() {
  const commits: number[] = [];
  const pending: Array<number | null> = [];
  const clock = new ManualClock();
  const resolver = new TabDigitResolver(
    fret => commits.push(fret),
    candidate => pending.push(candidate),
    clock
  );
  return { commits, pending, clock, resolver };
}

describe('the 500 ms tab digit composition window', () => {
  it('stops physical digits at the mount instead of exposing them as session intents', () => {
    const layers = [TAB_DIGIT_LAYER];
    expect(resolveKeyAction({ code: 'Digit1' }, layers)).toEqual({
      type: 'tabDigit',
      digit: 1
    });
    expect(resolveKeyAction({ code: 'Numpad2' }, layers)).toEqual({
      type: 'tabDigit',
      digit: 2
    });
    expect(resolveIntent({ code: 'Digit1' }, layers)).toBeNull();
  });

  it('holds an AMBIGUOUS digit until exactly 500 ms, then commits it once', () => {
    const h = resolverHarness();
    h.resolver.push(1);
    expect(h.resolver.pending).toBe(1);
    expect(h.commits).toEqual([]);
    h.clock.advance(ENTRY_DIGIT_WINDOW_MS - 1);
    expect(h.commits).toEqual([]);
    h.clock.advance(1);
    expect(h.commits).toEqual([1]);
    expect(h.pending).toEqual([1, null]);
  });

  // The window buys one thing: the chance that a second digit makes a bigger
  // fret. Only 1 and 2 can begin one below a 24-fret ceiling, so the other
  // eight digits used to buy half a second of nothing — visibly, because the
  // pending digit paints as a ghost and the rung only settles at the commit.
  it('commits a digit that cannot open a pair on the keystroke itself', () => {
    for (const digit of [0, 3, 4, 5, 6, 7, 8, 9]) {
      const h = resolverHarness();
      h.resolver.push(digit);
      expect(h.commits).toEqual([digit]);
      expect(h.resolver.pending).toBeNull();
      expect(h.pending).toEqual([]); // nothing was ever painted as pending
      h.clock.advance(ENTRY_DIGIT_WINDOW_MS);
      expect(h.commits).toEqual([digit]); // and no timer fires behind it
    }
  });

  it('still waits on the two digits that can open a pair', () => {
    for (const digit of [1, 2]) {
      const h = resolverHarness();
      h.resolver.push(digit);
      expect(h.commits).toEqual([]);
      expect(h.resolver.pending).toBe(digit);
    }
  });

  it('commits valid 12 and 24 pairs immediately and cancels their timers', () => {
    for (const [first, second, expected] of [[1, 2, 12], [2, 4, 24]] as const) {
      const h = resolverHarness();
      h.resolver.push(first);
      h.resolver.push(second);
      expect(h.commits).toEqual([expected]);
      expect(h.resolver.pending).toBeNull();
      h.clock.advance(ENTRY_DIGIT_WINDOW_MS);
      expect(h.commits).toEqual([expected]);
    }
  });

  it('commits an unextendable pair as two frets, in order', () => {
    const h = resolverHarness();
    h.resolver.push(2);
    h.resolver.push(5); // 25 is past the ceiling, so this is a fret of its own
    expect(h.commits).toEqual([2, 5]); // and 5 cannot open a pair, so it lands too
    expect(h.resolver.pending).toBeNull();
    h.clock.advance(ENTRY_DIGIT_WINDOW_MS);
    expect(h.commits).toEqual([2, 5]);
    expect(h.pending).toEqual([2, null]);
  });

  it('keeps waiting when the second digit could itself open a pair', () => {
    const h = resolverHarness();
    h.resolver.push(2);
    h.resolver.push(1); // 21 is legal — the pair wins before the restart does
    expect(h.commits).toEqual([21]);
    const restart = resolverHarness();
    restart.resolver.push(9); // commits at once
    restart.resolver.push(1); // ...and the new candidate waits, as 1 always does
    expect(restart.commits).toEqual([9]);
    expect(restart.resolver.pending).toBe(1);
  });

  it('flushes before the following action and leaves no stale callback', () => {
    const h = resolverHarness();
    const order: string[] = [];
    const resolver = new TabDigitResolver(
      fret => order.push(`fret ${fret}`),
      () => undefined,
      h.clock
    );
    resolver.push(1);
    expect(resolver.flush()).toBe(true);
    order.push('next position');
    expect(order).toEqual(['fret 1', 'next position']);
    h.clock.advance(ENTRY_DIGIT_WINDOW_MS);
    expect(order).toEqual(['fret 1', 'next position']);
    expect(resolver.flush()).toBe(false);
  });

  it('rejects values that are not physical digits', () => {
    const h = resolverHarness();
    expect(() => h.resolver.push(10)).toThrow(/0 to 9/);
    expect(() => h.resolver.push(1.5)).toThrow(/0 to 9/);
  });
});

function entryDoc(withStrings = true): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      id: 'guitar',
      ...(withStrings ? {
        _x: {
          mnxLab: {
            strings: STANDARD_GUITAR_STRINGS.map(entry => ({
              ...entry,
              pitch: { ...entry.pitch }
            })),
            tab: { staffKind: 'both' as const }
          }
        }
      } : {}),
      measures: [{ sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }] }]
    }]
  };
}

describe('resolved enterFret session intents', () => {
  it('inserts once, records only the resolved fret, and undoes byte-identically', () => {
    const initial = entryDoc();
    const session = new EditorSession(initial, 'tab-entry');
    expect(session.handleIntent({ type: 'enterFret', fret: 12 })).toBe(true);
    expect(session.appliedOps).toHaveLength(1);
    expect(session.trace().intents).toEqual([{ type: 'enterFret', fret: 12 }]);
    expect(session.opQueue.applied[0]?.intent).toEqual({ type: 'enterFret', fret: 12 });
    expect(session.handleIntent({ type: 'undo' })).toBe(true);
    expect(session.doc).toEqual(initial);
  });

  it('replays a resolved fret with no clock or raw digit input', () => {
    const intents = [{ type: 'enterFret' as const, fret: 24 }];
    const session = replayIntents(entryDoc(), intents);
    expect(session.intentLog).toEqual(intents);
    expect(session.appliedOps).toHaveLength(1);
  });

  it('refuses an empty cell without a fingerboard and out-of-range frets', () => {
    const noFingerboard = new EditorSession(entryDoc(false));
    expect(noFingerboard.handleIntent({ type: 'enterFret', fret: 5 })).toBe(false);
    const session = new EditorSession(entryDoc());
    expect(session.handleIntent({ type: 'enterFret', fret: -1 })).toBe(false);
    expect(session.handleIntent({ type: 'enterFret', fret: 25 })).toBe(false);
    expect(session.appliedOps).toEqual([]);
  });
});
