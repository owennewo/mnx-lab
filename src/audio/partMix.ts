/**
 * The per-part mix: a level, a mute and an instrument for each part, beneath the player's
 * master volume. Pure — the part router (src/audio/hostSetup.ts) turns it into the synth's
 * channel strips and instruments.
 *
 * Keyed by part index in the document, because a performance voice carries its `partIndex`
 * and a part need not carry an id. A part with no entry plays at full level on its default
 * instrument.
 */
import type { Performance } from './performanceTypes.ts';

export interface PartMixEntry {
  /** 0–1 within the master volume; default 1. */
  readonly volume?: number;
  readonly muted?: boolean;
  /** What the part plays on the synth. Absent: the part router's default (hostSetup.ts). */
  readonly instrument?: PartInstrument;
}
/**
 * A part's instrument (core-campaign-synth.md, Phase 6):
 *  - `design`: a factory design — a guitar design id, `basic-piano` or `basic-kit`;
 *  - `rig`: a part rig 3.0.0 exported from the synth (`/synth/`, Export part): its
 *    instrument, chain and strip; the score keeps its strings and capo (D4).
 */
export type PartInstrument =
  | { readonly kind: 'design'; readonly design: string }
  | { readonly kind: 'rig'; readonly rig: PartRig };
/** A rig 3.0.0 holding one part (and the buses it sends to). Its shape is the synth's;
 *  src/audio/hostInstruments.ts checks it. */
export interface PartRig {
  readonly rig: '3.0.0';
  readonly name: string;
  readonly setup: { readonly contract: 'mnx-sound/2'; readonly session: object; readonly parts: readonly object[] };
}
export type PartMix = Readonly<Record<number, PartMixEntry>>;

/** Whether a part plays only percussion kit voices. */
export function isKitPart(performance: Performance, partIndex: number): boolean {
  const voices = performance.voices.filter((v) => v.partIndex === partIndex);
  return voices.length > 0 && voices.every((v) => v.kit);
}
