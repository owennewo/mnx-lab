import { describe, expect, it } from 'vitest';
import { ClickWindow, MediaClockEstimate } from '../../src/audio/clickSchedule.ts';

const every = (step: number) => (from: number, to: number) => {
  const out: { time: number }[] = [];
  for (let k = Math.ceil(from / step - 1e-9); k * step < to; k++) out.push({ time: k * step });
  return out;
};

describe('media clock estimate', () => {
  it('absorbs a jittery reading instead of following it', () => {
    const clock = new MediaClockEstimate();
    clock.sample(0, 10, 1, true);
    for (let i = 1; i <= 50; i++) clock.sample(i * 0.1, 10 + i * 0.1 + (i % 2 ? 0.03 : -0.03), 1, true);
    expect(Math.abs(clock.at(5) - 15)).toBeLessThan(0.02);
    expect(clock.at(5.05)).toBeCloseTo(clock.at(5) + 0.05, 9);
  });
  it('re-anchors on a seek, respects the rate and holds while paused', () => {
    const clock = new MediaClockEstimate();
    clock.sample(0, 10, 1, true); clock.sample(0.1, 60, 1, true);
    expect(clock.at(0.1)).toBe(60);
    clock.sample(0.2, 60.05, 0.5, true);
    expect(clock.at(1.2)).toBeCloseTo(60.55, 9);
    clock.sample(1.2, 60.55, 0.5, false);
    expect(clock.playing).toBe(false); expect(clock.at(9)).toBe(60.55);
    clock.reset(); expect(clock.playing).toBe(false);
  });
});

describe('click window', () => {
  it('schedules every beat once across consecutive windows', () => {
    const clock = new MediaClockEstimate(), window = new ClickWindow(0.2), heard: number[] = [];
    for (let i = 0; i <= 400; i++) {
      const now = i * 0.025;
      if (i % 4 === 0) clock.sample(now, now, 1, true);
      for (const click of window.due(clock, now, every(0.5))) { heard.push(click.beat.time); expect(click.delay).toBeGreaterThanOrEqual(0); expect(click.delay).toBeLessThanOrEqual(0.2 + 1e-9); }
    }
    expect(heard).toEqual(every(0.5)(0, 10.2).map(b => b.time));
  });
  it('gives the delay on the audio clock at the playback rate', () => {
    const clock = new MediaClockEstimate(), window = new ClickWindow(0.2);
    clock.sample(0, 9.9, 0.5, true);
    expect(window.due(clock, 0, every(10))).toEqual([]); // 0.2 s of audio is 0.1 s of media at half speed
    clock.sample(0.1, 9.95, 0.5, true);
    const [click] = window.due(clock, 0.1, every(10));
    expect(click.beat.time).toBe(10); expect(click.delay).toBeCloseTo(0.1, 9);
  });
  it('re-arms after a seek backwards and is silent while paused', () => {
    const clock = new MediaClockEstimate(), window = new ClickWindow(0.2);
    clock.sample(0, 9.9, 1, true); expect(window.due(clock, 0, every(10))).toHaveLength(1);
    clock.sample(0.1, 10.0, 1, true); expect(window.due(clock, 0.1, every(10))).toHaveLength(0);
    clock.sample(0.2, 9.9, 1, true); expect(window.due(clock, 0.2, every(10))).toHaveLength(0); // jitter, not a seek
    clock.sample(0.3, 5, 1, true); window.due(clock, 0.3, every(10));
    clock.sample(5.2, 9.9, 1, true); expect(window.due(clock, 5.2, every(10))).toHaveLength(1);
    clock.sample(5.3, 9.95, 1, false); expect(window.due(clock, 5.3, every(10))).toEqual([]);
  });
});
