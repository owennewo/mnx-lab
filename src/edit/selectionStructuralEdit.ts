// Shared structural replacement/repair helpers for clipboard paste and cut.
// These mutate only the detached document supplied by their caller.
import type {
  MnxBeam,
  MnxEvent,
  MnxLayoutContent,
  MnxNote,
  MnxNoteValueBase,
  MnxPartMeasure,
  MnxSequenceItem,
  MnxStructure
} from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';

/** Binary note values, largest first, as reduced whole-note fractions. */
const BINARY_BASES: [MnxNoteValueBase, number][] = [
  ['whole', 1], ['half', 2], ['quarter', 4], ['eighth', 8], ['16th', 16],
  ['32nd', 32], ['64th', 64], ['128th', 128], ['256th', 256],
  ['512th', 512], ['1024th', 1024]
];

/**
 * Spell an exact leftover duration as rest events — the fill paste uses when
 * a footprint edge consumes more than it replaces (core-paste-lands.md rule
 * 3; Cut's clear-to-rests is the degenerate whole-event case of the same
 * idea). Greedy largest-first binary decomposition, no dots: 3/8 becomes a
 * quarter rest then an eighth rest. A non-binary remainder (possible only if
 * a consumed unit had a non-binary outer span) falls back to authored
 * `space`, which is exact for any fraction.
 */
export function restItemsForDuration(num: number, den: number): MnxSequenceItem[] {
  const items: MnxSequenceItem[] = [];
  if (num <= 0) return items;
  if (den > 0 && 1024 % den === 0) {
    // Integer 1024th-note units peel to zero against the largest-first
    // binary ladder, so the binary path is always exact.
    let units = num * (1024 / den);
    for (const [base, value] of BINARY_BASES) {
      const size = 1024 / value;
      while (units >= size) {
        items.push({ duration: { base }, rest: {} } as MnxSequenceItem);
        units -= size;
      }
    }
    return items;
  }
  items.push({ type: 'space', duration: [num, den] } as unknown as MnxSequenceItem);
  return items;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function visitEvents(items: MnxSequenceItem[], visit: (event: MnxEvent) => void): void {
  for (const item of items) {
    if (isTimedEvent(item)) visit(item);
    else visitEvents((item as { content?: MnxSequenceItem[] }).content ?? [], visit);
  }
}

function notesAndEvents(doc: MnxStructure): { notes: MnxNote[]; events: MnxEvent[] } {
  const notes: MnxNote[] = [];
  const events: MnxEvent[] = [];
  doc.parts.forEach(part => part.measures.forEach(measure => measure.sequences.forEach(sequence =>
    visitEvents(sequence.content, event => {
      events.push(event);
      notes.push(...(event.notes ?? []));
    })
  )));
  return { notes, events };
}

/** Drop every relationship whose target no longer exists. Returns the number
 *  of detached relationship objects for result reporting. */
export function pruneDanglingSelectionReferences(doc: MnxStructure): number {
  const { notes, events } = notesAndEvents(doc);
  const noteIds = new Set(notes.flatMap(note => note.id ? [note.id] : []));
  const eventIds = new Set(events.flatMap(event => event.id ? [event.id] : []));
  const measureIds = new Set(doc.global.measures.flatMap(measure => measure.id ? [measure.id] : []));
  const layoutIds = new Set((doc.layouts ?? []).map(layout => layout.id));
  let detached = 0;

  notes.forEach(note => {
    if (note.ties) {
      const kept = note.ties.filter(tie =>
        tie.target === undefined || noteIds.has(tie.target) || (++detached, false)
      );
      if (kept.length) note.ties = kept;
      else delete note.ties;
    }
    const technique = note._x?.mnxLab?.tab?.technique as
      | Record<string, { target?: string } | boolean | undefined>
      | undefined;
    Object.entries(technique ?? {}).forEach(([key, value]) => {
      if (value && typeof value === 'object' && value.target && !noteIds.has(value.target)) {
        delete technique![key];
        detached++;
      }
    });
    const tab = note._x?.mnxLab?.tab;
    if (tab?.technique && Object.keys(tab.technique).length === 0) delete tab.technique;
    if (tab && Object.keys(tab).length === 0) delete note._x!.mnxLab!.tab;
    if (note._x?.mnxLab && Object.keys(note._x.mnxLab).length === 0) delete note._x.mnxLab;
    if (note._x && Object.keys(note._x).length === 0) delete note._x;
  });

  events.forEach(event => {
    if (!event.slurs) return;
    const kept = event.slurs.filter(slur => {
      const closed = eventIds.has(slur.target) &&
        (!slur.startNote || noteIds.has(slur.startNote)) &&
        (!slur.endNote || noteIds.has(slur.endNote));
      if (!closed) detached++;
      return closed;
    });
    if (kept.length) event.slurs = kept;
    else delete event.slurs;
  });

  const pruneBeams = (beams: MnxBeam[]): MnxBeam[] => beams.filter(beam => {
    const closed = beam.events.every(id => eventIds.has(id));
    if (!closed) detached++;
    if (closed && beam.beams) {
      beam.beams = pruneBeams(beam.beams);
      if (!beam.beams.length) delete beam.beams;
    }
    return closed;
  });
  doc.parts.forEach(part => part.measures.forEach(measure => {
    if (measure.beams) {
      measure.beams = pruneBeams(measure.beams);
      if (!measure.beams.length) delete measure.beams;
    }
    if (measure.ottavas) {
      const kept = measure.ottavas.filter(ottava =>
        measureIds.has(ottava.end.measure) || (++detached, false)
      );
      if (kept.length) measure.ottavas = kept;
      else delete measure.ottavas;
    }
  }));

  doc.scores?.forEach(score => {
    if (score.layout && !layoutIds.has(score.layout)) {
      delete score.layout;
      detached++;
    }
    score.pages?.forEach(page => {
      if (!page.systems) return;
      const kept = page.systems.filter(system =>
        measureIds.has(system.measure) || (++detached, false)
      );
      if (kept.length) page.systems = kept;
      else delete page.systems;
    });
    if (score.multimeasureRests) {
      const kept = score.multimeasureRests.filter(rest => {
        const start = doc.global.measures.findIndex(measure => measure.id === rest.start);
        const valid = start >= 0 && rest.duration > 1 && start + rest.duration <= doc.global.measures.length;
        if (!valid) detached++;
        return valid;
      });
      if (kept.length) score.multimeasureRests = kept;
      else delete score.multimeasureRests;
    }
  });
  return detached;
}

/** Replace or clear one staff's owned material without touching its siblings. */
export function replaceSelectionStaffMaterial(
  target: MnxPartMeasure,
  source: MnxPartMeasure | null,
  staffIndex: number
): void {
  const removedEventIds = new Set<string>();
  target.sequences.filter(sequence => (sequence.staff ?? 1) === staffIndex).forEach(sequence =>
    visitEvents(sequence.content, event => { if (event.id) removedEventIds.add(event.id); })
  );
  target.sequences = target.sequences.filter(sequence => (sequence.staff ?? 1) !== staffIndex);
  if (source) {
    const sequences = cloneJson(source.sequences).map(sequence => ({
      ...sequence,
      ...(staffIndex === 1 ? { staff: sequence.staff } : { staff: staffIndex })
    }));
    sequences.forEach(sequence => {
      if (staffIndex === 1 && sequence.staff === undefined) delete sequence.staff;
    });
    target.sequences.push(...sequences);
  }
  const replaceScoped = <K extends 'clefs' | 'directions' | 'ottavas'>(key: K): void => {
    const existing = target[key] as ({ staff?: number }[] | undefined);
    const incoming = source?.[key] as ({ staff?: number }[] | undefined);
    const kept = (existing ?? []).filter(entry => (entry.staff ?? 1) !== staffIndex);
    const remapped = cloneJson(incoming ?? []).map(entry => {
      if (staffIndex === 1) delete entry.staff;
      else entry.staff = staffIndex;
      return entry;
    });
    const next = [...kept, ...remapped];
    if (next.length) (target as unknown as Record<string, unknown>)[key] = next;
    else delete (target as unknown as Record<string, unknown>)[key];
  };
  replaceScoped('clefs');
  replaceScoped('directions');
  replaceScoped('ottavas');

  const keptDynamics = (target.dynamics ?? []).filter(dynamic =>
    (dynamic.staff ?? 1) !== staffIndex && dynamic.staffEnd !== staffIndex
  );
  const incomingDynamics = cloneJson(source?.dynamics ?? []).map(dynamic => ({
    ...dynamic,
    ...(staffIndex === 1 ? {} : { staff: staffIndex }),
    ...(dynamic.staffEnd === undefined ? {} : { staffEnd: staffIndex })
  }));
  const dynamics = [...keptDynamics, ...incomingDynamics];
  if (dynamics.length) target.dynamics = dynamics;
  else delete target.dynamics;

  if (removedEventIds.size && target.beams) {
    target.beams = target.beams.filter(beam => !beam.events.some(id => removedEventIds.has(id)));
    if (!target.beams.length) delete target.beams;
  }
  if (source?.beams?.length) target.beams = [...(target.beams ?? []), ...cloneJson(source.beams)];
}

function pruneLayoutNode(node: MnxLayoutContent, partId: string): MnxLayoutContent | null {
  const next = cloneJson(node);
  if (next.sources) {
    next.sources = next.sources.filter(source => source.part !== partId);
    if (!next.sources.length) return null;
  }
  if (next.content) {
    next.content = next.content.flatMap(child => {
      const kept = pruneLayoutNode(child, partId);
      return kept ? [kept] : [];
    });
    if (!next.content.length && next.type === 'group') return null;
  }
  return next;
}

/** Remove an ink-bearing part and conservatively repair explicit layout and
 *  score references. Default/all-parts layouts need no rewrite. */
export function removeSelectionPart(doc: MnxStructure, partIndex: number): number {
  const part = doc.parts[partIndex];
  if (!part) return 0;
  doc.parts.splice(partIndex, 1);
  if (!part.id) return 0;
  let detached = 0;
  const removedLayouts = new Set<string>();
  doc.layouts = (doc.layouts ?? []).flatMap(layout => {
    const content = layout.content.flatMap(node => {
      const kept = pruneLayoutNode(node, part.id!);
      if (!kept) detached++;
      return kept ? [kept] : [];
    });
    if (!content.length) {
      removedLayouts.add(layout.id);
      detached++;
      return [];
    }
    return [{ ...layout, content }];
  });
  if (!doc.layouts.length) delete doc.layouts;
  doc.scores?.forEach(score => {
    if (score.layout && removedLayouts.has(score.layout)) {
      delete score.layout;
      detached++;
    }
  });
  return detached;
}

/** Rewrite count-based multimeasure-rest references before removing complete
 *  timeline columns. Id-based references are pruned after the splice. */
export function removeSelectionMeasureColumns(
  doc: MnxStructure,
  measureIndices: number[]
): number {
  const indices = [...new Set(measureIndices)].sort((a, b) => a - b);
  const removed = new Set(indices);
  const oldIdIndex = new Map(
    doc.global.measures.flatMap((measure, index) => measure.id ? [[measure.id, index] as const] : [])
  );
  let detached = 0;
  doc.scores?.forEach(score => {
    if (!score.multimeasureRests) return;
    const kept = score.multimeasureRests.flatMap(rest => {
      const start = oldIdIndex.get(rest.start);
      if (start === undefined || removed.has(start)) {
        detached++;
        return [];
      }
      const removedInside = indices.filter(index => index >= start && index < start + rest.duration).length;
      const duration = rest.duration - removedInside;
      if (duration < 2) {
        detached++;
        return [];
      }
      return [{ ...rest, duration }];
    });
    if (kept.length) score.multimeasureRests = kept;
    else delete score.multimeasureRests;
  });
  [...indices].reverse().forEach(index => {
    doc.global.measures.splice(index, 1);
    doc.parts.forEach(part => part.measures.splice(index, 1));
  });
  return detached + pruneDanglingSelectionReferences(doc);
}
