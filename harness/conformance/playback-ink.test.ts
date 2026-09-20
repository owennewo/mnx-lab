import { describe, it, expect } from 'vitest';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutBothSystem } from '../../src/engine/layout/bothSystem.ts';
import { renderSvgToString } from '../helpers/svgString.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';
import {
  paintPlaybackInk,
  playbackVoiceSlot,
  stretchMask,
  PLAYBACK_VOICE_COLOURS
} from '../../src/engine/render/playbackInk.ts';
import { forEachNoteAddress } from '../../src/model/noteWalk.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import type { RectPrim as Rect } from '../../src/engine/primitives.ts';

/**
 * PLAYBACK INK — the sounding notes on the page, by voice and for as long as
 * they sound (roadmap/inprogress/core-campaign-player.md).
 *
 * Two claims a golden cannot make. First, the tab layout records where each
 * fret mask's note ENDS only when asked (`durationSpans`): the goldens never
 * ask, so the field must be absent from an unasked layout, or every committed
 * primitive would have moved for a paint-time convenience. Second, the paint
 * itself is reversible: a mask stretched while a note sounds comes back to
 * the emitter's geometry when it stops, and each voice carries its own colour
 * slot so a held bass under a moving melody reads as two things.
 */

const STRINGS = [
  { string: 1, pitch: { step: 'E', octave: 4 } },
  { string: 2, pitch: { step: 'B', octave: 3 } },
  { string: 3, pitch: { step: 'G', octave: 3 } },
  { string: 4, pitch: { step: 'D', octave: 3 } },
  { string: 5, pitch: { step: 'A', octave: 2 } },
  { string: 6, pitch: { step: 'E', octave: 2 } }
];
const OPEN: Record<number, { step: string; octave: number }> = {
  1: { step: 'E', octave: 4 }, 2: { step: 'B', octave: 3 }, 3: { step: 'G', octave: 3 },
  4: { step: 'D', octave: 3 }, 5: { step: 'A', octave: 2 }, 6: { step: 'E', octave: 2 }
};

const note = (id: string, string: number, base: string) => ({
  duration: { base },
  notes: [{ id, pitch: OPEN[string], _x: { mnxLab: { string } } }]
});

/** One 4/4 bar: a melody of quarters on string 1 over a bass of halves on string 6. */
function twoVoices(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      id: 'guitar',
      _x: { mnxLab: { strings: STRINGS, tab: { staffKind: 'both' } } },
      measures: [{
        clefs: [{ clef: { sign: 'G', staffPosition: -2, octave: -1 } }],
        sequences: [
          { content: [note('m1', 1, 'quarter'), note('m2', 1, 'quarter'), note('m3', 1, 'quarter'), note('m4', 1, 'quarter')] },
          { content: [note('b1', 6, 'half'), note('b2', 6, 'half')] }
        ]
      }]
    }]
  } as unknown as MnxStructure;
}

const masks = (primitives: readonly { kind: string; className?: string }[]) =>
  primitives.filter((p): p is Rect => p.kind === 'rect' && (p.className ?? '').split(' ').includes('fret-bg'));

describe('the tab layout records duration spans only when asked', () => {
  initSmufl();
  const doc = twoVoices();

  it('an unasked layout carries no span — the goldens stay untouched', () => {
    for (const layout of [layoutTab({ mnx: doc, widthSp: WIDTH_SP }), layoutBothSystem({ mnx: doc, widthSp: WIDTH_SP })]) {
      const found = masks(layout.primitives);
      expect(found.length).toBe(6);
      expect(found.every(m => m.spanEndX === undefined && m.spanEndDx === undefined)).toBe(true);
    }
  });

  it('asked, every mask ends at its own voice\'s next column or the barline', () => {
    for (const layout of [
      layoutTab({ mnx: doc, widthSp: WIDTH_SP, durationSpans: true }),
      layoutBothSystem({ mnx: doc, widthSp: WIDTH_SP, durationSpans: true })
    ]) {
      const byId = new Map(masks(layout.primitives).map(m => [m.sourceId, m]));
      const m1 = byId.get('m1')!, m2 = byId.get('m2')!, m4 = byId.get('m4')!, b1 = byId.get('b1')!, b2 = byId.get('b2')!;
      // The melody's first quarter ends where its second begins: the next
      // mask's centre (its x is the column centre less half its width).
      expect(m1.spanEndX).toBeCloseTo(m2.x + m2.w / 2, 5);
      // The bass half rings across two melody columns: its end is the second
      // half's column, past m2 and at m3.
      expect(b1.spanEndX).toBeGreaterThan(m2.x);
      expect(b1.spanEndX).toBeCloseTo(b2.x + b2.w / 2, 5);
      // The last note of each voice runs to the bar's end.
      expect(m4.spanEndX).toBeCloseTo(b2.spanEndX!, 5);
      expect(m4.spanEndX).toBeGreaterThan(m4.x);
      // The clearance is an ink offset back from the column.
      expect(m1.spanEndDx).toBeLessThan(0);
    }
  });

  it('the notation staff alone never records one (no masks to stretch)', () => {
    const layout = layoutNotation({ mnx: doc, widthSp: WIDTH_SP, durationSpans: true });
    expect(masks(layout.primitives).length).toBe(0);
  });

  it('the emitter surfaces the span in px as data-span-end', () => {
    const layout = layoutTab({ mnx: doc, widthSp: WIDTH_SP, durationSpans: true });
    const svg = renderSvgToString({ primitives: layout.primitives, widthSp: layout.widthSp, heightSp: layout.heightSp, pxPerSp: 16 });
    const m1 = masks(layout.primitives).find(m => m.sourceId === 'm1')!;
    const expected = (m1.spanEndX! + m1.spanEndDx!) * 16;
    expect(svg).toContain(`data-source-id="m1"`);
    const attr = svg.match(/<rect [^>]*data-span-end="([^"]+)"[^>]*data-source-id="m1"/) ??
      svg.match(/<rect [^>]*data-source-id="m1"[^>]*data-span-end="([^"]+)"/);
    expect(attr).not.toBeNull();
    expect(Number(attr![1])).toBeCloseTo(expected, 4);
    // And an unasked render has no such attribute anywhere.
    const plain = layoutTab({ mnx: doc, widthSp: WIDTH_SP });
    expect(renderSvgToString({ primitives: plain.primitives, widthSp: plain.widthSp, heightSp: plain.heightSp, pxPerSp: 16 })).not.toContain('data-span-end');
  });
});

// ---------- The paint, on a DOM small enough to fake ----------

class FakeNode {
  attrs = new Map<string, string>();
  classes = new Set<string>();
  classList = {
    contains: (c: string) => this.classes.has(c),
    toggle: (c: string, on: boolean) => { if (on) this.classes.add(c); else this.classes.delete(c); return on; }
  };
  constructor(attrs: Record<string, string>, classes: string[] = []) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
    classes.forEach(c => this.classes.add(c));
  }
  getAttribute(k: string) { return this.attrs.has(k) ? this.attrs.get(k)! : null; }
  setAttribute(k: string, v: string) { this.attrs.set(k, String(v)); }
  removeAttribute(k: string) { this.attrs.delete(k); }
}
class FakeRoot {
  constructor(private nodes: FakeNode[]) {}
  querySelectorAll() { return this.nodes as unknown as NodeListOf<SVGElement>; }
}

const pill = (id: string, extra: string[] = []) =>
  new FakeNode({ 'data-playback-id': id }, ['tab-rest-pill', ...extra]);
const mask = (id: string, x: number, w: number, end: number, extra: string[] = []) =>
  new FakeNode({ 'data-source-id': id, x: String(x), width: String(w), y: '40', height: '16', 'data-span-end': String(end) }, ['fret-bg', ...extra]);
const digit = (id: string, extra: string[] = []) => new FakeNode({ 'data-source-id': id }, ['fret-number', ...extra]);

/** The tab staff's rest pill: the playhead's only foothold where tab draws
 *  nothing (layout/tabStaff.ts). It must be as invisible to the goldens as
 *  the duration spans are, and as invisible to the SELECTION as it is to
 *  them — hence a name of its own rather than a `sourceId`. */
describe('the tab rest pill', () => {
  initSmufl();
  /** One 4/4 bar on a tab part: a quarter, a half rest, a quarter. */
  const doc = {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      id: 'guitar',
      _x: { mnxLab: { strings: STRINGS, tab: { staffKind: 'both' } } },
      measures: [{
        clefs: [{ clef: { sign: 'G', staffPosition: -2, octave: -1 } }],
        sequences: [{ content: [
          note('a1', 1, 'quarter'),
          { duration: { base: 'half' }, rest: {} },
          note('a2', 1, 'quarter')
        ] }]
      }]
    }]
  } as unknown as MnxStructure;
  const pills = (primitives: readonly { kind: string; className?: string }[]) =>
    primitives.filter((p): p is Rect =>
      p.kind === 'rect' && (p.className ?? '').split(' ').includes('tab-rest-pill'));

  it('is absent from an unasked layout — the goldens never see it', () => {
    for (const layout of [layoutTab({ mnx: doc, widthSp: WIDTH_SP }), layoutBothSystem({ mnx: doc, widthSp: WIDTH_SP })]) {
      expect(pills(layout.primitives)).toEqual([]);
    }
  });

  it('spans the rest and is named for the playhead alone', () => {
    const layout = layoutTab({ mnx: doc, widthSp: WIDTH_SP, durationSpans: true });
    const found = pills(layout.primitives);
    expect(found).toHaveLength(1);
    const [rest] = found;
    // The name notation gives the same rest, so ONE lookup lights both staves.
    expect(rest.playbackId).toBe('@m0.v0.e1');
    // Never the shared vocabulary: no selection may enclose it, no click find it.
    expect(rest.sourceId).toBeUndefined();
    // It reaches from its own column towards the next one.
    const digits = layout.primitives.filter((p): p is Rect =>
      p.kind === 'rect' && (p.className ?? '').split(' ').includes('fret-bg'));
    const after = digits.find(d => d.sourceId === 'a2')!;
    expect(rest.w).toBeGreaterThan(0);
    expect(rest.x).toBeGreaterThan(digits.find(d => d.sourceId === 'a1')!.x);
    expect(rest.x + rest.w).toBeLessThan(after.x + after.w);
  });

  it('the notation staff grows none of its own — it draws the rest itself', () => {
    const layout = layoutNotation({ mnx: doc, widthSp: WIDTH_SP, durationSpans: true });
    expect(pills(layout.primitives)).toEqual([]);
  });

  it('the emitter surfaces the name as data-playback-id, and only when asked', () => {
    const layout = layoutTab({ mnx: doc, widthSp: WIDTH_SP, durationSpans: true });
    const svg = renderSvgToString({ primitives: layout.primitives, widthSp: layout.widthSp, heightSp: layout.heightSp, pxPerSp: 16 });
    expect(svg).toContain('data-playback-id="@m0.v0.e1"');
    const plain = layoutTab({ mnx: doc, widthSp: WIDTH_SP });
    expect(renderSvgToString({ primitives: plain.primitives, widthSp: plain.widthSp, heightSp: plain.heightSp, pxPerSp: 16 }))
      .not.toContain('data-playback-id');
  });
});

describe('the playback paint', () => {
  it('stretches a sounding mask to its span, pads it, and restores it afterwards', () => {
    const m = mask('m1', 100, 12, 160);
    const root = new FakeRoot([m]) as unknown as ParentNode;
    paintPlaybackInk(root, new Map([['m1', 1]]));
    expect(m.classes.has('playback-ink')).toBe(true);
    expect(m.getAttribute('data-playback-voice')).toBe('1');
    const x = Number(m.getAttribute('x')), w = Number(m.getAttribute('width'));
    const y = Number(m.getAttribute('y')), h = Number(m.getAttribute('height'));
    expect(x).toBeLessThan(100);                 // air left of the digit
    expect(x + w).toBeCloseTo(160, 6);           // and the right edge at the release
    expect(y).toBeLessThan(40);                  // a sliver above…
    expect(y + h).toBeGreaterThan(56);           // …and below (the mask was 40–56)
    expect(y + h - 56).toBeCloseTo(40 - y, 6);   // symmetric
    paintPlaybackInk(root, new Map());
    expect(m.classes.has('playback-ink')).toBe(false);
    expect(m.getAttribute('x')).toBe('100');
    expect(m.getAttribute('width')).toBe('12');
    expect(m.getAttribute('y')).toBe('40');
    expect(m.getAttribute('height')).toBe('16');
    expect(m.getAttribute('data-playback-voice')).toBeNull();
    expect(m.getAttribute('data-mask-x')).toBeNull();
    expect(m.getAttribute('data-mask-y')).toBeNull();
  });

  it('lights ink named for the playhead alone, beside ink named for everyone', () => {
    const rest = pill('@m0.v0.e1');
    const m = digit('m1');
    const root = new FakeRoot([m, rest]) as unknown as ParentNode;
    paintPlaybackInk(root, new Map([['@m0.v0.e1', 2]]));
    expect(rest.classes.has('playback-ink')).toBe(true);
    expect(rest.getAttribute('data-playback-voice')).toBe('2'); // its own voice's colour
    expect(m.classes.has('playback-ink')).toBe(false);
    paintPlaybackInk(root, new Map());
    expect(rest.classes.has('playback-ink')).toBe(false);
    expect(rest.getAttribute('data-playback-voice')).toBeNull();
  });

  it('a repaint while still sounding is idempotent', () => {
    const m = mask('m1', 100, 12, 160);
    for (let i = 0; i < 3; i++) stretchMask(m as unknown as Element, true);
    expect(Number(m.getAttribute('x')) + Number(m.getAttribute('width'))).toBeCloseTo(160, 6);
    expect(Number(m.getAttribute('height'))).toBeCloseTo(16 * 1.2, 6); // padded once, not thrice
    stretchMask(m as unknown as Element, false);
    expect(m.getAttribute('x')).toBe('100');
    expect(m.getAttribute('height')).toBe('16');
  });

  it('never narrows a mask below the digit it masks', () => {
    const m = mask('m1', 100, 12, 104); // a span shorter than the digit
    stretchMask(m as unknown as Element, true);
    expect(Number(m.getAttribute('width'))).toBeGreaterThanOrEqual(12);
  });

  it('carries the voice slot, cycles past four, and skips unperformed ink', () => {
    const nodes = [digit('m1'), digit('b1'), digit('x9'), digit('m1', ['unperformed'])];
    paintPlaybackInk(new FakeRoot(nodes) as unknown as ParentNode, new Map([['m1', 1], ['b1', 2], ['x9', 5]]));
    expect(nodes[0].getAttribute('data-playback-voice')).toBe('1');
    expect(nodes[1].getAttribute('data-playback-voice')).toBe('2');
    expect(nodes[2].getAttribute('data-playback-voice')).toBe('1'); // 5 wraps to the first slot
    expect(nodes[3].classes.has('playback-ink')).toBe(false);
    expect(playbackVoiceSlot(PLAYBACK_VOICE_COLOURS)).toBe(PLAYBACK_VOICE_COLOURS);
    expect(playbackVoiceSlot(PLAYBACK_VOICE_COLOURS + 1)).toBe(1);
  });

  it('the model walk the viewer colours from puts the bass in voice 2', () => {
    const voices = new Map<string, number>();
    forEachNoteAddress(twoVoices(), a => voices.set(a.key, a.voiceIndex + 1));
    expect(voices.get('m1')).toBe(1);
    expect(voices.get('b1')).toBe(2);
  });
});
