import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planHorizontal } from '../../src/engine/layout/spacing.ts';
import {
  emitSwingMark,
  emitTempoMark,
  SWING_AFTER_TEMPO_GAP_SP
} from '../../src/engine/layout/scoreText.ts';
import { computeBoundsSp } from '../../src/engine/render/bounds.ts';
import type { Primitive } from '../../src/engine/primitives.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { resolveSwingTimeline } from '../../src/model/swing.ts';
import { initSmufl } from '../helpers/corpusPrimitives.ts';

const cls = (p: Primitive) => p.className.split(' ')[0];

describe('tempo + swing heading', () => {
  it('is one same-size, same-baseline statement with a measured gap', () => {
    initSmufl();
    const mnx = JSON.parse(readFileSync(
      'scenarios/lab/11-rhythm/05-swing-feel/document.mnx.json', 'utf8'
    )) as MnxStructure;
    const gm = mnx.global.measures[0];
    const m = planHorizontal(mnx, 80).measures[0];
    const staffTop = 10;

    // Learn the tempo's footprint, then put a tall stem under the feel only.
    // The old independent placement lifted the feel and left the tempo behind.
    const probe: Primitive[] = [];
    const probeTempo = emitTempoMark({ gm, m, staffTop, scan: [], primitives: probe })!;
    const stemX = probeTempo.x + probeTempo.w + SWING_AFTER_TEMPO_GAP_SP + 0.25;
    const primitives: Primitive[] = [{
      kind: 'line', x1: stemX, y1: 2, x2: stemX, y2: staffTop,
      thickness: 0.12, className: 'stem'
    }];
    const tempo = emitTempoMark({ gm, m, staffTop, scan: primitives, primitives })!;
    const beforeSwing = primitives.length;
    const swing = emitSwingMark({
      swing: resolveSwingTimeline(mnx.global.measures)[0],
      m,
      staffTop,
      scan: primitives.slice(),
      clearAbove: tempo,
      primitives
    });
    expect(swing).not.toBeNull();

    const tempoPrimitives = primitives.slice(tempo.firstPrimitive, beforeSwing);
    const swingPrimitives = primitives.slice(beforeSwing);
    const tempoInk = computeBoundsSp(tempoPrimitives)!;
    const swingInk = computeBoundsSp(swingPrimitives)!;
    expect(swingInk.x - tempoInk.x - tempoInk.w).toBeCloseTo(SWING_AFTER_TEMPO_GAP_SP, 6);

    const tempoNote = tempoPrimitives.find(p => p.kind === 'glyph' && cls(p) === 'tempo');
    const swingNotes = swingPrimitives.filter(p => p.kind === 'glyph' && p.glyph.startsWith('metNote'));
    expect(tempoNote?.kind).toBe('glyph');
    expect(swingNotes.length).toBe(4);
    for (const note of swingNotes) {
      if (note.kind !== 'glyph' || tempoNote?.kind !== 'glyph') continue;
      expect(note.scale).toBe(tempoNote.scale);
      expect(note.y).toBeCloseTo(tempoNote.y, 9);
    }
    // The stem forces the combined statement upward, proving the tempo moved
    // with the feel instead of the feel breaking onto a higher line.
    expect(tempoNote && tempoNote.kind === 'glyph' ? tempoNote.y : Infinity)
      .toBeLessThan(probeTempo.baseline);
  });
});
