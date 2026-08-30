import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { computePrimitives, computeBoth, initSmufl } from '../helpers/corpusPrimitives.ts';
// @ts-expect-error — plain .mjs module without type declarations
import { ROOT } from '../verify/check-scenarios.mjs';
import type { MnxStructure } from '../../src/model/mnx.ts';
import type { Primitive } from '../../src/engine/primitives.ts';
import { validateDocument } from '../../src/engine/layout/validate.ts';

/**
 * Tuplets and grace notes ON THE FINGERBOARD
 * (roadmap/.../core-tuplets-grace-notes.md, step 4).
 *
 * The tab staff used to reserve a container's columns and draw nothing in
 * them. The goldens pin what it draws now, byte for byte; these pin the three
 * things a golden cannot say out loud, because a golden is a hash and these
 * are the reasons behind the numbers in it:
 *
 *   1. Every digit sits in the column the PLAN priced for it — so the tab and
 *      notation staves of a `both` system stay in lockstep across a container.
 *      A walk that disagreed with `spacing.ts` by one term would slide every
 *      digit after the first out of column, and the golden would happily pin
 *      the wrong answer.
 *   2. A tuplet bracket is drawn ONCE per group per system. The standalone tab
 *      view draws its own (it has no beams and no notation staff, so nothing
 *      else says where the group is); the `both` view does not, because the
 *      staff above already did.
 *   3. Grace digits are smaller than beat digits. That is the whole of what
 *      makes an ornament read as an ornament on a staff with no stems.
 */

const SCENARIOS = path.join(ROOT, 'scenarios/lab/26-tab-rhythm');

function score(name: string): MnxStructure {
  return JSON.parse(fs.readFileSync(path.join(SCENARIOS, name, 'document.mnx.json'), 'utf8'));
}

/** Every primitive whose className matches, flattened out of the system. */
function ofClass(primitives: readonly Primitive[], className: string): Primitive[] {
  const out: Primitive[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.className === 'string' && record.className.split(' ').includes(className)) {
      out.push(node as Primitive);
    }
    Object.values(record).forEach(visit);
  };
  visit(primitives);
  return out;
}

const xOf = (p: Primitive) => Math.round(((p as { x?: number }).x ?? 0) * 1e4) / 1e4;

beforeAll(initSmufl);

describe('tuplets on a tab staff', () => {
  const doc = score('01-triplets-on-tab');

  it('puts every fret digit in the column the notehead above it uses', () => {
    // The `both` system is ONE layout walk, so agreement here is agreement
    // about the plan itself — the tab digits and the noteheads above them are
    // placed by two different modules reading the same column table.
    //
    // Compared as OFFSETS from the first column, not as absolute x: a notehead
    // glyph is positioned by its left edge and a fret digit by its centre, so
    // the two are a constant half-notehead apart and always were. What must
    // match is the SPACING, which is what "in column" means and what a walk
    // that disagreed with `spacing.ts` would break.
    const both = computeBoth(doc);
    expect(both).not.toBeNull();
    const heads = ofClass(both!.primitives, 'notehead').map(xOf).sort((a, b) => a - b);
    const digits = ofClass(both!.primitives, 'fret-number').map(xOf).sort((a, b) => a - b);
    expect(digits.length).toBe(heads.length);
    expect(digits.length).toBeGreaterThan(0);

    const relative = (xs: number[]) => xs.map(x => Math.round((x - xs[0]) * 1e4) / 1e4);
    expect(relative(digits)).toEqual(relative(heads));
  });

  it('draws its own bracket in the standalone tab view', () => {
    const tab = computePrimitives(doc).tab;
    expect(tab).not.toBeNull();
    // Three tuplets: two eighth triplets and one quarter triplet.
    expect(ofClass(tab!.primitives, 'tuplet-number').map(p => (p as { text?: string }).text))
      .toEqual(['3', '3', '3']);
    // Two arms and two hooks each.
    expect(ofClass(tab!.primitives, 'tuplet-bracket').length).toBe(12);
  });

  it('draws the bracket ONCE in the combined view — the notation staff carries it', () => {
    const both = computeBoth(doc)!;
    const notation = computePrimitives(doc).notation;
    // Whatever the notation staff draws on its own, and not one mark more:
    // the two fully beamed triplets put their number on the beam and need no
    // bracket at all, so this is 4 (the quarter triplet's) and not 12.
    expect(ofClass(both.primitives, 'tuplet-bracket').length).toBe(
      ofClass(notation.primitives, 'tuplet-bracket').length
    );
    expect(ofClass(both.primitives, 'tuplet-number').length).toBe(
      ofClass(notation.primitives, 'tuplet-number').length
    );
  });
});

describe('grace notes on a tab staff', () => {
  const doc = score('02-grace-on-tab');

  it('draws grace digits smaller than the beat digits beside them', () => {
    const tab = computePrimitives(doc).tab!;
    const sizes = ofClass(tab.primitives, 'fret-number')
      .map(p => (p as { size?: number }).size ?? 0);
    const full = Math.max(...sizes);
    const small = Math.min(...sizes);
    expect(small).toBeLessThan(full);
    // The notation staff's own grace scale, so the two staves agree.
    expect(small / full).toBeCloseTo(0.6, 10);
  });

  it('keeps a grace run in its own small columns, ahead of its principal', () => {
    const tab = computePrimitives(doc).tab!;
    const digits = ofClass(tab.primitives, 'fret-number')
      .map(p => ({ x: xOf(p), size: (p as { size?: number }).size ?? 0 }))
      .sort((a, b) => a.x - b.x);
    const smallest = Math.min(...digits.map(d => d.size));
    // Every grace digit is strictly left of the next full-size digit — the
    // container sits before the note it decorates, and its columns are rigid.
    for (const [index, digit] of digits.entries()) {
      if (digit.size !== smallest) continue;
      const principal = digits.slice(index + 1).find(d => d.size !== smallest);
      expect(principal, 'a grace with no principal after it').toBeDefined();
      expect(digit.x).toBeLessThan(principal!.x);
    }
  });

  it('addresses container notes with the nested key form the editor uses', () => {
    // `model/noteWalk.ts` names a container's notes `…e0.c0.n0`; the digit has
    // to carry that exact key or the cross-highlight cannot find what was drawn.
    const tab = computePrimitives(doc).tab!;
    const ids = ofClass(tab.primitives, 'fret-number')
      .map(p => (p as { sourceId?: string }).sourceId ?? '');
    expect(ids.some(id => /\.c\d+\.n\d+$/.test(id))).toBe(true);
  });
});

describe('unplayable notes inside a container', () => {
  it('draws no digit for them, and says so', () => {
    const doc = score('03-unplayable-inside-a-tuplet');
    const tab = computePrimitives(doc).tab!;
    // Six notes in the bar; the two unplayable ones draw nothing.
    expect(ofClass(tab.primitives, 'fret-number').length).toBe(4);
    const messages = validateDocument(doc)
      .filter(issue => issue.scope === 'tab')
      .map(issue => issue.message);
    expect(messages.some(m => /E1 is not playable/.test(m))).toBe(true);
    expect(messages.some(m => /outside 0–/.test(m))).toBe(true);
  });
});
