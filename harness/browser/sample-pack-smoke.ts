import { SAMPLE_PRESETS, type SamplePreset } from '../../src/audio/sampleSelection.ts';
import { NativeSink } from '../../src/audio/native/sink.ts';
import { loadSamplePack } from '../../src/audio/native/samplePacks.ts';
import { Transport } from '../../src/audio/transport.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import '../../src/elements/Player.ts';
import type { Player } from '../../src/elements/Player.ts';
const check = (value: boolean, message: string) => {
  if (!value) throw new Error(message);
};
const rms = (data: Float32Array, from: number, to: number) => {
  let sum = 0;
  for (let i = Math.ceil(from * 48000); i < to * 48000 && i < data.length; i++) sum += data[i] ** 2;
  return Math.sqrt(sum / ((to - from) * 48000));
};
// A sampled guitar has strong harmonics: zero-crossings are not its fundamental.
const frequency = (data: Float32Array, from: number, expected: number) => {
  const start = Math.floor(from * 48000),
    count = 4800;
  let best = -Infinity,
    lag = 0;
  for (let k = Math.floor(48000 / (expected * 1.1)); k <= 48000 / (expected * 0.9); k++) {
    let dot = 0,
      a = 0,
      b = 0;
    for (let j = start; j < start + count; j++) {
      dot += data[j] * data[j + k];
      a += data[j] ** 2;
      b += data[j + k] ** 2;
    }
    const score = dot / Math.sqrt(a * b);
    if (score > best) {
      best = score;
      lag = k;
    }
  }
  return 48000 / lag;
};
async function checkBank(preset: SamplePreset) {
  const context = new OfflineAudioContext(1, 48000 * 2.2, 48000);
  const first = loadSamplePack(context, undefined, preset);
  check(
    first === loadSamplePack(context, undefined, preset),
    'Concurrent sample loads were not shared.',
  );
  const bank = await first;
  const expected = { piano: 26, guitar: 48, guitar2: 15, guitar3: 15, guitar4: 13 };
  check(bank.samples.length === expected[preset], 'Incomplete decoded pack: ' + preset);
  check(
    bank.samples.every((s) => s.buffer.duration > 0.5 && s.buffer.duration <= 8.001),
    'Unexpected sample durations.',
  );
  let attacks = 0;
  const create = context.createBufferSource.bind(context);
  context.createBufferSource = () => {
    attacks++;
    return create();
  };
  const sink = new NativeSink({ context, voicePreset: preset });
  await sink.unlock();
  sink.schedule(
    [
      { kind: 'attack', voice: 'string1', hz: 440, velocity: 0.8, offset: 0.1 },
      { kind: 'bend', voice: 'string1', cents: 200, rampSeconds: 0.1, offset: 0.3 },
      { kind: 'pitch', voice: 'string1', hz: 660, offset: 0.6 },
      { kind: 'bend', voice: 'string1', cents: 0, offset: 0.6 },
      { kind: 'release', voice: 'string1', offset: 0.9 },
      { kind: 'attack', voice: 'string2', hz: 220, velocity: 0.8, offset: 1.1 },
      { kind: 'release', voice: 'string2', offset: 1.4 },
      { kind: 'attack', voice: 'string2', hz: 440, velocity: 0.8, offset: 1.7 },
    ],
    0,
  );
  sink.cancel(1.5);
  sink.schedule(
    [
      { kind: 'attack', voice: 'string2', hz: 330, velocity: 0.8, offset: 1.6 },
      { kind: 'release', voice: 'string2', offset: 1.9 },
    ],
    0,
  );
  check(attacks === 4, 'Legato restarted a sample source.');
  const data = (await context.startRendering()).getChannelData(0);
  const measured = [
    frequency(data, 0.15, 440),
    frequency(data, 0.43, 493.88),
    frequency(data, 0.66, 660),
    frequency(data, 1.15, 220),
    frequency(data, 1.75, 330),
  ];
  for (const [i, target] of [440, 493.88, 660, 220, 330].entries())
    check(
      Math.abs(measured[i] - target) < target * 0.015,
      `Sample pitch/independence failed: ${measured[i]} expected ${target}.`,
    );
  check(rms(data, 0, 0.1) === 0, 'Sample onset was early.');
  check(rms(data, 0.11, 0.25) > 0.005, 'Sample onset was silent.');
  check(rms(data, 0.91, 1.09) < 1e-7, 'Sample release leaked.');
  check(rms(data, 1.91, 2.2) < 1e-7, 'Cancelled generation/replacement leaked.');
  sink.dispose();

  return { bank, measured, attacks };
}
export async function runSamplePackSmoke() {
  const results = new Map<SamplePreset, Awaited<ReturnType<typeof checkBank>>>();
  for (const p of SAMPLE_PRESETS) results.set(p.id, await checkBank(p.id));
  const { bank, measured, attacks } = results.get('guitar')!;
  // A slow earlier bank must not become the bank of a later selected preset.
  const raceContext = new OfflineAudioContext(1, 48000, 48000);
  const ready = new Map<SamplePreset, (value: typeof bank) => void>();
  const requested: SamplePreset[] = [];
  const racing = new NativeSink({
    context: raceContext,
    voicePreset: 'guitar2',
    sampleLoader: (_ctx, id) => {
      requested.push(id);
      return new Promise((resolve) => ready.set(id, resolve));
    },
  });
  const older = racing.unlock();
  racing.setVoicePreset('guitar3');
  const newer = racing.unlock();
  ready.get('guitar3')!(results.get('guitar3')!.bank);
  await newer;
  ready.get('guitar2')!(results.get('guitar2')!.bank);
  await older;
  let used: AudioBuffer | null = null;
  const create = raceContext.createBufferSource.bind(raceContext);
  raceContext.createBufferSource = () => {
    const node = create(),
      start = node.start.bind(node);
    node.start = (when = 0) => {
      used = node.buffer;
      start(when);
    };
    return node;
  };
  racing.schedule([{ kind: 'attack', voice: 'v', hz: 440, velocity: 0.8, offset: 0.1 }], 0);
  check(
    results.get('guitar3')!.bank.samples.some((s) => s.buffer === used),
    'Late nylon load replaced the selected steel bank.',
  );
  racing.setVoicePreset('guitar2');
  await racing.unlock();
  check(requested.join(',') === 'guitar2,guitar3', 'Cached bank was downloaded again.');
  racing.dispose();
  // Compile and seek through a sustained note: transport remains the timeline.
  const doc = {
    mnx: { version: 1 },
    global: { measures: [{}] },
    parts: [
      {
        measures: [
          {
            sequences: [
              {
                content: [
                  {
                    duration: { base: 'whole' as const },
                    notes: [{ pitch: { step: 'A' as const, octave: 4 } }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const compiled = compilePerformance(doc);
  if (!compiled.ok) throw new Error('Guitar probe failed compilation.');
  const seekContext = new OfflineAudioContext(1, 48000, 48000);
  const seekSink = new NativeSink({
    context: seekContext,
    voicePreset: 'guitar',
    sampleLoader: async () => bank,
  });
  const transport = new Transport(
    compiled.performance,
    { now: () => 0.1, setTimeout: () => 0, clearTimeout: () => {} },
    seekSink,
    { lookaheadSeconds: 2 },
  );
  transport.seek({ num: 1n, den: 2n });
  await transport.play();
  const seekData = (await seekContext.startRendering()).getChannelData(0);
  check(
    rms(seekData, 0, 0.1) === 0 && rms(seekData, 0.12, 0.25) > 0.005,
    'Seek reconstruction failed with samples.',
  );
  transport.dispose();
  seekSink.dispose();

  // Actual element lifecycle, with a delayed host loader and a recoverable error.
  const player = document.createElement('mnx-player') as Player;
  player.performance = compiled.performance;
  player.voicePreset = 'guitar';
  let finish!: (value: typeof bank) => void;
  player.sampleLoader = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  document.body.append(player);
  await player.updateComplete;
  const pending = player.play();
  for (let i = 0; !finish && i < 100; i++) await new Promise((r) => setTimeout(r, 10));
  check(!!finish, 'Sample loader was not invoked.');
  await player.updateComplete;
  check(!!player.shadowRoot?.querySelector('[role=status]'), 'Loading state is not visible.');
  player.stop();
  finish(bank);
  await pending;
  check(player.snapshot?.state === 'stopped', 'Late samples restarted a stopped player.');
  let failLate!: (error: Error) => void;
  player.sampleLoader = () =>
    new Promise((_resolve, reject) => {
      failLate = reject;
    });
  await player.updateComplete;
  const oldPlay = player.play();
  for (let i = 0; !failLate && i < 100; i++) await new Promise((r) => setTimeout(r, 10));
  check(!!failLate, 'Second delayed loader did not start.');
  player.voicePreset = 'synth';
  await player.updateComplete;
  await player.play();
  failLate(new Error('Stale guitar error'));
  await oldPlay;
  await player.updateComplete;
  check(
    player.snapshot?.state === 'playing' && !player.shadowRoot?.querySelector('[role=alert]'),
    'An old sample load interfered with the new synth playback.',
  );
  player.voicePreset = 'guitar';
  player.sampleLoader = async () => {
    throw new Error('Test sample failure');
  };
  await player.updateComplete;
  await player.play();
  await player.updateComplete;
  check(
    player.shadowRoot
      ?.querySelector('[role=alert]')
      ?.textContent?.includes('Test sample failure') ?? false,
    'Load failure was hidden.',
  );
  player.voicePreset = 'synth';
  await player.updateComplete;
  await player.play();
  check(player.snapshot?.state === 'playing', 'Synth fallback choice could not play.');
  player.pause();
  const position = player.position;
  player.voicePreset = 'guitar';
  player.sampleLoader = async () => bank;
  await player.updateComplete;
  await player.play();
  check(player.snapshot?.state === 'playing', 'Recovered sample loader could not play.');
  player.remove();
  check(position.num >= 0n, 'Invalid player position.');
  return {
    presets: Object.fromEntries(
      [...results].map(([id, result]) => [
        id,
        { samples: result.bank.samples.length, measuredHz: result.measured },
      ]),
    ),
    samples: bank.samples.length,
    measuredHz: measured,
    attacks,
    seek: true,
    stopDuringLoad: true,
    errorRecovery: true,
  };
}
