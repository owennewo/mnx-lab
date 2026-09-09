// mnx-lab/audio — pure compilation, exact time and bounded MIDI export.
export { compilePerformance, serializePerformance, parsePerformance } from '../../audio/performance.ts';
export { exportMidi, quantizeTick, MIDI_PPQ, type MidiResult, type MidiDiagnostic, type MidiAllocation } from '../../audio/midiFile.ts';
export * from '../../audio/time.ts';
export type * from '../../audio/performanceTypes.ts';
export type { Sink, SinkEvent, SinkVoice } from '../../audio/sink.ts';

export { Transport, eventsBetween, centsAt, type Clock, type LoopRegion, type TransportSnapshot, type TransportEvent, type TransportOptions } from '../../audio/transport.ts';
export { NativeSink, nativeClock, type NativeSinkOptions } from '../../audio/native/sink.ts';

export { SAMPLE_PRESETS, isSamplePreset, type VoicePreset, type SamplePreset, type InstrumentSample } from '../../audio/sampleSelection.ts';
export {
  loadSamplePack, setSampleBase,
  type SamplePackBank, type DecodedSample, type SamplePackLoader,
} from '../../audio/native/samplePacks.ts';

/* ── the retired `guitar…` spellings ──────────────────────────────────────
   These nine names shipped when every pack was a guitar. A piano landed on
   2026-09-09 and they became wrong, so the source tree says `sample` and
   `instrument` throughout. They are re-exported here, and ONLY here, so that
   an embed or library consumer pinned to the old surface keeps working across
   the rename; nothing inside `src/` may reach for them. Delete this block once
   no consumer needs it — the aliases are a migration, not a second API. */
export {
  /** @deprecated renamed to `SAMPLE_PRESETS` — these are not all guitars. */
  SAMPLE_PRESETS as GUITAR_PRESETS,
  /** @deprecated renamed to `isSamplePreset`. */
  isSamplePreset as isGuitarPreset,
  /** @deprecated renamed to `SamplePreset`. */
  type SamplePreset as GuitarPreset,
  /** @deprecated renamed to `InstrumentSample`. */
  type InstrumentSample as GuitarSample,
} from '../../audio/sampleSelection.ts';
export {
  /** @deprecated renamed to `loadSamplePack`. */
  loadSamplePack as loadGuitarSamples,
  /** @deprecated renamed to `setSampleBase`. */
  setSampleBase as setGuitarSampleBase,
  /** @deprecated renamed to `SamplePackBank`. */
  type SamplePackBank as GuitarSampleBank,
  /** @deprecated renamed to `DecodedSample`. */
  type DecodedSample as DecodedGuitarSample,
  /** @deprecated renamed to `SamplePackLoader`. */
  type SamplePackLoader as GuitarSampleLoader,
} from '../../audio/native/samplePacks.ts';
