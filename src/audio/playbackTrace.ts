/**
 * Playback trace (roadmap/proposed/core-synth-performance.md, the baseline): what the synth's
 * audio thread costs on a real device, play by play, so the first ten seconds can be told
 * apart from the rest and a change judged on the lead's phone and tablet.
 *
 * Off unless asked for: `?trace` turns it on and it stays on across reloads (one of the
 * baseline's runs reloads and waits before playing) until the panel's Off. Each play from
 * its first note records the worklet's twice-a-second load reports (hostStrain.ts), the
 * browser's underruns, the main thread's long tasks, and at stop the host's per-part
 * profile. A small panel sums each run up and copies every run as JSON. Runs are kept in
 * localStorage on the device; nothing is sent anywhere.
 *
 * Each report also says what the audio thread's time went on (rendering, or a message: a
 * schedule batch, a cancel, a configure) and which kind its longest stretch was. The
 * panel's Buffer buttons choose the AudioContext's latencyHint (roadmap step 2): the browser's
 * default, 'balanced' (the trace's own default) or 'playback', applied when the page reloads;
 * `?latency=` takes those or a number of seconds.
 */
import type { LoadReport } from './hostStrain.ts';

declare const __MNX_COMMIT__: string | undefined;
const KEY = 'mnx.playbackTrace';
const FLAG = 'mnx.playbackTrace.on';
const LATENCY = 'mnx.playbackTrace.latency';
/** Reports before the first note further than this are the start-up stall, not playback. */
const BEFORE_SECONDS = 2;
export const WINDOW_SECONDS = 10;

export interface TraceReport {
  t: number; busy: number; peakMs: number; underruns: number;
  /** The latency measured at the speaker (render to heard), ms, where the browser can say. */
  latencyMs?: number;
  /** What the longest stretch was, and the kinds with stretches over 8 ms (count). */
  peak?: string; long?: Record<string, number>;
}
export interface KindTotal { ms: number; max: number; long: number }
export interface TraceProfile { realTimeFactor?: number; parts?: Record<string, { kind: string; msPerAudioSecond: number }> }
export interface TraceRun {
  label: string;
  build: string;
  /** Seconds the page had been open when play was pressed, and the play's number on this page. */
  pageSeconds: number;
  playInPage: number;
  device: { userAgent: string; cores?: number; memoryGb?: number; sampleRate?: number; baseLatency?: number; outputLatency?: number; latencyHint?: string };
  /** Per kind over the run: total ms, longest stretch, stretches over 8 ms. */
  kinds?: Record<string, KindTotal>;
  reports: TraceReport[];
  longTasks: { count: number; ms: number };
  profile?: TraceProfile;
}
export interface WindowSummary { reports: number; busyMean: number; busyMax: number; peakMsMax: number; hot: number; underruns: number }

/** One window of a run: the reports with first ≤ t < last (seconds from the first note). Pure. */
export function summarise(reports: TraceReport[], first: number, last = Infinity): WindowSummary {
  const r = reports.filter(x => x.t >= first && x.t < last);
  return {
    reports: r.length,
    busyMean: r.length ? r.reduce((s, x) => s + x.busy, 0) / r.length : 0,
    busyMax: Math.max(0, ...r.map(x => x.busy)),
    peakMsMax: Math.max(0, ...r.map(x => x.peakMs)),
    // hostStrain.ts's thresholds for a hot report.
    hot: r.filter(x => x.busy > 0.7 || x.peakMs > 8 || x.underruns > 0).length,
    underruns: r.reduce((s, x) => s + x.underruns, 0),
  };
}
const pct = (x: number) => `${Math.round(x * 100)}%`;
const line = (name: string, w: WindowSummary) => w.reports
  ? `${name}: busy ${pct(w.busyMean)} mean, ${pct(w.busyMax)} max · longest ${w.peakMsMax.toFixed(1)} ms · hot ${w.hot}/${w.reports} · underruns ${w.underruns}`
  : `${name}: no reports`;
/** The kinds' stretches over 8 ms in one window, most first: "schedule 3, render 1". Pure. */
export function longByKind(reports: TraceReport[], first: number, last = Infinity): string {
  const counts: Record<string, number> = {};
  for (const r of reports) if (r.t >= first && r.t < last) for (const [k, n] of Object.entries(r.long ?? {})) counts[k] = (counts[k] ?? 0) + n;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
}
/** A run as a few lines of text. Pure. */
export function describe(run: TraceRun, index: number): string {
  const parts = Object.entries(run.profile?.parts ?? {}).map(([id, p]) => `${id} (${p.kind}) ${p.msPerAudioSecond.toFixed(1)} ms/s`).join(', ');
  const kinds = Object.entries(run.kinds ?? {}).sort((a, b) => b[1].max - a[1].max).map(([k, v]) => `${k} ${v.max.toFixed(0)} ms`).join(', ');
  const measured = run.reports.map(r => r.latencyMs).filter((x): x is number => x !== undefined).sort((a, b) => a - b);
  const reported = run.device.outputLatency !== undefined ? `output ${Math.round(run.device.outputLatency * 1000)} ms reported` : '';
  const heard = measured.length ? `${measured[measured.length >> 1]} ms measured` : '';
  const buffer = `buffer ${run.device.latencyHint ?? 'default'}${reported || heard ? ` (${[reported, heard].filter(Boolean).join(', ')})` : ''}`;
  return [
    `Run ${index + 1}: ${run.label} — play ${run.playInPage} on the page, ${run.pageSeconds.toFixed(0)} s after it opened, ${buffer}`,
    `  ${line(`first ${WINDOW_SECONDS} s`, summarise(run.reports, 0, WINDOW_SECONDS))}`,
    `  ${line('after', summarise(run.reports, WINDOW_SECONDS))}`,
    `  stretches over 8 ms: first ${WINDOW_SECONDS} s ${longByKind(run.reports, 0, WINDOW_SECONDS)}; after ${longByKind(run.reports, WINDOW_SECONDS)}`,
    ...(kinds ? [`  longest by kind: ${kinds}`] : []),
    `  main-thread long tasks ${run.longTasks.count} (${Math.round(run.longTasks.ms)} ms)${parts ? ` · ${parts}` : ''}`,
  ].join('\n');
}

const storage = (): Storage | undefined => { try { return globalThis.localStorage; } catch { return undefined; } };
function enabled(): boolean {
  if (typeof location === 'undefined') return false;
  const param = new URLSearchParams(location.search).get('trace');
  const store = storage();
  try {
    if (param === 'off') store?.removeItem(FLAG);
    else if (param !== null) store?.setItem(FLAG, '1');
  } catch { /* private mode: this page only */ }
  return param !== null ? param !== 'off' : store?.getItem(FLAG) === '1';
}

/** The output buffer asked for under a trace: the browser's default, a latencyHint category
 *  or seconds. `?latency=` (default, interactive, balanced, playback or seconds) and the panel
 *  store it; with nothing stored it is 'balanced'. */
export type LatencyChoice = 'default' | AudioContextLatencyCategory | number;
export function parseLatency(value: string | null | undefined): LatencyChoice | undefined {
  if (value === 'default' || value === 'interactive' || value === 'balanced' || value === 'playback') return value;
  const seconds = Number(value);
  return value && Number.isFinite(seconds) && seconds > 0 && seconds <= 1 ? seconds : undefined;
}
function latency(on: boolean): LatencyChoice | undefined {
  if (!on) return undefined;
  const param = parseLatency(new URLSearchParams(location.search).get('latency')), store = storage();
  if (param !== undefined) try { store?.setItem(LATENCY, String(param)); } catch { /* this page only */ }
  return param ?? parseLatency(store?.getItem(LATENCY)) ?? 'balanced';
}
const latencyLabel = (c: LatencyChoice) => typeof c === 'number' ? `${c} s` : c;

class PlaybackTrace {
  readonly on = enabled();
  /** The output buffer chosen under this trace (undefined when the trace is off). */
  readonly latencyChoice = latency(this.on);
  /** The AudioContext's latencyHint: undefined for the browser's default. */
  get latencyHint(): AudioContextLatencyCategory | number | undefined {
    return this.latencyChoice === undefined || this.latencyChoice === 'default' ? undefined : this.latencyChoice;
  }
  private runs: TraceRun[] = [];
  private current: TraceRun | undefined;
  private underrunsSeen: number | undefined;
  private plays = 0;
  private device: TraceRun['device'] = { userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent };
  private panel: HTMLElement | undefined;
  constructor() {
    if (!this.on) return;
    try { this.runs = JSON.parse(storage()?.getItem(KEY) ?? '[]') as TraceRun[]; } catch { this.runs = []; }
    const nav = navigator as Navigator & { deviceMemory?: number };
    Object.assign(this.device, { cores: nav.hardwareConcurrency, ...(nav.deviceMemory ? { memoryGb: nav.deviceMemory } : {}), ...(this.latencyChoice !== undefined ? { latencyHint: latencyLabel(this.latencyChoice) } : {}) });
    try {
      new PerformanceObserver(list => {
        if (!this.current) return;
        for (const e of list.getEntries()) { this.current.longTasks.count++; this.current.longTasks.ms += e.duration; }
      }).observe({ type: 'longtask', buffered: false });
    } catch { /* no long-task timing in this browser */ }
    if (typeof document !== 'undefined') queueMicrotask(() => this.render());
  }
  /** The audio context, once made (hostPort.ts). */
  context(context: BaseAudioContext & { baseLatency?: number; outputLatency?: number }) {
    if (!this.on) return;
    Object.assign(this.device, { sampleRate: context.sampleRate, baseLatency: context.baseLatency, outputLatency: context.outputLatency });
  }
  /** Play reached its first note's plan (hostBackend.ts newPlan). */
  begin(label: string) {
    if (!this.on) return;
    this.current = { label, build: typeof __MNX_COMMIT__ === 'string' ? __MNX_COMMIT__ : 'dev',
      pageSeconds: performance.now() / 1000, playInPage: ++this.plays, device: { ...this.device }, reports: [], longTasks: { count: 0, ms: 0 } };
    this.underrunsSeen = undefined;
  }
  /** A load report, `t` seconds after the first note was due (negative before it). */
  load(report: LoadReport, t: number, measured?: number) {
    const run = this.current;
    if (!run || t < -BEFORE_SECONDS) return;
    const total = report.underrunsTotal;
    const underruns = total === undefined ? report.underruns ?? 0 : this.underrunsSeen === undefined ? 0 : Math.max(0, total - this.underrunsSeen);
    if (total !== undefined) this.underrunsSeen = total;
    const long = Object.fromEntries(Object.entries(report.kinds ?? {}).filter(([, k]) => k.long > 0).map(([name, k]) => [name, k.long]));
    run.reports.push({ t: Math.round(t * 100) / 100, busy: Math.round(report.busy * 1000) / 1000, peakMs: Math.round(report.peakMs * 100) / 100, underruns,
      ...(report.peakKind ? { peak: report.peakKind } : {}), ...(Object.keys(long).length ? { long } : {}),
      ...(measured !== undefined && Number.isFinite(measured) ? { latencyMs: Math.round(measured * 1000) } : {}) });
    for (const [name, k] of Object.entries(report.kinds ?? {})) {
      const total = (run.kinds ??= {})[name] ??= { ms: 0, max: 0, long: 0 };
      total.ms = Math.round((total.ms + k.ms) * 10) / 10; total.max = Math.max(total.max, Math.round(k.max * 10) / 10); total.long += k.long;
    }
    if (run.device.outputLatency === undefined && this.device.outputLatency !== undefined) run.device = { ...this.device };
  }
  /** Playback stopped; `profile` is the host's report when it has one. */
  end(profile?: TraceProfile) {
    const run = this.current;
    if (!run) return;
    this.current = undefined;
    if (profile) run.profile = { realTimeFactor: profile.realTimeFactor,
      parts: Object.fromEntries(Object.entries(profile.parts ?? {}).map(([id, p]) => [id, { kind: p.kind, msPerAudioSecond: Math.round(p.msPerAudioSecond * 100) / 100 }])) };
    if (!run.reports.length) return;
    this.runs.push(run);
    try { storage()?.setItem(KEY, JSON.stringify(this.runs)); } catch { /* full: this page only */ }
    this.render();
  }
  get active() { return this.current !== undefined; }

  private render() {
    if (typeof document === 'undefined' || !document.body) return;
    // A manual popover lives in the browser's top layer, above whatever the app stacks there
    // (the workbench and studio shells covered a fixed panel and took its taps).
    const panel = this.panel ??= document.body.appendChild(Object.assign(document.createElement('aside'), { popover: 'manual' }));
    panel.setAttribute('aria-label', 'Playback trace');
    if (!panel.matches(':popover-open')) try { panel.showPopover(); } catch { /* no popover support: a fixed panel */ }
    Object.assign(panel.style, { position: 'fixed', inset: 'auto auto 8px 8px', margin: '0', border: '0', zIndex: '99999', maxWidth: 'min(560px, calc(100vw - 16px))',
      maxHeight: '45vh', overflow: 'auto', padding: '8px 10px', borderRadius: '8px', font: '12px/1.4 ui-monospace, monospace',
      background: 'rgba(16, 24, 28, 0.94)', color: '#e6efe9', boxShadow: '0 4px 18px rgba(0,0,0,.4)', whiteSpace: 'pre-wrap' });
    panel.replaceChildren();
    const button = (text: string, onclick: () => void) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = onclick;
      Object.assign(b.style, { marginRight: '6px', font: 'inherit', padding: '4px 8px', borderRadius: '6px', border: '1px solid #4a6a60', background: '#203a33', color: 'inherit' });
      return b;
    };
    const head = document.createElement('div');
    head.append(`Playback trace · ${this.runs.length} run${this.runs.length === 1 ? '' : 's'} `,
      button('Copy', () => { void navigator.clipboard.writeText(this.text()).then(() => { head.lastChild!.textContent = ' copied'; }, () => { head.lastChild!.textContent = ' copy failed'; }); }),
      button('Clear', () => { this.runs = []; try { storage()?.removeItem(KEY); } catch { /* */ } this.render(); }),
      button('Off', () => { try { storage()?.removeItem(FLAG); storage()?.removeItem(KEY); storage()?.removeItem(LATENCY); } catch { /* */ } panel.remove(); }),
      document.createElement('span'));
    // The output buffer is chosen when the audio starts: choosing reloads the page. Big
    // targets: these are tapped on a phone between plays.
    const buffers = document.createElement('div');
    Object.assign(buffers.style, { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', margin: '8px 0' });
    buffers.append('Buffer:', ...(['default', 'balanced', 'playback'] as const).map(choice => {
      const on = this.latencyChoice === choice;
      const b = button(choice[0]!.toUpperCase() + choice.slice(1), () => {
        try { storage()?.setItem(LATENCY, choice); } catch { /* */ }
        const url = new URL(location.href);
        if (url.searchParams.has('latency')) { url.searchParams.delete('latency'); location.replace(url.href); } else location.reload();
      });
      b.setAttribute('aria-pressed', String(on));
      Object.assign(b.style, { minHeight: '44px', minWidth: '96px', padding: '10px 16px', fontSize: '15px', marginRight: '0',
        ...(on ? { background: '#3f8f78', borderColor: '#9fe0c9', fontWeight: '700' } : {}) });
      return b;
    }));
    if (typeof this.latencyChoice === 'number') buffers.append(`(now ${latencyLabel(this.latencyChoice)})`);
    const body = document.createElement('div');
    body.textContent = this.runs.length ? this.runs.map(describe).join('\n') : 'Play a piece: each play from its first note to stop is one run.';
    panel.append(head, buffers, body);
  }
  /** Everything, for pasting back: the summaries, then the runs as JSON. */
  private text() {
    return `${this.runs.map(describe).join('\n')}\n\n${JSON.stringify({ trace: 1, runs: this.runs })}`;
  }
}
export const playbackTrace = new PlaybackTrace();
