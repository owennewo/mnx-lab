/** The one display rule: what a player is shown at a given clock. Studio draws exactly this,
 * and the evaluator scores exactly this; the agreement test holds them together.
 *
 * Among statements already made (madeAt ≤ clock) about times already heard (refersTo ≤
 * clock), the one about the latest time stands; between statements about the same time,
 * the one made last. A statement stands until replaced: the view is held, never
 * extrapolated. Note verdicts are not positions and never move the cursor. */
export interface Timed { kind: string; refersTo: number; madeAt: number }
export function liveView<D extends Timed>(record: readonly D[], clock: number): D | undefined {
  let shown: D | undefined;
  for (const d of record) {
    if (d.kind === 'note' || d.refersTo > clock || d.madeAt > clock) continue;
    if (!shown || d.refersTo > shown.refersTo || (d.refersTo === shown.refersTo && d.madeAt >= shown.madeAt)) shown = d;
  }
  return shown;
}
