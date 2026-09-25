import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePerformance } from '../../../../src/audio/performance.ts';
import { PlaybackSession } from '../../../../src/audio/playbackSession.ts';
import { rational } from '../../../../src/audio/time.ts';
import type { MnxStructure } from '../../../../src/model/mnx.ts';
import { ListeningBackend, type ListeningSnapshot } from '../backend.ts';
import type { Decision, ScorePosition } from '../contract.ts';
import { topOfScore } from '../positions.ts';

const score = JSON.parse(readFileSync(new URL('../../sources/s2-two-bar-scale.mnx.json', import.meta.url), 'utf8')) as MnxStructure;
const compiled = compilePerformance(score); if (!compiled.ok) throw new Error('compile');
const performance = compiled.performance;
const at = (ordinal: number, quarters: bigint): ScorePosition => ({ ordinal, metricOffset: rational(quarters, 4n) });
const position = (id: string, t: number, where: ScorePosition): Decision => ({ id, kind: 'position', refersTo: t, madeAt: t, confidence: 0.9, candidates: [{ at: where, weight: 1 }] });

function setup() {
  const started: ScorePosition[] = [];
  const host = { canStartAt: (p: ScorePosition) => p.ordinal === 1 ? 'This listener starts only in the first bar.' : null, startAt: (p: ScorePosition) => { started.push(p); } };
  const backends: ListeningBackend[] = [];
  const make = (id: string) => { const b = new ListeningBackend(id, performance, host, topOfScore(performance)); backends.push(b); return b; };
  const session = new PlaybackSession(make('listening'), make, () => {});
  const snap = () => session.snapshot as unknown as ListeningSnapshot;
  return { session, started, backend: () => session.backend as ListeningBackend, snap, backends };
}

describe('ListeningBackend inside Studio\'s PlaybackSession', () => {
  it('starts a listening session at the top, follows decisions and highlights the written note', async () => {
    const { session, started, backend, snap } = setup();
    expect(snap().listening.phase).toBe('warming');
    await session.play();
    expect(started).toEqual([topOfScore(performance)]);
    backend().receive(position('a', 0.1, at(0, 1n))); backend().advance(0.1);
    expect(snap().state).toBe('playing');
    expect(snap().scorePosition).toEqual(at(0, 1n));
    expect(snap().highlight.length).toBe(1);
    expect(snap().listening.phase).toBe('following');
  });

  it('holds the position while paused, ignores what arrives meanwhile, and resumes without restarting', async () => {
    const { session, started, backend, snap } = setup();
    await session.play();
    backend().receive(position('a', 0.1, at(0, 1n))); backend().advance(0.1);
    session.pause();
    backend().receive(position('b', 0.2, at(0, 2n))); backend().advance(0.2);
    expect(snap().state).toBe('paused');
    expect(snap().scorePosition).toEqual(at(0, 1n));
    await session.play();
    expect(started.length).toBe(1);
    backend().receive(position('c', 0.3, at(0, 3n))); backend().advance(0.3);
    expect(snap().scorePosition).toEqual(at(0, 3n));
  });

  it('seeks by starting a fresh session there, and reports a refusal as an alignment issue', async () => {
    const { session, started, snap } = setup();
    await session.play();
    expect(await session.seek(at(0, 2n))).toBe(true);
    expect(started.at(-1)).toEqual(at(0, 2n));
    expect(snap().scorePosition).toBeNull();
    expect(snap().listening.phase).toBe('warming');
    expect(await session.seek(at(1, 0n))).toBe(false);
    expect(session.snapshot.alignmentIssue).toMatch(/first bar/);
  });

  it('shows no position when the listener loses the performance, and none once stopped', async () => {
    const { session, backend, snap } = setup();
    await session.play();
    backend().receive(position('a', 0.1, at(0, 1n)));
    backend().receive({ id: 'u', kind: 'unsupported', refersTo: 0.2, madeAt: 0.2 }); backend().advance(0.2);
    expect(snap().scorePosition).toBeNull();
    expect(snap().listening.phase).toBe('lost');
    session.stop();
    expect(snap().state).toBe('stopped');
    expect(snap().scorePosition).toBeNull();
  });

  it('hands its position to a newly selected listening source', async () => {
    const { session, started, backend, backends } = setup();
    await session.play();
    backend().receive(position('a', 0.1, at(0, 2n))); backend().advance(0.1);
    expect(await session.select('listening-2')).toBe(true);
    expect(backends.length).toBe(2);
    expect(session.backend.id).toBe('listening-2');
    expect(started.at(-1)).toEqual(at(0, 2n));
  });
});
