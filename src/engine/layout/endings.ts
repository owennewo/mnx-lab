/**
 * Voltas (first/second endings) — a bracket over the bars an `ending` covers,
 * split at system breaks, on notation and on the standalone tab staff alike
 * (core-measure-attributes-gaps.md, item 5). Moved out of notation.ts as it
 * stood, so the notation goldens did not move.
 */
import type { MnxStructure } from '../../model/mnx.ts';
import type { Primitive } from '../primitives.ts';
import type { HorizontalPlan } from './spacing.ts';

const VOLTA_RISE_SP = 3.4;  // bracket line above the top staff line
const VOLTA_HOOK_SP = 1.3;
const VOLTA_THICKNESS_SP = 0.13;

export /**
 * Draws each global-measure `ending` as a volta bracket: a line above the
 * staff spanning `duration` measures, hooked down at the start (and at the end
 * unless `open`), labelled with its numbers ("1." / "1. 2."). Brackets split
 * at system breaks; only the first segment carries the hook and label.
 */
function emitEndings(
  mnx: MnxStructure,
  plan: HorizontalPlan,
  /** The top staff's top line on a row — rows are no longer a uniform pitch. */
  rowStaffTop: (row: number) => number,
  primitives: Primitive[],
  /** Draw only the segments that fall on this row — the tab layout places
   *  its score text per row inside the measure loop, scanning the row's ink
   *  so far, so a row's voltas must be on the page before its labels. */
  onlyRow?: number
): void {
  (mnx.global.measures ?? []).forEach((gm, i) => {
    const ending = gm?.ending;
    if (!ending || !plan.measures[i]) return;
    const last = Math.min(i + Math.max(1, ending.duration ?? 1) - 1, plan.measures.length - 1);

    let a = i;
    while (a <= last) {
      const row = plan.measures[a].row;
      let b = a;
      while (b + 1 <= last && plan.measures[b + 1].row === row) b++;
      if (onlyRow !== undefined && row !== onlyRow) {
        a = b + 1;
        continue;
      }
      const staffTop = rowStaffTop(row);
      const y = staffTop - VOLTA_RISE_SP;
      const x1 = plan.measures[a].x + 0.1;
      const x2 = plan.measures[b].x + plan.measures[b].width - 0.1;
      primitives.push({
        kind: 'line',
        x1, y1: y, x2, y2: y,
        thickness: VOLTA_THICKNESS_SP,
        ...(ending.color ? { stroke: ending.color } : {}),
        className: 'ending'
      });
      if (a === i) {
        primitives.push({
          kind: 'line',
          x1, y1: y, x2: x1, y2: y + VOLTA_HOOK_SP,
          thickness: VOLTA_THICKNESS_SP,
          ...(ending.color ? { stroke: ending.color } : {}),
          className: 'ending'
        });
        primitives.push({
          kind: 'text',
          text: (ending.numbers ?? []).map(n => `${n}.`).join(' '),
          x: x1 + 0.5,
          y: y + 1.4,
          font: 'body',
          size: 1.4,
          weight: 'bold',
          ...(ending.color ? { fill: ending.color } : {}),
          className: 'ending-label'
        });
      }
      if (!ending.open && b === last) {
        primitives.push({
          kind: 'line',
          x1: x2, y1: y, x2, y2: y + VOLTA_HOOK_SP,
          thickness: VOLTA_THICKNESS_SP,
          ...(ending.color ? { stroke: ending.color } : {}),
          className: 'ending'
        });
      }
      a = b + 1;
    }
  });
}

