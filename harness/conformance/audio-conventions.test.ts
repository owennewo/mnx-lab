import { describe, expect, it } from 'vitest';
import { rational as q, add, subtract, ZERO, ONE, QUARTER, createTempoMap } from '../../src/audio/time.ts';
import { allocateGrace, placeStealingGrace, fermataMultiplier, fermataExtra, barlineFermataExtra,
  createInsertionMap, GRACE_BUDGET, LV_DURATION, VIBRATO_PERIOD, type InsertionRequest } from '../../src/audio/timingConventions.ts';

const source = { ordinal: 0, metricOffset: QUARTER, noteKey: 'note-a' };
const atQuarter = (kind: InsertionRequest['kind'], duration = GRACE_BUDGET): InsertionRequest =>
  ({ position: QUARTER, duration, kind, source });

describe('grace budgets and placement', () => {
  it('a quarter lends 1/32, a 128th lends 1/256, weighted by notated duration', () => {
    expect(allocateGrace('stealFollowing', [q(1n,8n),q(1n,16n)],QUARTER)).toEqual({
      duration:q(1n,32n),durations:[q(1n,48n),q(1n,96n)],diagnostics:[]
    });
    expect(allocateGrace('stealPrevious',[ONE],q(1n,128n)).durations).toEqual([q(1n,256n)]);
  });
  it('steals from the end of the previous neighbour or the start of the following neighbour', () => {
    const neighbour = { position:ONE,duration:QUARTER };
    expect(placeStealingGrace('stealPrevious',[ONE],neighbour)).toEqual({
      notes:[{position:q(39n,32n),duration:q(1n,32n)}],
      neighbour:{position:ONE,duration:q(7n,32n)},diagnostics:[]
    });
    expect(placeStealingGrace('stealFollowing',[ONE],neighbour)).toEqual({
      notes:[{position:ONE,duration:q(1n,32n)}],
      neighbour:{position:q(33n,32n),duration:q(7n,32n)},diagnostics:[]
    });
    expect(neighbour).toEqual({position:ONE,duration:QUARTER});
  });
  it('missing adjacent voice neighbours are silent and diagnosed; makeTime needs no neighbour', () => {
    for (const kind of ['stealPrevious','stealFollowing'] as const) {
      const result = placeStealingGrace(kind,[ONE],null);
      expect(result.notes).toEqual([]);
      expect(result.diagnostics[0]!.code).toBe('missing-grace-neighbour');
    }
    expect(allocateGrace('makeTime',[ONE,ONE],null)).toEqual({
      duration:GRACE_BUDGET,durations:[q(1n,64n),q(1n,64n)],diagnostics:[]
    });
    expect(allocateGrace('stealPrevious',[],null).diagnostics).toEqual([]);
  });
});

describe('score-wide fermata and make-time insertions', () => {
  it('pins every duration hint, including no extra time for none', () => {
    for (const [hint, expected] of [
      ['auto',q(3n,2n)],['normal',q(3n,2n)],['short',q(5n,4n)],['veryShort',q(5n,4n)],
      ['long',q(2n)],['veryLong',q(3n)],['none',ONE]
    ] as const) expect(fermataMultiplier(hint)).toEqual(expected);
    expect(fermataMultiplier()).toEqual(q(3n,2n));
    expect(fermataExtra(QUARTER)).toEqual(q(1n,8n));
    expect(fermataExtra(q(1n,2n))).toEqual(QUARTER);
    expect(barlineFermataExtra()).toEqual(q(1n,8n));
    expect(barlineFermataExtra('none')).toEqual(ZERO);
  });
  it('quarter/half releases together insert max(1/8,1/4), once', () => {
    const map = createInsertionMap([
      {position:ONE,duration:fermataExtra(QUARTER),kind:'fermata',source},
      {position:ONE,duration:fermataExtra(q(1n,2n)),kind:'fermata',source:{...source,noteKey:'note-b'}},
      {position:ONE,duration:barlineFermataExtra(),kind:'fermata',source:{ordinal:0,metricOffset:ONE}}
    ]);
    expect(map.insertions).toHaveLength(1);
    expect(map.insertions[0]!.duration).toEqual(QUARTER);
    expect(map.toPerformance(q(2n))).toEqual(q(9n,4n));
    expect(map.mapSpan(q(3n,4n),QUARTER)).toEqual({position:q(3n,4n),duration:q(1n,2n)});
    expect(map.mapSpan(q(1n,2n),q(1n,2n))).toEqual({position:q(1n,2n),duration:q(3n,4n)});
  });
  it('two simultaneous make-time groups share 1/32; crossing voices extend and ending voices release', () => {
    const map = createInsertionMap([
      atQuarter('makeTime'), {...atQuarter('makeTime'),source:{...source,noteKey:'note-b',graceId:'grace-b'}}
    ]);
    expect(map.insertions).toHaveLength(1); expect(map.insertions[0]!.sources).toHaveLength(2);
    expect(map.toPerformance(QUARTER)).toEqual(q(9n,32n));
    expect(map.toPerformance(ONE)).toEqual(q(33n,32n));
    expect(map.mapSpan(ZERO,q(1n,2n))).toEqual({position:ZERO,duration:q(17n,32n)});
    expect(map.mapSpan(ZERO,QUARTER)).toEqual({position:ZERO,duration:QUARTER});
  });
  it('orders hold, grace, principal attacks without making grace inherit the hold', () => {
    const map = createInsertionMap([atQuarter('makeTime'),atQuarter('fermata',q(1n,8n))]);
    expect(map.insertions.map(i => [i.kind,i.position,i.duration])).toEqual([
      ['fermata',QUARTER,q(1n,8n)],['makeTime',q(3n,8n),q(1n,32n)]
    ]);
    expect(map.toPerformance(QUARTER,'before')).toEqual(QUARTER);
    expect(map.toPerformance(QUARTER,'afterFermata')).toEqual(q(3n,8n));
    expect(map.toPerformance(QUARTER)).toEqual(q(13n,32n));
    expect(map.mapSpan(ZERO,QUARTER)).toEqual({position:ZERO,duration:q(3n,8n)});
    expect(map.mapSpan(QUARTER,QUARTER)).toEqual({position:q(13n,32n),duration:QUARTER});
    expect(map.locate(q(5n,16n))).toEqual({metricPosition:QUARTER,insertion:map.insertions[0]});
    expect(map.locate(q(3n,8n))).toEqual({metricPosition:QUARTER,insertion:map.insertions[1]});
    expect(map.locate(q(13n,32n))).toEqual({metricPosition:QUARTER});
    expect(map.locate(QUARTER).metricPosition).toEqual(QUARTER); // hold shows release, not a new beat
  });
  it('maps later boundaries and tempo through the same expansion, with old tempo during the insertion', () => {
    const map = createInsertionMap([atQuarter('makeTime'), { ...atQuarter('fermata',q(1n,8n)),position:ONE }]);
    const tempos = createTempoMap([{position:map.toPerformance(QUARTER),quarterBpm:q(60n)}]);
    expect(tempos.secondsAt(map.toPerformance(QUARTER))).toBe(9/16);
    expect(map.toPerformance(ONE)).toEqual(q(37n,32n));
    expect(map.locate(map.toPerformance(q(2n)))).toEqual({metricPosition:q(2n)});
    expect(map.locate(ZERO)).toEqual({metricPosition:ZERO});
    expect(createInsertionMap([atQuarter('fermata',ZERO)]).insertions).toEqual([]);
  });
});

it('vibrato has a rational period: 5 Hz at 120 BPM, slower when tempo or rate slows', () => {
  const normal = createTempoMap();
  const slow = createTempoMap([{position:ZERO,quarterBpm:q(60n)}]);
  expect(normal.secondsAt(VIBRATO_PERIOD)).toBe(0.2);
  expect(slow.secondsAt(VIBRATO_PERIOD)).toBe(0.4);
  expect(normal.secondsAt(VIBRATO_PERIOD)/0.5).toBe(0.4); // transport applies rate once
  expect(LV_DURATION).toEqual(ONE);
  expect(subtract(add(QUARTER,GRACE_BUDGET),QUARTER)).toEqual(GRACE_BUDGET);
});
