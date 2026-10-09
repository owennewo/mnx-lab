// The playback trace's summaries (src/audio/playbackTrace.ts; roadmap core-synth-performance,
// the baseline): reports split at ten seconds from the first note, hostStrain.ts's hot rule.
import { it, expect } from 'vitest';
import { summarise, longByKind, parseLatency, describe as describeRun, playbackTrace, type TraceRun } from '../../src/audio/playbackTrace.ts';

const reports = [
  { t: -0.4, busy: 0.9, peakMs: 30, underruns: 0 },   // the start-up stall, before the first note
  { t: 0.1, busy: 0.5, peakMs: 4, underruns: 0 },
  { t: 0.6, busy: 0.8, peakMs: 5, underruns: 0 },     // hot: busy
  { t: 9.6, busy: 0.2, peakMs: 9, underruns: 0, peak: 'schedule', long: { schedule: 1 } },     // hot: one long stretch
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
it('counts long stretches by kind per window', () => {
  const r = [...reports, { t: 3, busy: 0.3, peakMs: 12, underruns: 0, peak: 'render', long: { render: 1, schedule: 2 } }];
  expect(longByKind(r, 0, 10)).toBe('schedule 3, render 1');
  expect(longByKind(r, 10)).toBe('none');
});
it('describes a run in a few lines, with the buffer, the long stretches and the per-part profile', () => {
  const run: TraceRun = { label: 'Anji', build: 'abc', pageSeconds: 31.6, playInPage: 2, device: { userAgent: 'x', outputLatency: 0.024, latencyHint: 'playback' }, reports,
    longTasks: { count: 3, ms: 412.4 }, kinds: { render: { ms: 900, max: 4, long: 0 }, schedule: { ms: 40, max: 9, long: 1 } },
    profile: { parts: { guitar: { kind: 'plucked', msPerAudioSecond: 44.5 } } } };
  expect(describeRun(run, 0)).toBe([
    'Run 1: Anji — play 2 on the page, 32 s after it opened, buffer playback (output 24 ms)',
    '  first 10 s: busy 50% mean, 80% max · longest 9.0 ms · hot 2/3 · underruns 0',
    '  after: busy 15% mean, 20% max · longest 2.0 ms · hot 1/2 · underruns 1',
    '  stretches over 8 ms: first 10 s schedule 1; after none',
    '  longest by kind: schedule 9 ms, render 4 ms',
    '  main-thread long tasks 3 (412 ms) · guitar (plucked) 44.5 ms/s',
  ].join('\n'));
});
it('takes a latencyHint category, the browser default or seconds', () => {
  expect(['default', 'interactive', 'balanced', 'playback'].map(parseLatency)).toEqual(['default', 'interactive', 'balanced', 'playback']);
  expect(parseLatency('0.1')).toBe(0.1);
  expect([null, '', 'fast', '0', '-1', '2'].map(parseLatency)).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
});
it('is off outside a page that asks for it', () => {
  expect(playbackTrace.on).toBe(false);
  expect(playbackTrace.active).toBe(false);
  expect(playbackTrace.latencyHint).toBeUndefined();
});
