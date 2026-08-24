/**
 * Keeping the selection on screen, as arithmetic.
 *
 * The viewer is its own scroll container (`:host { overflow: auto }`), so a
 * selection that moves to the next system — or a re-layout that moves the
 * system out from under a selection standing still — can leave the reader
 * looking at music they are no longer editing. `elements/ScoreViewer.ts` owns
 * the DOM half of the fix: which box, which scroller, when to ask.
 *
 * The rule it applies is pure arithmetic, and it lives here beside
 * `enclosureTransition.ts` for that module's reason — the harness exercises
 * machinery headlessly and may not reach into `elements/`, so presentation
 * geometry worth pinning is kept where a test can reach it.
 *
 * One axis, on purpose: `#score-container svg` carries `max-width: 100%`, so
 * the drawing is scaled down to the pane rather than scrolled sideways. There
 * is no horizontal scroll to follow.
 */

/** A one-dimensional extent in client pixels — a box's top/bottom, or the
 *  viewport's. */
export interface RevealSpan {
  start: number;
  end: number;
}

/**
 * How far to scroll (positive = down) so `box` sits inside `view` with `pad`
 * of context either side. Zero when it already does — this never scrolls a
 * selection that is merely somewhere unusual in the viewport, only one that
 * is off it, so a paint the reader did not ask about cannot yank the page.
 *
 * `pad` is an ask, not a promise: it shrinks to whatever the viewport can
 * spare, and vanishes for a selection taller than the viewport. Such a
 * selection is revealed from its TOP — the end you read from — but only when
 * it does not already cover the whole viewport, because a selection filling
 * the screen is the most in-view a selection can be.
 */
export function revealScrollDelta(box: RevealSpan, view: RevealSpan, pad: number): number {
  // Already spanning the whole viewport: there is nothing to bring into it.
  if (box.start <= view.start && box.end >= view.end) return 0;

  const available = view.end - view.start;
  const height = box.end - box.start;
  const spare = Math.max(0, Math.min(pad, (available - height) / 2));

  const above = box.start - spare - view.start;
  if (above < 0) return above;

  const below = box.end + spare - view.end;
  // `box.start - view.start` is top alignment: the clamp that stops a tall
  // selection's bottom edge from pushing its top off the other side.
  if (below > 0) return Math.min(below, box.start - view.start);

  return 0;
}
