// Environment-facing copy/paste orchestration.
//
// The store belongs above document/session lifetime. These helpers are the
// one boundary where an async app clipboard is read or written; extraction,
// planning and the eventual session mutation remain DOM-free and testable.
import type { EditorSession } from './session.ts';
import type { SelectionClipboardStore } from './selectionClipboard.ts';
import {
  extractSelectionClip,
  type SelectionClipExtractionResult
} from './selectionClipExtraction.ts';
import {
  planSelectionPaste,
  type PastePlan,
  type PasteRefusal
} from './selectionPastePlanner.ts';

export type CopySelectionResult = SelectionClipExtractionResult;

export type PasteSelectionResult =
  | { ok: true; plan: PastePlan }
  | PasteRefusal
  | { ok: false; code: 'empty-clipboard'; message: string };

/** Materialize before awaiting the write: Copy always captures the selection
 *  that existed when the command began, not wherever the user navigated while
 *  a future store implementation was resolving. */
export async function copySelectionToStore(
  session: EditorSession,
  store: SelectionClipboardStore
): Promise<CopySelectionResult> {
  const result = extractSelectionClip(session.doc, session.selection, session.projection);
  if (!result.ok) return result;
  await store.write(result.serialized);
  return result;
}

/** Read and fully plan outside EditorSession, then commit only the accepted,
 *  materialized plan. The recorded intent contains that plan, so trace replay
 *  has no dependency on this store or on later clipboard contents. */
export async function pasteSelectionFromStore(
  session: EditorSession,
  store: SelectionClipboardStore
): Promise<PasteSelectionResult> {
  const serialized = await store.read();
  if (serialized === null) {
    return { ok: false, code: 'empty-clipboard', message: 'There is no copied selection to paste.' };
  }
  const plan = planSelectionPaste(
    serialized,
    session.doc,
    session.selection,
    session.projection
  );
  if (!plan.ok) return plan;
  session.handleIntent({ type: 'applyPastePlan', plan });
  return { ok: true, plan };
}
