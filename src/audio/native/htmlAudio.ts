import type { MediaEvent, MediaPort } from '../recordingBackend.ts';
/** All browser media ownership is here. Constructed lazily on source selection. */
export class HtmlAudioPort implements MediaPort {
  private readonly audio: HTMLAudioElement;
  private readonly listeners = new Set<(event: MediaEvent) => void>();
  private readonly detach: (() => void)[] = [];
  private readonly pending = new Set<() => void>();
  private objectUrl?: string;
  private ready?: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private closed = false;
  private seekVersion = 0;
  constructor(media: string | Blob) {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    if (typeof media === 'string') {
      const url = new URL(media, document.baseURI);
      if (!['http:', 'https:', 'blob:'].includes(url.protocol)) throw new Error('Audio must use an HTTP or blob URL.');
      this.audio.src = url.href;
    } else this.audio.src = this.objectUrl = URL.createObjectURL(media);
    const events: [string, MediaEvent][] = [['timeupdate', 'time'], ['playing', 'playing'], ['pause', 'pause'],
      ['waiting', 'waiting'], ['seeking', 'seeking'], ['seeked', 'seeked'], ['ended', 'ended'], ['ratechange', 'rate'], ['error', 'error']];
    for (const [native, event] of events) {
      const callback = () => {
        if (event === 'playing') this.poll();
        if (event === 'pause' || event === 'ended' || event === 'error') this.unpoll();
        this.emit(event);
      };
      this.audio.addEventListener(native, callback);
      this.detach.push(() => this.audio.removeEventListener(native, callback));
    }
  }
  get currentTime() { return this.audio.currentTime; }
  get duration() { return this.audio.duration; }
  get paused() { return this.audio.paused; }
  get ended() { return this.audio.ended; }
  get seeking() { return this.audio.seeking; }
  get rate() { return this.audio.playbackRate; }
  get volume() { return this.audio.volume; }
  get error() { return this.audio.error ? 'The audio could not be loaded. Check the file, connection and library sign-in.' : undefined; }
  subscribe(listener: (event: MediaEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit(event: MediaEvent) { if (!this.closed) for (const listener of this.listeners) listener(event); }
  private poll() { this.unpoll(); this.timer = setInterval(() => this.emit('time'), 40); }
  private unpoll() { clearInterval(this.timer); this.timer = undefined; }
  private waitFor(event: string, action: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout); this.pending.delete(cancel);
        this.audio.removeEventListener(event, done); this.audio.removeEventListener('error', failed);
      };
      const done = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error(this.error || 'Audio loading failed.')); };
      const cancel = () => { cleanup(); reject(new Error('Audio operation cancelled.')); };
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Audio loading or seeking timed out.')); }, 15_000);
      this.pending.add(cancel); this.audio.addEventListener(event, done); this.audio.addEventListener('error', failed);
      try { action(); } catch (error) { cleanup(); reject(error); }
    });
  }
  prepare() {
    if (this.closed) return Promise.reject(new Error('Audio source is disposed.'));
    if (this.audio.readyState >= 1) return Promise.resolve();
    return this.ready ??= this.waitFor('loadedmetadata', () => this.audio.load()).catch(error => { this.ready = undefined; throw error; });
  }
  async play() {
    if (this.closed) return;
    try { await this.audio.play(); }
    catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') throw new Error('Playback needs a tap on Play in this browser.');
      throw error;
    }
    if (this.closed) this.audio.pause();
  }
  pause() { if (!this.closed) { this.audio.pause(); this.unpoll(); } }
  async seek(seconds: number) {
    const version = ++this.seekVersion;
    await this.prepare();
    if (this.closed || version !== this.seekVersion) return;
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > this.audio.duration) throw new Error('Audio seek is outside the file.');
    if (!this.audio.seeking && Math.abs(this.audio.currentTime - seconds) < 1e-6) { this.emit('time'); return; }
    await this.waitFor('seeked', () => { this.audio.currentTime = seconds; });
  }
  setRate(rate: number) { this.audio.playbackRate = rate; return this.audio.playbackRate; }
  setVolume(volume: number) { this.audio.volume = volume; return this.audio.volume; }
  dispose() {
    if (this.closed) return;
    this.closed = true; ++this.seekVersion;
    this.unpoll(); this.listeners.clear(); this.detach.forEach(remove => remove());
    for (const cancel of [...this.pending]) cancel();
    this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }
}
