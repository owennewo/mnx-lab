/**
 * What the viewer draws for an editing session: the cursor, the selection's
 * members, its enclosure and its span — an `EditorSession`'s state translated
 * into the deliberately smaller geometry vocabulary `<mnx-document-viewer>`
 * accepts as `.selection` (`mnxContext.ts`).
 *
 * Promoted out of the workbench's scenario page with the editor's mount
 * (roadmap: core-editor-element-promotion, slice 1), where it was the body of
 * `syncFromSession`. This is the ONE module in `elements/` that knows both
 * vocabularies; the viewer still knows shapes and never editor levels. The
 * binding (`editorHost.ts`) is its one caller now that both shells sit on it.
 */
import type { EnclosureKind, SelectionContext, SelectionSpan } from './mnxContext.ts';
import type { MnxStructure } from '../model/mnx.ts';
import type { EditorSession } from '../edit/session.ts';
import type { SelectionLevel, SelectionMember } from '../edit/selection.ts';
import { measureSpans } from '../edit/cursor.ts';
import { eventAtAddress } from '../edit/ops.ts';
import { syntheticEventKey } from '../model/noteKeys.ts';

/** Ladder level → enclosure shape (roadmap/complete/core-selection-ladder.md).
 *  The mapping lives HERE, in the one module that knows both vocabularies, so the
 *  viewer knows shapes and never editor levels. */
const ENCLOSURE_BY_LEVEL: Record<SelectionLevel, EnclosureKind> = {
  note: 'cell',
  event: 'slice',
  voiceMeasure: 'run',
  partMeasure: 'panel',
  measure: 'panel-wide',
  document: 'frame'
};

/** Which rungs claim the section labels they enclose. Empty since the
 *  section rung retired (core-selection-range-grain.md); the channel stays
 *  for any future rung that owns a label strip. */
const LIT_LABEL_LEVELS = new Set<SelectionLevel>();

/** Translate editor membership into the deliberately smaller geometry
 * vocabulary accepted by `elements/`. Rests survive as onset-bearing moments;
 * empty voice/part/global bar copies survive as full-measure units. */
/**
 * The keys of the selected events that are RESTS — the only ones that need
 * this channel, because every other event is lit through its notes.
 *
 * Real `event.id` first, exactly as notes prefer their own id; the synthetic
 * key otherwise, and the layout mints the same one from the same coordinates,
 * so the two sides meet without a shared table.
 */
function selectedRestKeys(
  doc: MnxStructure,
  members: readonly SelectionMember[]
): string[] {
  const keys: string[] = [];
  for (const member of members) {
    if (member.kind !== 'note' && member.kind !== 'event') continue;
    const event = eventAtAddress(doc, {
      partIndex: member.partIndex,
      staffIndex: member.staffIndex,
      measureIndex: member.measureIndex,
      voiceIndex: member.voiceIndex,
      eventIndex: member.eventIndex,
      ...(member.containerIndex === undefined ? {} : { containerIndex: member.containerIndex })
    });
    if (!event?.rest) continue;
    keys.push(
      event.id ??
        syntheticEventKey({
          partIndex: member.partIndex,
          measureIndex: member.measureIndex,
          staffIndex: member.staffIndex,
          voiceIndex: member.voiceIndex,
          eventIndex: member.eventIndex,
          ...(member.containerIndex === undefined ? {} : { containerIndex: member.containerIndex })
        })
    );
  }
  return keys;
}

function presentationSpan(
  doc: MnxStructure,
  level: SelectionLevel,
  members: readonly SelectionMember[]
): SelectionSpan | null {
  if (level === 'document') return null;
  const spans = measureSpans(doc);
  const coverage: SelectionSpan['coverage'] =
    level === 'note' || level === 'event'
      ? 'moment'
      : level === 'voiceMeasure' || level === 'partMeasure'
        ? 'staff-measure'
        : 'measure';
  const units: SelectionSpan['units'] = [];
  const push = (
    measureIndex: number,
    partIndex?: number,
    staffIndex?: number,
    onset?: { num: number; den: number }
  ) => {
    const measure = spans[measureIndex] ?? { num: 1, den: 1 };
    const raw = onset
      ? (onset.num / onset.den) / Math.max(Number.EPSILON, measure.num / measure.den)
      : undefined;
    units.push({
      measureIndex,
      ...(partIndex === undefined ? {} : { partIndex }),
      ...(staffIndex === undefined ? {} : { staffIndex }),
      ...(raw === undefined ? {} : { position: Math.max(0, Math.min(1, raw)) })
    });
  };
  for (const member of members) {
    switch (member.kind) {
      case 'note':
      case 'event':
        push(member.measureIndex, member.partIndex, member.staffIndex, member.onset);
        break;
      case 'voiceMeasure':
        push(member.measureIndex, member.partIndex, member.staffIndex);
        break;
      case 'partMeasure':
        // The whole part's bar: one unit per staff, so the enclosure's
        // barline join merges them into ONE panel (the both-view precedent).
        for (
          let staff = 1;
          staff <= Math.max(1, doc.parts?.[member.partIndex]?.staves ?? 1);
          staff++
        ) {
          push(member.measureIndex, member.partIndex, staff);
        }
        break;
      case 'measure':
        push(member.measureIndex);
        break;
      case 'document':
        break;
    }
  }
  // Chords and coincident container members share one presentation anchor.
  const seen = new Set<string>();
  return {
    coverage,
    units: units.filter(unit => {
      const key = [unit.measureIndex, unit.partIndex ?? '', unit.staffIndex ?? '', unit.position ?? ''].join(':');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  };
}

export const enclosureFor = (level: SelectionLevel): EnclosureKind => ENCLOSURE_BY_LEVEL[level];

/** What the mount knows that the session does not. */
export interface EditorSelectionView {
  /** Escape deselected: view chrome, never session history. */
  cursorHidden: boolean;
  /** A half-typed fret, shown in the cursor until it resolves. */
  pendingFret: number | null;
  /** A footprint lit without moving the session (the tray's rung preview, a lyric caret). */
  preview?: SelectionContext['preview'];
}

export function selectionContextFor(session: EditorSession, view: EditorSelectionView): SelectionContext {
  const cursor = session.cursor;
  const partIndex = cursor.partIndex ?? 0;
  const staffIndex = cursor.staffIndex ?? 1;
  const measureSpan = measureSpans(session.doc)[cursor.measureIndex] ?? { num: 1, den: 1 };
  const rawPosition =
    (cursor.onset.num / cursor.onset.den) /
    Math.max(Number.EPSILON, measureSpan.num / measureSpan.den);
  const activePart = session.doc.parts?.[partIndex];
  const cursorGhost: NonNullable<SelectionContext['cursor']> = {
    ...session.cursorContext(),
    measureIndex: cursor.measureIndex,
    partIndex,
    staffIndex,
    position: Math.max(0, Math.min(1, rawPosition)),
    pendingFret: session.projection === 'tab' ? view.pendingFret : null,
    ...(
      activePart &&
      (session.doc.global?.measures?.length ?? 0) === 0 &&
      (activePart.measures?.length ?? 0) === 0
        ? { structuralEmpty: 'part-measure' as const }
        // The ghost bar past the end (core-rung-insert.md): the cursor is
        // standing where the next bar would go, and the vacancy is drawn
        // there instead of a cell in a bar that does not exist.
        : session.pastEnd
          ? { structuralEmpty: 'past-end' as const }
          : {}
    )
  };
  return {
    activePartId: activePart?.id ?? null,
    activeMeasureIndex: cursor.measureIndex,
    activeVoiceIndex: null,
    activeEventIndex: null,
    selectedNoteIds: view.cursorHidden ? [] : session.selectedNoteKeys,
    selectedEventIds: view.cursorHidden
      ? []
      : selectedRestKeys(session.doc, session.resolvedSelection.members),
    primaryProjection: session.projection,
    enclosure: view.cursorHidden ? null : ENCLOSURE_BY_LEVEL[session.selectionLevel],
    litLabels: !view.cursorHidden && LIT_LABEL_LEVELS.has(session.selectionLevel),
    span: view.cursorHidden
      ? null
      : presentationSpan(session.doc, session.selectionLevel, session.resolvedSelection.members),
    cursor: view.cursorHidden ? null : cursorGhost,
    preview: view.preview ?? null
  };
}
