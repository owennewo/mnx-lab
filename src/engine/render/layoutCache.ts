/**
 * The square layout, remembered across a zoom gesture.
 *
 * Every renderer lays out twice when the staff is scaled: once square, to
 * find the fit, and again at the ink ratio (core-ink-priced-columns.md). The
 * square pass depends on nothing the staff scale changes, so across a drag
 * that only moves `staffScale` it is the same answer every frame — measured
 * at ~170ms of the ~300ms a zoomed paint of a 61-bar score costs
 * (core-touch-gestures.md, *Performance, measured*).
 *
 * The cache is OWNED BY THE CALLER and passed in, never module state: a
 * memo keyed on object identity is only safe while the caller can vouch
 * that the document has not been mutated in place, and the viewer can vouch
 * for that exactly for the length of a gesture. Outside one it passes
 * nothing and every paint is computed, as before.
 */
import type { LayoutResult } from '../primitives.ts';

export interface LayoutCache {
  key: string | null;
  mnx: unknown;
  entries: unknown;
  square: LayoutResult | null;
}

export function createLayoutCache(): LayoutCache {
  return { key: null, mnx: null, entries: null, square: null };
}

/**
 * The square layout for `args`, from the cache when it holds one for these
 * exact inputs. The document and the entries are compared by identity, the
 * rest by value — they are small, and the JSON is cheaper than a miss.
 */
export function squareLayout<A extends { mnx: unknown; entries?: unknown }>(
  cache: LayoutCache | undefined,
  args: A,
  compute: () => LayoutResult
): LayoutResult {
  if (!cache) return compute();
  const { mnx, entries, ...rest } = args;
  const key = JSON.stringify(rest);
  if (cache.square && cache.mnx === mnx && cache.entries === entries && cache.key === key) {
    return cache.square;
  }
  const square = compute();
  cache.mnx = mnx;
  cache.entries = entries;
  cache.key = key;
  cache.square = square;
  return square;
}
