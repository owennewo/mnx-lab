import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import { positionFromJSON } from '../../listen/json.ts';
import type { AssessmentReport2 } from '../src/events/assessment2.ts';
import { scoreEvents } from '../src/events/label.ts';
import { promoteReport030 } from '../src/stages/report030.ts';
import { assetPath } from '../src/stages/stage1v2.ts';

describe('030 diagnostic report promotion', () => {
  const score = JSON.parse(readFileSync(assetPath('sources/s2-two-bar-scale.mnx.json'), 'utf8'));
  const compiled = compilePerformance(score);
  if (!compiled.ok) throw new Error('Score fixture does not compile');
  const events = scoreEvents(compiled.performance).map(e => positionFromJSON(e.at));
  const makeReport = (): AssessmentReport2 => ({ format: 'assessment-report@2', notes: [], tempo: {
    overall: 60, intervals: events.slice(1).map((to, k) => ({ from: events[k]!, to, seconds: k < 3 ? 1 : 2 })),
    flags: [{ ordinal: 1, direction: 'slow' }] } });

  it('preserves an obsolete flag on an ineligible short bar, and all original musical output', () => {
    const raw = makeReport(), before = structuredClone(raw), promoted = promoteReport030(raw, score);
    const { bars: _bars, ...tempo } = promoted.tempo;
    expect({ ...promoted, format: 'assessment-report@2', tempo }).toEqual(before);
    expect(promoted.tempo.bars).toHaveLength(2);
    expect(promoted.tempo.bars.every(b => !b.eligible && b.otherBars === 1)).toBe(true);
    expect(raw).toEqual(before);
    promoted.tempo.flags.length = 0;
    expect(raw.tempo.flags).toHaveLength(1);
  });

  it('adds null informational summaries without inventing tempo on a control report', () => {
    const raw: AssessmentReport2 = { format: 'assessment-report@2', notes: [], tempo: { overall: null, intervals: [], flags: [] } };
    const promoted = promoteReport030(raw, score);
    expect(promoted.tempo.overall).toBeNull();
    expect(promoted.tempo.flags).toEqual([]);
    expect(promoted.tempo.bars.every(b => b.quartersPerMinute === null && b.reference === null && b.ratio === null && !b.eligible)).toBe(true);
  });
});
