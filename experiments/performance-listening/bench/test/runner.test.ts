import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import type { Decision, Golden, Listener } from '../src/types.ts';
import { execute, checkPrefix } from '../src/run/runner.ts';
import { clockFollower } from '../src/candidates/clockFollower.ts';
const folder = new URL('../oracle/o1-perfect/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, folder), 'utf8'));
const score = read('score.mnx.json') as MnxStructure, golden = read('golden.json') as Golden, expected = read('decisions.json') as Decision[];
const scripted = (): Listener => {
  let at = 0;
  return { start() { at = 0; }, feed(_chunk, clock) {
    const output = [];
    while (at < expected.length && expected[at]!.madeAt <= clock) {
      const { madeAt: _time, ...emission } = expected[at++]!; output.push(emission);
    }
    return output;
  }, finish() { return []; } };
};
const cuts = [{ seconds: .25, kind: 'note interior' }, { seconds: 1, kind: 'onset' }, { seconds: .75, kind: 'gap' }];
it('reproduces o1 byte for byte through actual chunk dispatch and fresh-instance prefix tests', () => {
  const pcm = new Float32Array(golden.audio.duration * 48000); pcm.fill(.1, 0, 24000); pcm.fill(.2, 48000, 72000);
  const run = execute(scripted, score, golden.intended.tempo, pcm);
  expect(JSON.stringify(run.record)).toBe(JSON.stringify(expected));
  expect(checkPrefix(scripted, score, golden.intended.tempo, pcm, cuts).every(c => c.pass)).toBe(true);
  expect(run.cost.chunks).toBe(800); expect(run.cost.machine.cpu.length).toBeGreaterThan(0); expect(run.cost.provisional).toBe(true);
});
it('gives each feed only its prefix chunk, stamps time, and snapshots mutable emissions', () => {
  const pcm = new Float32Array(1000).fill(.1); let count = 0;
  const emission = { id: 'a', kind: 'unsupported' as const, refersTo: 0 };
  const factory = (): Listener => ({ start() {}, feed(chunk, clock) {
    expect(chunk.buffer.byteLength).toBe(chunk.length * 4); count++;
    chunk.fill(0); emission.id = String(count); emission.refersTo = clock;
    return [emission];
  }, finish() { emission.id = 'mutated'; return []; } });
  const result = execute(factory, score, golden.intended.tempo, pcm);
  expect(result.record.map(d => d.id)).toEqual(['1', '2', '3']);
  expect(result.record.map(d => d.madeAt)).toEqual([.01, .02, 1000 / 48000]);
  expect(pcm.every(x => x > 0)).toBe(true);
});
it('prefix check detects divergent ids, revisions and abstentions rather than comparing positions alone', () => {
  let instance = 0;
  const factory = (): Listener => {
    const id = ++instance; let step = 0;
    return { start() {}, feed(_chunk, clock) {
      if (step === 0 && clock >= .1) { step++; return [{ id: 'first', kind: 'unsupported', refersTo: .1 }]; }
      if (step === 1 && clock >= .2) { step++; return [{ id: `revision-${id}`, kind: 'unsupported', refersTo: .1, supersedes: 'first' }]; }
      return [];
    }, finish() { return []; } };
  };
  expect(checkPrefix(factory, score, golden.intended.tempo, new Float32Array(96000).fill(.2), cuts).every(c => !c.pass)).toBe(true);
});
it('the clock floor claims released time even on silence and never clamps to score end', () => {
  const run = execute(clockFollower, score, { bpm: 60, unit: 'quarter' }, new Float32Array(48000 * 9));
  expect(run.record).toHaveLength(900);
  expect(run.record.at(-1)).toMatchObject({ kind: 'position', refersTo: 9, madeAt: 9, confidence: 1, candidates: [{ position: { quarters: { num: 9, den: 1 }, route: 1 }, weight: 1 }] });
  expect(run.record.every(d => d.kind === 'position')).toBe(true);
});
