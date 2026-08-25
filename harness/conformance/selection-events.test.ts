// The member→event walk behind Delete's first press
// (roadmap/complete/core-delete-clears-then-removes.md).
//
// The rungs above `event` address structure, not sound, so both halves of the
// two-press rule — "does this rung hold ink?" and "clear this rung's ink" —
// have to descend to the events underneath before they can answer. What is
// pinned here is the descent itself: containers walked into, staff ordinals
// counted per staff, and overlapping members counted once.
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../src/model/mnx.ts';
import {
  eventAddressesUnderMember,
  eventAddressesUnderSelection
} from '../../src/edit/selectionEvents.ts';

/** A two-staff part where staff 2 carries two voices — the shape that makes
 *  the raw sequence index and the staff ordinal disagree. */
function grandStaff(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{}] },
    parts: [{
      id: 'keys',
      staves: 2,
      measures: [{
        sequences: [
          { content: [{ id: 'rh', duration: { base: 'whole' }, notes: [{ pitch: { step: 'C', octave: 5 } }] }] },
          { staff: 2, content: [{ id: 'lh0', duration: { base: 'whole' }, notes: [{ pitch: { step: 'C', octave: 3 } }] }] },
          { staff: 2, content: [{ id: 'lh1', duration: { base: 'whole' }, rest: {} }] }
        ]
      }]
    }]
  } as unknown as MnxStructure;
}

describe('the events beneath a selection member', () => {
  it('numbers voices per STAFF, not by raw sequence index', () => {
    // `sequences[2]` is staff 2's SECOND voice, so its address is
    // voiceIndex 1 — the convention `eventAtAddress` reads back. Taking the
    // raw index would address a voice that does not exist on that staff.
    const doc = grandStaff();
    expect(eventAddressesUnderMember(doc, {
      kind: 'partMeasure', partIndex: 0, staffIndex: 2, measureIndex: 0
    })).toEqual([
      { partIndex: 0, staffIndex: 2, measureIndex: 0, voiceIndex: 0, eventIndex: 0 },
      { partIndex: 0, staffIndex: 2, measureIndex: 0, voiceIndex: 1, eventIndex: 0 }
    ]);
  });

  it('keeps a staff bar to its own staff', () => {
    const doc = grandStaff();
    expect(eventAddressesUnderMember(doc, {
      kind: 'partMeasure', partIndex: 0, staffIndex: 1, measureIndex: 0
    })).toEqual([
      { partIndex: 0, staffIndex: 1, measureIndex: 0, voiceIndex: 0, eventIndex: 0 }
    ]);
  });

  it('crosses every part and staff at the bar rung', () => {
    const doc = grandStaff();
    const addresses = eventAddressesUnderMember(doc, { kind: 'measure', measureIndex: 0 });
    expect(addresses).toHaveLength(3);
    expect(addresses.map(address => `${address.staffIndex}.${address.voiceIndex}`))
      .toEqual(['1.0', '2.0', '2.1']);
  });

  it('walks INTO containers, which the bar rung cannot see otherwise', () => {
    const doc = {
      mnx: { version: 1 },
      global: { measures: [{}] },
      parts: [{
        measures: [{
          sequences: [{ content: [
            { type: 'tuplet', content: [
              { duration: { base: 'eighth' }, notes: [{ pitch: { step: 'C', octave: 5 } }] },
              { duration: { base: 'eighth' }, notes: [{ pitch: { step: 'D', octave: 5 } }] }
            ] },
            { duration: { base: 'quarter' }, notes: [{ pitch: { step: 'E', octave: 5 } }] }
          ] }]
        }]
      }]
    } as unknown as MnxStructure;
    expect(eventAddressesUnderMember(doc, { kind: 'measure', measureIndex: 0 })).toEqual([
      { partIndex: 0, staffIndex: 1, measureIndex: 0, voiceIndex: 0, eventIndex: 0, containerIndex: 0 },
      { partIndex: 0, staffIndex: 1, measureIndex: 0, voiceIndex: 0, eventIndex: 0, containerIndex: 1 },
      { partIndex: 0, staffIndex: 1, measureIndex: 0, voiceIndex: 0, eventIndex: 1 }
    ]);
  });

  it('counts an overlapping event once', () => {
    // A note member and its own event member resolve to the same address;
    // clearing twice is harmless but would double the count the notice
    // reports, and the notice is the whole point of the first press.
    const doc = grandStaff();
    const shared = {
      partIndex: 0, staffIndex: 1, measureIndex: 0, voiceIndex: 0, eventIndex: 0
    };
    expect(eventAddressesUnderSelection(doc, [
      { kind: 'note', ...shared, onset: { num: 0, den: 1 }, noteIndex: 0, noteKey: 'rh' },
      { kind: 'event', ...shared, onset: { num: 0, den: 1 } },
      { kind: 'partMeasure', partIndex: 0, staffIndex: 1, measureIndex: 0 }
    ])).toEqual([shared]);
  });

  it('spans a section’s whole bar range', () => {
    const doc = {
      mnx: { version: 1 },
      global: { measures: [{}, {}, {}] },
      parts: [{
        measures: [0, 1, 2].map(() => ({
          sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }]
        }))
      }]
    } as unknown as MnxStructure;
    expect(eventAddressesUnderMember(doc, { kind: 'section', start: 0, end: 2 })
      .map(address => address.measureIndex)).toEqual([0, 1]);
    expect(eventAddressesUnderMember(doc, { kind: 'document' })
      .map(address => address.measureIndex)).toEqual([0, 1, 2]);
  });
});
