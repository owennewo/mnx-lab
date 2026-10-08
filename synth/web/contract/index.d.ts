// Types for the mnx-sound/2 contract (see docs/contract.md).
export const CONTRACT: 'mnx-sound/2';
export type Kind = 'plucked' | 'keys' | 'kit';
export const KINDS: readonly Kind[];
export const TECHNIQUES: readonly ('bend' | 'vibrato' | 'slide' | 'legato' | 'mute' | 'harmonic' | 'letRing')[];
export const CONTROLS: readonly ('sustainPedal' | 'mute' | 'tempo')[];
export const DEFAULT_BPM: 120;
export const PRIMITIVES: readonly ('pitchCurve' | 'gate' | 'velocity' | 'damping')[];
export type Piece = 'kick' | 'snare' | 'side-stick' | 'tom-high' | 'tom-mid' | 'tom-low'
  | 'hihat-closed' | 'hihat-open' | 'hihat-pedal' | 'crash' | 'ride';
export const PIECES: readonly Piece[];
export const CHOKE_CUTS: Readonly<Partial<Record<Piece, readonly Piece[]>>>;
export function pieceFromGm(gmNote: number): Piece | null;
/** Seconds → frame: floor(t·rate + 0.5 + 1e-6), matching the pre-host planner's half-up ratio rounding. */
export function frameAt(seconds: number, rate: number): number;

export interface StringSpec { pitch: number; [extra: string]: unknown }
export interface Layout { strings: StringSpec[]; capo?: number; [extra: string]: unknown }
export interface Instrument { kind: Kind | string; design: string | Record<string, unknown>; layout?: Layout; [extra: string]: unknown }
export type BlockState = 'on' | 'off';
/** An insert-chain block or a return bus. Types and parameter values belong to the host's block catalogue. */
export interface Block { id: string; type: string; state?: BlockState; params?: Record<string, number | boolean>; [extra: string]: unknown }
export interface Strip { levelDb?: number; pan?: number; mute?: boolean; solo?: boolean; sends?: Record<string, number>; [extra: string]: unknown }
export interface Part {
  id: string; name?: string; instrument: Instrument;
  /** Ordered insert chain (signal order); duplicates allowed under distinct ids. */
  chain?: Block[]; strip?: Strip; seed?: number; [extra: string]: unknown;
}
export interface Setup {
  contract: 'mnx-sound/2';
  session: { buses?: (Block & { state?: 'on' | 'off' })[]; master?: { volumeDb?: number; ceilingDb?: number }; [extra: string]: unknown };
  parts: Part[]; [extra: string]: unknown;
}

export type CurvePoint = { at: number; cents: number };
export type Technique =
  | { type: 'bend'; points: CurvePoint[] }
  | { type: 'vibrato'; depthCents: number; rateHz: number; start?: number; delaySeconds?: number; fadeSeconds?: number; phase?: number }
  | { type: 'slide'; direction: 'in' | 'out'; cents?: number; span?: number; fretted?: boolean }
  | { type: 'legato'; from: string; via: 'hammer' | 'pull' | 'slide'; glide?: number }
  | { type: 'mute'; kind: 'palm'; amount?: number } | { type: 'mute'; kind: 'dead' }
  | { type: 'harmonic'; kind: 'natural' | 'artificial' | 'pinch' | 'tap' | 'semi' | 'feedback' }
  | { type: 'letRing' }
  | { type: string; [field: string]: unknown };
export interface Nuance { intonationCents?: number; attackBendCents?: number; excitation?: { positionDelta?: number; hardnessDelta?: number } }
export interface Note {
  id: string; part: string; at: number; duration: number; velocity: number;
  target: { pitch: number } | { piece: Piece | string };
  fingering?: { string: number; fret?: number };
  techniques?: Technique[]; nuance?: Nuance;
  /** Chord gesture (C18): members share `id`, part, onset and gesture. strum: direction is the stroke (down = highest-numbered string first);
   *  roll: direction is the pitch (up rises). Members start `spreadSeconds`·k/(N−1) late and keep their written end. */
  gesture?: Gesture; [extra: string]: unknown;
}
export interface Gesture { id: string; type: 'strum' | 'roll'; direction: 'down' | 'up'; spreadSeconds: number }
export const GESTURES: readonly ('strum' | 'roll')[];
export const GESTURE_FIELDS: readonly ('type' | 'direction' | 'spreadSeconds')[];
export function rising(gesture: Gesture): boolean;
export function gestureGroups(notes: Note[]): { groups: Map<string, Note[]>; mismatched: Note[] };
export function pitchOrder(members: Note[], gesture: Gesture): Note[];
export function gestureTimes(order: Note[], gesture: Gesture): Map<string, { at: number; duration: number }>;
export type Control =
  | { id: string; part: string; at: number; type: 'sustainPedal'; value: number }
  | { id: string; part: string; at: number; type: 'mute'; value: boolean }
  /** Session-wide: the tempo from `at` on; tempo-synced blocks (echo) follow it. Before the first, DEFAULT_BPM (120). */
  | { id: string; at: number; type: 'tempo'; bpm: number; part?: never }
  | { id: string; part: string; at: number; type: string; [field: string]: unknown };
export interface EventLog { contract: 'mnx-sound/2'; setup: Setup; notes?: Note[]; controls?: Control[] }

export interface Capabilities {
  kind: string; contract: 'mnx-sound/2'; revision: number; basic: boolean; targets: 'pitch' | 'piece';
  range?: { pitch: readonly [number, number] }; pieces?: readonly Piece[];
  techniques: readonly string[]; gestures: readonly ('strum' | 'roll')[]; controls: readonly string[];
  primitives: readonly ('pitchCurve' | 'gate' | 'velocity' | 'damping')[]; horizonSeconds: number;
}
export const CAPABILITIES: Readonly<Record<Kind, Capabilities>>;
export const GENERIC_CAPABILITIES: Capabilities;

export type DiagnosticCode = 'approximated' | 'dropped' | 'unknown-technique' | 'unknown-control' | 'unknown-piece' | 'gesture-mismatch' | 'unknown-gesture'
  | 'unsupported-kind' | 'unresolved-reference' | 'fingering-mismatch' | 'out-of-range' | 'late-note' | 'late-edit'
  | 'voice-stolen' | 'retrigger-conflict' | 'invalid-note' | 'invalid-control';
export interface Diagnostic { code: DiagnosticCode; severity: 'info' | 'warning' | 'error'; message: string; noteId?: string; controlId?: string; part?: string; at?: number; [extra: string]: unknown }
export const DIAGNOSTICS: Readonly<Record<DiagnosticCode, { severity: Diagnostic['severity']; text: string }>>;
export function diagnostic(code: DiagnosticCode, fields?: Record<string, unknown>): Diagnostic;

export class ContractError extends Error { id?: string }
export function validateSetup(setup: unknown): Setup;
export function validateNote(note: unknown): Note;
export function validateControl(control: unknown): Control;
export function validateTechnique(technique: unknown, id?: string): Technique;
export function validateLayout(layout: unknown, id?: string): Layout;
export function validateEventLog(log: unknown): EventLog;
/** Validates notes and controls against known parts; `known` collects notes by id across calls (for legato references). */
export function checkEvents(notes: Note[], controls: Control[], parts: Set<string>, known: Map<string, Note>): void;
export function knownTechnique(technique: { type: string }): boolean;
/** True for controls that apply to the whole session and name no part (tempo). */
export function sessionControl(control: { type: string }): boolean;
export function knownControl(control: { type: string }): boolean;

export interface Primitives {
  pitchCurve?: CurvePoint[]; gate?: number; velocity?: number;
  damping?: { at: number; amount: number }; release?: 'ring'; timbre?: string[];
  extendPrevious?: { id: string; until: number };
}
export const LOWERING: Readonly<{
  palm: { gate: number; velocity: number }; dead: { gate: number; velocity: number }; legato: { velocity: number }; harmonic: { velocity: number };
  letRingSeconds: number; slideCents: number; slideSpan: number; glide: number; vibratoFade: number; vibratoPointsPerCycle: number; maxCurvePoints: number;
}>;
export function lower(note: Note, capabilities: Capabilities, options?: { resolve?: (id: string) => Note | undefined }): { note: Note; primitives: Primitives; diagnostics: Diagnostic[] };
export function pitchCurve(note: Note, techniques: Technique[], previous?: Note): CurvePoint[];
export function vibratoCents(technique: Technique, ageSeconds: number, durationSeconds: number): number;
export function techniqueCents(technique: Technique, note: Note, fraction: number, previous?: Note): number;

export interface Batch { through?: number; notes?: Note[]; controls?: Control[]; cancel?: { from: number } | { ids: string[] } }
export interface Fixture {
  contract: 'mnx-sound/2'; fixture: { id: string; description: string }; setup: Setup;
  batches?: Batch[]; notes?: Note[]; controls?: Control[];
  render: { rate: 44100 | 48000 | 96000; seconds: number }; expect: Array<{ kind: string; [field: string]: unknown }>;
}
export const EXPECTATIONS: Readonly<Record<string, unknown>>;
export function validateFixture(fixture: unknown): Fixture;
export function effectiveEvents(fixture: Fixture): { notes: Note[]; controls: Control[] };
