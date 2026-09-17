import type { ScorePosition } from './scorePosition.ts';
import type { TransportSnapshot } from './transport.ts';
export type { ScorePosition } from './scorePosition.ts';
export interface AudioRecordingSource {
  readonly kind: 'audio';
  /** Stable within a document; 'synth' is reserved. */
  readonly id: string;
  readonly name: string;
  /** URLs belong to the host; Blob object URLs are created/revoked by the adapter. */
  readonly media: string | Blob;
  readonly syncpoints: unknown;
}
export interface YouTubeRecordingSource {
  readonly kind: 'youtube';
  readonly id: string;
  readonly name: string;
  /** A supported YouTube URL or an eleven-character video ID. */
  readonly video: string;
  readonly syncpoints: unknown;
}
export type RecordingSource = AudioRecordingSource | YouTubeRecordingSource;
export interface PlaybackCapabilities {
  readonly rate: { readonly min: number; readonly max: number; readonly step: number; readonly values?: readonly number[] };
  readonly volume: boolean;
  readonly loop: 'exact' | 'seek' | 'none';
  readonly parts: boolean;
}
export const SYNTH_CAPABILITIES: PlaybackCapabilities = Object.freeze({ rate: { min: 0.25, max: 2, step: 0.05 }, volume: true, loop: 'exact', parts: true });
export const AUDIO_CAPABILITIES: PlaybackCapabilities = Object.freeze({ ...SYNTH_CAPABILITIES, loop: 'seek', parts: false });
export interface BackendSnapshot {
  readonly sourceId: string;
  readonly kind: 'synth' | 'audio' | 'youtube';
  readonly state: 'stopped' | 'paused' | 'playing' | 'buffering';
  readonly scorePosition: ScorePosition | null;
  readonly highlight: readonly { noteKey: string; ordinal: number }[];
  readonly hidePlayhead: boolean;
  readonly rate: number;
  readonly volume: number;
  readonly mediaTime?: number;
  /** Where the media clock is relative to the score anchors. Unanchored
   *  pre/post-roll is normal playback state, never a sync diagnostic. */
  readonly mediaPhase?: 'pre-roll' | 'mapped' | 'post-roll' | 'unmapped';
  /** The anchored media interval and, once prepared, the decoded file end. */
  readonly mediaBounds?: {
    readonly startSeconds: number;
    readonly endSeconds: number;
    readonly durationSeconds?: number;
  };
  readonly syncIssue?: string;
  readonly error?: string;
  /** Present only for synth. No synthetic onsets/clock are fabricated for media. */
  readonly transport?: TransportSnapshot;
}
export interface ScoreLoop { readonly start: ScorePosition; readonly end: ScorePosition }
export interface PlaybackBackend {
  readonly id: string;
  readonly resumeOnSelect?: boolean;
  readonly capabilities: PlaybackCapabilities;
  readonly snapshot: BackendSnapshot;
  subscribe(listener: () => void): () => void;
  prepare(): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  /** Null means this position can be sought; an explanation means it cannot. */
  canSeek(position: ScorePosition, edge?: 'before' | 'after'): string | null;
  seek(position: ScorePosition, edge?: 'before' | 'after'): void | Promise<void>;
  setRate(rate: number): number;
  setVolume(volume: number): number;
  setLoop(loop?: ScoreLoop): void;
  dispose(): void;
}
export function boundedRate(value: number, capabilities: PlaybackCapabilities): number {
  if (!Number.isFinite(value)) value = 1;
  const { min, max, step, values } = capabilities.rate;
  if (values?.length) return values.reduce((best, next) => Math.abs(next - value) < Math.abs(best - value) ? next : best);
  return Math.min(max, Math.max(min, Math.round(value / step) / Math.round(1 / step)));
}
