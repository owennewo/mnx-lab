/**
 * The browser's HostPort (src/audio/hostBackend.ts): an AudioContext, a master gain and the
 * synth's InstrumentHost.
 *
 * Ready before play. A page may make an AudioContext without a gesture: it starts suspended,
 * and the worklet loads, configures and warms up in it all the same (checked in Chrome with
 * its desktop autoplay policy). So `preload` — called as the score opens — does everything
 * but sound, and play only resumes the context. Where the page may already play (a tap
 * opened the piece) the prepared context is suspended again until play, and it is suspended
 * a few seconds after playback stops (`idle`): a silent host still computes every block,
 * which a phone pays for in battery. The host is loaded at run time from the synth's shell (`/synth/`,
 * built by vite.config.ts `synthShell`), not bundled: its AudioWorklet module and DSP assets
 * resolve against its own URL there, the same files the synth app plays.
 */
import type { Control, Diagnostic, HostAssets, InstrumentHost, Note, Setup } from '@mnx-lab/synth';
import type { HostPort } from '../hostBackend.ts';
import type { LoadReport } from '../hostStrain.ts';
import type { FactoryDesign } from '../hostInstruments.ts';
import { playbackTrace } from '../playbackTrace.ts';

type HostModule = typeof import('@mnx-lab/synth');
/** Where the synth's runtime is served (its `host/`, `generated/` and `data/`): the site's
 *  synth shell by default; the embed sets it beside its own script, a library host wherever
 *  it serves the files. Relative URLs resolve against the page. */
let synthBase = '/synth/';
export function setSynthBase(base: string) { synthBase = base.endsWith('/') ? base : `${base}/`; }
/** One download and compile of the host and its DSP per page and base, shared by every player. */
const fetched = new Map<string, Promise<{ module: HostModule; assets: HostAssets }>>();
/** Players that prepare their audio before play. A page of many players (the review page)
 *  prepares the first few; the rest prepare when played — each would be a context and a worklet. */
const EAGER_PORTS = 2;
let eagerPorts = 0;
/** Seconds after playback stops before the context is suspended (tails and the room ring out). */
const IDLE_SECONDS = 3;
export interface NativeHostPortOptions {
  /** Where the synth's runtime is served (default: `setSynthBase`); its host module is `<base>host/index.js`. */
  base?: string;
  volume?: number;
  createContext?: () => AudioContext;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  /** The host failed (a worklet error, a rejected request). */
  onError?: (message: string) => void;
}

export class NativeHostPort implements HostPort {
  private context: AudioContext | undefined;
  private output: GainNode | undefined;
  private host: InstrumentHost | undefined;
  private loading: Promise<void> | undefined;
  private fetching: Promise<{ module: HostModule; assets: HostAssets }> | undefined;
  private setup: Setup | undefined;
  private volume: number;
  private disposed = false;
  private loadListener: ((report: LoadReport) => void) | undefined;
  /** Play has been asked for since the last idle: the prepared context stays running. */
  private wanted = false;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  /** The master limiter delays everything the host plays by its look-ahead. */
  private lookahead = 0;
  constructor(private readonly options: NativeHostPortOptions = {}) { this.volume = options.volume ?? 1; }
  now() { return this.context?.currentTime ?? 0; }
  /** The browser's word for what lies between the worklet and the speaker — its own buffer
   *  (baseLatency) and the system's and device's (outputLatency, which Safari may not give) —
   *  plus the limiter's look-ahead. Only a running context reports the device's. */
  latency() {
    const context = this.context as (AudioContext & { outputLatency?: number }) | undefined;
    if (!context || context.state !== 'running') return 0;
    return (context.baseLatency || 0) + (context.outputLatency || 0) + this.lookahead;
  }
  /** The audio context and the master gain the host plays into, once unlocked. */
  get audio(): { context: AudioContext; output: GainNode } | undefined {
    return this.context && this.output ? { context: this.context, output: this.output } : undefined;
  }
  async unlock() {
    if (this.disposed) throw new Error('The synth host is disposed.');
    this.wanted = true;
    clearTimeout(this.idleTimer);
    const context = this.prepare();
    try { await this.loading; } catch (error) { this.loading = undefined; throw error; }
    if (context.state !== 'running') await context.resume();
  }
  /** The context and a configured, warm host (no gesture needed: the context starts suspended). */
  private prepare(): AudioContext {
    // Under a playback trace the output buffer can be chosen (playbackTrace.ts), for A/B on a device.
    const latencyHint = playbackTrace.latencyHint;
    const context = this.context ??= (this.options.createContext ?? (() => new AudioContext(latencyHint !== undefined ? { latencyHint } : {})))();
    this.loading ??= this.load(context).then(() => { if (!this.wanted && context.state === 'running') void context.suspend(); });
    return context;
  }
  /** Playback stopped: let tails ring out, then stop computing silence until play. */
  idle() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.disposed || !this.context || this.context.state !== 'running') return;
      this.wanted = false;
      void this.context.suspend();
    }, IDLE_SECONDS * 1000);
  }
  /** Fetch and compile the host and its DSP, then prepare it — everything but sound. */
  private eager = false;
  async preload() {
    if (this.disposed) return;
    this.fetchHost();
    await this.fetching;
    if (this.disposed || this.eager || eagerPorts >= EAGER_PORTS) return;
    this.eager = true;
    eagerPorts++;
    this.prepare();
    await this.loading;
  }
  private fetchHost() {
    // Absolute: the host resolves its data files against this base.
    const base = new URL(this.options.base ?? synthBase, location.href).href;
    let shared = fetched.get(base);
    if (!shared) {
      shared = (async () => {
        const module = await import(/* @vite-ignore */ `${base}host/index.js`) as HostModule;
        return { module, assets: await module.loadHostAssets(`${base}generated/`) };
      })();
      fetched.set(base, shared);
      const mine = shared;
      mine.catch(() => { if (fetched.get(base) === mine) fetched.delete(base); });
    }
    this.fetching ??= shared;
    this.fetching.catch(() => { this.fetching = undefined; });
  }
  private async load(context: AudioContext) {
    this.fetchHost();
    const { module, assets } = await this.fetching!;
    // Configuring warms the worklet (host-processor.js warm): play waits for it, so the
    // first beats do not pay for compiling the DSP.
    const host = await module.InstrumentHost.create(context, { assets });
    this.lookahead = module.MASTER_LOOKAHEAD_SECONDS || 0;
    playbackTrace.context(context);
    if (this.disposed) { host.dispose(); return; }
    this.output = new GainNode(context, { gain: this.volume });
    this.output.connect(context.destination);
    host.connect(this.output);
    host.on('diagnostic', (d: Diagnostic) => this.options.onDiagnostic?.(d));
    host.on('load', (load: { busy: number; peakMs: number; peakKind?: string; kinds?: LoadReport['kinds'] }) => {
      // Chrome counts output underruns where it can (AudioContext.playbackStats); elsewhere load alone.
      const counted = (context as AudioContext & { playbackStats?: { underrunEvents?: number } }).playbackStats?.underrunEvents;
      this.loadListener?.({ busy: load.busy, peakMs: load.peakMs, ...(typeof counted === 'number' ? { underrunsTotal: counted } : {}),
        ...(load.peakKind ? { peakKind: load.peakKind } : {}), ...(load.kinds ? { kinds: load.kinds } : {}) });
    });
    host.on('error', (e: unknown) => this.options.onError?.(String((e as { message?: unknown })?.message ?? e)));
    let configured: Setup | undefined;
    while (this.setup && configured !== this.setup) { configured = this.setup; await host.configure(configured); }
    this.host = host;
  }
  watchLoad(listener: (report: LoadReport) => void) { this.loadListener = listener; }
  profile(action: 'start' | 'snapshot') { return this.host ? this.host.profile(action) : Promise.resolve(undefined); }
  configure(setup: Setup) { this.setup = setup; void this.host?.configure(setup).catch(this.reject); }
  schedule(batch: { notes?: Note[]; controls?: Control[]; through?: number }) { clearTimeout(this.idleTimer); void this.host?.schedule(batch).catch(this.reject); }
  cancel(cancel: { from?: number; silence?: boolean }) { void this.host?.cancel(cancel).catch(this.reject); }
  setVolume(volume: number) {
    this.volume = volume;
    if (this.output && this.context) this.output.gain.setTargetAtTime(volume, this.context.currentTime, 0.01);
  }
  private readonly reject = (error: unknown) => {
    if (!this.disposed) this.options.onError?.(error instanceof Error ? error.message : String(error));
  };
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.eager) eagerPorts--;
    clearTimeout(this.idleTimer);
    this.host?.dispose();
    this.output?.disconnect();
    void this.context?.close().catch(() => {});
  }
}

/** The synth's factory guitar designs, as its shell serves them; Clear steel alone if that fails. */
export async function loadFactoryDesigns(base = synthBase): Promise<FactoryDesign[]> {
  try {
    const response = await fetch(new URL(`${base}data/instrument-v2/presets.json`, location.href));
    if (!response.ok) throw new Error(String(response.status));
    const presets = await response.json() as { id?: unknown; name?: unknown; family?: unknown }[];
    const designs = presets.filter(p => typeof p.id === 'string' && typeof p.name === 'string')
      .map(p => ({ id: p.id as string, name: p.name as string, ...(typeof p.family === 'string' ? { family: p.family } : {}) }));
    if (designs.length) return designs;
  } catch { /* the default stands in */ }
  return [{ id: 'clear-steel', name: 'Clear steel' }];
}
