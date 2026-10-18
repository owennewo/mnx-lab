/**
 * Text that hangs on a barline: the "4x" over a backward repeat and a jump or
 * "fine" placed at the end of a bar both END there, and the bar number of the
 * next bar is CENTRED there — three emitters, three bars' worth of loop, one
 * point on the page. Each is placed without seeing the others, so they met:
 * "To Coda" over "4x" over the "40" (2026-10-18, studio).
 *
 * The settlement is fixed by what each mark is, never by emission order (which
 * differs between the notation and tab layouts):
 * - the repeat count stays put, nearest the barline it counts;
 * - a jump or "fine" stacks above a repeat count it would cover;
 * - the bar number steps off the barline to the bar's own side, where it reads
 *   as the start of its bar, rather than climbing over either;
 * - a jump long enough to reach back over its own bar's number (a narrow bar's
 *   "D.S.S. al Coda") stacks above that number — the number marks where the
 *   bar starts, the jump only where it ends.
 *
 * Boxes are compared whole (x AND y), so a full-document scan cannot mistake
 * the row above for this one: after a wrap the x-range repeats, the y does not.
 */
import { translatePrimitiveY, type Primitive } from '../primitives.ts';
import { computeBoundsSp, type BoundsSp } from '../render/bounds.ts';

/** White between two stacked barline texts. */
const BARLINE_TEXT_STACK_GAP_SP = 0.3;

const isClass = (p: Primitive, classes: readonly string[]) =>
  p.kind === 'text' && p.className !== undefined && classes.includes(p.className);

const meet = (a: BoundsSp, b: BoundsSp) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const boxOf = (p: Primitive) => computeBoundsSp([p]);

/** True when `p` would cover a repeat count, jump or "fine" already drawn. */
export function meetsBarlineText(p: Primitive, drawn: readonly Primitive[]): boolean {
  const box = boxOf(p);
  if (!box) return false;
  return drawn.some(q => q !== p && isClass(q, ['repeat-times', 'jump', 'fine']) && meet(box, boxOf(q)!));
}

/** Lifts `upper` so its bottom ink sits a gap above `lower`'s top ink. */
function stackAbove(upper: Primitive, lower: Primitive): void {
  const u = boxOf(upper);
  const l = boxOf(lower);
  if (!u || !l || !meet(u, l)) return;
  translatePrimitiveY(upper, l.y - BARLINE_TEXT_STACK_GAP_SP - (u.y + u.h));
}

/** A jump or "fine" just drawn: above any repeat count it would cover. */
export function settleJumpText(jump: Primitive, drawn: readonly Primitive[]): void {
  for (const q of drawn) if (isClass(q, ['repeat-times'])) stackAbove(jump, q);
}

/** A repeat count just drawn: any jump or "fine" it meets moves above it. */
export function settleRepeatTimes(times: Primitive, drawn: readonly Primitive[]): void {
  for (const q of drawn) if (q !== times && isClass(q, ['jump', 'fine'])) stackAbove(q, times);
}

/** A bar number just drawn: any jump or "fine" it still meets moves above it. */
export function settleMeasureNumber(number: Primitive, drawn: readonly Primitive[]): void {
  for (const q of drawn) if (q !== number && isClass(q, ['jump', 'fine'])) stackAbove(q, number);
}
