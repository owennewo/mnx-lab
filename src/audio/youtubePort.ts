/** Official API mechanics with an injected player; no DOM or network at module load. */
import type { MediaEvent, MediaPort } from './recordingBackend.ts';
import { boundedRate, type PlaybackCapabilities } from './playbackBackend.ts';
export interface YouTubePlayerApi {
  playVideo(): void; pauseVideo(): void; seekTo(seconds: number, allowSeekAhead: boolean): void;
  cueVideoById(options: { videoId: string; startSeconds: number }): void;
  getCurrentTime(): number; getDuration(): number; getPlayerState(): number;
  getPlaybackRate(): number; getAvailablePlaybackRates(): number[]; setPlaybackRate(rate: number): void;
  getVolume(): number; setVolume(volume: number): void;
  mute(): void; unMute(): void; isMuted(): boolean;
  destroy(): void;
}
export interface YouTubeEvents {
  onReady(): void; onStateChange(event: { data: number }): void;
  onPlaybackRateChange(): void; onError(event: { data: number }): void; onAutoplayBlocked(): void;
}
export type YouTubeFactory = (events: YouTubeEvents) => Promise<YouTubePlayerApi>;
const errors: Record<number, string> = {
  2: 'The YouTube video ID is invalid.', 5: 'This browser cannot play the YouTube video.',
  100: 'This YouTube video is removed, private or unavailable.',
  101: 'The owner does not allow this video to be embedded.', 150: 'The owner does not allow this video to be embedded.',
  153: 'YouTube could not identify this embed. Check the host origin and HTTP Referer policy.',
};
export class YouTubePort implements MediaPort {
  readonly kind = 'youtube';
  private api?: YouTubePlayerApi;
  private apiReady = false;
  private listeners = new Set<(event: MediaEvent) => void>();
  private ready?: Promise<void>;
  private closed = false;
  private state = -1;
  private fault?: string;
  private acceptedRate = 1;
  private requestedRate = 1;
  private gain = .7;
  private playRequest?: { resolve(): void; reject(error: Error): void };
  private playTimer?: ReturnType<typeof setTimeout>;
  private readyCancel?: () => void;
  private seekTarget?: number;
  private seekingNow = false;
  private clock = 0;
  private hasPlayed = false;
  private clockKnown = false;
  private generation = 0;
  private seekVersion = 0;
  private seekRequest?: { resolve(): void; reject(error: Error): void };
  private seekTimer?: ReturnType<typeof setTimeout>;
  private seekDone?: Promise<void>;
  private durationSeen = 0;
  private unstableDuration = false;
  private priming = false;
  private primed?: Promise<boolean>;
  private primeFinish?: (started: boolean) => void;
  constructor(private readonly videoId: string, private readonly factory: YouTubeFactory,
    private readonly visible: () => boolean) {}
  get capabilities(): PlaybackCapabilities {
    const reported = this.apiReady ? this.api!.getAvailablePlaybackRates() : [1];
    const values = [...new Set((Array.isArray(reported) ? reported : [1]).filter(r => Number.isFinite(r) && r > 0))].sort((a,b)=>a-b);
    if (!values.length) values.push(1);
    return { rate: { min: values[0], max: values.at(-1)!, step: 1, values }, volume: true, loop: 'seek', parts: false };
  }
  get currentTime() { return this.clock; }
  get duration() { const value=this.apiReady ? this.api!.getDuration() : 0; return Number.isFinite(value) && value>=0 ? value : 0; }
  get paused() { return this.state !== 1; }
  get ended() { return this.state === 0; }
  get seeking() { return this.seekingNow; }
  get rate() { return this.acceptedRate; }
  get volume() { const value=this.apiReady ? this.api!.getVolume() : NaN; return Number.isFinite(value) ? Math.min(1,Math.max(0,value/100)) : this.gain; }
  get error() { return this.fault; }
  /** Mid-seek the clock is the seek's TARGET (`sample` only takes YouTube's own time once it arrives near it),
   *  which is a known place: treating it as unknown dropped the score position for every seek's few hundred ms,
   *  and the tray flashed "no score position" on each press. */
  get clockReliable() { return !this.unstableDuration && (this.hasPlayed || this.clockKnown); }
  get clockIssue() { return this.unstableDuration ? 'The video duration is changing. Live or interrupted content cannot be followed reliably.' : undefined; }
  subscribe(listener: (event: MediaEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit(event: MediaEvent) { if (!this.closed) for (const listener of this.listeners) listener(event); }
  private fail(message: string) { this.primeFinish?.(false); this.fault = message; clearTimeout(this.seekTimer); this.seekRequest?.reject(new Error(message)); this.seekRequest=undefined; this.rejectPlay(message); this.pause(); this.emit('error'); }
  private rejectPlay(message: string) { clearTimeout(this.playTimer); this.playRequest?.reject(new Error(message)); this.playRequest = undefined; }
  prepare() {
    if (this.closed) return Promise.reject(new Error('YouTube source is disposed.'));
    return this.ready ??= new Promise<void>((resolve,reject) => {
      let announced = false, finished = false, failed = false;
      const timeout = setTimeout(() => finish(new Error('YouTube did not become ready. Check the connection and host CSP.')), 15000);
      const finish = (error?: Error) => { if (finished) return; finished=true; clearTimeout(timeout); this.readyCancel=undefined;
        if(error){failed=true;this.fault=error.message;this.api?.destroy();this.api=undefined;this.apiReady=false;reject(error);}else resolve(); };
      this.readyCancel=()=>finish(new Error('YouTube loading cancelled.'));
      const ready = () => {
        if (!this.api || !announced || this.closed || failed) return;
        this.apiReady=true; this.api.setVolume(this.gain*100); this.setRate(this.requestedRate);
        finish(); this.emit('time');
      };
      void this.factory({
        onReady: () => { announced=true; ready(); },
        onStateChange: ({data}) => {
          if (this.closed) return;
          // A prime's own play is not playback: it never reaches this.state, so
          // nothing downstream can read the player as started.
          if (this.priming) { if (data===1) this.primeFinish?.(true); return; }
          this.state=data;
          if (data===0) this.hasPlayed=false;
          if (data===1 || data===3) {
            if (!this.visible()) { this.rejectPlay('Show the YouTube player before pressing Play.'); this.pause(); return; }
          }
          if (data===1) { this.fault=undefined; this.hasPlayed=true; clearTimeout(this.playTimer); this.playRequest?.resolve(); this.playRequest=undefined; }
          if(data===5 && !this.hasPlayed && this.seekRequest){this.setRate(this.requestedRate);clearTimeout(this.seekTimer);this.seekingNow=false;this.seekRequest.resolve();this.seekRequest=undefined;this.emit('seeked');}
          this.sample();
          this.emit(data===1?'playing':data===3?'waiting':data===0?'ended':data===2?'pause':'time');
        },
        onPlaybackRateChange: () => { if (this.closed) return; const rate=this.apiReady ? this.api!.getPlaybackRate() : 1; if(Number.isFinite(rate) && rate>0)this.acceptedRate=rate; this.emit('rate'); },
        onError: ({data}) => { const message=errors[data] ?? `YouTube playback failed (${data}).`; finish(new Error(message)); if (!this.closed) this.fail(message); },
        onAutoplayBlocked: () => { if (this.closed) return; if (this.priming) { this.primeFinish?.(false); return; } this.fail('YouTube playback was blocked. Press Play in the visible YouTube player.'); },
      }).then(api => { if (this.closed || failed) { api.destroy(); return; } this.api=api; ready(); }, error => finish(error instanceof Error?error:new Error(String(error))));
    });
  }
  /** Called by the browser adapter. Only the reported content clock drives sync. */
  sample() {
    if (this.closed || !this.apiReady || !this.api) return;
    if (!this.visible()) { this.primeFinish?.(false); if (!this.paused || this.playRequest) this.pause(); return; }
    if (this.priming) return;
    const duration=this.api.getDuration();
    if (this.hasPlayed && duration>0) {
      if (this.durationSeen && Math.abs(duration-this.durationSeen)>2) this.unstableDuration=true;
      else if (!this.durationSeen) this.durationSeen=duration;
    }
    const actual=this.api.getCurrentTime();
    if (Number.isFinite(actual) && actual>=0 && this.state!==3) {
      if (this.seekTarget === undefined || Math.abs(actual-this.seekTarget)<.75) {
        this.clock=actual; this.seekTarget=undefined;
        if (this.seekingNow) { this.seekingNow=false; clearTimeout(this.seekTimer); this.seekRequest?.resolve(); this.seekRequest=undefined; this.emit('seeked'); }
      }
    }
    this.emit('time');
  }
  async play() {
    const generation=++this.generation;
    await this.prepare();
    await this.seekDone;
    if (this.closed || generation!==this.generation) return;
    if (!this.visible()) throw new Error('Show the YouTube player before pressing Play.');
    if (this.state===1) return;
    this.fault=undefined;
    this.rejectPlay('Playback superseded.');
    return new Promise<void>((resolve,reject) => {
      this.playRequest={resolve,reject};
      this.playTimer=setTimeout(()=>{this.rejectPlay('YouTube did not start. Press Play in its visible controls.');this.pause();},10000);
      this.api!.playVideo();
    });
  }
  pause() {
    if (this.closed) return;
    this.primeFinish?.(false);
    ++this.generation; this.rejectPlay('Playback paused.'); if(this.apiReady)this.api!.pauseVideo(); this.state=2; this.emit('pause');
  }
  /** A cued video renders no frame, so a cold seek can only move our own clock:
   *  the picture stays on the poster until the player has played once. One
   *  muted play, paused the moment it starts, leaves it in the paused state
   *  where seekTo repaints without starting anything. Attempted once, on the
   *  first seek — where the frame is provably visible and a gesture just
   *  happened — and refusing it simply leaves the cue path in force.
   */
  private prime(): Promise<boolean> {
    if (this.primed) return this.primed;
    // A moment that cannot be primed is not an answer about autoplay: only a
    // real attempt is remembered, so a click made with the video away does not
    // cost the next one its picture.
    if (this.closed || !this.apiReady || this.state===0 || !this.visible()) return Promise.resolve(false);
    return this.primed = new Promise<boolean>(resolve => {
      const wasMuted=this.api!.isMuted();
      this.priming=true;
      const finish=(started: boolean) => {
        if (!this.priming) return;
        this.priming=false; clearTimeout(timer); this.primeFinish=undefined;
        if (!this.closed) {
          this.api!.pauseVideo(); if(!wasMuted)this.api!.unMute(); this.api!.setVolume(this.gain*100);
          if (started) { this.hasPlayed=true; this.state=2; }
        }
        resolve(started);
      };
      this.primeFinish=finish;
      const timer=setTimeout(()=>finish(false),6000);
      this.api!.mute(); this.api!.playVideo();
    });
  }
  async seek(seconds: number) {
    const version=++this.seekVersion;
    await this.prepare();
    if (this.closed || version!==this.seekVersion) return;
    if (!Number.isFinite(seconds) || seconds<0 || (this.duration>0 && seconds>this.duration)) throw new Error('Seek is outside this YouTube recording.');
    // Covers the prime as well as the seek, so a Play arriving mid-prime waits
    // rather than racing the pause that ends it.
    const running = this.seekDone = this.runSeek(seconds,version);
    try { await running; } finally { if (this.seekDone === running) this.seekDone = undefined; }
  }
  private async runSeek(seconds: number, version: number) {
    clearTimeout(this.seekTimer); this.seekRequest?.reject(new Error('YouTube seek superseded.')); this.seekRequest=undefined;
    this.seekTarget=seconds; this.clock=seconds; this.clockKnown=true;
    if (!this.hasPlayed) {
      // The cursor moves on our clock first: a refused or slow prime must not
      // hold the score at the old position while it decides.
      this.emit('time');
      await this.prime();
      if (this.closed || version!==this.seekVersion) return;
    }
    if (!this.hasPlayed) {
      // seekTo on a merely cued video may start it. Cue with an offset instead.
      await new Promise<void>((resolve,reject)=>{
        this.seekRequest={resolve,reject};
        this.seekTimer=setTimeout(()=>{this.seekRequest=undefined;reject(new Error('YouTube did not cue this position. Retry the video.'));},10000);
        this.api!.cueVideoById({videoId:this.videoId,startSeconds:seconds});
      });
      this.seekingNow=false;
    } else {
      this.seekingNow=true;
      await new Promise<void>((resolve,reject)=>{
        this.seekRequest={resolve,reject};
        this.seekTimer=setTimeout(()=>{this.seekRequest=undefined;this.seekingNow=false;reject(new Error('YouTube seek timed out.'));},10000);
        this.api!.seekTo(seconds,true); this.emit('seeking'); this.sample();
      });
    }
    this.emit('time');
  }
  setRate(rate: number) {
    this.requestedRate=rate;
    if (this.apiReady) this.api!.setPlaybackRate(boundedRate(rate,this.capabilities));
    return this.acceptedRate;
  }
  setVolume(volume: number) { this.gain=volume; if(this.apiReady&&!this.priming)this.api!.setVolume(volume*100); return this.volume; }
  dispose() {
    if (this.closed) return;
    this.primeFinish?.(false);
    this.closed=true; ++this.generation; ++this.seekVersion; clearTimeout(this.seekTimer); this.seekRequest?.reject(new Error('YouTube source disposed.')); this.seekRequest=undefined; this.readyCancel?.(); this.rejectPlay('YouTube source disposed.');
    this.listeners.clear(); this.api?.destroy(); this.api=undefined;
  }
}
