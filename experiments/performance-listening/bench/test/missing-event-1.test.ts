import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import { perfectLabel, LABEL_FORMAT_2 } from '../src/events/label.ts';
import { expectedAssessment3 } from '../src/events/assessment3.ts';
import { EXPERIMENT } from '../src/io.ts';
import { windowNotes } from '../src/ladder/render.ts';
import { omissionLabel } from '../src/stages/missingEvent1.ts';
describe('one interior omission stimulus', () => {
  it('keeps the beat, holds the predecessor and spans two quarters across a bar boundary', () => {
    const score = JSON.parse(readFileSync(join(EXPERIMENT, 'sources/s2-two-bar-scale.mnx.json'), 'utf8'));
    const c = compilePerformance(score); if (!c.ok) throw new Error('Score');
    const rendered = windowNotes(score, 0, 8, q => q * 48000, 8 * 48000, 480);
    const audio = { path: 'test.wav', sampleRate: 48000, samples: 8 * 48000, sha256: '0'.repeat(64) };
    const parent = perfectLabel({ id: 'test', performance: c.performance, score: { path: 'test', sha256: '0'.repeat(64) }, handedQuartersPerMinute: 90,
      duration: 8, audio, rendered, sampleRate: 48000, recipe: {}, format: LABEL_FORMAT_2 });
    for (const index of [3, 4]) {
      const label = omissionLabel(parent, index, 'missing', audio), a = expectedAssessment3(label);
      expect(label.performance.events[index]!.onset).toBeNull();
      expect(label.performance.events[index + 1]!.onset).toBe(index + 1);
      expect(label.cursor.segments.find(s => s.from === index)).toBeUndefined();
      expect(label.cursor.segments.find(s => s.from === index - 1)?.truth).toBe(index - 1);
      expect(a.intervals.find(i => i.from === index - 1 && i.to === index + 1)).toMatchObject({ quarters: 2, seconds: 2, quartersPerMinute: 60 });
      expect(a.notes.filter(n => n.outcome === 'missing')).toHaveLength(1);
      expect(a.bars.every(b => b.expected === 'none')).toBe(true);
    }
    expect(parent.performance.events.every(p => p.onset !== null)).toBe(true);
    expect(() => omissionLabel(parent, 0, 'bad', audio)).toThrow();
    expect(() => omissionLabel(parent, 7, 'bad', audio)).toThrow();
  });
});
