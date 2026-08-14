// The surviving-document oracle's eyes (campaign item 2,
// roadmap/proposed/core-element-ops-destruct-sweep.md).
//
// The campaign promises that removing one element leaves "everything else
// surviving byte-identically except forced cascades". Asserting that needs a
// diff that survives ARRAY SHIFTS: splicing one note out of a six-note chord
// moves every later index, so a path-wise comparison would report five bogus
// changes and drown the one real question — did anything ELSE move?
//
// So arrays are compared as multisets of their serialized members and the diff
// stops there; objects are compared key-wise and descended. Every reported
// change is therefore "this container's contents changed, and here is exactly
// what left and what arrived".
type Json = unknown;

export interface DocChange {
  /** Path of the container whose contents changed. */
  path: (string | number)[];
  /** Serialized members/values that disappeared. */
  removed: string[];
  /** Serialized members/values that appeared. */
  added: string[];
}

const show = (value: Json): string => JSON.stringify(value) ?? 'undefined';

function multisetDiff(before: Json[], after: Json[]): { removed: string[]; added: string[] } {
  const counts = new Map<string, number>();
  for (const item of before) counts.set(show(item), (counts.get(show(item)) ?? 0) + 1);
  const added: string[] = [];
  for (const item of after) {
    const key = show(item);
    const count = counts.get(key) ?? 0;
    if (count > 0) counts.set(key, count - 1);
    else added.push(key);
  }
  const removed: string[] = [];
  for (const [key, count] of counts) for (let i = 0; i < count; i++) removed.push(key);
  return { removed: removed.sort(), added: added.sort() };
}

/** Every container whose contents differ between two documents. */
export function diffDocuments(before: Json, after: Json, path: (string | number)[] = []): DocChange[] {
  if (show(before) === show(after)) return [];

  if (Array.isArray(before) && Array.isArray(after)) {
    // Same length ⇒ nothing was spliced, so indices still mean the same thing
    // and descending gives the precise answer. Different length ⇒ a splice
    // shifted every later member, and only the multiset view is meaningful.
    if (before.length === after.length)
      return before.flatMap((item, index) => diffDocuments(item, after[index], [...path, index]));
    const { removed, added } = multisetDiff(before, after);
    return removed.length || added.length ? [{ path, removed, added }] : [];
  }

  const bothObjects =
    before !== null && after !== null && typeof before === 'object' && typeof after === 'object' &&
    !Array.isArray(before) && !Array.isArray(after);
  if (bothObjects) {
    const beforeRecord = before as Record<string, Json>;
    const afterRecord = after as Record<string, Json>;
    const changes: DocChange[] = [];
    const removed: string[] = [];
    const added: string[] = [];
    for (const key of Object.keys(beforeRecord))
      if (!(key in afterRecord)) removed.push(`${key}=${show(beforeRecord[key])}`);
    for (const key of Object.keys(afterRecord))
      if (!(key in beforeRecord)) added.push(`${key}=${show(afterRecord[key])}`);
    if (removed.length || added.length)
      changes.push({ path, removed: removed.sort(), added: added.sort() });
    for (const key of Object.keys(beforeRecord))
      if (key in afterRecord)
        changes.push(...diffDocuments(beforeRecord[key], afterRecord[key], [...path, key]));
    return changes;
  }

  return [{ path, removed: [show(before)], added: [show(after)] }];
}

export const pathString = (path: (string | number)[]): string => path.join('/');

/** Does `path` sit at or inside `prefix`? */
export function pathWithin(path: (string | number)[], prefix: (string | number)[]): boolean {
  return prefix.every((segment, index) => path[index] === segment);
}
