// Browser-only buffer assertions. No listening approval and no performance goldens.
import { NativeSink } from '../../src/audio/native/sink.ts';
import { Transport, type Clock } from '../../src/audio/transport.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import type { MnxDocument } from '../../src/model/mnx.ts';
const check = (value: boolean, message: string) => {
  if (!value) throw new Error(message);
};
const rms = (data: Float32Array, from: number, to: number) => {
  let energy = 0;
  const a = Math.ceil(from * 48000),
    b = Math.min(data.length, Math.floor(to * 48000));
  for (let i = a; i < b; i++) energy += data[i]! ** 2;
  return Math.sqrt(energy / (b - a));
};
const frequency = (data: Float32Array, from: number, to: number) => {
  const crossings: number[] = [];
  for (let i = Math.ceil(from * 48000) + 1; i < Math.floor(to * 48000); i++)
    if (data[i - 1]! <= 0 && data[i]! > 0)
      crossings.push(i - 1 - data[i - 1]! / (data[i]! - data[i - 1]!));
  return ((crossings.length - 1) * 48000) / (crossings.at(-1)! - crossings[0]!);
};
export async function runAudioSmoke() {
  const result: Record<string, number | boolean> = {};
  const doc = (await (
    await fetch('/scenarios/spec/hello-world/document.mnx.json')
  ).json()) as MnxDocument;
  const compiled = compilePerformance(doc);
  if (!compiled.ok) throw new Error('Scenario failed compilation.');
  const context = new OfflineAudioContext(1, 48000 * 2.4, 48000),
    sink = new NativeSink({ context });
  const clock: Clock = { now: () => 0.1, setTimeout: () => 0, clearTimeout: () => {} };
  const transport = new Transport(compiled.performance, clock, sink, { lookaheadSeconds: 3 });
  await transport.play();
  const data = (await context.startRendering()).getChannelData(0);
  result.scenarioHz = frequency(data, 0.15, 0.4);
  check(Math.abs(result.scenarioHz - 261.625565) < 1, 'Compiled scenario pitch is not C4.');
  check(rms(data, 0, 0.1) === 0, 'Sound leaked before first onset.');
  check(rms(data, 0.11, 0.2) > 0.05, 'No energy at the compiler/transport first onset.');
  check(rms(data, 2.12, 2.4) < 1e-7, 'Scenario release leaked.');
  transport.dispose();
  sink.dispose();

  const ctx = new OfflineAudioContext(2, 48000 * 1.5, 48000);
  const left = ctx.createStereoPanner(),
    right = ctx.createStereoPanner();
  left.pan.value = -1;
  right.pan.value = 1;
  left.connect(ctx.destination);
  right.connect(ctx.destination);
  const a = new NativeSink({ context: ctx, destination: left }),
    b = new NativeSink({ context: ctx, destination: right });
  await a.unlock();
  await b.unlock();
  a.schedule(
    [
      { kind: 'attack', voice: 'string3', hz: 440, velocity: 1, offset: 0.1 },
      { kind: 'attack', voice: 'string3', hz: 330, velocity: 1, offset: 0.9 },
    ],
    0,
  );
  b.schedule(
    [
      { kind: 'attack', voice: 'string4', hz: 220, velocity: 1, offset: 0.1 },
      { kind: 'release', voice: 'string4', offset: 1.3 },
    ],
    0,
  );
  // These later calls must address the earlier generation at their timestamps.
  a.bend('string3', 200, 0.2, 0.2);
  a.schedule([{ kind: 'pitch', voice: 'string3', hz: 660, offset: 0 }], 0.5);
  a.release('string3', 0.7);
  a.cancel(0.8);
  a.cancel(0.8);
  const buffer = await ctx.startRendering(),
    l = buffer.getChannelData(0),
    r = buffer.getChannelData(1);
  result.baseHz = frequency(l, 0.12, 0.19);
  result.bentHz = frequency(l, 0.42, 0.49);
  result.retunedHz = frequency(l, 0.55, 0.65);
  result.independentHz = frequency(r, 0.55, 0.65);
  check(Math.abs(result.baseHz - 440) < 1, 'Base pitch wrong.');
  check(Math.abs(result.bentHz - 440 * 2 ** (200 / 1200)) < 1, 'Bend missed its voice generation.');
  check(Math.abs(result.retunedHz - 660 * 2 ** (200 / 1200)) < 1, 'Retune lost its bend.');
  check(Math.abs(result.independentHz - 220) < 1, 'A bend changed the other string.');
  check(rms(l, 0.72, 1.4) < 1e-7, 'Release/cancelled future generation leaked.');
  check(rms(r, 0.72, 1.2) > 0.1, 'Releasing one string silenced another.');
  result.retuneEnvelopeRatio = rms(l, 0.51, 0.53) / rms(l, 0.47, 0.49);
  check(
    result.retuneEnvelopeRatio > 0.9 && result.retuneEnvelopeRatio < 1.1,
    'Pitch action restarted the envelope.',
  );
  a.dispose();
  b.dispose();
  left.disconnect();
  right.disconnect();

  const cut = new OfflineAudioContext(1, 48000, 48000),
    c = new NativeSink({ context: cut });
  c.schedule(
    [
      { kind: 'attack', voice: 'v', hz: 440, velocity: 1, offset: 0.1 },
      { kind: 'bend', voice: 'v', cents: 1200, rampSeconds: 0.6, offset: 0.2 },
      { kind: 'attack', voice: 'v', hz: 880, velocity: 1, offset: 0.65 },
    ],
    0,
  );
  c.cancel(0.4);
  c.schedule(
    [
      { kind: 'attack', voice: 'v', hz: 220, velocity: 1, offset: 0.45 },
      { kind: 'release', voice: 'v', offset: 0.8 },
    ],
    0,
  );
  const cutData = (await cut.startRendering()).getChannelData(0);
  // A future cancellation may not turn the preceding half of a ramp into a step.
  const expectedAt35 = 440 * 2 ** (300 / 1200);
  result.crossingRampHz = frequency(cutData, 0.345, 0.355);
  check(
    Math.abs(result.crossingRampHz - expectedAt35) < 5,
    'Cancellation rewrote sound before its cutoff.',
  );
  check(rms(cutData, 0.41, 0.44) < 1e-7, 'Cancelled ramp tail exceeded 5 ms.');
  check(
    Math.abs(frequency(cutData, 0.7, 0.78) - 220) < 1,
    'Cancelled future generation killed the replacement voice.',
  );
  check(rms(cutData, 0.82, 1) < 1e-7, 'Replacement release leaked.');
  c.dispose();
  c.dispose();
  let refused = false;
  try {
    c.schedule([], 0);
  } catch {
    refused = true;
  }
  check(refused, 'Disposed sink accepted scheduling.');
  result.disposalRefused = refused;
  const quietContext = new OfflineAudioContext(1, 48000, 48000),
    quiet = new NativeSink({ context: quietContext, volume: 0.5 });
  quiet.schedule(
    [
      { kind: 'attack', voice: 'v', hz: 440, velocity: 1, offset: 0.1 },
      { kind: 'release', voice: 'v', offset: 0.5 },
    ],
    0,
  );
  quiet.setVolume(0.25);
  const quietData = (await quietContext.startRendering()).getChannelData(0);
  result.volumeRms = rms(quietData, 0.2, 0.4);
  check(
    Math.abs(result.volumeRms - (0.2 * 0.25) / Math.sqrt(2)) < 0.001,
    'Master volume did not reach the output.',
  );
  quiet.dispose();
  return result;
}
