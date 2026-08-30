// Every event beneath a resolved selection — the walk Delete's first press
// needs, and the ink test that decides which press it is.
//
// The rungs above `event` address structure, not sound, so "does this rung
// hold ink?" and "clear this rung's ink" both have to descend to the events
// underneath before they can answer. `selectedEventAddresses()` in the
// session stops at note/event members because markings only ever apply
// there; this walk goes the rest of the way.
//
// ADDRESSES, NOT OBJECTS. `EventAddress.voiceIndex` is the ordinal among the
// sequences ON THAT STAFF, not the raw index into `measure.sequences` — the
// same convention `eventAtAddress` reads back — so the walk filters by staff
// before it counts. A `voiceMeasure` member carries both numbers and they
// disagree the moment a part has two staves; taking the raw one addressed
// another staff's voice.
import type { MnxEvent, MnxSequenceItem, MnxStructure } from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';
import type { EventAddress } from './ops.ts';
import type { SelectionMember } from './selection.ts';

interface StaffVoice {
  partIndex: number;
  staffIndex: number;
  measureIndex: number;
  voiceIndex: number;
  content: MnxSequenceItem[];
}

/** Ink is notes or kit notes. Rests, spaces and adornments are not ink — a
 *  rest is absence (§8.11), and clearing a bar of rests must not read as
 *  having done something. */
export function eventHoldsInk(event: MnxEvent): boolean {
  const kitNotes = (event as { kitNotes?: unknown[] }).kitNotes;
  return (event.notes?.length ?? 0) > 0 || (kitNotes?.length ?? 0) > 0;
}

/** The voices on one staff of one bar, already numbered the way an
 *  `EventAddress` wants them. */
function staffVoices(
  doc: MnxStructure,
  partIndex: number,
  measureIndex: number,
  staffIndex?: number
): StaffVoice[] {
  const sequences = doc.parts?.[partIndex]?.measures?.[measureIndex]?.sequences ?? [];
  const staves = staffIndex === undefined
    ? [...new Set(sequences.map(sequence => sequence.staff ?? 1))]
    : [staffIndex];
  return staves.flatMap(staff =>
    sequences
      .filter(sequence => (sequence.staff ?? 1) === staff)
      .map((sequence, voiceIndex) => ({
        partIndex,
        staffIndex: staff,
        measureIndex,
        voiceIndex,
        content: sequence.content ?? []
      }))
  );
}

/** Every event address in one voice's bar, containers walked into. */
function addressesInVoice(voice: StaffVoice): EventAddress[] {
  const { content, ...base } = voice;
  return content.flatMap((item, eventIndex) => {
    if (isTimedEvent(item)) return [{ ...base, eventIndex }];
    const inner = (item as { content?: MnxSequenceItem[] }).content ?? [];
    return inner.flatMap((child, containerIndex) =>
      isTimedEvent(child) ? [{ ...base, eventIndex, containerIndex }] : []
    );
  });
}

function addressesInMeasure(doc: MnxStructure, measureIndex: number): EventAddress[] {
  return (doc.parts ?? []).flatMap((_, partIndex) =>
    staffVoices(doc, partIndex, measureIndex).flatMap(addressesInVoice)
  );
}

function measureCount(doc: MnxStructure): number {
  return Math.max(
    doc.global?.measures?.length ?? 0,
    ...(doc.parts ?? []).map(part => part.measures?.length ?? 0),
    0
  );
}

/** Every event address beneath one selection member. */
export function eventAddressesUnderMember(
  doc: MnxStructure,
  member: SelectionMember
): EventAddress[] {
  switch (member.kind) {
    case 'note':
    case 'event':
      return [{
        partIndex: member.partIndex,
        staffIndex: member.staffIndex,
        measureIndex: member.measureIndex,
        voiceIndex: member.voiceIndex,
        eventIndex: member.eventIndex,
        ...(member.containerIndex === undefined ? {} : { containerIndex: member.containerIndex })
      }];
    case 'container': {
      // The member's `sequenceIndex` is raw and its `voiceIndex` is the
      // staff ordinal; the address wants the latter, the document wants the
      // former. Read through the raw one, address with the staff one.
      const sequence = doc.parts?.[member.partIndex]?.measures?.[member.measureIndex]
        ?.sequences?.[member.sequenceIndex];
      const item = sequence?.content?.[member.eventIndex] as
        | { content?: MnxSequenceItem[] }
        | undefined;
      return (item?.content ?? []).flatMap((child, containerIndex) =>
        isTimedEvent(child)
          ? [{
              partIndex: member.partIndex,
              staffIndex: member.staffIndex,
              measureIndex: member.measureIndex,
              voiceIndex: member.voiceIndex,
              eventIndex: member.eventIndex,
              containerIndex
            }]
          : []
      );
    }
    case 'voiceMeasure': {
      const voice = staffVoices(doc, member.partIndex, member.measureIndex, member.staffIndex)
        .find(candidate => candidate.voiceIndex === member.voiceIndex);
      return voice ? addressesInVoice(voice) : [];
    }
    case 'partMeasure':
      return staffVoices(doc, member.partIndex, member.measureIndex, member.staffIndex)
        .flatMap(addressesInVoice);
    case 'measure':
      return addressesInMeasure(doc, member.measureIndex);
    case 'document':
      return Array.from({ length: measureCount(doc) }, (_, measureIndex) => measureIndex)
        .flatMap(measureIndex => addressesInMeasure(doc, measureIndex));
  }
}

function addressKey(address: EventAddress): string {
  return [
    address.partIndex,
    address.staffIndex,
    address.measureIndex,
    address.voiceIndex,
    address.eventIndex,
    address.containerIndex ?? -1
  ].join('/');
}

/** Every event address beneath a whole resolved selection, deduplicated and
 *  in document order. Members can overlap — a note and its event both
 *  resolve to one address — and clearing the same event twice is harmless
 *  but would inflate the count the feedback line reports. */
export function eventAddressesUnderSelection(
  doc: MnxStructure,
  members: readonly SelectionMember[]
): EventAddress[] {
  const seen = new Set<string>();
  return members.flatMap(member => eventAddressesUnderMember(doc, member)).filter(address => {
    const key = addressKey(address);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
