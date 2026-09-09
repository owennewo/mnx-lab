/** Pure mapping. Recorded pitches are shared; playback voices retain string ownership. */
export type VoicePreset = 'synth' | 'guitar';
export interface GuitarSample {
  file: string;
  midi: number;
  layer: number;
  take: number;
}
export function selectGuitarSample<T extends GuitarSample>(
  samples: readonly T[],
  hz: number,
  velocity: number,
  attack: number,
): T {
  if (!samples.length) throw new Error('The guitar pack contains no samples.');
  const midi = 69 + 12 * Math.log2(hz / 440);
  let nearest = samples[0].midi;
  for (const sample of samples)
    if (Math.abs(sample.midi - midi) < Math.abs(nearest - midi)) nearest = sample.midi;
  const roots = samples.filter((s) => s.midi === nearest);
  const desired = velocity < 0.5 ? 2 : 4;
  const layer = roots.reduce(
    (a, s) => (Math.abs(s.layer - desired) < Math.abs(a - desired) ? s.layer : a),
    roots[0].layer,
  );
  const takes = roots.filter((s) => s.layer === layer).sort((a, b) => a.take - b.take);
  return takes[attack % takes.length];
}
