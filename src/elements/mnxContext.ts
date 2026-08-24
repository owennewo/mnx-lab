import { createContext } from '@lit/context';
import { MnxDocument } from '../model/mnx.ts';
import type { RenderedProjection } from '../engine/render/projection.ts';

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
 * `edit/`: note→cell, event→slice, container→lasso, voiceMeasure→run, partMeasure→panel,
 * measure/section→panel-wide, score→frame.
 */
export type EnclosureKind = 'cell' | 'slice' | 'lasso' | 'run' | 'panel' | 'panel-wide' | 'frame';

/**
 * One structural unit covered by a selection, translated into presentation
 * vocabulary by the host. `position` is the unit's metric onset normalized to
 * its measure (0..1); it gives a rest-only moment somewhere honest to stand
 * even though rests do not carry the note-key ids used by the ink overlay.
 *
 * Part/staff coordinates are model addresses, not renderer ordinals. The
 * viewer maps them onto the staves in the projection it just painted.
 */
export interface SelectionSpanUnit {
  measureIndex: number;
  partIndex?: number;
  staffIndex?: number;
  position?: number;
}

/**
 * The resolved structural footprint behind the selected note ids. Fine-grain
 * moments use their onsets; staff-measure and global-measure scopes own the
 * full bar cell. This stays deliberately smaller than `edit/`'s member union:
 * elements need geometry, never editor rung names or mutation addresses.
 */
export interface SelectionSpan {
  coverage: 'moment' | 'staff-measure' | 'measure';
  units: SelectionSpanUnit[];
}

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
  /** Workbench stage-1 input: an uncommitted fret candidate at this cell. */
  pendingFret?: number | null;
  /** Structural address used when no rendered note can anchor the column. */
  measureIndex?: number;
  partIndex?: number;
  staffIndex?: number;
  /** Cursor onset normalized to this measure's metric span, 0…1. */
  position?: number;
  anchorKeys: string[];
  /**
   * The cursor is somewhere no bar exists, and the vacancy is what gets drawn
   * rather than a fabricated bar:
   *
   *  - `part-measure` — a part exists but has no measure cell at all, so the
   *    whole viewport holds one panel-shaped vacancy.
   *  - `past-end` — the ghost bar one past the score's last (core-rung-insert.md),
   *    drawn in the last system's right margin. A place for the next bar; the
   *    keystroke that fills it is what writes it.
   */
  structuralEmpty?: 'part-measure' | 'past-end';
}

export interface SelectionContext {
  activePartId: string | null;
  activeMeasureIndex: number | null;
  activeVoiceIndex: number | null;
  activeEventIndex: number | null;
  selectedNoteIds: string[];
  /** Events lit by the selection. A REST has no notes, so it cannot travel in
   *  `selectedNoteIds` — and without an identity of its own the enclosure had
   *  nothing to enclose and fell back to interpolating a metric fraction
   *  across the bar, which drew the box on the wrong beat. */
  selectedEventIds?: string[];
  /** In the combined view, which rendering owns the input dialect. The same
   * model selection remains visible on the other projection as a dim echo. */
  primaryProjection?: RenderedProjection | null;
  /** Enclosure drawn around the selection footprint; absent/null = none. */
  enclosure?: EnclosureKind | null;
  /** Structural coverage, including rests and empty measure copies that have
   *  no note id and therefore cannot be recovered from selected SVG ink. */
  span?: SelectionSpan | null;
  /**
   * Light the section labels this enclosure encloses — the promised "label
   * chip lit" of the ladder's section rung (core-selection-ladder.md),
   * built by workbench-rung-legibility.md.
   *
   * Presentation only, like `enclosure` itself: the host decides that its
   * widest bar-level rung claims the labels and this one does not, and the
   * element renders the chip. It is a flag rather than a kind because the
   * SHAPE does not change — bar and section share `panel-wide` by design.
   */
  litLabels?: boolean | null;
  /** The cursor's cell, for the ghost when its position is empty. */
  cursor?: CursorGhost | null;
  /**
   * A CANDIDATE scope, drawn dashed beside the live selection — the tray's
   * scope preview (core-selection-tray-mechanism.md). Presentation only, like
   * everything else here: the host has not moved its selection, so the
   * footprint travels as note ids rather than as a rendered `.selected` class.
   */
  preview?: { enclosure: EnclosureKind; noteIds: string[] } | null;
}
export const selectionContext = createContext<SelectionContext>(Symbol('selection-context'));
