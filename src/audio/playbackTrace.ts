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
 */
import type { LoadReport } from './hostStrain.ts';

declare const __MNX_COMMIT__: string | undefined;
const KEY = 'mnx.playbackTrace';
const FLAG = 'mnx.playbackTrace.on';
/** Reports before the first note further than this are the start-up stall, not playback. */
const BEFORE_SECONDS = 2;
export const WINDOW_SECONDS = 10;

export interface TraceReport { t: number; busy: number; peakMs: number; underruns: number }
export interface TraceProfile { realTimeFactor?: number; parts?: Record<string, { kind: string; msPerAudioSecond: number }> }
export interface TraceRun {
  label: string;
  build: string;
  /** Seconds the page had been open when play was pressed, and the play's number on this page. */
  pageSeconds: number;
  playInPage: number;
  device: { userAgent: string; cores?: number; memoryGb?: number; sampleRate?: number; baseLatency?: number; outputLatency?: number };
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
/** A run as a few lines of text. Pure. */
export function describe(run: TraceRun, index: number): string {
  const parts = Object.entries(run.profile?.parts ?? {}).map(([id, p]) => `${id} (${p.kind}) ${p.msPerAudioSecond.toFixed(1)} ms/s`).join(', ');
  return [
    `Run ${index + 1}: ${run.label} — play ${run.playInPage} on the page, ${run.pageSeconds.toFixed(0)} s after it opened`,
    `  ${line(`first ${WINDOW_SECONDS} s`, summarise(run.reports, 0, WINDOW_SECONDS))}`,
    `  ${line('after', summarise(run.reports, WINDOW_SECONDS))}`,
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

class PlaybackTrace {
  readonly on = enabled();
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
    Object.assign(this.device, { cores: nav.hardwareConcurrency, ...(nav.deviceMemory ? { memoryGb: nav.deviceMemory } : {}) });
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
  load(report: LoadReport, t: number) {
    const run = this.current;
    if (!run || t < -BEFORE_SECONDS) return;
    const total = report.underrunsTotal;
    const underruns = total === undefined ? report.underruns ?? 0 : this.underrunsSeen === undefined ? 0 : Math.max(0, total - this.underrunsSeen);
    if (total !== undefined) this.underrunsSeen = total;
    run.reports.push({ t: Math.round(t * 100) / 100, busy: Math.round(report.busy * 1000) / 1000, peakMs: Math.round(report.peakMs * 100) / 100, underruns });
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
    const panel = this.panel ??= document.body.appendChild(document.createElement('aside'));
    panel.setAttribute('aria-label', 'Playback trace');
    Object.assign(panel.style, { position: 'fixed', left: '8px', bottom: '8px', zIndex: '99999', maxWidth: 'min(560px, calc(100vw - 16px))',
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
      button('Off', () => { try { storage()?.removeItem(FLAG); storage()?.removeItem(KEY); } catch { /* */ } panel.remove(); }),
      document.createElement('span'));
    const body = document.createElement('div');
    body.textContent = this.runs.length ? this.runs.map(describe).join('\n') : 'Play a piece: each play from its first note to stop is one run.';
    panel.append(head, body);
  }
  /** Everything, for pasting back: the summaries, then the runs as JSON. */
  private text() {
    return `${this.runs.map(describe).join('\n')}\n\n${JSON.stringify({ trace: 1, runs: this.runs })}`;
  }
}
export const playbackTrace = new PlaybackTrace();
