// Keeping the selection on screen (src/engine/render/revealScroll.ts).
//
// The viewer scrolls itself, so moving the selection to the next system can
// leave the reader looking at music they are no longer editing. The DOM half
// of the fix needs a browser; the rule it applies does not, and it is the
// half with edges worth pinning: when NOT to scroll is as load-bearing as
// when to — a paint that yanks the page out from under a reader is a worse
// bug than the one this fixes.
import { describe, expect, it } from 'vitest';
import { revealScrollDelta } from '../../src/engine/render/revealScroll.ts';

/** A 600px-tall viewport, the origin at 0 — client coordinates, so `start` is
 *  the top edge on screen rather than a scroll offset. */
const VIEW = { start: 0, end: 600 };
const PAD = 32;

describe('revealing the selection', () => {
  it('leaves a selection alone while it is comfortably in view', () => {
    expect(revealScrollDelta({ start: 200, end: 260 }, VIEW, PAD)).toBe(0);
  });

  it('scrolls up by exactly the shortfall when the selection is above', () => {
    // Top edge 10px into the viewport: 22px short of the padding it asks for.
    expect(revealScrollDelta({ start: 10, end: 70 }, VIEW, PAD)).toBe(-22);
    // Entirely above: the whole gap, plus the context either side.
    expect(revealScrollDelta({ start: -100, end: -40 }, VIEW, PAD)).toBe(-132);
  });

  it('scrolls down by exactly the overshoot when the selection is below', () => {
    expect(revealScrollDelta({ start: 560, end: 620 }, VIEW, PAD)).toBe(52);
  });

  it('treats the padding as an ask, not a promise', () => {
    // A selection nearly as tall as the viewport cannot have 32px either
    // side; it gets half of what is spare rather than an impossible scroll.
    const box = { start: 610, end: 1170 }; // 560 tall, 40 spare
    expect(revealScrollDelta(box, VIEW, PAD)).toBe(590);
    // ...which lands it centred, both edges 20px clear.
    expect(revealScrollDelta({ start: 20, end: 580 }, VIEW, PAD)).toBe(0);
  });

  it('reveals a too-tall selection from its top, never its bottom', () => {
    // 800 tall in a 600 viewport, starting just below the fold. Following the
    // bottom edge would scroll 260 and push the top off the other side; the
    // top alignment wins at 100.
    expect(revealScrollDelta({ start: 100, end: 900 }, VIEW, PAD)).toBe(100);
  });

  it('holds still when the selection already covers the whole viewport', () => {
    // The most in-view a selection can be: scrolling to its top would be a
    // yank in exchange for nothing.
    expect(revealScrollDelta({ start: -200, end: 700 }, VIEW, PAD)).toBe(0);
  });

  it('holds still for a selection resting exactly on its padding', () => {
    expect(revealScrollDelta({ start: 32, end: 100 }, VIEW, PAD)).toBe(0);
    expect(revealScrollDelta({ start: 500, end: 568 }, VIEW, PAD)).toBe(0);
  });
});
