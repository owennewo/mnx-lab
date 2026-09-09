/** Native Web Audio renderer; importing this module never creates a context. */
import type { Sink, SinkEvent } from '../sink.ts';
import {
  selectGuitarSample,
  isGuitarPreset,
  type GuitarPreset,
  type VoicePreset,
} from '../sampleSelection.ts';
import {
  loadGuitarSamples,
  type GuitarSampleBank,
  type GuitarSampleLoader,
} from './guitarSamples.ts';
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
    const incoming = this.points.find((p) => p.time >= time);
    const crossing = incoming?.linear ?? false;
    const left = incoming?.time === time && incoming.linear ? incoming.value : held;
    this.points = this.points.filter((p) => p.time < time || p.time > time + ramp);
    if (crossing) this.points.push({ time, value: left, linear: true });
    if (!crossing || !ramp || left !== held)
      this.points.push({ time, value: ramp ? held : value, linear: false });
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
    for (const [index, point] of this.points.entries())
      if (point.time > now) {
        const next = this.points[index + 1];
        // Web Audio collapses a ramp endpoint followed by a same-time step.
        // End the incoming ramp one sample before the discontinuity so a
        // legato bend reset cannot pull the preceding note's curve downward.
        if (point.linear && next?.time === point.time && !next.linear) {
          const before = Math.max(now, point.time - 1 / this.context.sampleRate);
          this.param.linearRampToValueAtTime(this.at(before), before);
        } else if (point.linear) this.param.linearRampToValueAtTime(point.value, point.time);
        else this.param.setValueAtTime(point.value, point.time);
      }
  }
}
interface Voice {
  id: string;
  start: number;
  end: number;
  source: OscillatorNode | AudioBufferSourceNode;
  pitchScale: number;
  amplitudeScale: number;
  gain: GainNode;
  amplitude: Automation;
  pitch: Automation;
  detune: Automation;
}
export interface NativeSinkOptions {
  /** Explicit timbre choice; a callback can choose separately for each part/voice. */
  voicePreset?: VoicePreset | ((voice: string) => VoicePreset);
  sampleBase?: string;
  sampleBases?: Partial<Record<GuitarPreset, string>>;
  /** Banks needed by a per-voice preset callback; defaults to legacy Guitar 1. */
  samplePresets?: readonly GuitarPreset[];
  sampleLoader?: GuitarSampleLoader;
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
  private sampleBanks = new Map<GuitarPreset, GuitarSampleBank>();
  private sampleRequests = new Map<GuitarPreset, Promise<void>>();
  private attacks = new Map<string, number>();
  private voices = new Set<Voice>();
  constructor(private options: NativeSinkOptions = {}) {
    this.context = options.context;
    this.setVolume(options.volume ?? 1);
    if (options.destination && options.context !== options.destination.context)
      throw new Error('Destination must belong to the supplied context.');
  }
  /** The host pauses before switching; subsequent attacks use the new preset. */
  setVoicePreset(
    preset: NativeSinkOptions['voicePreset'],
    samplePresets?: readonly GuitarPreset[],
  ): void {
    this.live();
    this.options.voicePreset = preset;
    this.options.samplePresets = samplePresets;
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
    const preset = this.options.voicePreset;
    const required =
      typeof preset === 'function'
        ? (this.options.samplePresets ?? ['guitar' as const])
        : isGuitarPreset(preset)
          ? [preset]
          : [];
    await Promise.all(required.map((id) => this.prepareSamples(id)));
    this.live();
  }
  private prepareSamples(preset: GuitarPreset): Promise<void> {
    if (this.sampleBanks.has(preset)) return Promise.resolve();
    const pending = this.sampleRequests.get(preset);
    if (pending) return pending;
    const request = (async () => {
      const bank = await (this.options.sampleLoader
        ? this.options.sampleLoader(this.context!, preset)
        : loadGuitarSamples(
            this.context!,
            this.options.sampleBases?.[preset] ??
              (preset === 'guitar' ? this.options.sampleBase : undefined),
            preset,
          ));
      this.live();
      if (!bank.samples.length) throw new Error('The guitar pack contains no samples.');
      this.sampleBanks.set(preset, bank);
    })();
    this.sampleRequests.set(preset, request);
    void request.then(
      () => this.sampleRequests.delete(preset),
      () => this.sampleRequests.delete(preset),
    );
    return request;
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
    v.source.stop(time + TAIL);
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
      if (event.kind === 'attack') {
        const preset =
          typeof this.options.voicePreset === 'function'
            ? this.options.voicePreset(event.voice)
            : this.options.voicePreset;
        if (isGuitarPreset(preset) && !this.sampleBanks.has(preset))
          throw new Error('Guitar samples are not ready; call unlock first.');
      }
      if (
        (event.kind === 'attack' || event.kind === 'pitch') &&
        (!Number.isFinite(event.hz) || event.hz <= 0)
      )
        throw new RangeError('Invalid frequency.');
      if (
        (event.kind === 'attack' || (event.kind === 'pitch' && event.velocity !== undefined)) &&
        (typeof event.velocity !== 'number' ||
          !Number.isFinite(event.velocity) ||
          event.velocity < 0 ||
          event.velocity > 1)
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
        const preset =
          typeof this.options.voicePreset === 'function'
            ? this.options.voicePreset(event.voice)
            : this.options.voicePreset;
        let source: OscillatorNode | AudioBufferSourceNode;
        let pitchParam: AudioParam;
        let pitchScale = 1;
        let amplitudeScale = 0.2;
        if (isGuitarPreset(preset)) {
          const bank = this.sampleBanks.get(preset);
          if (!bank) throw new Error('Guitar samples are not ready; call unlock first.');
          const attack = this.attacks.get(event.voice) ?? 0;
          const sample = selectGuitarSample(bank.samples, event.hz, event.velocity, attack);
          this.attacks.set(event.voice, attack + 1);
          const bufferSource = context.createBufferSource();
          bufferSource.buffer = sample.buffer;
          // Re-pitch this same source for legato; never restart its attack envelope.
          pitchScale = 1 / (440 * 2 ** ((sample.midi - 69) / 12));
          pitchParam = bufferSource.playbackRate;
          amplitudeScale = bank.gain ?? 0.65;
          source = bufferSource;
        } else {
          const oscillator = context.createOscillator();
          oscillator.type = event.timbre?.includes('harmonic') ? 'triangle' : 'sine';
          pitchParam = oscillator.frequency;
          source = oscillator;
        }
        const gain = context.createGain();
        source.connect(gain);
        gain.connect(this.destination());
        voice = {
          id: event.voice,
          start: time,
          end: Infinity,
          source,
          pitchScale,
          amplitudeScale,
          gain,
          amplitude: new Automation(gain.gain, 0, context),
          pitch: new Automation(pitchParam, event.hz * pitchScale, context),
          detune: new Automation(source.detune, 0, context),
        };
        const next = [...this.voices]
          .filter((v) => v.id === event.voice && v.start > time && v.end > v.start)
          .sort((a, b) => a.start - b.start)[0];
        this.voices.add(voice);
        voice.pitch.set(time, event.hz * pitchScale);
        voice.detune.set(time, 0);
        voice.amplitude.set(time, event.velocity * voice.amplitudeScale, TAIL);
        const ownedVoice = voice;
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
          this.voices.delete(ownedVoice);
        };
        source.start(time);
        if (next) this.releaseVoice(voice, next.start);
      } else if (voice) {
        if (event.kind === 'release') this.releaseVoice(voice, time);
        else if (event.kind === 'pitch') {
          voice.pitch.set(
            time,
            event.hz * voice.pitchScale,
            Math.min(event.rampSeconds ?? 0, voice.end - time),
          );
          if (event.velocity !== undefined)
            voice.amplitude.set(time, event.velocity * voice.amplitudeScale, TAIL);
          // Preserve the attack's patch/sample across legato.
        } else
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
        voice.source.stop(time);
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
      v.source.stop(this.now());
      v.source.disconnect();
      v.gain.disconnect();
      v.source.onended = null;
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
