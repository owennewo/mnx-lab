import { createContext } from '@lit/context';
import { MnxDocument } from '../types/mnx.ts';

export interface PlaybackState {
  playing: boolean;
  tempo: number;
  volume: number; // in dB
  playheadTime: number; // visual tick position
  activeNoteIds: string[];
}

export const mnxDocumentContext = createContext<MnxDocument | null>(Symbol('mnx-document'));
export const playbackStateContext = createContext<PlaybackState>(Symbol('playback-state'));

export interface SelectionContext {
  activePartId: string | null;
  activeMeasureIndex: number | null;
  activeVoiceIndex: number | null;
  activeEventIndex: number | null;
  selectedNoteIds: string[];
}
export const selectionContext = createContext<SelectionContext>(Symbol('selection-context'));
