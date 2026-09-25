import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { decisionFromJSON, decisionToJSON, type DecisionJSON } from '../json.ts';
import { liveView } from '../liveView.ts';
import { validateRecord } from '../validate.ts';

const score = JSON.parse(readFileSync(new URL('../../sources/s2-two-bar-scale.mnx.json', import.meta.url), 'utf8')) as MnxStructure;
const compiled = compilePerformance(score); if (!compiled.ok) throw new Error('compile');
const fixture = JSON.parse(readFileSync(new URL('./fixtures/note-verdicts.decisions.json', import.meta.url), 'utf8')) as DecisionJSON[];
const record = fixture.map(decisionFromJSON);

describe('the note-verdict shape (unscored until the assessment milestone)', () => {
  it('carries every verdict in one valid oracle record, positions within the score', () => {
    validateRecord(record, compiled.performance);
    const verdicts = new Set(record.flatMap(d => d.kind === 'note' ? [d.verdict] : []));
    expect([...verdicts].sort()).toEqual(['duration', 'extra', 'match', 'missing', 'substitution', 'timing']);
    expect(record.map(decisionToJSON)).toEqual(fixture);
  });
  it('keeps a missing note that became a late match visible in hindsight', () => {
    const revision = record.find(d => d.id === 'n-missing-late')!;
    expect(revision.supersedes).toBe('n-missing');
    expect(record.some(d => d.id === 'n-missing')).toBe(true);
  });
  it('never lets a verdict move the cursor', () => {
    expect(liveView(record, 10)?.id).toBe('p1');
  });
  it('rejects malformed notes', () => {
    const note = record.find(d => d.id === 'n-match')!;
    const bad = (patch: object) => () => validateRecord([{ ...note, ...patch } as typeof note], compiled.performance);
    expect(bad({ verdict: 'wrong' })).toThrow(/verdict/);
    expect(bad({ noteKey: null })).toThrow(/extra/);
    expect(bad({ verdict: 'extra' })).toThrow(/extra/);
    expect(bad({ timingErrorSeconds: Number.NaN })).toThrow(/measures/);
    expect(bad({ at: { ordinal: 9, metricOffset: note.kind === 'note' ? note.at.metricOffset : null } })).toThrow(/outside/);
  });
});
