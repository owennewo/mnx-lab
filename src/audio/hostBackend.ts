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
 *
 * Layers (roadmap/inprogress/studio-mix-layers.md): the synth's notes and the click on every
 * beat each have a level under the master (`setLayers`); a port that can set them hears the
 * click scheduled always and switched by its level, so it comes in on the beat it is turned on.
 * While a recording leads, `followMedia` plays the same notes and beats along the recording's clock
 * instead (src/audio/mediaFollow.ts), on this host, its routing and its part mix.
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
import { beatGrid, documentMeter, type Beat } from './practice.ts';
import { MediaFollower, mediaWarp, warpNotes, type FollowEvents, type MediaReading } from './mediaFollow.ts';
import type { RecordingSyncMap } from './recordingSync.ts';

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
  /** Optional: the host time being heard now, as the platform measures it at the speaker
   *  (AudioContext.getOutputTimestamp, interpolated: smooth between the audio clock's steps),
   *  or undefined where it cannot say. Preferred over `latency()`, which is only what the
   *  platform reports: on a phone or tablet under a large buffer that was 40 ms against a
   *  measured second (roadmap core-synth-performance). */
  heard?(): number | undefined;
  /** Optional: a metronome click at host time `at` — the click layer's beat, or a count-in's
   *  (`countIn`, heard whatever the click layer's level). A cancel takes back those not yet heard,
   *  as it does notes. Without it a practice counts in silently. */
  click?(at: number, accent: boolean, countIn?: boolean): void;
  /** Optional: the synth's and the click's levels under the master, 0–1. */
  setLevels?(levels: { synth: number; click: number }): void;
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
  /** A monotonic clock in seconds, read with each media reading while following (default: the page's). */
  monotonic?: () => number;
}
/** What the synth follows while a recording leads: the media's clock, and its sync. */
export interface FollowSource {
  read(): MediaReading | null;
  readonly sync: RecordingSyncMap;
  /** How far the recording sounds from the score's pitch, in cents: the synth plays along that far
   *  from its own (a player tuned off concert pitch, as the recording's provenance says). Default 0. */
  readonly tuningCents?: number;
}
/** The layers this host plays: the synth's notes, and the click with its level. */
export interface HostLayers { synth: boolean; click: boolean; clickLevel: number }

/** The stream's controls are its tempo changes (contractStream.ts). */
type Tempo = { id: string; at: number; type: 'tempo'; bpm: number };
/** A visit as the host plays it: score seconds `vs`–`ve`, from transport time `va`, at `speed`; `cut`: a loop's, its notes cut at `ve`. */
interface Visit { k: number; vs: number; ve: number; va: number; speed: number; cut: boolean; started: boolean; emitted: Set<string>;
  /** Its clicks in transport time, and how many are sent. */
  clicks: { at: number; accent: boolean; countIn: boolean }[]; clicked: number }
interface Plan {
  gen: number;
  /** The transport's visit (`Transport.planned`) being supplied. */
  index: number;
  visit: Visit;
  cursor: number;
  controlCursor: number;
  /** Transport time the host has been supplied through. */
  through: number;
  done: boolean;
}

const LEAD = 0.25, AHEAD = 1, MAX_WRAPS = 10000;
/** A clicked note is one note, not a stream to keep invariant: it needs only to clear the
 *  plucked instrument's commit horizon (0.1 s, synth/docs/contract.md D15), not the transport's lead. */
const AUDITION_LEAD = 0.12;
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
  /** Every beat, and its synth second. */
  private beats: (Beat & { seconds: number })[] = [];
  private layers: HostLayers = { synth: true, click: false, clickLevel: 1 };
  private readonly timers: Pick<Clock, 'setTimeout' | 'clearTimeout'>;
  private readonly monotonic: () => number;
  private following: { source: FollowSource; follower: MediaFollower; timer: unknown } | undefined;
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
  /** The clock follows the port's measured `heard()` (else the reported latency), and never runs back. */
  private measured = false;
  private last = -Infinity;
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
  /** When the last clicked note has rung out and the host may idle (`audition`). */
  private auditionTimer: unknown;
  constructor(performance: Performance, document: MnxStructure, private readonly port: HostPort,
    options: HostBackendOptions, private readonly onEvent: (event: TransportEvent) => void) {
    this.performance = performance;
    this.document = document;
    this.mix = options.partMix ?? {};
    this.volume = options.volume ?? 0.7;
    this.lead = options.leadSeconds ?? LEAD;
    this.ahead = options.aheadSeconds ?? AHEAD;
    const timers = this.timers = options.timers ?? globalTimers;
    this.monotonic = options.monotonic ?? (() => globalThis.performance.now() / 1000);
    this.clock = {
      now: () => {
        if (this.frozen === undefined) {
          const heard = this.port.heard?.();
          let now: number;
          this.measured = heard !== undefined;
          if (heard !== undefined) now = heard - this.lead;
          else {
            const rendered = this.port.now() - this.lead;
            if (rendered - this.latency <= this.hold) this.latency = Math.max(0, this.port.latency?.() || 0);
            now = rendered - this.latency;
          }
          // A fresh output timestamp can land a little behind the last interpolation: audio
          // time does not run back.
          this.frozen = this.last = Math.max(now, this.hold, this.last);
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
    this.port.setLevels?.({ synth: 1, click: 0 });
    // The host gets ready while the score is read, not on play.
    void this.port.preload?.().catch(() => {});
    // Strain matters only while playing and sounding — from the first note plus one report
    // window (half a second) — and clears when playback stops.
    this.port.watchLoad?.(report => {
      if (playbackTrace.active) {
        const heard = this.port.heard?.();
        playbackTrace.load(report, this.port.now() - this.audibleAt, heard === undefined ? undefined : this.port.now() - heard);
      }
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
    this.beats = beatGrid(this.performance, documentMeter(this.performance, this.document))
      .map(b => ({ ...b, seconds: this.stream.secondsAt(b.position) }));
    this.port.configure(this.routed.setup);
  }
  /** The click's beats are sent while the click is on — and always where the port's levels
   *  switch it, so turning it on mid-play is heard from the next beat. */
  private get clicking() { return this.layers.click || this.port.setLevels !== undefined; }
  private makeTransport(performance: Performance) {
    const transport = new Transport(performance, this.clock, this.sink, { lookaheadSeconds: TRANSPORT_LOOKAHEAD, onEvent: event => {
      if (this.closed || transport !== this.live) return;
      if (event.kind === 'state') this.follow();
      this.onEvent(event);
      if (event.kind === 'state') for (const listener of this.listeners) listener();
    } });
    return transport;
  }

  /** After every transport state frame: re-plan after a restart, else keep the host supplied. */
  private follow() {
    const snapshot = this.live.snapshot, wasPlaying = this.plan !== undefined;
    if (this.dirty || (snapshot.state === 'playing' && !this.plan)) {
      this.dirty = false;
      // Paused and still paused (a seek, a rate), playback has nothing sounding — its pause
      // silenced it — so a clicked note (`audition`) is left to ring rather than cut by the seek it made.
      if (wasPlaying || snapshot.state === 'playing') this.port.cancel({ from: this.port.now(), silence: true });
      this.plan = snapshot.state === 'playing' ? this.newPlan(snapshot.position) : undefined;
    }
    // At the end of the piece the transport stops by itself: what is scheduled plays out.
    if (snapshot.state !== 'playing') {
      if (wasPlaying) { this.port.idle?.(); this.endTrace(); }
      this.plan = undefined; this.strain.reset(); return;
    }
    if (this.plan && !this.plan.done && this.plan.through - this.rendered() < this.ahead / 2) this.topUp(this.plan);
  }
  private newPlan(position: Performance['sounding'][number]['position']): Plan {
    // The frozen clock is the transport's anchor time: restart() read it, then pumped and emitted.
    const audio = this.clock.now(), score = this.stream.secondsAt(position);
    this.underrunBase = undefined;
    if (playbackTrace.on) {
      if (playbackTrace.active) playbackTrace.end();
      playbackTrace.begin(documentTitle(this.document) || globalThis.document?.title || 'piece');
      void this.port.profile?.('start').catch(() => {});
    }
    const visit = this.visitFor(0)!;
    // A count-in is silence to the host: what it plays starts after it.
    this.audibleAt = visit.va + this.lead;
    return { gen: ++this.generation, index: 0, visit, cursor: firstAt(this.notes, score), controlCursor: firstAt(this.tempos, score), through: audio, done: false };
  }
  /** The transport's visit `index` as the host plays it, or undefined past the last. */
  private visitFor(index: number): Visit | undefined {
    const v = this.live.planned(index);
    if (!v) return undefined;
    const vs = this.stream.secondsAt(v.from), ve = this.stream.secondsAt(v.until);
    const clicks = [...v.countClicks.map(c => ({ at: c.audio, accent: c.accent, countIn: true })),
      ...(this.clicking ? this.beats.filter(b => b.seconds >= vs && b.seconds < ve)
        .map(b => ({ at: v.audio + (b.seconds - vs) / v.rate, accent: b.accent, countIn: false })) : [])];
    return { k: v.k < 0 ? 0 : v.k, vs, ve, va: v.audio, speed: v.rate, cut: v.looped, started: false, emitted: new Set(), clicks, clicked: 0 };
  }
  private bpmAt(seconds: number) {
    let bpm = 120;
    for (const c of this.tempos) if (c.at <= seconds) bpm = c.bpm;
    return bpm;
  }
  /** The transport time the host is rendering: the supply runs ahead of that, not of what is heard. */
  private rendered() {
    const now = this.clock.now();
    return this.measured ? Math.max(now, this.port.now() - this.lead) : now + this.latency;
  }
  /** Supply the host from where the plan stands to `ahead` past now. */
  private topUp(p: Plan) {
    const to = this.rendered() + this.ahead, notes: Note[] = [], controls: Control[] = [];
    const host = (v: Visit, seconds: number) => v.va + (seconds - v.vs) / v.speed + this.lead;
    let wraps = 0;
    for (;;) {
      const v = p.visit;
      if (!v.started) {
        v.started = true;
        // Tempo-synced effects need the tempo in force where the visit starts.
        controls.push({ id: `tempo:${p.gen}.${v.k}`, at: v.va + this.lead, type: 'tempo', bpm: this.bpmAt(v.vs) * v.speed });
        if (p.index === 0)
          for (const n of this.notes) {
            if (n.at >= v.vs) break;
            if (n.at + n.duration > v.vs) notes.push(this.sustained(n, v, p, host(v, v.vs)));
          }
      }
      for (; v.clicked < v.clicks.length && v.clicks[v.clicked]!.at < to; v.clicked++) {
        const c = v.clicks[v.clicked]!;
        this.port.click?.(c.at + this.lead, c.accent, c.countIn);
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
        if (c.at > v.vs) controls.push({ ...c, id: `${c.id}:${p.gen}.${v.k}`, at: host(v, c.at), bpm: c.bpm * v.speed });
      }
      const end = v.va + (v.ve - v.vs) / v.speed;
      if (full || end >= to || v.clicked < v.clicks.length) break;
      const next = this.visitFor(p.index + 1);
      if (!next) { p.done = true; break; }
      if (++wraps > MAX_WRAPS) throw new RangeError('Too many loop wraps in one scheduling window.');
      p.index++;
      p.visit = next;
      p.cursor = firstAt(this.notes, next.vs);
      p.controlCursor = firstAt(this.tempos, next.vs);
    }
    p.through = to;
    this.port.schedule({ notes, controls, through: to + this.lead });
  }
  /** A note in a visit, retimed for the rate; cut at a loop's end. */
  private placed(n: Note, p: Pick<Plan, 'gen'>, v: Visit, at: number): Note {
    const end = v.cut ? Math.min(n.at + n.duration, v.ve) : n.at + n.duration;
    const kept = (end - n.at) / n.duration;
    const techniques = (n.techniques ?? []).flatMap((t): Technique[] => {
      if (t.type === 'legato') return v.emitted.has(t.from as string) ? [{ ...t, from: `${t.from}:${p.gen}.${v.k}` } as Technique] : [];
      if (t.type === 'vibrato') return [{ ...t, rateHz: (t.rateHz as number) * v.speed, ...(typeof t.start === 'number' ? { start: Math.min(1, t.start / kept) } : {}),
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
    return { ...rest, id: `${n.id}:${p.gen}.${v.k}`, at, duration: Math.max(1e-4, (end - n.at) / v.speed), ...(techniques.length ? { techniques } : {}) };
  }
  /** A note already sounding where play starts: struck again there, for what is left of it. */
  private sustained(n: Note, v: Visit, p: Plan, at: number): Note {
    const end = Math.min(n.at + n.duration, v.ve);
    const techniques = (n.techniques ?? []).filter(t => t.type === 'mute' || t.type === 'harmonic');
    v.emitted.add(n.id);
    const { techniques: _, ...rest } = n;
    return { ...rest, id: `${n.id}:${p.gen}.${v.k}`, at, duration: Math.max(1e-4, (end - v.vs) / v.speed), ...(techniques.length ? { techniques } : {}) };
  }

  /**
   * Sound one written note on its own, as playback sounds it on that visit (roadmap:
   * core-note-audition): its pitch on its string with the part's sound, for its whole tie,
   * retimed for the rate. Stopped or paused only — playing, a press is a seek, and a note
   * over the music is noise. A newer press, or play, silences it. False when the note
   * makes no sound on that visit.
   */
  audition(noteKey: string, ordinal: number): boolean {
    if (this.closed || this.live.snapshot.state === 'playing') return false;
    const ids = new Set(this.performance.written.find(w => w.noteKey === noteKey && w.ordinal === ordinal)?.soundingIds ?? []);
    const notes = this.notes.filter(n => ids.has(n.id));
    if (!notes.length) return false;
    const speed = this.live.snapshot.rate, gen = ++this.generation;
    this.clock.clearTimeout(this.auditionTimer);
    void this.port.unlock().then(() => {
      // Play, or a newer press, got there first.
      if (this.closed || gen !== this.generation || this.live.snapshot.state === 'playing') return;
      const first = Math.min(...notes.map(n => n.at)), at = this.port.now() + AUDITION_LEAD;
      const visit: Visit = { k: 0, vs: first, ve: Infinity, va: at, speed, cut: false, started: true, emitted: new Set(), clicks: [], clicked: 0 };
      const plan = { gen };
      const placed = notes.map(n => this.placed(n, plan, visit, at + (n.at - first) / speed));
      const end = Math.max(...placed.map(n => n.at + n.duration));
      this.port.cancel({ from: this.port.now(), silence: true });
      this.port.schedule({ notes: placed, controls: [{ id: `tempo:${gen}.audition`, at, type: 'tempo', bpm: this.bpmAt(first) * speed }], through: end + AUDITION_LEAD });
      // Rung out: the host may stop computing silence, as after a stop.
      this.auditionTimer = this.clock.setTimeout(() => {
        if (!this.closed && gen === this.generation && this.live.snapshot.state !== 'playing') this.port.idle?.();
      }, Math.max(0, end - this.port.now()) * 1000);
    }, () => {});
    return true;
  }

  /** From a user gesture: the host's audio running, before a recording it follows starts. */
  wake() { return this.port.unlock(); }
  /** The synth's notes and the click, on or off, and the click's level. */
  setLayers(layers: HostLayers) {
    if (this.closed) return;
    this.layers = { ...layers };
    this.port.setLevels?.({ synth: layers.synth ? 1 : 0, click: layers.click ? layers.clickLevel : 0 });
  }

  /**
   * Play along with a recording while it leads (null: stop). Its clock is read every 25 ms;
   * the notes and the beats are moved onto its timeline through its sync, once per call — so
   * a new sync, or a new performance, is a new call.
   */
  followMedia(source: FollowSource | null) {
    if (this.closed) return;
    if (!source) {
      if (!this.following) return;
      this.timers.clearTimeout(this.following.timer);
      this.following.follower.stop();
      this.following = undefined;
      return;
    }
    const events = this.followEvents(source.sync, source.tuningCents ?? 0);
    if (this.following) { this.following.source = source; this.following.follower.replace(events); return; }
    const port = this.port;
    const follower = new MediaFollower({
      now: () => port.now(), schedule: batch => port.schedule(batch), cancel: c => port.cancel(c), idle: () => port.idle?.(),
      unlock: () => port.unlock(), click: (at, accent) => port.click?.(at, accent),
      // What lies between rendering and the speaker, measured where the browser can say, as the
      // synth's own clock reads it (heard(), else the reported latency).
      latency: () => { const heard = port.heard?.(); return heard !== undefined ? port.now() - heard : port.latency?.() ?? 0; },
    }, events);
    const tick = () => {
      const following = this.following;
      if (this.closed || !following) return;
      following.follower.tick(this.monotonic(), following.source.read());
      following.timer = this.timers.setTimeout(tick, 25);
    };
    this.following = { source, follower, timer: undefined };
    tick();
  }
  private followEvents(sync: RecordingSyncMap, tuningCents: number): FollowEvents {
    const warp = mediaWarp(this.performance, this.stream.secondsAt, sync);
    // The synth takes a fractional pitch (mnx-sound/2's target.pitch is a number): the recording's tuning
    // moves every pitched note, and leaves a kit's pieces where they are.
    const notes = tuningCents ? this.notes.map(n => 'pitch' in n.target ? { ...n, target: { pitch: n.target.pitch + tuningCents / 100 } } : n) : this.notes;
    const clicks = this.clicking ? this.beats.flatMap(b => {
      const at = sync.secondsAt({ ordinal: b.ordinal, metricOffset: b.metricOffset });
      return at.ok ? [{ at: at.value, accent: b.accent }] : [];
    }) : [];
    return { notes: warpNotes(notes, warp), clicks,
      bpmAt: media => { const synth = warp.toSynth(media); return synth === null ? 120 : this.bpmAt(synth) / warp.slope(synth); } };
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
      else if (carried.state === 'paused') next.pause();
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
    this.followMedia(null);
    this.closed = true;
    this.clock.clearTimeout(this.auditionTimer);
    this.listeners.clear();
    this.live.dispose();
    this.port.cancel({ from: this.port.now(), silence: true });
    this.port.dispose();
  }
}
