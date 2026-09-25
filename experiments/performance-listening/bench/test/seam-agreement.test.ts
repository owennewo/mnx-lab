import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { liveView } from '../../listen/liveView.ts';
import { evaluate } from '../src/evaluate/index.ts';
import type { Decision, Golden } from '../src/types.ts';

const read = <T>(url: URL) => JSON.parse(readFileSync(url, 'utf8')) as T;
const oracle = new URL('../oracle/', import.meta.url), experiment = new URL('../../', import.meta.url);
const cases: { name: string; golden: Golden; record: Decision[] }[] = [
  ...readdirSync(oracle, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => ({
    name: `oracle ${d.name}`, golden: read<Golden>(new URL(`${d.name}/golden.json`, oracle)), record: read<Decision[]>(new URL(`${d.name}/decisions.json`, oracle)) })),
  ...['p1', 'p2', 't1-tempo-90', 'c1-silence', 'c2-wrong-piece'].map(id => ({
    name: `g001 ${id}`, golden: read<Golden>(new URL(`sets/harness-v1/${id}/golden.json`, experiment)), record: read<Decision[]>(new URL(`runs/g001-clock-harness-v1/${id}.decisions.json`, experiment)) })),
];

describe('the display rule agrees with the frozen evaluator', () => {
  for (const c of cases) it(`on ${c.name}, at every grid point`, () => {
    const points = evaluate(c.golden, c.record).asDecided.points;
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) expect(liveView(c.record, p.time)?.id ?? null).toBe(p.decision);
  });
});
