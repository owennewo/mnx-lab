// One sentence per clipboard outcome — core-selection-clipboard.md, stage 6 —
// and, since core-delete-clears-then-removes.md, per DELETE outcome too.
//
// Delete joined the clipboard's transient-notice channel rather than growing a
// second one: it is the same problem (a keystroke whose result is invisible
// needs a sentence) and the same answer, so the words live together where the
// conformance tests already pin them.
//
// The contract asks for clip kind, member count, detached references and the
// PRECISE refusal, without a clipboard panel: so the workbench shows a
// transient notice, and this module owns its words. DOM-free and beside the
// planners it describes, so the texts are pinned by conformance tests rather
// than read out of a rendered page.
import { isNavigationIntent, type EditorIntent } from './intents.ts';
import type { SelectionClip } from './selectionClip.ts';
import type { SelectionLevel } from './selection.ts';
import { KEY_DOCS, type KeyDoc } from './keymapDocs.ts';
import { EDIT_LAYER, NAVIGATION_LAYER } from './keymap.ts';
import type { DeleteOutcome } from './session.ts';
import type {
  CopySelectionResult,
  CutSelectionResult,
  PasteSelectionResult
} from './selectionClipboardActions.ts';

export interface ClipboardNotice {
  ok: boolean;
  message: string;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** What a clip holds, in the rung's own units — the typed-clipboard thesis
 *  (a note clip is not a phrase) said back to the user. */
export function describeSelectionClip(clip: SelectionClip): string {
  switch (clip.kind) {
    case 'note-set':
      return count(clip.notes.length, 'note');
    case 'event-run': {
      const items = clip.bars.reduce((sum, bar) => sum + bar.items.length, 0);
      return count(items, 'event') + (clip.span > 1 ? ` across ${count(clip.span, 'bar')}` : '');
    }
    case 'voice-bars':
      return count(clip.bars.length, 'voice bar');
    case 'part-bars':
      return count(clip.bars.length, 'part bar');
    case 'part':
      return `the part${clip.part.name ? ` ‘${clip.part.name}’` : ''} · ${count(clip.part.measures.length, 'bar')}`;
    case 'measures':
      return `${count(clip.measures.length, 'bar')} · ${count(clip.parts.length, 'part')}`;
    case 'document':
      return `the whole document · ${count(clip.document.parts.length, 'part')}, ${count(clip.document.global.measures.length, 'bar')}`;
  }
}

function detachedClause(n: number, verb: string): string {
  return n ? ` · ${count(n, 'reference')} ${verb}` : '';
}

export function copySelectionNotice(result: CopySelectionResult): ClipboardNotice {
  if (!result.ok) return { ok: false, message: `copy refused — ${result.message}` };
  const clip = result.envelope.clip;
  return {
    ok: true,
    message:
      `copied ${clip.kind} — ${describeSelectionClip(clip)}` +
      detachedClause(result.detached.length, 'detached at the boundary')
  };
}

export function cutSelectionNotice(result: CutSelectionResult): ClipboardNotice {
  if (!result.ok) {
    // The write-first contract's one distinct failure: the clip never made it
    // into the store, and the document is untouched — say both.
    if (result.code === 'clipboard-write-failed' || result.code === 'stale-session') {
      return { ok: false, message: `cut failed — ${result.message} The document is unchanged.` };
    }
    return { ok: false, message: `cut refused — ${result.message}` };
  }
  const clip = result.copied.envelope.clip;
  return {
    ok: true,
    message:
      `cut ${clip.kind} — ${describeSelectionClip(clip)}` +
      detachedClause(result.copied.detached.length, 'detached at the boundary') +
      detachedClause(result.plan.detachedTargetReferences, 'repaired in the document')
  };
}

export function pasteSelectionNotice(result: PasteSelectionResult): ClipboardNotice {
  if (!result.ok) {
    if (result.code === 'empty-clipboard') {
      return { ok: false, message: `nothing to paste — ${result.message}` };
    }
    return { ok: false, message: `paste refused — ${result.message}` };
  }
  const { clipKind, landing, detachedTargetReferences, accommodations } = result.plan;
  const at =
    landing.measureStart === landing.measureEnd
      ? `bar ${landing.measureStart + 1}`
      : `bars ${landing.measureStart + 1}–${landing.measureEnd + 1}`;
  // The accommodation report (core-paste-lands.md): what the document
  // yielded so the clip could land — the author reads this before deciding
  // whether to Ctrl+Z. Only non-zero clauses appear.
  const clauses = [
    accommodations.replacedDocument ? 'replaced the document' : '',
    accommodations.appendedBars
      ? `${count(accommodations.appendedBars, 'bar')} appended` : '',
    accommodations.createdParts
      ? `${count(accommodations.createdParts, 'part')} created` : '',
    accommodations.createdSequences
      ? `${count(accommodations.createdSequences, 'voice')} created` : '',
    accommodations.restFills
      ? `${count(accommodations.restFills, 'rest')} filled in` : '',
    accommodations.flaggedNotes
      ? `${count(accommodations.flaggedNotes, 'note')} flagged for the fingerboard` : '',
    accommodations.droppedMembers
      ? `${count(accommodations.droppedMembers, 'note')} dropped (no notehead left)` : ''
  ].filter(Boolean);
  return {
    ok: true,
    message:
      `pasted ${clipKind} at ${at}` +
      clauses.map(clause => ` · ${clause}`).join('') +
      detachedClause(detachedTargetReferences, 'repaired in the document')
  };
}

/** What each rung is CALLED when a sentence has to name the thing that went.
 *  The score rung's removal is a part (then the trailing bars), which is why
 *  `document` reads as one. */
const RUNG_NOUN: Record<SelectionLevel, string> = {
  note: 'note',
  event: 'event',
  voiceMeasure: 'voice bar',
  partMeasure: 'part bar',
  measure: 'bar',
  document: 'part'
};

/**
 * Delete's sentence — and the reason this item exists.
 *
 * The two presses mean different things, so press 1 has to say both what it
 * took AND that a second press is waiting; otherwise the ladder's most useful
 * property is invisible. A refusal is said out loud for the same reason: a
 * keystroke that produces neither a change nor a sentence is the bug the whole
 * rule was written against.
 */
export function deleteSelectionNotice(outcome: DeleteOutcome): ClipboardNotice {
  switch (outcome.kind) {
    case 'cleared':
      return {
        ok: true,
        message: outcome.thenRemoves
          ? `cleared ${count(outcome.notes, 'note')} — Del again to remove the ${RUNG_NOUN[outcome.level]}`
          : `deleted ${count(outcome.notes, 'note')}`
      };
    case 'removed':
      return {
        ok: true,
        message: `removed ${outcome.members === 1
          ? `the ${RUNG_NOUN[outcome.level]}`
          : count(outcome.members, RUNG_NOUN[outcome.level])}`
      };
    case 'refused':
      return {
        ok: false,
        message: `nothing left to delete at the ${RUNG_NOUN[outcome.level]} rung`
      };
  }
}

/**
 * Why an intent was declined.
 *
 *  - `read-only` — the piece cannot be edited here at all (another tab holds it).
 *  - `suspended` — the host is showing some other document, so there is no
 *    session to edit.
 *  - `unavailable` — the session declined: a rung this document does not
 *    present, an edit this position cannot take.
 *  - `playing` — nothing is edited while the music plays (core-single-cursor.md).
 *  - `inside-event` — a note typed inside another note or rest, which the editor
 *    cannot split yet; it may only go where one begins.
 *  - `wrap-misfit` — a tuplet asked of a selection that does not split into its
 *    count of one note value (3:2 over a quarter and two eighths).
 */
export type RefusalReason = 'read-only' | 'suspended' | 'unavailable' | 'playing' | 'inside-event' | 'wrap-misfit';

/**
 * Where the refused command was pressed — so the sentence can say WHY, not just
 * that it could not (the owner, 2026-11-08: T on two selected events answered
 * "That can't be done here", with no hint that T ties ONE note).
 */
export interface RefusalContext {
  level: SelectionLevel;
  /** How many things the selection holds at that rung. */
  members: number;
  /** What the session measured when it declined: the selection's length, in
   *  beats as the inspector reads them (`1 3/4 beats`). */
  selectedBeats?: string;
}

const RUNG_ONE: Record<SelectionLevel, string> = {
  note: 'a note', event: 'an event', voiceMeasure: 'one voice of a bar',
  partMeasure: 'one part of a bar', measure: 'a bar', document: 'the whole score'
};
const RUNG_MANY: Record<SelectionLevel, string> = {
  note: 'notes', event: 'events', voiceMeasure: 'voice-bars',
  partMeasure: 'part-bars', measure: 'bars', document: 'scores'
};

function selectionWords(context: RefusalContext): string {
  if (context.level === 'document') return 'the whole score is selected';
  return context.members > 1
    ? `${context.members} ${RUNG_MANY[context.level]} are selected`
    : `${RUNG_ONE[context.level]} is selected`;
}

/** The cheatsheet row a refused intent was pressed through: its key, and what
 *  it does at each rung (an absent rung is one where it does nothing). */
function keyDocFor(intent: EditorIntent): KeyDoc | null {
  const wanted = JSON.stringify(intent);
  for (const layer of [EDIT_LAYER, NAVIGATION_LAYER]) {
    for (const binding of layer.bindings) {
      if (JSON.stringify(binding.intent) !== wanted) continue;
      const doc = KEY_DOCS.find(row => row.strokes.some(stroke =>
        stroke.code === binding.code && !!stroke.shift === !!binding.shift && !!stroke.alt === !!binding.alt
        && !!stroke.ctrl === !!binding.ctrl && !!stroke.meta === !!binding.meta));
      if (doc) return doc;
    }
  }
  return null;
}

/** Why the session declined, from what the key does and where it was pressed. */
function unavailableWhy(intent: EditorIntent, context: RefusalContext): string | null {
  const doc = keyDocFor(intent);
  if (!doc) return null;
  const meaning = doc.meaning.all ?? doc.meaning[context.level];
  if (meaning) return `${doc.keys} \u2014 ${meaning}: nothing here it can do that to.`;
  const rungs = (Object.keys(doc.meaning) as SelectionLevel[]).filter(level => level in RUNG_ONE);
  if (rungs.length === 0) return null;
  const first = doc.meaning[rungs[0]!]!;
  const works = rungs.length === 1 ? RUNG_ONE[rungs[0]!] : rungs.map(level => RUNG_ONE[level]).join(' or ');
  return `${doc.keys} \u2014 ${first}: it works on ${works}, and ${selectionWords(context)}.`;
}

/**
 * One sentence for a refusal, or NOTHING where silence is the honest answer.
 *
 * This module exists because a keystroke whose result is invisible needs a
 * sentence, and a refusal is the purest case of that: on a piece held open in
 * another tab the cursor still moves — navigation is allowed read-only — so a
 * fret typed at a cursor sitting exactly where you put it simply vanished.
 *
 * The one thing that stays quiet is navigation that ran out of score. Pressing
 * → at the last bar is an EDGE, not a refusal, and a notice every time would be
 * noise in the place a reader spends most of their time. The decision lives
 * here rather than in a shell so that both the rule and its words are pinned by
 * the same conformance test.
 */
export function refusalNotice(intent: EditorIntent, reason: RefusalReason, context?: RefusalContext): ClipboardNotice | null {
  if (reason === 'unavailable' && isNavigationIntent(intent)) return null;
  // The binding already says *Pause to edit* beside the cursor; a second sentence elsewhere would be noise.
  if (reason === 'playing') return null;
  if (reason === 'suspended')
    return { ok: false, message: 'This is an older version — go back to the current one to edit it, or make this one current.' };
  if (reason === 'read-only')
    return { ok: false, message: 'This piece is open in another tab, so it is read only here. Close the other tab and reload to edit.' };
  if (reason === 'inside-event')
    return { ok: false, message: 'A note can\u2019t start inside another note or rest yet \u2014 only where one begins.' };
  if (reason === 'wrap-misfit') {
    const spec = intent.type === 'wrapInContainer' && intent.spec.type === 'tuplet' ? intent.spec
      : intent.type === 'toggleTriplet' ? { inner: { multiple: 3 }, outer: { multiple: 2 } } : null;
    const ratio = spec ? `${spec.inner.multiple}:${spec.outer.multiple}` : 'A tuplet';
    const parts = spec ? `${spec.inner.multiple} equal note values` : 'equal note values';
    const have = context?.selectedBeats ? ` \u2014 the selection adds up to ${context.selectedBeats}` : '';
    return { ok: false, message: `${ratio} needs notes that split into ${parts}${have}. Select the run it should hold (a quarter and an eighth make a triplet of eighths).` };
  }
  const why = context ? unavailableWhy(intent, context) : null;
  return { ok: false, message: why ?? 'That can\u2019t be done here.' };
}
