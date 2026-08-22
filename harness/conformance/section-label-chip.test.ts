import { describe, expect, it } from 'vitest';
import { sectionLabelChips } from '../../src/engine/render/selectionGeometry.ts';
import type { SelectionRectGeometry } from '../../src/engine/render/selectionGeometry.ts';

/** One system's panel-wide band, barline to barline. */
const band = (x: number, width: number): SelectionRectGeometry => ({
  x,
  y: 0,
  width,
  height: 40
});

/** A label anchored at `x`, sitting inside the band's upper strip. */
const label = (x: number, width = 12): SelectionRectGeometry => ({
  x,
  y: 4,
  width,
  height: 6
});

describe('the section rung lights the labels it encloses', () => {
  it('claims a label anchored inside the band', () => {
    expect(sectionLabelChips([band(0, 100)], [label(10)], 4)).toHaveLength(1);
  });

  it('leaves a label in a bar the selection does not cover', () => {
    expect(sectionLabelChips([band(0, 50)], [label(60)], 4)).toEqual([]);
  });

  it('pads the chip around the label on both axes', () => {
    const [chip] = sectionLabelChips([band(0, 100)], [label(10, 12)], 4);
    expect(chip).toEqual({ x: 10 - 1.8, y: 4 - 1.2, width: 12 + 3.6, height: 6 + 2.4 });
  });

  it('claims a long name by its anchor, not its box', () => {
    // `emitScoreLabels` lets a long section name overhang its cell on
    // purpose. A box-containment test would drop exactly the sections whose
    // names are worth reading, so the anchor decides.
    const overhanging = label(10, 400);
    expect(sectionLabelChips([band(0, 100)], [overhanging], 4)).toHaveLength(1);
  });

  it('lights one label per system band and ignores the empty ones', () => {
    // A section wrapping onto a second system draws a band per system; the
    // label exists only where the section is declared.
    const bands = [band(0, 100), { ...band(0, 100), y: 60 }];
    expect(sectionLabelChips(bands, [label(10)], 4)).toHaveLength(1);
  });

  it('is inert with no enclosure and with no labels', () => {
    expect(sectionLabelChips([], [label(10)], 4)).toEqual([]);
    expect(sectionLabelChips([band(0, 100)], [], 4)).toEqual([]);
  });
});
