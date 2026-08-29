// Arpeggio and non-arpeggio marks (core-measure-attributes-gaps.md, item 8).
// Both are part-measure objects spanning note ids; the event that carries the
// span's first note draws them, beside its own accidental column. Bravura's
// wiggle glyphs are horizontal and the primitives have no rotation, so the
// wave is a run of cubic curves — one per half period — and the bracket is
// three lines.
import type { MnxArpeggio, MnxGlobalMeasure, MnxNonArpeggio } from '../../model/mnx.ts';
import type { Primitive } from '../primitives.ts';

export interface SpanMarks {
  arpeggio?: MnxArpeggio;
  nonArpeggio?: MnxNonArpeggio;
}

/** Every arpeggio and non-arpeggio in the document, keyed by the note id
 *  that STARTS its span — note ids are document-unique, so one map serves
 *  every staff. */
export function collectSpanMarks(parts: readonly { measures?: readonly { arpeggios?: MnxArpeggio[]; nonArpeggios?: MnxNonArpeggio[] }[] }[]): Map<string, SpanMarks> {
  const out = new Map<string, SpanMarks>();
  for (const part of parts) {
    for (const measure of part.measures ?? []) {
      for (const arpeggio of measure.arpeggios ?? []) {
        out.set(arpeggio.span.start, { ...(out.get(arpeggio.span.start) ?? {}), arpeggio });
      }
      for (const nonArpeggio of measure.nonArpeggios ?? []) {
        out.set(nonArpeggio.span.start, { ...(out.get(nonArpeggio.span.start) ?? {}), nonArpeggio });
      }
    }
  }
  return out;
}

const ARPEGGIO_GAP_SP = 0.6;        // from the chord's leftmost ink to the wave's centre line
const ARPEGGIO_AMPLITUDE_SP = 0.3;  // half the wave's width
const ARPEGGIO_HALF_PERIOD_SP = 0.75;
const ARPEGGIO_THICKNESS_SP = 0.16;
const ARPEGGIO_OVERSHOOT_SP = 0.5;  // past the outer noteheads' centres
const ARROW_HALF_WIDTH_SP = 0.45;
const ARROW_HEIGHT_SP = 0.6;
const BRACKET_HOOK_SP = 0.7;
const BRACKET_THICKNESS_SP = 0.13;

export interface EmitArpeggioArgs {
  /** Left edge of the chord's ink (its leftmost accidental, else its notehead). */
  leftInkX: number;
  /** Centres of the span's outermost noteheads. */
  yTop: number;
  yBottom: number;
  marks: SpanMarks;
  fill?: string;
  primitives: Primitive[];
}

/** The wave beside the chord (and its arrowhead), then the bracket. */
export function emitSpanMarks({ leftInkX, yTop, yBottom, marks, fill, primitives }: EmitArpeggioArgs): void {
  const stroke = fill;
  if (marks.arpeggio) {
    const { arpeggio } = marks;
    const x = leftInkX - ARPEGGIO_GAP_SP;
    const top = yTop - ARPEGGIO_OVERSHOOT_SP;
    const bottom = yBottom + ARPEGGIO_OVERSHOOT_SP;
    const down = arpeggio.direction === 'down';
    const arrow = arpeggio.arrow === true;
    // The arrowhead takes the end the roll points at; the wave stops short of it.
    const waveTop = top + (arrow && !down ? ARROW_HEIGHT_SP : 0);
    const waveBottom = bottom - (arrow && down ? ARROW_HEIGHT_SP : 0);
    const halves = Math.max(2, Math.round((waveBottom - waveTop) / ARPEGGIO_HALF_PERIOD_SP));
    const step = (waveBottom - waveTop) / halves;
    const color = arpeggio.color ?? stroke;
    for (let h = 0; h < halves; h++) {
      const y0 = waveTop + h * step;
      const y1 = y0 + step;
      const side = (h % 2 === 0 ? 1 : -1) * ARPEGGIO_AMPLITUDE_SP;
      primitives.push({
        kind: 'curve',
        points: [
          { x, y: y0 },
          { x: x + side, y: y0 + step / 3 },
          { x: x + side, y: y1 - step / 3 },
          { x, y: y1 }
        ],
        thickness: ARPEGGIO_THICKNESS_SP,
        ...(color ? { stroke: color } : {}),
        className: `arpeggio${arpeggio.arrow ? ' arpeggio-arrow' : ''}`
      });
    }
    if (arrow) {
      const tipY = down ? bottom : top;
      const baseY = down ? bottom - ARROW_HEIGHT_SP : top + ARROW_HEIGHT_SP;
      for (const dx of [-ARROW_HALF_WIDTH_SP, ARROW_HALF_WIDTH_SP]) {
        primitives.push({
          kind: 'line',
          x1: x + dx, y1: baseY, x2: x, y2: tipY,
          thickness: ARPEGGIO_THICKNESS_SP,
          ...(color ? { stroke: color } : {}),
          className: 'arpeggio arpeggio-arrowhead'
        });
      }
    }
  }
  if (marks.nonArpeggio) {
    const x = leftInkX - ARPEGGIO_GAP_SP;
    const top = yTop - ARPEGGIO_OVERSHOOT_SP;
    const bottom = yBottom + ARPEGGIO_OVERSHOOT_SP;
    const color = marks.nonArpeggio.color ?? stroke;
    const seg = (x1: number, y1: number, x2: number, y2: number) =>
      primitives.push({
        kind: 'line', x1, y1, x2, y2,
        thickness: BRACKET_THICKNESS_SP,
        ...(color ? { stroke: color } : {}),
        className: 'non-arpeggio'
      });
    seg(x, top, x, bottom);
    seg(x, top, x + BRACKET_HOOK_SP, top);
    seg(x, bottom, x + BRACKET_HOOK_SP, bottom);
  }
}

// ---------- Measure numbers ----------
//
// Drawn only when the document DECLARES a number: an engraver's "number every
// system" is a presentation choice the document does not carry, and drawing it
// unasked would move every golden in the corpus. A declared `number` is the
// author saying this bar reads N — so it reads N, small, at the bar's start,
// tucked under where the tempo and the labels stack.
const MEASURE_NUMBER_SIZE_SP = 1.3;
const MEASURE_NUMBER_RISE_SP = 0.9; // baseline above the top line
const MEASURE_NUMBER_INSET_SP = 0.2;

export function emitMeasureNumber(
  gm: MnxGlobalMeasure,
  m: { x: number },
  staffTop: number,
  primitives: Primitive[]
): void {
  if (gm.number === undefined) return;
  primitives.push({
    kind: 'text',
    text: `${gm.number}`,
    x: m.x + MEASURE_NUMBER_INSET_SP,
    y: staffTop - MEASURE_NUMBER_RISE_SP,
    font: 'body',
    size: MEASURE_NUMBER_SIZE_SP,
    anchor: 'start',
    className: 'measure-number'
  });
}
