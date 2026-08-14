/**
 * THE note enumeration — one walk that decides which notes exist and what
 * coordinates address them.
 *
 * The key format (`model/noteKeys.ts`) was always shared; the *coordinates fed
 * to it* were not. Six places derived them independently — the cursor, the op
 * layer, the JSON view, both layouts and the element walker — which is why
 * CLAUDE.md has to warn that they be "kept in lockstep", and why teaching the
 * editor to see inside containers looked like a five-file migration rather than
 * one change (roadmap/inprogress/core-element-ops-onset-granularity.md).
 *
 * So: coordinates are produced here, once. A consumer that needs more than
 * identity (the grid needs onsets, the layouts need geometry) still walks for
 * its own purposes, but takes its KEYS from this module, and
 * `harness/conformance/note-keys.test.ts` proves over the whole corpus that
 * every key the renderer emits is one this walk produced. Agreement is checked,
 * not maintained by hand.
 *
 * **This is where container descent will go.** Tuplet, grace and tremolo
 * content is invisible to the editor today because this walk stops at
 * `isTimedEvent`; when it descends, every consumer descends with it, and the
 * nested key form stays an implementation detail of this file.
 */
import type { MnxEvent, MnxNote, MnxSequence, MnxStructure } from './mnx.ts';
import { isTimedEvent } from './mnx.ts';
import { syntheticNoteKey } from './noteKeys.ts';

/** Where a note lives, and what names it. */
export interface NoteAddress {
  note: MnxNote;
  /** The note's own id when it has one, else the positional key. */
  key: string;
  measureIndex: number;
  /** Index among the measure's STAFF-1 sequences — what the key encodes, and
   *  deliberately not the raw `sequences` index (the layouts filter the same
   *  way, so a staff-2 sequence must not shift the voices below it). */
  voiceIndex: number;
  /** The raw index into `measure.sequences`, for consumers addressing JSON. */
  sequenceIndex: number;
  eventIndex: number;
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
  noteIndex: number
): string {
  return note.id ?? syntheticNoteKey(measureIndex, voiceIndex, eventIndex, noteIndex);
}

/**
 * Every addressable note of the entry surface (`parts[0]`, staff 1), in
 * document order, with the coordinates that name it. Container content is not
 * yet visited — see the file header.
 */
export function forEachNoteAddress(
  doc: MnxStructure,
  fn: (address: NoteAddress) => void
): void {
  (doc.parts?.[0]?.measures ?? []).forEach((measure, measureIndex) => {
    let voiceIndex = -1;
    (measure.sequences ?? []).forEach((sequence, sequenceIndex) => {
      if (!isEntryStaff(sequence)) return;
      voiceIndex++;
      const voice = voiceIndex;
      (sequence.content ?? []).forEach((item, eventIndex) => {
        if (!isTimedEvent(item)) return;
        const event = item as MnxEvent;
        (event.notes ?? []).forEach((note, noteIndex) => {
          fn({
            note,
            key: noteKeyAt(note, measureIndex, voice, eventIndex, noteIndex),
            measureIndex,
            voiceIndex: voice,
            sequenceIndex,
            eventIndex,
            noteIndex,
            event,
            sequence
          });
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
