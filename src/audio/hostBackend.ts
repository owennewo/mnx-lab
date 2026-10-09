/**
 * The synth's instrument host as a playback backend (roadmap/complete/core-campaign-synth.md,
 * Phase 5). Pure: the host and its audio context sit behind `HostPort`
 * (src/audio/native/hostPort.ts in the browser, the synth's HostCore under Node).
 *
 * The transport stays what it is for the old backend — position, highlights, loop, rate,
 * seek, the edit carry — but plays into a sink that makes no sound. Its clock runs `lead`
 * behind the host's, and the output's latency further still (what the host renders reaches
 * the speaker that much later: the browser's buffer, the system's, a Bluetooth link), so
 * what it reports is what is heard. Each restart it makes (play, seek, rate, loop) cancels
 * the sink; there the clock steps forward to the host's time and holds for the lead and the
 * latency — the cursor waits for the first note — and the backend silences the
 * host and plans afresh from the transport's anchor, sending contract notes (src/audio/contractStream.ts)
 * about a second ahead: past the plucked instrument's commit horizon (D15), and in
 * batches large enough that the worklet is not chattered at.
 *
 * Times: a note at score-second `s` in a visit that starts at score-second `vs` and
 * transport time `va` sounds at host time `va + (s − vs)/rate + lead`. A loop's visits
 * follow one another exactly, as the transport's do; notes crossing the loop's end are cut
 * there (the transport releases every voice at a visit's end). Note ids carry the plan's
 * generation and the visit, so a repeat is a new note, not an edit of one already played.
 */
import type { Control, Note, Setup, Technique } from '@mnx-lab/synth/contract';
import { Transport, type Clock, type TransportEvent } from './transport.ts';
import type { Sink } from './sink.ts';
import { SYNTH_CAPABILITIES, type BackendSnapshot, type PlaybackBackend, type ScoreLoop, type ScorePosition } from './playbackBackend.ts';
import { performancePositionAt, scorePositionAt } from './scorePosition.ts';
import { carryPlace } from './carryPlace.ts';
import type { Performance } from './performanceTypes.ts';
import { documentTitle, type MnxStructure } from '../model/mnx.ts';
import type { PartMix } from './partMix.ts';
import { performanceToStream, type ContractStream } from './contractStream.ts';
import { hostSetup, type HostSetup } from './hostSetup.ts';
import { StrainMonitor, type LoadReport } from './hostStrain.ts';
import { playbackTrace, type TraceProfile } from './playbackTrace.ts';
import { ZERO, compare } from './time.ts';

/** What the backend needs of an instrument host and its audio output. */
export interface HostPort {
  /** Host clock, seconds (the audio context's currentTime). */
  now(): number;
  /** From a user gesture: create or resume the audio, load the host. */
  unlock(): Promise<void>;
  configure(setup: Setup): void;
  schedule(batch: { notes?: Note[]; controls?: Control[]; through?: number }): void;
  cancel(cancel: { from?: number; silence?: boolean }): void;
  setVolume(volume: number): void;
  dispose(): void;
  /** Optional: get ready to play — fetch, compile, configure, warm — before play is pressed. */
  preload?(): Promise<void>;
  /** Optional: playback has stopped (the port may stop computing silence until the next unlock). */
  idle?(): void;
  /** How busy the host's audio thread is, as the worklet reports it (hostStrain.ts). */
  watchLoad?(listener: (report: LoadReport) => void): void;
  /** Optional: seconds from the host rendering a frame to it being heard, as the platform
   *  reports it (0 if it cannot say). */
  latency?(): number;
  /** Optional: the host's per-part cost metering, started at play and read at stop (playbackTrace.ts). */
  profile?(action: 'start' | 'snapshot'): Promise<unknown>;
}
export interface HostBackendOptions {
  volume?: number;
  partMix?: PartMix;
  /** Seconds between the transport's clock and the host's: past every commit horizon. */
  leadSeconds?: number;
  /** How far ahead of the transport the host is kept supplied. */
  aheadSeconds?: number;
  /** Timers for the transport's poll (defaults to the global ones). */
  timers?: Pick<Clock, 'setTimeout' | 'clearTimeout'>;
}

/** The stream's controls are its tempo changes (contractStream.ts). */
type Tempo = { id: string; at: number; type: 'tempo'; bpm: number };
interface Visit { k: number; vs: number; ve: number; va: number; started: boolean; emitted: Set<string> }
interface Plan {
  gen: number;
  speed: number;
  loop: { start: number; end: number } | undefined;
  visit: Visit;
  cursor: number;
  controlCursor: number;
  /** Transport time the host has been supplied through. */
  through: number;
  done: boolean;
}

const LEAD = 0.25, AHEAD = 1, MAX_WRAPS = 10000;
/** How far ahead the transport schedules into its silent sink. Its backlog guard restarts
 *  playback when the clock jumps past that (a tab that slept), and an audio clock steps a
 *  whole output chunk at a time: 170 ms and more under a large buffer or on Bluetooth, which
 *  the transport's 0.1 s default read as sleep, restarting about once a second. The sink
 *  makes no sound, so looking a second ahead costs nothing. */
const TRANSPORT_LOOKAHEAD = 1;
const globalTimers: Pick<Clock, 'setTimeout' | 'clearTimeout'> = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: handle => { if (handle !== undefined) globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>); },
};
/** First index in time-sorted items at or after `seconds`. */
function firstAt(items: readonly { at: number }[], seconds: number) {
  let lo = 0, hi = items.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (items[mid]!.at < seconds) lo = mid + 1; else hi = mid; }
  return lo;
}

export class HostBackend implements PlaybackBackend {
  readonly id = 'synth';
  readonly capabilities = SYNTH_CAPABILITIES;
  private live: Transport;
  private performance: Performance;
  private document: MnxStructure;
  private mix: PartMix;
  private volume: number;
  private stream!: ContractStream;
  private routed!: HostSetup;
  private notes: Note[] = [];
  private tempos: Tempo[] = [];
  private endSeconds = 0;
  private readonly lead: number;
  private readonly ahead: number;
  private readonly clock: Clock;
  private readonly sink: Sink;
  /** The transport's clock holds still for a synchronous turn, so a restart's cancel and
   *  its anchor read the same time (see `follow`). */
  private frozen: number | undefined;
  /** Where the clock holds after a restart, until the host's time is `lead` + `latency` past it. */
  private hold = -Infinity;
  /** The output latency the clock runs behind by. Read only while the clock holds: a
   *  reading that moved mid-play would jump the cursor, and one taken just as the audio
   *  starts may not be the device's yet. */
  private latency = 0;
  private dirty = false;
  private generation = 0;
  private plan: Plan | undefined;
  private closed = false;
  private listeners = new Set<() => void>();
  private readonly strain = new StrainMonitor();
  /** Host time the current plan's first note sounds: load before it (setting up the
   *  instruments, warming the first block) stalls only silence, so it is not strain. */
  private audibleAt = Infinity;
  /** The browser's underrun count when the current plan's reports began to count. */
  private underrunBase: number | undefined;
  constructor(performance: Performance, document: MnxStructure, private readonly port: HostPort,
    options: HostBackendOptions, private readonly onEvent: (event: TransportEvent) => void) {
    this.performance = performance;
    this.document = document;
    this.mix = options.partMix ?? {};
    this.volume = options.volume ?? 0.7;
    this.lead = options.leadSeconds ?? LEAD;
    this.ahead = options.aheadSeconds ?? AHEAD;
    const timers = options.timers ?? globalTimers;
    this.clock = {
      now: () => {
        if (this.frozen === undefined) {
          const now = this.port.now() - this.lead;
          if (now - this.latency <= this.hold) this.latency = Math.max(0, this.port.latency?.() || 0);
          this.frozen = Math.max(now - this.latency, this.hold);
          queueMicrotask(() => { this.frozen = undefined; });
        }
        return this.frozen;
      },
      setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    };
    this.sink = {
      now: () => this.clock.now(),
      unlock: () => this.port.unlock(),
      schedule: () => {},
      release: () => {},
      bend: () => {},
      // Called by every restart before it reads its anchor (and by pause, stop and dispose).
      cancel: () => {
        this.dirty = true;
        this.hold = this.port.now();
        this.frozen = this.hold;
        queueMicrotask(() => { this.frozen = undefined; });
      },
      dispose: () => {},
    };
    this.port.setVolume(this.volume);
    // The host gets ready while the score is read, not on play.
    void this.port.preload?.().catch(() => {});
    // Strain matters only while playing and sounding — from the first note plus one report
    // window (half a second) — and clears when playback stops.
    this.port.watchLoad?.(report => {
      if (playbackTrace.active) playbackTrace.load(report, this.port.now() - this.audibleAt);
      if (this.closed || this.live.snapshot.state !== 'playing' || this.port.now() < this.audibleAt + 0.5) return;
      // The browser counts underruns late: the first report that counts only sets the baseline,
      // so the start-up stall's (in silence) never count.
      const total = report.underrunsTotal;
      const underruns = total === undefined ? report.underruns : this.underrunBase === undefined ? 0 : Math.max(0, total - this.underrunBase);
      if (total !== undefined) this.underrunBase = total;
      if (this.strain.report({ busy: report.busy, peakMs: report.peakMs, ...(underruns === undefined ? {} : { underruns }) }, Date.now())) for (const listener of this.listeners) listener();
    });
    this.derive();
    this.live = this.makeTransport(performance);
  }
  /** The transport now playing; an edit replaces it (`replacePerformance`). */
  get transport() { return this.live; }
  /** Parts the host cannot play as written (a bass routed to keys, say). */
  get diagnostics() { return this.routed.diagnostics; }
  /** The setup the host is configured with. */
  get setup(): Setup { return this.routed.setup; }
  /** How each part is routed (the Instruments sheet says so). */
  get routing() { return this.routed.parts; }

  private route() {
    this.routed = hostSetup(this.performance, this.document, this.mix);
  }
  private derive() {
    this.route();
    this.stream = performanceToStream(this.performance, { partOf: this.routed.partOf, document: this.document });
    this.notes = [...this.stream.notes].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    this.tempos = (this.stream.controls as Tempo[]).filter(c => c.type === 'tempo').sort((a, b) => a.at - b.at);
    this.port.configure(this.routed.setup);
  }
  private makeTransport(performance: Performance) {
    const transport = new Transport(performance, this.clock, this.sink, { lookaheadSeconds: TRANSPORT_LOOKAHEAD, onEvent: event => {
      if (this.closed || transport !== this.live) return;
      if (event.kind === 'state') this.follow();
      this.onEvent(event);
      if (event.kind === 'state') for (const listener of this.listeners) listener();
    } });
    this.endSeconds = this.stream.secondsAt(transport.duration);
    return transport;
  }

  /** After every transport state frame: re-plan after a restart, else keep the host supplied. */
  private follow() {
    const snapshot = this.live.snapshot, wasPlaying = this.plan !== undefined;
    if (this.dirty || (snapshot.state === 'playing' && !this.plan)) {
      this.dirty = false;
      this.port.cancel({ from: this.port.now(), silence: true });
      this.plan = snapshot.state === 'playing' ? this.newPlan(snapshot.position, snapshot.rate) : undefined;
    }
    // At the end of the piece the transport stops by itself: what is scheduled plays out.
    if (snapshot.state !== 'playing') {
      if (wasPlaying) { this.port.idle?.(); this.endTrace(); }
      this.plan = undefined; this.strain.reset(); return;
    }
    if (this.plan && !this.plan.done && this.plan.through - this.rendered() < this.ahead / 2) this.topUp(this.plan);
  }
  private newPlan(position: Performance['sounding'][number]['position'], speed: number): Plan {
    // The frozen clock is the transport's anchor time: restart() read it, then pumped and emitted.
    const audio = this.clock.now(), score = this.stream.secondsAt(position);
    this.audibleAt = audio + this.lead;
    this.underrunBase = undefined;
    if (playbackTrace.on) {
      if (playbackTrace.active) playbackTrace.end();
      playbackTrace.begin(documentTitle(this.document) || globalThis.document?.title || 'piece');
      void this.port.profile?.('start').catch(() => {});
    }
    const region = this.live.loopRegion;
    const loop = region ? { start: this.stream.secondsAt(region.start), end: this.stream.secondsAt(region.end) } : undefined;
    return {
      gen: ++this.generation, speed, loop,
      visit: { k: 0, vs: score, ve: loop?.end ?? this.endSeconds, va: audio, started: false, emitted: new Set() },
      cursor: firstAt(this.notes, score), controlCursor: firstAt(this.tempos, score),
      through: audio, done: false,
    };
  }
  private bpmAt(seconds: number) {
    let bpm = 120;
    for (const c of this.tempos) if (c.at <= seconds) bpm = c.bpm;
    return bpm;
  }
  /** The transport time the host is rendering: the supply runs ahead of that, not of what is heard. */
  private rendered() { return this.clock.now() + this.latency; }
  /** Supply the host from where the plan stands to `ahead` past now. */
  private topUp(p: Plan) {
    const to = this.rendered() + this.ahead, notes: Note[] = [], controls: Control[] = [];
    const host = (v: Visit, seconds: number) => v.va + (seconds - v.vs) / p.speed + this.lead;
    let wraps = 0;
    for (;;) {
      const v = p.visit;
      if (!v.started) {
        v.started = true;
        // Tempo-synced effects need the tempo in force where the visit starts.
        controls.push({ id: `tempo:${p.gen}.${v.k}`, at: v.va + this.lead, type: 'tempo', bpm: this.bpmAt(v.vs) * p.speed });
        if (v.k === 0)
          for (const n of this.notes) {
            if (n.at >= v.vs) break;
            if (n.at + n.duration > v.vs) notes.push(this.sustained(n, p, v, host(v, v.vs)));
          }
      }
      let full = false;
      for (; p.cursor < this.notes.length; p.cursor++) {
        const n = this.notes[p.cursor]!;
        if (n.at >= v.ve) break;
        if (host(v, n.at) - this.lead >= to) { full = true; break; }
        notes.push(this.placed(n, p, v, host(v, n.at)));
      }
      for (; p.controlCursor < this.tempos.length; p.controlCursor++) {
        const c = this.tempos[p.controlCursor]!;
        if (c.at >= v.ve || host(v, c.at) - this.lead >= to) break;
        if (c.at > v.vs) controls.push({ ...c, id: `${c.id}:${p.gen}.${v.k}`, at: host(v, c.at), bpm: c.bpm * p.speed });
      }
      const end = v.va + (v.ve - v.vs) / p.speed;
      if (full || end >= to) break;
      if (!p.loop) { p.done = true; break; }
      if (++wraps > MAX_WRAPS) throw new RangeError('Too many loop wraps in one scheduling window.');
      p.visit = { k: v.k + 1, vs: p.loop.start, ve: p.loop.end, va: end, started: false, emitted: new Set() };
      p.cursor = firstAt(this.notes, p.loop.start);
      p.controlCursor = firstAt(this.tempos, p.loop.start);
    }
    p.through = to;
    this.port.schedule({ notes, controls, through: to + this.lead });
  }
  /** A note in a visit, retimed for the rate; cut at a loop's end. */
  private placed(n: Note, p: Plan, v: Visit, at: number): Note {
    const end = p.loop ? Math.min(n.at + n.duration, v.ve) : n.at + n.duration;
    const kept = (end - n.at) / n.duration;
    const techniques = (n.techniques ?? []).flatMap((t): Technique[] => {
      if (t.type === 'legato') return v.emitted.has(t.from as string) ? [{ ...t, from: `${t.from}:${p.gen}.${v.k}` } as Technique] : [];
      if (t.type === 'vibrato') return [{ ...t, rateHz: (t.rateHz as number) * p.speed, ...(typeof t.start === 'number' ? { start: Math.min(1, t.start / kept) } : {}),
        ...(typeof t.phase === 'number' ? { phase: t.phase } : {}) } as Technique];
      if (t.type === 'bend') {
        const points = (t.points as { at: number; cents: number }[]).map(q => ({ at: q.at / kept, cents: q.cents }));
        const inside = points.filter(q => q.at <= 1);
        return [{ type: 'bend', points: inside.length ? inside : [{ at: 0, cents: points[0]!.cents }] }];
      }
      return [t];
    });
    v.emitted.add(n.id);
    const { techniques: _, ...rest } = n;
    return { ...rest, id: `${n.id}:${p.gen}.${v.k}`, at, duration: Math.max(1e-4, (end - n.at) / p.speed), ...(techniques.length ? { techniques } : {}) };
  }
  /** A note already sounding where play starts: struck again there, for what is left of it. */
  private sustained(n: Note, p: Plan, v: Visit, at: number): Note {
    const end = Math.min(n.at + n.duration, v.ve);
    const techniques = (n.techniques ?? []).filter(t => t.type === 'mute' || t.type === 'harmonic');
    v.emitted.add(n.id);
    const { techniques: _, ...rest } = n;
    return { ...rest, id: `${n.id}:${p.gen}.${v.k}`, at, duration: Math.max(1e-4, (end - v.vs) / p.speed), ...(techniques.length ? { techniques } : {}) };
  }

  /** The mix moved: the parts' strips are reconfigured in place (no pause). */
  setPartMix(mix: PartMix) {
    if (this.closed) return;
    this.mix = mix;
    this.route();
    this.port.configure(this.routed.setup);
  }
  /** An edit: a new performance on the same host; the stream and setup are derived again and
   *  `carryPlace` decides where and whether playback continues. */
  replacePerformance(performance: Performance, document: MnxStructure = this.document) {
    if (this.closed) return;
    const before = this.live.snapshot, carried = carryPlace(before, this.performance, performance);
    this.live.dispose();
    this.performance = performance;
    this.document = document;
    this.plan = undefined;
    this.derive();
    const next = this.live = this.makeTransport(performance);
    next.setRate(before.rate);
    if (carried) {
      next.seek(carried.position);
      if (carried.state === 'playing') void next.play().catch(() => {});
      else next.pause();
    }
    this.follow();
    for (const listener of this.listeners) listener();
  }
  get snapshot(): BackendSnapshot {
    const transport = this.live.snapshot;
    const p = scorePositionAt(this.performance, transport.position);
    return { sourceId: this.id, kind: 'synth', state: transport.state, scorePosition: p.ok ? p.value : null,
      syncIssue: p.ok ? undefined : p.diagnostic.message, rate: transport.rate, volume: this.volume, hidePlayhead: false,
      highlight: transport.activeWritten.map(w => ({ noteKey: w.noteKey, ordinal: w.ordinal })), transport,
      ...(this.strain.strained ? { strained: true } : {}) };
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  prepare() { return Promise.resolve(); }
  async play() {
    if (this.live.snapshot.state === 'stopped' && compare(this.live.position, this.live.duration) >= 0) this.live.seek(ZERO);
    await this.live.play();
  }
  pause() { if (!this.closed) this.live.pause(); }
  stop() { if (!this.closed) this.live.stop(); }
  canSeek(position: ScorePosition, edge?: 'before' | 'after') {
    const result = performancePositionAt(this.performance, position, edge);
    return result.ok ? null : result.diagnostic.message;
  }
  seek(position: ScorePosition, edge?: 'before' | 'after') {
    const result = performancePositionAt(this.performance, position, edge);
    if (!result.ok) throw new Error(result.diagnostic.message);
    this.live.seek(result.value);
  }
  setRate(rate: number) { this.live.setRate(rate); return this.live.snapshot.rate; }
  setVolume(volume: number) { this.volume = volume; this.port.setVolume(volume); return volume; }
  setLoop(loop?: ScoreLoop) {
    if (!loop) { this.live.setLoop(); return; }
    const start = performancePositionAt(this.performance, loop.start), end = performancePositionAt(this.performance, loop.end);
    if (!start.ok || !end.ok) throw new Error(!start.ok ? start.diagnostic.message : !end.ok ? end.diagnostic.message : 'Invalid loop.');
    this.live.setLoop({ start: start.value, end: end.value });
  }
  /** The trace's run ends at stop, with the host's per-part profile where it has one. */
  private endTrace() {
    if (!playbackTrace.active) return;
    const snapshot = this.port.profile?.('snapshot');
    if (!snapshot) { playbackTrace.end(); return; }
    snapshot.then(p => playbackTrace.end((p ?? undefined) as TraceProfile | undefined), () => playbackTrace.end());
  }
  dispose() {
    if (this.closed) return;
    this.endTrace();
    this.closed = true;
    this.listeners.clear();
    this.live.dispose();
    this.port.cancel({ from: this.port.now(), silence: true });
    this.port.dispose();
  }
}
