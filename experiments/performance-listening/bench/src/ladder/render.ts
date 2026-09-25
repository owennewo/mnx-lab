import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { type NoteLabel, rational } from '../types.ts';

export const RENDERER_VERSION = 'score-render@1';
export const SAMPLE_RATE = 48000;

/** Rung 0: every sounding note of a score window as one sine partial, at score timing
 * and one constant tempo. Later rungs perturb the note list or each note's synthesis;
 * rung 0 perturbs nothing. */
export interface RungZeroRecipe {
  renderer: typeof RENDERER_VERSION;
  rung: 0;
  bpm: number;
  fromQuarter: number;
  toQuarter: number;
  sampleRate: typeof SAMPLE_RATE;
  peakDbfs: -12;
  rampSeconds: 0.01;
}

export interface RenderedNote {
  /** Sample boundaries, relative to fromQuarter at audio time zero. */
  fromSample: number;
  toSample: number;
  midi: number;
  hz: number;
  scoreQuarter: number;
  scoreDuration: { num: number; den: number };
  noteKey: string | null;
}

const quarters = (r: { num: bigint; den: bigint }) => 4 * Number(r.num) / Number(r.den);

export function durationSamples(recipe: RungZeroRecipe): number {
  return Math.round((recipe.toQuarter - recipe.fromQuarter) * 60 / recipe.bpm * recipe.sampleRate);
}

/** The score's sounding notes that begin inside the window, placed at the recipe tempo.
 * A note that would ring past the window end is cut at the window end, as the real
 * four-bar crops are. */
export function scoreNotes(score: MnxStructure, recipe: RungZeroRecipe): RenderedNote[] {
  if (recipe.renderer !== RENDERER_VERSION || recipe.rung !== 0 || recipe.sampleRate !== SAMPLE_RATE ||
      recipe.peakDbfs !== -12 || recipe.rampSeconds !== 0.01 || !(recipe.bpm > 0) || !(recipe.toQuarter > recipe.fromQuarter)) {
    throw new Error('Unsupported rung-0 recipe');
  }
  const compiled = compilePerformance(score);
  if (!compiled.ok || compiled.performance.diagnostics.length) throw new Error('Score does not compile cleanly');
  const { performance } = compiled;
  const end = durationSamples(recipe);
  const toSample = (q: number) => Math.round((q - recipe.fromQuarter) * 60 / recipe.bpm * recipe.sampleRate);
  const notes = performance.sounding
    .filter(n => quarters(n.position) >= recipe.fromQuarter && quarters(n.position) < recipe.toQuarter)
    .map(n => {
      if (n.curve.length) throw new Error('Rung 0 renders no pitch curves');
      const start = quarters(n.position);
      const written = performance.written.find(w => n.writtenIds.includes(w.id));
      return {
        fromSample: toSample(start),
        toSample: Math.min(end, toSample(start + quarters(n.duration))),
        midi: n.midi,
        hz: 440 * 2 ** ((n.midi - 69) / 12),
        scoreQuarter: start,
        scoreDuration: rational(4 * Number(n.duration.num), Number(n.duration.den)),
        noteKey: written?.noteKey ?? null,
      };
    })
    .sort((a, b) => a.fromSample - b.fromSample || a.midi - b.midi);
  if (!notes.length) throw new Error('The window contains no sounding notes');
  const ramp = recipe.rampSeconds * recipe.sampleRate;
  if (notes.some(n => n.toSample - n.fromSample < 2 * ramp)) throw new Error('A note is shorter than its attack and release');
  return notes;
}

/** The largest number of notes sounding at one sample. */
export function maxPolyphony(notes: readonly RenderedNote[]): number {
  const edges = notes.flatMap(n => [[n.fromSample, 1], [n.toSample, -1]] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0, most = 0;
  for (const [, step] of edges) { current += step; most = Math.max(most, current); }
  return most;
}

/** Sums one sine partial per note. Each note has a linear attack and release inside its
 * own interval and restarts its phase at onset. The level per note is the peak divided
 * by the largest polyphony, so the mix never clips and does not depend on the notes. */
export function renderSines(notes: readonly RenderedNote[], recipe: RungZeroRecipe): Int16Array {
  const length = durationSamples(recipe);
  const mix = new Float64Array(length);
  const level = 10 ** (recipe.peakDbfs / 20) / maxPolyphony(notes);
  const ramp = recipe.rampSeconds * recipe.sampleRate;
  for (const n of notes) {
    for (let i = n.fromSample; i < n.toSample; i++) {
      const elapsed = i - n.fromSample;
      const envelope = Math.min(1, elapsed / ramp, (n.toSample - i) / ramp);
      mix[i]! += level * envelope * Math.sin(2 * Math.PI * n.hz * elapsed / recipe.sampleRate);
    }
  }
  return Int16Array.from(mix, x => Math.round(32767 * x));
}

/** Labels describe the audio the renderer produced, not a listener's account. */
export function noteLabels(notes: readonly RenderedNote[], recipe: RungZeroRecipe): NoteLabel[] {
  return notes.map(n => ({
    pitch: { midi: n.midi, hz: n.hz },
    onset: n.fromSample / recipe.sampleRate,
    audibleEnd: n.toSample / recipe.sampleRate,
    scoreDuration: n.scoreDuration,
    scoreNoteId: n.noteKey,
    precision: { kind: 'exact' },
    provenance: `${RENDERER_VERSION} rung 0; onset and release are sample boundaries; release is the audible end.`,
  }));
}
