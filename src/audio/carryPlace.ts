/**
 * Where playback continues when the score under it changes (core-player-live-edit).
 * A place is carried by SCORE position — bar and offset — because positions in
 * performance time may have shifted; the state goes with it. A stopped transport,
 * a place the old performance cannot name, or a bar past the new score's last
 * carries nothing: the caller starts at the beginning, stopped. The end of the
 * score resolves as a position, so it is excluded by ordinal on purpose.
 */
import type { Performance } from './performanceTypes.ts';
import type { Rational } from './time.ts';
import { performancePositionAt, scorePositionAt } from './scorePosition.ts';

export interface CarriedPlace { readonly position: Rational; readonly state: 'playing' | 'paused' }

export function carryPlace(
  before: { readonly state: 'stopped' | 'paused' | 'playing'; readonly position: Rational },
  from: Performance, to: Performance,
): CarriedPlace | null {
  if (before.state === 'stopped') return null;
  const place = scorePositionAt(from, before.position);
  if (!place.ok || place.value.ordinal >= to.measures.length) return null;
  const target = performancePositionAt(to, place.value);
  return target.ok ? { position: target.value, state: before.state } : null;
}
