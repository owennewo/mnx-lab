import type { TechniqueCollector } from './technique.ts';
import {
  isTimedEvent,
  isGrace,
  isTuplet,
  isTremolo,
  type MnxStructure,
  type MnxSequenceItem,
} from '../../model/mnx.ts';
import { noteKeyAt, forEachNoteAddress } from '../../model/noteWalk.ts';
import { occurrenceKey, syntheticEventKey } from '../../model/noteKeys.ts';
import { linearizePasses, type PerformedEntry } from '../../model/passes.ts';
import {
  ZERO,
  ONE,
  add,
  multiply,
  compare,
  noteDuration,
  tupletScale,
  fromSafeFraction,
  type Rational,
} from '../../model/time.ts';
import type { HorizontalPlan, MeasurePlan } from './spacing.ts';
import type { Primitive, SpatialIndex } from '../primitives.ts';
export { occurrenceKey } from '../../model/noteKeys.ts';

/** The one presentation switch shared by notation, tab and combined layouts. */
export function engravingEntries(
  doc: MnxStructure,
  unrolled: boolean,
): PerformedEntry[] | undefined {
  return unrolled ? linearizePasses(doc).entries : undefined;
}
export const writtenIndex = (plan: HorizontalPlan, index: number): number =>
  plan.measures[index]?.entry?.measureIndex ?? index;
const fraction = (value: [number, number]) => fromSafeFraction({ num: value[0], den: value[1] });
const integer = (value: number) => fromSafeFraction({ num: value, den: 1 });

/** Shared exact written extent for slice diagnostics and note membership. */
function writtenMeasureContent(
  doc: MnxStructure,
  measureIndex: number,
  includeEvents: boolean,
) {
  let meter = fraction([4, 4]);
  for (let i = 0; i <= measureIndex; i++) {
    const time = doc.global.measures[i]?.time;
    if (time) meter = fraction([time.count, time.unit]);
  }
  let length = ZERO;
  const spans: {
    key: string;
    start: Rational;
    duration: Rational;
    grace: boolean;
    previousGrace: boolean;
  }[] = [];
  doc.parts?.forEach((part, pi) => {
    const voices = new Map<number, number>();
    part.measures[measureIndex]?.sequences?.forEach((seq) => {
      const staff = seq.staff ?? 1;
      const voice = (voices.get(staff) ?? -1) + 1;
      voices.set(staff, voice);
      const walk = (
        item: MnxSequenceItem,
        start: Rational,
        scale: Rational,
        ei: number,
        path: number[],
        grace = false,
        previousGrace = false,
      ): Rational => {
        if (path.length > 32) return ZERO;
        if (Array.isArray((item as { duration?: unknown }).duration))
          return multiply(
            fraction((item as unknown as { duration: [number, number] }).duration),
            scale,
          );
        const record = (event: typeof item, duration: Rational, childPath = path) => {
          if (!isTimedEvent(event)) return;
          if (includeEvents)
            spans.push({
              key:
                event.id ??
                syntheticEventKey({
                  partIndex: pi,
                  measureIndex,
                  staffIndex: staff,
                  voiceIndex: voice,
                  eventIndex: ei,
                  containerIndex: childPath.length ? childPath : undefined,
                }),
              start,
              duration,
              grace,
              previousGrace,
            });
          event.notes?.forEach((note, ni) =>
            spans.push({
              key: noteKeyAt(
                note,
                measureIndex,
                voice,
                ei,
                ni,
                childPath.length ? childPath : undefined,
                pi,
                staff,
              ),
              start,
              duration,
              grace,
              previousGrace,
            }),
          );
        };
        if (isTimedEvent(item)) {
          const duration = grace ? ZERO : multiply(noteDuration(item.duration), scale);
          record(item, duration);
          return duration;
        }
        if (isGrace(item)) {
          item.content.forEach((child, i) =>
            walk(child, start, scale, ei, [...path, i], true, item.graceType === 'stealPrevious'),
          );
          return ZERO;
        }
        if (isTuplet(item)) {
          let cursor = start;
          item.content.forEach((child, i) => {
            cursor = add(
              cursor,
              walk(
                child,
                cursor,
                multiply(scale, tupletScale(item)),
                ei,
                [...path, i],
                grace,
                previousGrace,
              ),
            );
          });
          return grace
            ? ZERO
            : multiply(
                multiply(noteDuration(item.outer.duration), integer(item.outer.multiple)),
                scale,
              );
        }
        if (isTremolo(item)) {
          const duration = multiply(
            item.outer
              ? multiply(noteDuration(item.outer.duration), integer(item.outer.multiple ?? 1))
              : item.content[0]
                ? noteDuration(item.content[0].duration)
                : ZERO,
            scale,
          );
          item.content.forEach((child, i) => record(child, duration, [...path, i]));
          return duration;
        }
        return ZERO;
      };
      let cursor = ZERO;
      seq.content.forEach((item, ei) => {
        cursor = add(cursor, walk(item, cursor, ONE, ei, []));
      });
      if (compare(cursor, length) > 0) length = cursor;
    });
  });
  if (compare(length, ZERO) === 0) length = meter;
  return { length, spans };
}

/** Explicit zero/start and full-length/end boundaries do not truncate a bar. */
export function isPartialEntry(doc: MnxStructure, entry: PerformedEntry): boolean {
  if (entry.from && compare(fraction(entry.from), ZERO) > 0) return true;
  if (!entry.until) return false;
  const { length } = writtenMeasureContent(doc, entry.measureIndex, false);
  return compare(fraction(entry.until), length) < 0;
}

/** Whole-bar geometry and half-open playback membership are different sets.
 * Exact comparisons also keep a tuplet crossing a slice boundary selectable. */
export function performedKeys(
  doc: MnxStructure,
  entry: PerformedEntry,
  includeEvents = false,
): Set<string> {
  const result = new Set<string>();
  const { length, spans } = writtenMeasureContent(doc, entry.measureIndex, includeEvents);
  const from = entry.from ? fraction(entry.from) : ZERO;
  const until = entry.until ? fraction(entry.until) : length;
  for (const span of spans) {
    const inside = span.grace
      ? compare(span.start, from) >= 0 &&
        (compare(span.start, until) < 0 ||
          (span.previousGrace && compare(span.start, until) === 0 && compare(until, length) === 0))
      : compare(span.start, until) < 0 && compare(add(span.start, span.duration), from) > 0;
    if (inside) result.add(span.key);
  }
  return result;
}

export function qualifyMeasure(
  doc: MnxStructure,
  measure: MeasurePlan,
  primitives: Primitive[],
  start: number,
  index: SpatialIndex,
  selectedIds: readonly string[] = [],
): void {
  const entry = measure.entry;
  if (!entry) return;
  const performed = performedKeys(doc, entry, true);
  const locations = new Map<
    string,
    { measureIndex: number; voiceIndex: number; eventIndex: number }
  >();
  forEachNoteAddress(doc, (address) => {
    if (address.measureIndex === entry.measureIndex) locations.set(address.key, address);
  });
  for (const primitive of primitives.slice(start)) {
    if (!primitive.sourceId) continue;
    const key = primitive.sourceId;
    primitive.sourceId = occurrenceKey(key, entry.ordinal);
    primitive.writtenSourceId = key;
    if (
      selectedIds.includes(key) &&
      /notehead|fret-number|rest/.test(primitive.className ?? '') &&
      !primitive.className?.split(' ').includes('selected')
    ) {
      primitive.className = `${primitive.className ?? ''} selected`;
      if ('fill' in primitive || primitive.kind === 'glyph' || primitive.kind === 'text')
        primitive.fill = 'oklch(0.7 0.15 190)';
    }
    if (!performed.has(key)) {
      primitive.className = `${primitive.className ?? ''} unperformed`;
      primitive.title = 'Outside this performed slice';
      primitive.opacity = 0.3;
    } else {
      const location = index.get(key) ?? locations.get(key);
      if (location) index.set(primitive.sourceId, location);
    }
  }
  // Written keys are never activation targets in an occurrence layout.
  for (const primitive of primitives.slice(start)) {
    if (primitive.sourceId) index.delete(primitive.sourceId.replace(/^w\d+:/, ''));
  }
}
export function emitOccurrenceLabel(
  measure: MeasurePlan,
  staffTop: number,
  primitives: Primitive[],
): void {
  if (!measure.entry || measure.entry.occurrence < 2) return;
  primitives.push({
    kind: 'text',
    text: `${measure.entry.occurrence}×`,
    x: measure.contentStartX,
    y: staffTop - 2.5,
    font: 'body',
    size: 1.2,
    className: 'occurrence-label',
  });
}

/** Resolve a reference along this visit's actual path, stopping at a jump.
 * Cross-jump ties may only join the immediately following visit. */
export function occurrenceTarget<T>(
  plan: HorizontalPlan,
  start: number,
  target: string,
  anchors: Map<string, T>,
  crossJump = false,
): string | undefined {
  if (!plan.measures[start].entry) return target;
  for (let i = start; i < plan.measures.length; i++) {
    const entry = plan.measures[i].entry!;
    const jumped =
      i > start &&
      (entry.measureIndex !== writtenIndex(plan, i - 1) + 1 ||
        entry.via === 'jump' ||
        entry.via === 'loop' ||
        entry.via === 'ending');
    if (i > start && (crossJump ? i !== start + 1 || !jumped : jumped)) break;
    if (crossJump && i === start) continue;
    const key = occurrenceKey(target, entry.ordinal);
    if (anchors.has(key)) return key;
  }
  return undefined;
}

/** Lift written spans into contiguous performed runs, clipped at slice bounds. */
export function performedSpans<
  T extends { startIdx: number; endIdx: number; startT: number; endT: number | null },
>(spans: T[], plan: HorizontalPlan): T[] {
  if (!plan.measures.some((m) => m.entry)) return spans;
  return spans.flatMap((span) => {
    const runs: T[] = [];
    let run: T | undefined;
    plan.measures.forEach((measure, index) => {
      const entry = measure.entry!;
      const written = entry.measureIndex;
      if (written < span.startIdx || written > span.endIdx) {
        run = undefined;
        return;
      }
      const startT = Math.max(
        written === span.startIdx ? span.startT : 0,
        entry.from ? entry.from[0] / entry.from[1] : 0,
      );
      const endT = Math.min(
        written === span.endIdx && span.endT !== null
          ? span.endT
          : measure.timeSig.count / measure.timeSig.unit,
        entry.until ? entry.until[0] / entry.until[1] : Infinity,
      );
      if (endT <= startT) {
        run = undefined;
        return;
      }
      if (
        run &&
        index === run.endIdx + 1 &&
        written === writtenIndex(plan, index - 1) + 1 &&
        !entry.from &&
        !plan.measures[index - 1].entry?.until
      ) {
        run.endIdx = index;
        run.endT = endT;
      } else {
        run = { ...span, startIdx: index, endIdx: index, startT, endT };
        runs.push(run);
      }
    });
    return runs;
  });
}

/** Qualify only geometry references; authored technique blocks remain untouched. */
export function qualifyTechniques(collector: TechniqueCollector, plan: HorizontalPlan): void {
  for (const site of collector.sites) {
    if (site.entryIndex === undefined || !site.technique) continue;
    const technique = { ...site.technique };
    if (technique.hammerPull)
      technique.hammerPull = {
        ...technique.hammerPull,
        target:
          occurrenceTarget(
            plan,
            site.entryIndex,
            technique.hammerPull.target,
            collector.byNoteId,
          ) ?? '',
      };
    if (technique.slide?.target)
      technique.slide = {
        ...technique.slide,
        target:
          occurrenceTarget(plan, site.entryIndex, technique.slide.target, collector.byNoteId) ?? '',
      };
    site.technique = technique;
  }
}
