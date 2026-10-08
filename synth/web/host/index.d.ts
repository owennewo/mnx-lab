// Types for the instrument host (docs/contract.md §6).
import type {Setup, Note, Control, Capabilities, Diagnostic, Primitives, Layout} from '../contract/index.js';
export * from '../contract/index.js';

export interface DspAsset { module: WebAssembly.Module; meta: Record<string, unknown> }
export interface HostAssets { blocks: Record<'drive' | 'vibrato' | 'tremolo' | 'echo' | 'room' | 'master' | string, DspAsset>; instruments?: Record<string, Record<string, DspAsset>> }

/** A scheduled note as the host hands it to an instrument (frames on the host clock). */
export interface NoteEntry {
  id: string; note: Note; lowered: Note; primitives: Primitives;
  frame: number; endFrame: number; lengthFrames: number; cut?: boolean;
}
export interface ControlEntry { id: string; frame: number; control: Control }
export interface InstrumentChanges { notes: NoteEntry[]; removed: string[]; controls: ControlEntry[]; removedControls: string[] }

/** Instrument kind contract. Output may depend on notes up to capabilities.horizonSeconds ahead, never further. */
export interface InstrumentClass {
  readonly kind: string;
  readonly capabilities: Capabilities;
  /** Validate and migrate a design (preset) of this kind to its current schema; throws on unsupported data. */
  migrateDesign?(design: unknown): unknown;
  new (options: { part: Setup['parts'][number]; rate: number; block: number; assets?: Record<string, DspAsset>; emit: (type: string, data: unknown) => void }): Instrument;
}
export interface Instrument {
  /** Linear output gain the design carries (e.g. recording level); the part level multiplies it. */
  readonly outputGain?: number;
  configure(part: Setup['parts'][number]): void;
  /** Upserts and removals; never touches material before the commit point. */
  apply(changes: InstrumentChanges): void;
  /** Called once before the first render with the host frame the instrument's clock starts at. */
  begin?(frame: number): void;
  /** Render the next `count` frames (≤ block); returns stereo views valid until the next call. */
  render(count: number): [Float32Array, Float32Array];
}

export class HostCore {
  constructor(options: { rate: number; block?: number; instruments: Map<string, InstrumentClass> | Record<string, InstrumentClass>; assets: HostAssets });
  readonly rate: number; readonly block: number; position: number; readonly seconds: number; readonly horizonFrames: number; readonly limited: number;
  on(type: 'diagnostic' | 'meter' | 'sounding', fn: (data: any) => void): () => void;
  configure(setup: Setup): Diagnostic[];
  schedule(batch: { notes?: Note[]; controls?: Control[]; through?: number }): Diagnostic[];
  cancel(cancel: { from?: number; ids?: string[]; silence?: boolean }): Diagnostic[];
  render(count?: number): [Float32Array, Float32Array];
}

export interface Label { id: string; part: string; kind: string; onsetFrame: number; endFrame: number; pitch?: number; piece?: string; velocity: number; techniques: { type: string; native: boolean }[] }
export function renderOffline(options: {
  setup: Setup; notes?: Note[]; controls?: Control[];
  batches?: { through?: number; notes?: Note[]; controls?: Control[]; cancel?: { from?: number; ids?: string[]; silence?: boolean } }[];
  rate?: number; seconds?: number; block?: number; instruments: Map<string, InstrumentClass> | Record<string, InstrumentClass>; assets: HostAssets;
}): { audio: [Float32Array, Float32Array]; frames: number; diagnostics: Diagnostic[]; sounding: { id: string; part: string; at: number }[]; limited: number; labels: Label[] };

/** Main-thread host over the AudioWorklet processor (live AudioContext or OfflineAudioContext). */
export class InstrumentHost {
  static create(context: BaseAudioContext, options?: { assets?: HostAssets }): Promise<InstrumentHost>;
  configure(setup: Setup): Promise<Diagnostic[]>;
  schedule(batch: { notes?: Note[]; controls?: Control[]; through?: number }): Promise<Diagnostic[]>;
  cancel(cancel: { from?: number; ids?: string[]; silence?: boolean }): Promise<Diagnostic[]>;
  profile(action: 'start' | 'snapshot'): Promise<unknown>;
  now(): number;
  on(type: 'diagnostic' | 'meter' | 'sounding' | 'error', fn: (data: any) => void): () => void;
  connect(destination?: AudioNode): this;
  dispose(): void;
}
export function loadHostAssets(base?: string): Promise<HostAssets>;
export const INSTRUMENTS: Map<string, InstrumentClass>;

export const RIG_VERSION: '3.0.0';
export interface Rig { rig: '3.0.0'; name: string; setup: Setup; [extra: string]: unknown }
export function makeRig(name: string, setup: Setup): Rig;
export function validateRig(rig: unknown): Rig;

export interface ParamSpec { label: string; min?: number; max?: number; default: number | boolean; unit?: string; scale?: number; log?: boolean; type?: 'boolean'; choices?: readonly number[] }
export interface BlockType { name: string; role: 'effect' | 'bus'; hue: string; summary: string; params: Record<string, ParamSpec>; presets: Record<string, Record<string, number | boolean>> }
export const BLOCK_TYPES: Readonly<Record<'drive' | 'vibrato' | 'tremolo' | 'echo' | 'room', BlockType>>;
export const EFFECT_TYPES: readonly string[];
export const BUS_TYPES: readonly string[];
export const BLOCK_STATES: readonly ('on' | 'off')[];
export const ECHO_BEATS: readonly number[];
export const MASTER_PARAMS: Readonly<{ volumeDb: ParamSpec; ceilingDb: ParamSpec }>;
export function defaultParams(type: string): Record<string, number | boolean>;
export function resolveParams(type: string, params?: Record<string, unknown>): { params: Record<string, number | boolean>; problems: string[] };

export const DESIGN_SCHEMA: 3;
export const STANDARD_GUITAR: Layout;
export const UKULELE: Layout;
export function migrateDesign(design: unknown): Record<string, unknown>;
export function validateDesign(design: unknown): Record<string, unknown>;
export function resolveDesign(design: Record<string, unknown>, layout?: Layout): { preset: Record<string, unknown>; slots: { string: number; slot: number; pitch: number; capo: number }[]; parked: number[]; slotOf: Map<number, number> };
export function curveAt(register: number[], values: number[], pitch: number, stepped?: boolean): number;
