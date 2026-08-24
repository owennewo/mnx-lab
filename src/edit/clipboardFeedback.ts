// One sentence per clipboard outcome — core-selection-clipboard.md, stage 6.
//
// The contract asks for clip kind, member count, detached references and the
// PRECISE refusal, without a clipboard panel: so the workbench shows a
// transient notice, and this module owns its words. DOM-free and beside the
// planners it describes, so the texts are pinned by conformance tests rather
// than read out of a rendered page.
import type { SelectionClip } from './selectionClip.ts';
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
    case 'container-run': {
      const containers = clip.bars.reduce((sum, bar) => sum + bar.containers.length, 0);
      return count(containers, 'rhythm container');
    }
    case 'voice-bars':
      return count(clip.bars.length, 'voice bar');
    case 'staff-bars':
      return count(clip.bars.length, 'staff bar');
    case 'part':
      return `the part${clip.part.name ? ` ‘${clip.part.name}’` : ''} · ${count(clip.part.measures.length, 'bar')}`;
    case 'measures':
      return `${count(clip.measures.length, 'bar')} · ${count(clip.parts.length, 'part')}`;
    case 'section': {
      const bars = clip.sections.reduce((sum, section) => sum + section.measures.length, 0);
      return `${count(clip.sections.length, 'section')} · ${count(bars, 'bar')}`;
    }
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
