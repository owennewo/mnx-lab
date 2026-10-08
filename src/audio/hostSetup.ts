/**
 * The part router (roadmap/inprogress/core-campaign-synth.md, Phases 5 and 6): an mnx-sound/2
 * setup for the synth's instrument host, built from the score and the person's per-part mix.
 * Pure.
 *
 * By default:
 *  - a part whose voices are all kit voices plays the basic kit;
 *  - a part that declares a fingerboard (`_x.mnxLab.strings`, 1–6 strings within the
 *    plucked instrument's 36–76 range) plays the guitar (Clear steel) on THOSE strings and
 *    that capo: the score is the tuning authority (contract D4);
 *  - every other pitched part plays the basic keys; a declared fingerboard the plucked
 *    instrument cannot take (a bass, a seven-string) says so as a diagnostic.
 * A part's chosen instrument (`PartMixEntry.instrument`, Phase 6) replaces the default when
 * it fits the part — a factory design, or a part rig's instrument, chain and strip (its
 * layout gives way to the score's) — or keeps the old player's sound (`sink`: the part is
 * left out of the setup, and the backend plays it on the sink). A choice that does not fit
 * the part (a guitar design on a part with no fingerboard) falls back with a diagnostic.
 *
 * The mix: a part's level and mute become its channel strip (added to a rig's own level).
 * One Room bus (Studio) and a master at 0 dB serve the whole piece (S20); a rig's sends to
 * other buses are dropped.
 */
import type { Block, Part, Setup } from '@mnx-lab/synth/contract';
import type { MnxStructure } from '../model/mnx.ts';
import type { Performance, PerformanceVoice } from './performanceTypes.ts';
import type { PartMix } from './partMix.ts';
import { BASIC_KEYS, BASIC_KIT, rigPart } from './hostInstruments.ts';
import { midiOf } from './pitch.ts';

export type HostKind = 'plucked' | 'keys' | 'kit';
export const DEFAULT_DESIGNS: Readonly<Record<HostKind, string | { id: string }>> = Object.freeze({
  plucked: 'clear-steel', keys: { id: BASIC_KEYS.id }, kit: { id: BASIC_KIT.id },
});
const ROOM: Block = { id: 'room', type: 'room', state: 'on', params: { level: 0.18, decay: 0.6, predelay: 8, damping: 8500, width: 0.8 } };
const PLUCKED_RANGE = [36, 76] as const;

export interface RoutedPart {
  partIndex: number;
  id: string;
  /** `sink`: the part plays the old player's sound beside the host. */
  kind: HostKind | 'sink';
  /** Where its instrument comes from. */
  source: 'default' | 'design' | 'rig' | 'sink';
  /** The design id it plays (a rig's own design when it carries an id), if any. */
  design?: string;
  /** The rig's name, for a rig. */
  rig?: string;
  /** Whether the part can play the guitar on its own strings (the sheet offers guitar designs). */
  pluckable: boolean;
  /** Plays only kit voices. */
  kit: boolean;
}
export interface HostSetup {
  setup: Setup;
  parts: RoutedPart[];
  /** The contract part a performance voice plays on; undefined for parts on the sink. */
  partOf: (voice: PerformanceVoice) => string | undefined;
  diagnostics: { partIndex: number; message: string }[];
}

/** 0–1 linear level → dB for a channel strip (silence floors at the strip's −60 dB). */
export const levelDb = (volume = 1) => (volume <= 0 ? -60 : Math.max(-60, Math.min(12, 20 * Math.log10(volume))));
const clampDb = (db: number) => Math.max(-60, Math.min(12, db));

export function hostSetup(performance: Performance, document: MnxStructure, mix: PartMix = {}): HostSetup {
  const diagnostics: HostSetup['diagnostics'] = [];
  const indices = [...new Set(performance.voices.map(v => v.partIndex))].sort((a, b) => a - b);
  const routed: RoutedPart[] = [], parts: Part[] = [];
  for (const partIndex of indices) {
    const voices = performance.voices.filter(v => v.partIndex === partIndex);
    const source = document.parts[partIndex], ext = source?._x?.mnxLab, id = `part${partIndex}`;
    const name = source?.name ?? `Part ${partIndex + 1}`;
    const say = (message: string) => diagnostics.push({ partIndex, message: `${name}: ${message}` });
    const kit = voices.every(v => v.kit);
    let layout: Part['instrument']['layout'];
    if (!kit && ext?.strings?.length) {
      const strings = [...ext.strings].sort((a, b) => a.string - b.string), pitches = strings.map(s => midiOf(s.pitch));
      const positional = strings.every((s, i) => s.string === i + 1);
      if (positional && pitches.length <= 6 && pitches.every(p => p >= PLUCKED_RANGE[0] && p <= PLUCKED_RANGE[1]))
        layout = { strings: pitches.map(pitch => ({ pitch })), capo: Math.max(0, Math.min(12, ext.capo ?? 0)) };
      else say(`its ${pitches.length} strings are outside what the synth's guitar can take (1–6 strings, open pitches 36–76); it plays the basic keys.`);
    }
    const pluckable = layout !== undefined;
    const fallback: HostKind = kit ? 'kit' : pluckable ? 'plucked' : 'keys';
    const entry = mix[partIndex], choice = entry?.instrument;
    if (choice?.kind === 'sink') {
      routed.push({ partIndex, id, kind: 'sink', source: 'sink', pluckable, kit });
      continue;
    }
    const fits = (wanted: HostKind) => (kit ? wanted === 'kit' : wanted === 'keys' || (wanted === 'plucked' && pluckable));
    let kind: HostKind = fallback, design: Part['instrument']['design'] = DEFAULT_DESIGNS[fallback];
    let from: RoutedPart['source'] = 'default', rigName: string | undefined;
    let chain: Block[] = [], rigStrip: NonNullable<Part['strip']> = {};
    if (choice?.kind === 'design') {
      const wanted: HostKind = choice.design === BASIC_KIT.id ? 'kit' : choice.design === BASIC_KEYS.id ? 'keys' : 'plucked';
      if (fits(wanted)) {
        kind = wanted; from = 'design';
        design = wanted === 'plucked' ? choice.design : { id: choice.design };
      } else say(wanted === 'plucked' ? 'a guitar design needs strings the guitar can play; it plays its default.' : `${choice.design} cannot play this part; it plays its default.`);
    } else if (choice?.kind === 'rig') {
      const part = rigPart(choice.rig), wanted = part.instrument.kind as HostKind;
      if (fits(wanted)) {
        kind = wanted; from = 'rig'; rigName = choice.rig.name;
        design = part.instrument.design;
        chain = part.chain ?? [];
        rigStrip = part.strip ?? {};
        const dropped = Object.keys(rigStrip.sends ?? {}).filter(bus => bus !== ROOM.id);
        if (dropped.length) say(`the rig's sends to ${dropped.join(', ')} are dropped; the piece has one room.`);
      } else say(`the rig ${choice.rig.name} (${wanted}) cannot play this part; it plays its default.`);
    }
    const sends = from === 'rig'
      ? Object.fromEntries(Object.entries(rigStrip.sends ?? {}).filter(([bus]) => bus === ROOM.id))
      : { room: kind === 'plucked' ? 0.3 : 0.15 };
    parts.push({
      id, name, instrument: { kind, design, ...(kind === 'plucked' && layout ? { layout } : {}) }, chain,
      strip: { levelDb: clampDb((rigStrip.levelDb ?? 0) + levelDb(entry?.volume)), pan: rigStrip.pan ?? 0, mute: entry?.muted === true, solo: false, sends },
    });
    const designId = typeof design === 'string' ? design : typeof (design as { id?: unknown }).id === 'string' ? (design as { id: string }).id : undefined;
    routed.push({ partIndex, id, kind, source: from, pluckable, kit, ...(designId ? { design: designId } : {}), ...(rigName ? { rig: rigName } : {}) });
  }
  const byIndex = new Map(routed.filter(r => r.kind !== 'sink').map(r => [r.partIndex, r.id]));
  return {
    setup: { contract: 'mnx-sound/2', session: { buses: [ROOM], master: { volumeDb: 0, ceilingDb: -1 } }, parts },
    parts: routed, partOf: voice => byIndex.get(voice.partIndex), diagnostics,
  };
}
