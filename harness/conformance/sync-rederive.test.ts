// Implementation loop: sync first, bars later
// (roadmap/complete/studio-sync-rederive.md, studio authoring campaign item 4).
//
// A sync made in Studio is its SEGMENTS — a beat count over time. The tuples
// stored beside them are a cache of those segments against the bars the score
// had at the time, so bars written afterwards leave it stale. These pin the
// rule that closes the gap: when segments exist, what plays is derived from
// them and the bars as they are now, and the stored tuples are not consulted.
import { describe, expect, it } from 'vitest';
import { emptySyncSegments, placeStart, playingSyncpoints, setBpm, syncpointsFromSegments, type SyncSegments } from '../../src/model/syncSegments.ts';
import { isImportedSync, storedScoreShape, attachmentSync } from '../../src/model/recordingAttachment.ts';
import { performedShape } from '../../src/audio/scoreShape.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { createRecordingSync } from '../../src/audio/recordingSync.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import { applyOp } from '../../src/edit/ops.ts';
import { buildNewDocument } from '../../src/edit/newDocument.ts';
import { parseTuning } from '../../src/edit/setupGrammar.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const piece = (bars: number, time = { count: 4, unit: 4 }) => buildNewDocument({ title: 'Anji', tuning: parseTuning('standard')!, time, fifths: 0, bars });
function compiled(document: MnxStructure) {
  const passes = linearizePasses(document); const result = compilePerformance(document, passes);
  if (!result.ok) throw new Error('fixture does not compile');
  // The player's own arithmetic: each performed bar's length in the segments' beats.
  const barBeats = (segments: SyncSegments) => result.performance.measures.map(m => { const d = result.writtenBarDurations[m.measureIndex]; return Number(d.num) / Number(d.den) / (segments.beat[0] / segments.beat[1]); });
  return { ...result, passes, barBeats };
}
/** One open segment from 2 s at 120 bpm — "I got lucky and it only needed the start". */
const lucky = setBpm(placeStart(emptySyncSegments([1, 4]), 2), 0, 120);

describe('a Studio sync plays by its segments', () => {
  it('bars written after the sync are followed: the stored tuples are a stale cache, and are not consulted', () => {
    const before = compiled(piece(4));
    const stored = syncpointsFromSegments(lucky, before.barBeats(lucky), 60)!;
    expect(stored.map(p => p[0])).toEqual([0, 1, 2, 3, 4]);

    const after = compiled(piece(12));
    const playing = playingSyncpoints({ syncpoints: stored, syncSegments: lucky }, after.barBeats, 60);
    expect(playing.segments).toEqual(lucky);
    expect((playing.syncpoints as number[][]).map(p => p[0])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // 120 bpm, 4 beats a bar: two seconds a bar from the cut at 2 s.
    expect((playing.syncpoints as number[][])[12]).toEqual([12, 26]);
    const map = createRecordingSync(playing.syncpoints, after, after.passes);
    expect(map.ok && map.value.coverage).toBe('full');
    // The stale cache, by contrast, stops at the fourth bar.
    const stale = createRecordingSync(stored, after, after.passes);
    expect(stale.ok && stale.value.coverage).toBe('partial');
  });

  it('a changed meter moves the bars onto the same beats', () => {
    const waltz = compiled(piece(8, { count: 3, unit: 4 }));
    const playing = playingSyncpoints({ syncpoints: null, syncSegments: lucky }, waltz.barBeats, 60).syncpoints as number[][];
    // Three beats a bar at 120 bpm: a bar every second and a half.
    expect(playing.slice(0, 3)).toEqual([[0, 2], [1, 3.5], [2, 5]]);
  });

  it('no bars yet is "not synchronised" — never yesterday\'s tuples', () => {
    const stored = [[0, 2], [1, 4]];
    const empty = playingSyncpoints({ syncpoints: stored, syncSegments: lucky }, () => [], 60);
    expect(empty).toEqual({ syncpoints: null, segments: lucky });
  });

  it('the recording\'s length bounds an open last segment once it is known', () => {
    const score = compiled(piece(40));
    const unknown = playingSyncpoints({ syncpoints: null, syncSegments: lucky }, score.barBeats).syncpoints as number[][];
    const known = playingSyncpoints({ syncpoints: null, syncSegments: lucky }, score.barBeats, 30).syncpoints as number[][];
    expect(unknown.at(-1)).toEqual([40, 82]);
    // 28 s of music from the cut at 2 s: fourteen bars, and the media ends there.
    expect(known.at(-1)).toEqual([14, 30]);
  });

  it('an imported sync has no segments and plays by its stored tuples; unreadable segments fall back to them', () => {
    const stored = [[0, 1.5], [1, 3.25], [2, 5]];
    expect(playingSyncpoints({ syncpoints: stored }, () => [4, 4], 60)).toEqual({ syncpoints: stored, segments: null });
    expect(playingSyncpoints({ syncpoints: stored, syncSegments: { version: 99 } }, () => [4, 4], 60)).toEqual({ syncpoints: stored, segments: null });
    expect(playingSyncpoints({ syncpoints: stored, syncSegments: emptySyncSegments([1, 4]) }, () => [4, 4], 60)).toEqual({ syncpoints: stored, segments: null });
  });
});

describe('the shape an imported sync was good for', () => {
  const shape = (document: MnxStructure) => { const c = compiled(document); return performedShape(c.performance, c.writtenBarDurations); };

  it('is each performed bar\'s length, run-length encoded', () => {
    expect(shape(piece(12))).toBe('12x1/1');
    expect(shape(piece(8, { count: 6, unit: 8 }))).toBe('8x3/4');
    const turnaround = applyOp(piece(12), { type: 'setTimeSignature', measureIndex: 11, time: { count: 2, unit: 4 } });
    expect(shape(turnaround)).toBe('11x1/1,1x1/2');
  });

  it('moves when a bar is added, a meter changes or a repeat is performed — and not when the music inside the bars does', () => {
    const base = piece(8);
    expect(shape(applyOp(base, { type: 'appendMeasure' }))).not.toBe(shape(base));
    expect(shape(applyOp(base, { type: 'setWork', work: { title: 'Another name' } }))).toBe(shape(base));
    const repeated = applyOp(applyOp(base, { type: 'setMeasureAttribute', measureIndex: 0, attribute: { kind: 'repeatStart' } }), { type: 'setMeasureAttribute', measureIndex: 3, attribute: { kind: 'repeatEnd' } });
    expect(shape(repeated)).toBe('12x1/1');
  });

  it('is read from a provenance of any shape, and only an imported sync carries one', () => {
    expect(storedScoreShape(JSON.stringify({ format: 'soundslice-sync-array', scoreShape: '12x1/1' }))).toBe('12x1/1');
    expect(storedScoreShape({ scoreShape: '' })).toBeNull();
    expect(storedScoreShape('not json')).toBeNull();
    expect(storedScoreShape(null)).toBeNull();
    const imported = attachmentSync([[0, 0], [1, 2]], null);
    expect(isImportedSync({ syncpoints: JSON.stringify(imported.syncpoints), provenance: JSON.stringify(imported.provenance) })).toBe(true);
    const authored = attachmentSync({ format: 'studio-sync-segments', segments: lucky, syncpoints: [[0, 2], [1, 4]] }, null);
    expect(isImportedSync({ syncpoints: JSON.stringify(authored.syncpoints), provenance: JSON.stringify(authored.provenance) })).toBe(false);
    expect(isImportedSync({ syncpoints: null, provenance: null })).toBe(false);
  });
});
