import { describe, expect, it } from 'vitest';
import {
  Transport,
  eventsBetween,
  type Clock,
  type TransportEvent,
} from '../../src/audio/transport.ts';
import { rational as q, ZERO } from '../../src/audio/time.ts';
import type { Performance, SoundingEvent } from '../../src/audio/performanceTypes.ts';
import type { Sink, SinkEvent } from '../../src/audio/sink.ts';

class FakeClock implements Clock {
  time = 0;
  next = 0;
  tasks = new Map<number, { at: number; fn: () => void }>();
  stale: (() => void)[] = [];
  now() {
    return this.time;
  }
  setTimeout(fn: () => void, ms: number) {
    const id = ++this.next;
    this.tasks.set(id, { at: this.time + ms / 1000, fn });
    return id;
  }
  clearTimeout(id: unknown) {
    const task = this.tasks.get(id as number);
    if (task) this.stale.push(task.fn);
    this.tasks.delete(id as number);
  }
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
  cancellations: number[] = [];
  constructor(private clock: Clock) {}
  now() {
    return this.clock.now();
  }
  async unlock() {}
  schedule(events: readonly SinkEvent[], at: number) {
    this.actions.push(...events.map((e) => ({ ...e, time: at + e.offset })));
  }
  cancel(at: number) {
    this.cancellations.push(at);
    this.actions = this.actions.filter((e) => e.time < at);
  }
  release(voice: string, time: number) {
    this.schedule([{ kind: 'release', voice, offset: 0 }], time);
  }
  bend(voice: string, cents: number, time: number) {
    this.schedule([{ kind: 'bend', voice, cents, offset: 0 }], time);
  }
  dispose() {}
}
const sound = (id: string, start = ZERO, duration = q(1n, 4n), voice = 'v'): SoundingEvent => ({
  id,
  voice,
  position: start,
  duration,
  midi: 60,
  velocity: 80,
  curve: [],
  writtenIds: [id],
});
function performance(sounding: SoundingEvent[]): Performance {
  return {
    formatVersion: 1,
    voices: [...new Set(sounding.map((s) => s.voice))].map((id) => ({ id, partIndex: 0 })),
    sounding,
    written: sounding.map((s, i) => ({
      id: s.id,
      noteKey: s.id,
      ordinal: i,
      metricOffset: s.position,
      metricDuration: s.duration,
      position: s.position,
      duration: s.duration,
      soundingIds: [s.id],
    })),
    tempo: [],
    measures: [],
    sourceMap: [],
    diagnostics: [],
  };
}
function setup(p = performance([sound('a'), sound('b', q(1n, 4n))])) {
  const clock = new FakeClock(),
    sink = new RecordingSink(clock),
    events: TransportEvent[] = [];
  const transport = new Transport(p, clock, sink, { onEvent: (e) => events.push(e) });
  return { clock, sink, events, transport };
}
describe('pure audio-clock transport', () => {
  it('queries exact half-open onsets without snapping tiny rational boundaries', () => {
    const tiny = q(1n, 28672n),
      p = performance([sound('a'), sound('b', tiny)]);
    expect(eventsBetween(p, ZERO, tiny).map((e) => e.id)).toEqual(['a']);
    expect(eventsBetween(p, tiny, q(1n)).map((e) => e.id)).toEqual(['b']);
  });
  it('schedules ahead but emits onsets only on the audio clock and clears the final highlight', async () => {
    const { transport, clock, sink, events } = setup();
    await transport.play();
    expect(events.filter((e) => e.kind === 'onset')).toHaveLength(1);
    clock.advance(0.44);
    expect(sink.actions.filter((e) => e.kind === 'attack').map((e) => e.time)).toEqual([0, 0.5]);
    expect(events.filter((e) => e.kind === 'onset')).toHaveLength(1);
    clock.advance(0.52);
    expect(events.filter((e) => e.kind === 'onset')).toHaveLength(2);
    clock.advance(1.04);
    expect(transport.snapshot.state).toBe('stopped');
    expect(transport.snapshot.activeWritten).toEqual([]);
    expect(events.some((e) => e.kind === 'end' && e.writtenId === 'b')).toBe(true);
  });
  it('pause cancels lookahead; resume reconstructs only remaining sound and schedules the next attack once', async () => {
    const { transport, clock, sink } = setup();
    await transport.play();
    clock.advance(0.44);
    transport.pause();
    expect(sink.actions.filter((e) => e.kind === 'attack')).toHaveLength(1);
    const frozen = transport.position;
    clock.advance(1);
    expect(transport.position).toEqual(frozen);
    await transport.play();
    clock.advance(1.3);
    expect(sink.actions.filter((e) => e.kind === 'attack')).toHaveLength(3);
    transport.stop();
    expect(transport.position).toEqual(ZERO);
    expect(transport.snapshot.activeWritten).toEqual([]);
    expect(sink.cancellations.at(-1)).toBe(1.3);
  });
  it('seek reconstructs tied written continuations, current bend and remaining gate at the target tempo', async () => {
    const a = sound('a', ZERO, q(1n));
    a.curve = [
      {
        kind: 'bend',
        points: [
          { offset: ZERO, cents: 0 },
          { offset: q(1n), cents: 1200 },
        ],
      },
    ];
    const p = performance([a]);
    p.written[0]!.duration = q(1n, 2n);
    p.written.push({ ...p.written[0]!, id: 'tie', position: q(1n, 2n), duration: q(1n, 2n) });
    p.tempo = [{ position: q(1n, 2n), quarterBpm: q(60n) }];
    const { transport, clock, sink } = setup(p);
    await transport.play();
    clock.advance(0.2);
    transport.seek(q(3n, 4n));
    expect(transport.snapshot.activeWritten.map((w) => w.id)).toEqual(['tie']);
    const rebuilt = sink.actions.filter((e) => e.time === 0.2);
    expect(rebuilt[0]!.kind).toBe('attack');
    expect(rebuilt[1]).toMatchObject({ kind: 'bend', cents: 900 });
    clock.advance(1.24);
    expect(sink.actions.some((e) => e.kind === 'release' && Math.abs(e.time - 1.2) < 1e-8)).toBe(
      true,
    );
    expect(transport.snapshot.state).toBe('stopped');
  });
  it('rate changes seek to the current position and invalidate stale callbacks', async () => {
    const { transport, clock, sink, events } = setup();
    await transport.play();
    clock.advance(0.2);
    const position = transport.position;
    transport.setRate(2);
    expect(transport.position).toEqual(position);
    const count = events.length,
      attacks = sink.actions.length;
    for (const fn of clock.stale) fn();
    expect(events).toHaveLength(count);
    expect(sink.actions).toHaveLength(attacks);
    clock.advance(0.4);
    expect(sink.actions.filter((e) => e.kind === 'attack').at(-1)!.time).toBeCloseTo(0.35, 5);
  });
  it('wraps ties with one reconstruction per boundary and no doubled boundary onset', async () => {
    const { transport, clock, sink } = setup(performance([sound('tie', ZERO, q(1n))]));
    transport.setLoop({ start: q(1n, 4n), end: q(1n, 2n) });
    await transport.play();
    clock.advance(1.12);
    expect(sink.actions.filter((e) => e.kind === 'attack').map((e) => e.time)).toEqual([0, 0.5, 1]);
    expect(sink.actions.filter((e) => e.kind === 'release').map((e) => e.time)).toEqual([0.5, 1]);
    expect(transport.position.num).toBeGreaterThan(0n);
  });
  it('uses pitch transitions for legato, but a seek/loop into a transition starts a physical source', async () => {
    const b = sound('b', q(1n, 4n));
    b.noReattack = true;
    b.midi = 64;
    const { transport, clock, sink } = setup(performance([sound('a'), b]));
    await transport.play();
    clock.advance(0.55);
    expect(sink.actions.filter((e) => e.kind === 'attack')).toHaveLength(1);
    expect(sink.actions.some((e) => e.kind === 'pitch' && e.time === 0.5)).toBe(true);
    expect(sink.actions.some((e) => e.kind === 'release' && e.time === 0.5)).toBe(false);
    transport.seek(q(1n, 4n));
    expect(sink.actions.at(-3)?.kind).not.toBe('release');
    expect(sink.actions.some((e) => e.kind === 'attack' && e.time === 0.55)).toBe(true);
  });
  it('rejects stale unlocks, disposes timers, and recovers a stalled scheduler without replaying old attacks', async () => {
    const { transport, clock, sink, events } = setup();
    let unlock!: () => void;
    sink.unlock = () =>
      new Promise<void>((r) => {
        unlock = r;
      });
    const pending = transport.play();
    transport.stop();
    unlock();
    await pending;
    expect(transport.snapshot.state).toBe('stopped');
    sink.unlock = async () => {};
    await transport.play();
    clock.time = 0.7;
    const task = [...clock.tasks.values()][0]!;
    clock.tasks.clear();
    task.fn();
    expect(sink.actions.filter((e) => e.kind === 'attack').at(-1)!.time).toBe(0.7);
    expect(events.filter((e) => e.kind === 'onset').every((e) => e.audioTime !== 0.5)).toBe(true);
    transport.dispose();
    for (const fn of clock.stale) fn();
    expect(clock.tasks.size).toBe(0);
    expect(() => transport.seek(ZERO)).toThrow('disposed');
  });
  it('locates rests and inserted holds without an active sounding event', async () => {
    const p = performance([sound('a', q(1n, 2n))]);
    p.sourceMap = [
      {
        kind: 'metric',
        ordinal: 0,
        metricOffset: ZERO,
        metricPosition: ZERO,
        position: ZERO,
        duration: q(1n, 2n),
      },
    ];
    const { transport, clock } = setup(p);
    await transport.play();
    clock.advance(0.3);
    expect(transport.snapshot.activeWritten).toEqual([]);
    expect(transport.snapshot.source?.kind).toBe('metric');
    expect(transport.position.num).toBeGreaterThan(0n);
  });
});

it('keeps bend and vibrato local to one voice and reconstructs their combined value', async () => {
  const a = sound('a', ZERO, q(1n), 'string3'),
    b = sound('b', ZERO, q(1n), 'string4');
  a.curve = [
    { kind: 'bend', points: [{ offset: ZERO, cents: 200 }] },
    { kind: 'vibrato', offset: ZERO, duration: q(1n), period: q(1n, 4n), depthCents: 25 },
  ];
  const { transport, sink } = setup(performance([a, b]));
  transport.seek(q(1n, 16n));
  await transport.play();
  const bends = sink.actions.filter((e) => e.kind === 'bend' && e.time === 0);
  expect(bends.some((e) => e.kind === 'bend' && e.voice === 'string3' && e.cents === 225)).toBe(
    true,
  );
  expect(
    bends.filter((e) => e.voice === 'string4').every((e) => e.kind === 'bend' && e.cents === 0),
  ).toBe(true);
});
it('schedules exact loop-start notes once and bounds invalid loop/rate requests without changing playback', async () => {
  const { transport, clock, sink } = setup();
  transport.setLoop({ start: q(1n, 4n), end: q(1n, 2n) });
  await transport.play();
  clock.advance(1.02);
  expect(sink.actions.filter((e) => e.kind === 'attack').map((e) => e.time)).toEqual([0, 0.5, 1]);
  expect(() => transport.setLoop({ start: q(1n, 2n), end: q(1n, 4n) })).toThrow(RangeError);
  expect(() => transport.setRate(0)).toThrow(RangeError);
  expect(transport.snapshot.state).toBe('playing');
});
it('leaves playback stopped when unlock fails', async () => {
  const { transport, sink, clock } = setup();
  sink.unlock = async () => {
    throw new Error('resume denied');
  };
  await expect(transport.play()).rejects.toThrow('resume denied');
  expect(transport.snapshot.state).toBe('stopped');
  expect(sink.actions).toEqual([]);
  expect(clock.tasks.size).toBe(0);
});

it('retains an exact seek anchor and finishes on audio time rather than the rounded display position', async () => {
  const { transport, clock, events } = setup(performance([sound('a', ZERO, q(1n))]));
  transport.seek(q(1n, 7n));
  await transport.play();
  expect(transport.position).toEqual(q(1n, 7n));
  // Put a pump just before the final release, where inverse clock rounding already says 1/1.
  const end = 12 / 7;
  clock.advance(end - 0.02);
  clock.time = end - 0.0000001;
  const task = [...clock.tasks.values()][0]!;
  clock.tasks.clear();
  task.fn();
  expect(transport.snapshot.state).toBe('playing');
  clock.advance(end + 0.03);
  expect(transport.snapshot.state).toBe('stopped');
  expect(events.some((e) => e.kind === 'end' && e.writtenId === 'a')).toBe(true);
});
