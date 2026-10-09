// The host backend (core-campaign-synth.md, Phase 5) driven against the synth's real
// HostCore on a manual clock: play, rate, seek, loop and pause reach the host as contract
// batches on time, past every commit horizon, and every note scheduled is heard.
import { it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HostCore, INSTRUMENTS, type Control, type Note, type Setup } from '@mnx-lab/synth';
import { hostAssets } from '@mnx-lab/synth/node';
import { compilePerformance } from '../../src/audio/performance.ts';
import { HostBackend, type HostBackendOptions, type HostPort } from '../../src/audio/hostBackend.ts';
import type { LoadReport } from '../../src/audio/hostStrain.ts';
import { performanceToStream } from '../../src/audio/contractStream.ts';
import { scorePositionAt } from '../../src/audio/scorePosition.ts';
import { rational } from '../../src/audio/time.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error plain mjs
import { loadCorpus } from '../verify/check-scenarios.mjs';

const RATE = 48000, BLOCK = 128;
class CorePort implements HostPort {
  core = new HostCore({ rate: RATE, block: BLOCK, instruments: INSTRUMENTS, assets: hostAssets() });
  diagnostics: { code: string; severity: string }[] = [];
  batches: { notes: Note[]; controls: Control[]; through?: number; now: number }[] = [];
  cancels: { from?: number; silence?: boolean }[] = [];
  sounding: { id: string; at: number }[] = [];
  volume = 1;
  peak = 0;
  constructor() { this.core.on('sounding', (list: { id: string; at: number }[]) => this.sounding.push(...list)); }
  /** The audio clock's step: a large output buffer (or Bluetooth) hands the worklet big chunks,
   *  so the context's time advances a chunk at a time (0: every block). */
  clockStep = 0;
  now() { return this.clockStep ? Math.floor(this.core.seconds / this.clockStep + 1e-9) * this.clockStep : this.core.seconds; }
  unlock() { return Promise.resolve(); }
  configure(setup: Setup) { this.diagnostics.push(...this.core.configure(setup)); }
  schedule(batch: { notes?: Note[]; controls?: Control[]; through?: number }) {
    this.batches.push({ notes: batch.notes ?? [], controls: batch.controls ?? [], through: batch.through, now: this.now() });
    this.diagnostics.push(...this.core.schedule(batch));
  }
  cancel(cancel: { from?: number; silence?: boolean }) { this.cancels.push(cancel); this.diagnostics.push(...this.core.cancel(cancel)); }
  setVolume(volume: number) { this.volume = volume; }
  dispose() {}
  idles = 0;
  idle() { this.idles++; }
  load: ((report: LoadReport) => void) | undefined;
  watchLoad(listener: (report: LoadReport) => void) { this.load = listener; }
  /** Output latency, reported from host time `latencyFrom` on (a device reports it once running). */
  outputLatency = 0;
  latencyFrom = 0;
  latency() { return this.now() >= this.latencyFrom ? this.outputLatency : 0; }
}
/** Timers on the host's clock; each callback runs in its own turn, as in a browser. */
function rig(document: MnxStructure, options: Partial<HostBackendOptions> = {}) {
  const compiled = compilePerformance(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const port = new CorePort(), events: { kind: string; now: number }[] = [], timers: { at: number; fn: () => void; handle: number }[] = [];
  let handles = 0;
  const backend = new HostBackend(compiled.performance, document, port, {
    timers: {
      setTimeout: (fn, ms) => { const handle = ++handles; timers.push({ at: port.now() + ms / 1000, fn, handle }); return handle; },
      clearTimeout: handle => { const i = timers.findIndex(t => t.handle === handle); if (i >= 0) timers.splice(i, 1); },
    },
    ...options,
  }, event => events.push({ kind: event.kind, now: port.now() }));
  const flush = () => new Promise<void>(resolve => setImmediate(resolve));
  /** Render `seconds` of host audio, firing timers as they fall due. */
  async function run(seconds: number) {
    const end = port.now() + seconds;
    while (port.now() < end) {
      const [left] = port.core.render(BLOCK);
      for (const x of left) port.peak = Math.max(port.peak, Math.abs(x));
      timers.sort((a, b) => a.at - b.at);
      while (timers[0] && timers[0].at <= port.now()) { timers.shift()!.fn(); await flush(); }
    }
  }
  const stream = performanceToStream(compiled.performance, { document });
  return { backend, port, events, run, flush, performance: compiled.performance, stream };
}
const scenario = (name: string) => {
  const id = name.includes('/') ? name : `lab/tab-techniques/${name}`;
  const s = (loadCorpus() as { id: string; dir: string }[]).find(x => x.id === id)!;
  return JSON.parse(fs.readFileSync(path.join(s.dir, 'document.mnx.json'), 'utf8')) as MnxStructure;
};
const base = (id: string) => id.slice(0, id.lastIndexOf(':'));
const warnings = (port: CorePort) => port.diagnostics.filter(d => d.severity !== 'info');

// Techniques, a legato chain, guitar with keys over many tempo frames, a tempo change, the kit.
it.each(['vibrato-and-palm-mute', 'hammer-pull-chain', 'bend-shapes', 'natural-harmonics', 'lab/document/twelve-bar-blues',
  'lab/navigation/tempo-change-mid-bar', 'lab/percussion/minimal-kit'])('plays %s: every note once, on the tempo map, a lead ahead, heard, with no warning', async name => {
  const { backend, port, run, flush, stream } = rig(scenario(name));
  await run(0.1);
  const start = port.now();
  await backend.play(); await flush();
  await run(stream.seconds + 1);
  const notes = port.batches.flatMap(b => b.notes);
  expect(notes.map(n => base(n.id)).sort()).toEqual(stream.notes.map(n => n.id).sort());
  for (const n of notes) expect(n.at).toBeCloseTo(start + 0.25 + stream.notes.find(m => m.id === base(n.id))!.at, 3);
  for (const b of port.batches) for (const n of b.notes) expect(n.at - b.now, 'past the commit horizon').toBeGreaterThan(0.1);
  expect(warnings(port), JSON.stringify(warnings(port))).toEqual([]);
  expect(new Set(port.sounding.map(s => s.id))).toEqual(new Set(notes.map(n => n.id)));
  expect(port.peak).toBeGreaterThan(1e-3);
  expect(backend.snapshot.state).toBe('stopped');
  // Topped up when less than half the second ahead remains: batches, not a call per poll.
  for (let i = 1; i < port.batches.length; i++)
    expect(port.batches[i]!.now - port.batches[i - 1]!.now, 'batched about a second ahead').toBeGreaterThan(0.45);
}, 60_000);

it('the cursor waits out the output latency: it colours a note when it is heard, not when it is rendered', async () => {
  const { backend, port, events, run, flush, stream } = rig(scenario('lab/document/twelve-bar-blues'));
  await run(0.1);
  // The device says nothing until the audio has been running a moment, then 0.4 s.
  port.outputLatency = 0.4; port.latencyFrom = port.now() + 0.05;
  const start = port.now();
  await backend.play(); await flush();
  await run(3);
  // Rendered a lead after play, as without latency; coloured once that has reached the speaker
  // (within a transport poll and a block). The note play starts on is coloured at once, as ever.
  const notes = port.batches.flatMap(b => b.notes);
  for (const n of notes) expect(n.at).toBeCloseTo(start + 0.25 + stream.notes.find(m => m.id === base(n.id))!.at, 3);
  const times = [...new Set(stream.notes.map(n => n.at))].sort((x, y) => x - y);
  const second = times.find(t => t > times[0]! + 0.01)!, onset = events.find(e => e.kind === 'onset' && e.now > start + 0.01)!;
  expect(onset.now - (start + 0.25 + second)).toBeGreaterThanOrEqual(0.4 - 1e-9);
  expect(onset.now - (start + 0.25 + second)).toBeLessThan(0.4 + 0.03);
  // Still supplied past every commit horizon, though the clock runs further behind.
  for (const b of port.batches) for (const n of b.notes) expect(n.at - b.now, 'past the commit horizon').toBeGreaterThan(0.1);
  expect(warnings(port), JSON.stringify(warnings(port))).toEqual([]);
  // Pausing leaves the cursor where the music was heard, so play picks up from there.
  const heard = backend.transport.snapshot.position;
  backend.pause(); await flush();
  expect(backend.transport.snapshot.position).toEqual(heard);
}, 60_000);

it('an audio clock that advances a chunk at a time does not restart playback', async () => {
  // On a phone with latencyHint 'playback' (output 272 ms) the transport's backlog guard read
  // each chunk as a sleeping tab and restarted about once a second: gaps, then the last half
  // second again, 30 s of music taking 90 (roadmap core-synth-performance, the baseline).
  const { backend, port, run, flush, stream } = rig(scenario('lab/document/twelve-bar-blues'));
  port.clockStep = 0.17; port.outputLatency = 0.3;
  await run(0.2);
  await backend.play(); await flush();
  await run(6);
  expect(port.cancels.length, 'one plan: no restarts').toBe(1);
  const notes = port.batches.flatMap(b => b.notes).map(n => base(n.id));
  expect(new Set(notes).size, 'every note once').toBe(notes.length);
  expect(notes.length).toBeGreaterThan(0);
  expect(backend.snapshot.state).toBe('playing');
  expect(warnings(port), JSON.stringify(warnings(port))).toEqual([]);
  void stream;
}, 60_000);

it('rate retimes the notes; a seek while playing silences and plans afresh', async () => {
  const { backend, port, run, flush, stream, performance } = rig(scenario('vibrato-and-palm-mute'));
  backend.setRate(2);
  await backend.play(); await flush();
  const t0 = port.batches[0]!.notes[0]!.at, first = stream.notes[0]!;
  await run(0.5);
  const twins = port.batches.flatMap(b => b.notes).slice(0, 4);
  for (const n of twins) expect(n.at - t0).toBeCloseTo((stream.notes.find(m => m.id === base(n.id))!.at - first.at) / 2, 3);
  // Seek into the middle of the piece.
  const middle = performance.sounding[Math.floor(performance.sounding.length / 2)]!;
  const position = scorePositionAt(performance, middle.position);
  if (!position.ok) throw new Error('fixture');
  const before = port.batches.length, cancels = port.cancels.length;
  backend.seek(position.value); await flush();
  expect(port.cancels.length).toBeGreaterThan(cancels);
  expect(port.cancels.at(-1)!.silence).toBe(true);
  const next = port.batches.slice(before).flatMap(b => b.notes);
  expect(next.length).toBeGreaterThan(0);
  expect(new Set(next.map(n => n.id.split(':').at(-1)!.split('.')[0])).size, 'one new generation').toBe(1);
  expect(next.every(n => !twins.some(t => t.id === n.id))).toBe(true);
  expect(next.some(n => base(n.id) === middle.id)).toBe(true);
  await run(1);
  expect(warnings(port).filter(d => d.code !== 'late-note' && d.code !== 'late-edit'), JSON.stringify(warnings(port))).toEqual([]);
  backend.pause(); await flush();
  const paused = port.batches.length;
  await run(1);
  expect(port.batches.length, 'nothing scheduled while paused').toBe(paused);
  expect(port.cancels.at(-1)!.silence).toBe(true);
}, 60_000);

it('a loop repeats its notes as new notes, visit after visit, exactly a loop apart', async () => {
  const { backend, port, run, flush, performance, stream } = rig(scenario('vibrato-and-palm-mute'));
  const measure = performance.measures[0]!;
  backend.transport.setLoop({ start: measure.position, end: rational(measure.duration.num, measure.duration.den) });
  await backend.play(); await flush();
  const loopSeconds = stream.secondsAt(measure.duration) - stream.secondsAt(measure.position);
  await run(loopSeconds * 3);
  const notes = port.batches.flatMap(b => b.notes);
  const visits = new Map<string, Note[]>();
  for (const n of notes) { const k = n.id.split('.').at(-1)!; visits.set(k, [...(visits.get(k) ?? []), n]); }
  expect(visits.size).toBeGreaterThanOrEqual(3);
  const [v0, v1] = [visits.get('0')!, visits.get('1')!];
  expect(v1.map(n => base(n.id))).toEqual(v0.map(n => base(n.id)));
  for (let i = 0; i < v0.length; i++) expect(v1[i]!.at - v0[i]!.at).toBeCloseTo(loopSeconds, 6);
  for (const n of notes) expect(n.at + n.duration - v0[0]!.at, 'cut at the loop end').toBeLessThanOrEqual(loopSeconds * (1 + Number(n.id.split('.').at(-1))) + 1e-6);
  expect(new Set(notes.map(n => n.id)).size).toBe(notes.length);
  expect(warnings(port), JSON.stringify(warnings(port))).toEqual([]);
}, 60_000);

it('the mix reconfigures the parts in place', () => {
  const { backend } = rig(scenario('vibrato-and-palm-mute'));
  backend.setPartMix({ 0: { volume: 0.25, muted: true } });
  expect(backend.setup.parts[0]!.strip).toMatchObject({ mute: true });
  expect(backend.setup.parts[0]!.strip!.levelDb).toBeCloseTo(20 * Math.log10(0.25), 9);
});

it('a part rig with an exported design and an effects chain plays on the host with no warning', async () => {
  const document = scenario('vibrato-and-palm-mute');
  const presets = JSON.parse(fs.readFileSync('synth/web/data/instrument-v2/presets.json', 'utf8')) as { id: string }[];
  const design = presets.find(p => p.id === 'warm-dual-electric')!;
  const exported = { rig: '3.0.0' as const, name: 'Crunch', setup: { contract: 'mnx-sound/2' as const, session: { buses: [{ id: 'room', type: 'room', state: 'on', params: {} }], master: {} },
    parts: [{ id: 'gtr', name: 'Guitar', instrument: { kind: 'plucked', design, layout: { strings: [{ pitch: 64 }, { pitch: 59 }, { pitch: 55 }, { pitch: 50 }, { pitch: 45 }, { pitch: 40 }] } },
      chain: [{ id: 'drive', type: 'drive', state: 'on', params: {} }, { id: 'echo', type: 'echo', state: 'on', params: {} }], strip: { levelDb: -2, sends: { room: 0.2 } } }] } };
  const { backend, port, run, flush, stream } = rig(document, { partMix: { 0: { instrument: { kind: 'rig', rig: exported } } } });
  expect(backend.routing[0]).toMatchObject({ source: 'rig', rig: 'Crunch' });
  expect(backend.setup.parts[0]!.chain!.map(b => b.type)).toEqual(['drive', 'echo']);
  await backend.play(); await flush();
  await run(stream.seconds + 1);
  expect(warnings(port), JSON.stringify(warnings(port))).toEqual([]);
  expect(new Set(port.sounding.map(s => base(s.id)))).toEqual(new Set(stream.notes.map(n => n.id)));
  expect(port.peak).toBeGreaterThan(1e-3);
}, 60_000);

it('a design change reconfigures the host in place, without re-planning', async () => {
  const document = scenario('lab/document/twelve-bar-blues');
  const { backend, port, run, flush } = rig(document);
  await backend.play(); await flush(); await run(0.5);
  const cancels = port.cancels.length;
  backend.setPartMix({ 0: { instrument: { kind: 'design', design: 'bridge-electric' } } }); await flush(); await run(0.6);
  expect(port.cancels.length).toBe(cancels);
  expect(backend.setup.parts[0]!.instrument.design).toBe('bridge-electric');
}, 60_000);

it('the worklet’s load reports raise strain while playing; stopping clears it', async () => {
  const { backend, port, run, flush } = rig(scenario('vibrato-and-palm-mute'));
  let changes = 0;
  backend.subscribe(() => changes++);
  port.load!({ busy: 0.9, peakMs: 2 }); port.load!({ busy: 0.9, peakMs: 2 });
  expect(backend.snapshot.strained, 'not while stopped').toBeUndefined();
  await backend.play(); await flush(); await run(0.2);
  // Before the first note has sounded for a report window, stalls are setting up in silence.
  port.load!({ busy: 0.2, peakMs: 40 }); port.load!({ busy: 0.9, peakMs: 30 });
  expect(backend.snapshot.strained, 'a slow start is not strain').toBeUndefined();
  await run(0.6);
  port.load!({ busy: 0.9, peakMs: 2 });
  expect(backend.snapshot.strained).toBeUndefined();
  const before = changes;
  port.load!({ busy: 0.2, peakMs: 20 });
  expect(backend.snapshot.strained).toBe(true);
  expect(changes, 'listeners hear it').toBeGreaterThan(before);
  backend.stop(); await flush();
  expect(backend.snapshot.strained).toBeUndefined();
  // Underruns the browser counts: those from before the music sounded (reported late) set
  // the baseline; one while it sounds is strain at once.
  await backend.play(); await flush(); await run(0.8);
  port.load!({ busy: 0.2, peakMs: 1, underrunsTotal: 4 });
  expect(backend.snapshot.strained, 'the start-up stall’s underruns').toBeUndefined();
  port.load!({ busy: 0.2, peakMs: 1, underrunsTotal: 4 });
  expect(backend.snapshot.strained).toBeUndefined();
  port.load!({ busy: 0.2, peakMs: 1, underrunsTotal: 5 });
  expect(backend.snapshot.strained).toBe(true);
}, 60_000);

it('the port hears when playback stops — paused, stopped or at the end — and not before', async () => {
  const { backend, port, run, flush, stream } = rig(scenario('vibrato-and-palm-mute'));
  await backend.play(); await flush(); await run(0.5);
  expect(port.idles).toBe(0);
  backend.pause(); await flush();
  expect(port.idles).toBe(1);
  await backend.play(); await flush(); await run(0.3);
  backend.seek(backend.snapshot.scorePosition!); await flush();
  expect(port.idles, 'a seek while playing is not a stop').toBe(1);
  await run(stream.seconds + 1);
  expect(backend.snapshot.state).toBe('stopped');
  expect(port.idles, 'the end of the piece').toBe(2);
}, 60_000);
