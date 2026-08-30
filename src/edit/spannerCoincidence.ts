// The spanner half of the coincidence rule — core-selection-range-grain.md
// decision 5, first slice.
//
// A slur or beam is "attached to a range of events" exactly the way a rhythm
// container is coextensive with its children, so the same probe generalizes:
// given the resolved selection, which spanners does it touch, and does it
// cover them WHOLLY (the range that IS the spanner — offer its properties,
// let one press remove it from any covered position) or PARTIALLY (the
// honest hint)? This slice indexes the id-referenced families — slurs (on
// the start event, `target` an event id) and beams (a member list on the
// part-measure). The time-positioned family (ottavas, dynamics) follows in a
// later slice; it needs interval arithmetic, not an id join.
//
// The reverse index is built fresh per call from one document walk. Nothing
// is cached: a selection resolves against the live document everywhere else
// in this layer, and a stale spanner index would be the one exception.
import type { MnxBeam, MnxSequenceItem, MnxStructure } from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';
import type { SelectionMember } from './selection.ts';

export interface SlurHit {
  kind: 'slur';
  /** Address of the START event (per-staff voice numbering, like every
   *  EventAddress in this layer). */
  partIndex: number;
  staffIndex: number;
  measureIndex: number;
  voiceIndex: number;
  eventIndex: number;
  containerIndex?: number;
  /** Index within the start event's `slurs[]`. */
  slurIndex: number;
  /** The note key `removeSlur` addresses — `startNote` pin, else the start
   *  event's first note's id. Null when the note carries no id (the walk
   *  cannot mint a synthetic key here; such a slur is reported but not
   *  removable through this probe). */
  ownerNoteKey: string | null;
  coverage: 'whole' | 'partial';
}

export interface BeamHit {
  kind: 'beam';
  partIndex: number;
  measureIndex: number;
  /** Nested-beam path, exactly as `removeBeam` wants it. */
  path: number[];
  events: string[];
  coverage: 'whole' | 'partial';
}

export interface SpannerCoincidence {
  slurs: SlurHit[];
  beams: BeamHit[];
}

interface EventEntry {
  key: string;
  id?: string;
  partIndex: number;
  staffIndex: number;
  measureIndex: number;
  voiceIndex: number;
  eventIndex: number;
  containerIndex?: number;
  slurs: { target: string; startNote?: string }[];
  firstNoteId?: string;
}

/** The same address format `eventMemberKey` prints — the join contract the
 *  integration tests pin from both sides. */
function addressKey(
  partIndex: number,
  staffIndex: number,
  measureIndex: number,
  voiceIndex: number,
  eventIndex: number,
  containerIndex?: number
): string {
  return [partIndex, staffIndex, measureIndex, voiceIndex, eventIndex, containerIndex ?? ''].join(':');
}

function walkEvents(doc: MnxStructure): EventEntry[] {
  const entries: EventEntry[] = [];
  (doc.parts ?? []).forEach((part, partIndex) => {
    (part.measures ?? []).forEach((measure, measureIndex) => {
      const voiceByStaff = new Map<number, number>();
      (measure.sequences ?? []).forEach(sequence => {
        const staffIndex = sequence.staff ?? 1;
        const voiceIndex = (voiceByStaff.get(staffIndex) ?? -1) + 1;
        voiceByStaff.set(staffIndex, voiceIndex);
        const push = (item: MnxSequenceItem, eventIndex: number, containerIndex?: number): void => {
          if (!isTimedEvent(item)) return;
          const event = item as {
            id?: string;
            slurs?: { target: string; startNote?: string }[];
            notes?: { id?: string }[];
          };
          entries.push({
            key: addressKey(partIndex, staffIndex, measureIndex, voiceIndex, eventIndex, containerIndex),
            ...(event.id === undefined ? {} : { id: event.id }),
            partIndex,
            staffIndex,
            measureIndex,
            voiceIndex,
            eventIndex,
            ...(containerIndex === undefined ? {} : { containerIndex }),
            slurs: event.slurs ?? [],
            ...(event.notes?.[0]?.id === undefined ? {} : { firstNoteId: event.notes[0].id })
          });
        };
        sequence.content.forEach((item, eventIndex) => {
          if (isTimedEvent(item)) {
            push(item, eventIndex);
            return;
          }
          const children = (item as { content?: MnxSequenceItem[] }).content ?? [];
          children
            .filter(isTimedEvent)
            .forEach((child, containerIndex) => push(child, eventIndex, containerIndex));
        });
      });
    });
  });
  return entries;
}

/**
 * Which slurs and beams the resolved selection touches, and how completely.
 *
 * Coverage counts the spanner's REFERENCED events — a slur references its
 * start and its `target`, a beam its `events` list — against the selection's
 * event members. `whole` means every referenced event is selected; a spanner
 * with some but not all referenced events selected is `partial`; untouched
 * spanners are absent.
 */
export function spannersUnderSelection(
  doc: MnxStructure,
  members: readonly SelectionMember[]
): SpannerCoincidence {
  const selectedKeys = new Set(
    members.flatMap(member =>
      member.kind === 'event'
        ? [addressKey(
            member.partIndex,
            member.staffIndex,
            member.measureIndex,
            member.voiceIndex,
            member.eventIndex,
            member.containerIndex
          )]
        : []
    )
  );
  if (selectedKeys.size === 0) return { slurs: [], beams: [] };
  const entries = walkEvents(doc);
  const byId = new Map(entries.flatMap(entry => (entry.id === undefined ? [] : [[entry.id, entry] as const])));

  const slurs: SlurHit[] = [];
  for (const entry of entries) {
    entry.slurs.forEach((slur, slurIndex) => {
      const endpoints = [entry, byId.get(slur.target)].filter(
        (candidate): candidate is EventEntry => candidate !== undefined
      );
      const covered = endpoints.filter(candidate => selectedKeys.has(candidate.key)).length;
      if (covered === 0) return;
      slurs.push({
        kind: 'slur',
        partIndex: entry.partIndex,
        staffIndex: entry.staffIndex,
        measureIndex: entry.measureIndex,
        voiceIndex: entry.voiceIndex,
        eventIndex: entry.eventIndex,
        ...(entry.containerIndex === undefined ? {} : { containerIndex: entry.containerIndex }),
        slurIndex,
        ownerNoteKey: slur.startNote ?? entry.firstNoteId ?? null,
        coverage: covered === endpoints.length ? 'whole' : 'partial'
      });
    });
  }

  const beams: BeamHit[] = [];
  (doc.parts ?? []).forEach((part, partIndex) => {
    (part.measures ?? []).forEach((measure, measureIndex) => {
      const visit = (list: MnxBeam[], prefix: number[]): void => {
        list.forEach((beam, index) => {
          const path = [...prefix, index];
          const referenced = (beam.events ?? []).flatMap(id => {
            const entry = byId.get(id);
            return entry ? [entry] : [];
          });
          const covered = referenced.filter(entry => selectedKeys.has(entry.key)).length;
          if (covered > 0) {
            beams.push({
              kind: 'beam',
              partIndex,
              measureIndex,
              path,
              events: [...(beam.events ?? [])],
              coverage: covered === referenced.length && referenced.length > 0 ? 'whole' : 'partial'
            });
          }
          visit(beam.beams ?? [], path);
        });
      };
      visit(measure.beams ?? [], []);
    });
  });

  return { slurs, beams };
}
