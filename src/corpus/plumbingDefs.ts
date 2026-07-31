/**
 * Schema $defs that are "plumbing": the structural skeleton every document
 * passes through (root, part, sequence, …) and scalar/utility types (ids,
 * integers, colors, label strings). They are excluded from the feature-def
 * coverage denominator — covering "positive-integer" tells us nothing about
 * renderer correctness, so counting it would flatter the coverage number.
 *
 * This is a curation choice, not derived from the schema; adjust deliberately.
 * Aggregate `*-list` wrapper defs are also treated as plumbing (see
 * isPlumbingDef) since covering a list is implied by covering its item def.
 */
const PLUMBING_DEFS = new Set([
  // document skeleton
  'root',
  'score',
  'scores',
  'score-name',
  'mnx',
  'version-number',
  'support',
  'global',
  'global-attrs',
  'measures-global',
  'measure-global',
  'parts',
  'part',
  'part-measures',
  'part-measure',
  'sequence',
  'sequence-content',
  'event',
  'notes',
  'note',
  'pitch',
  'step',
  'octave',
  'note-value',
  'note-value-base',
  'note-value-quantity',
  // ubiquitous carriers (every doc has a time signature / clef context)
  'time',
  'clef',
  'staff-position',
  'rhythmic-position',
  // scalar / utility types
  'positive-integer',
  'integer-signed',
  'integer-unsigned',
  'fraction',
  'id',
  'id-pair',
  'yes-no-auto',
  'up-down',
  'up-down-auto',
  'orientation',
  'language-code',
  'color',
  'simple-color',
  'string',
  'midi-number',
  'measure-count',
  'measure-number',
  'written',
  'voice-name',
  'vendor-dict'
]);

export function isPlumbingDef(def: string): boolean {
  return PLUMBING_DEFS.has(def) || def.endsWith('-list') || def.startsWith('literal-string-');
}
