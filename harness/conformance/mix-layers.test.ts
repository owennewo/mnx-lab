// Mix layers (roadmap/inprogress/studio-mix-layers.md): the click on every beat wherever the
// time comes from, the synth's and the click's levels, and the synth following a recording
// through its sync — driven against the synth's real HostCore on a manual clock.
import { it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HostCore, INSTRUMENTS, type Control, type Note, type Setup } from '@mnx-lab/synth';
import { hostAssets } from '@mnx-lab/synth/node';
import { compilePerformance } from '../../src/audio/performance.ts';
import { HostBackend, type HostPort } from '../../src/audio/hostBackend.ts';
import { performanceToStream } from '../../src/audio/contractStream.ts';
import { createRecordingSync } from '../../src/audio/recordingSync.ts';
import { mediaWarp } from '../../src/audio/mediaFollow.ts';
import { beatGrid, documentMeter } from '../../src/audio/practice.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const RATE = 48000, BLOCK = 128;
class CorePort implements HostPort {
  core = new HostCore({ rate: RATE, block: BLOCK, instruments: INSTRUMENTS, assets: hostAssets() });
  diagnostics: { code: string; severity: string }[] = [];
  batches: { notes: Note[]; controls: Control[]; now: number }[] = [];
  cancels: { from?: number; silence?: boolean; now: number }[] = [];
  sounding: { id: string; at: number }[] = [];
  constructor(levels: boolean) {
    this.core.on('sounding', (list: { id: string; at: number }[]) => this.sounding.push(...list));
    if (levels) this.setLevels = l => this.levels.push(l);
  }
  now() { return this.core.seconds; }
  unlock() { return Promise.resolve(); }
  configure(setup: Setup) { this.diagnostics.push(...this.core.configure(setup)); }
  schedule(batch: { notes?: Note[]; controls?: Control[]; through?: number }) {
    this.batches.push({ notes: batch.notes ?? [], controls: batch.controls ?? [], now: this.now() });
    this.diagnostics.push(...this.core.schedule(batch));
  }
  cancel(cancel: { from?: number; silence?: boolean }) { this.cancels.push({ ...cancel, now: this.now() }); this.diagnostics.push(...this.core.cancel(cancel)); }
  setVolume() {}
  dispose() {}
  idles = 0;
  idle() { this.idles++; }
  clicks: { at: number; accent: boolean; countIn: boolean }[] = [];
  click(at: number, accent: boolean, countIn = false) { this.clicks.push({ at, accent, countIn }); }
  levels: { synth: number; click: number }[] = [];
  setLevels?: (levels: { synth: number; click: number }) => void;
}
const document = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../../scenarios/lab/00-document/04-twelve-bar-blues/document.mnx.json'), 'utf8')) as MnxStructure;

function rig(levels = false) {
  const compiled = compilePerformance(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const port = new CorePort(levels), timers: { at: number; fn: () => void; handle: number }[] = [];
  let handles = 0;
  const backend = new HostBackend(compiled.performance, document, port, {
    timers: {
      setTimeout: (fn, ms) => { const handle = ++handles; timers.push({ at: port.now() + ms / 1000, fn, handle }); return handle; },
      clearTimeout: handle => { const i = timers.findIndex(t => t.handle === handle); if (i >= 0) timers.splice(i, 1); },
    },
    monotonic: () => port.now(),
  }, () => {});
  const flush = () => new Promise<void>(resolve => setImmediate(resolve));
  async function run(seconds: number) {
    const end = port.now() + seconds;
    while (port.now() < end) {
      port.core.render(BLOCK);
      timers.sort((a, b) => a.at - b.at);
      while (timers[0] && timers[0].at <= port.now()) { timers.shift()!.fn(); await flush(); }
    }
  }
  const stream = performanceToStream(compiled.performance, { document });
  return { backend, port, run, flush, compiled, performance: compiled.performance, stream };
}
const base = (id: string) => id.slice(0, id.lastIndexOf(':'));
const warnings = (port: CorePort) => port.diagnostics.filter(d => d.severity !== 'info');

it('the beat grid counts each bar in its meter, the downbeat accented', () => {
  const { performance } = rig();
  const beats = beatGrid(performance, documentMeter(performance, document));
  expect(beats.length).toBe(12 * 4);
  expect(beats.filter(b => b.accent).map(b => b.ordinal)).toEqual([...Array(12).keys()]);
  expect(beats.slice(0, 4).map(b => Number(b.metricOffset.num) / Number(b.metricOffset.den))).toEqual([0, 0.25, 0.5, 0.75]);
});

it('the click layer clicks every beat of the piece on the synth\'s clock, with no loop', async () => {
  const { backend, port, run, flush, performance, stream } = rig();
  backend.setLayers({ synth: true, click: true, clickLevel: 1 });
  await run(0.1);
  const start = port.now();
  await backend.play(); await flush();
  await run(stream.seconds + 1);
  const beats = beatGrid(performance, documentMeter(performance, document));
  expect(port.clicks.length).toBe(beats.length);
  port.clicks.forEach((c, i) => {
    expect(c.at, `beat ${i}`).toBeCloseTo(start + 0.25 + stream.secondsAt(beats[i]!.position), 3);
    expect(c.accent).toBe(i % 4 === 0);
    expect(c.countIn).toBe(false);
  });
}, 60_000);

it('with the click off, a port without levels hears no beats; a port with levels hears them all, switched by its level', async () => {
  const silent = rig();
  silent.backend.setLayers({ synth: true, click: false, clickLevel: 1 });
  await silent.run(0.1); await silent.backend.play(); await silent.flush(); await silent.run(3);
  expect(silent.port.clicks).toEqual([]);

  const switched = rig(true);
  switched.backend.setLayers({ synth: false, click: false, clickLevel: 0.4 });
  expect(switched.port.levels.at(-1)).toEqual({ synth: 0, click: 0 });
  switched.backend.setLayers({ synth: true, click: true, clickLevel: 0.4 });
  expect(switched.port.levels.at(-1)).toEqual({ synth: 1, click: 0.4 });
  await switched.run(0.1); await switched.backend.play(); await switched.flush(); await switched.run(3);
  expect(switched.port.clicks.length).toBeGreaterThan(4);
}, 60_000);

/** A recording that waits `intro` seconds, then plays every bar at half the synth's speed. */
function slowRecording(r: ReturnType<typeof rig>, intro: number) {
  const bar = (o: number) => r.stream.secondsAt(r.performance.measures[o]?.position ?? r.performance.measures.at(-1)!.position);
  const end = r.stream.secondsAt(r.performance.measures.at(-1)!.position) + (bar(11) - bar(10));
  const points = [...Array(12).keys()].map(o => [o, intro + 2 * bar(o)] as [number, number]).concat([[12, intro + 2 * end]]);
  const sync = createRecordingSync(points, r.compiled, linearizePasses(document));
  if (!sync.ok) throw new Error(sync.diagnostic.message);
  return sync.value;
}

it('the warp moves synth seconds onto the recording\'s timeline, and back', () => {
  const r = rig(), sync = slowRecording(r, 3);
  const warp = mediaWarp(r.performance, r.stream.secondsAt, sync);
  for (const s of [0, 0.37, 1.5, 4.2, r.stream.seconds - 0.5]) {
    expect(warp.toMedia(s)).toBeCloseTo(3 + 2 * s, 6);
    expect(warp.toSynth(3 + 2 * s)).toBeCloseTo(s, 6);
    expect(warp.slope(s)).toBeCloseTo(2, 6);
  }
  expect(warp.toMedia(-1)).toBeNull();
  expect(warp.toSynth(1)).toBeNull();
});

it('the synth follows a recording: every note once, at the recording\'s time, twice as long; a seek restarts it; a pause silences it', async () => {
  const r = rig(), sync = slowRecording(r, 3);
  const media = { time: 2, rate: 1, playing: false, at: 0 };
  const read = () => ({ mediaTime: media.playing ? media.time + (r.port.now() - media.at) * media.rate : media.time, rate: media.rate, playing: media.playing });
  r.backend.setLayers({ synth: true, click: true, clickLevel: 1 });
  r.backend.followMedia({ read, sync });
  await r.run(0.2);
  expect(r.port.batches.filter(b => b.notes.length)).toEqual([]);
  // Play from 2 s: the recording's first bar is 1 s away.
  Object.assign(media, { playing: true, at: r.port.now(), time: 2 });
  const t0 = r.port.now();
  const hostAt = (synthSeconds: number) => t0 + (3 + 2 * synthSeconds - 2);
  await r.run(6);
  const first = r.port.batches.flatMap(b => b.notes);
  expect(first.length).toBeGreaterThan(0);
  for (const n of first) {
    const original = r.stream.notes.find(m => m.id === base(n.id))!;
    expect(n.at, n.id).toBeCloseTo(hostAt(original.at), 2);
    expect(n.duration).toBeCloseTo(2 * original.duration, 2);
  }
  for (const b of r.port.batches) for (const n of b.notes) expect(n.at - b.now, 'past the commit horizon').toBeGreaterThan(0.1);
  const beats = beatGrid(r.performance, documentMeter(r.performance, document));
  expect(r.port.clicks[0]!.at).toBeCloseTo(hostAt(r.stream.secondsAt(beats[0]!.position)), 2);
  expect(r.port.clicks[0]!.accent).toBe(true);

  // A seek to bar 7: what was sent is taken back, and bar 7 plays at its time.
  const cancels = r.port.cancels.length;
  const seven = r.stream.secondsAt(r.performance.measures[6]!.position);
  Object.assign(media, { time: 3 + 2 * seven - 0.5, at: r.port.now() });
  const t1 = r.port.now();
  r.port.batches = [];
  await r.run(3);
  expect(r.port.cancels.length).toBeGreaterThan(cancels);
  const after = r.port.batches.flatMap(b => b.notes).filter(n => !n.techniques?.some(t => t.type === 'mute'));
  const struck = after.filter(n => r.stream.notes.find(m => m.id === base(n.id))!.at >= seven);
  expect(struck.length).toBeGreaterThan(0);
  for (const n of struck) expect(n.at, n.id).toBeCloseTo(t1 + 0.5 + 2 * (r.stream.notes.find(m => m.id === base(n.id))!.at - seven), 1);

  // Paused: silenced, and the host may rest.
  Object.assign(media, { time: read().mediaTime, playing: false });
  const idles = r.port.idles;
  await r.run(0.2);
  expect(r.port.cancels.at(-1)!.silence).toBe(true);
  expect(r.port.idles).toBe(idles + 1);
  expect(warnings(r.port), JSON.stringify(warnings(r.port))).toEqual([]);
  r.backend.followMedia(null);
  r.backend.dispose();
}, 60_000);

it('following a recording, each note and beat is sent the output\'s latency early, so it is heard at the recording\'s time', async () => {
  const r = rig(), sync = slowRecording(r, 3), LATENCY = 0.2;
  Object.assign(r.port, { latency: () => LATENCY });
  const media = { time: 2, rate: 1, playing: false, at: 0 };
  const read = () => ({ mediaTime: media.playing ? media.time + (r.port.now() - media.at) * media.rate : media.time, rate: media.rate, playing: media.playing });
  r.backend.setLayers({ synth: true, click: true, clickLevel: 1 });
  r.backend.followMedia({ read, sync });
  await r.run(0.2);
  Object.assign(media, { playing: true, at: r.port.now(), time: 2 });
  const t0 = r.port.now();
  // Heard at the recording's time: rendered LATENCY before it.
  const renderedAt = (synthSeconds: number) => t0 + (3 + 2 * synthSeconds - 2) - LATENCY;
  await r.run(6);
  const notes = r.port.batches.flatMap(b => b.notes);
  expect(notes.length).toBeGreaterThan(0);
  for (const n of notes) expect(n.at, n.id).toBeCloseTo(renderedAt(r.stream.notes.find(m => m.id === base(n.id))!.at), 2);
  for (const b of r.port.batches) for (const n of b.notes) expect(n.at - b.now, 'past the commit horizon').toBeGreaterThan(0.1);
  const beats = beatGrid(r.performance, documentMeter(r.performance, document));
  expect(r.port.clicks[0]!.at).toBeCloseTo(renderedAt(r.stream.secondsAt(beats[0]!.position)), 2);
  expect(warnings(r.port), JSON.stringify(warnings(r.port))).toEqual([]);
  r.backend.followMedia(null);
  r.backend.dispose();
}, 60_000);

// A recording off concert pitch (open E♭ at A=428 against a score in open D: +52) — the synth plays at
// its pitch everywhere: following it, playing on its own, and a clicked note.
it("the synth's tuning moves every pitched note it sends, following, playing and auditioning — timing unchanged", async () => {
  const pitch = (n: Note) => (n.target as { pitch: number }).pitch;
  const written = (r: ReturnType<typeof rig>, n: Note) => pitch(r.stream.notes.find(m => m.id === base(n.id))!);
  const following = async (cents: number) => {
    const r = rig(), sync = slowRecording(r, 3);
    const media = { time: 2, rate: 1, playing: true, at: r.port.now() };
    const read = () => ({ mediaTime: media.time + (r.port.now() - media.at) * media.rate, rate: media.rate, playing: media.playing });
    r.backend.setLayers({ synth: true, click: false, clickLevel: 0 });
    r.backend.setTuning(cents);
    r.backend.followMedia({ read, sync });
    await r.run(4);
    const notes = r.port.batches.flatMap(b => b.notes);
    r.backend.followMedia(null); r.backend.dispose();
    return { r, notes };
  };
  const plain = await following(0), tuned = await following(52);
  expect(plain.notes.length).toBeGreaterThan(0);
  expect(tuned.notes.map(n => [n.id, n.at, n.duration])).toEqual(plain.notes.map(n => [n.id, n.at, n.duration]));
  for (const n of plain.notes) expect(pitch(n)).toBe(written(plain.r, n));
  for (const n of tuned.notes) expect(pitch(n)).toBeCloseTo(written(tuned.r, n) + 0.52, 9);

  // Playing on its own, and set while following: the notes still to come are sent again, tuned.
  const r = rig();
  r.backend.setLayers({ synth: true, click: false, clickLevel: 0 });
  await r.backend.play(); await r.flush();
  await r.run(1);
  r.port.batches = [];
  r.backend.setTuning(-48);
  await r.run(2);
  const later = r.port.batches.flatMap(b => b.notes);
  expect(later.length).toBeGreaterThan(0);
  for (const n of later) expect(pitch(n)).toBeCloseTo(written(r, n) - 0.48, 9);
  r.backend.pause(); await r.run(0.3);

  // A clicked note.
  r.port.batches = [];
  const key = r.performance.written.find(w => w.soundingIds.length)!;
  expect(r.backend.audition(key.noteKey, key.ordinal)).toBe(true); await r.flush(); await r.run(0.2);
  const clicked = r.port.batches.flatMap(b => b.notes);
  expect(clicked.length).toBeGreaterThan(0);
  for (const n of clicked) expect(pitch(n)).toBeCloseTo(written(r, n) - 0.48, 9);
  expect(warnings(r.port), JSON.stringify(warnings(r.port))).toEqual([]);
  r.backend.dispose();
});
