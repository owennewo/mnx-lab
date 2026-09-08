import { it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { compilePerformance, serializePerformance } from '../../src/audio/performance.ts';
import { rational as q } from '../../src/audio/time.ts';
import type { MnxStructure, MnxEvent, MnxSequenceItem } from '../../src/model/mnx.ts';
// @ts-expect-error plain mjs
import { loadCorpus } from '../verify/check-scenarios.mjs';
const n = (id: string, base: MnxEvent['duration']['base'] = 'quarter'): MnxEvent => ({
  id: `e-${id}`,
  duration: { base },
  notes: [{ id, pitch: { step: 'C', octave: 4 } }],
});
const doc = (content: MnxSequenceItem[], other?: MnxSequenceItem[]): MnxStructure => ({
  global: { measures: [{ time: { count: 4, unit: 4 } }] },
  parts: [
    { measures: [{ sequences: [{ content }] }] },
    ...(other ? [{ measures: [{ sequences: [{ content: other }] }] }] : []),
  ],
});
const compile = (d: MnxStructure) => {
  const result = compilePerformance(d);
  if (!result.ok) throw Error(JSON.stringify(result.diagnostics));
  return result.performance;
};
it('compiles the complete valid corpus without crashes and preserves reciprocal links', () => {
  for (const s of loadCorpus()) {
    const meta = JSON.parse(fs.readFileSync(path.join(s.dir, 'meta.json'), 'utf8'));
    if (meta.expect.standard !== 'valid') continue;
    const d = JSON.parse(fs.readFileSync(path.join(s.dir, 'document.mnx.json'), 'utf8'));
    const result = compilePerformance(d);
    expect(result.ok, s.id + ': ' + JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
    if (!result.ok) continue;
    const p = result.performance;
    expect(new Set(p.written.map((w) => w.id)).size, s.id).toBe(p.written.length);
    for (const w of p.written)
      for (const id of w.soundingIds)
        expect(p.sounding.find((v) => v.id === id)?.writtenIds, s.id).toContain(w.id);
    for (const v of p.sounding)
      for (const id of v.writtenIds)
        expect(p.written.find((w) => w.id === id)?.soundingIds, s.id).toContain(v.id);
    expect(serializePerformance(p)).not.toContain('undefined');
  }
});
it('merges a three-note tie after unrolling and retains all written occurrences', () => {
  const notes = [n('a'), n('b'), n('c')];
  notes[0].notes![0].ties = [{ target: 'b' }];
  notes[1].notes![0].ties = [{ target: 'c' }];
  const p = compile(doc(notes));
  expect(p.written).toHaveLength(3);
  expect(p.sounding).toHaveLength(1);
  expect(p.sounding[0].duration).toEqual(q(3n, 4n));
  expect(p.sounding[0].writtenIds).toEqual(['w0:a', 'w0:b', 'w0:c']);
});
it('combines simultaneous fermatas by maximum and gives make-time its own interval', () => {
  const held = n('held');
  held.fermata = { duration: 'long' };
  const held2 = n('held2');
  held2.fermata = { duration: 'long' };
  const grace = {
    type: 'grace' as const,
    graceType: 'makeTime' as const,
    content: [n('g', 'eighth')],
  };
  const p = compile(doc([held, grace, n('principal')], [held2, n('other')]));
  const by = (id: string) => p.written.find((w) => w.noteKey === id)!;
  expect(by('held').duration).toEqual(q(1n, 2n));
  expect(by('held2').duration).toEqual(q(1n, 2n));
  expect(by('g').position).toEqual(q(1n, 2n));
  expect(by('g').duration).toEqual(q(1n, 32n));
  expect(by('principal').position).toEqual(q(17n, 32n));
  expect(by('other').position).toEqual(q(17n, 32n));
});
it('steals from a following pitched neighbour and never from a rest-only gap', () => {
  const grace = { type: 'grace' as const, content: [n('g', 'eighth')] };
  const p = compile(doc([grace, n('a')]));
  expect(p.written.find((w) => w.noteKey === 'a')?.duration).toEqual(q(7n, 32n));
  const silent = compile(doc([grace, { duration: { base: 'quarter' }, rest: {} }]));
  expect(silent.sounding).toHaveLength(0);
  expect(silent.diagnostics.some((d) => d.code === 'missing-grace-neighbour')).toBe(true);
});
it('subdivides single and alternating tremolos without duplicating written occurrences', () => {
  const single = n('s');
  single.markings = { tremolo: { marks: 2 } };
  const p = compile(
    doc([
      single,
      {
        type: 'tremolo',
        marks: 2,
        outer: { duration: { base: 'quarter' }, multiple: 1 },
        content: [n('a'), n('b')],
      },
    ]),
  );
  expect(p.written).toHaveLength(3);
  expect(p.sounding.map((s) => s.writtenIds[0])).toEqual([
    'w0:s',
    'w0:s',
    'w0:s',
    'w0:s',
    'w0:a',
    'w0:b',
    'w0:a',
    'w0:b',
  ]);
});
it('keeps noncontiguous declared string numbers, truncates lv, and preserves conflicting pitches', () => {
  const a = n('a');
  a.notes![0]._x = { mnxLab: { string: 7 } };
  a.notes![0].ties = [{ lv: true }];
  const b = n('b');
  b.notes![0]._x = { mnxLab: { string: 7 } };
  const d = doc([a, b]);
  d.parts[0]._x = { mnxLab: { strings: [{ string: 7, pitch: { step: 'E', octave: 2 } }] } };
  const p = compile(d);
  expect(p.sounding[0].duration).toEqual(q(1n, 4n));
  expect(p.sounding.every((s) => s.voice === 'p0:string:7')).toBe(true);
  b.notes!.push({ ...b.notes![0], id: 'c' });
  const conflict = compile(d);
  expect(conflict.sounding).toHaveLength(3);
  expect(conflict.sounding.find((s) => s.writtenIds.includes('w0:a'))!.duration).toEqual(q(1n, 4n));
  expect(conflict.diagnostics.some((d) => d.code === 'string-conflict')).toBe(true);
});
it('recursively multiplies tuplet ratios without rewriting positional identities', () => {
  const tuple = (content: MnxSequenceItem[]) => ({
    type: 'tuplet' as const,
    inner: { multiple: 3, duration: { base: 'eighth' as const } },
    outer: { multiple: 2, duration: { base: 'eighth' as const } },
    content,
  });
  const p = compile(
    doc([tuple([tuple([n('a', 'eighth'), n('b', 'eighth'), n('c', 'eighth')]), n('d', 'eighth')])]),
  );
  expect(p.written[0].duration).toEqual(q(1n, 18n));
  expect(p.written[1].position).toEqual(q(1n, 18n));
});
it('retains a grace group at a complete bar end and includes terminal fermata time in the measure', () => {
  const p = compile(
    doc([n('a'), { type: 'grace', graceType: 'stealPrevious', content: [n('g', 'eighth')] }]),
  );
  expect(p.written.find((w) => w.noteKey === 'g')?.position).toEqual(q(7n, 32n));
  expect(p.written.find((w) => w.noteKey === 'a')?.duration).toEqual(q(7n, 32n));
  const d = doc([n('a')]);
  d.global.measures[0].fermata = { duration: 'long' };
  const held = compile(d);
  expect(held.measures[0].duration).toEqual(q(1n, 2n));
  expect(held.sounding[0].duration).toEqual(q(1n, 2n));
});
it('merges crossJump only into the actual next return occurrence', () => {
  const source = n('source');
  source.notes![0].ties = [{ target: 'target', targetType: 'crossJump' }];
  const d = doc([n('target')]);
  d.global.measures.push({ repeatEnd: {} });
  d.parts[0].measures.push({ sequences: [{ content: [source] }] });
  const p = compile(d);
  expect(p.measures.map((m) => m.measureIndex)).toEqual([0, 1, 0, 1]);
  expect(p.sounding).toHaveLength(3);
  expect(p.sounding.find((s) => s.writtenIds.includes('w1:source'))?.writtenIds).toEqual([
    'w1:source',
    'w2:target',
  ]);
  expect(p.sounding.find((s) => s.writtenIds.includes('w1:source'))?.duration).toEqual(q(1n, 2n));
});
it('clips a note to a mid-bar return slice and restores written tempo before its segno', () => {
  const d = doc([n('a', 'whole')]);
  d.global.measures[0].segno = { location: { fraction: [1, 2] } };
  d.global.measures[0].tempos = [
    { bpm: 60, value: { base: 'quarter' }, location: { fraction: [1, 4] } },
  ];
  d.global.measures.push({ jump: { type: 'ds', location: { fraction: [1, 1] } } } as never);
  d.parts[0].measures.push({ sequences: [{ content: [n('b', 'whole')] }] });
  const p = compile(d);
  expect(p.measures.map((m) => m.from)).toContainEqual(q(1n, 2n));
  const returned = p.written.find((w) => w.noteKey === 'a' && w.ordinal === 2)!;
  expect(returned.metricOffset).toEqual(q(1n, 2n));
  expect(returned.metricDuration).toEqual(q(1n, 2n));
  expect(p.tempo.at(-1)?.quarterBpm).toEqual(q(60n));
});
it('holds the shortened principal before a stealPrevious grace, rather than holding the grace', () => {
  const principal = n('a');
  principal.fermata = { duration: 'long' };
  const p = compile(
    doc([principal, { type: 'grace', graceType: 'stealPrevious', content: [n('g', 'eighth')] }]),
  );
  expect(p.written.find((w) => w.noteKey === 'a')?.duration).toEqual(q(7n, 16n));
  expect(p.written.find((w) => w.noteKey === 'g')?.position).toEqual(q(7n, 16n));
  expect(p.written.find((w) => w.noteKey === 'g')?.duration).toEqual(q(1n, 32n));
});
it('stealing from a tremolo trims every alternating child on its original subdivision grid', () => {
  const p = compile(
    doc([
      { type: 'grace', content: [n('g', 'eighth')] },
      {
        type: 'tremolo',
        marks: 2,
        outer: { multiple: 1, duration: { base: 'quarter' } },
        content: [n('a'), n('b')],
      },
    ]),
  );
  expect(p.sounding.find((s) => s.writtenIds[0] === 'w0:a')?.position).toEqual(q(1n, 32n));
  expect(p.sounding.find((s) => s.writtenIds[0] === 'w0:a')?.duration).toEqual(q(1n, 32n));
  expect(p.sounding.find((s) => s.writtenIds[0] === 'w0:b')?.position).toEqual(q(1n, 16n));
});
