// The performance as an mnx-sound/2 stream and the part router (core-campaign-synth.md,
// Phases 4 and 5): every valid corpus scenario becomes a contract event log the synth's
// validators accept; techniques travel as intent (the compiler's lowering undone); and a
// technique scenario plays through the synth's own renderer with no warning.
import { it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validateEventLog, type Note } from '@mnx-lab/synth/contract';
import { render } from '@mnx-lab/synth/node';
import { compilePerformance } from '../../src/audio/performance.ts';
import { performanceToStream } from '../../src/audio/contractStream.ts';
import { hostSetup, levelDb } from '../../src/audio/hostSetup.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error plain mjs
import { loadCorpus } from '../verify/check-scenarios.mjs';

const read = (dir: string) => JSON.parse(fs.readFileSync(path.join(dir, 'document.mnx.json'), 'utf8')) as MnxStructure;
const scenario = (name: string) => (loadCorpus() as { id: string; dir: string }[]).find(s => s.id === `lab/tab-techniques/${name}`)!;
function stream(document: MnxStructure, withDocument = true) {
  const compiled = compilePerformance(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const routed = hostSetup(compiled.performance, document);
  return { performance: compiled.performance, routed, ...performanceToStream(compiled.performance, { partOf: routed.partOf, ...(withDocument ? { document } : {}) }) };
}
const techniquesOf = (notes: Note[], type: string) => notes.flatMap(n => (n.techniques ?? []).filter(t => t.type === type).map(t => ({ note: n, technique: t as Record<string, unknown> })));

it('every valid corpus scenario is a contract event log the synth accepts', () => {
  let checked = 0;
  for (const s of loadCorpus() as { id: string; dir: string }[]) {
    const meta = JSON.parse(fs.readFileSync(path.join(s.dir, 'meta.json'), 'utf8'));
    if (meta.expect.standard !== 'valid') continue;
    const document = read(s.dir), compiled = compilePerformance(document);
    if (!compiled.ok || !compiled.performance.sounding.length) continue;
    const { routed, notes, controls } = stream(document);
    expect(() => validateEventLog({ contract: 'mnx-sound/2', setup: routed.setup, notes, controls }), s.id).not.toThrow();
    expect(notes.length, s.id).toBe(compiled.performance.sounding.length);
    checked++;
  }
  expect(checked).toBeGreaterThan(50);
});

it('times come from the tempo map; tempo changes become session-wide tempo controls', () => {
  const { performance, notes, controls, secondsAt } = stream(read(scenario('bend-and-release').dir));
  for (const e of performance.sounding) expect(notes.find(n => n.id === e.id)!.at).toBeCloseTo(secondsAt(e.position), 9);
  expect(controls.length).toBe(performance.tempo.length);
  expect(controls.every(c => c.type === 'tempo' && c.part === undefined)).toBe(true);
});

it('bends and vibrato travel as contract techniques; palm mutes and harmonics as intent, with the lowering undone', () => {
  const bend = stream(read(scenario('bend-and-release').dir));
  const bends = techniquesOf(bend.notes, 'bend');
  expect(bends.length).toBeGreaterThan(0);
  expect(bends.every(({ technique }) => Array.isArray(technique.points) && (technique.points as { at: number }[]).every((p, i, all) => p.at >= 0 && p.at <= 1 && (i === 0 || p.at >= all[i - 1]!.at)))).toBe(true);

  const vp = stream(read(scenario('vibrato-and-palm-mute').dir)), raw = stream(read(scenario('vibrato-and-palm-mute').dir), false);
  expect(techniquesOf(vp.notes, 'vibrato').length + vp.sampledCurves.length).toBeGreaterThan(0);
  const palms = techniquesOf(vp.notes, 'mute');
  expect(palms.length).toBeGreaterThan(0);
  for (const { note } of palms) {
    const lowered = raw.notes.find(n => n.id === note.id)!;
    expect(note.duration, 'the compiler shortened it ×3/5; the synth gets the written length').toBeCloseTo(lowered.duration * 5 / 3, 9);
    expect(note.velocity).toBeGreaterThan(lowered.velocity);
    expect(lowered.techniques?.some(t => t.type === 'mute') ?? false, 'without the document: no technique, the lowered note').toBe(false);
  }

  const harmonics = techniquesOf(stream(read(scenario('natural-harmonics').dir)).notes, 'harmonic');
  expect(harmonics.length).toBeGreaterThan(0);
});

it('a fingerboard routes the part to the guitar on the score’s strings; the mix becomes the strip', () => {
  const document = read(scenario('vibrato-and-palm-mute').dir), compiled = compilePerformance(document);
  if (!compiled.ok) throw new Error('fixture');
  const routed = hostSetup(compiled.performance, document, { 0: { volume: 0.5, muted: true } });
  const part = routed.setup.parts[0]!;
  expect(part.instrument.kind).toBe('plucked');
  expect(part.instrument.layout!.strings.length).toBe(document.parts[0]!._x!.mnxLab!.strings!.length);
  expect(part.strip).toMatchObject({ mute: true, levelDb: levelDb(0.5) });
  expect(levelDb(0)).toBe(-60);
  expect(levelDb(1)).toBe(0);
});

it('a technique scenario plays through the synth with every note and no warning', () => {
  const { routed, notes, controls, seconds } = stream(read(scenario('vibrato-and-palm-mute').dir));
  // Playback starts a lead ahead of now (the backend's LEAD), past the guitar's commit horizon.
  const lead = 0.25, shift = <T extends { at: number }>(x: T) => ({ ...x, at: x.at + lead });
  const out = render({ setup: routed.setup, notes: notes.map(shift), controls: controls.map(shift), seconds: seconds + lead + 1 });
  let peak = 0;
  for (const x of out.audio[0]) peak = Math.max(peak, Math.abs(x));
  expect(peak).toBeGreaterThan(1e-3);
  expect(out.diagnostics.filter(d => d.severity !== 'info'), JSON.stringify(out.diagnostics)).toEqual([]);
  expect(new Set(out.labels.map(l => l.id))).toEqual(new Set(notes.map(n => n.id)));
}, 60_000);
