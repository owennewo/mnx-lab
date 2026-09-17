/**
 * What a mount does with the rung inspector besides showing it — shared by the
 * workbench's scenario page and the promoted binding (`editorHost.ts`), so the
 * inspector behaves the same over either (roadmap: core-editor-element-promotion,
 * slices 2–3). The element (`RungInspector.ts`) owns keys and drawing; the
 * grammar is `edit/inspector.ts`; this is the glue between them and a session.
 */
import type { EditorSession } from '../edit/session.ts';
import type { EditorIntent } from '../edit/intents.ts';
import { fingerboardOf, parseInspectorLine } from '../edit/inspector.ts';
import { findNoteAddress } from '../model/noteWalk.ts';
import { OVERLAY_EDGE_GAP, OVERLAY_MIRROR_MARGIN, OVERLAY_WIDTH, type OverlayAnchor } from './overlayPlacement.ts';

/** The inspector's typed line, read against where the cursor stands: an intent, or the sentence that says why not. */
export function inspectorLineIntent(session: EditorSession, word: string | null, text: string, key?: string): { intent: EditorIntent } | { error: string } {
  const noteKey = session.selectedNoteKeys[0];
  const pitch = noteKey ? findNoteAddress(session.doc, noteKey)?.note.pitch : undefined;
  const bar = session.doc.global?.measures?.[session.cursor.measureIndex];
  return parseInspectorLine(session.selectionLevel, word, text, {
    ...(pitch ? { pitch } : {}),
    fingerboard: noteKey ? fingerboardOf(session.doc, noteKey) : null,
    ...(key ? { key } : {}),
    tempoCount: bar?.tempos?.length ?? 0,
    harmonyCount: bar?._x?.mnxLab?.harmonies?.length ?? 0,
    layoutIds: (session.doc.layouts ?? []).map(layout => layout.id),
    scoreNames: (session.doc.scores ?? []).map(score => score.name)
  });
}

/** What the inspector says when the session declines an intent it was handed. */
export const INSPECTOR_REFUSAL = 'the document refused that — nothing to remove, or it does not fit';

/**
 * Fire an intent FROM the inspector. A point edit re-anchors the selection at
 * the note (the session's rule); the inspector is a view of ONE rung, so the
 * ladder is put back where it was — otherwise applying an event pill would drop
 * the cursor to the note rung and the pills would change under it.
 */
export function fireFromInspector(session: EditorSession, intent: EditorIntent): boolean {
  const level = session.selectionLevel;
  const ok = session.handleIntent(intent);
  const moved = intent.type === 'relaxSelection' || intent.type === 'tightenSelection' || intent.type === 'goToLevel'
    || intent.type === 'extendSelection' || intent.type === 'nextPosition' || intent.type === 'prevPosition';
  if (ok && !moved && session.selectionLevel !== level) session.handleIntent({ type: 'goToLevel', level });
  return ok;
}

/**
 * Which edge does the overlay hang from? Left-anchored by preference; mirrored
 * only when its right edge would pass the pane's right edge minus a margin AND
 * there is room to the left — mirroring into a clamp would move it for nothing.
 */
export function mirrorOverlayAt(anchor: OverlayAnchor, paneWidth: number): boolean {
  if (paneWidth <= 0) return false;
  return anchor.x + OVERLAY_WIDTH > paneWidth - OVERLAY_MIRROR_MARGIN && anchor.x + anchor.width - OVERLAY_WIDTH >= OVERLAY_EDGE_GAP;
}
