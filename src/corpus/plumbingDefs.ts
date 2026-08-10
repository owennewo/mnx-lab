/**
 * Schema $defs that are "plumbing": the structural skeleton every document
 * passes through (root, part, sequence, …) and scalar/utility types (ids,
 * integers, colors, label strings). They are excluded from the feature-def
 * coverage denominator — covering "positive-integer" tells us nothing about
 * renderer correctness, so counting it would flatter the coverage number.
 *
 * This is a curation choice, not derived from the schema; adjust deliberately.
 * The list itself lives in scenarios/manifest.json (`plumbingDefs`) so the
 * corpus checker and the workbench share one denominator. Aggregate wrapper
 * defs (arrays/dicts whose singular item def is the real feature) are also
 * plumbing: the `*-list` ones via the manifest's suffix rule, the plain
 * plurals (`systems`, `pages`, …) listed explicitly — covering a wrapper is
 * implied by covering its item def.
 */
import manifest from '../../scenarios/manifest.json';

const { defs, suffixes, prefixes } = manifest.plumbingDefs;

const PLUMBING_DEFS = new Set<string>(defs);

export function isPlumbingDef(def: string): boolean {
  return (
    PLUMBING_DEFS.has(def) ||
    suffixes.some(s => def.endsWith(s)) ||
    prefixes.some(p => def.startsWith(p))
  );
}
