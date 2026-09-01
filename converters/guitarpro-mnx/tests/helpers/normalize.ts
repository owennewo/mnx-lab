import { MnxStructure, MnxSequenceItem, MnxEvent } from '../../src/common/types.js';

/**
 * Rewrites note ids to `n0..nN` in traversal order, technique targets
 * included, so two importers (or two round trips) can be compared with
 * `toEqual` even though each numbers notes with its own counter. The renaming
 * is a bijection — a dangling or crossed target still fails the comparison.
 */
export function normalizeIds(mnx: MnxStructure): MnxStructure {
  const clone: MnxStructure = JSON.parse(JSON.stringify(mnx));
  const rename = new Map<string, string>();

  const events = (items: MnxSequenceItem[] | undefined): MnxEvent[] =>
    (items ?? []).flatMap(item =>
      'type' in item && (item.type === 'tuplet' || item.type === 'grace')
        ? item.content
        : [item as MnxEvent]
    );

  for (const part of clone.parts) {
    for (const measure of part.measures) {
      for (const sequence of measure.sequences ?? []) {
        for (const event of events(sequence.content)) {
          for (const note of event.notes ?? []) {
            if (note.id) {
              rename.set(note.id, `n${rename.size}`);
              note.id = rename.get(note.id)!;
            }
          }
        }
      }
    }
  }

  for (const part of clone.parts) {
    for (const measure of part.measures) {
      for (const sequence of measure.sequences ?? []) {
        for (const event of events(sequence.content)) {
          for (const note of event.notes ?? []) {
            const technique = note._x?.mnxLab?.tab?.technique;
            if (!technique) continue;
            if (technique.hammerPull?.target) {
              technique.hammerPull.target =
                rename.get(technique.hammerPull.target) ?? technique.hammerPull.target;
            }
            if (technique.slide?.target) {
              technique.slide.target =
                rename.get(technique.slide.target) ?? technique.slide.target;
            }
          }
        }
      }
    }
  }

  return clone;
}
