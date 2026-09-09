import { GUITAR_PRESETS, type GuitarPreset, type GuitarSample } from '../sampleSelection.ts';

export interface DecodedGuitarSample extends GuitarSample {
  buffer: AudioBuffer;
}
export interface GuitarSampleBank {
  samples: readonly DecodedGuitarSample[];
  /** Per-pack level matching; defaults to the original 0.65 gain. */
  gain?: number;
}
export type GuitarSampleLoader = (
  context: BaseAudioContext,
  preset: GuitarPreset,
) => Promise<GuitarSampleBank>;
const defaultBases = Object.fromEntries(
  GUITAR_PRESETS.map((p) => [p.id, '/samples/' + p.directory]),
) as Record<GuitarPreset, string>;
/** Set before constructing players. Embed faces resolve this alongside their script. */
export function setGuitarSampleBase(base: string, preset: GuitarPreset = 'guitar'): void {
  defaultBases[preset] = base.replace(/\/+$/, '');
}
const banks = new WeakMap<BaseAudioContext, Map<string, Promise<GuitarSampleBank>>>();

/** No fetch or browser context until called. Failed loads can be retried. */
export function loadGuitarSamples(
  context: BaseAudioContext,
  base: string | undefined = undefined,
  preset: GuitarPreset = 'guitar',
): Promise<GuitarSampleBank> {
  base = (base ?? defaultBases[preset]).replace(/\/+$/, '');
  let cache = banks.get(context);
  if (!cache) banks.set(context, (cache = new Map()));
  const existing = cache.get(base);
  if (existing) return existing;
  const request = (async () => {
    const response = await fetch(`${base}/manifest.json`);
    if (!response.ok) throw new Error(`Guitar samples could not load (HTTP ${response.status}).`);
    const manifest = await response.json();
    if (
      manifest.formatVersion !== 1 ||
      !Array.isArray(manifest.samples) ||
      !manifest.samples.length ||
      manifest.samples.length > 256
    )
      throw new Error('Invalid guitar sample manifest.');
    const gain = manifest.gain ?? 0.65;
    if (!Number.isFinite(gain) || gain <= 0 || gain > 8)
      throw new Error('Invalid guitar sample gain.');
    const samples: DecodedGuitarSample[] = [];
    // Bounded download/decode concurrency; don't block the clock with asset work.
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, manifest.samples.length) }, async () => {
        while (cursor < manifest.samples.length) {
          const s = manifest.samples[cursor++] as GuitarSample;
          if (
            !/^[a-zA-Z0-9_.-]+\.(flac|wav)$/.test(s.file) ||
            !Number.isInteger(s.midi) ||
            s.midi < 0 ||
            s.midi > 127 ||
            ![2, 4].includes(s.layer) ||
            !Number.isInteger(s.take) ||
            s.take < 1
          )
            throw new Error('Invalid guitar sample mapping.');
          const audio = await fetch(`${base}/${s.file}`);
          if (!audio.ok)
            throw new Error(`Guitar sample ${s.file} could not load (HTTP ${audio.status}).`);
          const buffer = await context.decodeAudioData(await audio.arrayBuffer());
          samples.push({ ...s, buffer });
        }
      }),
    );
    // Download completion order must never choose a root or alternate take.
    samples.sort((a, b) => a.midi - b.midi || a.layer - b.layer || a.take - b.take);
    return { samples, gain };
  })();
  cache.set(base, request);
  void request.catch(() => {
    if (cache!.get(base) === request) cache!.delete(base);
  });
  return request;
}
