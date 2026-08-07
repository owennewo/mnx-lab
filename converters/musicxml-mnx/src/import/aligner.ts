import {
  MnxPart,
  MnxPartMeasure,
  MnxSequence,
  MnxEvent,
  MnxNote,
  MnxPitch,
  MnxGlobalMeasure,
  MnxEventLyrics,
  MnxEventLyricLine,
  MnxTabTechnique,
  MnxBendPoint,
  MnxHarmonic,
  MnxHarmony,
  MnxHarmonyStep,
  STANDARD_GUITAR_STRINGS
} from '../common/types.js';
import {
  renderChordSymbol,
  stepToText,
  XML_KIND_TO_QUALITY
} from '../common/harmony.js';
import { calculateMnxDuration, createPitchKey, reduceFraction } from '../common/utils.js';
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

export class Aligner {
  /**
   * Notes whose `<pitch>` was unusable in the source and could not be recovered
   * from a fingerboard position. Tracked so the notation/TAB merge gets a
   * second chance to adopt the aligned TAB note's (recovered) pitch.
   */
  private unresolvedPitches = new WeakSet<MnxNote>();

  /** Counts surfaced to the caller via `ImportOptions.onWarning`. */
  public readonly stats = { malformedPitches: 0, recoveredPitches: 0 };

  /** Raw `<ending>` marks for the part being parsed; collapsed by resolveEndings. */
  private endingMarks: { measureIndex: number; type: string; numbers: number[] }[] = [];

  /** Chord symbols seen while walking measures; placed by resolveHarmonies. */
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
    for (const part of parts) {
      // Flatten each voice across the whole part — a hammer-on can cross a
      // barline.
      const byVoice = new Map<string, MnxNote[]>();
      part.measures.forEach((measure, measureIndex) => {
        for (const sequence of measure.sequences ?? []) {
          const voice = sequence.voice ?? 'v1';
          const list = byVoice.get(voice) ?? [];
          for (const [eventIndex, event] of (sequence.content ?? []).entries()) {
            for (const [noteIndex, note] of (event.notes ?? []).entries()) {
              if (!note.id) {
                note.id = `n-${measureIndex + 1}-${voice}-${eventIndex}-${noteIndex}`;
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

          for (const kind of ['hammerOn', 'pullOff'] as const) {
            const block = technique[kind];
            if (!block || block.target) continue;
            if (next?.id) block.target = next.id;
            else delete technique[kind];
          }
          if (technique.slide && !technique.slide.target && next?.id) {
            technique.slide.target = next.id;
          }
          if (Object.keys(technique).length === 0) delete note._x!.mnxLab!.tab!.technique;
        }
      }
    }
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
  private parseTechnique(
    notationsEl: Element,
    techEl: Element | null
  ): MnxTabTechnique | undefined {
    const technique: MnxTabTechnique = {};
    let found = false;

    if (techEl) {
      // Direction is derivable from pitch, but trust the source's own element.
      const hammerOn = findDirectChild(techEl, 'hammer-on');
      const pullOff = findDirectChild(techEl, 'pull-off');
      if (hammerOn?.getAttribute('type') === 'start') {
        technique.hammerOn = { target: '' };
        found = true;
      } else if (pullOff?.getAttribute('type') === 'start') {
        technique.pullOff = { target: '' };
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
    let lastEmittedClef: string | null = null;

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

        const clefEl = findDirectChild(attributesEl, 'clef');
        if (clefEl) {
          state.clefSign = getChildText(clefEl, 'sign');
          state.clefLine = getChildInt(clefEl, 'line');
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
        const style = getChildText(bar, 'bar-style');
        if (style) {
          const mapped = this.mapBarlineStyle(style);
          if (mapped !== 'regular') {
            globalM.barline = { type: mapped };
          }
        }

        // `<repeat direction="forward">` opens a section, `"backward"` closes
        // it. `times` on a backward repeat is the number of PLAYS (Soundslice
        // writes times="3"); MNX carries the same meaning in `repeatEnd.times`.
        const repeatEl = findDirectChild(bar, 'repeat');
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
      const clefKey = state.clefSign ? `${state.clefSign}/${state.clefLine}` : null;
      if (state.clefSign && state.clefSign !== 'TAB' && clefKey !== lastEmittedClef) {
        clefsList.push({
          clef: {
            sign: state.clefSign,
            staffPosition: state.clefLine ? -(state.clefLine) : undefined
          }
        });
      }
      if (clefKey !== null) {
        lastEmittedClef = clefKey;
      }

      measures.push({
        ...(clefsList.length > 0 ? { clefs: clefsList } : {}),
        sequences
      });
    }

    this.resolveEndings(globalMeasures);
    this.resolveHarmonies(globalMeasures);

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
    const voiceEvents = new Map<string, Array<{ onset: number; event: MnxEvent }>>();

    // voiceName -> the most recent note event, so a following `<chord/>` note
    // can be stacked onto it (see the isChord branch below)
    const lastNoteEventByVoice = new Map<string, MnxEvent>();

    // We iterate through XML child nodes to preserve exact document order
    for (let i = 0; i < measureEl.childNodes.length; i++) {
      const node = measureEl.childNodes[i];
      if (node.nodeType !== 1) continue;
      const el = node as Element;

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
        const rawDur = getChildInt(el, 'duration') || 0;

        const mnxDur = calculateMnxDuration(
          rawDur,
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
          if (!voiceEvents.has(voice)) voiceEvents.set(voice, []);
          voiceEvents.get(voice)!.push({ onset: currentTime, event: restEvent });
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

            const accEl = findDirectChild(el, 'accidental');
            if (accEl) {
              accidentalDisplay = { show: true };
              if (accEl.textContent?.includes('parentheses')) {
                accidentalDisplay.enclosure = { symbol: 'parentheses' };
              }
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

          if (isChord) {
            // `<chord/>` means "sounds with the previous note of this voice".
            // Attach to that note's event directly — the time cursor has
            // already advanced past its onset, so searching by `currentTime`
            // never matches and would split the chord into separate events
            // (inflating the measure).
            const target = lastNoteEventByVoice.get(voice);
            if (target && target.notes) {
              target.notes.push(mnxNote);
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
              voiceEvents.get(voice)!.push({ onset: currentTime, event: chordEvent });
              lastNoteEventByVoice.set(voice, chordEvent);
            }
          } else {
            // New Note event
            const noteEvent: MnxEvent = {
              duration: mnxDur,
              ...(lyrics ? { lyrics } : {}),
              notes: [mnxNote]
            };
            if (!voiceEvents.has(voice)) voiceEvents.set(voice, []);
            voiceEvents.get(voice)!.push({ onset: currentTime, event: noteEvent });
            lastNoteEventByVoice.set(voice, noteEvent);
            currentTime += rawDur;
          }
        }
      }
    }

    // Convert Map to MnxSequence array
    const sequences: MnxSequence[] = [];
    for (const [voiceName, events] of voiceEvents.entries()) {
      // Sort events by onset time
      events.sort((a, b) => a.onset - b.onset);

      // Insert padding space events for gaps
      const content: MnxEvent[] = [];
      let cursor = 0;

      for (const item of events) {
        if (item.onset > cursor) {
          const gap = item.onset - cursor;
          // Calculate space duration fraction
          const spaceDur = calculateMnxDuration(gap, state.divisions);
          content.push({
            duration: spaceDur,
            rest: {} // In simple MNX we can pad with rests or space
          });
        }
        content.push(item.event);
        // Calculate duration value in divisions
        // Note: this assumes we can deduce division size of item.event.duration
        // But since we have chronological stream, cursor just updates to next onset
        cursor = item.onset + this.getEventDivisionDuration(item.event, state.divisions);
      }

      sequences.push({
        voice: `v${voiceName}`,
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

      let stdOnset = 0;
      let stdNoteCounter = 1;

      for (let stdEvIdx = 0; stdEvIdx < stdSeq.content.length; stdEvIdx++) {
        const stdEv = stdSeq.content[stdEvIdx];
        if (stdEv.notes) {
          // Find matching TAB event at same onset time
          let tabOnset = 0;
          let matchingTabEv: MnxEvent | undefined;

          for (const tabEv of correspondingTabSeq.content) {
            if (tabOnset === stdOnset && tabEv.notes) {
              matchingTabEv = tabEv;
              break;
            }
            tabOnset += this.getEventDivisionDuration(tabEv, 8); // use standard division 8 for onset mapping
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
        stdOnset += this.getEventDivisionDuration(stdEv, 8);
      }
    }
  }
}
