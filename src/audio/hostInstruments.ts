/**
 * Choosing a part's instrument on the synth's host (roadmap/inprogress/core-campaign-synth.md,
 * Phase 6). Pure. Studio never edits an instrument: it picks a factory design, or imports a
 * part rig made in the synth's own app (`/synth/`, Export part), or keeps the old player's
 * sound for the part.
 */
import { validateSetup, type Part } from '@mnx-lab/synth/contract';
import type { PartInstrument, PartRig } from './partMix.ts';

/** A factory design as the synth's presets list it (`/synth/data/instrument-v2/presets.json`). */
export interface FactoryDesign { id: string; name: string; family?: string }
export const BASIC_KEYS: FactoryDesign = { id: 'basic-piano', name: 'Basic keys' };
export const BASIC_KIT: FactoryDesign = { id: 'basic-kit', name: 'Basic kit' };
/** Ids as the contract writes them (validate.js `ident`). */
export const DESIGN_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const RIG_KINDS = new Set(['plucked', 'keys', 'kit']);

export type RigResult = { ok: true; rig: PartRig; kind: 'plucked' | 'keys' | 'kit' } | { ok: false; message: string };
/** An imported file as a part rig: rig 3.0.0, one part of a kind studio can play. */
export function parsePartRig(raw: unknown): RigResult {
  const fail = (message: string): RigResult => ({ ok: false, message });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Not a rig file.');
  const rig = raw as Record<string, unknown>;
  if (rig.rig !== '3.0.0') return fail('Not a rig 3.0.0 file: export it again from the synth.');
  if (typeof rig.name !== 'string' || !rig.name.trim() || rig.name.length > 120) return fail('The rig has no usable name.');
  try { validateSetup(rig.setup); } catch (error) { return fail(`The rig is not valid: ${error instanceof Error ? error.message : String(error)}`); }
  const parts = (rig.setup as { parts: Part[] }).parts;
  if (parts.length !== 1) return fail(`The rig holds ${parts.length} parts; export a single part from the synth (Export part).`);
  const kind = String(parts[0]!.instrument.kind);
  if (!RIG_KINDS.has(kind)) return fail(`The rig's instrument (${kind}) cannot play here.`);
  return { ok: true, rig: rig as unknown as PartRig, kind: kind as 'plucked' | 'keys' | 'kit' };
}

/** A stored choice, checked value by value (localStorage and the library are both untrusted). */
export function normalizeInstrument(raw: unknown): PartInstrument | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  if (value.kind === 'sink') return { kind: 'sink' };
  if (value.kind === 'design' && typeof value.design === 'string' && DESIGN_ID.test(value.design)) return { kind: 'design', design: value.design };
  if (value.kind === 'rig') { const parsed = parsePartRig(value.rig); if (parsed.ok) return { kind: 'rig', rig: parsed.rig }; }
  return undefined;
}

/** The rig's one part. */
export const rigPart = (rig: PartRig) => rig.setup.parts[0] as Part;
