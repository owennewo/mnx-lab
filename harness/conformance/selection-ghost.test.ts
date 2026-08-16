import { describe, expect, it } from 'vitest';
import {
  emptyPartGhostRect,
  measurePositionX
} from '../../src/engine/render/selectionGeometry.ts';

describe('selection ghost geometry', () => {
  it('places silent cursor moments inside the measure cell', () => {
    expect(measurePositionX(10, 30, 0, 1)).toBeCloseTo(11.2);
    expect(measurePositionX(10, 30, 0.5, 1)).toBeCloseTo(20);
    expect(measurePositionX(10, 30, 1, 1)).toBeCloseTo(28.8);
  });

  it('clamps stale onsets and scales the inset down in a narrow cell', () => {
    expect(measurePositionX(10, 12, -1, 1)).toBeCloseTo(10.36);
    expect(measurePositionX(10, 12, 2, 1)).toBeCloseTo(11.64);
  });

  it('draws a compact measure vacancy inside a blank score viewport', () => {
    expect(emptyPartGhostRect({ x: 0, y: 0, width: 600, height: 140 }, 10)).toEqual({
      x: 20,
      y: 40,
      width: 140,
      height: 60
    });

    const narrow = emptyPartGhostRect({ x: 5, y: 10, width: 60, height: 40 }, 10);
    expect(narrow.x).toBeGreaterThanOrEqual(5);
    expect(narrow.y).toBeGreaterThanOrEqual(10);
    expect(narrow.x + narrow.width).toBeLessThanOrEqual(65);
    expect(narrow.y + narrow.height).toBeLessThanOrEqual(50);
  });
});
