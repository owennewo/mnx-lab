import { afterEach, describe, expect, it, vi } from 'vitest';
import { youtubeVideoId } from '../../src/audio/youtubeUrl.ts';
import { YouTubePort, type YouTubeEvents, type YouTubePlayerApi } from '../../src/audio/youtubePort.ts';
import { RecordingBackend } from '../../src/audio/recordingBackend.ts';
import { PlaybackSession } from '../../src/audio/playbackSession.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { createRecordingSync } from '../../src/audio/recordingSync.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import { ZERO, rational as q } from '../../src/audio/time.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
const id='M7lc1UVf-VE';
afterEach(()=>vi.useRealTimers());
describe('YouTube source parsing',()=>{
  it('accepts only documented video URL forms and video IDs',()=>{
    for(const source of [id,`https://www.youtube.com/watch?v=${id}&t=20`, `https://youtu.be/${id}?si=shared`, `https://m.youtube.com/watch?v=${id}`,`https://www.youtube-nocookie.com/embed/${id}`,`https://youtube.com/shorts/${id}`])expect(youtubeVideoId(source)).toBe(id);
    for(const source of [`https://youtube.com.evil.test/watch?v=${id}`,`https://evil.test/youtube.com/${id}`,`javascript:${id}`,`https://youtube.com:8443/watch?v=${id}`,`https://user@youtube.com/watch?v=${id}`,`https://youtube.com/watch?v=${id}&list=PLx`,`https://youtube.com/live/${id}`,`https://youtu.be/${id}/extra`,'bad','https://youtube.com/watch?v=short'])expect(()=>youtubeVideoId(source)).toThrow();
  });
});
function fixture() {
  let events!:YouTubeEvents, visible=true;
  const api={time:0,duration:20,state:5,rate:1,volume:70,destroyed:false,plays:0,cues:[] as number[],rates:[.5,1,1.5,2],requestedRate:1,muted:false,onPlay:'idle' as 'idle'|'start'|'block',
    playVideo(){this.plays++;if(this.onPlay==='start'){this.state=1;queueMicrotask(()=>events.onStateChange({data:1}));}else if(this.onPlay==='block')queueMicrotask(()=>events.onAutoplayBlocked());},pauseVideo(){this.state=2;},seekTo(time:number){this.time=time;},cueVideoById({startSeconds}:{startSeconds:number}){this.cues.push(startSeconds);this.time=startSeconds;this.state=5;events.onStateChange({data:5});},
    getCurrentTime(){return this.time;},getDuration(){return this.duration;},getPlayerState(){return this.state;},getPlaybackRate(){return this.rate;},getAvailablePlaybackRates(){return this.rates;},setPlaybackRate(rate:number){this.requestedRate=rate;},getVolume(){return this.volume;},setVolume(volume:number){this.volume=volume;},mute(){this.muted=true;},unMute(){this.muted=false;},isMuted(){return this.muted;},destroy(){this.destroyed=true;},
  } satisfies YouTubePlayerApi & Record<string,unknown>;
  const port=new YouTubePort(id,async next=>{events=next;queueMicrotask(()=>events.onReady());return api;},()=>visible);
  return {api,port,get events(){return events;},hide(){visible=false;},show(){visible=true;},state(data:number){api.state=data;events.onStateChange({data});}};
}
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
describe('official IFrame API adapter',()=>{
  it('tolerates metadata not yet populated when onReady fires',async()=>{
    const f=fixture();f.api.rates=undefined as unknown as number[];f.api.volume=undefined as unknown as number;
    await f.port.prepare();expect(f.port.capabilities.rate.values).toEqual([1]);expect(f.port.volume).toBe(.7);f.port.dispose();
  });
  it('cues without playback and applies only accepted rate events',async()=>{
    const f=fixture();f.api.onPlay='block';f.port.setRate(1.4);await f.port.prepare();
    expect(f.api.requestedRate).toBe(1.5);expect(f.port.rate).toBe(1);
    f.api.rate=1.5;f.events.onPlaybackRateChange();expect(f.port.rate).toBe(1.5);
    await f.port.seek(6);expect(f.api.cues).toEqual([6]);expect(f.port.paused).toBe(true);expect(f.port.error).toBeUndefined();expect(f.port.currentTime).toBe(6);
    expect(f.port.capabilities.rate.values).toEqual([.5,1,1.5,2]);f.port.setVolume(.25);expect(f.api.volume).toBe(25);f.port.dispose();
  });
  it('primes a cold player so the first seek moves the picture, not only the clock',async()=>{
    const f=fixture();f.api.onPlay='start';await f.port.prepare();
    const seen:string[]=[];f.port.subscribe(event=>seen.push(event));
    await f.port.seek(6);
    expect(f.api.cues).toEqual([]);expect(f.api.time).toBe(6);expect(f.api.state).toBe(2);
    expect(f.port.paused).toBe(true);expect(f.port.currentTime).toBe(6);
    expect(seen).not.toContain('playing');
    expect(f.api.muted).toBe(false);expect(f.api.volume).toBe(70);
    await f.port.seek(11);expect(f.api.time).toBe(11);expect(f.api.plays).toBe(1);f.port.dispose();
  });
  it('leaves a native mute alone and asks autoplay only once',async()=>{
    const f=fixture();f.api.onPlay='block';f.api.muted=true;await f.port.prepare();
    await f.port.seek(3);expect(f.api.muted).toBe(true);expect(f.port.error).toBeUndefined();
    await f.port.seek(5);expect(f.api.plays).toBe(1);expect(f.api.cues).toEqual([3,5]);f.port.dispose();
  });
  it('does not spend the one attempt on a moment it cannot use',async()=>{
    const f=fixture();await f.port.prepare();f.hide();
    await f.port.seek(4);expect(f.api.plays).toBe(0);expect(f.api.cues).toEqual([4]);
    f.show();f.api.onPlay='start';await f.port.seek(7);
    expect(f.api.plays).toBe(1);expect(f.api.time).toBe(7);expect(f.port.paused).toBe(true);f.port.dispose();
  });
  it('uses actual media time, freezes buffering and waits for confirmed seeks',async()=>{
    const f=fixture();await f.port.prepare();const play=f.port.play();await flush();f.state(1);await play;
    f.api.time=4;f.port.sample();expect(f.port.currentTime).toBe(4);
    f.state(3);f.api.time=9;f.port.sample();expect(f.port.currentTime).toBe(4);expect(f.port.clockReliable).toBe(true);
    f.state(1);expect(f.port.currentTime).toBe(9);await f.port.seek(12);expect(f.port.currentTime).toBe(12);expect(f.port.seeking).toBe(false);f.port.dispose();
  });
  it('cues again after ending so a reset cannot accidentally start video',async()=>{
    const f=fixture();await f.port.prepare();f.state(1);f.state(0);await f.port.seek(3);
    expect(f.api.cues).toEqual([3]);expect(f.api.plays).toBe(0);expect(f.port.paused).toBe(true);f.port.dispose();
  });
  it('waits for an outstanding seek before starting paused playback',async()=>{
    const f=fixture();await f.port.prepare();f.state(1);f.port.pause();f.api.seekTo=()=>{};
    const seeking=f.port.seek(8);await flush();const playing=f.port.play();await flush();expect(f.api.plays).toBe(0);
    f.api.time=8;f.port.sample();await seeking;await flush();expect(f.api.plays).toBe(1);f.state(1);await playing;f.port.dispose();
  });
  it('pauses when hidden and never resumes merely on becoming visible',async()=>{
    const f=fixture();await f.port.prepare();f.state(1);f.hide();f.port.sample();expect(f.port.paused).toBe(true);
    f.show();f.port.sample();expect(f.api.plays).toBe(0);f.hide();await expect(f.port.play()).rejects.toThrow('Show');f.port.dispose();
  });
  it('rejects blocked playback and supports retry through native controls',async()=>{
    const f=fixture();await f.port.prepare();const play=f.port.play();await flush();const rejected=expect(play).rejects.toThrow('blocked');f.events.onAutoplayBlocked();await rejected;
    expect(f.port.paused).toBe(true);expect(f.port.error).toContain('blocked');f.state(1);expect(f.port.error).toBeUndefined();f.port.dispose();
  });
  it('reports unavailable/identity errors and destroys late factories',async()=>{
    for(const code of [2,5,100,101,150,153]){const f=fixture();await f.port.prepare();f.events.onError({data:code});expect(f.port.error).toBeTruthy();expect(f.port.paused).toBe(true);f.port.dispose();}
    let resolve!:(api:YouTubePlayerApi)=>void;
    const f=fixture();const port=new YouTubePort(id,()=>new Promise(r=>resolve=r),()=>true);
    const ready=port.prepare();const rejected=expect(ready).rejects.toThrow('cancelled');port.dispose();resolve(f.api);await rejected;await flush();expect(f.api.destroyed).toBe(true);
  });
  it('invalidates delayed Play and handles API/readiness timeouts',async()=>{
    vi.useFakeTimers();let ready!:()=>void;const f=fixture();
    const port=new YouTubePort(id,async events=>{ready=events.onReady;return f.api;},()=>true);
    const play=port.play();await flush();port.pause();ready();await play;expect(f.api.plays).toBe(0);port.dispose();
    const pending=new YouTubePort(id,()=>new Promise(()=>{}),()=>true);const wait=pending.prepare();const rejected=expect(wait).rejects.toThrow('ready');await vi.advanceTimersByTimeAsync(15001);await rejected;pending.dispose();
  });
  it('suppresses following when duration changes instead of scaling score time to it',async()=>{
    const f=fixture();await f.port.prepare();f.state(1);f.api.duration=30;f.port.sample();expect(f.port.clockReliable).toBe(false);expect(f.port.clockIssue).toContain('changing');f.port.dispose();
  });
  it('integrates repeat positions, inner-bar anchors, native Pause and explicit YouTube starts',async()=>{
    const document:MnxStructure={global:{measures:[{time:{count:4,unit:4},repeatStart:{},repeatEnd:{}}]},parts:[{measures:[{sequences:[{content:[{duration:{base:'whole'},notes:[{pitch:{step:'C',octave:4}}]}]}]}]}]};
    const passes=linearizePasses(document),compiled=compilePerformance(document,passes);if(!compiled.ok)throw new Error('fixture');
    const mapped=createRecordingSync([[0,0],[1,4],[1,8,240],[2,12]],compiled,passes);if(!mapped.ok)throw new Error(mapped.diagnostic.message);
    const f=fixture();const backend=new RecordingBackend('yt',f.port,compiled.performance,mapped.value);
    const session=new PlaybackSession(backend,()=>backend,()=>{});f.api.onPlay='start';await backend.prepare();await session.seek({ordinal:1,metricOffset:ZERO});
    expect(backend.resumeOnSelect).toBe(false);const playing=session.play();await flush();f.state(1);await playing;
    f.api.time=10;f.port.sample();expect(session.snapshot.scorePosition).toEqual({ordinal:1,metricOffset:q(3n,4n)});
    backend.setLoop({start:{ordinal:0,metricOffset:ZERO},end:{ordinal:1,metricOffset:ZERO}});await flush();
    f.api.time=4.1;f.port.sample();await flush();expect(f.port.currentTime).toBe(0);
    f.state(2);expect(session.snapshot.wantsPlayback).toBe(false);session.dispose();
  });
});
