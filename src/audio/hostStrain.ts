/**
 * Is the synth's audio thread keeping up? (roadmap/complete/core-campaign-synth.md.) The
 * worklet reports twice a second the share of its time the host took and its longest single
 * stretch (synth/web/host/host-processor.js `load`); where the browser counts audio
 * underruns, they are added. Pure.
 *
 * A report is hot when the host took more than 70% of the thread, or held it for longer than
 * three render quanta in one go (8 ms — longer than many devices' output buffer), or the
 * browser heard an underrun. Two hot reports running (a second), or any underrun, is
 * strain: one slow report — the first configure, say — is not. Strain clears after three
 * quiet seconds, so a struggling device does not flicker in and out of it.
 */
export interface LoadReport {
  busy: number;
  peakMs: number;
  /** Underruns since the last report counted, where the browser counts them. */
  underruns?: number;
  /** The browser's running count of underruns (the port reports this; the backend turns it into `underruns`). */
  underrunsTotal?: number;
  /** What the window's longest stretch was ('render' or a message type) and, per kind, the total,
   *  the longest stretch and the stretches over 8 ms (playbackTrace.ts). */
  peakKind?: string;
  kinds?: Record<string, { ms: number; max: number; long: number }>;
}
export const STRAIN = Object.freeze({ busy: 0.7, peakMs: 8, clearAfterMs: 3000 });
export class StrainMonitor {
  private hotRun = 0;
  private lastHot = -Infinity;
  strained = false;
  /** Returns whether `strained` changed. */
  report(load: LoadReport, nowMs: number): boolean {
    const hot = load.busy > STRAIN.busy || load.peakMs > STRAIN.peakMs || (load.underruns ?? 0) > 0;
    this.hotRun = hot ? this.hotRun + 1 : 0;
    if (hot) this.lastHot = nowMs;
    const was = this.strained;
    if ((load.underruns ?? 0) > 0 || this.hotRun >= 2) this.strained = true;
    else if (this.strained && nowMs - this.lastHot >= STRAIN.clearAfterMs) this.strained = false;
    return was !== this.strained;
  }
  reset() { this.hotRun = 0; this.lastHot = -Infinity; this.strained = false; }
}
