import { describe, expect, it } from 'vitest';
import { PlaybackSession } from '../../src/audio/playbackSession.ts';
import { RecordingBackend, type MediaPort, type MediaEvent } from '../../src/audio/recordingBackend.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { createRecordingSync } from '../../src/audio/recordingSync.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import { ZERO, rational as q } from '../../src/audio/time.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
const document: MnxStructure = { global: { measures: [{ time: { count: 4, unit: 4 } }, {}] }, parts: [{ measures: ['a','b'].map(id => ({ sequences: [{ content: [{ duration: { base: 'whole' }, notes: [{ id, pitch: { step: 'C', octave: 4 } }] }] }] })) }] };
const passes = linearizePasses(document), compiled = compilePerformance(document, passes);
if (!compiled.ok) throw new Error('fixture did not compile');
const performance = compiled.performance;
function map(points: unknown = [[0,2],[1,6],[2,12]]) {
  if (!compiled.ok) throw new Error('fixture');
  const result = createRecordingSync(points, compiled, passes);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}
const pos = (ordinal: number, metricOffset = ZERO) => ({ ordinal, metricOffset });
const flush = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve=r; }); return { promise, resolve }; }
class Media implements MediaPort {
  currentTime=0; duration=20; paused=true; ended=false; seeking=false; rate=1; volume=.7; error: string|undefined;
  disposed=false; plays=0; gate?: Promise<void>; blocked=false;
  listeners=new Set<(event:MediaEvent)=>void>();
  subscribe(fn:(event:MediaEvent)=>void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  emit(event:MediaEvent) { for(const fn of this.listeners) fn(event); }
  async prepare() { await this.gate; }
  async play() { if(this.blocked) throw new Error('Tap Play'); if(this.disposed) throw new Error('disposed'); this.plays++; this.paused=false; this.ended=false; this.emit('playing'); }
  pause() { this.paused=true; this.emit('pause'); }
  async seek(time:number) { this.currentTime=time; this.ended=false; this.emit('seeked'); }
  setRate(value:number) { return this.rate=value; }
  setVolume(value:number) { return this.volume=value; }
  dispose() { this.disposed=true; this.pause(); this.listeners.clear(); }
}
function backend(id='a', sync=map()) { const media=new Media(); return { media, backend:new RecordingBackend(id,media,performance,sync) }; }
describe('recording clock and score following', () => {
  it('keeps Play idempotent and restarts after natural completion', async () => {
    const {media,backend:b}=backend(); await b.play(); await b.play();
    expect(media.plays).toBe(1); expect(b.snapshot.state).toBe('playing');
    media.currentTime=20; media.ended=true; media.paused=true; media.emit('ended');
    expect(b.snapshot.state).toBe('stopped'); expect(b.snapshot.highlight).toEqual([]);
    await b.play(); expect(media.currentTime).toBe(2); expect(media.plays).toBe(2);
  });
  it('reads actual media time, freezes while waiting, and clears intro/outro highlights', async () => {
    const {media,backend:b}=backend(); await b.play();
    expect(media.currentTime).toBe(2); media.currentTime=9; media.emit('time');
    expect(b.snapshot.scorePosition).toEqual(pos(1,q(1n,2n))); expect(b.snapshot.highlight).toHaveLength(1);
    media.emit('waiting'); expect(b.snapshot.state).toBe('buffering');
    expect(b.snapshot.scorePosition).toEqual(pos(1,q(1n,2n)));
    media.currentTime=1; expect(b.snapshot.highlight).toEqual([]); expect(b.snapshot.scorePosition).toBeNull();
    media.currentTime=15; expect(b.snapshot.highlight).toEqual([]); expect(b.snapshot.transport).toBeUndefined();
    b.pause(); expect(b.snapshot.state).toBe('paused'); b.stop(); expect(b.snapshot.highlight).toEqual([]);
  });
  it('uses event timings and hides intervals without inventing onsets', async () => {
    const {media,backend:b}=backend('a',map([[0,2],[1,6,0,1],[1,10,240],[2,12]]));
    await b.play(); media.currentTime=8; expect(b.snapshot.hidePlayhead).toBe(true); expect(b.snapshot.highlight).toEqual([]);
    media.currentTime=11; expect(b.snapshot.scorePosition).toEqual(pos(1,q(3n,4n))); expect(b.snapshot.highlight).toHaveLength(1);
  });
  it('seeks by score position and repeats seek-based loops', async () => {
    const {media,backend:b}=backend(); await b.play(); await b.seek(pos(1)); expect(media.currentTime).toBe(6);
    b.setLoop({start:pos(0),end:pos(1)}); await flush(); expect(media.currentTime).toBe(2);
    media.currentTime=6.1; media.emit('time'); await flush(); expect(media.currentTime).toBe(2); expect(media.paused).toBe(false);
    b.pause(); media.currentTime=7; media.emit('time'); await flush(); expect(media.currentTime).toBe(7);
  });
  it('allows unsynced playback but disables score seek and following', async () => {
    const media=new Media(), b=new RecordingBackend('raw',media,performance,null);
    await b.play(); expect(b.snapshot.state).toBe('playing'); expect(b.snapshot.scorePosition).toBeNull(); expect(b.canSeek(pos(0))).toMatch(/sync/);
    const short=backend(); short.media.duration=5; await short.backend.prepare(); expect(short.backend.canSeek(pos(0))).toMatch(/beyond/);
  });
  it('cancels delayed readiness on pause and disposal, and reports rejected play', async () => {
    const {media,backend:b}=backend(); const gate=deferred(); media.gate=gate.promise;
    const playing=b.play(); b.pause(); gate.resolve(); await playing; expect(media.plays).toBe(0);
    media.blocked=true; await expect(b.play()).rejects.toThrow('Tap Play'); expect(media.paused).toBe(true);
    b.dispose(); expect(media.disposed).toBe(true); expect(media.listeners.size).toBe(0);
  });
});
describe('source handoff ownership', () => {
  it('preserves musical position, rate, volume and playing intent across different media clocks', async () => {
    const a=backend(), b=backend('b',map([[0,0],[1,10],[2,18]]));
    const session=new PlaybackSession(a.backend,()=>b.backend,()=>{});
    await session.play(); a.media.currentTime=9; session.setRate(1.5); session.setVolume(.3);
    expect(await session.select('b')).toBe(true); expect(a.media.disposed).toBe(true); expect(a.media.paused).toBe(true);
    expect(b.media.currentTime).toBe(14); expect(b.media.paused).toBe(false); expect(b.media.rate).toBe(1.5); expect(b.media.volume).toBe(.3);
    session.dispose();
  });
  it('keeps paused switches paused and requires an explicit start when unmapped', async () => {
    const a=backend(), b=backend('b'); await a.backend.prepare(); await a.backend.seek(pos(1));
    const session=new PlaybackSession(a.backend,()=>b.backend,()=>{}); await session.select('b'); expect(b.media.plays).toBe(0); expect(b.media.currentTime).toBe(6);
    session.dispose();
    const raw=new RecordingBackend('raw',new Media(),performance,null), c=backend();
    const second=new PlaybackSession(raw,()=>c.backend,()=>{}); expect(await second.select('a')).toBe(false);
    expect(second.snapshot.needsStart).toBe(true); expect(second.snapshot.alignmentIssue).toBeTruthy(); await second.play(); expect(c.media.plays).toBe(0);
    await second.start(); expect(second.snapshot.alignmentIssue).toBeUndefined(); expect(c.media.plays).toBe(1); second.dispose();
  });
  it('keeps media preparation failures separate from alignment warnings', async () => {
    const a=backend(), b=backend('b');
    b.media.prepare = async () => { throw new Error('Media could not load'); };
    const session=new PlaybackSession(a.backend,()=>b.backend,()=>{});
    expect(await session.select('b')).toBe(false);
    expect(session.snapshot.issue).toContain('Media could not load');
    expect(session.snapshot.alignmentIssue).toBeUndefined();
    expect(session.snapshot.needsStart).toBe(true);
    session.dispose();
  });
  it('carries the original position through rapid switches and ignores the abandoned load', async () => {
    const a=backend(), b=backend('b'), c=backend('c'); await a.backend.play(); a.media.currentTime=9;
    const gate=deferred(); b.media.gate=gate.promise;
    const session=new PlaybackSession(a.backend,id=>id==='b'?b.backend:c.backend,()=>{});
    const first=session.select('b'); await session.select('c'); gate.resolve(); await first;
    expect(c.media.currentTime).toBe(9); expect(c.media.plays).toBe(1); expect(b.media.plays).toBe(0); expect(b.media.disposed).toBe(true); session.dispose();
  });
  it('honors Pause, Stop and a newer seek while loading', async () => {
    for(const action of ['pause','stop','seek'] as const) {
      const a=backend(), b=backend('b'); await a.backend.play(); a.media.currentTime=9;
      const gate=deferred(); b.media.gate=gate.promise;
      const session=new PlaybackSession(a.backend,()=>b.backend,()=>{}); const selected=session.select('b');
      if(action==='seek') await session.seek(pos(1)); else session[action]();
      gate.resolve(); await selected; expect(b.media.currentTime).toBe(action==='stop'?2:action==='seek'?6:9);
      expect(b.media.plays).toBe(action==='seek'?1:0); session.dispose();
    }
  });
  it('surfaces browser rejection and permits retry without restarting an old source', async () => {
    const a=backend(), b=backend('b'); await a.backend.play(); b.media.blocked=true;
    const session=new PlaybackSession(a.backend,()=>b.backend,()=>{}); await session.select('b');
    expect(session.snapshot.issue).toBe('Tap Play'); expect(session.snapshot.wantsPlayback).toBe(false);
    b.media.blocked=false; await session.play(); expect(b.media.plays).toBe(1); expect(a.media.disposed).toBe(true); session.dispose();
  });
});
