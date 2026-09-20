/**
 * WHICH BEAT A PRESS ON THE SCORE NAMES.
 *
 * Seeking used to be bar-shaped: a press resolved to an `ordinal` — a bar —
 * and the transport landed on its first beat whatever had been pressed. That
 * reads as the scrubber ignoring you whenever the press was already inside the
 * bar it is playing, and it is not what a press means: the reader pointed at a
 * moment.
 *
 * A note says where it sits itself — the compiled performance carries one
 * written occurrence per visit, each with its own metric offset. A REST does
 * not: it sounds nothing, so it is not in that list at all, and its offset has
 * to come from the document by the same walk that lights it under the playhead
 * (`model/restSpans.ts`).
 *
 * This lives in one place because the rule had two copies — the workbench page
 * and `playbackHost` each resolved a click to a seek — and they had already
 * begun to differ.
 */
import type { Performance } from '../audio/performanceTypes.ts';
import type { MnxStructure } from '../model/mnx.ts';
import type { Rational } from '../model/time.ts';
import { restSpansOf, type RestSpan } from '../model/restSpans.ts';

/** The rests of one document, walked once — a press must not walk the score. */
const restCache = new WeakMap<MnxStructure, readonly RestSpan[]>();

function restsOf(doc: MnxStructure): readonly RestSpan[] {
  let spans = restCache.get(doc);
  if (!spans) {
    spans = restSpansOf(doc);
    restCache.set(doc, spans);
  }
  return spans;
}

/**
 * Where in its bar the drawn mark `key` sits, on the visit `ordinal`, or null
 * when nothing on the page can say — empty staff space, or ink this score does
 * not place. Null means "the bar, as before", never a guess.
 */
export function beatOfKey(
  performance: Performance | null | undefined,
  doc: MnxStructure | null | undefined,
  key: string,
  ordinal: number
): Rational | null {
  const measure = performance?.measures.find(m => m.ordinal === ordinal);
  if (!measure) return null;
  const written = performance?.written.find(w => w.noteKey === key && w.ordinal === ordinal);
  if (written) return written.metricOffset;
  if (!doc) return null;
  const rest = restsOf(doc).find(
    span => span.key === key && span.measureIndex === measure.measureIndex
  );
  return rest ? rest.start : null;
}
