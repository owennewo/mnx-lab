// The playback trace's summaries (src/audio/playbackTrace.ts; roadmap core-synth-performance,
// the baseline): reports split at ten seconds from the first note, hostStrain.ts's hot rule.
import { it, expect } from 'vitest';
import { summarise, describe as describeRun, playbackTrace, type TraceRun } from '../../src/audio/playbackTrace.ts';

const reports = [
  { t: -0.4, busy: 0.9, peakMs: 30, underruns: 0 },   // the start-up stall, before the first note
  { t: 0.1, busy: 0.5, peakMs: 4, underruns: 0 },
  { t: 0.6, busy: 0.8, peakMs: 5, underruns: 0 },     // hot: busy
  { t: 9.6, busy: 0.2, peakMs: 9, underruns: 0 },     // hot: one long stretch
  { t: 10.1, busy: 0.2, peakMs: 2, underruns: 1 },    // hot: an underrun
  { t: 10.6, busy: 0.1, peakMs: 1, underruns: 0 },
];
it('splits a run at ten seconds and counts hot reports as the strain monitor does', () => {
  expect(summarise(reports, 0, 10)).toEqual({ reports: 3, busyMean: 0.5, busyMax: 0.8, peakMsMax: 9, hot: 2, underruns: 0 });
  const after = summarise(reports, 10);
  expect(after.reports).toBe(2);
  expect(after.hot).toBe(1);
  expect(after.underruns).toBe(1);
  expect(after.busyMean).toBeCloseTo(0.15);
  expect(summarise([], 0)).toEqual({ reports: 0, busyMean: 0, busyMax: 0, peakMsMax: 0, hot: 0, underruns: 0 });
});
it('describes a run in a few lines, with the per-part profile', () => {
  const run: TraceRun = { label: 'Anji', build: 'abc', pageSeconds: 31.6, playInPage: 2, device: { userAgent: 'x' }, reports,
    longTasks: { count: 3, ms: 412.4 }, profile: { parts: { guitar: { kind: 'plucked', msPerAudioSecond: 44.5 } } } };
  expect(describeRun(run, 0)).toBe([
    'Run 1: Anji — play 2 on the page, 32 s after it opened',
    '  first 10 s: busy 50% mean, 80% max · longest 9.0 ms · hot 2/3 · underruns 0',
    '  after: busy 15% mean, 20% max · longest 2.0 ms · hot 1/2 · underruns 1',
    '  main-thread long tasks 3 (412 ms) · guitar (plucked) 44.5 ms/s',
  ].join('\n'));
});
it('is off outside a page that asks for it', () => {
  expect(playbackTrace.on).toBe(false);
  expect(playbackTrace.active).toBe(false);
});
