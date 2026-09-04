// Which schema objects a document actually instantiates.
//
// `scenarios/*/meta.json` carries `coversDefs`, but that is the SPEC's answer
// for the spec's own examples — computed upstream, committed here, and
// available only for documents that are scenarios. The converter matrix has to
// ask the same question of documents nobody has ever scored: a fixture, or the
// same fixture after a round trip through a converter. So this walks a document
// against the schema the way upstream's accumulate_used_json_objects() does.
//
// It is validated against upstream's own answer — `mnx-defs.test.ts` walks
// every mirrored spec scenario and requires that everything `coversDefs` claims
// is found. That makes this an implementation of a known-correct function
// rather than a second opinion about one.
import mnxSchema from '../../spec/mnx-schema.json';

type Json = unknown;
interface SchemaNode {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, SchemaNode>;
  additionalProperties?: SchemaNode | boolean;
  patternProperties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  allOf?: SchemaNode[];
  anyOf?: SchemaNode[];
  oneOf?: SchemaNode[];
  required?: string[];
  $defs?: Record<string, SchemaNode>;
}

const schema = mnxSchema as unknown as SchemaNode;
const defs = schema.$defs ?? {};

const defNameOf = (ref: string): string | null =>
  ref.startsWith('#/$defs/') ? ref.slice('#/$defs/'.length) : null;

/**
 * Follows `$ref`, recording every def name passed through.
 *
 * A chain of refs (`slur-list` → `slur`) means the document instantiates both,
 * which is what the spec's own join records too.
 */
function resolve(node: SchemaNode, seen: Set<string>): SchemaNode {
  let current = node;
  const guard = new Set<string>();
  while (current?.$ref) {
    const name = defNameOf(current.$ref);
    if (!name || guard.has(name)) break;
    guard.add(name);
    seen.add(name);
    current = defs[name] ?? {};
  }
  return current ?? {};
}

/**
 * How well a value fits a union branch: -1 for "cannot be", higher is better.
 *
 * MNX discriminates its unions with a `const` type string — `sequence-content`
 * is any of event / grace / tuplet / space / multi-note-tremolo, and only the
 * last four carry one. A plain "does it fit" test therefore matches `event` for
 * everything, so the branches have to be SCORED: a matching discriminator beats
 * a merely structural fit, and more satisfied required keys beats fewer.
 */
function branchScore(value: Json, node: SchemaNode): number {
  const resolved = resolve(node, new Set());
  if (Array.isArray(value)) return resolved.type === 'array' || resolved.items ? 1 : -1;
  if (value !== null && typeof value === 'object') {
    if (resolved.type && resolved.type !== 'object') return -1;
    const object = value as Record<string, Json>;
    let score = 0;
    for (const key of resolved.required ?? []) {
      if (!(key in object)) return -1;
      score += 1;
    }
    for (const [key, propertySchema] of Object.entries(resolved.properties ?? {})) {
      const constant = (resolve(propertySchema, new Set()) as { const?: Json }).const;
      if (constant === undefined) continue;
      if (key in object) {
        if (object[key] !== constant) return -1;
        score += 10; // a matching discriminator is worth more than any count
      }
    }
    return score;
  }
  if (typeof value === 'string') return resolved.type === 'string' || !resolved.type ? 1 : -1;
  if (typeof value === 'number') {
    return resolved.type === 'number' || resolved.type === 'integer' || !resolved.type ? 1 : -1;
  }
  if (typeof value === 'boolean') return resolved.type === 'boolean' || !resolved.type ? 1 : -1;
  return 0;
}

function walk(value: Json, node: SchemaNode, seen: Set<string>, depth: number): void {
  if (depth > 40 || value === undefined || value === null) return;
  const resolved = resolve(node, seen);

  for (const branch of resolved.allOf ?? []) walk(value, branch, seen, depth + 1);

  // A union credits only its best-fitting branch. Walking all of them would
  // claim objects the document does not contain; walking none loses whole
  // subtrees, which is what a bare "exactly one fits" rule does here.
  for (const union of [resolved.oneOf, resolved.anyOf]) {
    if (!union) continue;
    let best: SchemaNode | null = null;
    let bestScore = 0;
    let tied = false;
    for (const branch of union) {
      const score = branchScore(value, branch);
      if (score < 0) continue;
      if (score > bestScore || best === null) {
        best = branch;
        bestScore = score;
        tied = false;
      } else if (score === bestScore) {
        tied = true;
      }
    }
    // A tie is a genuine ambiguity; guessing between equals inflates coverage.
    if (best && !tied) walk(value, best, seen, depth + 1);
  }

  if (Array.isArray(value)) {
    if (resolved.items) for (const item of value) walk(item, resolved.items, seen, depth + 1);
    return;
  }

  if (typeof value !== 'object') return;
  const object = value as Record<string, Json>;

  for (const [key, child] of Object.entries(object)) {
    const propertySchema = resolved.properties?.[key];
    if (propertySchema) {
      walk(child, propertySchema, seen, depth + 1);
      continue;
    }
    const pattern = Object.entries(resolved.patternProperties ?? {}).find(([expression]) =>
      new RegExp(expression).test(key)
    );
    if (pattern) {
      walk(child, pattern[1], seen, depth + 1);
      continue;
    }
    if (resolved.additionalProperties && typeof resolved.additionalProperties === 'object') {
      walk(child, resolved.additionalProperties, seen, depth + 1);
    }
  }
}

/** The schema `$defs` a document instantiates, by name. */
export function defsInDocument(document: Json): Set<string> {
  const seen = new Set<string>();
  walk(document, schema, seen, 0);
  return seen;
}

/**
 * The `_x.mnxLab` keys a document carries, as `_x.mnxLab.<key>` row names.
 *
 * These sit beside the schema defs in the matrix on purpose: a feature carried
 * under the vendor namespace is supported by the converter and *unsupported by
 * the standard*, and telling those two apart is the whole point of the
 * exercise (roadmap/proposed/core-campaign-musicxml.md).
 */
export function extensionKeysInDocument(document: Json): Set<string> {
  const keys = new Set<string>();
  const visit = (value: Json, inLab: boolean, depth: number): void => {
    if (depth > 40 || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, inLab, depth + 1);
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, Json>)) {
      if (!inLab && key === '_x') {
        const lab = (child as Record<string, Json>)?.mnxLab;
        if (lab && typeof lab === 'object') {
          for (const labKey of Object.keys(lab as Record<string, Json>)) {
            keys.add(`_x.mnxLab.${labKey}`);
          }
          visit(lab, true, depth + 1);
        }
        continue;
      }
      visit(child, inLab, depth + 1);
    }
  };
  visit(document, false, 0);
  return keys;
}
