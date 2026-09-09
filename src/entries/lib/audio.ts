// mnx-lab/audio — pure compilation, exact time and bounded MIDI export.
export { compilePerformance, serializePerformance, parsePerformance } from '../../audio/performance.ts';
export { exportMidi, quantizeTick, MIDI_PPQ, type MidiResult, type MidiDiagnostic, type MidiAllocation } from '../../audio/midiFile.ts';
export * from '../../audio/time.ts';
export type * from '../../audio/performanceTypes.ts';
export type { Sink, SinkEvent, SinkVoice } from '../../audio/sink.ts';

export { Transport, eventsBetween, centsAt, type Clock, type LoopRegion, type TransportSnapshot, type TransportEvent, type TransportOptions } from '../../audio/transport.ts';
export { NativeSink, nativeClock, type NativeSinkOptions } from '../../audio/native/sink.ts';
