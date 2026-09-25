/** Replays a recorded version-2 stream through the seam Studio will use: ListeningBackend
 * inside Studio's PlaybackSession. At every grid point the evaluator scored, the cursor
 * Studio would draw must be exactly the scored decision's heaviest position, and there must
 * be no cursor where that decision is unsupported or absent. A check on the seam, never a
 * candidate metric. */
import type { Performance } from '../../../../../src/audio/performanceTypes.ts';
import { PlaybackSession } from '../../../../../src/audio/playbackSession.ts';
import { heaviest, ListeningBackend } from '../../../listen/backend.ts';
import type { Decision, ScorePosition } from '../../../listen/contract.ts';
import { samePosition, topOfScore } from '../../../listen/positions.ts';

export interface ReplayResult { checked: number; failures: string[] }

export async function replayThroughSeam(performance: Performance, record: readonly Decision[], scored: readonly { time: number; decision: string | null }[]): Promise<ReplayResult> {
  const host = { canStartAt: () => null, startAt: () => {} };
  const backend = new ListeningBackend('listening', performance, host, topOfScore(performance));
  const session = new PlaybackSession(backend, () => { throw new Error('No other source in a replay'); }, () => {});
  await session.play();
  const byId = new Map(record.map(d => [d.id, d]));
  const failures: string[] = [];
  let next = 0;
  for (const p of [...scored].sort((a, b) => a.time - b.time)) {
    while (next < record.length && record[next]!.madeAt <= p.time) backend.receive(record[next++]!);
    backend.advance(p.time);
    const shown = session.snapshot.scorePosition, decision = p.decision === null ? undefined : byId.get(p.decision);
    const expected: ScorePosition | null = decision?.kind === 'position' ? heaviest(decision) : null;
    if ((shown === null) !== (expected === null) || (shown && expected && !samePosition(shown, expected))) {
      failures.push(`t=${p.time}: drew ${shown ? `${shown.ordinal}+${shown.metricOffset.num}/${shown.metricOffset.den}` : 'nothing'} for ${p.decision ?? 'no decision'}`);
    }
  }
  session.dispose();
  return { checked: scored.length, failures };
}
