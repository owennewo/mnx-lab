/**
 * Harmonic nodes: a node's distance in frets → how far above the string (or the
 * stopped note) it sounds, in semitones. The node at 12 sounds the octave, 7 and
 * 19 the twelfth, 5 and 24 two octaves. A natural harmonic counts from the nut,
 * any other type from the stopped fret — Guitar Pro's `HarmonicFret` is read
 * both ways, and alphaTab's `harmonicPitch` agrees on the table.
 */
const NODES = new Map<number, number>([
  [12, 12],
  [7, 19],
  [19, 19],
  [5, 24],
  [24, 24],
  [4, 28],
  [9, 28],
  [16, 28],
  [3, 31],
  [2, 36]
]);

/** Semitones a node sounds above its string or stopped note; undefined off the table. */
export function harmonicInterval(node: number): number | undefined {
  return NODES.get(node);
}

/** The lowest-numbered node that sounds `interval` above: the inverse an exporter needs. */
export function harmonicNode(interval: number): number | undefined {
  const nodes = [...NODES].filter(([, sounds]) => sounds === interval).map(([node]) => node);
  return nodes.length ? Math.min(...nodes) : undefined;
}
