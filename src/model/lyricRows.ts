import type { MnxSequenceItem, MnxStructure } from './mnx.ts';

/**
 * The verse ROWS of a document, per language group, in stacking order: every
 * row that has words anywhere, plus every row declared in `lineMetadata` — a
 * declared row with no words is an UNSUNG verse that still holds its place
 * (verse 1 of an instrumental first pass). Ordered `lineOrder` first, then the
 * rest sorted. A pass sings the row at its verse's ordinal in its group, so the
 * lyric panel, the player's lamp, click targets and the save comparison must
 * all count the same rows — this is the one place they are counted.
 * Group '' is the primary language; others are keyed by `lang`.
 */
export function lyricRowGroups(doc: MnxStructure, extraIds: Iterable<string> = []): Map<string, string[]> {
  const metadata = doc.global?.lyrics?.lineMetadata ?? {};
  const present = new Set<string>([...Object.keys(metadata), ...extraIds]);
  const visit = (items: readonly MnxSequenceItem[]) => {
    for (const item of items) {
      for (const id of Object.keys((item as { lyrics?: { lines?: object } }).lyrics?.lines ?? {})) present.add(id);
      const content = (item as { content?: MnxSequenceItem[] }).content;
      if (Array.isArray(content)) visit(content);
    }
  };
  for (const part of doc.parts ?? []) for (const measure of part.measures ?? []) for (const sequence of measure.sequences ?? []) visit(sequence.content ?? []);
  const order = [...new Set(doc.global?.lyrics?.lineOrder ?? [])];
  const stacked = [...order.filter(id => present.has(id)), ...[...present].filter(id => !order.includes(id)).sort()];
  const groups = new Map<string, string[]>();
  for (const id of stacked) {
    const key = metadata[id]?.lang ?? '';
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }
  return groups;
}

/** The primary language's verse rows: what pass N sings is row N-1 of this. */
export function verseRows(doc: MnxStructure): string[] {
  return lyricRowGroups(doc).get('') ?? [];
}
