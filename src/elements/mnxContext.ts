import { createContext } from '@lit/context';
import { MnxDocument } from '../model/mnx.ts';

export interface PlaybackState {
  playing: boolean;
  tempo: number;
  volume: number; // in dB
  playheadTime: number; // visual tick position
  activeNoteIds: string[];
}

export const mnxDocumentContext = createContext<MnxDocument | null>(Symbol('mnx-document'));
export const playbackStateContext = createContext<PlaybackState>(Symbol('playback-state'));

/**
 * The selection-ladder enclosure vocabulary (roadmap/inprogress/
 * core-selection-ladder.md) — PRESENTATION ONLY. The workbench maps editor
 * selection levels onto these shapes so `elements/` never learns about
 * `edit/`: note→cell, event→slice, voiceMeasure→run, partMeasure→panel,
 * measure/section→panel-wide, score→frame.
 */
export type EnclosureKind = 'cell' | 'slice' | 'run' | 'panel' | 'panel-wide' | 'frame';

/**
 * The input cursor's cell for the ghost overlay (selection-ladder map):
 * where the cursor stands when NO note is there — a place for a thing,
 * drawn hollow. `anchorKeys` are note keys at the cursor's beat (any voice),
 * used to locate the column in the rendered SVG.
 */
export interface CursorGhost {
  /** True when a note sits exactly at the cursor's cell (the solid cell is
   *  already drawn from the selection footprint — no ghost needed). */
  occupied: boolean;
  /** Notation projection: staff position (half-spaces from middle, +up). */
  staffPosition: number | null;
  /** Tab projection: string number (1 = top line). */
  string: number | null;
  anchorKeys: string[];
}

export interface SelectionContext {
  activePartId: string | null;
  activeMeasureIndex: number | null;
  activeVoiceIndex: number | null;
  activeEventIndex: number | null;
  selectedNoteIds: string[];
  /** Enclosure drawn around the selection footprint; absent/null = none. */
  enclosure?: EnclosureKind | null;
  /** The cursor's cell, for the ghost when its position is empty. */
  cursor?: CursorGhost | null;
}
export const selectionContext = createContext<SelectionContext>(Symbol('selection-context'));
