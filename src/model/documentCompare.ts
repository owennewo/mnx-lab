/**
 * Comparing two MNX documents for what a converter round trip LOST — the judge
 * behind studio's save check and the committed round-trip register
 * (roadmap: studio-campaign-authoring, item core-roundtrip-register).
 *
 * Two documents that say the same music rarely spell it the same way: every
 * importer numbers its own ids, gives an event an id only when a slur needs to
 * point at it, and stamps its own `encoding`. None of that is loss. So a
 * document is CANONICALISED first, and only then diffed:
 *
 *  - `_x.mnxLab.encoding` is dropped: whoever writes the file stamps it.
 *  - An id matters only through what points at it, so identity is moved
 *    entirely INTO the references: each is rewritten to the path of the object
 *    it resolves to, and every `id` is then dropped. A reference compares by
 *    what it RESOLVES to — a retargeted slur reads as a change, a respelled one
 *    does not — and whether an object happens to carry an id says nothing:
 *    documents built by ops carry none, importers carry one per note, and an
 *    event keeps its id only while a beam or slur still points at it (so
 *    keeping ids would report every lost beam twice).
 *  - A reference that resolves to nothing is left exactly as spelled, so a
 *    dangling target still differs from a good one; a DUPLICATED id resolves to
 *    nothing in particular, so it and its references stay as spelled too.
 *
 * Path-named ids shift when an earlier sibling disappears. That is deliberate:
 * a dropped event IS a difference, and callers that want a summary collapse
 * paths to shapes (`collapseDifferences`), where a cascade is a count.
 *
 * Pure and DOM-free: the harness, `importers/` and the shells all call it.
 */

type Json = unknown;
type JsonObject = Record<string, Json>;
export type DocumentPath = readonly (string | number)[];

/**
 * Every property that REFERS to an id, by property name. `id`, `id-list` and
 * `id-pair` are the published schema's three reference shapes; `name` marks a
 * reference to an object KEY (a kit component, a sound) — an authored name, not
 * a generated counter, so it is never rewritten.
 *
 * `harness/conformance/document-compare.test.ts` derives the same inventory
 * from `spec/mnx-schema.json` and `spec/mnx-lab-extensions.schema.json` and
 * goes red when either grows a reference this table does not name.
 */
export const ID_REFERENCE_FIELDS: Readonly<Record<string, 'id' | 'id-list' | 'id-pair' | 'name'>> = {
  target: 'id',
  startNote: 'id',
  endNote: 'id',
  visuallyContinues: 'id',
  layout: 'id',
  measure: 'id',
  start: 'id',
  end: 'id',
  part: 'id',
  resumeAt: 'id',
  events: 'id-list',
  span: 'id-pair',
  sound: 'name',
  kitComponent: 'name'
};

const isObject = (value: Json): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const canonicalName = (path: DocumentPath): string => `@${path.join('/')}`;

function walk(value: Json, path: (string | number)[], visit: (object: JsonObject, path: DocumentPath) => void): void {
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, [...path, index], visit));
  else if (isObject(value)) {
    visit(value, path);
    for (const key of Object.keys(value)) walk(value[key], [...path, key], visit);
  }
}

/** Calls `rewrite` for every id-reference string held by `object`. */
function eachReference(object: JsonObject, rewrite: (id: string) => string): void {
  for (const [key, kind] of Object.entries(ID_REFERENCE_FIELDS)) {
    const value = object[key];
    if (kind === 'id' && typeof value === 'string') object[key] = rewrite(value);
    else if (kind === 'id-list' && Array.isArray(value))
      object[key] = value.map(item => (typeof item === 'string' ? rewrite(item) : item));
    // An id-pair is an object whose own `start`/`end` are plain id references,
    // so the walk reaches them as `id` fields; nothing to do here.
  }
}

/** The comparison form of a document: see the module comment. Never mutates. */
export function canonicalizeDocument<T>(document: T): T {
  const clone = structuredClone(document) as Json;
  if (isObject(clone) && isObject(clone._x) && isObject(clone._x.mnxLab)) {
    delete clone._x.mnxLab.encoding;
    if (!Object.keys(clone._x.mnxLab).length) delete clone._x.mnxLab;
    if (!Object.keys(clone._x).length) delete clone._x;
  }

  const declared = new Map<string, string>();
  const ambiguous = new Set<string>();
  walk(clone, [], (object, path) => {
    if (typeof object.id !== 'string') return;
    if (declared.has(object.id)) ambiguous.add(object.id);
    else declared.set(object.id, canonicalName(path));
  });
  // Leave a duplicated id and its references as spelled: the defect stays
  // visible instead of being named away.
  for (const id of ambiguous) declared.delete(id);

  walk(clone, [], object => {
    eachReference(object, id => declared.get(id) ?? id);
    if (typeof object.id === 'string' && !ambiguous.has(object.id)) delete object.id;
  });
  return clone as T;
}

export interface DocumentDifference {
  path: DocumentPath;
  /** `lost`: in the first document only. `gained`: in the second only. */
  kind: 'lost' | 'gained' | 'changed';
  before?: Json;
  after?: Json;
}

const show = (value: Json): string => JSON.stringify(value) ?? 'undefined';

function diff(before: Json, after: Json, path: (string | number)[], out: DocumentDifference[]): void {
  if (show(before) === show(after)) return;
  if (Array.isArray(before) && Array.isArray(after)) {
    // Equal length: nothing was spliced, so indices still mean the same thing.
    // Otherwise every later index moved, and only the multiset view is honest.
    if (before.length === after.length) { before.forEach((item, index) => diff(item, after[index], [...path, index], out)); return; }
    const counts = new Map<string, Json[]>();
    for (const item of before) counts.set(show(item), [...(counts.get(show(item)) ?? []), item]);
    for (const item of after) {
      const left = counts.get(show(item));
      if (left?.length) left.pop(); else out.push({ path: [...path, -1], kind: 'gained', after: item });
    }
    for (const left of counts.values()) for (const item of left) out.push({ path: [...path, -1], kind: 'lost', before: item });
    return;
  }
  if (isObject(before) && isObject(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (!(key in after)) out.push({ path: [...path, key], kind: 'lost', before: before[key] });
      else if (!(key in before)) out.push({ path: [...path, key], kind: 'gained', after: after[key] });
      else diff(before[key], after[key], [...path, key], out);
    }
    return;
  }
  out.push({ path, kind: 'changed', before, after });
}

/**
 * What differs between two documents once both are canonical. `before` is the
 * document that was saved, `after` the one that came back; an array whose
 * length changed reports its members at index `-1`.
 */
export function compareDocuments(before: Json, after: Json): DocumentDifference[] {
  const out: DocumentDifference[] = [];
  diff(canonicalizeDocument(before), canonicalizeDocument(after), [], out);
  return out;
}

export interface DifferenceShape { path: string; kind: DocumentDifference['kind']; count: number }

/** Differences grouped by path SHAPE (array indices become `[]`), sorted. */
export function collapseDifferences(differences: readonly DocumentDifference[]): DifferenceShape[] {
  const counts = new Map<string, DifferenceShape>();
  for (const { path, kind } of differences) {
    const shape = path.map(segment => (typeof segment === 'number' ? '[]' : segment)).join('/');
    const key = `${shape} | ${kind}`;
    const entry = counts.get(key) ?? { path: shape, kind, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
}
