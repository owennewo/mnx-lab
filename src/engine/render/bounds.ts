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
        // Bounds are SQUARE sp — the currency both `x` and `dx` share at
        // ratio 1 — so an ink offset simply adds. (The emitter is where the
        // two part company; see PrimitiveBase.)
        const px = p.x + (p.dx ?? 0);
        const bb = glyphBBox(p.glyph);
        if (bb) {
          // SMuFL bboxes are y-up around the glyph origin; staff coords are y-down.
          const left =
            p.anchor === 'middle' ? px - (bb.w * s) / 2
            : p.anchor === 'end' ? px - (bb.x + bb.w) * s
            : px + bb.x * s;
          grow(left, p.y - (bb.y + bb.h) * s, left + bb.w * s, p.y - bb.y * s);
        } else {
          const em = GLYPH_FONT_SP * s;
          grow(px - em / 2, p.y - em * TEXT_ASCENT, px + em / 2, p.y + em * TEXT_DESCENT);
        }
        break;
      }
      case 'line': {
        const r = p.thickness / 2;
        const a = p.x1 + (p.dx1 ?? 0);
        const b = p.x2 + (p.dx2 ?? 0);
        grow(
          Math.min(a, b) - r,
          Math.min(p.y1, p.y2) - r,
          Math.max(a, b) + r,
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
        const tx = p.x + (p.dx ?? 0);
        const left = p.anchor === 'middle' ? tx - w / 2 : p.anchor === 'end' ? tx - w : tx;
        const top =
          p.baseline === 'middle' ? p.y - p.size / 2
          : p.baseline === 'hanging' ? p.y
          : p.y - p.size * TEXT_ASCENT;
        grow(left, top, left + w, top + p.size);
        break;
      }
      case 'rect':
        grow(p.x + (p.dx ?? 0), p.y, p.x + (p.dx ?? 0) + p.w, p.y + p.h);
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
