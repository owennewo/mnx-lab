import { NativeSink } from "../../../src/audio/native/sink.ts";
import { loadSamplePack } from "../../../src/audio/native/samplePacks.ts";
import { compilePerformance } from "../../../src/audio/performance.ts";
import { createTempoMap, add } from "../../../src/audio/time.ts";
import document from "../fixtures/two-notes.mnx.json";
// Keep this adapter browser-only. Every audible source is created by NativeSink.
const banks = new Map();
export async function render(fixture, preset, sampleRate) {
  const context = new OfflineAudioContext(
    1,
    Math.ceil(fixture.duration * sampleRate),
    sampleRate,
  );
  if (!banks.has(preset))
    banks.set(preset, await loadSamplePack(context, undefined, preset));
  let sources = 0;
  const original = context.createBufferSource.bind(context);
  context.createBufferSource = () => {
    sources++;
    return original();
  };
  const sink = new NativeSink({
    context,
    voicePreset: preset,
    sampleLoader: async () => banks.get(preset),
    volume: 0.5,
  });
  await sink.unlock();
  const events = fixture.actual
    .flatMap((n, i) => [
      {
        kind: "attack",
        voice: `n${i}`,
        offset: n.start,
        hz: 440 * 2 ** ((n.pitch - 69) / 12),
        velocity: n.velocity,
      },
      ...(n.bend
        ? [
            {
              kind: "bend",
              voice: `n${i}`,
              offset: n.bend.start,
              cents: n.bend.cents,
              rampSeconds: n.bend.end - n.bend.start,
            },
          ]
        : []),
      { kind: "release", voice: `n${i}`, offset: n.end },
    ])
    .sort((a, b) => a.offset - b.offset || (a.kind === "release" ? -1 : 1));
  sink.schedule(events, 0);
  const samples = Array.from(
    (await context.startRendering()).getChannelData(0),
  );
  sink.dispose();
  if (sources !== fixture.actual.length)
    throw Error("Sample path did not render every attack");
  return { samples, sources };
}
export function compiledFixture() {
  const compiled = compilePerformance(document);
  if (!compiled.ok) throw Error(JSON.stringify(compiled.diagnostics));
  const tempo = createTempoMap(compiled.performance.tempo);
  const actual = compiled.performance.sounding.map((n) => ({
    pitch: n.midi,
    start: 0.25 + tempo.secondsAt(n.position),
    end: 0.25 + tempo.secondsAt(add(n.position, n.duration)),
    velocity: n.velocity / 127,
  }));
  return {
    id: "mnx-two-notes",
    category: "mnx",
    target: actual,
    actual,
    duration: 1.65,
    split: "evaluation",
  };
}
