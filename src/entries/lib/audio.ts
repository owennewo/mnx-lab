// mnx-lab/audio — pure compilation, exact time and bounded MIDI export.
export { compilePerformance, serializePerformance, parsePerformance } from '../../audio/performance.ts';
export { exportMidi, quantizeTick, MIDI_PPQ, type MidiResult, type MidiDiagnostic, type MidiAllocation } from '../../audio/midiFile.ts';
export * from '../../audio/time.ts';
export type * from '../../audio/performanceTypes.ts';
export type { Sink, SinkEvent, SinkVoice } from '../../audio/sink.ts';

export { Transport, eventsBetween, centsAt, type Clock, type LoopRegion, type TransportSnapshot, type TransportEvent, type TransportOptions } from '../../audio/transport.ts';

/* Playback is the synth's instrument host (synth/, roadmap core-campaign-synth). The score
   becomes an mnx-sound/2 stream and setup; `HostBackend` plays it through a `HostPort`.
   `NativeHostPort` loads the synth's runtime at run time from `setSynthBase(url)` — serve
   the synth's built runtime (`synth/scripts/build_app.mjs`, as the site's /synth/ and the
   embed's synth/ are) and point it there. */
export { performanceToStream, streamClock, type ContractStream, type StreamOptions } from '../../audio/contractStream.ts';
export { hostSetup, levelDb, DEFAULT_DESIGNS, type HostSetup, type HostKind, type RoutedPart } from '../../audio/hostSetup.ts';
export { HostBackend, type HostPort, type HostBackendOptions } from '../../audio/hostBackend.ts';
export { NativeHostPort, setSynthBase, loadFactoryDesigns, type NativeHostPortOptions } from '../../audio/native/hostPort.ts';
export { parsePartRig, normalizeInstrument, BASIC_KEYS, BASIC_KIT, type FactoryDesign } from '../../audio/hostInstruments.ts';
export type { PartMix, PartMixEntry, PartInstrument, PartRig } from '../../audio/partMix.ts';

export { createRecordingSync, decodeRecordingSync, type RecordingSyncMap, type RecordingSyncLocation,
  type RecordingScorePosition, type RecordingSyncResult, type RecordingSyncDiagnostic } from '../../audio/recordingSync.ts';

export type { AudioRecordingSource, YouTubeRecordingSource, RecordingSource, ScorePosition, ScoreLoop, PlaybackCapabilities } from '../../audio/playbackBackend.ts';
export type { PlaybackSnapshot } from '../../audio/playbackSession.ts';
