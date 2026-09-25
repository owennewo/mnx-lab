import { compilePerformance } from '../../../../../src/audio/performance.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { type Following, type NoteLabel, type Recipe, rational } from '../types.ts';
import { writeWav } from './wav.ts';
export const GENERATOR_VERSION = 'sine-v1';
/** Labels describe the events actually emitted below, not a listener's account. */
export function synthesize(score: MnxStructure, recipe: Recipe): { wav: Buffer; notes: NoteLabel[]; following: Following[]; duration: number } {
  const p = recipe.parameters;
  if (recipe.manifest !== GENERATOR_VERSION || p.sampleRate !== 48000 || p.peakDbfs !== -12 || p.attackSeconds !== .01 || p.releaseSeconds !== .01 || p.soundingBeatFraction !== .5 || p.finalSilenceSeconds !== .5 || !Number.isFinite(p.bpm) || p.bpm <= 0 || p.bpm > 1500 || !['score', 'descending', 'silence'].includes(p.mode)) throw new Error('Unsupported sine-v1 recipe');
  const result = compilePerformance(score);
  if (!result.ok || result.performance.diagnostics.length) throw new Error('Score does not compile cleanly');
  const performance = result.performance;
  const events = performance.sounding;
  // Compiler voices identify sinks (one per unassigned note), not polyphony.
  // The consecutive, unit-duration onset check below enforces one note at a time.
  if (!events.length) throw new Error('sine-v1 requires a nonempty score');
  const quarters = (r: { num: bigint; den: bigint }) => Number(r.num) * 4 / Number(r.den);
  if (events.some((n, i) => quarters(n.position) !== i || quarters(n.duration) !== 1 || n.curve.length)) throw new Error('sine-v1 requires consecutive unmodified quarter notes');
  const pitches = events.map(n => n.midi); if (p.mode === 'descending') pitches.reverse();
  const notes: NoteLabel[] = [];
  if (p.mode !== 'silence') for (let i = 0; i < events.length; i++) {
    const n = events[i]!; const midi = pitches[i]!;
    const onsetSample = Math.round(quarters(n.position) * 60 / p.bpm * p.sampleRate);
    const endSample = Math.round((quarters(n.position) + .5) * 60 / p.bpm * p.sampleRate);
    notes.push({ pitch: { midi, hz: 440 * 2 ** ((midi - 69) / 12) }, onset: onsetSample / p.sampleRate, audibleEnd: endSample / p.sampleRate,
      scoreDuration: rational(1), scoreNoteId: p.mode === 'descending' ? null : performance.written.find(w => n.writtenIds.includes(w.id))!.noteKey,
      precision: { kind: 'exact' }, provenance: 'sine-v1 recipe; onset and release are sample boundaries; release is audible end.' });
  }
  const duration = p.mode === 'silence' ? p.silenceDuration! : notes.at(-1)!.audibleEnd + p.finalSilenceSeconds;
  if (!Number.isFinite(duration) || duration <= .15 || !Number.isSafeInteger(Math.round(duration * p.sampleRate)) || duration > 3600) throw new Error('Invalid audio duration');
  const samples = new Int16Array(Math.round(duration * p.sampleRate));
  const peak = 10 ** (p.peakDbfs / 20);
  for (const n of notes) {
    const from = Math.round(n.onset * p.sampleRate), to = Math.round(n.audibleEnd * p.sampleRate);
    for (let i = from; i < to; i++) {
      const elapsed = i - from;
      const envelope = Math.min(1, elapsed / 480, (to - i) / 480);
      samples[i] = Math.round(32767 * peak * envelope * Math.sin(2 * Math.PI * n.pitch.hz * elapsed / p.sampleRate));
    }
  }
  const common = { start: 0, precision: { kind: 'exact' as const }, provenance: 'sine-v1 controlled recipe; 150 ms detection allowance from the first distinguishing onset.', answerableFrom: .15, route: 1 };
  const trajectory = { atStart: rational(0), quartersPerSecond: { num: p.bpm, den: 60 }, route: 1 };
  const following: Following[] = p.mode === 'score' ? [
    { ...common, end: notes.at(-1)!.audibleEnd, state: 'supported', truth: trajectory, admissible: [structuredClone(trajectory)] },
    { start: notes.at(-1)!.audibleEnd, end: duration, state: 'unknown', precision: { kind: 'unknown' }, provenance: 'Final silence beyond the last audible release; no following claim judged.' },
  ] : [{ ...common, end: duration, state: 'unsupported' }];
  return { wav: writeWav(samples), notes, following, duration };
}
