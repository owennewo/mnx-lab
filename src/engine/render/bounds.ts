import { Primitive } from '../primitives.ts';
import { glyphBBox } from '../smufl/smufl.ts';

/**
 * Tight content bounding box of a primitive list, in staff spaces — the layout
 * rows reserve generous fixed padding (ledger/stem headroom), so callers that
 * want a snug viewport (preview cards, embeds) crop to this instead.
 *
 * Glyph extents come from the font's SMuFL bounding boxes; text extents are
 * approximated from the font size (close enough for a crop with padding).
 */

/**
 * Breathing room a renderer leaves around the cropped content, in staff
 * spaces — the SVG's own page margin.
 *
 * **1 → 0.5 on 2026-08-21**, and defined here rather than three times over in
 * the three renderers, which is how it came to be doing a job it was not
 * needed for. The paper card already sets a page margin in CSS (30px), so the
 * two stacked: the reader saw both. Worse, this one is in staff spaces and so
 * SCALES WITH ZOOM — 10px at 100%, 20px at 204%, 64px at 640% — so the top
 * margin grew the further a low-vision reader zoomed in, which is exactly
 * when they have least screen to spare.
 *
 * What it still has to do is cover the error in the measurement it pads:
 * text extents here are estimated from the font size (`TEXT_ASCENT`), not
 * measured, so ink can reach slightly past the box. 0.5sp leaves an ascender
 * a quarter of an em of slack before anything could clip, and matches
 * `MIN_PAGE_MARGIN_SP`, the floor the layout already uses for the same idea.
 */
export const CROP_PAD_SP = 0.5;

export interface BoundsSp {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Em-relative fallbacks for text (and glyphs missing a bbox entry). */
const TEXT_ASCENT = 0.75;
const TEXT_DESCENT = 0.25;
const TEXT_ADVANCE = 0.6;
const GLYPH_FONT_SP = 4; // glyph font-size in sp at scale 1 (mirrors svg.ts)

export function computeBoundsSp(
  primitives: readonly Primitive[],
  padSp = 0
): BoundsSp | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x0: number, y0: number, x1: number, y1: number) => {
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  };

  for (const p of primitives) {
    switch (p.kind) {
      case 'glyph': {
        const s = p.scale ?? 1;
        const bb = glyphBBox(p.glyph);
        if (bb) {
          // SMuFL bboxes are y-up around the glyph origin; staff coords are y-down.
          const left =
            p.anchor === 'middle' ? p.x - (bb.w * s) / 2
            : p.anchor === 'end' ? p.x - (bb.x + bb.w) * s
            : p.x + bb.x * s;
          grow(left, p.y - (bb.y + bb.h) * s, left + bb.w * s, p.y - bb.y * s);
        } else {
          const em = GLYPH_FONT_SP * s;
          grow(p.x - em / 2, p.y - em * TEXT_ASCENT, p.x + em / 2, p.y + em * TEXT_DESCENT);
        }
        break;
      }
      case 'line': {
        const r = p.thickness / 2;
        grow(
          Math.min(p.x1, p.x2) - r,
          Math.min(p.y1, p.y2) - r,
          Math.max(p.x1, p.x2) + r,
          Math.max(p.y1, p.y2) + r
        );
        break;
      }
      case 'curve': {
        // Control-point hull contains the bézier — fine for a padded crop.
        const xs = p.points.map(pt => pt.x);
        const ys = p.points.map(pt => pt.y);
        const r = p.thickness / 2;
        grow(Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r);
        break;
      }
      case 'text': {
        const w = p.text.length * p.size * TEXT_ADVANCE;
        const left = p.anchor === 'middle' ? p.x - w / 2 : p.anchor === 'end' ? p.x - w : p.x;
        const top =
          p.baseline === 'middle' ? p.y - p.size / 2
          : p.baseline === 'hanging' ? p.y
          : p.y - p.size * TEXT_ASCENT;
        grow(left, top, left + w, top + p.size);
        break;
      }
      case 'rect':
        grow(p.x, p.y, p.x + p.w, p.y + p.h);
        break;
    }
  }

  if (minX === Infinity) return null;
  return {
    x: minX - padSp,
    y: minY - padSp,
    w: maxX - minX + 2 * padSp,
    h: maxY - minY + 2 * padSp
  };
}
