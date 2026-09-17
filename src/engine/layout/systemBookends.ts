import type { Primitive, RowBandSp } from '../primitives.ts';

export interface SystemBookend {
  label: string;
  title: string;
}

export interface SystemBookends {
  leading?: SystemBookend;
  trailing?: SystemBookend;
}

export const SYSTEM_BOOKEND_WIDTH_SP = 9;
const SYSTEM_BOOKEND_GAP_SP = 0.5;

export function systemBookendInsetSp(bookend: SystemBookend | undefined): number {
  return bookend ? SYSTEM_BOOKEND_WIDTH_SP + SYSTEM_BOOKEND_GAP_SP : 0;
}

/** Add host-labelled, system-height regions outside the first/last music.
 * The seam is deliberately generic: layout knows neither recordings nor
 * sync maps, only that the host requested leading/trailing bookends. */
export function appendSystemBookends(
  primitives: Primitive[],
  displays: readonly (readonly RowBandSp[])[],
  bookends: SystemBookends | undefined
): void {
  if (!bookends || displays.length === 0) return;

  const edge = (bands: readonly RowBandSp[], side: 'leading' | 'trailing'): number | null => {
    const top = Math.min(...bands.map(b => b.staffTop));
    const bottom = Math.max(...bands.map(b => b.staffBottom));
    const xs: number[] = [];
    for (const primitive of primitives) {
      if (primitive.kind !== 'line' || primitive.className !== 'staff-line') continue;
      if (primitive.y1 < top - 0.01 || primitive.y1 > bottom + 0.01) continue;
      xs.push(primitive.x1, primitive.x2);
    }
    return xs.length ? (side === 'leading' ? Math.min(...xs) : Math.max(...xs)) : null;
  };

  const add = (side: 'leading' | 'trailing', bookend: SystemBookend, bands: readonly RowBandSp[]) => {
    const musicEdge = edge(bands, side);
    if (musicEdge === null) return;
    const top = Math.min(...bands.map(b => b.staffTop));
    const bottom = Math.max(...bands.map(b => b.staffBottom));
    const x = side === 'leading'
      ? musicEdge - SYSTEM_BOOKEND_GAP_SP - SYSTEM_BOOKEND_WIDTH_SP
      : musicEdge + SYSTEM_BOOKEND_GAP_SP;
    const className = `recording-bookend recording-bookend-${side}`;
    primitives.push({ kind: 'rect', x, y: top, w: SYSTEM_BOOKEND_WIDTH_SP, h: bottom - top,
      radius: 0.15, className: `${className} recording-bookend-block`, title: bookend.title });
    primitives.push({ kind: 'text', text: bookend.label, x: x + SYSTEM_BOOKEND_WIDTH_SP / 2,
      y: (top + bottom) / 2, font: 'body', size: 1.45, anchor: 'middle', baseline: 'central',
      className: `${className} recording-bookend-label`, title: bookend.title });
  };

  if (bookends.leading) add('leading', bookends.leading, displays[0]);
  if (bookends.trailing) add('trailing', bookends.trailing, displays[displays.length - 1]);
}
