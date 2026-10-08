/**
 * The part router (roadmap/inprogress/core-campaign-synth.md, Phase 5): an mnx-sound/2 setup
 * for the synth's instrument host, built from the score and studio's per-part mix. Pure.
 *
 *  - A part whose voices are all kit voices plays the basic kit.
 *  - A part that declares a fingerboard (`_x.mnxLab.strings`, 1–6 strings within the
 *    plucked instrument's 36–76 range) plays the guitar on THOSE strings and that capo:
 *    the score is the tuning authority (contract D4).
 *  - Every other pitched part plays the basic keys; a declared fingerboard the plucked
 *    instrument cannot take (a bass, a seven-string) says so as a diagnostic.
 *  - The mix: a part's level and mute become its channel strip. One Room bus (Studio) and
 *    a master at 0 dB serve the whole piece; designs are the factory defaults until the
 *    Instruments sheet chooses them (Phase 6).
 */
import type { Part, Setup } from '@mnx-lab/synth/contract';
import type { MnxStructure } from '../model/mnx.ts';
import type { Performance, PerformanceVoice } from './performanceTypes.ts';
import type { PartMix } from './partMix.ts';
import { midiOf } from './pitch.ts';

export type HostKind = 'plucked' | 'keys' | 'kit';
export const DEFAULT_DESIGNS: Readonly<Record<HostKind, string | { id: string }>> = Object.freeze({
  plucked: 'clear-steel', keys: { id: 'basic-piano' }, kit: { id: 'basic-kit' },
});
const ROOM = { id: 'room', type: 'room', state: 'on' as const, params: { level: 0.18, decay: 0.6, predelay: 8, damping: 8500, width: 0.8 } };
const PLUCKED_RANGE = [36, 76] as const;

export interface RoutedPart { partIndex: number; id: string; kind: HostKind }
export interface HostSetup {
  setup: Setup;
  parts: RoutedPart[];
  /** The contract part a performance voice plays on. */
  partOf: (voice: PerformanceVoice) => string | undefined;
  diagnostics: { partIndex: number; message: string }[];
}

/** 0–1 linear level → dB for a channel strip (silence floors at the strip's −60 dB). */
export const levelDb = (volume = 1) => (volume <= 0 ? -60 : Math.max(-60, Math.min(12, 20 * Math.log10(volume))));

export function hostSetup(performance: Performance, document: MnxStructure, mix: PartMix = {}): HostSetup {
  const diagnostics: HostSetup['diagnostics'] = [];
  const indices = [...new Set(performance.voices.map(v => v.partIndex))].sort((a, b) => a - b);
  const routed: RoutedPart[] = [], parts: Part[] = [];
  for (const partIndex of indices) {
    const voices = performance.voices.filter(v => v.partIndex === partIndex);
    const source = document.parts[partIndex], ext = source?._x?.mnxLab, id = `part${partIndex}`;
    let kind: HostKind = voices.every(v => v.kit) ? 'kit' : 'keys';
    let layout: Part['instrument']['layout'];
    if (kind !== 'kit' && ext?.strings?.length) {
      const strings = [...ext.strings].sort((a, b) => a.string - b.string), pitches = strings.map(s => midiOf(s.pitch));
      const positional = strings.every((s, i) => s.string === i + 1);
      if (positional && pitches.length <= 6 && pitches.every(p => p >= PLUCKED_RANGE[0] && p <= PLUCKED_RANGE[1])) {
        kind = 'plucked';
        layout = { strings: pitches.map(pitch => ({ pitch })), capo: Math.max(0, Math.min(12, ext.capo ?? 0)) };
      } else diagnostics.push({ partIndex, message: `${source?.name ?? `Part ${partIndex + 1}`}: its ${pitches.length} strings are outside what the synth's guitar can take (1–6 strings, open pitches 36–76); it plays the basic keys.` });
    }
    const entry = mix[partIndex];
    parts.push({ id, name: source?.name ?? `Part ${partIndex + 1}`, instrument: { kind, design: DEFAULT_DESIGNS[kind], ...(layout ? { layout } : {}) },
      chain: [], strip: { levelDb: levelDb(entry?.volume), pan: 0, mute: entry?.muted === true, solo: false, sends: { room: kind === 'plucked' ? 0.3 : 0.15 } } });
    routed.push({ partIndex, id, kind });
  }
  const byIndex = new Map(routed.map(r => [r.partIndex, r.id]));
  return {
    setup: { contract: 'mnx-sound/2', session: { buses: [ROOM], master: { volumeDb: 0, ceilingDb: -1 } }, parts },
    parts: routed, partOf: voice => byIndex.get(voice.partIndex), diagnostics,
  };
}
