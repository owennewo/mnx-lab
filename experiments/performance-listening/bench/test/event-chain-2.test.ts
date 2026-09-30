import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import { rational } from '../../../../src/audio/time.ts';
import { liveView } from '../../listen/liveView.ts';
import { topOfScore } from '../../listen/positions.ts';
import { partIds } from '../../listen/validate.ts';
import { EventChain1 } from '../src/listeners/eventChain1.ts';
import { EventChain2 } from '../src/listeners/eventChain2.ts';
import { EXPERIMENT } from '../src/io.ts';
import { mixSines, windowNotes } from '../src/ladder/render.ts';
import { writeWav, readWav } from '../src/generate/wav.ts';
import { executeSeam } from '../src/seam/runner.ts';
import { slowedSample } from '../src/stages/slowedBar1.ts';
const score = JSON.parse(readFileSync(resolve(EXPERIMENT, 'sources/s2-two-bar-scale.mnx.json'), 'utf8'));
const c = compilePerformance(score); if (!c.ok) throw new Error('Invalid test score');
const handoff = { from: topOfScore(c.performance), parts: partIds(score), tempo: { quartersPerMinute: rational(90n) }, rate: 1 };
const delivery = { sampleRate: 48000, chunkSamples: 480 };
describe('event-chain@2 causal commitment', () => {
  it('reproduces the old transient skip and prevents it with the registered policy', () => {
    const length = slowedSample(8, 90, 0, 0.9);
    const notes = windowNotes(score, 0, 8, q => slowedSample(q, 90, 0, 0.9), length, 480);
    const audio = readWav(writeWav(mixSines(notes, length, -12, 480, 48000)));
    const old = new EventChain1(), candidate = new EventChain2();
    const a = executeSeam(() => old, score, handoff, audio, delivery);
    const b = executeSeam(() => candidate, score, handoff, audio, delivery);
    const oldShown = liveView(a.record, 2.3), newShown = liveView(b.record, 2.3);
    expect(oldShown?.kind).toBe('position'); expect(newShown?.kind).toBe('position');
    if (oldShown?.kind !== 'position' || newShown?.kind !== 'position') throw new Error('Missing cursor');
    expect(oldShown.candidates[0]!.at.ordinal).toBe(1); // The future G4.
    expect(newShown.candidates[0]!.at.ordinal).toBe(0);
    expect(newShown.candidates[0]!.at.metricOffset).toEqual(rational(3n, 4n)); // The actual F4.
    const musical = (report: ReturnType<EventChain1['assessment']>) => ({ ...report, notes: report.notes.map(({ id: _id, ...note }) => note) });
    expect(musical(candidate.assessment())).toEqual(musical(old.assessment()));
  });
  it('adds one hop for an ordinary acquisition and still holds silence', () => {
    const audio = Float32Array.from({ length: 4800 }, (_, i) => .2 * Math.sin(2 * Math.PI * 261.625565 * i / 48000));
    const a = executeSeam(() => new EventChain1(), score, handoff, audio, delivery);
    const b = executeSeam(() => new EventChain2(), score, handoff, audio, delivery);
    expect(a.record.find(d => d.kind === 'position')!.madeAt).toBe(.03);
    expect(b.record.find(d => d.kind === 'position')!.madeAt).toBe(.04);
    const held = executeSeam(() => new EventChain2(), score, handoff, new Float32Array([...audio, ...new Float32Array(4800)]), delivery);
    expect(held.record.filter(d => d.kind === 'unsupported').length).toBe(1); // Initial unsupported only.
  });
});
