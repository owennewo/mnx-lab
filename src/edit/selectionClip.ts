// A copied selection as an immutable, transport-neutral value.
//
// The selection itself cannot be the clipboard: SelectionState stores live
// cursor addresses and closures whose membership changes with one document.
// Copy resolves that state elsewhere, then hands this module a self-contained
// value which is serialized immediately. The codec is deliberately DOM-free;
// where the string is kept is a separate boundary (selectionClipboard.ts).
import type {
  MnxGlobalMeasure,
  MnxGrace,
  MnxBeam,
  MnxOttava,
  MnxPart,
  MnxPartMeasure,
  MnxNote,
  MnxSequence,
  MnxSequenceItem,
  MnxStructure,
  MnxTremolo,
  MnxTuplet
} from '../model/mnx.ts';
import type { SelectionLevel } from './selection.ts';

export const SELECTION_CLIP_FORMAT = 'mnx-lab-selection-clip' as const;
export const SELECTION_CLIP_VERSION = 2 as const;
export const MNX_LAB_EXTENSION_VERSION = 5 as const;

export type SelectionClipShape = 'point' | 'range' | 'closure';

export interface SelectionClipSource {
  mnxVersion: number;
  extensionVersion: number;
}

export interface SelectionClipOrigin {
  level: SelectionLevel;
  shape: SelectionClipShape;
}

/** Only context required to understand a clip. Score-global musical content
 * such as repeats, harmonies and rehearsal marks is owned by wider clip kinds,
 * never smuggled into a note/event/part payload through this structure. */
export interface ClipMeasureContext {
  id?: string;
  key?: MnxGlobalMeasure['key'];
  time?: MnxGlobalMeasure['time'];
  /** The EFFECTIVE meter at this bar — declared here or inherited from any
   *  earlier bar — recorded so paste can linearize source distances and flow
   *  a run across destination barlines (core-paste-lands.md, D8). Absent
   *  only when no bar at or before this one declares a meter, where both
   *  sides fall back to the same default. `time` above stays declared-only:
   *  it is what a bootstrapped document re-declares. */
  effectiveTime?: { count: number; unit: number };
}

export interface SelectionClipContext {
  measures?: ClipMeasureContext[];
}

export interface SelectionClipDependencies {
  support?: MnxStructure['mnx']['support'];
  lyrics?: MnxStructure['global']['lyrics'];
}

export interface NoteSetClip {
  kind: 'note-set';
  notes: MnxNote[];
}

/** Items rather than events alone: a structurally closed event range may
 * contain a whole tuplet/grace/tremolo wrapper, but never half of one. */
export interface EventRunClipEntry {
  offset: number;
  /** Bar-local start as a reduced whole-note fraction. */
  onset: [number, number];
  items: MnxSequenceItem[];
}

export interface EventRunClip {
  kind: 'event-run';
  span: number;
  bars: EventRunClipEntry[];
}

export type MnxRhythmContainer = MnxGrace | MnxTremolo | MnxTuplet;

export interface ContainerRunClipEntry {
  offset: number;
  onset: [number, number];
  containers: MnxRhythmContainer[];
}

export interface ContainerRunClip {
  kind: 'container-run';
  span: number;
  bars: ContainerRunClipEntry[];
}

export interface VoiceBarClipEntry {
  /** Relative bar offset; sparse voices retain their gaps. */
  offset: number;
  sequence: MnxSequence;
  /** Voice-owned declarations which live beside the sequence in MNX. */
  declarations?: Omit<MnxPartMeasure, 'sequences'>;
}

export interface VoiceBarsClip {
  kind: 'voice-bars';
  /** Number of global bar positions covered, including sparse gaps. */
  span: number;
  bars: VoiceBarClipEntry[];
}

export interface StaffBarClipEntry {
  /** Relative bar offset; the measure is already filtered to one staff. */
  offset: number;
  measure: MnxPartMeasure;
}

export interface StaffBarsClip {
  kind: 'staff-bars';
  span: number;
  bars: StaffBarClipEntry[];
}

export interface PartClip {
  kind: 'part';
  part: MnxPart;
}

/** Part identity/topology needed to map complete measure columns. Measures
 * live on the column entries below, so they are intentionally absent here. */
export type ClipPartDescriptor = Omit<MnxPart, 'measures'>;

export interface MeasureClipColumn {
  global: MnxGlobalMeasure;
  /** Positional join against `parts`; absence is an empty part-measure. */
  parts: MnxPartMeasure[];
}

export interface MeasuresClip {
  kind: 'measures';
  parts: ClipPartDescriptor[];
  measures: MeasureClipColumn[];
}

export interface DocumentClip {
  kind: 'document';
  document: MnxStructure;
}

/** Relations live beside sequence content in MNX, so narrow clips need an
 * explicit owner bar. Wider clips retain them in their copied measures. */
export interface ClipBarRelationships {
  offset: number;
  beams?: MnxBeam[];
  ottavas?: MnxOttava[];
}

export interface SelectionClipRelationships {
  measures: ClipBarRelationships[];
}

export type SelectionClip =
  | NoteSetClip
  | EventRunClip
  | ContainerRunClip
  | VoiceBarsClip
  | StaffBarsClip
  | PartClip
  | MeasuresClip
  | DocumentClip;

export interface SelectionClipEnvelope {
  format: typeof SELECTION_CLIP_FORMAT;
  version: typeof SELECTION_CLIP_VERSION;
  source: SelectionClipSource;
  selection: SelectionClipOrigin;
  clip: SelectionClip;
  context?: SelectionClipContext;
  dependencies?: SelectionClipDependencies;
  relationships?: SelectionClipRelationships;
}

export class SelectionClipDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SelectionClipDecodeError';
  }
}

type JsonObject = Record<string, unknown>;

const LEVELS: ReadonlySet<string> = new Set([
  'note',
  'event',
  'container',
  'voiceMeasure',
  'partMeasure',
  'measure',
  'document'
]);

const SHAPES: ReadonlySet<string> = new Set(['point', 'range', 'closure']);

function fail(path: string, message: string): never {
  throw new SelectionClipDecodeError(`${path}: ${message}`);
}

function objectAt(value: unknown, path: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'expected an object');
  }
  return value as JsonObject;
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) return fail(path, 'expected an array');
  return value;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string') return fail(path, 'expected a string');
  return value;
}

function integerAt(value: unknown, path: string, minimum = 0): number {
  if (!Number.isInteger(value) || (value as number) < minimum) {
    return fail(path, `expected an integer >= ${minimum}`);
  }
  return value as number;
}

function exactKeys(
  object: JsonObject,
  path: string,
  required: readonly string[],
  optional: readonly string[] = []
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, 'unknown property');
  }
  for (const key of required) {
    if (!(key in object)) fail(path, `missing required property ${key}`);
  }
}

function objectArrayAt(value: unknown, path: string): JsonObject[] {
  return arrayAt(value, path).map((entry, index) => objectAt(entry, `${path}[${index}]`));
}

function validateJsonValue(value: unknown, path: string, ancestors: Set<object>): void {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(path, 'numbers must be finite');
    return;
  }
  if (typeof value !== 'object') fail(path, 'value is not JSON-serializable');
  if (ancestors.has(value)) fail(path, 'cyclic value');
  ancestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateJsonValue(entry, `${path}[${index}]`, ancestors));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail(path, 'expected a plain JSON object');
    }
    for (const [key, entry] of Object.entries(value)) {
      validateJsonValue(entry, `${path}.${key}`, ancestors);
    }
  }
  ancestors.delete(value);
}

function validateSource(value: unknown): void {
  const source = objectAt(value, '$.source');
  exactKeys(source, '$.source', ['mnxVersion', 'extensionVersion']);
  integerAt(source.mnxVersion, '$.source.mnxVersion', 1);
  integerAt(source.extensionVersion, '$.source.extensionVersion', 1);
}

function validateOrigin(value: unknown): void {
  const selection = objectAt(value, '$.selection');
  exactKeys(selection, '$.selection', ['level', 'shape']);
  if (!LEVELS.has(stringAt(selection.level, '$.selection.level'))) {
    fail('$.selection.level', 'unknown selection level');
  }
  if (!SHAPES.has(stringAt(selection.shape, '$.selection.shape'))) {
    fail('$.selection.shape', 'unknown selection shape');
  }
}

function validateMeasureContext(value: unknown, path: string): void {
  const context = objectAt(value, path);
  exactKeys(context, path, [], ['id', 'key', 'time', 'effectiveTime']);
  if (context.id !== undefined) stringAt(context.id, `${path}.id`);
  if (context.key !== undefined) {
    const key = objectAt(context.key, `${path}.key`);
    exactKeys(key, `${path}.key`, ['fifths']);
    integerAt(key.fifths, `${path}.key.fifths`, Number.MIN_SAFE_INTEGER);
  }
  if (context.time !== undefined) {
    const time = objectAt(context.time, `${path}.time`);
    exactKeys(time, `${path}.time`, ['count', 'unit'], ['display']);
    integerAt(time.count, `${path}.time.count`, 1);
    integerAt(time.unit, `${path}.time.unit`, 1);
    if (
      time.display !== undefined &&
      time.display !== 'common' &&
      time.display !== 'cut'
    ) fail(`${path}.time.display`, 'expected common or cut');
  }
  if (context.effectiveTime !== undefined) {
    const time = objectAt(context.effectiveTime, `${path}.effectiveTime`);
    exactKeys(time, `${path}.effectiveTime`, ['count', 'unit']);
    integerAt(time.count, `${path}.effectiveTime.count`, 1);
    integerAt(time.unit, `${path}.effectiveTime.unit`, 1);
  }
}

function validateContext(value: unknown): void {
  const context = objectAt(value, '$.context');
  exactKeys(context, '$.context', [], ['measures']);
  if (context.measures !== undefined) {
    arrayAt(context.measures, '$.context.measures').forEach((measure, index) =>
      validateMeasureContext(measure, `$.context.measures[${index}]`)
    );
  }
}

function validateDependencies(value: unknown): void {
  const dependencies = objectAt(value, '$.dependencies');
  exactKeys(dependencies, '$.dependencies', [], ['support', 'lyrics']);
  if (dependencies.support !== undefined) {
    const support = objectAt(dependencies.support, '$.dependencies.support');
    exactKeys(support, '$.dependencies.support', [], [
      'useAccidentalDisplay',
      'useBeams'
    ]);
    for (const [key, flag] of Object.entries(support)) {
      if (typeof flag !== 'boolean') fail(`$.dependencies.support.${key}`, 'expected a boolean');
    }
  }
  if (dependencies.lyrics !== undefined) {
    const lyrics = objectAt(dependencies.lyrics, '$.dependencies.lyrics');
    exactKeys(lyrics, '$.dependencies.lyrics', [], ['lineOrder', 'lineMetadata']);
    if (lyrics.lineOrder !== undefined) {
      arrayAt(lyrics.lineOrder, '$.dependencies.lyrics.lineOrder').forEach((line, index) =>
        stringAt(line, `$.dependencies.lyrics.lineOrder[${index}]`)
      );
    }
    if (lyrics.lineMetadata !== undefined) {
      const metadata = objectAt(lyrics.lineMetadata, '$.dependencies.lyrics.lineMetadata');
      for (const [line, raw] of Object.entries(metadata)) {
        const entry = objectAt(raw, `$.dependencies.lyrics.lineMetadata.${line}`);
        exactKeys(entry, `$.dependencies.lyrics.lineMetadata.${line}`, [], ['label', 'lang']);
        if (entry.label !== undefined)
          stringAt(entry.label, `$.dependencies.lyrics.lineMetadata.${line}.label`);
        if (entry.lang !== undefined)
          stringAt(entry.lang, `$.dependencies.lyrics.lineMetadata.${line}.lang`);
      }
    }
  }
}

function validateOffsetEntries(
  value: unknown,
  path: string,
  payloadKey: 'sequence' | 'measure'
): void {
  objectArrayAt(value, path).forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    exactKeys(
      entry,
      itemPath,
      ['offset', payloadKey],
      payloadKey === 'sequence' ? ['declarations'] : []
    );
    integerAt(entry.offset, `${itemPath}.offset`);
    objectAt(entry[payloadKey], `${itemPath}.${payloadKey}`);
    if (entry.declarations !== undefined) {
      objectAt(entry.declarations, `${itemPath}.declarations`);
    }
  });
}

function validateRelationships(value: unknown): void {
  const relationships = objectAt(value, '$.relationships');
  exactKeys(relationships, '$.relationships', ['measures']);
  objectArrayAt(relationships.measures, '$.relationships.measures').forEach((measure, index) => {
    const path = `$.relationships.measures[${index}]`;
    exactKeys(measure, path, ['offset'], ['beams', 'ottavas']);
    integerAt(measure.offset, `${path}.offset`);
    if (measure.beams !== undefined) objectArrayAt(measure.beams, `${path}.beams`);
    if (measure.ottavas !== undefined) objectArrayAt(measure.ottavas, `${path}.ottavas`);
  });
}

function validateMeasureColumns(value: unknown, path: string): void {
  objectArrayAt(value, path).forEach((column, index) => {
    const columnPath = `${path}[${index}]`;
    exactKeys(column, columnPath, ['global', 'parts']);
    objectAt(column.global, `${columnPath}.global`);
    objectArrayAt(column.parts, `${columnPath}.parts`);
  });
}

function validateRunBars(
  value: unknown,
  path: string,
  payloadKey: 'items' | 'containers'
): void {
  objectArrayAt(value, path).forEach((bar, index) => {
    const barPath = `${path}[${index}]`;
    exactKeys(bar, barPath, ['offset', 'onset', payloadKey]);
    integerAt(bar.offset, `${barPath}.offset`);
    const onset = arrayAt(bar.onset, `${barPath}.onset`);
    if (onset.length !== 2) fail(`${barPath}.onset`, 'expected a fraction pair');
    integerAt(onset[0], `${barPath}.onset[0]`);
    integerAt(onset[1], `${barPath}.onset[1]`, 1);
    objectArrayAt(bar[payloadKey], `${barPath}.${payloadKey}`);
  });
}

function validateClip(value: unknown): void {
  const clip = objectAt(value, '$.clip');
  const kind = stringAt(clip.kind, '$.clip.kind');
  switch (kind) {
    case 'note-set':
      exactKeys(clip, '$.clip', ['kind', 'notes']);
      objectArrayAt(clip.notes, '$.clip.notes');
      return;
    case 'event-run':
      exactKeys(clip, '$.clip', ['kind', 'span', 'bars']);
      integerAt(clip.span, '$.clip.span', 1);
      validateRunBars(clip.bars, '$.clip.bars', 'items');
      return;
    case 'container-run':
      exactKeys(clip, '$.clip', ['kind', 'span', 'bars']);
      integerAt(clip.span, '$.clip.span', 1);
      validateRunBars(clip.bars, '$.clip.bars', 'containers');
      objectArrayAt(clip.bars, '$.clip.bars').forEach((bar, barIndex) =>
        objectArrayAt(bar.containers, `$.clip.bars[${barIndex}].containers`)
          .forEach((container, index) => {
            if (!['tuplet', 'grace', 'tremolo'].includes(stringAt(
              container.type,
              `$.clip.bars[${barIndex}].containers[${index}].type`
            ))) fail(
              `$.clip.bars[${barIndex}].containers[${index}].type`,
              'unknown rhythm container'
            );
          })
      );
      return;
    case 'voice-bars':
      exactKeys(clip, '$.clip', ['kind', 'span', 'bars']);
      integerAt(clip.span, '$.clip.span', 1);
      validateOffsetEntries(clip.bars, '$.clip.bars', 'sequence');
      return;
    case 'staff-bars':
      exactKeys(clip, '$.clip', ['kind', 'span', 'bars']);
      integerAt(clip.span, '$.clip.span', 1);
      validateOffsetEntries(clip.bars, '$.clip.bars', 'measure');
      return;
    case 'part':
      exactKeys(clip, '$.clip', ['kind', 'part']);
      objectAt(clip.part, '$.clip.part');
      return;
    case 'measures':
      exactKeys(clip, '$.clip', ['kind', 'parts', 'measures']);
      objectArrayAt(clip.parts, '$.clip.parts');
      validateMeasureColumns(clip.measures, '$.clip.measures');
      return;
    case 'document':
      exactKeys(clip, '$.clip', ['kind', 'document']);
      objectAt(clip.document, '$.clip.document');
      return;
    default:
      fail('$.clip.kind', 'unknown clip kind');
  }
}

/** Validate the transport envelope. Full MNX/extension validation remains a
 * paste-planner responsibility because fragments are not schema roots. */
export function assertSelectionClipEnvelope(value: unknown): asserts value is SelectionClipEnvelope {
  validateJsonValue(value, '$', new Set());
  const envelope = objectAt(value, '$');
  exactKeys(
    envelope,
    '$',
    ['format', 'version', 'source', 'selection', 'clip'],
    ['context', 'dependencies', 'relationships']
  );
  if (envelope.format !== SELECTION_CLIP_FORMAT) fail('$.format', 'unknown clipboard format');
  if (envelope.version !== SELECTION_CLIP_VERSION) {
    fail('$.version', `unsupported clipboard version ${String(envelope.version)}`);
  }
  validateSource(envelope.source);
  validateOrigin(envelope.selection);
  validateClip(envelope.clip);
  if (envelope.context !== undefined) validateContext(envelope.context);
  if (envelope.dependencies !== undefined) validateDependencies(envelope.dependencies);
  if (envelope.relationships !== undefined) validateRelationships(envelope.relationships);
}

/** Serialize through the same validator decode uses. No richer in-memory path
 * is allowed to acquire semantics that the string representation cannot carry. */
export function encodeSelectionClip(envelope: SelectionClipEnvelope): string {
  assertSelectionClipEnvelope(envelope);
  return JSON.stringify(envelope);
}

/** The version switch is the upgrade seam. Version 2 renamed the top rung
 * `score` → `document` (core-document-rung.md), which the envelope carries
 * twice — `selection.level` and the clip's own `kind` — so a v1 string cannot
 * be read as a v2 one. No upgrader is written: a clip is a transient copy, not
 * a stored document, so a stale one is refused with a version message rather
 * than guessed at. An unknown future version is refused for the same reason. */
export function decodeSelectionClip(serialized: string): SelectionClipEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new SelectionClipDecodeError('$: invalid JSON');
  }
  assertSelectionClipEnvelope(parsed);
  return parsed;
}
