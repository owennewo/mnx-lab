/**
 * Pure mapping. Recorded pitches are shared; playback voices retain string
 * ownership.
 *
 * Named for what these packs ARE — recorded instruments — rather than for the
 * first one that shipped. The whole vocabulary said `guitar` until a piano
 * arrived (2026-09-09) and made every one of those names a lie; the old
 * spellings survive as deprecated aliases on the library face
 * (`src/entries/lib/audio.ts`), never here.
 *
 * Piano leads the list because it is the instrument notation is read on, and
 * because it is the only pack that spans the staff at both ends: its roots run
 * MIDI 24–107 against the guitars' 36–85. It is NOT the default sound — `synth`
 * still is, so ordinary playback downloads nothing.
 */
export const SAMPLE_PRESETS = [
  { id: 'piano', label: 'Piano · Upright', directory: 'upright-piano-v1' },
  { id: 'guitar', label: 'Guitar 1 · Archtop', directory: 'shinyguitar-v1' },
  { id: 'guitar2', label: 'Guitar 2 · Nylon', directory: 'spanish-guitar-v1' },
  { id: 'guitar3', label: 'Guitar 3 · Steel', directory: 'martin-guitar-v1' },
  { id: 'guitar4', label: 'Guitar 4 · Clean electric', directory: 'fender-guitar-v1' },
] as const;
export type SamplePreset = (typeof SAMPLE_PRESETS)[number]['id'];
export type VoicePreset = 'synth' | SamplePreset;
export function isSamplePreset(value: unknown): value is SamplePreset {
  return SAMPLE_PRESETS.some((preset) => preset.id === value);
}
export interface InstrumentSample {
  file: string;
  midi: number;
  layer: number;
  take: number;
}
export function selectSample<T extends InstrumentSample>(
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
