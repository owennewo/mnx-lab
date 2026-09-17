import { describe, expect, it } from 'vitest';
import {
  beatTimes, decodeSyncSegments, defaultBeatUnit, emptySyncSegments, moveCut, placeEnd, placeStart, removeCut,
  renameSegment, segmentAt, segmentTempo, setBeats, setBpm, splitAt, syncpointsFromSegments, type SyncSegments,
} from '../../src/model/syncSegments.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { createRecordingSync } from '../../src/audio/recordingSync.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

/** Start at 10 s, 120 bpm tapped, end at 42 s: 64 beats at exactly 120. */
function steady(): SyncSegments { return placeEnd(setBpm(placeStart(emptySyncSegments(), 10), 0, 120), 42); }

describe('sync segments: the two trim handles', () => {
  it('starts with nothing placed and everything unsynced', () => {
    const doc = emptySyncSegments();
    expect(doc.cuts).toEqual([]); expect(doc.segments).toEqual([]); expect(segmentAt(doc, 5)).toBe(-1);
    expect(placeEnd(doc, 30)).toBe(doc); // no end before a start
  });
  it('the start handle leaves the left unsynced and opens one segment to the end', () => {
    const doc = placeStart(emptySyncSegments(), 6.42);
    expect(doc.cuts).toEqual([6.42]); expect(doc.closed).toBe(false);
    expect(doc.segments).toEqual([{ name: 'Segment 1', beats: null, bpm: null }]);
    expect(segmentAt(doc, 3)).toBe(-1); expect(segmentAt(doc, 500)).toBe(0);
    expect(segmentTempo(setBpm(doc, 0, 103.2), 0)).toBe(103.2);
  });
  it('the end handle leaves the right unsynced and closes on the nearest whole count', () => {
    const doc = placeEnd(setBpm(placeStart(emptySyncSegments(), 6.42), 0, 103), 202.89);
    expect(doc.closed).toBe(true); expect(doc.segments[0]).toEqual({ name: 'Segment 1', beats: 337, bpm: null });
    expect(segmentAt(doc, 210)).toBe(-1);
    expect(segmentTempo(setBeats(doc, 0, 338), 0)).toBeCloseTo(103.22, 2);
    // Without a tempo the segment still closes; its count waits for a tap.
    const untimed = placeEnd(placeStart(emptySyncSegments(), 1), 9);
    expect(untimed.segments[0].beats).toBeNull(); expect(segmentTempo(untimed, 0)).toBeNull();
    expect(setBpm(untimed, 0, 60).segments[0].beats).toBe(8);
  });
  it('placing a handle again moves it', () => {
    const doc = steady();
    expect(placeStart(doc, 10.5).cuts[0]).toBe(10.5);
    expect(placeEnd(doc, 41).cuts[1]).toBe(41);
  });
});

describe('sync segments: cuts', () => {
  it('a split lands on the nearest beat and moves no timing', () => {
    const doc = steady(), before = beatTimes(doc, 0, 100).map(b => b.time);
    const result = splitAt(doc, 26.2)!; // beat 32 is at 26.0
    expect(result.cut).toBe(1); expect(result.doc.cuts).toEqual([10, 26, 42]);
    expect(result.doc.segments.map(s => s.beats)).toEqual([32, 32]);
    expect(result.doc.segments[1].name).toBe('Segment 2');
    const after = beatTimes(result.doc, 0, 100).map(b => b.time);
    expect(after).toHaveLength(before.length);
    after.forEach((t, i) => expect(t).toBeCloseTo(before[i], 9));
  });
  it('splits the open segment at its tempo, and an untimed one where asked', () => {
    const open = splitAt(setBpm(placeStart(emptySyncSegments(), 10), 0, 120), 20.1)!.doc;
    expect(open.cuts).toEqual([10, 20]); expect(open.segments).toEqual([{ name: 'Segment 1', beats: 20, bpm: null }, { name: 'Segment 2', beats: null, bpm: 120 }]);
    const raw = splitAt(placeStart(emptySyncSegments(), 10), 20.1)!.doc;
    expect(raw.cuts).toEqual([10, 20.1]); expect(raw.segments.every(s => s.beats === null)).toBe(true);
    expect(splitAt(steady(), 5)).toBeNull(); expect(splitAt(setBeats(steady(), 0, 1), 20)).toBeNull();
  });
  it('a nudge keeps the count and a long drag re-counts at the old tempo', () => {
    const doc = splitAt(steady(), 26)!.doc;
    const nudged = moveCut(doc, 1, 26.01);
    expect(nudged.segments.map(s => s.beats)).toEqual([32, 32]);
    expect(segmentTempo(nudged, 0)).toBeLessThan(120); expect(segmentTempo(nudged, 1)).toBeGreaterThan(120);
    const dragged = moveCut(doc, 1, 30);
    expect(dragged.segments.map(s => s.beats)).toEqual([40, 24]);
    expect(segmentTempo(dragged, 0)).toBeCloseTo(120, 9);
  });
  it('clamps a moved cut between its neighbours and the media end', () => {
    const doc = splitAt(steady(), 26)!.doc;
    expect(moveCut(doc, 1, 5).cuts[1]).toBe(10.05); expect(moveCut(doc, 1, 99).cuts[1]).toBe(41.95);
    expect(moveCut(doc, 2, 99, 60).cuts[2]).toBe(60); expect(moveCut(doc, 0, -3).cuts[0]).toBe(0);
    expect(moveCut(doc, 7, 1)).toBe(doc);
  });
  it('removing an inner cut merges, the end handle reopens, the start takes its segment', () => {
    const doc = splitAt(steady(), 26)!.doc;
    expect(removeCut(doc, 1)).toEqual(steady());
    const reopened = removeCut(doc, 2);
    expect(reopened.closed).toBe(false); expect(reopened.cuts).toEqual([10, 26]); expect(reopened.segments[1]).toEqual({ name: 'Segment 2', beats: null, bpm: 120 });
    const headless = removeCut(doc, 0);
    expect(headless.cuts).toEqual([26, 42]); expect(headless.segments).toHaveLength(1);
    expect(removeCut(steady(), 0)).toEqual(emptySyncSegments());
    const openMerge = removeCut(splitAt(setBpm(placeStart(emptySyncSegments(), 10), 0, 120), 20)!.doc, 1);
    expect(openMerge.cuts).toEqual([10]); expect(openMerge.segments[0].bpm).toBe(120);
  });
  it('renames, and refuses counts and tempi that are not', () => {
    const doc = steady();
    expect(renameSegment(doc, 0, '  Verse 1 ').segments[0].name).toBe('Verse 1');
    expect(renameSegment(doc, 0, '   ').segments[0].name).toBe('Segment 1');
    expect(setBeats(doc, 0, 0)).toBe(doc); expect(setBeats(doc, 0, 1.5)).toBe(doc); expect(setBpm(doc, 0, NaN)).toBe(doc);
  });
});

describe('sync segments: beats for the click and the zoomed bar', () => {
  it('lists every cut and every beat once, the closing beat as the next cut', () => {
    const beats = beatTimes(splitAt(steady(), 26)!.doc, 0, 100);
    expect(beats.filter(b => b.cut).map(b => b.time)).toEqual([10, 26, 42]);
    expect(beats).toHaveLength(65);
    expect(beats[1]).toEqual({ time: 10.5, cut: false });
    expect(beatTimes(steady(), 12.4, 13.6).map(b => b.time)).toEqual([12.5, 13, 13.5]);
  });
  it('runs the open segment to the media end and stays silent without a tempo', () => {
    const open = setBpm(placeStart(emptySyncSegments(), 10), 0, 60);
    expect(beatTimes(open, 0, 100, 13.5).map(b => b.time)).toEqual([10, 11, 12, 13]);
    expect(beatTimes(placeStart(emptySyncSegments(), 10), 0, 100, 20)).toEqual([{ time: 10, cut: true }]);
  });
});

describe('sync segments: Soundslice tuples', () => {
  it('writes one point per bar, not a sparse pair, across a pickup and a 2/4 bar', () => {
    // 1-beat pickup, two 4/4 bars, a 2/4 bar, a 4/4 bar: 15 beats at 60 bpm from 10 s.
    const doc = placeEnd(setBpm(placeStart(emptySyncSegments(), 10), 0, 60), 25);
    expect(syncpointsFromSegments(doc, [1, 4, 4, 2, 4])).toEqual([[0, 10], [1, 11], [2, 15], [3, 19], [4, 21], [5, 25]]);
  });
  it('follows each segment at its own tempo', () => {
    const doc = setBeats(splitAt(steady(), 26)!.doc, 1, 16); // 32 beats at 120, then 16 at 60
    const points = syncpointsFromSegments(doc, Array(12).fill(4))!;
    expect(points.slice(0, 3)).toEqual([[0, 10], [1, 12], [2, 14]]);
    expect(points.slice(8)).toEqual([[8, 26], [9, 30], [10, 34], [11, 38], [12, 42]]);
  });
  it('ends inside a bar with an inner-bar point, and stops at a segment with no tempo', () => {
    const doc = placeEnd(setBpm(placeStart(emptySyncSegments(), 0), 0, 60), 10);
    expect(syncpointsFromSegments(doc, [4, 4, 4, 4])).toEqual([[0, 0], [1, 4], [2, 8], [2, 10, 240]]);
    const untimedTail = { ...splitAt(doc, 8)!.doc };
    const stopped = { ...untimedTail, segments: [untimedTail.segments[0], { name: 'Tail', beats: null, bpm: null }] };
    expect(syncpointsFromSegments(stopped, [4, 4, 4, 4])).toEqual([[0, 0], [1, 4], [2, 8]]);
  });
  it('runs the open segment to the media end and the score end, whichever is first', () => {
    const open = setBpm(placeStart(emptySyncSegments(), 2), 0, 60);
    expect(syncpointsFromSegments(open, [4, 4], 100)).toEqual([[0, 2], [1, 6], [2, 10]]);
    expect(syncpointsFromSegments(open, [4, 4, 4], 9)).toEqual([[0, 2], [1, 6], [1, 9, 360]]);
  });
  it('derives nothing without bars, a tempo, or two points', () => {
    expect(syncpointsFromSegments(steady(), [])).toBeNull();
    expect(syncpointsFromSegments(placeStart(emptySyncSegments(), 1), [4, 4])).toBeNull();
    expect(syncpointsFromSegments(emptySyncSegments(), [4])).toBeNull();
    expect(syncpointsFromSegments(steady(), [4, 0])).toBeNull();
  });
  it('round-trips through the sync map with full coverage', () => {
    const score: MnxStructure = { mnx: { version: 1 }, global: { measures: [{ time: { count: 4, unit: 4 } }, {}, { time: { count: 2, unit: 4 } }, { time: { count: 4, unit: 4 } }] },
      parts: [{ measures: [['whole'], ['whole'], ['half'], ['whole']].map(([base], i) => ({ sequences: [{ content: [{ duration: { base }, notes: [{ id: `n${i}`, pitch: { step: 'C', octave: 4 } }] }] }] })) }] } as MnxStructure;
    const passes = linearizePasses(score), compiled = compilePerformance(score, passes);
    if (!compiled.ok) throw new Error('fixture did not compile');
    const barBeats = compiled.performance.measures.map(m => { const d = compiled.writtenBarDurations[m.measureIndex]; return Number(d.num) / Number(d.den) * 4; });
    expect(barBeats).toEqual([4, 4, 2, 4]);
    const doc = placeEnd(setBpm(placeStart(emptySyncSegments(), 3), 0, 120), 10);
    const points = syncpointsFromSegments(doc, barBeats)!;
    expect(points).toEqual([[0, 3], [1, 5], [2, 7], [3, 8], [4, 10]]);
    const map = createRecordingSync(points, compiled, passes);
    expect(map.ok && map.value.coverage).toBe('full');
    if (map.ok) { const at = map.value.positionAt(7.5); expect(at.ok && at.value.position.ordinal).toBe(2); }
  });
});

describe('sync segments: stored shape', () => {
  it('accepts what the operations make', () => {
    for (const doc of [emptySyncSegments(), placeStart(emptySyncSegments(), 1), steady(), splitAt(steady(), 26)!.doc, emptySyncSegments([3, 8])])
      expect(decodeSyncSegments(JSON.parse(JSON.stringify(doc)))).toEqual({ ok: true, value: doc });
  });
  it('rejects what they cannot', () => {
    const doc = steady();
    const bad: unknown[] = [null, [], { ...doc, version: 2 }, { ...doc, beat: [4, 1] }, { ...doc, cuts: [42, 10] }, { ...doc, cuts: [10] },
      { ...doc, segments: [] }, { ...doc, segments: [{ name: '', beats: 1, bpm: null }] }, { ...doc, segments: [{ name: 'A', beats: 1.5, bpm: null }] },
      { ...doc, segments: [{ name: 'A', beats: 4, bpm: 120 }] }, { ...doc, cuts: [10, Infinity] }, { ...doc, closed: 'yes' },
      { ...placeStart(emptySyncSegments(), 1), segments: [{ name: 'A', beats: 4, bpm: null }] }, { ...doc, cuts: Array.from({ length: 1001 }, (_, i) => i) }];
    for (const value of bad) expect(decodeSyncSegments(value).ok).toBe(false);
  });
  it('defaults the beat unit from the time signature', () => {
    expect(defaultBeatUnit({ count: 4, unit: 4 })).toEqual([1, 4]); expect(defaultBeatUnit({ count: 12, unit: 8 })).toEqual([3, 8]);
    expect(defaultBeatUnit({ count: 6, unit: 8 })).toEqual([3, 8]); expect(defaultBeatUnit({ count: 3, unit: 8 })).toEqual([1, 8]);
    expect(defaultBeatUnit({ count: 2, unit: 2 })).toEqual([1, 2]); expect(defaultBeatUnit(undefined)).toEqual([1, 4]);
  });
});
