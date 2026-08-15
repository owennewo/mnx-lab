/**
 * Every id-bearing reference in an MNX document, collected in ONE place.
 *
 * MNX joins its parts by id: a tie names the note it lands on, a beam names
 * the events it spans, a system names the measure it starts at. Nothing that
 * *removes* anything can be correct without knowing the whole set — the
 * element-ops campaign's *reference* removal class is "unlink both ends", and
 * the destructibility sweep's oracle is "no reference dangles"
 * (roadmap/complete/core-element-ops-destruct-sweep.md). Both need this list,
 * so it lives at the model floor rather than being re-derived per consumer.
 *
 * Two kinds of breakage are distinguished, because they fail differently:
 *
 * - **dangling** — the target id no longer resolves at all. Always a bug.
 * - **inkless** — the id still resolves, but the thing it names stopped
 *   drawing what the reference presumes. Deleting the last note of a beamed
 *   event leaves a rest carrying the same id: the beam does not dangle, it
 *   beams a rest. Hence `presumes`.
 */
import type { MnxStructure, MnxBeam } from './mnx.ts';

/** What id space a reference points into. */
export type ReferenceTarget =
  | 'note'
  | 'event'
  | 'measure'
  | 'part'
  | 'layout'
  | 'lyric-line'
  | 'kit-component'
  | 'sound';

export interface Reference {
  /** Where the reference is written, as a positional path (`p0/m1/v0/e2/n0/tie0`). */
  from: string;
  /** Which join this is — the field that carries it. */
  kind:
    | 'tie'
    | 'slur'
    | 'slur-start-note'
    | 'slur-end-note'
    | 'beam'
    | 'technique'
    | 'ottava-end'
    | 'system-measure'
    | 'multimeasure-start'
    | 'score-layout'
    | 'system-layout'
    | 'layout-source'
    | 'lyric-line'
    | 'kit-note'
    | 'kit-sound';
  targetType: ReferenceTarget;
  target: string;
  /** What the target must still DRAW for the reference to mean anything.
   *  `pitched` = an event that still carries notes (beams, slurs, ties).
   *  Absent = resolution alone is enough (a measure id, a layout id). */
  presumes?: 'pitched';
}

/** The declared ids of a document, per id space — a reference resolves iff its
 *  target is in the matching set. */
export interface DeclaredIds {
  note: Set<string>;
  event: Set<string>;
  measure: Set<string>;
  part: Set<string>;
  layout: Set<string>;
  'lyric-line': Set<string>;
  'kit-component': Set<string>;
  sound: Set<string>;
  /** Event ids that still carry notes — the `presumes: 'pitched'` check. */
  pitchedEvents: Set<string>;
}

function isEventLike(item: unknown): item is {
  id?: string;
  notes?: unknown[];
  slurs?: { target: string; startNote?: string; endNote?: string }[];
  lyrics?: { lines?: Record<string, unknown> };
  kitNotes?: { kitComponent?: string }[];
  content?: unknown[];
  type?: string;
} {
  return !!item && typeof item === 'object';
}

/** Walk a sequence's content, descending into grace/tuplet/tremolo containers,
 *  calling back with each timed event and its positional path. */
function forEachEvent(
  content: unknown[] | undefined,
  path: string,
  fn: (event: Record<string, unknown>, path: string) => void
): void {
  (content ?? []).forEach((item, index) => {
    if (!isEventLike(item)) return;
    const itemPath = `${path}/e${index}`;
    if (Array.isArray(item.content)) {
      // A container (grace / tuplet / tremolo): its content are events.
      forEachEvent(item.content, `${itemPath}/c`, fn);
      return;
    }
    fn(item as unknown as Record<string, unknown>, itemPath);
  });
}

function forEachBeam(beams: MnxBeam[] | undefined, path: string, fn: (beam: MnxBeam, path: string) => void): void {
  (beams ?? []).forEach((beam, index) => {
    const beamPath = `${path}/b${index}`;
    fn(beam, beamPath);
    forEachBeam(beam.beams, beamPath, fn);
  });
}

export function collectDeclaredIds(doc: MnxStructure): DeclaredIds {
  const ids: DeclaredIds = {
    note: new Set(),
    event: new Set(),
    measure: new Set(),
    part: new Set(),
    layout: new Set(),
    'lyric-line': new Set(),
    'kit-component': new Set(),
    sound: new Set(),
    pitchedEvents: new Set()
  };
  for (const measure of doc.global?.measures ?? []) if (measure.id) ids.measure.add(measure.id);
  for (const [key] of Object.entries(
    (doc.global as { sounds?: Record<string, unknown> } | undefined)?.sounds ?? {}
  ))
    ids.sound.add(key);
  for (const key of Object.keys(doc.global?.lyrics?.lineMetadata ?? {})) ids['lyric-line'].add(key);
  for (const layout of doc.layouts ?? []) if (layout.id) ids.layout.add(layout.id);

  for (const part of doc.parts ?? []) {
    if (part.id) ids.part.add(part.id);
    for (const key of Object.keys((part as { kit?: Record<string, unknown> }).kit ?? {}))
      ids['kit-component'].add(key);
    for (const measure of part.measures ?? []) {
      for (const sequence of measure.sequences ?? []) {
        forEachEvent(sequence.content, '', event => {
          const id = event.id as string | undefined;
          const notes = event.notes as unknown[] | undefined;
          if (id) {
            ids.event.add(id);
            if (notes && notes.length > 0) ids.pitchedEvents.add(id);
          }
          for (const note of notes ?? []) {
            const noteId = (note as { id?: string }).id;
            if (noteId) ids.note.add(noteId);
          }
          // Lyric line ids are declared by use as well as by metadata.
          for (const line of Object.keys(
            (event.lyrics as { lines?: Record<string, unknown> } | undefined)?.lines ?? {}
          ))
            ids['lyric-line'].add(line);
        });
      }
    }
  }
  return ids;
}

export function collectReferences(doc: MnxStructure): Reference[] {
  const refs: Reference[] = [];
  (doc.parts ?? []).forEach((part, partIndex) => {
    const partPath = `p${partIndex}`;
    (part.measures ?? []).forEach((measure, measureIndex) => {
      const measurePath = `${partPath}/m${measureIndex}`;
      forEachBeam(measure.beams, `${measurePath}/beam`, (beam, beamPath) => {
        for (const event of beam.events ?? [])
          refs.push({
            from: beamPath,
            kind: 'beam',
            targetType: 'event',
            target: event,
            presumes: 'pitched'
          });
      });
      for (const ottava of measure.ottavas ?? [])
        if (ottava.end?.measure)
          refs.push({
            from: `${measurePath}/ottava`,
            kind: 'ottava-end',
            targetType: 'measure',
            target: ottava.end.measure
          });
      (measure.sequences ?? []).forEach((sequence, voiceIndex) => {
        forEachEvent(sequence.content, `${measurePath}/v${voiceIndex}`, (event, eventPath) => {
          for (const [slurIndex, slur] of (
            (event.slurs ?? []) as { target: string; startNote?: string; endNote?: string }[]
          ).entries()) {
            const from = `${eventPath}/slur${slurIndex}`;
            if (slur.target)
              refs.push({ from, kind: 'slur', targetType: 'event', target: slur.target, presumes: 'pitched' });
            if (slur.startNote)
              refs.push({ from, kind: 'slur-start-note', targetType: 'note', target: slur.startNote });
            if (slur.endNote)
              refs.push({ from, kind: 'slur-end-note', targetType: 'note', target: slur.endNote });
          }
          for (const line of Object.keys(
            (event.lyrics as { lines?: Record<string, unknown> } | undefined)?.lines ?? {}
          ))
            refs.push({
              from: `${eventPath}/lyric/${line}`,
              kind: 'lyric-line',
              targetType: 'lyric-line',
              target: line
            });
          for (const [kitIndex, kitNote] of (
            (event.kitNotes ?? []) as { kitComponent?: string }[]
          ).entries())
            if (kitNote.kitComponent)
              refs.push({
                from: `${eventPath}/kit${kitIndex}`,
                kind: 'kit-note',
                targetType: 'kit-component',
                target: kitNote.kitComponent
              });
          for (const [noteIndex, note] of (
            (event.notes ?? []) as {
              ties?: { target?: string }[];
              _x?: { mnxLab?: { tab?: { technique?: Record<string, { target?: string }> } } };
            }[]
          ).entries()) {
            const notePath = `${eventPath}/n${noteIndex}`;
            for (const [tieIndex, tie] of (note.ties ?? []).entries())
              if (tie.target)
                refs.push({
                  from: `${notePath}/tie${tieIndex}`,
                  kind: 'tie',
                  targetType: 'note',
                  target: tie.target
                });
            for (const [name, technique] of Object.entries(note._x?.mnxLab?.tab?.technique ?? {}))
              if (technique && typeof technique === 'object' && technique.target)
                refs.push({
                  from: `${notePath}/technique/${name}`,
                  kind: 'technique',
                  targetType: 'note',
                  target: technique.target
                });
          }
        });
      });
    });
  });

  for (const [layoutIndex, layout] of (doc.layouts ?? []).entries()) {
    const visit = (nodes: typeof layout.content | undefined, path: string) => {
      (nodes ?? []).forEach((node, index) => {
        const nodePath = `${path}/c${index}`;
        for (const [sourceIndex, source] of (node.sources ?? []).entries())
          if (source.part)
            refs.push({
              from: `${nodePath}/s${sourceIndex}`,
              kind: 'layout-source',
              targetType: 'part',
              target: source.part
            });
        visit(node.content, nodePath);
      });
    };
    visit(layout.content, `layout${layoutIndex}`);
  }

  for (const [scoreIndex, score] of (doc.scores ?? []).entries()) {
    const scorePath = `score${scoreIndex}`;
    if (score.layout)
      refs.push({ from: scorePath, kind: 'score-layout', targetType: 'layout', target: score.layout });
    for (const [pageIndex, page] of (score.pages ?? []).entries())
      for (const [systemIndex, system] of (page.systems ?? []).entries()) {
        const from = `${scorePath}/page${pageIndex}/sys${systemIndex}`;
        if (system.measure)
          refs.push({ from, kind: 'system-measure', targetType: 'measure', target: system.measure });
        if (system.layout)
          refs.push({ from, kind: 'system-layout', targetType: 'layout', target: system.layout });
      }
    for (const [restIndex, rest] of (score.multimeasureRests ?? []).entries())
      if (rest.start)
        refs.push({
          from: `${scorePath}/mmr${restIndex}`,
          kind: 'multimeasure-start',
          targetType: 'measure',
          target: rest.start
        });
  }

  (doc.parts ?? []).forEach((part, partIndex) => {
    const kit = (part as { kit?: Record<string, { sound?: string }> }).kit ?? {};
    for (const [name, component] of Object.entries(kit))
      if (component?.sound)
        refs.push({
          from: `p${partIndex}/kit/${name}`,
          kind: 'kit-sound',
          targetType: 'sound',
          target: component.sound
        });
  });

  return refs;
}

export interface BrokenReference extends Reference {
  reason: 'dangling' | 'inkless';
}

/** The oracle: which references do not resolve, or resolve to something that
 *  no longer draws what they presume. */
export function findBrokenReferences(doc: MnxStructure): BrokenReference[] {
  const ids = collectDeclaredIds(doc);
  const broken: BrokenReference[] = [];
  for (const ref of collectReferences(doc)) {
    if (!ids[ref.targetType].has(ref.target)) {
      broken.push({ ...ref, reason: 'dangling' });
      continue;
    }
    if (ref.presumes === 'pitched' && !ids.pitchedEvents.has(ref.target))
      broken.push({ ...ref, reason: 'inkless' });
  }
  return broken;
}
