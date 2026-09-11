import type { MnxPart } from './mnx.ts';

/**
 * Octaves a part is WRITTEN above its sounding pitch, for display — a guitar
 * is 1. MNX pitch is sounding; `part.transposition` says how the part is
 * written, and `prefersWrittenPitches` says to show that even in a
 * concert-pitch score, the only kind the engine draws.
 *
 * Only a whole-octave interval is honoured: it moves noteheads and nothing
 * else. Any other interval would also transpose the key signature, which the
 * engine does not do, so such a part stays at concert pitch.
 */
export function writtenOctaves(part: Pick<MnxPart, 'transposition'> | undefined): number {
  const transposition = part?.transposition;
  if (!transposition?.prefersWrittenPitches) return 0;
  const { halfSteps, staffDistance } = transposition.interval;
  return halfSteps % 12 === 0 && staffDistance === (halfSteps / 12) * 7 ? halfSteps / 12 : 0;
}
