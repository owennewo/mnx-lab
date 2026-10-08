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
import type { Sink, SinkEvent } from '../../src/audio/sink.ts';
import type { PartMix } from '../../src/audio/partMix.ts';
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
  now() { return this.core.seconds; }
  unlock() { return Promise.resolve(); }
  configure(setup: Setup) { this.diagnostics.push(...this.core.configure(setup)); }
  schedule(batch: { notes?: Note[]; controls?: Control[]; through?: number }) {
    this.batches.push({ notes: batch.notes ?? [], controls: batch.controls ?? [], through: batch.through, now: this.now() });
    this.diagnostics.push(...this.core.schedule(batch));
  }
  cancel(cancel: { from?: number; silence?: boolean }) { this.cancels.push(cancel); this.diagnostics.push(...this.core.cancel(cancel)); }
  setVolume(volume: number) { this.volume = volume; }
  dispose() {}
}
/** Timers on the host's clock; each callback runs in its own turn, as in a browser. */
function rig(document: MnxStructure, options: Partial<HostBackendOptions> = {}) {
  const compiled = compilePerformance(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const port = new CorePort(), timers: { at: number; fn: () => void; handle: number }[] = [];
  let handles = 0;
  const backend = new HostBackend(compiled.performance, document, port, {
    timers: {
      setTimeout: (fn, ms) => { const handle = ++handles; timers.push({ at: port.now() + ms / 1000, fn, handle }); return handle; },
      clearTimeout: handle => { const i = timers.findIndex(t => t.handle === handle); if (i >= 0) timers.splice(i, 1); },
    },
    ...options,
  }, () => {});
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
  return { backend, port, run, flush, performance: compiled.performance, stream };
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

/** A sink that records what reaches it. */
function recordingSink() {
  const log = { scheduled: [] as { events: readonly SinkEvent[]; at: number }[], cancels: [] as number[], unlocked: 0, disposed: false };
  const sink: Sink = {
    now: () => 0, unlock: async () => { log.unlocked++; }, schedule: (events, at) => { log.scheduled.push({ events, at }); },
    cancel: at => { log.cancels.push(at); }, release: () => {}, bend: () => {}, dispose: () => { log.disposed = true; },
  };
  return { sink, log };
}

it('a part kept on the old player’s sound plays on the sink, a lead later; the host plays the rest', async () => {
  const document = scenario('lab/document/twelve-bar-blues');
  const keys = document.parts.findIndex(p => !p._x?.mnxLab?.strings?.length);
  const { sink, log } = recordingSink();
  const mix: PartMix = { [keys]: { sound: 'synth', instrument: { kind: 'sink' } } };
  const { backend, port, run, flush, performance } = rig(document, { partMix: mix, legacySink: () => sink });
  const keyVoices = new Set(performance.voices.filter(v => v.partIndex === keys).map(v => v.id));
  await backend.play(); await flush();
  const start = port.now();
  await run(3);
  expect(log.unlocked).toBe(1);
  const voices = new Set(log.scheduled.flatMap(s => s.events.map(e => e.voice)));
  expect([...voices].every(v => keyVoices.has(v)), 'only the kept part reaches the sink').toBe(true);
  expect(log.scheduled.some(s => s.events.some(e => e.kind === 'attack'))).toBe(true);
  expect(Math.min(...log.scheduled.map(s => s.at)) - start, 'a lead later, like the host').toBeGreaterThanOrEqual(0.25 - 1e-9);
  const hostNotes = port.batches.flatMap(b => b.notes);
  expect(hostNotes.length).toBeGreaterThan(0);
  expect(hostNotes.every(n => n.part !== `part${keys}`)).toBe(true);
  expect(backend.setup.parts.map(p => p.id)).not.toContain(`part${keys}`);
  expect(warnings(port), JSON.stringify(warnings(port))).toEqual([]);
  // Seek cancels the sink too; dispose disposes it.
  const cancels = log.cancels.length;
  backend.pause(); await flush();
  expect(log.cancels.length).toBeGreaterThan(cancels);
  backend.dispose();
  expect(log.disposed).toBe(true);
}, 60_000);

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

it('moving a part between the host and the sink re-plans; a design change only reconfigures', async () => {
  const document = scenario('lab/document/twelve-bar-blues');
  const keys = document.parts.findIndex(p => !p._x?.mnxLab?.strings?.length);
  const { sink } = recordingSink();
  const { backend, port, run, flush } = rig(document, { legacySink: () => sink });
  await backend.play(); await flush(); await run(0.5);
  const cancels = port.cancels.length;
  backend.setPartMix({ 0: { instrument: { kind: 'design', design: 'bridge-electric' } } }); await flush();
  expect(port.cancels.length, 'a design change keeps the plan').toBe(cancels);
  backend.setPartMix({ [keys]: { instrument: { kind: 'sink' } } }); await flush(); await run(0.6);
  expect(port.cancels.length, 'a part leaving the host re-plans').toBeGreaterThan(cancels);
  const after = port.batches.at(-1)!.notes;
  expect(after.every(n => n.part !== `part${keys}`)).toBe(true);
}, 60_000);
