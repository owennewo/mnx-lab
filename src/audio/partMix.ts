/**
 * The per-part mix: a level, a mute and a sound for each part, beneath the
 * player's master volume. Pure — the native sink routes each part's voices
 * through a gain set from `partLevel`, and chooses each voice's timbre with
 * `voicePresetFor`.
 *
 * Keyed by part index in the document, because a performance voice carries its
 * `partIndex` and a part need not carry an id. A part with no entry plays at
 * full level in the player's own sound, which is exactly the player before
 * the mix existed.
 */
import type { Performance } from './performanceTypes.ts';
import { isSamplePreset, type SamplePreset, type VoicePreset } from './sampleSelection.ts';

export interface PartMixEntry {
  /** 0–1 within the master volume; default 1. */
  readonly volume?: number;
  readonly muted?: boolean;
  /** Absent: the player's `voicePreset`. */
  readonly sound?: VoicePreset;
}
export type PartMix = Readonly<Record<number, PartMixEntry>>;

/** Each voice's bus — its part index, as the sink's `voiceBus` names it. */
export function partBuses(performance: Performance): Map<string, string> {
  return new Map(performance.voices.map((v) => [v.id, String(v.partIndex)]));
}

/** The gain a part's bus carries: silent when muted, else its clamped volume. */
export function partLevel(entry: PartMixEntry | undefined): number {
  if (entry?.muted) return 0;
  const volume = entry?.volume ?? 1;
  return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
}

/** Whether a part plays only percussion kit voices, which always use the synth. */
export function isKitPart(performance: Performance, partIndex: number): boolean {
  const voices = performance.voices.filter((v) => v.partIndex === partIndex);
  return voices.length > 0 && voices.every((v) => v.kit);
}

/** The sound a part plays: its own choice, else the fallback. */
export function partSound(mix: PartMix, partIndex: number, fallback: VoicePreset): VoicePreset {
  return mix[partIndex]?.sound ?? fallback;
}

/**
 * The timbre for each voice: kit voices stay on the synth (no pack carries a
 * kit), every other voice takes its part's sound. Returns the plain preset when
 * every voice agrees, so an unmixed player keeps the sink's single-preset path.
 */
export function voicePresetFor(
  performance: Performance,
  mix: PartMix,
  fallback: VoicePreset,
): VoicePreset | ((voice: string) => VoicePreset) {
  const byVoice = new Map(
    performance.voices.map((v) => [v.id, v.kit ? 'synth' : partSound(mix, v.partIndex, fallback)] as const),
  );
  const distinct = new Set(byVoice.values());
  if (distinct.size <= 1) return distinct.values().next().value ?? fallback;
  return (voice: string) => byVoice.get(voice) ?? 'synth';
}

/** The sample packs the mix needs loaded before playing, in first-use order. */
export function requiredPresets(performance: Performance, mix: PartMix, fallback: VoicePreset): SamplePreset[] {
  const out: SamplePreset[] = [];
  for (const v of performance.voices) {
    if (v.kit) continue;
    const sound = partSound(mix, v.partIndex, fallback);
    if (isSamplePreset(sound) && !out.includes(sound)) out.push(sound);
  }
  return out;
}
