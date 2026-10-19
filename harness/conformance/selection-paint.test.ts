// The selection as a paint (src/engine/layout/selectionHooks.ts): a layout
// handed the hook tokens instead of a selection must mark exactly the ink the
// selection would have coloured, so that lighting the marks reproduces what
// the layout drew with the selection in it. Proven per primitive, across the
// corpus, in all three projections and unrolled too: same geometry, and every
// colour slot and `selected` class equal to the selected layout's after the
// marks are lit — for selections drawn from the marks themselves (notes, a
// chord's other member, rests) and for nothing selected.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus, createContext, checkScenario } from '../verify/check-scenarios.mjs';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
import { planBoth } from '../../src/engine/both/bothRenderer.ts';
import { planNotation } from '../../src/engine/notation/notationRenderer.ts';
import { planTab } from '../../src/engine/tab/tabRenderer.ts';
import { engravingEntries } from '../../src/engine/layout/unrolled.ts';
import {
  SELECT_EVENTS_HOOK,
  SELECT_NOTES_HOOK,
  readClassMark,
  readSelectionMark
} from '../../src/engine/layout/selectionHooks.ts';
import type { Primitive } from '../../src/engine/primitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const SELECTED_COLOR = 'oklch(0.7 0.15 190)';
const PX_PER_SP = 10;

type Plan = (opts: Parameters<typeof planBoth>[0]) => { primitives: Primitive[] };
const PROJECTIONS: [string, Plan][] = [['both', planBoth], ['notation', planNotation], ['tab', planTab as Plan]];

const ctx = createContext();
const corpus = loadCorpus().filter((s: any) => {
  const { meta } = checkScenario(s, ctx);
  return meta && meta.expect.standard === 'valid';
});

type Colourable = Primitive & { fill?: string; stroke?: string };

/** The ids a hooked primitive is lit by, and what a lit one takes. */
function marksOf(p: Colourable) {
  const fill = readSelectionMark(p.fill), stroke = readSelectionMark(p.stroke), only = readSelectionMark(p.selects);
  return { fill, stroke, ids: new Set([...(fill ?? []), ...(stroke ?? []), ...(only ?? [])]), classed: readClassMark(p.className) };
}

/** What lighting `hooked` for `lit` must give: the selected layout's primitive, compared on class SET. */
function lightUp(hooked: Colourable, lit: Set<string>) {
  const { fill, stroke, ids, classed } = marksOf(hooked);
  const on = [...ids].some(id => lit.has(id));
  const out: Record<string, unknown> = { ...hooked };
  delete out.selects;
  if (fill) out.fill = on ? SELECTED_COLOR : undefined;
  if (stroke) out.stroke = on ? SELECTED_COLOR : undefined;
  const classes = new Set((classed.className ?? '').split(' ').filter(Boolean));
  if (classed.marked && on) classes.add('selected');
  out.className = classes;
  return out;
}
const normal = (p: Primitive) => ({ ...p, className: new Set((p.className ?? '').split(' ').filter(Boolean)) });

describe('the selection paints what the selected layout coloured', () => {
  for (const scenario of corpus) {
    it(scenario.id, () => {
      initSmufl();
      const doc = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8')) as MnxStructure;
      for (const unrolled of [false, true]) {
        const entries = engravingEntries(doc, unrolled);
        for (const [name, plan] of PROJECTIONS) {
          const base = { mnx: doc, entries, width: WIDTH_SP * PX_PER_SP, pxPerSp: PX_PER_SP };
          let hooked: Primitive[];
          try {
            hooked = plan({ ...base, selectedNoteIds: [SELECT_NOTES_HOOK], selectedEventIds: [SELECT_EVENTS_HOOK] }).primitives;
          } catch {
            continue; // a projection this document cannot take (no strings for tab, …) is not this test's business
          }
          // Selections drawn from the marks: a few notes, a few events, all at once, and none.
          const ids = [...new Set(hooked.flatMap(p => [...marksOf(p as Colourable).ids]))];
          const notes = ids.filter(id => id.startsWith('n:')).map(id => id.slice(2));
          const events = ids.filter(id => id.startsWith('e:')).map(id => id.slice(2));
          const pick = <T,>(list: T[]) => [...new Set([list[0], list[Math.floor(list.length / 2)], list[list.length - 1]])].filter(x => x !== undefined);
          const selections: [string[], string[]][] = [[[], []], ...pick(notes).map(n => [[n], []] as [string[], string[]]),
            ...pick(events).map(e => [[], [e]] as [string[], string[]]), [pick(notes), pick(events)]];
          for (const [noteIds, eventIds] of selections) {
            const selected = plan({ ...base, selectedNoteIds: noteIds, selectedEventIds: eventIds }).primitives;
            expect(selected.length, `${name}${unrolled ? ' unrolled' : ''}: primitive count`).toBe(hooked.length);
            const lit = new Set([...noteIds.map(id => `n:${id}`), ...eventIds.map(id => `e:${id}`)]);
            selected.forEach((p, i) => {
              expect(lightUp(hooked[i] as Colourable, lit), `${name}${unrolled ? ' unrolled' : ''} [${i}] ${p.className ?? p.kind} lit by ${[...lit].join(',') || 'nothing'}`)
                .toEqual(normal(p));
            });
          }
        }
      }
    });
  }
});
