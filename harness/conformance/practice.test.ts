// A loop as a practice (roadmap/inprogress/studio-player-practice.md): the takes it lays out,
// and the transport playing them on a fake clock — count-in, repeats, gap, trainer, and what
// happens when the repeats are done.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PLAIN_LOOP, loopMovedTo, practiceRegion, practiceTakes, takeAfter, trainerRate, type PracticeOptions } from '../../src/audio/practice.ts';
import { Transport, type Clock } from '../../src/audio/transport.ts';
import type { Sink, SinkEvent } from '../../src/audio/sink.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { add, compare, createTempoMap, type Rational } from '../../src/audio/time.ts';
import type { Performance } from '../../src/audio/performanceTypes.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error plain mjs
import { loadCorpus } from '../verify/check-scenarios.mjs';

const options = (o: Partial<PracticeOptions>): PracticeOptions => ({ ...PLAIN_LOOP, ...o });

describe('a press on a bar', () => {
  it('outside the loop moves it to start there, as long as it was, in either direction', () => {
    expect(loopMovedTo({ first: 2, last: 4 }, 8, 11)).toEqual({ first: 8, last: 10 });
    expect(loopMovedTo({ first: 5, last: 6 }, 0, 11)).toEqual({ first: 0, last: 1 });
  });
  it('still starts at the bar pressed near the end, the loop shorter where the piece runs out', () => {
    expect(loopMovedTo({ first: 2, last: 4 }, 10, 11)).toEqual({ first: 10, last: 11 });
  });
  it('inside the loop moves nothing', () => {
    for (const ordinal of [2, 3, 4]) expect(loopMovedTo({ first: 2, last: 4 }, ordinal, 11)).toBeNull();
  });
});

describe('the takes', () => {
  it('repeats a set number of times, then stops', () => {
    const takes = practiceTakes({ first: 2, last: 3 }, options({ repeats: 3 }), 11, 1, 10);
    expect(takes.map(t => [t.repeat, t.bars.first, t.bars.last, t.opens])).toEqual([[1, 2, 3, true], [2, 2, 3, false], [3, 2, 3, false]]);
  });
  it('without a count of repeats, goes on until stopped', () => {
    expect(practiceTakes({ first: 0, last: 0 }, PLAIN_LOOP, 3, 1, 50)).toHaveLength(50);
  });
  it('the trainer steps up every few repeats and stops at its ceiling', () => {
    const trainer = { start: 0.7, step: 0.05, every: 2, ceiling: 0.8 };
    expect([1, 2, 3, 4, 5, 6].map(r => trainerRate(trainer, r))).toEqual([0.7, 0.7, 0.75, 0.75, 0.8, 0.8]);
    const takes = practiceTakes({ first: 0, last: 1 }, options({ repeats: 4, trainer }), 9, 1.25, 10);
    expect(takes.map(t => t.rate)).toEqual([0.7, 0.7, 0.75, 0.75]);
  });
  it('advance moves the loop on a bar, drops the trainer back and counts in again, and stops where it cannot move', () => {
    const trainer = { start: 0.6, step: 0.1, every: 1, ceiling: 1 };
    const takes = practiceTakes({ first: 2, last: 3 }, options({ repeats: 2, then: 'advance', trainer }), 4, 1, 20);
    expect(takes.map(t => [t.bars.first, t.bars.last, t.repeat, t.rate, t.opens])).toEqual([
      [2, 3, 1, 0.6, true], [2, 3, 2, 0.7, false],
      [3, 4, 1, 0.6, true], [3, 4, 2, 0.7, false],
    ]);
  });
  it('carry on plays from the loop\'s end to the end of the piece, once', () => {
    const takes = practiceTakes({ first: 1, last: 2 }, options({ repeats: 2, then: 'continue' }), 7, 1, 10);
    expect(takes.map(t => [t.bars.first, t.bars.last, t.runOut])).toEqual([[1, 2, false], [1, 2, false], [3, 7, true]]);
    expect(takeAfter(takes.at(-1)!, { first: 1, last: 2 }, options({ repeats: 2, then: 'continue' }), 7, 1)).toBeNull();
    // A loop on the last bars has nothing to carry on to.
    expect(practiceTakes({ first: 6, last: 7 }, options({ repeats: 1, then: 'continue' }), 7, 1, 10)).toHaveLength(1);
  });
});

class FakeClock implements Clock {
  time = 0;
  private next = 0;
  private tasks = new Map<number, { at: number; fn: () => void }>();
  now() { return this.time; }
  setTimeout(fn: () => void, ms: number) { const id = ++this.next; this.tasks.set(id, { at: this.time + ms / 1000, fn }); return id; }
  clearTimeout(id: unknown) { this.tasks.delete(id as number); }
  advance(to: number) {
    for (;;) {
      const entry = [...this.tasks].sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry || entry[1].at > to + 1e-10) break;
      this.tasks.delete(entry[0]);
      this.time = entry[1].at;
      entry[1].fn();
    }
    this.time = to;
  }
}
class RecordingSink implements Sink {
  actions: (SinkEvent & { time: number })[] = [];
  constructor(private clock: Clock) {}
  now() { return this.clock.now(); }
  async unlock() {}
  schedule(events: readonly SinkEvent[], at: number) { this.actions.push(...events.map(e => ({ ...e, time: at + e.offset }))); }
  cancel(at: number) { this.actions = this.actions.filter(e => e.time < at); }
  release() {}
  bend() {}
  dispose() {}
}
const blues = () => {
  const s = (loadCorpus() as { id: string; dir: string }[]).find(x => x.id === 'lab/document/twelve-bar-blues')!;
  const doc = JSON.parse(fs.readFileSync(path.join(s.dir, 'document.mnx.json'), 'utf8')) as MnxStructure;
  const compiled = compilePerformance(doc);
  if (!compiled.ok) throw new Error('blues does not compile');
  return compiled.performance;
};
function rig(performance: Performance) {
  const clock = new FakeClock(), sink = new RecordingSink(clock);
  const transport = new Transport(performance, clock, sink, { lookaheadSeconds: 0.1, pollMilliseconds: 20 });
  const tempo = createTempoMap(performance.tempo);
  const seconds = (p: Rational) => tempo.secondsAt(p);
  const bar = (o: number) => performance.measures[o]!;
  const barSeconds = (o: number) => seconds(add(bar(o).position, bar(o).duration)) - seconds(bar(o).position);
  /** Attack times of the sounding events that start a bar, in order. */
  const attacksAt = (o: number) => {
    const ids = new Set(performance.sounding.filter(e => compare(e.position, bar(o).position) === 0).map(e => e.voice));
    return sink.actions.filter(a => a.kind === 'attack' && ids.has(a.voice)).map(a => a.time);
  };
  return { clock, sink, transport, seconds, bar, barSeconds, attacksAt };
}

describe('the transport plays a practice', () => {
  it('counts in, then plays the passage the set number of times and stops at its start', async () => {
    const performance = blues();
    const { clock, transport, bar, barSeconds, sink } = rig(performance);
    transport.setLoop(practiceRegion(performance, { first: 2, last: 3 }, options({ countIn: 1, repeats: 2 }), 1));
    await transport.play();
    expect(compare(transport.position, bar(2).position)).toBe(0);
    expect(transport.snapshot.loop?.counting).toEqual({ beat: 1, of: 4 });
    clock.advance(barSeconds(2) * 0.6);
    expect(transport.snapshot.loop?.counting?.beat).toBe(3);
    expect(compare(transport.position, bar(2).position), 'the cursor waits at the start through the count-in').toBe(0);
    const count = barSeconds(2), passage = barSeconds(2) + barSeconds(3);
    clock.advance(count + passage * 2 + 1);
    const firsts = sink.actions.filter(a => a.kind === 'attack').map(a => a.time);
    expect(Math.min(...firsts)).toBeCloseTo(count, 6);
    expect(firsts.filter(t => Math.abs(t - (count + passage)) < 1e-6).length, 'the second repeat starts as the first ends').toBeGreaterThan(0);
    expect(firsts.every(t => t < count + passage * 2 + 1e-6), 'nothing past the second repeat').toBe(true);
    const end = transport.snapshot;
    expect(end.state).toBe('stopped');
    expect(compare(end.position, bar(2).position)).toBe(0);
    expect(end.loop?.ended).toBe(true);
  });

  it('leaves a gap of silence between repeats, and the trainer changes the rate of each', async () => {
    const performance = blues();
    const { clock, transport, barSeconds, sink } = rig(performance);
    const trainer = { start: 0.5, step: 0.5, every: 1, ceiling: 1 };
    transport.setLoop(practiceRegion(performance, { first: 0, last: 0 }, options({ repeats: 2, gap: 1, trainer }), 1));
    await transport.play();
    const bar = barSeconds(0);
    clock.advance(bar / 0.5 + bar + bar + 1);
    const attacks = sink.actions.filter(a => a.kind === 'attack').map(a => a.time).sort((a, b) => a - b);
    const second = attacks.find(t => t > bar / 0.5 - 1e-9)!;
    expect(second, 'repeat 2 starts a bar of silence after repeat 1 (played at half speed)').toBeCloseTo(bar / 0.5 + bar, 6);
    expect(transport.snapshot.state).toBe('stopped');
  });

  it('advance moves on a bar and counts in again; carry on plays on to the end', async () => {
    const performance = blues();
    {
      const { clock, transport, bar, barSeconds } = rig(performance);
      transport.setLoop(practiceRegion(performance, { first: 0, last: 0 }, options({ countIn: 1, repeats: 1, then: 'advance' }), 1));
      await transport.play();
      clock.advance(barSeconds(0) * 2 + 0.01);
      expect(transport.snapshot.loop?.visit.take?.bars).toEqual({ first: 1, last: 1 });
      expect(transport.snapshot.loop?.counting, 'counted in again').not.toBeNull();
      clock.advance(barSeconds(0) * 2 + barSeconds(1) * 2 + 0.01);
      expect(compare(transport.position, bar(2).position) >= 0).toBe(true);
    }
    {
      const { clock, transport, seconds } = rig(performance);
      transport.setLoop(practiceRegion(performance, { first: 0, last: 0 }, options({ repeats: 1, then: 'continue' }), 1));
      await transport.play();
      clock.advance(seconds(transport.duration) + 1);
      expect(transport.snapshot.state).toBe('stopped');
      expect(compare(transport.position, transport.duration)).toBe(0);
    }
  });

  it('a pause keeps the repeat it was on, and play counts in again', async () => {
    const performance = blues();
    const { clock, transport, barSeconds } = rig(performance);
    transport.setLoop(practiceRegion(performance, { first: 0, last: 0 }, options({ countIn: 1, repeats: 4 }), 1));
    await transport.play();
    clock.advance(barSeconds(0) * 2.5);
    expect(transport.snapshot.loop?.visit.take?.repeat).toBe(2);
    transport.pause();
    await transport.play();
    expect(transport.snapshot.loop?.visit.take?.repeat).toBe(2);
    expect(transport.snapshot.loop?.counting?.beat).toBe(1);
  });

  it('a plain loop wraps seamlessly as before', async () => {
    const performance = blues();
    const { clock, transport, bar, barSeconds } = rig(performance);
    transport.setLoop({ start: bar(1).position, end: add(bar(1).position, bar(1).duration) });
    transport.seek(bar(1).position);
    await transport.play();
    clock.advance(barSeconds(1) * 3.5);
    expect(transport.snapshot.state).toBe('playing');
    expect(compare(transport.position, bar(1).position) >= 0 && compare(transport.position, add(bar(1).position, bar(1).duration)) < 0).toBe(true);
  });
});
