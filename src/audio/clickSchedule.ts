/** The sync bar's click, as arithmetic (roadmap/complete/studio-sync-bar.md).
 *
 *  A recording's clock is read, not owned: HTML media reports it in coarse
 *  steps and YouTube in jittery ones, so a click scheduled straight off a
 *  reading would flam against the beat it marks. `MediaClockEstimate` fits a
 *  line through the readings; `ClickWindow` hands each beat to the audio clock
 *  once. Pure and Node-safe — only the oscillator lives in `native/`. */

/** A reading further than this from the estimate is a seek, not jitter. */
const JUMP_SECONDS = 0.12;
/** How much of a reading's disagreement the estimate absorbs. */
const BLEND = 0.1;

export class MediaClockEstimate {
  private anchorNow = 0;
  private anchorMedia = 0;
  private rate = 1;
  private running = false;
  private primed = false;
  /** `now` and the reading are seconds; `now` is any monotonic clock. */
  sample(now: number, mediaTime: number, rate: number, playing: boolean) {
    const moved = rate !== this.rate || playing !== this.running;
    const expected = this.at(now);
    if (!this.primed || moved || !playing || Math.abs(mediaTime - expected) > JUMP_SECONDS) this.anchorMedia = mediaTime;
    else this.anchorMedia = expected + (mediaTime - expected) * BLEND;
    this.anchorNow = now; this.rate = rate; this.running = playing; this.primed = true;
  }
  /** The media time the estimate gives for `now`. */
  at(now: number) { return this.primed && this.running ? this.anchorMedia + (now - this.anchorNow) * this.rate : this.anchorMedia; }
  get playing() { return this.primed && this.running; }
  get playbackRate() { return this.rate; }
  reset() { this.primed = false; this.running = false; }
}

export interface ScheduledClick<T> { readonly beat: T; /** Seconds from `now` on the audio clock. */ readonly delay: number }
/** Each beat inside the lookahead is scheduled exactly once. A seek backwards
 *  re-arms the beats it passes. */
export class ClickWindow {
  private through = -Infinity;
  constructor(readonly lookahead = 0.2) {}
  due<T extends { readonly time: number }>(clock: MediaClockEstimate, now: number, beats: (from: number, to: number) => readonly T[]): ScheduledClick<T>[] {
    if (!clock.playing) { this.through = -Infinity; return []; }
    const media = clock.at(now), rate = clock.playbackRate;
    if (media < this.through - JUMP_SECONDS - this.lookahead * rate) this.through = -Infinity;
    const from = Math.max(media, this.through), to = media + this.lookahead * rate;
    if (to <= from) return [];
    this.through = to;
    // The window's own bounds decide, so a source that rounds its edges cannot repeat a beat.
    return beats(from, to).filter(beat => beat.time >= from && beat.time < to).map(beat => ({ beat, delay: Math.max(0, (beat.time - media) / rate) }));
  }
  reset() { this.through = -Infinity; }
}
