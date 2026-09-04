import {
  MnxBeam,
  MnxBendPoint,
  MnxEvent,
  MnxEventLyricLine,
  MnxEventLyrics,
  MnxGlobalMeasure,
  MnxGrace,
  MnxHarmonic,
  MnxHarmony,
  MnxHarmonyStep,
  MnxNote,
  MnxPart,
  MnxPartMeasure,
  MnxPitch,
  MnxSequence,
  MnxSequenceItem,
  MnxTabTechnique,
  MnxTuplet,
  STANDARD_GUITAR_STRINGS
} from '../common/types.js';
import type { Element, Document } from '../common/xml.js';
import {
  renderChordSymbol,
  stepToText,
  XML_KIND_TO_QUALITY
} from '../common/harmony.js';
import {
  calculateMnxDuration,
  createPitchKey,
  noteValueInQuarters,
  reduceFraction,
  walkSequenceEvents
} from '../common/utils.js';
import { findDirectChild, findDirectChildren, getChildText, getChildInt } from './musicxml.js';

/** `getChildFloat` restricted to a direct child (the shared helper searches deep). */
function getChildFloatOf(parent: Element, tagName: string): number | null {
  const child = findDirectChild(parent, tagName);
  const text = child?.textContent?.trim();
  return text ? parseFloat(text) : null;
}

interface AttributeState {
  divisions: number;
  fifths: number | null;
  beats: number | null;
  beatType: number | null;
  transposeChromatic: number;
  transposeDiatonic: number;
  clefSign: string | null;
  clefLine: number | null;
  /** How many staves this part prints on — `<staves>`, 1 unless stated. */
  staves: number;
  /** Clef per staff. A grand staff states two, and `state.clefSign` alone
   *  cannot hold both — it kept only whichever came first. */
  clefByStaff: Map<number, { sign: string | null; line: number | null }>;
  staffLines: number;
  tuning: MnxPitch[] | null;
  capo: number;
}

/** MusicXML note-type name → MNX duration base (for `<beat-unit>`). */
const TYPE_TO_MNX_BASE: Record<string, string> = {
  whole: 'whole', half: 'half', quarter: 'quarter', eighth: 'eighth',
  '16th': '16th', '32nd': '32nd', '64th': '64th', '128th': '128th'
};

// Chromatic semitone offsets for each diatonic step (C=0)
const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const STEP_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/**
 * Estimates diatonic step shift from chromatic semitone shift.
 * Used when <diatonic> is absent in MusicXML <transpose> element.
 */
function getDiatonicFromChromatic(chromatic: number): number {
  // Each octave = 7 diatonic steps, 12 semitones
  const octaves = Math.trunc(chromatic / 12);
  const remainder = chromatic - octaves * 12;
  // Map remaining semitones to nearest diatonic step count
  const semitoneToStep = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
  const remainderStep = semitoneToStep[Math.abs(remainder)] * Math.sign(remainder);
  return octaves * 7 + remainderStep;
}

function pitchToMidi(pitch: MnxPitch): number {
  return (pitch.octave + 1) * 12 + STEP_SEMITONES[pitch.step] + (pitch.alter || 0);
}

/**
 * Spells a MIDI note number as an MNX pitch. `alterHint` is the source's
 * `<alter>`, tried first so a recovered note keeps the flat/sharp spelling the
 * engraver intended; otherwise prefer a natural, then a flat, then a sharp.
 */
function spellPitch(midi: number, alterHint: number | null): MnxPitch {
  const pitchClass = ((midi % 12) + 12) % 12;
  const candidates = alterHint ? [alterHint, 0, -1, 1, -2, 2] : [0, -1, 1, -2, 2];

  for (const alter of candidates) {
    const naturalPc = (((pitchClass - alter) % 12) + 12) % 12;
    const step = STEP_NAMES.find(s => STEP_SEMITONES[s] === naturalPc);
    if (step) {
      const octave = Math.floor((midi - STEP_SEMITONES[step] - alter) / 12) - 1;
      return alter !== 0 ? { step, octave, alter } : { step, octave };
    }
  }
  return { step: 'C', octave: Math.floor(midi / 12) - 1 };
}

// ---------- Grace and tuplet marks (MusicXML flags every note) ----------

/** A `<grace>` note's shape, shared by every note of one run. */
interface GraceMark {
  slash: boolean;
  graceType?: MnxGrace['graceType'];
}

/** A `<time-modification>` plus whichever half of the `<tuplet>` bracket
 *  this note carries. */
interface TupletMark {
  actualNotes: number;
  normalNotes: number;
  normalType: string;
  start: boolean;
  stop: boolean;
}

/** One note placed on a voice's timeline, with the container marks it carried. */
interface PendingEvent {
  onset: number;
  /** Divisions this event consumes — 0 for a grace, the PERFORMED value in a
   *  tuplet. Kept rather than recomputed from the MNX duration, which states
   *  the WRITTEN value and would leave the cursor a third short in a triplet. */
  span: number;
  event: MnxEvent;
  grace?: GraceMark;
  tuplet?: TupletMark;
}

/**
 * `<grace>` → the shape of the MNX container this note belongs in.
 *
 * MusicXML says the steal direction three ways and this accepts all of them:
 * the explicit `steal-time-previous` / `steal-time-following` / `make-time`
 * attributes when an exporter writes them, and otherwise the near-universal
 * convention that a SLASHED grace is the acciaccatura crushed in before the
 * beat while an unslashed one is the appoggiatura that delays what follows.
 * `slash` defaults to yes in MusicXML, so a bare `<grace/>` reads as the
 * acciaccatura — which is what it draws as.
 */
function parseGrace(noteEl: Element): GraceMark | undefined {
  const graceEl = findDirectChild(noteEl, 'grace');
  if (!graceEl) return undefined;
  // `hasAttribute`, not `getAttribute() !== null`: xmldom answers `''` for an
  // attribute that is not there, so the null check reads every grace note as
  // carrying every attribute at once.
  const slash = graceEl.getAttribute('slash') !== 'no';
  const graceType = graceEl.hasAttribute('make-time')
    ? 'makeTime'
    : graceEl.hasAttribute('steal-time-following')
      ? 'stealFollowing'
      : graceEl.hasAttribute('steal-time-previous')
        ? 'stealPrevious'
        : slash
          ? 'stealPrevious'
          : 'stealFollowing';
  return { slash, graceType };
}

/**
 * `<time-modification>` (+ the `<tuplet>` bracket in `<notations>`) → this
 * note's tuplet membership.
 *
 * `<time-modification>` is the load-bearing half: it is what makes the
 * arithmetic work, and an exporter that writes no bracket at all still writes
 * it. `<tuplet>` only says where a group's bracket opens and closes, so its
 * absence is normal rather than an error — the caller infers the boundaries
 * from the ratio and the accumulated written time instead.
 */
function parseTupletMarks(noteEl: Element): TupletMark | undefined {
  const modEl = findDirectChild(noteEl, 'time-modification');
  if (!modEl) return undefined;
  const actualNotes = getChildInt(modEl, 'actual-notes');
  const normalNotes = getChildInt(modEl, 'normal-notes');
  if (!actualNotes || !normalNotes || actualNotes <= 0 || normalNotes <= 0) return undefined;

  // `<normal-type>` is optional; without it the normal notes are the same value
  // as the written `<type>`, which is what "3 eighths in the time of 2" means
  // when nobody says otherwise.
  const normalType =
    getChildText(modEl, 'normal-type') || getChildText(noteEl, 'type') || 'quarter';

  let start = false;
  let stop = false;
  const notationsEl = findDirectChild(noteEl, 'notations');
  for (const tupletEl of notationsEl ? findDirectChildren(notationsEl, 'tuplet') : []) {
    const type = tupletEl.getAttribute('type');
    if (type === 'start') start = true;
    else if (type === 'stop') stop = true;
  }

  return { actualNotes, normalNotes, normalType, start, stop };
}

/** The undotted values a tuplet's two sides may be stated in, longest first. */
const TUPLET_UNIT_BASES = [
  'whole', 'half', 'quarter', 'eighth', '16th', '32nd', '64th', '128th'
];

/** Whole-note fractions as exact integers — every note value is dyadic. */
const TUPLET_TICKS_PER_QUARTER = 1024;

/**
 * MusicXML's per-note ratio → MNX's once-per-group `inner`/`outer` pair.
 *
 * MNX states each side as a note value × a count, and the count has to be a
 * whole number — so both sides are measured against ONE unit, and the longest
 * note value that divides them both is the one an engraver would name.
 * `<normal-type>` is usually that unit already; it stops being it when the
 * group is unequal (a quarter and an eighth inside a triplet), which is why
 * this searches rather than assuming.
 *
 * The INNER total comes from the events themselves, not from `actual-notes`:
 * the ratio says how time is compressed, the notes say how much is written,
 * and an unequal group is exactly where those two stop agreeing.
 */
function tupletSides(
  events: readonly MnxEvent[],
  mark: TupletMark
): { inner: MnxTuplet['inner']; outer: MnxTuplet['outer'] } | null {
  const innerTicks = events.reduce(
    (sum, event) =>
      sum +
      Math.round(
        noteValueInQuarters(event.duration.base, event.duration.dots || 0) *
          TUPLET_TICKS_PER_QUARTER
      ),
    0
  );
  if (innerTicks <= 0) return null;
  if ((innerTicks * mark.normalNotes) % mark.actualNotes !== 0) return null;
  const outerTicks = (innerTicks * mark.normalNotes) / mark.actualNotes;

  // `<normal-type>` FIRST, then longest-first as the fallback.
  //
  // Several units can state the same ratio — six quarters in the time of four
  // is also three halves in the time of two — and they are equal arithmetic but
  // not equal notation: the first prints a 6 over the bracket, the second a 3.
  // The source already said which one it means, so preferring the longest unit
  // silently renumbers the tuplet. The search remains for unequal groups, where
  // `<normal-type>` does not divide the written total and no single unit is
  // implied by the source.
  for (const base of [mark.normalType, ...TUPLET_UNIT_BASES]) {
    const unit = Math.round(noteValueInQuarters(base) * TUPLET_TICKS_PER_QUARTER);
    if (unit <= 0 || innerTicks % unit !== 0 || outerTicks % unit !== 0) continue;
    return {
      inner: { duration: { base }, multiple: innerTicks / unit },
      outer: { duration: { base }, multiple: outerTicks / unit }
    };
  }
  return null;
}

/**
 * Whether a buffered run has accumulated the written time its ratio calls for.
 *
 * The fallback boundary for sources that write no `<tuplet>` bracket: six
 * eighths flagged 3:2 are two triplets, and without this they would collapse
 * into one six-note tuplet that plays at two thirds of the right length. A run
 * that DOES carry brackets has already been closed by its `stop` before this
 * is consulted.
 */
function tupletRunIsFull(run: readonly PendingEvent[]): boolean {
  const mark = run[0]?.tuplet;
  if (!mark) return false;
  const written = run.reduce(
    (sum, item) =>
      sum + noteValueInQuarters(item.event.duration.base, item.event.duration.dots || 0),
    0
  );
  return written >= mark.actualNotes * noteValueInQuarters(mark.normalType);
}

export class Aligner {
  /**
   * Notes whose `<pitch>` was unusable in the source and could not be recovered
   * from a fingerboard position. Tracked so the notation/TAB merge gets a
   * second chance to adopt the aligned TAB note's (recovered) pitch.
   */
  private unresolvedPitches = new WeakSet<MnxNote>();

  /**
   * Spanner pairs found during parsing, resolved to ids by
   * `linkSpannerTargets` once the parts are assembled.
   *
   * Same shape of problem as `linkTechniqueTargets`: MNX states a tie or a
   * slur as an id REFERENCE from the first element to the last, and MusicXML
   * states it as start/stop markers on a pair. The destination is not knowable
   * while parsing (it may be measures away, and note ids are not minted until
   * the part is final), so parsing records object references and the final
   * pass turns them into ids.
   */
  private tieLinks: { from: MnxNote; to: MnxNote }[] = [];
  private slurLinks: {
    from: { event: MnxEvent; note: MnxNote };
    to: { event: MnxEvent; note: MnxNote };
    side?: 'up' | 'down';
  }[] = [];

  /**
   * MusicXML `<beam>` values per event, by beam number (1 = primary).
   *
   * Collected while parsing and turned into MNX's nested groups by `linkBeams`,
   * for the same reason the other spanners wait: a beam group can cross a
   * barline, and MNX puts it on the measure of its FIRST event while naming
   * events in later ones.
   */
  private beamMarks = new Map<MnxEvent, Map<number, string>>();

  /** Open spanner starts, per part. Ties key on voice + pitch because that is
   *  what a tie joins; slurs key on MusicXML's own `number` attribute. */
  private openTies = new Map<string, MnxNote>();
  private openSlurs = new Map<string, { event: MnxEvent; note: MnxNote; side?: 'up' | 'down' }>();

  /** Counts surfaced to the caller via `ImportOptions.onWarning`. */
  public readonly stats = { malformedPitches: 0, recoveredPitches: 0 };

  /**
   * Things in the source this converter could not carry across whole, in the
   * caller's words rather than a count. `stats` answers "how many notes were
   * broken"; this answers "what did you decide to do about a construct MNX
   * says differently" — a tuplet whose ratio does not reduce, say — which is
   * one line, not a tally.
   */
  public readonly warnings: string[] = [];

  /** Raw `<ending>` marks for the part being parsed; collapsed by resolveEndings. */
  private endingMarks: { measureIndex: number; type: string; numbers: number[] }[] = [];

  /** Chord symbols seen while walking measures; placed by resolveHarmonies. */
  /**
   * Segno / Fine / D.S. marks, with their position in the measure.
   *
   * MusicXML states a jump twice — once as printed text (`<words>D.S.</words>`)
   * and once as playback (`<sound dalsegno="...">`) — and MNX states it once, as
   * a structural object on the global measure. The `<sound>` half is the one to
   * trust: the words are free text and say nothing a machine can rely on.
   */
  private jumpMarks: {
    measureIndex: number;
    position: number;
    divisions: number;
    kind: 'segno' | 'fine' | 'dalsegno';
  }[] = [];

  /** `<octave-shift>` starts and stops, with their place in the part. */
  private ottavaMarks: {
    measureIndex: number;
    position: number;
    divisions: number;
    value: number | null;
  }[] = [];

  private harmonyMarks: {
    measureIndex: number;
    /** Position within the measure, in MusicXML divisions (per quarter note). */
    position: number;
    divisions: number;
    harmony: Omit<MnxHarmony, 'location'>;
  }[] = [];

  /**
   * Collapses `<ending>` marks into MNX voltas.
   *
   * MNX puts ONE `ending` on the measure a bracket starts, spanning `duration`
   * measures. MusicXML has no single convention for expressing that, and the
   * two in the wild look nothing alike:
   *
   *   - the common form — `start` on the first measure, `stop` on the last;
   *   - Soundslice's form — `start` AND `stop` on *every* measure of the
   *     bracket (Sun-did-glide writes 44 marks for one 22-bar volta).
   *
   * Both collapse to the same thing here: a run of consecutive measures sharing
   * an ending number is one bracket.
   */
  private resolveEndings(globalMeasures: MnxGlobalMeasure[]): void {
    const starts = new Map<number, number[]>();
    const stops = new Set<number>();
    const discontinued = new Set<number>();

    for (const mark of this.endingMarks) {
      if (mark.type === 'start') {
        if (!starts.has(mark.measureIndex)) starts.set(mark.measureIndex, mark.numbers);
      } else {
        stops.add(mark.measureIndex);
        if (mark.type === 'discontinue') discontinued.add(mark.measureIndex);
      }
    }

    const consumed = new Set<number>();
    for (const startIndex of [...starts.keys()].sort((a, b) => a - b)) {
      if (consumed.has(startIndex)) continue;
      const numbers = starts.get(startIndex)!;

      // Absorb following measures that re-declare the same ending (Soundslice).
      let last = startIndex;
      while (
        starts.has(last + 1) &&
        String(starts.get(last + 1)) === String(numbers)
      ) {
        last++;
      }

      // Then honour an explicit stop at or after that point (the common form,
      // where only the final measure is marked) — but never reach past the
      // start of the NEXT bracket, which usually follows immediately.
      const nextStart = [...starts.keys()].filter(i => i > last).sort((a, b) => a - b)[0];
      const stopIndex = [...stops].filter(i => i >= last).sort((a, b) => a - b)[0];
      if (stopIndex !== undefined && (nextStart === undefined || stopIndex < nextStart)) {
        last = Math.max(last, stopIndex);
      }

      for (let i = startIndex; i <= last; i++) consumed.add(i);

      if (!globalMeasures[startIndex]) globalMeasures[startIndex] = {};
      const duration = last - startIndex + 1;
      globalMeasures[startIndex].ending = {
        ...(numbers.length > 0 ? { numbers } : {}),
        ...(duration > 1 ? { duration } : {}),
        ...(discontinued.has(last) ? { open: true } : {})
      };
    }
  }

  /**
   * `<harmony>` → structure. MusicXML's `<kind>` vocabulary is hyphenated
   * (`dominant-ninth`); MNX Lab's is the same list in camelCase, which is the
   * house style the CG has been enforcing.
   *
   * `<kind text>` is the *displayed suffix* — `m7` in `Am7` — so a display
   * override has to be reassembled from root + suffix + bass before it can be
   * compared with the canonical spelling.
   */
  private parseHarmony(harmonyEl: Element): Omit<MnxHarmony, 'location'> | null {
    const kindEl = findDirectChild(harmonyEl, 'kind');
    if (!kindEl) return null;
    const kind = kindEl.textContent?.trim() ?? '';
    if (kind === 'none') return { quality: 'none' };

    const readStep = (el: Element | null, prefix: string): MnxHarmonyStep | null => {
      const step = el ? getChildText(el, `${prefix}-step`) : null;
      if (!step) return null;
      const alter = el ? getChildFloatOf(el, `${prefix}-alter`) : null;
      return alter ? { step: step as MnxHarmonyStep['step'], alter } : { step: step as MnxHarmonyStep['step'] };
    };

    const root = readStep(findDirectChild(harmonyEl, 'root'), 'root');
    const bass = readStep(findDirectChild(harmonyEl, 'bass'), 'bass');
    const quality = XML_KIND_TO_QUALITY[kind];
    const degrees = findDirectChildren(harmonyEl, 'degree')
      .map(el => {
        const value = getChildInt(el, 'degree-value');
        const type = getChildText(el, 'degree-type');
        if (value === null || !type) return null;
        const alter = getChildFloatOf(el, 'degree-alter');
        return {
          value,
          ...(alter ? { alter } : {}),
          type: type as 'add' | 'alter' | 'subtract'
        };
      })
      .filter((degree): degree is NonNullable<typeof degree> => degree !== null);

    const displayed = kindEl.getAttribute('text');
    if (!root || quality === undefined) {
      // Unmappable, but not lost: keep whatever can be displayed.
      const text = displayed || kind;
      return { ...(root ? { root } : {}), quality: 'other', text };
    }

    const harmony: Omit<MnxHarmony, 'location'> = {
      root,
      quality,
      ...(bass ? { bass } : {}),
      ...(degrees.length > 0 ? { degrees } : {})
    };
    if (displayed === null) return harmony;

    const literal = `${stepToText(root)}${displayed}${bass ? `/${stepToText(bass)}` : ''}`;
    return literal === renderChordSymbol(harmony) ? harmony : { ...harmony, text: literal };
  }

  /**
   * `<octave-shift>` → MNX's signed octave count, or null for a stop.
   *
   * MusicXML names the direction the WRITTEN notes move, so an 8va — which
   * sounds an octave above what is printed — is `type="down"`. MNX states the
   * shift in sounding terms, so the sign flips.
   */
  private ottavaValue(shiftEl: Element): number | null {
    const type = shiftEl.getAttribute('type');
    if (type === 'stop') return null;
    const size = Number(shiftEl.getAttribute('size') ?? '8');
    const octaves = size === 15 ? 2 : size === 22 ? 3 : 1;
    return type === 'down' ? octaves : -octaves;
  }

  /**
   * Pairs `<octave-shift>` starts with their stops and files them on the part.
   *
   * MNX states an ottava once, on the measure it STARTS in, with an `end` that
   * names the measure it finishes in — so the end measure needs an id, and
   * MusicXML measures have none we can reuse. One is minted, but only for a
   * measure something actually points at: an id nothing references is noise.
   *
   * An unpaired start is dropped rather than run to the end of the part; a
   * dangling spanner is worse than an absent one, as with technique targets.
   */
  private resolveOttavas(measures: MnxPartMeasure[], globalMeasures: MnxGlobalMeasure[]): void {
    const fractionOf = (mark: { position: number; divisions: number }): [number, number] =>
      reduceFraction(mark.position, mark.divisions * 4);

    let open: (typeof this.ottavaMarks)[number] | null = null;
    for (const mark of this.ottavaMarks) {
      if (mark.value !== null) {
        open = mark;
        continue;
      }
      if (!open) continue;
      const start = measures[open.measureIndex];
      if (start) {
        const endMeasure = globalMeasures[mark.measureIndex] ?? (globalMeasures[mark.measureIndex] = {});
        endMeasure.id ??= `m${mark.measureIndex + 1}`;
        (start.ottavas ??= []).push({
          value: open.value as number,
          position: { fraction: fractionOf(open) },
          end: { measure: endMeasure.id, position: { fraction: fractionOf(mark) } }
        });
      }
      open = null;
    }
    this.ottavaMarks = [];
  }

  /**
   * Which navigation mark, if any, a `<direction>` carries.
   *
   * Read from `<sound>` rather than from the printed `<words>`: "D.S.",
   * "D.S. al Fine", "Dal Segno" and a dozen other spellings all mean the same
   * thing, and `<sound dalsegno>` means it unambiguously. `<segno/>` is the one
   * case that is also a `<direction-type>`, because it prints a glyph.
   */
  private classifyJumpDirection(directionEl: Element): 'segno' | 'fine' | 'dalsegno' | null {
    const soundEl = findDirectChild(directionEl, 'sound');
    if (soundEl?.getAttribute('dalsegno')) return 'dalsegno';
    if (soundEl?.getAttribute('fine')) return 'fine';
    if (soundEl?.getAttribute('segno')) return 'segno';
    const typeEl = findDirectChild(directionEl, 'direction-type');
    if (typeEl && findDirectChild(typeEl, 'segno')) return 'segno';
    return null;
  }

  /**
   * Navigation marks → `segno` / `fine` / `jump` on the global measure.
   *
   * The jump's TYPE is not stated by MusicXML: `<sound dalsegno>` is the same
   * element whether the player stops at a Fine or plays to the end. MNX
   * distinguishes them (`dsalfine` vs `segno`), and the score itself settles
   * it — a D.S. is *al Fine* exactly when there is a Fine to stop at.
   */
  private resolveJumps(globalMeasures: MnxGlobalMeasure[]): void {
    const hasFine = this.jumpMarks.some(mark => mark.kind === 'fine');
    for (const mark of this.jumpMarks) {
      // MusicXML `divisions` counts per QUARTER; MNX fractions are of a WHOLE.
      const location = { fraction: reduceFraction(mark.position, mark.divisions * 4) };
      if (!globalMeasures[mark.measureIndex]) globalMeasures[mark.measureIndex] = {};
      const measure = globalMeasures[mark.measureIndex];
      if (mark.kind === 'segno') measure.segno ??= { location };
      else if (mark.kind === 'fine') measure.fine ??= { location };
      else measure.jump ??= { type: hasFine ? 'dsalfine' : 'segno', location };
    }
  }

  /**
   * Chord symbols → `global.measures[i]._x.mnxLab.harmonies`.
   *
   * MusicXML hangs `<harmony>` off a part, so a score whose chords are printed
   * over two staves states them twice; MNX Lab keeps them once on the global
   * timeline. Duplicates at the same position are therefore dropped rather than
   * accumulated — the second copy is the same musical fact, not a second chord.
   */
  private resolveHarmonies(globalMeasures: MnxGlobalMeasure[]): void {
    for (const mark of this.harmonyMarks) {
      // MusicXML `divisions` counts per QUARTER; MNX fractions are of a WHOLE.
      const fraction = reduceFraction(mark.position, mark.divisions * 4);
      if (!globalMeasures[mark.measureIndex]) globalMeasures[mark.measureIndex] = {};
      const measure = globalMeasures[mark.measureIndex];
      const existing = measure._x?.mnxLab?.harmonies ?? [];
      const key = `${fraction[0]}/${fraction[1]}`;
      if (existing.some(h => `${h.location.fraction[0]}/${h.location.fraction[1]}` === key)) {
        continue;
      }
      const harmonies = [...existing, { location: { fraction }, ...mark.harmony }].sort(
        (a, b) =>
          a.location.fraction[0] / a.location.fraction[1] -
          b.location.fraction[0] / b.location.fraction[1]
      );
      measure._x = { ...measure._x, mnxLab: { ...measure._x?.mnxLab, harmonies } };
    }
  }

  /**
   * Resolves the placeholder targets left by `parseTechnique`.
   *
   * MNX states hammer-on / pull-off / slide as an id REFERENCE to the
   * destination note; MusicXML states them as start/stop markers on a pair of
   * notes. The destination is the next note in the same voice, which is only
   * knowable once the voice is assembled — and, when a notation+TAB pair is
   * merged, only once ids are final. So this runs LAST, over the finished parts.
   *
   * A technique whose destination cannot be found is dropped rather than left
   * pointing at nothing: a dangling reference is worse than an absent one.
   */
  public linkTechniqueTargets(parts: MnxPart[]): void {
    parts.forEach((part, partIndex) => {
      // Flatten each voice across the whole part — a hammer-on can cross a
      // barline.
      const byVoice = new Map<string, MnxNote[]>();
      part.measures.forEach((measure, measureIndex) => {
        for (const sequence of measure.sequences ?? []) {
          const voice = sequence.voice ?? 'v1';
          const list = byVoice.get(voice) ?? [];
          let eventIndex = -1;
          for (const { event } of walkSequenceEvents(sequence.content ?? [], 8)) {
            eventIndex++;
            for (const [noteIndex, note] of (event.notes ?? []).entries()) {
              if (!note.id) {
                // The part has to be in the id. Without it a two-part score
                // mints `n-1-v1-0-0` twice, and an MNX id is document-wide:
                // colliding ids break every reference that names one (ties,
                // slurs, technique targets) and the note↔JSON highlight with
                // them. `parts` was 14 ids over 9 distinct values.
                note.id = `n-${partIndex + 1}-${measureIndex + 1}-${voice}-${eventIndex}-${noteIndex}`;
              }
              list.push(note);
            }
          }
          byVoice.set(voice, list);
        }
      });

      for (const notes of byVoice.values()) {
        for (const [index, note] of notes.entries()) {
          const technique = note._x?.mnxLab?.tab?.technique;
          if (!technique) continue;

          // The destination is the next note ON THE SAME STRING — a hammer-on
          // happens on one string, and with chords the immediately following
          // note is often a chord member on a different one. Fall back to the
          // next note when the source carries no positions.
          const string = note._x?.mnxLab?.string;
          const next =
            (string !== undefined
              ? notes.slice(index + 1).find(n => n._x?.mnxLab?.string === string)
              : undefined) ?? notes[index + 1];

          {
            const block = technique.hammerPull;
            if (block && !block.target) {
              if (next?.id) block.target = next.id;
              else delete technique.hammerPull;
            }
          }
          if (technique.slide && !technique.slide.target && next?.id) {
            technique.slide.target = next.id;
          }
          if (Object.keys(technique).length === 0) delete note._x!.mnxLab!.tab!.technique;
        }
      }
    });
  }

  /**
   * `<notations>` → `_x.mnxLab.tab.technique`.
   *
   * Two different parents, which is easy to get wrong: `<slide>`/`<glissando>`
   * hang off `<notations>`, while hammer-on / pull-off / bend live inside
   * `<notations><technical>`.
   *
   * Hammer-on/pull-off/slide targets are note-id references in MNX, but
   * start/stop markers in MusicXML. Rather than invent ids, only the START of
   * each is recorded — the destination is the next note in the voice, which the
   * exporter reconstructs. Where a target id is required by the schema it is
   * filled in by `linkTechniqueTargets` once the voice is assembled.
   */
  /**
   * Pairs up `<tied>` and `<slur>` start/stop markers into spanner links.
   *
   * Both are recorded as object references, not ids: ids are not minted until
   * `linkTechniqueTargets` runs over the finished parts, and a spanner can
   * cross a barline, so nothing here can name its destination yet.
   *
   * A tie joins two notes OF THE SAME PITCH in the same voice, which is what
   * the key is built from — MusicXML does not number ties, so pitch is the
   * only thing that pairs them when several are open at once (a tied chord).
   * Slurs carry their own `number`, so they key on that.
   *
   * `<tie>` (the sound element) is read only as a fallback for `<tied>` (the
   * notation), because a document may carry either or both and MNX has one
   * concept for the pair.
   */
  private collectSpanners(
    notationsEl: Element,
    noteEl: Element,
    voice: string,
    event: MnxEvent,
    note: MnxNote
  ): void {
    const pitchKey = `${voice}|${note.pitch.step}${note.pitch.alter ?? 0}${note.pitch.octave}`;

    const tiedEls = findDirectChildren(notationsEl, 'tied');
    const tieEls = tiedEls.length ? tiedEls : findDirectChildren(noteEl, 'tie');
    // A note can stop one tie and start another (a chain), and the stop must
    // be handled first so the chain links end-to-end rather than to itself.
    for (const type of ['stop', 'start'] as const) {
      for (const tieEl of tiedEls.length ? tiedEls : tieEls) {
        if (tieEl.getAttribute('type') !== type) continue;
        if (type === 'stop') {
          const from = this.openTies.get(pitchKey);
          if (from) {
            this.tieLinks.push({ from, to: note });
            this.openTies.delete(pitchKey);
          }
        } else {
          this.openTies.set(pitchKey, note);
        }
      }
    }

    for (const slurEl of findDirectChildren(notationsEl, 'slur')) {
      const type = slurEl.getAttribute('type');
      const key = `${voice}|${slurEl.getAttribute('number') ?? '1'}`;
      if (type === 'start') {
        const placement = slurEl.getAttribute('placement');
        this.openSlurs.set(key, {
          event,
          note,
          ...(placement === 'above' ? { side: 'up' as const } : {}),
          ...(placement === 'below' ? { side: 'down' as const } : {})
        });
      } else if (type === 'stop') {
        const from = this.openSlurs.get(key);
        // An unmatched stop is dropped rather than guessed at. So is an
        // unmatched START, by never being resolved — which is what keeps our
        // own exporter's legato-slide marker (a `<slur type="start">` with no
        // stop, written to distinguish a picked slide) from inventing a slur.
        if (from) {
          this.slurLinks.push({
            from: { event: from.event, note: from.note },
            to: { event, note },
            ...(from.side ? { side: from.side } : {})
          });
          this.openSlurs.delete(key);
        }
      }
    }
  }

  /**
   * Records the `<beam>` flags on one note or rest.
   *
   * `<beam>` is a child of `<note>`, not of `<notations>`. A chord repeats it on
   * every member, so only the principal note is offered here — the rest would
   * fight over the same event to no effect.
   */
  private collectBeams(noteEl: Element, event: MnxEvent): void {
    const beamEls = findDirectChildren(noteEl, 'beam');
    if (!beamEls.length) return;
    const values = new Map<number, string>();
    for (const beamEl of beamEls) {
      const number = Number(beamEl.getAttribute('number') ?? '1');
      const value = (beamEl.textContent ?? '').trim();
      if (Number.isFinite(number) && value) values.set(number, value);
    }
    if (values.size) this.beamMarks.set(event, values);
  }

  /**
   * Turns MusicXML's per-note beam flags into MNX's nested beam groups.
   *
   * The two models are the same shape at different addresses. MusicXML numbers
   * beams per note — `<beam number="2">begin</beam>` — and MNX nests them: the
   * top level is the primary beam, `beams` inside it are the secondaries over
   * sub-runs of the same events, and a nested group of ONE event with a
   * `direction` is a hook. So beam number N maps to nesting depth N, and the
   * whole conversion is one recursive scan.
   *
   * It runs over the part rather than the measure because a beam can cross a
   * barline: the group is attached to the measure holding its FIRST event and
   * names events in later ones, exactly as `beams-across-barlines` encodes it.
   */
  public linkBeams(parts: MnxPart[]): void {
    if (!this.beamMarks.size) return;

    for (const part of parts) {
      // Events in playing order per voice, each remembering the measure it
      // lives in — the group is filed under its first event's measure.
      const byVoice = new Map<string, { event: MnxEvent; measureIndex: number; grace: boolean }[]>();
      part.measures.forEach((measure, measureIndex) => {
        for (const sequence of measure.sequences ?? []) {
          const voice = sequence.voice ?? 'v1';
          const list = byVoice.get(voice) ?? [];
          for (const { event, spanDivisions } of walkSequenceEvents(sequence.content ?? [], 8)) {
            // Grace events are the un-timed ones, which is what makes them
            // separable here.
            list.push({ event, measureIndex, grace: spanDivisions === 0 });
          }
          byVoice.set(voice, list);
        }
      });

      for (const entries of byVoice.values()) {
        // A grace note sits INSIDE the beam of the notes around it without
        // joining it — the spec's own `beams-inner-grace-notes` beams ev1, ev3,
        // ev4, ev5 and says so in a comment. So the principal beam is scanned
        // over the timed events only, and any grace run is scanned as its own.
        const emit = (groups: { beam: MnxBeam; measureIndex: number }[]): void => {
          for (const group of groups) {
            const measure = part.measures[group.measureIndex];
            if (!measure) continue;
            (measure.beams ??= []).push(group.beam);
          }
        };
        emit(this.scanBeamLevel(entries.filter(e => !e.grace), 1));
        emit(this.scanBeamLevel(entries.filter(e => e.grace), 1));
      }
    }
  }

  /**
   * One beam level over a run of events, recursing into the next.
   *
   * `begin` opens, `continue` extends, `end` closes; a hook is its own
   * one-event group. An unterminated run is still emitted — a truncated group
   * is closer to the source than no beam at all, and dropping it would lose
   * every note in it.
   */
  private scanBeamLevel(
    entries: { event: MnxEvent; measureIndex: number }[],
    level: number
  ): { beam: MnxBeam; measureIndex: number }[] {
    const groups: { beam: MnxBeam; measureIndex: number }[] = [];
    let run: { event: MnxEvent; measureIndex: number }[] = [];

    const close = (): void => {
      if (!run.length) return;
      const nested = this.scanBeamLevel(run, level + 1);
      // One event with nothing under it is a FLAG, not a beam — a beam needs
      // two notes to join. Emitting it would draw a stub the source never had.
      if (run.length === 1 && !nested.length) {
        run = [];
        return;
      }
      const beam: MnxBeam = { events: run.map(e => this.beamEventId(e.event)) };
      if (nested.length) beam.beams = nested.map(n => n.beam);
      groups.push({ beam, measureIndex: run[0].measureIndex });
      run = [];
    };

    for (const entry of entries) {
      const value = this.beamMarks.get(entry.event)?.get(level);
      if (value === 'forward hook' || value === 'backward hook') {
        // A hook belongs to no run: it is a stub on one event, and it must not
        // interrupt the run around it.
        groups.push({
          beam: {
            events: [this.beamEventId(entry.event)],
            direction: value === 'forward hook' ? 'right' : 'left'
          },
          measureIndex: entry.measureIndex
        });
        continue;
      }
      if (value === 'begin') {
        close();
        run.push(entry);
      } else if (value === 'continue') {
        run.push(entry);
      } else if (value === 'end') {
        run.push(entry);
        close();
      } else {
        // No flag at this level ends any run in progress.
        close();
      }
    }
    close();
    return groups;
  }

  /** Beam membership is stated by id, so every beamed event needs one. */
  private beamEventId(event: MnxEvent): string {
    if (!event.id) event.id = `e-beam-${++this.beamIdCounter}`;
    return event.id;
  }

  private beamIdCounter = 0;

  /**
   * Turns the collected spanner pairs into MNX id references.
   *
   * Runs after `linkTechniqueTargets`, which mints every note id, so notes can
   * simply be named. Events are only given ids HERE and only when a slur
   * actually references them: an id nothing points at is noise in the output.
   *
   * A slur is stated event-to-event unless it has to be narrower. It has to be
   * when the same event starts more than one slur, or when the slur hangs off
   * a note that is not the event's first — both of which mean "this chord
   * member", and that is exactly when the spec's own examples use
   * `startNote`/`endNote`.
   */
  public linkSpannerTargets(parts: MnxPart[]): void {
    if (!this.tieLinks.length && !this.slurLinks.length) return;

    const needsId = new Set<MnxEvent>();
    for (const link of this.slurLinks) {
      needsId.add(link.from.event);
      needsId.add(link.to.event);
    }
    for (const part of parts) {
      part.measures.forEach((measure, measureIndex) => {
        for (const sequence of measure.sequences ?? []) {
          const voice = sequence.voice ?? 'v1';
          let eventIndex = -1;
          for (const { event } of walkSequenceEvents(sequence.content ?? [], 8)) {
            eventIndex++;
            if (needsId.has(event) && !event.id) {
              event.id = `e-${measureIndex + 1}-${voice}-${eventIndex}`;
            }
          }
        }
      });
    }

    for (const { from, to } of this.tieLinks) {
      if (!to.id) continue; // a dangling reference is worse than an absent one
      (from.ties ??= []).push({ target: to.id });
    }

    const startsPerEvent = new Map<MnxEvent, number>();
    for (const link of this.slurLinks) {
      startsPerEvent.set(link.from.event, (startsPerEvent.get(link.from.event) ?? 0) + 1);
    }
    for (const link of this.slurLinks) {
      const target = link.to.event.id;
      if (!target) continue;
      const noteSpecific =
        (startsPerEvent.get(link.from.event) ?? 0) > 1 ||
        link.from.event.notes?.[0] !== link.from.note;
      (link.from.event.slurs ??= []).push({
        ...(link.side ? { side: link.side } : {}),
        target,
        ...(noteSpecific && link.from.note.id ? { startNote: link.from.note.id } : {}),
        ...(noteSpecific && link.to.note.id ? { endNote: link.to.note.id } : {})
      });
    }
  }

  private parseTechnique(
    notationsEl: Element,
    techEl: Element | null
  ): MnxTabTechnique | undefined {
    const technique: MnxTabTechnique = {};
    let found = false;

    if (techEl) {
      // ONE adornment (extension v6): either MusicXML element reads as the
      // same hammerPull — the direction is implicit in the two pitches.
      const hammerOn = findDirectChild(techEl, 'hammer-on');
      const pullOff = findDirectChild(techEl, 'pull-off');
      if (hammerOn?.getAttribute('type') === 'start' || pullOff?.getAttribute('type') === 'start') {
        technique.hammerPull = { target: '' };
        found = true;
      }

      // MusicXML states a bend as a SEQUENCE of `<bend>` gestures, each an
      // interval to travel from wherever the string currently is; MNX Lab
      // states the resulting curve as absolute control points. Both use
      // semitones, so only the accumulation differs.
      const bendEls = findDirectChildren(techEl, 'bend');
      if (bendEls.length > 0) {
        const points = this.accumulateBendPoints(bendEls);
        if (points) {
          technique.bend = { points };
          found = true;
        }
      }

      // MusicXML models only natural and artificial harmonics; Guitar Pro's
      // pinch/tap/semi/feedback ride along in <other-technical> (see the
      // exporter) so a round trip through MusicXML keeps them.
      const harmonicEl = findDirectChild(techEl, 'harmonic');
      if (harmonicEl) {
        const refined = findDirectChildren(techEl, 'other-technical')
          .map(el => /^harmonic:(\w+)$/.exec(el.textContent?.trim() ?? '')?.[1])
          .find(Boolean);
        const type = (refined ?? (findDirectChild(harmonicEl, 'artificial')
          ? 'artificial'
          : 'natural')) as MnxHarmonic['type'];
        technique.harmonic = { type };
        found = true;
      }

      // MusicXML 4.0 has no palm-mute element — the very gap w3c-cg/mnx#63
      // opens with — so it travels as <other-technical>.
      if (
        findDirectChildren(techEl, 'other-technical').some(
          el => el.textContent?.trim() === 'palm-mute'
        )
      ) {
        technique.palmMute = true;
        found = true;
      }
    }

    const slideEl =
      findDirectChild(notationsEl, 'slide') ?? findDirectChild(notationsEl, 'glissando');
    if (slideEl && slideEl.getAttribute('type') === 'start') {
      // A slurred slide is picked once — that is what "legato" means here.
      // MusicXML carries no other way to distinguish it from a shift slide.
      const slurred = findDirectChildren(notationsEl, 'slur').some(
        s => s.getAttribute('type') === 'start'
      );
      technique.slide = { type: slurred ? 'legato' : 'shift' };
      found = true;
    }

    return found ? technique : undefined;
  }

  /**
   * A run of `<bend>` elements → an absolute bend curve.
   *
   * Each `<bend-alter>` is a signed interval from the current bent pitch, so
   * the points accumulate. A `<pre-bend/>` means the string is already bent
   * when struck, which is a first point at position 0 with a non-zero alter;
   * everything else starts from the unbent pitch.
   *
   * MusicXML carries no timing for any of this, so the points are spread evenly
   * across the note — the one thing this round trip normalises rather than
   * preserves (docs/mnx-extensions.md §bends).
   */
  private accumulateBendPoints(bendEls: Element[]): MnxBendPoint[] | null {
    const alters: number[] = [];
    let current = 0;
    let prebent = false;

    for (const [index, bendEl] of bendEls.entries()) {
      const delta = getChildFloatOf(bendEl, 'bend-alter') ?? 0;
      if (index === 0 && findDirectChild(bendEl, 'pre-bend')) {
        prebent = true;
        current = Math.abs(delta);
        alters.push(current);
        continue;
      }
      if (index === 0) alters.push(0);
      // <release> travels back down even when the interval is written positive.
      const signed = findDirectChild(bendEl, 'release') ? -Math.abs(delta) : delta;
      current += signed;
      alters.push(current);
    }

    if (alters.length < 2 || alters.every(alter => alter === 0)) {
      // A pre-bend with no following gesture is still a bend: hold the pitch.
      if (prebent && alters.length === 1) alters.push(alters[0]);
      else return null;
    }

    const last = alters.length - 1;
    return alters.map((alter, index) => ({ position: index / last, alter }));
  }

  /**
   * Lyric line ids (MusicXML `<lyric number>`) in order of first appearance,
   * so `global.lyrics.lineOrder` reflects verse order rather than object-key
   * ordering.
   */
  public readonly lyricLines: string[] = [];

  /**
   * `<lyric>` → MNX `event.lyrics.lines`. Lyrics belong to the EVENT in MNX but
   * hang off the note in MusicXML, so they are collected here and attached to
   * the event the note produced.
   */
  private parseLyrics(noteEl: Element): MnxEventLyrics | undefined {
    const lyricEls = findDirectChildren(noteEl, 'lyric');
    if (lyricEls.length === 0) return undefined;

    const lines: Record<string, MnxEventLyricLine> = {};
    for (const [index, lyricEl] of lyricEls.entries()) {
      const text = getChildText(lyricEl, 'text');
      // `<extend/>` melismas carry no text of their own — nothing to place.
      if (text === null) continue;

      const lineId =
        lyricEl.getAttribute('number') || lyricEl.getAttribute('name') || `${index + 1}`;
      if (!this.lyricLines.includes(lineId)) this.lyricLines.push(lineId);

      const syllabic = getChildText(lyricEl, 'syllabic');
      lines[lineId] = {
        text,
        // MusicXML syllabic maps 1:1 onto MNX's lyric line types.
        type:
          syllabic === 'begin'
            ? 'start'
            : syllabic === 'middle'
              ? 'middle'
              : syllabic === 'end'
                ? 'end'
                : 'whole'
      };
    }

    return Object.keys(lines).length > 0 ? { lines } : undefined;
  }

  /**
   * Parses a `<part>` element from MusicXML into an MnxPart.
   */
  public parsePart(
    partEl: Element,
    partName: string,
    partId: string,
    globalMeasures: MnxGlobalMeasure[]
  ): MnxPart {
    const measures: MnxPartMeasure[] = [];
    const measureEls = findDirectChildren(partEl, 'measure');
    // Barlines repeat identically in every part, so each part re-resolves the
    // same voltas onto the shared globalMeasures — idempotent, not additive.
    this.endingMarks = [];
    this.harmonyMarks = [];

    // Initial attribute state
    const state: AttributeState = {
      divisions: 1,
      fifths: null,
      beats: null,
      beatType: null,
      transposeChromatic: 0,
      transposeDiatonic: 0,
      clefSign: null,
      clefLine: null,
      staves: 1,
      clefByStaff: new Map(),
      staffLines: 5,
      tuning: null,
      capo: 0
    };

    // MNX attributes persist until changed, so key/time/clef are emitted
    // change-only (including their first appearance) — re-declaring an
    // unchanged signature every measure is redundant and can read as a
    // courtesy-signature display request.
    let lastEmittedFifths: number | null = null;
    let lastEmittedTime: string | null = null;
    const lastEmittedClefs = new Map<number, string>();

    for (let mIdx = 0; mIdx < measureEls.length; mIdx++) {
      const mEl = measureEls[mIdx];
      const measureNum = parseInt(mEl.getAttribute('number') || `${mIdx + 1}`, 10);

      // 1. Process Attributes if present
      const attributesEl = findDirectChild(mEl, 'attributes');
      if (attributesEl) {
        const divs = getChildInt(attributesEl, 'divisions');
        if (divs !== null) state.divisions = divs;

        const keyEl = findDirectChild(attributesEl, 'key');
        if (keyEl) {
          state.fifths = getChildInt(keyEl, 'fifths');
        }

        const timeEl = findDirectChild(attributesEl, 'time');
        if (timeEl) {
          state.beats = getChildInt(timeEl, 'beats');
          state.beatType = getChildInt(timeEl, 'beat-type');
        }

        const stavesDeclared = getChildInt(attributesEl, 'staves');
        if (stavesDeclared && stavesDeclared > 0) state.staves = stavesDeclared;

        // EVERY `<clef>`, keyed by its `number` — a grand staff states one per
        // staff, and reading only the first left the bass staff with the treble
        // clef. `state.clefSign` stays as staff 1 for the single-staff path.
        for (const clefEl of findDirectChildren(attributesEl, 'clef')) {
          const staff = Number(clefEl.getAttribute('number') ?? '1') || 1;
          const sign = getChildText(clefEl, 'sign');
          const line = getChildInt(clefEl, 'line');
          state.clefByStaff.set(staff, { sign, line });
          if (staff === 1) {
            state.clefSign = sign;
            state.clefLine = line;
          }
        }

        const transposeEl = findDirectChild(attributesEl, 'transpose');
        if (transposeEl) {
          state.transposeChromatic = getChildInt(transposeEl, 'chromatic') || 0;
          const diatonicRaw = getChildInt(transposeEl, 'diatonic');
          // If <diatonic> is absent, estimate it from the chromatic value
          state.transposeDiatonic = diatonicRaw !== null
            ? diatonicRaw
            : getDiatonicFromChromatic(state.transposeChromatic);
        }

        const staffDetailsEl = findDirectChild(attributesEl, 'staff-details');
        if (staffDetailsEl) {
          const lines = getChildInt(staffDetailsEl, 'staff-lines');
          if (lines !== null) state.staffLines = lines;

          // A capo raises every string; `_x.mnxLab` fret numbers are measured from
          // it, so losing it detunes the whole part (Sun-did-glide is capo 4 —
          // a major third).
          const capo = getChildInt(staffDetailsEl, 'capo');
          if (capo !== null && capo > 0) state.capo = capo;

          const staffTuningEls = findDirectChildren(staffDetailsEl, 'staff-tuning');
          if (staffTuningEls.length > 0) {
            const tunings: MnxPitch[] = [];
            for (const st of staffTuningEls) {
              const line = parseInt(st.getAttribute('line') || '1', 10);
              const step = getChildText(st, 'tuning-step') as any;
              const octave = getChildInt(st, 'tuning-octave');
              const alter = getChildInt(st, 'tuning-alter') || undefined;
              if (step && octave !== null) {
                tunings[line - 1] = { step, octave, alter };
              }
            }
            state.tuning = tunings.filter(Boolean); // keep only non-empty
          }
        }
      }

      // Update Global Measures details (change-only)
      if (!globalMeasures[mIdx]) {
        globalMeasures[mIdx] = {};
      }
      const globalM = globalMeasures[mIdx];

      if (state.fifths !== null && state.fifths !== lastEmittedFifths) {
        if (globalM.key === undefined) {
          globalM.key = { fifths: state.fifths };
        }
        lastEmittedFifths = state.fifths;
      }
      const timeKey = state.beats !== null && state.beatType !== null
        ? `${state.beats}/${state.beatType}`
        : null;
      if (timeKey !== null && timeKey !== lastEmittedTime) {
        if (globalM.time === undefined) {
          globalM.time = { count: state.beats!, unit: state.beatType! };
        }
        lastEmittedTime = timeKey;
      }

      // Rehearsal marks and section names. Only directions that appear BEFORE
      // any note are considered: a `<words>` attached mid-measure is a chord
      // symbol or performance instruction, not a section name.
      //
      // The two are separate objects, not one: `<rehearsal>` is an index into
      // the score, `<words>` here names a formal unit of the piece. See
      // docs/mnx-extensions.md §labels.
      for (const child of Array.from(mEl.childNodes)) {
        if (child.nodeType !== 1) continue;
        const el = child as Element;
        if (el.tagName === 'note') break; // past the head of the measure
        if (el.tagName !== 'direction') continue;

        const typeEl = findDirectChild(el, 'direction-type');
        if (!typeEl) continue;
        // A jump's printed text ("Fine", "D.S. al Fine") is a navigation mark,
        // not the name of a formal section.
        if (this.classifyJumpDirection(el)) continue;
        const marker = getChildText(typeEl, 'rehearsal');
        const sectionText = getChildText(typeEl, 'words');
        if (marker) globalM.rehearsal = { label: marker };
        if (sectionText) globalM.section = { label: sectionText };
      }

      // Metronome marks: prefer the notated `<metronome>` (it carries the beat
      // unit) and fall back to `<sound tempo>`, which is per quarter by
      // definition.
      for (const directionEl of findDirectChildren(mEl, 'direction')) {
        if (globalM.tempos) break; // one mark per measure is enough
        const metronomeEl = findDirectChild(
          findDirectChild(directionEl, 'direction-type') ?? directionEl,
          'metronome'
        );
        const soundEl = findDirectChild(directionEl, 'sound');
        const bpm = metronomeEl
          ? getChildFloatOf(metronomeEl, 'per-minute')
          : Number(soundEl?.getAttribute('tempo') ?? NaN);

        if (bpm !== null && Number.isFinite(bpm) && bpm > 0) {
          const unit = metronomeEl ? getChildText(metronomeEl, 'beat-unit') : null;
          const dots = metronomeEl
            ? findDirectChildren(metronomeEl, 'beat-unit-dot').length
            : 0;
          globalM.tempos = [
            {
              bpm,
              value: {
                base: unit ? TYPE_TO_MNX_BASE[unit] ?? 'quarter' : 'quarter',
                ...(dots > 0 ? { dots } : {})
              }
            }
          ];
        }
      }

      // Barlines carry three separate things: the line style, repeat signs, and
      // volta (ending) brackets.
      const barlineEls = findDirectChildren(mEl, 'barline');
      for (const bar of barlineEls) {
        const repeatOnThisBarline = findDirectChild(bar, 'repeat');
        const style = getChildText(bar, 'bar-style');
        // A `<bar-style>` sitting on a barline that also carries a `<repeat>`
        // is HOW THE REPEAT IS DRAWN — heavy-light for a forward repeat,
        // light-heavy for a backward one — not a barline of its own. MNX says
        // that once, with repeatStart/repeatEnd, and the spec's own examples
        // carry no `barline` beside them. Emitting both draws the repeat and
        // then a thick bar over it.
        // An explicit `regular` is kept rather than dropped as "the default":
        // the two formats do not agree on what an absent barline means (see
        // core-musicxml-repeat-barlines.md), so a source that says which one it
        // wants is stating something worth carrying.
        if (style && !repeatOnThisBarline) {
          globalM.barline = { type: this.mapBarlineStyle(style) };
        }

        // `<repeat direction="forward">` opens a section, `"backward"` closes
        // it. `times` on a backward repeat is the number of PLAYS (Soundslice
        // writes times="3"); MNX carries the same meaning in `repeatEnd.times`.
        const repeatEl = repeatOnThisBarline;
        if (repeatEl) {
          const direction = repeatEl.getAttribute('direction');
          if (direction === 'forward') {
            globalM.repeatStart = {};
          } else if (direction === 'backward') {
            const times = parseInt(repeatEl.getAttribute('times') || '', 10);
            globalM.repeatEnd = Number.isFinite(times) && times > 2 ? { times } : {};
          }
        }

        // Voltas are accumulated across measures and resolved once the whole
        // part is parsed — see resolveEndings().
        const endingEl = findDirectChild(bar, 'ending');
        if (endingEl) {
          const type = endingEl.getAttribute('type'); // start | stop | discontinue
          const numbers = (endingEl.getAttribute('number') || '')
            .split(/[,\s]+/)
            .map(n => parseInt(n, 10))
            .filter(n => Number.isFinite(n));
          this.endingMarks.push({ measureIndex: mIdx, type: type ?? 'start', numbers });
        }
      }

      // 2. Parse child elements chronologically to handle backup/forward
      const sequences = this.parseMeasureEvents(mEl, state, mIdx);

      // TAB "clefs" are not emitted: the MNX schema's clef-sign enum is C|F|G,
      // and in the tab extension tab-ness is a part-level view declaration
      // (_x.mnxLab.tab.staffKind), not a clef. See docs/mnx-extensions.md.
      // Real clefs are emitted change-only (first appearance + changes).
      const clefsList: any[] = [];
      const multiStaff = state.staves > 1;
      const staffClefs = state.clefByStaff.size
        ? [...state.clefByStaff.entries()].sort((a, b) => a[0] - b[0])
        : ([[1, { sign: state.clefSign, line: state.clefLine }]] as [
            number,
            { sign: string | null; line: number | null }
          ][]);
      for (const [staff, clef] of staffClefs) {
        const key = clef.sign ? `${staff}:${clef.sign}/${clef.line}` : null;
        if (clef.sign && clef.sign !== 'TAB' && key !== lastEmittedClefs.get(staff)) {
          clefsList.push({
            clef: {
              sign: clef.sign,
              staffPosition: clef.line ? -clef.line : undefined
            },
            // Only stated when there is more than one staff to tell apart —
            // `staff: 1` on a single-staff part is noise the spec omits.
            ...(multiStaff ? { staff } : {})
          });
        }
        if (key !== null) lastEmittedClefs.set(staff, key);
      }

      measures.push({
        ...(clefsList.length > 0 ? { clefs: clefsList } : {}),
        sequences
      });
    }

    this.resolveEndings(globalMeasures);
    this.resolveHarmonies(globalMeasures);
    this.resolveJumps(globalMeasures);
    this.resolveOttavas(measures, globalMeasures);

    const labExtension: any = {};
    if (state.tuning) {
      // state.tuning is indexed by MusicXML staff-tuning line (line 1 = bottom
      // visual line = lowest-pitched string). Convert to explicit string
      // numbers: string 1 = highest-pitched string.
      const numStrings = state.tuning.length;
      labExtension.strings = state.tuning.map((pitch, idx) => ({
        string: numStrings - idx,
        pitch
      }));
    }
    if (state.capo > 0) {
      labExtension.capo = state.capo;
    }
    if (state.clefSign === 'TAB') {
      labExtension.tab = { staffKind: 'tab' };
      // Tab without its own <staff-tuning>: write the standard declaration
      // explicitly — no consumer assumes an instrument any more.
      if (!labExtension.strings) {
        labExtension.strings = STANDARD_GUITAR_STRINGS.map(s => ({
          string: s.string,
          pitch: { ...s.pitch }
        }));
      }
    }

    // Build W3C MNX transposition metadata block (top-level on the part, not in _x)
    const transpositionBlock = (state.transposeChromatic !== 0 || state.transposeDiatonic !== 0)
      ? {
          transposition: {
            interval: {
              halfSteps: state.transposeChromatic,
              staffDistance: state.transposeDiatonic
            }
          }
        }
      : {};

    return {
      id: partId,
      name: partName,
      // Stated only when it is more than one: `staves: 1` is the default and
      // the spec's own single-staff examples omit it.
      ...(state.staves > 1 ? { staves: state.staves } : {}),
      measures,
      ...transpositionBlock,
      ...(Object.keys(labExtension).length > 0
        ? { _x: { mnxLab: labExtension } }
        : {})
    };
  }

  /** MusicXML bar-style → MNX barline type (per the MNX barline-type enum). */
  private mapBarlineStyle(style: string): NonNullable<NonNullable<MnxGlobalMeasure['barline']>['type']> {
    switch (style.toLowerCase()) {
      case 'regular': return 'regular';
      case 'dotted': return 'dotted';
      case 'dashed': return 'dashed';
      case 'heavy': return 'heavy';
      case 'light-light': return 'double';
      case 'light-heavy': return 'final';
      case 'heavy-light': return 'heavyLight';
      case 'heavy-heavy': return 'heavyHeavy';
      case 'tick': return 'tick';
      case 'short': return 'short';
      case 'none': return 'noBarline';
      default: return 'regular';
    }
  }

  private parseMeasureEvents(
    measureEl: Element,
    state: AttributeState,
    measureIdx: number
  ): MnxSequence[] {
    let currentTime = 0;
    
    // voiceName -> list of { onset: number, event: MnxEvent }
    const voiceEvents = new Map<string, Array<PendingEvent>>();

    // voiceName -> the most recent note event, so a following `<chord/>` note
    // can be stacked onto it (see the isChord branch below)
    const lastNoteEventByVoice = new Map<string, MnxEvent>();

    // The onset of the most recently STARTED event. An `<octave-shift>` stop
    // sits after the last note it covers, while MNX names that note's onset.
    let lastEventOnset = 0;

    /** Which staff each event was written on, for multi-staff parts. */
    const eventStaves = new Map<MnxEvent, number>();

    // We iterate through XML child nodes to preserve exact document order
    for (let i = 0; i < measureEl.childNodes.length; i++) {
      const node = measureEl.childNodes[i];
      if (node.nodeType !== 1) continue;
      const el = node as Element;

      if (el.tagName === 'direction') {
        const shiftEl = findDirectChild(
          findDirectChild(el, 'direction-type') ?? el,
          'octave-shift'
        );
        if (shiftEl) {
          const value = this.ottavaValue(shiftEl);
          // A start sits BEFORE the first note it covers, so the cursor is
          // already that note's onset. A stop sits AFTER the last one, and MNX
          // names that note's onset — not the point past it.
          const position =
            (value === null ? lastEventOnset : currentTime) + (getChildInt(el, 'offset') || 0);
          this.ottavaMarks.push({
            measureIndex: measureIdx,
            position,
            divisions: state.divisions,
            value
          });
        }
        const kind = this.classifyJumpDirection(el);
        if (kind) {
          this.jumpMarks.push({
            measureIndex: measureIdx,
            position: currentTime + (getChildInt(el, 'offset') || 0),
            divisions: state.divisions,
            kind
          });
        }
      }

      if (el.tagName === 'harmony') {
        // `<harmony>` sits in the stream just before the note it belongs to,
        // optionally nudged by `<offset>` (also in divisions).
        const harmony = this.parseHarmony(el);
        if (harmony) {
          this.harmonyMarks.push({
            measureIndex: measureIdx,
            position: currentTime + (getChildInt(el, 'offset') || 0),
            divisions: state.divisions,
            harmony
          });
        }
      } else if (el.tagName === 'backup') {
        const dur = getChildInt(el, 'duration') || 0;
        currentTime -= dur;
      } else if (el.tagName === 'forward') {
        const dur = getChildInt(el, 'duration') || 0;
        currentTime += dur;
      } else if (el.tagName === 'note') {
        const isChord = findDirectChild(el, 'chord') !== null;
        const isRest = findDirectChild(el, 'rest') !== null;
        const voice = getChildText(el, 'voice') || '1';
        // A `<grace>` note carries no `<duration>` at all, so this is 0 and the
        // time cursor does not move — which is the whole of what "un-timed"
        // means for the arithmetic below.
        const rawDur = getChildInt(el, 'duration') || 0;
        const grace = parseGrace(el);
        const tuplet = parseTupletMarks(el);

        // MNX stores the WRITTEN value, which for a tuplet member is not what
        // `<duration>` says — `<type>` is, and is used first. The scaling is
        // undone anyway so the ratio fallback stays right for the exporters
        // that omit `<type>`.
        const mnxDur = calculateMnxDuration(
          tuplet ? (rawDur * tuplet.actualNotes) / tuplet.normalNotes : rawDur,
          state.divisions,
          getChildText(el, 'type') || undefined,
          findDirectChildren(el, 'dot').length
        );

        // Parsed before the rest/note split: MusicXML allows `<lyric>` on ANY
        // `<note>`, including a `<rest>`, and real exporters use it — most of
        // Sun-did-glide's syllables sit on rests. Lyrics live on the MNX event,
        // and a rest is an event, so they carry over unchanged.
        const lyrics = this.parseLyrics(el);

        if (isRest) {
          const restEvent: MnxEvent = {
            duration: mnxDur,
            ...(lyrics ? { lyrics } : {}),
            rest: {}
          };
          // A rest carries `<beam>` too, and a beamed rest sits INSIDE a beam
          // group — miss it and the group splits in two around it.
          this.collectBeams(el, restEvent);
          if (state.staves > 1) {
            const staff = getChildInt(el, 'staff');
            if (staff) eventStaves.set(restEvent, staff);
          }
          lastEventOnset = currentTime;
          if (!voiceEvents.has(voice)) voiceEvents.set(voice, []);
          voiceEvents.get(voice)!.push({
            onset: currentTime,
            span: rawDur,
            event: restEvent,
            ...(grace ? { grace } : {}),
            ...(tuplet ? { tuplet } : {})
          });
          currentTime += rawDur;
        } else {
          // Parse Pitch. `<step>` is validated rather than trusted: real-world
          // exporters emit blank/garbage steps, and feeding one to
          // transposePitch yields NaN, which JSON.stringify silently writes as
          // `null` — producing schema-invalid MNX with no error anywhere.
          const pitchEl = findDirectChild(el, 'pitch');
          let mnxPitch: MnxPitch | undefined;
          let pitchUnresolved = false;
          let alterRaw: number | null = null;

          if (pitchEl) {
            const step = (getChildText(pitchEl, 'step') || '').trim().toUpperCase();
            const octave = getChildInt(pitchEl, 'octave');
            alterRaw = getChildInt(pitchEl, 'alter');

            if ((STEP_NAMES as readonly string[]).includes(step) && octave !== null) {
              mnxPitch = this.transposePitch(
                { step: step as MnxPitch['step'], octave, alter: alterRaw ?? undefined },
                state.transposeChromatic,
                state.transposeDiatonic
              );
            } else {
              pitchUnresolved = true;
              this.stats.malformedPitches++;
            }
          }

          // Parse Notations
          let tabPosition: { string: number; fret: number } | undefined;
          let technique: MnxTabTechnique | undefined;
          const notationsEl = findDirectChild(el, 'notations');
          let accidentalDisplay: any;

          if (notationsEl) {
            const techEl = findDirectChild(notationsEl, 'technical');
            if (techEl) {
              const fret = getChildInt(techEl, 'fret');
              const str = getChildInt(techEl, 'string');
              if (fret !== null && str !== null) {
                tabPosition = { string: str, fret };
              }
            }
            technique = this.parseTechnique(notationsEl, techEl);
          }

          // `<accidental>` is a child of `<note>`, not of `<notations>` — and
          // most notes that print one carry no `<notations>` at all, so reading
          // it inside that guard found it only on notes that happened to have
          // some other notation too. Same trap as `<beam>`.
          const accEl = findDirectChild(el, 'accidental');
          if (accEl) {
            accidentalDisplay = { show: true };
            if (accEl.textContent?.includes('parentheses')) {
              accidentalDisplay.enclosure = { symbol: 'parentheses' };
            }
          }

          // A malformed pitch is recoverable when the part carries a tuning and
          // the note carries a fingerboard position: string + fret + tuning
          // determines the sounding pitch exactly. (Standard-notation parts
          // have no tuning; those notes are resolved later from the aligned TAB
          // note during mergeParts.)
          if (pitchUnresolved && tabPosition && state.tuning) {
            const openString = state.tuning[state.tuning.length - tabPosition.string];
            if (openString) {
              mnxPitch = spellPitch(pitchToMidi(openString) + tabPosition.fret, alterRaw);
              pitchUnresolved = false;
              this.stats.recoveredPitches++;
            }
          }

          const mnxNote: MnxNote = {
            pitch: mnxPitch || { step: 'C', octave: 4 },
            ...(tabPosition || technique
              ? {
                  _x: {
                    mnxLab: {
                      ...(tabPosition
                        ? { string: tabPosition.string, fret: tabPosition.fret }
                        : {}),
                      ...(technique ? { tab: { technique } } : {})
                    }
                  }
                }
              : {}),
            ...(accidentalDisplay ? { accidentalDisplay } : {})
          };

          if (pitchUnresolved) this.unresolvedPitches.add(mnxNote);

          // The event this note ends up on, whichever branch below builds it —
          // a slur is stated on the EVENT, so it has to be known here.
          let owningEvent: MnxEvent | undefined;

          if (isChord) {
            // `<chord/>` means "sounds with the previous note of this voice".
            // Attach to that note's event directly — the time cursor has
            // already advanced past its onset, so searching by `currentTime`
            // never matches and would split the chord into separate events
            // (inflating the measure).
            const target = lastNoteEventByVoice.get(voice);
            if (target && target.notes) {
              target.notes.push(mnxNote);
              owningEvent = target;
              // A lyric on a chord member belongs to the chord's event.
              if (lyrics && !target.lyrics) target.lyrics = lyrics;
            } else {
              // Malformed input: a chord note with no preceding note in this
              // voice. Emit it as its own event rather than dropping it.
              const chordEvent: MnxEvent = {
                duration: mnxDur,
                notes: [mnxNote]
              };
              if (!voiceEvents.has(voice)) voiceEvents.set(voice, []);
              voiceEvents.get(voice)!.push({
                onset: currentTime,
                span: rawDur,
                event: chordEvent,
                ...(grace ? { grace } : {}),
                ...(tuplet ? { tuplet } : {})
              });
              lastNoteEventByVoice.set(voice, chordEvent);
              owningEvent = chordEvent;
            }
          } else {
            // New Note event
            const noteEvent: MnxEvent = {
              duration: mnxDur,
              ...(lyrics ? { lyrics } : {}),
              notes: [mnxNote]
            };
            if (!voiceEvents.has(voice)) voiceEvents.set(voice, []);
            voiceEvents.get(voice)!.push({
              onset: currentTime,
              span: rawDur,
              event: noteEvent,
              ...(grace ? { grace } : {}),
              ...(tuplet ? { tuplet } : {})
            });
            lastNoteEventByVoice.set(voice, noteEvent);
            owningEvent = noteEvent;
            lastEventOnset = currentTime;
            currentTime += rawDur;
          }

          if (notationsEl && owningEvent) {
            this.collectSpanners(notationsEl, el, voice, owningEvent, mnxNote);
          }
          if (owningEvent && !isChord) this.collectBeams(el, owningEvent);
          // `<staff>` is per NOTE in MusicXML and per sequence in MNX. Recorded
          // here and reconciled below, because a voice that stays on one staff
          // (the normal case) should say so once rather than on every event.
          if (owningEvent && !isChord && state.staves > 1) {
            const staff = getChildInt(el, 'staff');
            if (staff) eventStaves.set(owningEvent, staff);
          }
        }
      }
    }

    // Convert Map to MnxSequence array
    const sequences: MnxSequence[] = [];
    for (const [voiceName, events] of voiceEvents.entries()) {
      // A stable sort by onset: grace notes share their principal's onset (they
      // consume no time), so document order is the only thing that says which
      // side of it they fall on, and it has to survive the sort.
      events.sort((a, b) => a.onset - b.onset);

      // Insert padding space events for gaps, and collapse the runs MusicXML
      // flags per note back into the containers MNX declares once.
      const content: MnxSequenceItem[] = [];
      let cursor = 0;

      // Both containers are RUNS of consecutive notes in MusicXML and single
      // items in MNX, so both are buffered here and flushed when their run
      // ends. Graces flush ahead of the note they decorate, which is where
      // document order already put them.
      let graceRun: PendingEvent[] = [];
      let tupletRun: PendingEvent[] = [];

      const flushGrace = () => {
        if (graceRun.length === 0) return;
        const first = graceRun[0].grace!;
        content.push({
          type: 'grace',
          content: graceRun.map(item => item.event),
          graceType: first.graceType,
          ...(first.slash === false ? { slash: false } : {})
        });
        graceRun = [];
      };

      const flushTuplet = () => {
        if (tupletRun.length === 0) return;
        const run = tupletRun;
        tupletRun = [];
        const mark = run[0].tuplet!;
        const events = run.map(item => item.event);
        const sides = tupletSides(events, mark);
        if (!sides) {
          this.warnings.push(
            `measure ${measureIdx + 1}: a ${mark.actualNotes}:${mark.normalNotes} tuplet ` +
              `could not be stated as a whole number of note values; its notes were ` +
              `written without it.`
          );
          content.push(...events);
          return;
        }
        content.push({ type: 'tuplet', content: events, ...sides });
      };

      for (const item of events) {
        if (item.onset > cursor) {
          flushTuplet();
          flushGrace();
          const gap = item.onset - cursor;
          // Calculate space duration fraction
          const spaceDur = calculateMnxDuration(gap, state.divisions);
          content.push({
            duration: spaceDur,
            rest: {} // In simple MNX we can pad with rests or space
          });
          cursor = item.onset;
        }

        if (item.grace) {
          // A grace inside a tuplet's span is still un-timed, so it neither
          // joins the group nor ends it.
          graceRun.push(item);
          continue;
        }

        if (item.tuplet) {
          // Two conventions in the wild, and both are honoured: an exporter
          // that writes `<tuplet type="start"/>` says where a group begins, and
          // one that writes only `<time-modification>` leaves the group to be
          // inferred from where the ratio changes and how much written time has
          // accumulated. Trusting only the first would merge six triplet
          // eighths into one six-note tuplet whenever the brackets are absent.
          const open = tupletRun[0]?.tuplet;
          const sameRatio =
            open !== undefined &&
            open.actualNotes === item.tuplet.actualNotes &&
            open.normalNotes === item.tuplet.normalNotes &&
            open.normalType === item.tuplet.normalType;
          if (tupletRun.length > 0 && (item.tuplet.start || !sameRatio)) flushTuplet();
          flushGrace();
          tupletRun.push(item);
          cursor += item.span;
          if (item.tuplet.stop || tupletRunIsFull(tupletRun)) flushTuplet();
          continue;
        }

        flushTuplet();
        flushGrace();
        content.push(item.event);
        cursor += item.span;
      }
      flushTuplet();
      flushGrace();

      // A voice normally lives on one staff for the whole measure; when it
      // does, MNX states that on the sequence. A voice that crosses staves
      // (cross-staff piano writing) keeps the fact on its events instead of
      // being averaged into a single wrong answer.
      const staves = new Set(events.map(e => eventStaves.get(e.event)).filter(Boolean));
      if (staves.size > 1) {
        for (const { event } of events) {
          const staff = eventStaves.get(event);
          if (staff) event.staff = staff;
        }
      }
      sequences.push({
        voice: `v${voiceName}`,
        ...(staves.size === 1 ? { staff: [...staves][0] as number } : {}),
        content
      });
    }

    return sequences;
  }

  private transposePitch(pitch: MnxPitch, chromatic: number, diatonic: number): MnxPitch {
    if (chromatic === 0 && diatonic === 0) return pitch;

    const srcStepIdx = STEP_NAMES.indexOf(pitch.step as any);
    const srcAlter = pitch.alter || 0;

    // Compute absolute sounding semitone position (from C0)
    const srcAbsSemitone = pitch.octave * 12 + STEP_SEMITONES[pitch.step] + srcAlter;
    const soundingAbsSemitone = srcAbsSemitone + chromatic;

    // Apply diatonic step shift to determine the new note letter
    const newStepRaw = srcStepIdx + diatonic;
    const newStepIdx = ((newStepRaw % 7) + 7) % 7;
    const newStep = STEP_NAMES[newStepIdx];

    // Determine new octave: find which octave places newStep closest to soundingAbsSemitone
    const newStepSemitone = STEP_SEMITONES[newStep];
    // Rough octave from absolute semitone
    const roughOctave = Math.floor(soundingAbsSemitone / 12);
    // Adjust if needed so new note semitone matches
    let newOctave = roughOctave;
    if (newStepSemitone > soundingAbsSemitone - roughOctave * 12 + 6) {
      newOctave = roughOctave - 1;
    }

    // Calculate alter: chromatic difference between sounding pitch and natural step
    const newAlter = soundingAbsSemitone - (newOctave * 12 + newStepSemitone);

    return {
      step: newStep,
      octave: newOctave,
      alter: newAlter !== 0 ? newAlter : undefined
    };
  }

  private getEventDivisionDuration(event: MnxEvent, divisions: number): number {
    const base = event.duration.base;
    const dots = event.duration.dots || 0;
    
    let baseRatio = 1.0; // quarter
    if (base === 'whole') baseRatio = 4.0;
    else if (base === 'half') baseRatio = 2.0;
    else if (base === 'eighth') baseRatio = 0.5;
    else if (base === '16th' || base === 'sixteenth') baseRatio = 0.25;
    else if (base === '32nd' || base === 'thirty-second') baseRatio = 0.125;
    else if (base === '64th') baseRatio = 0.0625;
    
    const multiplier = 2 - Math.pow(2, -dots);
    return Math.round(baseRatio * multiplier * divisions);
  }

  /**
   * Helper to check if a part represents guitar tablature.
   * (Tab parts no longer carry TAB clefs; tab-ness is the part-level
   * `_x.mnxLab.tab.staffKind` view declaration.)
   */
  public isTabPart(part: MnxPart): boolean {
    return part._x?.mnxLab?.tab?.staffKind === 'tab';
  }

  /**
   * Merges a standard notation part and a TAB part into a SINGLE-SOURCE part:
   * the music is encoded once (the standard part's sequences), each note
   * annotated with its fingerboard position from the aligned TAB note. The
   * TAB staff itself is discarded — notation and tab are derived views
   * (part._x.mnxLab.tab.staffKind = 'both'). See docs/mnx-extensions.md.
   */
  public mergeParts(standardPart: MnxPart, tabPart: MnxPart): MnxPart {
    const numMeasures = Math.min(standardPart.measures.length, tabPart.measures.length);

    for (let m = 0; m < numMeasures; m++) {
      // Assign matching IDs to notes aligned at the same chronological onset
      // time, copying each TAB note's position onto the standard note.
      this.alignNoteIds(standardPart.measures[m].sequences, tabPart.measures[m].sequences, m);
    }

    return {
      // Drop the `-std` the exporter added: the merged single-source part is
      // the original part, not the notation half of a split.
      id: standardPart.id.replace(/-(std|tab)$/, ''),
      name: standardPart.name,
      measures: standardPart.measures.slice(0, numMeasures),
      // Preserve transposition from the standard part (TAB parts don't carry transposition)
      ...(standardPart.transposition ? { transposition: standardPart.transposition } : {}),
      _x: {
        mnxLab: {
          // Always explicit: the merged part IS tab content, and absent
          // strings would leave it fingerboard-less under the retracted
          // default.
          strings:
            tabPart._x?.mnxLab?.strings ??
            STANDARD_GUITAR_STRINGS.map(s => ({ string: s.string, pitch: { ...s.pitch } })),
          ...(tabPart._x?.mnxLab?.capo !== undefined
            ? { capo: tabPart._x.mnxLab.capo }
            : {}),
          tab: { staffKind: 'both' }
        }
      }
    };
  }

  private alignNoteIds(stdSeqs: MnxSequence[], tabSeqs: MnxSequence[], measureIdx: number) {
    // Generate aligned IDs for standard notes, and copy fingerboard positions
    // to them so the single remaining note stream carries the tab data.
    for (const stdSeq of stdSeqs) {
      const voice = stdSeq.voice || 'v1';
      const correspondingTabSeq = tabSeqs.find(s => s.voice === voice);
      if (!correspondingTabSeq) continue;

      let stdNoteCounter = 1;

      // Both sides are walked through their containers: a note inside a grace
      // or a tuplet needs an aligned id and its fingerboard position just as
      // much as one in the open, and the two staves carry the same containers.
      for (const { event: stdEv, onset: stdOnset, slot: stdSlot } of walkSequenceEvents(
        stdSeq.content,
        8
      )) {
        if (stdEv.notes) {
          // Find the TAB event at the same ADDRESS — onset and slot both, so a
          // grace note cannot answer for the principal it sits in front of.
          let matchingTabEv: MnxEvent | undefined;

          for (const { event: tabEv, onset: tabOnset, slot: tabSlot } of walkSequenceEvents(
            correspondingTabSeq.content,
            8
          )) {
            if (tabOnset === stdOnset && tabSlot === stdSlot && tabEv.notes) {
              matchingTabEv = tabEv;
              break;
            }
            if (tabOnset > stdOnset) break;
          }

          for (let nIdx = 0; nIdx < stdEv.notes.length; nIdx++) {
            const stdNote = stdEv.notes[nIdx];
            const noteId = `n-${measureIdx + 1}-${voice}-${stdOnset}-${stdNoteCounter++}`;
            stdNote.id = noteId;

            if (matchingTabEv && matchingTabEv.notes && matchingTabEv.notes[nIdx]) {
              const tabNote = matchingTabEv.notes[nIdx];
              tabNote.id = noteId; // share same note ID

              // Copy the fingerboard data to the standard note. Both position
              // AND technique: the exporter writes them on the TAB staff only
              // (the treble staff stays clean), so the standard note this merge
              // keeps is the one that has neither.
              const tabLab = tabNote._x?.mnxLab;
              if (tabLab?.string !== undefined || tabLab?.tab?.technique) {
                stdNote._x = {
                  mnxLab: {
                    ...stdNote._x?.mnxLab,
                    ...(tabLab.string !== undefined ? { string: tabLab.string } : {}),
                    ...(tabLab.fret !== undefined ? { fret: tabLab.fret } : {}),
                    ...(tabLab.tab?.technique
                      ? { tab: { technique: tabLab.tab.technique } }
                      : {})
                  }
                };
              }

              // If the standard part's <pitch> was malformed, adopt the TAB
              // note's pitch — it was reconstructed from string/fret + tuning,
              // and MNX stores sounding pitch on both sides, so it transfers
              // directly.
              if (this.unresolvedPitches.has(stdNote) && !this.unresolvedPitches.has(tabNote)) {
                stdNote.pitch = { ...tabNote.pitch };
                this.unresolvedPitches.delete(stdNote);
                this.stats.recoveredPitches++;
              }
            }
          }
        }
      }
    }
  }
}
