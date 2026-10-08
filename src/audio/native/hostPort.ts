/**
 * The browser's HostPort (src/audio/hostBackend.ts): an AudioContext, a master gain and the
 * synth's InstrumentHost. The host is loaded at run time from the synth's shell (`/synth/`,
 * built by vite.config.ts `synthShell`), not bundled: its AudioWorklet module and DSP assets
 * resolve against its own URL there, the same files the synth app plays.
 */
import type { Control, Diagnostic, InstrumentHost, Note, Setup } from '@mnx-lab/synth';
import type { HostPort } from '../hostBackend.ts';

type HostModule = typeof import('@mnx-lab/synth');
export interface NativeHostPortOptions {
  /** Where the synth's shell is served; its host module is `<base>host/index.js`. */
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
  private setup: Setup | undefined;
  private volume: number;
  private disposed = false;
  constructor(private readonly options: NativeHostPortOptions = {}) { this.volume = options.volume ?? 1; }
  now() { return this.context?.currentTime ?? 0; }
  async unlock() {
    if (this.disposed) throw new Error('The synth host is disposed.');
    // The context is made inside the gesture; loading the host may take longer than one.
    const context = this.context ??= (this.options.createContext ?? (() => new AudioContext()))();
    this.loading ??= this.load(context);
    try { await this.loading; } catch (error) { this.loading = undefined; throw error; }
    if (context.state !== 'running') await context.resume();
  }
  private async load(context: AudioContext) {
    // Absolute: the host resolves its data files against this base.
    const base = new URL(this.options.base ?? '/synth/', location.href).href;
    const module = await import(/* @vite-ignore */ `${base}host/index.js`) as HostModule;
    const host = await module.InstrumentHost.create(context, { assets: await module.loadHostAssets(`${base}generated/`) });
    if (this.disposed) { host.dispose(); return; }
    this.output = new GainNode(context, { gain: this.volume });
    this.output.connect(context.destination);
    host.connect(this.output);
    host.on('diagnostic', (d: Diagnostic) => this.options.onDiagnostic?.(d));
    host.on('error', (e: unknown) => this.options.onError?.(String((e as { message?: unknown })?.message ?? e)));
    if (this.setup) await host.configure(this.setup);
    this.host = host;
  }
  configure(setup: Setup) { this.setup = setup; void this.host?.configure(setup).catch(this.reject); }
  schedule(batch: { notes?: Note[]; controls?: Control[]; through?: number }) { void this.host?.schedule(batch).catch(this.reject); }
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
    this.host?.dispose();
    this.output?.disconnect();
    void this.context?.close().catch(() => {});
  }
}
