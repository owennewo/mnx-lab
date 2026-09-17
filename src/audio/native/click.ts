/** The sync bar's audible click: the browser half of `../clickSchedule.ts`.
 *  The media's reported clock is sampled only when its reading changes, so a
 *  port that refreshes ten times a second is not mistaken for a stalled one. */
import { ClickWindow, MediaClockEstimate } from '../clickSchedule.ts';
import type { SyncBeat } from '../../model/syncSegments.ts';

export interface ClickReading { readonly mediaTime: number; readonly rate: number; readonly playing: boolean }

export class ClickTrack {
  private context?: AudioContext;
  private timer?: ReturnType<typeof setInterval>;
  private readonly clock = new MediaClockEstimate();
  private readonly window = new ClickWindow();
  private last = NaN;
  constructor(private readonly read: () => ClickReading | null,
    private readonly beats: (from: number, to: number) => readonly SyncBeat[], private level = 0.5) {}
  /** Call from a user gesture: the audio context is created here. */
  start() {
    if (this.timer) return;
    this.context ??= new AudioContext();
    void this.context.resume();
    this.timer = setInterval(() => this.tick(), 25);
  }
  setLevel(level: number) { this.level = Math.min(1, Math.max(0, level)); }
  private tick() {
    const reading = this.read(), context = this.context;
    if (!reading || !context) { this.clock.reset(); this.window.reset(); this.last = NaN; return; }
    const now = performance.now() / 1000;
    if (reading.mediaTime !== this.last || reading.playing !== this.clock.playing || reading.rate !== this.clock.playbackRate) {
      this.clock.sample(now, reading.mediaTime, reading.rate, reading.playing);
      this.last = reading.mediaTime;
    }
    for (const { beat, delay } of this.window.due(this.clock, now, this.beats)) this.sound(context, context.currentTime + delay, beat.cut);
  }
  private sound(context: AudioContext, at: number, cut: boolean) {
    const osc = context.createOscillator(), gain = context.createGain();
    osc.type = 'triangle'; osc.frequency.value = cut ? 1760 : 1175;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(this.level, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    osc.connect(gain).connect(context.destination);
    osc.start(at); osc.stop(at + 0.08);
  }
  stop() {
    clearInterval(this.timer); this.timer = undefined;
    this.clock.reset(); this.window.reset(); this.last = NaN;
  }
  dispose() { this.stop(); void this.context?.close(); this.context = undefined; }
}
