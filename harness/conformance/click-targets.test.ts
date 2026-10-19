// Click targets: every point on the page is an element, a slot or dead space.
// roadmap/inprogress/core-editor-click-targets.md.
//
// The browser smoke proves the chain; this file holds the rules, headlessly:
//
//  - a SLOT is a staff's band plus its reach — three ledger lines in notation,
//    half a line gap in tab, stopped halfway to a nearer neighbour — and
//    anything outside every reach is DEAD SPACE, which resolves to nothing;
//  - an ELEMENT answers for at least a staff space around its ink, a lyric
//    outranks a bar-level kind, and the nearer ink wins;
//  - a lyric press lands on the visit that sings its verse;
//  - the layout tags element ink only when asked, so the goldens never see it,
//    and every bar-level kind it tags has the inspector pill a press opens.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CLICKABLE_KINDS,
  DOUBLE_PRESS_MS,
  NOTATION_REACH_GAPS,
  PILL_OF,
  PressCounter,
  TAB_REACH_GAPS,
  TARGET_MIN_SP,
  lyricVisit,
  reachBox,
  slotAt,
  staffReach,
  targetAt,
  type ClickTarget,
  type SlotStaff
} from '../../src/engine/render/clickTargets.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import { EditorSession } from '../../src/edit/session.ts';
import { ELEMENT_KINDS } from '../../src/edit/elementWalk.ts';
import { measurePills } from '../../src/edit/inspector.ts';
import { lyricEventWalk } from '../../src/edit/lyricText.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import type { Primitive } from '../../src/engine/primitives.ts';

const root = path.resolve(import.meta.dirname, '../..');
const scenario = (id: string): MnxStructure =>
  JSON.parse(fs.readFileSync(path.join(root, 'scenarios', id, 'document.mnx.json'), 'utf8')) as MnxStructure;

// ── a synthetic page ─────────────────────────────────────────────────────────
//
// sp = 4 units. Two systems; the first is the `both` view's pair — a notation
// staff (5 lines, gap 4) with a tab staff (6 lines, gap 6) hung 14 units under
// it — and the second is a lone notation staff far below.
const SP = 4;
const staves: SlotStaff[] = [
  { top: 100, bottom: 116, x1: 20, x2: 180, gap: 4, tab: false },
  { top: 130, bottom: 160, x1: 20, x2: 180, gap: 6, tab: true },
  { top: 300, bottom: 316, x1: 20, x2: 180, gap: 4, tab: false }
];

describe('a slot is a staff and its reach; everything else is dead space', () => {
  it('takes the staff itself', () => {
    expect(slotAt(staves, { x: 60, y: 108 })).toBe(0);
    expect(slotAt(staves, { x: 140, y: 145 })).toBe(1);
    expect(slotAt(staves, { x: 60, y: 308 })).toBe(2);
  });

  it('reaches three ledger lines past a lone notation staff, and no further', () => {
    const reach = staffReach(staves, 2)!;
    expect(reach.top).toBeCloseTo(300 - NOTATION_REACH_GAPS * 4);
    expect(reach.bottom).toBeCloseTo(316 + NOTATION_REACH_GAPS * 4);
    // The third ledger line above (three gaps up) is a place; past the reach is not.
    expect(slotAt(staves, { x: 60, y: 300 - 3 * 4 })).toBe(2);
    expect(slotAt(staves, { x: 60, y: reach.top - 0.5 })).toBeNull();
    expect(slotAt(staves, { x: 60, y: reach.bottom + 0.5 })).toBeNull();
  });

  it('reaches half a line gap past a tab staff', () => {
    const reach = staffReach(staves, 1)!;
    expect(reach.bottom).toBeCloseTo(160 + TAB_REACH_GAPS * 6);
    expect(slotAt(staves, { x: 60, y: reach.bottom + 0.5 })).toBeNull();
  });

  it('stops a reach halfway to a nearer neighbour, so two slots never overlap', () => {
    // The notation staff's three ledger lines would run into the tab staff:
    // they stop halfway. The tab staff's own half gap is shorter than that.
    const above = staffReach(staves, 0)!;
    const below = staffReach(staves, 1)!;
    expect(above.bottom).toBeCloseTo((116 + 130) / 2);
    expect(below.top).toBeCloseTo(130 - TAB_REACH_GAPS * 6);
    expect(above.bottom).toBeLessThanOrEqual(below.top);
    expect(slotAt(staves, { x: 60, y: 122 })).toBe(0);
    expect(slotAt(staves, { x: 60, y: 125 })).toBeNull();
    expect(slotAt(staves, { x: 60, y: 128 })).toBe(1);
  });

  it('finds nothing in the gutter between systems, nor in the margins', () => {
    expect(slotAt(staves, { x: 60, y: 230 })).toBeNull();
    expect(slotAt(staves, { x: 10, y: 108 })).toBeNull(); // the part-name margin
    expect(slotAt(staves, { x: 190, y: 108 })).toBeNull();
  });

  it('leaves no dead paper between systems closer than two reaches', () => {
    // Six staff spaces apart: three ledger lines each way meet in the middle.
    // Dead space between systems exists only where they stand further apart.
    const tight: SlotStaff[] = [
      { top: 0, bottom: 16, x1: 0, x2: 100, gap: 4, tab: false },
      { top: 40, bottom: 56, x1: 0, x2: 100, gap: 4, tab: false }
    ];
    for (let y = 16; y <= 40; y += 1) expect(slotAt(tight, { x: 50, y })).not.toBeNull();
  });
});

describe('an element answers for its ink and a staff space around it', () => {
  const dot = (key: string, x: number, y: number, kind: ClickTarget['kind'] = 'repeat-end'): ClickTarget =>
    ({ key, kind, box: { x, y, w: 1, h: 1 }, measureIndex: 0 });

  it('pads small ink to at least a staff space each way', () => {
    const reach = reachBox({ x: 10, y: 10, w: 1, h: 1 }, SP);
    expect(reach.w).toBeGreaterThanOrEqual(TARGET_MIN_SP * SP);
    expect(reach.h).toBeGreaterThanOrEqual(TARGET_MIN_SP * SP);
    expect(targetAt([dot('a', 10, 10)], { x: 12.5, y: 10.5 }, SP)?.key).toBe('a');
    expect(targetAt([dot('a', 10, 10)], { x: 20, y: 10.5 }, SP)).toBeNull();
  });

  it('prefers a lyric to a bar-level kind, then the nearer ink', () => {
    const lyric: ClickTarget = { key: 'lyric:1:n1', kind: 'lyric', box: { x: 12, y: 10, w: 1, h: 1 }, noteKey: 'n1', lyricLine: '1' };
    expect(targetAt([dot('bar', 10, 10), lyric], { x: 11, y: 10.5 }, SP)?.kind).toBe('lyric');
    expect(targetAt([dot('near', 10, 10), dot('far', 13, 10)], { x: 10.8, y: 10.5 }, SP)?.key).toBe('near');
  });

  it('counts presses on one element close together, as a browser counts clicks', () => {
    const presses = new PressCounter();
    expect(presses.press('a', 0)).toBe(1);
    expect(presses.press('a', DOUBLE_PRESS_MS - 1)).toBe(2); // a double press
    expect(presses.press('a', DOUBLE_PRESS_MS + 10)).toBe(3); // the same gesture's tail, not a new double
    expect(presses.press('b', DOUBLE_PRESS_MS + 20)).toBe(1); // another element
    expect(presses.press('b', 3 * DOUBLE_PRESS_MS)).toBe(1); // too slow
  });

  it('names only kinds the element inventory knows', () => {
    for (const kind of CLICKABLE_KINDS) expect(Object.keys(ELEMENT_KINDS)).toContain(kind);
  });
});

/** Two verses over two bars, the bars repeated once: verse 2 is the second visit. */
function versesUnderARepeat(): MnxStructure {
  const doc = structuredClone(scenario('lab/50-lyrics/02-tab-verses'));
  doc.global.measures[0] = { ...doc.global.measures[0], repeatStart: {} };
  doc.global.measures[1] = { ...doc.global.measures[1], repeatEnd: {} };
  return doc;
}

describe('a pressed lyric lands on the visit that sings its verse', () => {
  it('finds verse N on pass N', () => {
    const doc = versesUnderARepeat();
    const model = linearizePasses(doc);
    const visits = model.entries.filter(entry => entry.measureIndex === 0);
    expect(visits.map(entry => entry.verse)).toEqual([1, 2]);
    expect(lyricVisit(doc, model, 0, '1')).toBe(visits[0]!.ordinal);
    expect(lyricVisit(doc, model, 0, '2')).toBe(visits[1]!.ordinal);
    expect(lyricVisit(doc, model, 0, 'no-such-verse')).toBeUndefined();
  });

  it('puts the cursor there — on the syllable’s note, in that visit', () => {
    const doc = versesUnderARepeat();
    const session = new EditorSession(doc);
    const noteKey = lyricEventWalk(doc, 0)[1]!.noteKey; // "did" / "will"
    const ordinal = lyricVisit(doc, session.passModel, 0, '2')!;
    expect(session.handleIntent({
      type: 'goToPointer', measureIndex: 0, partIndex: 0, staffIndex: 1, line: 0,
      projection: session.projection, fraction: 0, noteKey, ordinal
    })).toBe(true);
    expect(session.selectedNoteKeys).toContain(noteKey);
    expect(session.performedOrdinal).toBe(ordinal);
  });
});

describe('the layout tags element ink only when asked', () => {
  initSmufl();
  const tagged = (primitives: Primitive[]) => primitives.filter(p => p.element);
  const docs = [
    scenario('lab/40-navigation/02-repeats-and-marks-on-tab'),
    scenario('spec/repeats-alternate-endings-simple'),
    scenario('spec/repeats-more-once-repeated')
  ];
  const layouts = [
    (mnx: MnxStructure, elementTargets?: boolean) => layoutNotation({ mnx, widthSp: 160, elementTargets }),
    (mnx: MnxStructure, elementTargets?: boolean) => layoutTab({ mnx, widthSp: 160, elementTargets }),
    (mnx: MnxStructure, elementTargets?: boolean) => layoutBothSystem({ mnx, widthSp: 160, elementTargets })
  ];

  it('never tags without the flag — the goldens stay as they are', () => {
    for (const doc of docs) for (const layout of layouts) expect(tagged(layout(doc).primitives)).toEqual([]);
  });

  it('tags repeat and volta ink with the measure that declares it', () => {
    const seen = new Set<string>();
    for (const doc of docs) {
      for (const layout of layouts) {
        const { primitives } = layout(doc, true);
        for (const p of primitives) {
          const cls = p.className ?? '';
          if (/\b(repeat-dot|repeat-times|ending|ending-label)\b/.test(cls)) expect(p.element, cls).toBeDefined();
          if (!p.element) continue;
          const measure = doc.global.measures[p.element.measureIndex];
          const field = { 'repeat-end': 'repeatEnd', 'repeat-start': 'repeatStart', ending: 'ending' }[p.element.kind];
          expect(measure?.[field as keyof typeof measure], `${p.element.kind} @ ${p.element.measureIndex}`).toBeDefined();
          seen.add(p.element.kind);
        }
        // The tag is an ADDITION: with it, everything else is drawn exactly as before.
        const plain = layout(doc).primitives;
        expect(primitives.map(({ element: _element, ...rest }) => rest)).toEqual(plain);
      }
    }
    expect([...seen].sort()).toEqual(['ending', 'repeat-end', 'repeat-start']);
  });

  it('opens a pill the inspector carries for every bar-level kind it tags', () => {
    for (const doc of docs) {
      const { primitives } = layoutNotation({ mnx: doc, widthSp: 160, elementTargets: true });
      for (const p of tagged(primitives)) {
        const keys = measurePills(doc, p.element!.measureIndex).map(pill => pill.key);
        expect(keys, `${p.element!.kind} @ ${p.element!.measureIndex}`).toContain(PILL_OF[p.element!.kind]);
      }
    }
  });
});
