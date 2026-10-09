// @ts-nocheck: a measurement tool reaching into the synth's untyped internals (Plucked, the planner, the engine).
// Step 4 benchmark (roadmap core-synth-performance): plays a piece through HostBackend's own
// batching into HostCore under Node and times each `schedule` message the audio thread gets.
// Run: npx tsx harness/tools/plan-stalls.ts [piece.mnx.json] [seconds]; VERBOSE=1 lists every
// batch, WARM=1 runs the worklet's warm-up first, CAPTURE=file keeps the planner inputs for
// plan-bench.ts.
import fs from 'node:fs';
import v8 from 'node:v8';
import { HostCore, INSTRUMENTS, type Control, type Note, type Setup } from '@mnx-lab/synth';
import { hostAssets } from '@mnx-lab/synth/node';
import { Plucked } from '../../synth/web/host/instruments/plucked.js';
import { compilePerformance } from '../../src/audio/performance.ts';
import { HostBackend, type HostPort } from '../../src/audio/hostBackend.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const RATE = 48000, BLOCK = 128, file = process.argv[2] ?? 'converters/fixtures/Vestapol.mnx.json', seconds = Number(process.argv[3] ?? 60);
const parts: Record<string, number> = {};
const time = <T>(key: string, fn: () => T) => { const t = performance.now(); try { return fn(); } finally { parts[key] = (parts[key] ?? 0) + performance.now() - t; } };
const P = Plucked.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
// CAPTURE=file: keep every re-plan's inputs (v8-serialised) for plan-bench.ts.
const captured: unknown[] = [];
if (process.env.CAPTURE) { const f = P.replan!; P.replan = function (this: { started?: boolean; entries: Map<string, unknown>; resolved: unknown; rate: number; memory: unknown }, ...a: unknown[]) {
  captured.push(structuredClone({ entries: [...this.entries.values()], resolved: this.resolved, rate: this.rate, memory: this.memory, from: (this as unknown as { started: boolean }).started ? (this as unknown as { engine: { position: number } }).engine.position : -Infinity })); return f.apply(this, a); }; }
import { GuitarEngine } from '../../synth/web/audio/engine.js';
{ const G = GuitarEngine.prototype as unknown as Record<string, (...a: unknown[]) => unknown>, f = G.update!; G.update = function (this: unknown, ...a: unknown[]) { return time('engine.update', () => f.apply(this, a)); }; }
for (const name of ['replan', 'forget']) { const f = P[name]!; P[name] = function (this: unknown, ...a: unknown[]) { return time(name, () => f.apply(this, a)); }; }
const stats: { at: number; ms: number; notes: number; parts: Record<string, number>; entries: number; events: number }[] = [];
class Port implements HostPort {
  core = new HostCore({ rate: RATE, block: BLOCK, instruments: INSTRUMENTS, assets: hostAssets(), history: false });
  now() { return this.core.seconds; }
  unlock() { return Promise.resolve(); }
  configure(setup: Setup) { this.core.configure(setup); }
  schedule(batch: { notes?: Note[]; controls?: Control[]; through?: number }) {
    for (const k of Object.keys(parts)) delete parts[k];
    const t = performance.now(); this.core.schedule(batch); const ms = performance.now() - t;
    const guitar = [...this.core.parts.values()].map(p => p.instrument).find(i => i instanceof Plucked) as unknown as { entries: Map<string, unknown>; engine: { events: unknown[] } } | undefined;
    stats.push({ at: this.now(), ms, notes: batch.notes?.length ?? 0, parts: { ...parts }, entries: guitar?.entries.size ?? 0, events: guitar?.engine.events.length ?? 0 });
  }
  cancel(c: { from?: number; silence?: boolean }) { this.core.cancel(c); }
  setVolume() {} dispose() {} idle() {} watchLoad() {}
}
const document = JSON.parse(fs.readFileSync(file, 'utf8')) as MnxStructure, compiled = compilePerformance(document);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
const port = new Port(), timers: { at: number; fn: () => void; handle: number }[] = [];
let handles = 0;
const backend = new HostBackend(compiled.performance, document, port, { timers: {
  setTimeout: (fn, ms) => { const handle = ++handles; timers.push({ at: port.now() + ms / 1000, fn, handle }); return handle; },
  clearTimeout: handle => { const i = timers.findIndex(t => t.handle === handle); if (i >= 0) timers.splice(i, 1); } } }, () => {});
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const renders: number[] = [];
async function run(s: number) {
  const end = port.now() + s;
  while (port.now() < end) {
    const t = performance.now(); port.core.render(BLOCK); renders.push(performance.now() - t);
    timers.sort((a, b) => a.at - b.at);
    while (timers[0] && timers[0].at <= port.now()) { timers.shift()!.fn(); await flush(); }
  }
}
// WARM=1: the worklet's warm-up (host-processor.js warm) before play, as on a device.
if (process.env.WARM) { const { warmHost } = await import('../../synth/web/host/warm.js'); warmHost(port.core.setup, { rate: RATE, block: BLOCK, instruments: INSTRUMENTS, assets: hostAssets(), HostCore }, new Set()); for (const k of Object.keys(parts)) delete parts[k]; }
await run(0.1); await backend.play(); await flush(); await run(seconds);
const ms = stats.map(s => s.ms).sort((a, b) => a - b), q = (p: number) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))]!.toFixed(2);
console.log(`${file.split('/').pop()}: ${stats.length} batches in ${seconds} s; schedule ms median ${q(.5)} p90 ${q(.9)} max ${q(1)}; render block median ${renders.sort((a, b) => a - b)[renders.length >> 1]!.toFixed(3)} ms`);
if (process.env.VERBOSE) for (const s of stats) console.log(s.at.toFixed(2), s.ms.toFixed(2), 'notes', s.notes, 'entries', s.entries, 'events', s.events, JSON.stringify(Object.fromEntries(Object.entries(s.parts).map(([k, v]) => [k, +v.toFixed(2)]))));
const total: Record<string, number> = {}; for (const s of stats) for (const [k, v] of Object.entries(s.parts)) total[k] = (total[k] ?? 0) + v;
console.log('share of schedule time:', Object.fromEntries(Object.entries(total).map(([k, v]) => [k, +(v / ms.reduce((a, b) => a + b, 0)).toFixed(2)])));
if (process.env.CAPTURE) fs.writeFileSync(process.env.CAPTURE, v8.serialize(captured));
