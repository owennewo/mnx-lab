/**
 * THE note enumeration — one walk that decides which notes exist and what
 * coordinates address them.
 *
 * The key format (`model/noteKeys.ts`) was always shared; the *coordinates fed
 * to it* were not. Six places derived them independently — the cursor, the op
 * layer, the JSON view, both layouts and the element walker — which is why
 * CLAUDE.md has to warn that they be "kept in lockstep", and why teaching the
 * editor to see inside containers looked like a five-file migration rather than
 * one change (roadmap/complete/core-element-ops-onset-granularity.md).
 *
 * So: coordinates are produced here, once. A consumer that needs more than
 * identity (the grid needs onsets, the layouts need geometry) still walks for
 * its own purposes, but takes its KEYS from this module, and
 * `harness/conformance/note-keys.test.ts` proves over the whole corpus that
 * every key the renderer emits is one this walk produced. Agreement is checked,
 * not maintained by hand.
 *
 * Container descent lives here too. Tuplet, grace and tremolo children carry
 * the nested key form below, which remains an implementation detail of this
 * file rather than a traversal each consumer has to reproduce.
 */
import type { MnxEvent, MnxNote, MnxSequence, MnxStructure } from './mnx.ts';
import { isTimedEvent } from './mnx.ts';
import { positionalNoteKey } from './noteKeys.ts';

/** Where a note lives, and what names it. */
export interface NoteAddress {
  note: MnxNote;
  /** The note's own id when it has one, else the positional key. */
  key: string;
  /** Which part the note lives in — 0 is the entry surface (campaign 13b). */
  partIndex: number;
  /** Which staff of that part (1-based, as MNX numbers them). */
  staffIndex: number;
  measureIndex: number;
  /** Index among the measure's STAFF-1 sequences — what the key encodes, and
   *  deliberately not the raw `sequences` index (the layouts filter the same
   *  way, so a staff-2 sequence must not shift the voices below it). */
  voiceIndex: number;
  /** The raw index into `measure.sequences`, for consumers addressing JSON. */
  sequenceIndex: number;
  eventIndex: number;
  /** Set when the note lives inside a container: its event's index within the
   *  container's own content. */
  containerIndex?: number;
  noteIndex: number;
  event: MnxEvent;
  sequence: MnxSequence;
}

/** The staff-1 filter, in one place rather than restated per traversal. */
export function isEntryStaff(sequence: MnxSequence): boolean {
  return (sequence.staff ?? 1) === 1;
}

/** The key a note carries at these coordinates: its id, else positional. */
export function noteKeyAt(
  note: MnxNote,
  measureIndex: number,
  voiceIndex: number,
  eventIndex: number,
  noteIndex: number,
  containerIndex?: number,
  partIndex = 0,
  staffIndex = 1
): string {
  if (note.id !== undefined) return note.id;
  return positionalNoteKey({
    partIndex,
    measureIndex,
    staffIndex,
    voiceIndex,
    eventIndex,
    ...(containerIndex === undefined ? {} : { containerIndex }),
    noteIndex
  });
}

/** Is this sequence item a container holding events (tuplet, grace, tremolo)? */
function containerContent(item: unknown): MnxEvent[] | null {
  const record = item as { type?: string; content?: unknown };
  if (!record || typeof record !== 'object') return null;
  if (record.type !== 'tuplet' && record.type !== 'grace' && record.type !== 'tremolo') return null;
  return Array.isArray(record.content) ? (record.content as MnxEvent[]) : null;
}

/**
 * Every addressable note in the document, in document order, with the
 * coordinates that name it. Container content is visited recursively one
 * authored level deep (the schema's tuplet/grace/tremolo content shape).
 */
export function forEachNoteAddress(
  doc: MnxStructure,
  fn: (address: NoteAddress) => void
): void {
  (doc.parts ?? []).forEach((part, partIndex) => {
  (part.measures ?? []).forEach((measure, measureIndex) => {
    // Voices are counted PER STAFF, so a second staff cannot shift the voice
    // indices of the first — which would rewrite keys the goldens embed.
    const voiceByStaff = new Map<number, number>();
    (measure.sequences ?? []).forEach((sequence, sequenceIndex) => {
      const staffIndex = sequence.staff ?? 1;
      const voice = (voiceByStaff.get(staffIndex) ?? -1) + 1;
      voiceByStaff.set(staffIndex, voice);
      (sequence.content ?? []).forEach((item, eventIndex) => {
        const emit = (event: MnxEvent, containerIndex?: number) =>
          (event.notes ?? []).forEach((note, noteIndex) => {
            fn({
              note,
              key: noteKeyAt(
                note, measureIndex, voice, eventIndex, noteIndex, containerIndex, partIndex, staffIndex
              ),
              partIndex,
              staffIndex,
              measureIndex,
              voiceIndex: voice,
              sequenceIndex,
              eventIndex,
              ...(containerIndex === undefined ? {} : { containerIndex }),
              noteIndex,
              event,
              sequence
            });
          });

        // Container content is enumerated too (campaign item 11b): a tuplet's
        // notes are as much ink as any other, and the nested key form is what
        // lets them be told apart.
        const inner = containerContent(item);
        if (inner) {
          inner.forEach((event, containerIndex) => {
            if (isTimedEvent(event)) emit(event, containerIndex);
          });
          return;
        }
        if (!isTimedEvent(item)) return;
        emit(item as MnxEvent);
      });
    });
  });
  });
}

/** Every key the entry surface addresses — the set the renderer's `sourceId`s
 *  must agree with (`harness/conformance/note-keys.test.ts`). */
export function noteKeysOf(doc: MnxStructure): string[] {
  const keys: string[] = [];
  forEachNoteAddress(doc, address => keys.push(address.key));
  return keys;
}

/** The address of one key, or null — the op layer's `findKeyedNote`. */
export function findNoteAddress(doc: MnxStructure, key: string): NoteAddress | null {
  let found: NoteAddress | null = null;
  forEachNoteAddress(doc, address => {
    if (found === null && address.key === key) found = address;
  });
  return found;
}
