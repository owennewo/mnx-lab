import {
  MnxStructure,
  MnxSequence,
  MnxEvent,
  MnxNote,
  MnxHarmony,
  isTimedEvent
} from './types.js';
import { renderChordSymbol } from './harmony.js';
import { mnxDurationToWholes } from './duration.js';

/**
 * The MNX-side planning half of a Guitar Pro export, shared between the
 * alphaTab-backed writer (`export/gp.ts`) and the clean-room GPIF writer
 * (`gpif/fromMnx.ts`). Everything here reads MNX and decides; nothing here
 * knows what serializes the decision.
 */

/**
 * Verse order for lyric lines: the document's declared `lineOrder` when present,
 * otherwise the line ids in first-appearance order. Guitar Pro identifies verses
 * only by position, so this ordering IS the mapping.
 */
export function resolveLyricLineOrder(mnx: MnxStructure): string[] {
  const declared = mnx.global?.lyrics?.lineOrder;
  if (declared?.length) return [...declared];

  const seen: string[] = [];
  for (const part of mnx.parts)
    for (const measure of part.measures)
      for (const sequence of measure.sequences ?? [])
        for (const item of sequence.content ?? [])
          if (isTimedEvent(item))
            for (const id of Object.keys(item.lyrics?.lines ?? {}))
              if (!seen.includes(id)) seen.push(id);
  return seen;
}

/**
 * One beat's lyric text per verse slot, Guitar Pro-encoded: a syllable that
 * continues into the next carries a trailing `-`, and a space inside a
 * syllable becomes `+` (a bare space would read as a syllable break).
 * Null when the event carries nothing.
 */
export function lyricSlots(event: MnxEvent, lineOrder: string[]): string[] | null {
  const lines = event.lyrics?.lines;
  if (!lines || lineOrder.length === 0) return null;

  const slots = new Array<string>(lineOrder.length).fill('');
  let any = false;

  for (const [lineId, line] of Object.entries(lines)) {
    const index = lineOrder.indexOf(lineId);
    if (index < 0 || !line?.text) continue;
    const continues = line.type === 'start' || line.type === 'middle';
    slots[index] = line.text.replace(/\s+/g, '+') + (continues ? '-' : '');
    any = true;
  }

  return any ? slots : null;
}

/**
 * The `reference` unit a Guitar Pro tempo counts in — an index into the
 * multiplier table `[×0.5 eighth, ×1 quarter, ×1.5 dotted quarter, ×2 half,
 * ×3 dotted half]`, 1-based; both the alphaTab automation builder and GPIF's
 * `<Value>bpm unit</Value>` token use this numbering (2 = quarter, confirmed
 * by fixture — research/gpif-field-notes.md §3).
 */
export function tempoReference(value: { base?: string; dots?: number } | undefined): number {
  const dotted = (value?.dots ?? 0) > 0;
  switch (value?.base) {
    case 'eighth':
      return 1;
    case 'half':
      return dotted ? 5 : 4;
    case 'quarter':
    default:
      return dotted ? 3 : 2;
  }
}

/** Chord symbols for one measure, keyed by the `location` fraction they sit at,
 *  so a beat can look up whether a chord starts on it. */
export function harmonyTextByOnset(
  harmonies: MnxHarmony[] | undefined
): Map<string, string> | undefined {
  if (!harmonies?.length) return undefined;
  const map = new Map<string, string>();
  for (const harmony of harmonies) {
    const [numerator, denominator] = harmony.location.fraction;
    map.set(`${numerator}/${denominator}`, harmony.text ?? renderChordSymbol(harmony));
  }
  return map;
}

/**
 * Decides which notes to drop so no string is claimed twice at one instant.
 *
 * Only exact unisons are collapsed (same string AND same fret) — those are one
 * note written twice. Two *different* frets on one string is unplayable however
 * it renders, so it is left alone and reported rather than silently "fixed".
 *
 * Which copy survives matters: dropping the melody's note would leave a hole in
 * the melodic line. So the keeper is the one standing alone in its event, over
 * one that is a member of a chord (which keeps its other notes either way);
 * ties go to the lower voice.
 */
export function planUnisonCollapse(
  sequences: MnxSequence[],
  onCollapse: (stringNumber: number, fret: number) => void
): Set<MnxNote> {
  interface Claim {
    note: MnxNote;
    fret: number;
    voiceIndex: number;
    chordSize: number;
  }

  const byOnsetAndString = new Map<string, Claim[]>();

  sequences.forEach((sequence, voiceIndex) => {
    let onset = 0;
    for (const item of sequence.content ?? []) {
      if (!isTimedEvent(item)) return; // timing unknowable from here on
      for (const note of item.notes ?? []) {
        const x = note._x?.mnxLab;
        if (x?.string !== undefined && x?.fret !== undefined) {
          const key = `${Math.round(onset * 1e6)}:${x.string}`;
          const list = byOnsetAndString.get(key) ?? [];
          list.push({
            note,
            fret: x.fret,
            voiceIndex,
            chordSize: item.notes?.length ?? 1
          });
          byOnsetAndString.set(key, list);
        }
      }
      onset += mnxDurationToWholes(item.duration.base, item.duration.dots ?? 0);
    }
  });

  const suppressed = new Set<MnxNote>();
  for (const claims of byOnsetAndString.values()) {
    if (claims.length < 2) continue;
    if (new Set(claims.map(c => c.fret)).size > 1) continue; // real conflict — leave it

    const keeper = [...claims].sort(
      (a, b) => a.chordSize - b.chordSize || a.voiceIndex - b.voiceIndex
    )[0];
    for (const claim of claims) {
      if (claim.note !== keeper.note && !suppressed.has(claim.note)) {
        suppressed.add(claim.note);
        onCollapse(claim.note._x!.mnxLab!.string!, claim.fret);
      }
    }
  }
  return suppressed;
}
