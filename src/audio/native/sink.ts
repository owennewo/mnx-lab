/** Native Web Audio renderer; importing this module never creates a context. */
import type { Sink, SinkEvent } from '../sink.ts';
import type { Clock } from '../transport.ts';

const TAIL = 0.005;
interface Point {
  time: number;
  value: number;
  linear: boolean;
}
/** Owned parameter history: AudioParam.value is not a future-time query. */
class Automation {
  private points: Point[];
  constructor(
    private param: AudioParam,
    initial: number,
    private context: BaseAudioContext,
  ) {
    this.points = [{ time: 0, value: initial, linear: false }];
  }
  at(time: number): number {
    let i = this.points.length - 1;
    while (i > 0 && this.points[i]!.time > time) i--;
    const a = this.points[i]!,
      b = this.points[i + 1];
    return b?.linear && b.time > a.time
      ? a.value + (b.value - a.value) * Math.max(0, (time - a.time) / (b.time - a.time))
      : a.value;
  }
  set(time: number, value: number, ramp = 0) {
    const held = this.at(time);
    const crossing = this.points.find((p) => p.time >= time)?.linear ?? false;
    this.points = this.points.filter((p) => p.time < time || p.time > time + ramp);
    if (crossing) this.points.push({ time, value: held, linear: true });
    if (!crossing || !ramp) this.points.push({ time, value: ramp ? held : value, linear: false });
    if (ramp) this.points.push({ time: time + ramp, value, linear: true });
    this.points.sort((a, b) => a.time - b.time);
    this.render();
  }
  hold(time: number) {
    const value = this.at(time);
    const crossing = this.points.find((p) => p.time >= time)?.linear ?? false;
    this.points = this.points.filter((p) => p.time < time);
    this.points.push({ time, value, linear: crossing });
    this.render();
  }
  private render() {
    const now = this.context.currentTime;
    const value = this.at(now);
    this.param.cancelScheduledValues(now);
    this.param.setValueAtTime(value, now);
    for (const point of this.points)
      if (point.time > now) {
        if (point.linear) this.param.linearRampToValueAtTime(point.value, point.time);
        else this.param.setValueAtTime(point.value, point.time);
      }
  }
}
interface Voice {
  id: string;
  start: number;
  end: number;
  oscillator: OscillatorNode;
  gain: GainNode;
  amplitude: Automation;
  pitch: Automation;
  detune: Automation;
}
export interface NativeSinkOptions {
  /** Master amplitude, independent of note velocities; defaults to 1. */
  volume?: number;
  /** A host-owned live or offline context. It is never closed by the sink. */
  context?: BaseAudioContext;
  /** Optional host routing, from the same context. */
  destination?: AudioNode;
  /** Called lazily by unlock; defaults to new AudioContext(). */
  createContext?: () => AudioContext;
}
export class NativeSink implements Sink {
  private context: BaseAudioContext | undefined;
  private owned = false;
  private output?: GainNode;
  private volume = 1;
  private disposed = false;
  private voices = new Set<Voice>();
  constructor(private options: NativeSinkOptions = {}) {
    this.context = options.context;
    this.setVolume(options.volume ?? 1);
    if (options.destination && options.context !== options.destination.context)
      throw new Error('Destination must belong to the supplied context.');
  }
  private live() {
    if (this.disposed) throw new Error('Sink is disposed.');
  }
  now(): number {
    return this.context?.currentTime ?? 0;
  }
  async unlock(): Promise<void> {
    this.live();
    if (!this.context) {
      this.context = (this.options.createContext ?? (() => new AudioContext()))();
      this.owned = true;
    }
    if (
      !('startRendering' in this.context) &&
      'resume' in this.context &&
      this.context.state !== 'running'
    )
      await (this.context as AudioContext).resume();
    this.live();
  }
  setVolume(volume: number): void {
    this.live();
    if (!Number.isFinite(volume) || volume < 0 || volume > 1)
      throw new RangeError('Volume must be within [0, 1].');
    this.volume = volume;
    this.output?.gain.setTargetAtTime(volume, this.now(), 0.005);
  }
  private destination(): AudioNode {
    if (!this.output) {
      this.output = this.context!.createGain();
      this.output.gain.value = this.volume;
      this.output.connect(this.options.destination ?? this.context!.destination);
    }
    return this.output;
  }
  private voiceAt(id: string, time: number): Voice | undefined {
    return [...this.voices]
      .filter((v) => v.id === id && v.start <= time && v.end > time)
      .sort((a, b) => b.start - a.start)[0];
  }
  private releaseVoice(v: Voice, time: number) {
    if (time >= v.end) return;
    v.end = time;
    v.pitch.hold(time);
    v.detune.hold(time);
    v.amplitude.hold(time);
    v.amplitude.set(time, 0, TAIL);
    v.oscillator.stop(time + TAIL);
  }
  schedule(events: readonly SinkEvent[], audioTime: number): void {
    this.live();
    if (!Number.isFinite(audioTime) || audioTime < 0) throw new RangeError('Invalid audio time.');
    let previous = -Infinity;
    // Validate the whole batch before creating or changing nodes.
    for (const event of events) {
      if (
        !Number.isFinite(event.offset) ||
        !Number.isFinite(audioTime + event.offset) ||
        event.offset < 0 ||
        event.offset < previous
      )
        throw new RangeError('Offsets must be finite, nonnegative and ordered.');
      previous = event.offset;
      if (
        (event.kind === 'attack' || event.kind === 'pitch') &&
        (!Number.isFinite(event.hz) || event.hz <= 0)
      )
        throw new RangeError('Invalid frequency.');
      if (
        event.kind === 'attack' &&
        (!Number.isFinite(event.velocity) || event.velocity < 0 || event.velocity > 1)
      )
        throw new RangeError('Invalid velocity.');
      if (event.kind === 'bend' && !Number.isFinite(event.cents))
        throw new RangeError('Invalid bend.');
      if (
        'rampSeconds' in event &&
        event.rampSeconds !== undefined &&
        (!Number.isFinite(event.rampSeconds) || event.rampSeconds < 0)
      )
        throw new RangeError('Invalid ramp.');
    }
    if (!events.length) return;
    if (!this.context) throw new Error('Call unlock before scheduling.');
    const context = this.context;
    for (const event of events) {
      const time = Math.max(context.currentTime, audioTime + event.offset);
      let voice = this.voiceAt(event.voice, time);
      if (event.kind === 'attack') {
        if (voice) this.releaseVoice(voice, time);
        const oscillator = context.createOscillator(),
          gain = context.createGain();
        oscillator.connect(gain);
        gain.connect(this.destination());
        voice = {
          id: event.voice,
          start: time,
          end: Infinity,
          oscillator,
          gain,
          amplitude: new Automation(gain.gain, 0, context),
          pitch: new Automation(oscillator.frequency, event.hz, context),
          detune: new Automation(oscillator.detune, 0, context),
        };
        const next = [...this.voices]
          .filter((v) => v.id === event.voice && v.start > time && v.end > v.start)
          .sort((a, b) => a.start - b.start)[0];
        this.voices.add(voice);
        voice.pitch.set(time, event.hz);
        voice.detune.set(time, 0);
        voice.amplitude.set(time, event.velocity * 0.2, TAIL);
        const ownedVoice = voice;
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          this.voices.delete(ownedVoice);
        };
        oscillator.start(time);
        if (next) this.releaseVoice(voice, next.start);
      } else if (voice) {
        if (event.kind === 'release') this.releaseVoice(voice, time);
        else if (event.kind === 'pitch')
          voice.pitch.set(time, event.hz, Math.min(event.rampSeconds ?? 0, voice.end - time));
        else
          voice.detune.set(time, event.cents, Math.min(event.rampSeconds ?? 0, voice.end - time));
      }
    }
  }
  cancel(fromAudioTime: number): void {
    this.live();
    if (!Number.isFinite(fromAudioTime) || fromAudioTime < 0)
      throw new RangeError('Invalid cancellation time.');
    const time = Math.max(this.now(), fromAudioTime);
    for (const voice of this.voices) {
      if (voice.start >= time) {
        voice.amplitude.hold(time);
        voice.amplitude.set(time, 0);
        voice.pitch.hold(time);
        voice.detune.hold(time);
        voice.end = time;
        voice.oscillator.stop(time);
      } else this.releaseVoice(voice, time);
    }
  }
  release(voice: string, audioTime: number): void {
    this.schedule([{ kind: 'release', voice, offset: 0 }], audioTime);
  }
  bend(voice: string, cents: number, audioTime: number, rampSeconds?: number): void {
    this.schedule([{ kind: 'bend', voice, cents, rampSeconds, offset: 0 }], audioTime);
  }
  dispose(): void {
    if (this.disposed) return;
    this.cancel(this.now());
    this.disposed = true;
    for (const v of this.voices) {
      v.oscillator.stop(this.now());
      v.oscillator.disconnect();
      v.gain.disconnect();
      v.oscillator.onended = null;
    }
    this.voices.clear();
    this.output?.disconnect();
    this.output = undefined;
    if (this.owned && this.context && 'close' in this.context)
      void (this.context as AudioContext).close();
  }
}
/** Runtime-only adapter; global timers are never touched while importing. */
export function nativeClock(sink: Sink): Clock {
  return {
    now: () => sink.now(),
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (handle) => {
      if (handle !== undefined) globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
  };
}
