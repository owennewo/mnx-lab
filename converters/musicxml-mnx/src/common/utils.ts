import {
  MnxEvent,
  MnxNoteValue,
  MnxPitch,
  MnxSequence,
  MnxSequenceItem,
  MnxTuplet,
  isGrace,
  isTimedEvent,
  isTuplet
} from './types.js';

// Mapping from MusicXML type names to MNX base duration strings
const TYPE_MAP_TO_MNX: Record<string, string> = {
  'whole': 'whole',
  'half': 'half',
  'quarter': 'quarter',
  'eighth': 'eighth',
  '16th': '16th',
  '32nd': '32nd',
  '64th': '64th',
  '128th': '128th',
  'sixteenth': '16th',
  'thirty-second': '32nd'
};

// Mapping from MNX base duration strings to MusicXML type names
const TYPE_MAP_TO_XML: Record<string, string> = {
  'whole': 'whole',
  'half': 'half',
  'quarter': 'quarter',
  'eighth': 'eighth',
  '16th': '16th',
  '32nd': '32nd',
  '64th': '64th',
  '128th': '128th'
};

const BASE_RATIOS: Record<string, number> = {
  'whole': 4.0,
  'half': 2.0,
  'quarter': 1.0,
  'eighth': 0.5,
  '16th': 0.25,
  '32nd': 0.125,
  '64th': 0.0625,
  '128th': 0.03125
};

/**
 * Calculates MNX duration base and dots from a MusicXML duration value.
 */
export function calculateMnxDuration(
  duration: number,
  divisions: number,
  typeXml?: string,
  dotsCount: number = 0
): { base: string; dots?: number } {
  // If XML type is specified, try to map it directly
  if (typeXml) {
    const mappedBase = TYPE_MAP_TO_MNX[typeXml.toLowerCase()];
    if (mappedBase) {
      return dotsCount > 0 ? { base: mappedBase, dots: dotsCount } : { base: mappedBase };
    }
  }

  // Fallback to mathematical ratio calculation
  const ratio = duration / divisions;
  
  // Find closest matching ratio
  let bestBase = 'quarter';
  let bestDots = 0;
  let minDiff = Infinity;

  for (const [base, baseRatio] of Object.entries(BASE_RATIOS)) {
    for (let dots = 0; dots <= 3; dots++) {
      const multiplier = 2 - Math.pow(2, -dots);
      const testRatio = baseRatio * multiplier;
      const diff = Math.abs(ratio - testRatio);
      if (diff < minDiff) {
        minDiff = diff;
        bestBase = base;
        bestDots = dots;
      }
    }
  }

  return bestDots > 0 ? { base: bestBase, dots: bestDots } : { base: bestBase };
}

/**
 * Calculates MusicXML duration integer from MNX base and dots.
 */
export function calculateXmlDuration(
  base: string,
  dots: number = 0,
  divisions: number
): number {
  const normBase = TYPE_MAP_TO_XML[base] || 'quarter';
  const baseRatio = BASE_RATIOS[normBase] || 1.0;
  const multiplier = 2 - Math.pow(2, -dots);
  const ratio = baseRatio * multiplier;
  return Math.round(ratio * divisions);
}

/**
 * Gets the MusicXML type string from MNX base string.
 */
export function getXmlNoteType(base: string): string {
  return TYPE_MAP_TO_XML[base] || 'quarter';
}

/**
 * ID management helpers for roundtripping
 */
export function addIdSuffix(id: string, suffix: 'std' | 'tab'): string {
  return `${id}_${suffix}`;
}

export function stripIdSuffix(id: string): { originalId: string; suffix?: 'std' | 'tab' } {
  if (id.endsWith('_std')) {
    return { originalId: id.slice(0, -4), suffix: 'std' };
  }
  if (id.endsWith('_tab')) {
    return { originalId: id.slice(0, -4), suffix: 'tab' };
  }
  return { originalId: id };
}

/**
 * Pitch helper: converts steps/alterations/octaves to pitches and strings
 */
export function createPitchKey(pitch: MnxPitch): string {
  const alterStr = pitch.alter === 1 ? '#' : pitch.alter === -1 ? 'b' : '';
  return `${pitch.step.toLowerCase()}${alterStr}/${pitch.octave}`;
}

/**
 * A position expressed in some unit → a reduced MNX `rhythmic-position`
 * fraction.
 *
 * MNX measures metric positions as a fraction OF A WHOLE NOTE, so a MusicXML
 * position in divisions converts with `denominator = divisions * 4` (divisions
 * count per quarter). This is the unit `harmony.location`, `tempo.location` and
 * `segno.location` all share.
 */
export function reduceFraction(numerator: number, denominator: number): [number, number] {
  const divisor = gcd(Math.abs(Math.round(numerator)), Math.round(denominator)) || 1;
  return [Math.round(numerator) / divisor, Math.round(denominator) / divisor];
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Every timed or un-timed EVENT in a sequence, in document order, flattened
 * out of its containers.
 *
 * Grace and tuplet containers hold events, and everything downstream of the
 * parse — note-id generation, the standard/TAB merge — works on notes. Those
 * passes never needed to know about containers before there were any, and the
 * cost of teaching each of them separately would be that a note inside a
 * tuplet quietly stops getting an id. One walker, used by all of them, is why
 * that cannot happen.
 *
 * `spanDivisions` is the time the event really consumes: zero inside a grace
 * container (un-timed by definition) and the WRITTEN value scaled by the
 * tuplet's ratio inside a tuplet, which is the number an onset cursor needs
 * and the written value is not.
 *
 * `onset` and `slot` together ADDRESS the event. Onset alone stopped being an
 * address the moment grace notes existed: a grace and the note it decorates
 * share one, so a search by onset finds the grace and hands its fingerboard
 * position to the principal. `slot` counts events sharing an onset in document
 * order, and the two staves of one piece of music carry the same graces in the
 * same places, so the pair identifies the same event on both.
 */
export function* walkSequenceEvents(
  content: readonly MnxSequenceItem[],
  divisions: number
): Generator<{ event: MnxEvent; spanDivisions: number; onset: number; slot: number }> {
  let onset = 0;
  let slot = 0;
  const emit = (event: MnxEvent, spanDivisions: number) => {
    const yielded = { event, spanDivisions, onset, slot };
    if (spanDivisions > 0) {
      onset += spanDivisions;
      slot = 0;
    } else {
      slot++;
    }
    return yielded;
  };

  for (const item of content) {
    if (isGrace(item)) {
      for (const event of item.content) yield emit(event, 0);
      continue;
    }
    if (isTuplet(item)) {
      const scale = tupletScale(item);
      for (const event of item.content) {
        yield emit(
          event,
          Math.round(
            calculateXmlDuration(event.duration.base, event.duration.dots || 0, divisions) * scale
          )
        );
      }
      continue;
    }
    if (!isTimedEvent(item)) continue;
    yield emit(
      item,
      calculateXmlDuration(item.duration.base, item.duration.dots || 0, divisions)
    );
  }
}

/** Performed time ÷ written time for a tuplet — `outer / inner`. */
export function tupletScale(tuplet: MnxTuplet): number {
  const side = (part: { duration: MnxNoteValue; multiple: number }) =>
    noteValueInQuarters(part.duration.base, part.duration.dots || 0) * part.multiple;
  const inner = side(tuplet.inner);
  return inner > 0 ? side(tuplet.outer) / inner : 1;
}

/** A written note value in quarter notes — the unit `divisions` counts. */
export function noteValueInQuarters(base: string, dots = 0): number {
  return (BASE_RATIOS[TYPE_MAP_TO_XML[base] || 'quarter'] || 1) * (2 - Math.pow(2, -dots));
}

/**
 * Rebuilds a sequence's content with every event replaced by `map(event)`,
 * leaving containers exactly where they were.
 *
 * The counterpart to `walkSequenceEvents` for passes that TRANSFORM rather
 * than read — the notation/TAB split being the one that exists. Splitting is a
 * per-note operation, so without this each container would have to be
 * unwrapped and rewrapped at every call site, and the one that got forgotten
 * would silently drop its music.
 */
export function mapSequenceEvents(
  content: readonly MnxSequenceItem[],
  map: (event: MnxEvent) => MnxEvent
): MnxSequenceItem[] {
  return content.map(item =>
    isGrace(item) || isTuplet(item)
      ? { ...item, content: item.content.map(map) }
      : map(item as MnxEvent)
  );
}

/** Whole-note fractions as exact integers; every note value is dyadic, so a
 *  quarter of 1024 ticks is exact down to a triple-dotted 256th. */
const TICKS_PER_QUARTER = 1024;

/** The undotted values a `<normal-type>` may be stated in, longest first. */
const NORMAL_TYPE_BASES = [
  'whole', 'half', 'quarter', 'eighth', '16th', '32nd', '64th', '128th'
];

/**
 * One MNX tuplet restated in MusicXML's terms.
 *
 * MNX names a tuplet as `inner` events performed in the time of `outer`, each
 * side a note value × a count. MusicXML names it as `<actual-notes>` in the
 * time of `<normal-notes>`, both counted in ONE `<normal-type>` — so the two
 * sides have to be restated against a shared unit before they can be written.
 * MNX permits them to differ (3 eighths in the time of 1 quarter says the same
 * thing as 3 eighths in 2 eighths), and the longest note value that divides
 * both totals is the one an engraver would name.
 *
 * `innerTicks`/`outerTicks` come back too because `<duration>` needs the raw
 * ratio, not the reduced counts.
 *
 * Returns null when either side measures zero, or when no note value states
 * both in whole units — a ratio MusicXML cannot spell, which callers report
 * rather than round.
 */
export function tupletUnits(tuplet: MnxTuplet): {
  actualNotes: number;
  normalNotes: number;
  normalType: string;
  innerTicks: number;
  outerTicks: number;
} | null {
  const side = (part: { duration: MnxNoteValue; multiple: number }) =>
    Math.round(
      noteValueInQuarters(part.duration.base, part.duration.dots || 0) *
        part.multiple *
        TICKS_PER_QUARTER
    );
  const innerTicks = side(tuplet.inner);
  const outerTicks = side(tuplet.outer);
  if (innerTicks <= 0 || outerTicks <= 0) return null;

  for (const base of NORMAL_TYPE_BASES) {
    const unit = Math.round(noteValueInQuarters(base) * TICKS_PER_QUARTER);
    if (unit <= 0 || innerTicks % unit !== 0 || outerTicks % unit !== 0) continue;
    return {
      actualNotes: innerTicks / unit,
      normalNotes: outerTicks / unit,
      normalType: getXmlNoteType(base),
      innerTicks,
      outerTicks
    };
  }
  return null;
}

/**
 * The `<divisions>` a document needs so that every `<duration>` in it is a
 * whole number.
 *
 * `divisions` counts per quarter note, and a tuplet divides a written value by
 * its ratio: a triplet eighth at the default 8 divisions is 4 × 2/3, which is
 * not an integer, and rounding it is how a bar ends up a division short. Since
 * every plain note value is already exact at `base`, multiplying by the least
 * common multiple of the tuplets' `actual` counts makes the tuplets exact too
 * without disturbing anything else.
 *
 * Raising divisions is free — it is a per-document scale factor MusicXML
 * declares in `<attributes>` — so this is computed from the whole document up
 * front rather than negotiated per measure.
 */
export function divisionsFor(
  parts: readonly { measures: readonly { sequences?: readonly MnxSequence[] }[] }[],
  base: number
): number {
  let scale = 1;
  for (const part of parts) {
    for (const measure of part.measures) {
      for (const sequence of measure.sequences ?? []) {
        for (const item of sequence.content) {
          if (!isTuplet(item)) continue;
          const units = tupletUnits(item);
          if (units) scale = lcm(scale, units.actualNotes);
        }
      }
    }
  }
  return base * scale;
}

function lcm(a: number, b: number): number {
  return b === 0 ? a : (a * b) / gcd(a, b);
}
