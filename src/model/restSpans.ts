/**
 * WHERE THE RESTS ARE, in written time — the lookup the playhead needs to
 * mark a bar's silence.
 *
 * The performance is MIDI-shaped: `Performance.written` holds note
 * occurrences, and a rest sounds nothing, so it appears in the compiled
 * performance only as the absence between two notes. That is enough to PLAY
 * a score and not enough to point at one, because the mark the reader sees is
 * the drawn rest, which is addressed by the key `model/noteWalk.ts` mints and
 * both layouts emit as `data-source-id`.
 *
 * So this walks the document once and records the rests with their written
 * extent, in the same coordinates `ScorePosition` speaks (a written measure
 * index and a metric offset inside it). A consumer intersects the playhead
 * with the spans and gets keys it can hand straight to the playback paint.
 *
 * WHY A THIRD WALK. `engine/layout/unrolled.ts` and `audio/performance.ts`
 * already traverse sequence content with these duration rules, and both
 * record NOTES — neither can answer this without growing a second purpose.
 * The rules below are deliberately the same three lines they use (a grace
 * steals no metric time, a tuplet spans its outer value times its multiple, a
 * tremolo its outer or its first child) and the corpus keeps them honest:
 * a span that disagreed with the layout would put the mark on the wrong beat.
 *
 * TOP-LEVEL RESTS ONLY. A rest inside a tuplet or a grace is passed over for
 * time but never recorded, because the key the layouts give it does not carry
 * its container index — every rest in one container would answer to the same
 * name. Containers still advance the cursor exactly as they do everywhere
 * else, so a rest AFTER one is found at the right offset.
 */
import {
  isGrace,
  isTimedEvent,
  isTremolo,
  isTuplet,
  type MnxSequenceItem,
  type MnxStructure
} from './mnx.ts';
import { syntheticEventKey } from './noteKeys.ts';
import {
  ZERO,
  add,
  compare,
  fromSafeFraction,
  multiply,
  noteDuration,
  type Rational
} from './time.ts';

/** Same spelling as the layout's and the compiler's walks. */
const integer = (value: number) => fromSafeFraction({ num: value, den: 1 });

/** One drawn rest, with the written extent it occupies. */
export interface RestSpan {
  /** What the layouts emit as `data-source-id` for this rest's glyph. */
  key: string;
  partIndex: number;
  staffIndex: number;
  /** Per staff, as every other key coordinate counts it. */
  voiceIndex: number;
  measureIndex: number;
  /** Metric offset from the start of the written bar, and the rest's length. */
  start: Rational;
  duration: Rational;
}

/**
 * The metric length a top-level sequence item occupies.
 *
 * `space` is the awkward one. `sequenceItemKind` calls it an event — it is
 * timed and it spaces like one — but its duration is a FRACTION of a whole
 * note (`[1, 4]` is a beat of 4/4), not a note value, so `noteDuration` has
 * nothing to read and throws. It draws nothing and can hold no rest; all it
 * has to do here is push the cursor along by the right amount, or every rest
 * after one in the bar would be found on the wrong beat.
 */
function itemDuration(item: MnxSequenceItem): Rational {
  if (isTimedEvent(item)) {
    const duration = item.duration as unknown;
    if (Array.isArray(duration)) {
      const [num, den] = duration as [number, number];
      return Number.isFinite(num) && Number.isFinite(den) && den !== 0
        ? fromSafeFraction({ num, den })
        : ZERO;
    }
    return noteDuration(item.duration);
  }
  // A grace note steals its time from a neighbour; it adds none of its own.
  if (isGrace(item)) return ZERO;
  if (isTuplet(item)) {
    return multiply(noteDuration(item.outer.duration), integer(item.outer.multiple));
  }
  if (isTremolo(item)) {
    if (item.outer) {
      return multiply(noteDuration(item.outer.duration), integer(item.outer.multiple ?? 1));
    }
    return item.content[0] ? noteDuration(item.content[0].duration) : ZERO;
  }
  return ZERO;
}

/** Every drawn rest in the document, in document order. */
export function restSpansOf(doc: MnxStructure): RestSpan[] {
  const spans: RestSpan[] = [];
  (doc.parts ?? []).forEach((part, partIndex) => {
    (part.measures ?? []).forEach((measure, measureIndex) => {
      // Voices counted PER STAFF — the same counting `noteWalk` and both
      // layouts do, so the key spelled here is the key that was drawn.
      const voiceByStaff = new Map<number, number>();
      (measure.sequences ?? []).forEach(sequence => {
        const staffIndex = sequence.staff ?? 1;
        const voiceIndex = (voiceByStaff.get(staffIndex) ?? -1) + 1;
        voiceByStaff.set(staffIndex, voiceIndex);
        let cursor = ZERO;
        (sequence.content ?? []).forEach((item, eventIndex) => {
          const duration = itemDuration(item);
          if (isTimedEvent(item) && item.rest) {
            spans.push({
              key: item.id ?? syntheticEventKey({
                partIndex,
                measureIndex,
                staffIndex,
                voiceIndex,
                eventIndex
              }),
              partIndex,
              staffIndex,
              voiceIndex,
              measureIndex,
              start: cursor,
              duration
            });
          }
          cursor = add(cursor, duration);
        });
      });
    });
  });
  return spans;
}

/**
 * The rests a written position falls inside — one per voice at most, and
 * normally one in total.
 *
 * Half-open: a rest owns its onset and not its end, so the playhead arriving
 * exactly at the next event has already left this one. A zero-length rest
 * (nothing in MNX produces one, but a hand-written document can) is owned at
 * its onset rather than being unreachable.
 */
export function restsAt(
  spans: readonly RestSpan[],
  measureIndex: number,
  metricOffset: Rational
): RestSpan[] {
  return spans.filter(span => {
    if (span.measureIndex !== measureIndex) return false;
    if (compare(metricOffset, span.start) < 0) return false;
    return compare(span.duration, ZERO) === 0
      ? compare(metricOffset, span.start) === 0
      : compare(metricOffset, add(span.start, span.duration)) < 0;
  });
}
