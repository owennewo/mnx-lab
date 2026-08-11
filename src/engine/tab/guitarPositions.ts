import { MnxNote, MnxPart, MnxPitch, MnxTuningEntry } from '../../model/mnx.ts';

/**
 * Fingerboard position derivation (roadmap/proposed/core-derived-positions.md).
 *
 * The authority ladder:
 *   string + fret  → the DERIVED fret renders; a disagreeing stored fret is
 *                    flagged (validate.ts), never drawn.
 *   string only    → the fret is arithmetic: pitch − (open + capo).
 *   neither        → the default assignment below — presentation, not content,
 *                    never written back to the document.
 *
 * All pitches are SOUNDING (MNX stores sounding pitch; `part.transposition`
 * is display metadata and never enters this arithmetic).
 */

/**
 * Standard guitar tuning, open string MIDI notes.
 * Index 0 = string 1 (high E, MIDI 64); index 5 = string 6 (low E, MIDI 40).
 */
export const GUITAR_TUNING = [64, 59, 55, 50, 45, 40];

export const MAX_FRET = 24;

function getMidiNote(step: string, octave: number, alter: number = 0): number {
  const stepOffsets: Record<string, number> = {
    c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11
  };
  const base = stepOffsets[step.toLowerCase()] ?? 0;
  return (octave + 1) * 12 + base + alter;
}

export function midiOfMnxPitch(pitch: MnxPitch): number {
  return getMidiNote(pitch.step, pitch.octave, pitch.alter ?? 0);
}

export interface TabPositionContext {
  /** Sounding MIDI of each EFFECTIVE open string (capo applied), by string number. */
  openMidi: ReadonlyMap<number, number>;
  /** The physical string set the context was built from (no capo shift) —
   *  what a tuning legend prints. */
  strings: readonly MnxTuningEntry[];
  capo: number;
}

/**
 * A consumer-supplied instrument: the viewer surface's override. Presentation,
 * not content — it wins over the document's declaration for rendering and is
 * never written back.
 */
export interface TabSetup {
  strings?: readonly MnxTuningEntry[];
  capo?: number;
  /** Overrides the part's own `tab.staffKind` hint for staff eligibility in
   *  the both view. A consumer that explicitly targets a part with an
   *  instrument usually wants to SEE its fingerboard — the document may
   *  never have opted that part into tab. */
  staffKind?: 'both' | 'tab';
}

/**
 * The override as the layouts carry it (roadmap/inprogress/core-score-hud.md):
 * one `TabSetup` applied to EVERY part (the original flat surface — right for
 * single-instrument documents), or a per-part resolver, which is how a
 * multi-part override avoids clobbering the part that declared its own
 * strings and handing the rest an instrument they never asked for.
 */
export type PartTabSetups = TabSetup | ((part: MnxPart) => TabSetup | undefined);

/** The setup in effect for one part — flat overrides apply to every part. */
export function resolveTabSetup(
  override: PartTabSetups | undefined,
  part: MnxPart | undefined
): TabSetup | undefined {
  return typeof override === 'function' ? (part ? override(part) : undefined) : override;
}

/**
 * The part's effective string set — declared `_x.mnxLab.strings` unless the
 * consumer overrides it — each shifted up by the capo. Printed frets are
 * counted from the capo, so deriving against the shifted opens makes them
 * capo-relative by construction. Strings and capo fall back independently,
 * per part: a capo-only override rides the document's declared tuning.
 *
 * Returns null when NO strings are known: there is deliberately no assumed
 * instrument (roadmap/proposed/core-derived-positions.md) — a document without a
 * declaration has no fingerboard, and tab views require one from the document
 * or from the surface.
 */
export function tabPositionContext(
  part: MnxPart | undefined,
  override?: PartTabSetups
): TabPositionContext | null {
  const setup = resolveTabSetup(override, part);
  const strings = setup?.strings ?? part?._x?.mnxLab?.strings;
  if (!strings || strings.length === 0) return null;
  const capo = setup?.capo ?? part?._x?.mnxLab?.capo ?? 0;
  const openMidi = new Map<number, number>();
  for (const entry of strings) {
    openMidi.set(entry.string, midiOfMnxPitch(entry.pitch) + capo);
  }
  return { openMidi, strings, capo };
}

export interface ResolvedTabPosition {
  str: number;
  fret: number;
  /** The stored fret disagreed with the derived one (the derived one is used). */
  mismatch?: boolean;
}

/**
 * Map a chord of MNX notes to fret/string positions, aligned with the input
 * order. `null` marks an unplayable note (annotated string not declared,
 * derived fret outside [0, MAX_FRET], or no free string can reach the pitch):
 * the caller draws nothing for it, and validate.ts raises the red badge —
 * never a silent clamp.
 */
export function resolveEventPositions(
  notes: MnxNote[],
  ctx: TabPositionContext
): (ResolvedTabPosition | null)[] {
  const resolved: (ResolvedTabPosition | null)[] = new Array(notes.length).fill(null);
  const usedStrings = new Set<number>();

  // Pass 1: annotated strings are authoritative and reserve their string even
  // when the derived fret turns out unplayable — the author claimed it.
  notes.forEach((note, index) => {
    const x = note._x?.mnxLab;
    if (x?.string === undefined) return;
    usedStrings.add(x.string);
    const open = ctx.openMidi.get(x.string);
    if (open === undefined) return;
    const fret = midiOfMnxPitch(note.pitch) - open;
    if (fret < 0 || fret > MAX_FRET) return;
    resolved[index] = {
      str: x.string,
      fret,
      ...(x.fret !== undefined && x.fret !== fret ? { mismatch: true } : {})
    };
  });

  // Pass 2: bare notes, highest pitch first (high pitches have the fewest
  // reachable strings, so they choose first); lowest playable fret wins, ties
  // break to the lower string number; no string collisions within the chord.
  const bare = notes
    .map((note, index) => ({ index, midi: midiOfMnxPitch(note.pitch), note }))
    .filter(({ note }) => note._x?.mnxLab?.string === undefined)
    .sort((a, b) => b.midi - a.midi);
  const stringsAscending = [...ctx.openMidi.keys()].sort((a, b) => a - b);

  for (const item of bare) {
    let best: ResolvedTabPosition | null = null;
    for (const s of stringsAscending) {
      if (usedStrings.has(s)) continue;
      const fret = item.midi - ctx.openMidi.get(s)!;
      if (fret < 0 || fret > MAX_FRET) continue;
      if (!best || fret < best.fret) best = { str: s, fret };
    }
    if (best) {
      resolved[item.index] = best;
      usedStrings.add(best.str);
    }
  }

  return resolved;
}
