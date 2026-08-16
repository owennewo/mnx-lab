import { describe, expect, it } from 'vitest';
import {
  pairEnclosureRects,
  sameEnclosureRects,
  type EnclosureRectGeometry
} from '../../src/engine/render/enclosureTransition.ts';

const rect = (x: number): EnclosureRectGeometry => ({
  x,
  y: 0,
  width: 10,
  height: 10,
  radius: 1,
  stroke: 0.1
});

describe('selection enclosure tween topology', () => {
  it('distinguishes a same-kind extent change from an unchanged redraw', () => {
    const panel = rect(0);
    expect(sameEnclosureRects([panel], [{ ...panel }])).toBe(true);
    expect(sameEnclosureRects([panel], [rect(20)])).toBe(false);
    expect(sameEnclosureRects([panel], [panel, rect(20)])).toBe(false);
  });

  it('duplicates one fine-rung shape when it widens into projection echoes', () => {
    const from = rect(0);
    const targets = [rect(10), rect(20)];
    expect(pairEnclosureRects([from], targets)).toEqual([
      { from, to: targets[0] },
      { from, to: targets[1] }
    ]);
  });

  it('converges both projection echoes when the wider rung becomes one panel', () => {
    const sources = [rect(10), rect(20)];
    const to = rect(0);
    expect(pairEnclosureRects(sources, [to])).toEqual([
      { from: sources[0], to },
      { from: sources[1], to }
    ]);
  });

  it('keeps fragment order stable when wrapped ranges change topology', () => {
    const sources = [rect(0), rect(10)];
    const targets = [rect(20), rect(30), rect(40)];
    expect(pairEnclosureRects(sources, targets)).toEqual([
      { from: sources[0], to: targets[0] },
      { from: sources[0], to: targets[1] },
      { from: sources[1], to: targets[2] }
    ]);
  });
});
