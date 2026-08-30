// Pure, authoritative removal planning for Cut.
//
// Unlike ordinary Delete, this planner may remove captured ink. It returns a
// complete detached result or a typed refusal and never writes a clipboard or
// editor history.
import type { MnxSequenceItem, MnxStructure } from '../model/mnx.ts';
import { itemSpan, type Projection } from './cursor.ts';
import { applyOp, type EditOp, type EventAddress } from './ops.ts';
import {
  resolveSelection,
  type SelectionMember,
  type SelectionState
} from './selection.ts';
import type { SelectionClipEnvelope } from './selectionClip.ts';
import {
  pruneDanglingSelectionReferences,
  removeSelectionMeasureColumns,
  removeSelectionPart,
  replaceSelectionStaffMaterial
} from './selectionStructuralEdit.ts';

export type CutRefusalCode =
  | 'empty-selection'
  | 'score-unavailable'
  | 'part-closure-required'
  | 'missing-source-member'
  | 'unrepresentable-silence';

export interface CutRefusal {
  ok: false;
  code: CutRefusalCode;
  message: string;
}

export interface CutPlan {
  ok: true;
  clipKind: SelectionClipEnvelope['clip']['kind'];
  document: MnxStructure;
  removedMembers: number;
  detachedTargetReferences: number;
}

export type CutPlanResult = CutPlan | CutRefusal;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function refuse(code: CutRefusalCode, message: string): CutRefusal {
  return { ok: false, code, message };
}

function clipKindFor(state: SelectionState): CutPlan['clipKind'] {
  switch (state.level) {
    case 'note': return 'note-set';
    case 'event': return 'event-run';
    case 'container': return 'container-run';
    case 'voiceMeasure': return 'voice-bars';
    case 'partMeasure': return state.extent.kind === 'closure' ? 'part' : 'staff-bars';
    case 'measure': return 'measures';
    case 'document': return 'document';
  }
}

function eventAddress(member: Extract<SelectionMember, { kind: 'event' }>): EventAddress {
  return {
    partIndex: member.partIndex,
    staffIndex: member.staffIndex,
    measureIndex: member.measureIndex,
    voiceIndex: member.voiceIndex,
    eventIndex: member.eventIndex,
    ...(member.containerIndex === undefined ? {} : { containerIndex: member.containerIndex })
  };
}

function sequenceAt(
  doc: MnxStructure,
  member: Extract<SelectionMember, { kind: 'voiceMeasure' }>
) {
  return doc.parts[member.partIndex]?.measures[member.measureIndex]?.sequences[member.sequenceIndex];
}

function removeVoiceDeclarations(
  doc: MnxStructure,
  member: Extract<SelectionMember, { kind: 'voiceMeasure' }>,
  voice: string | undefined
): void {
  const measure = doc.parts[member.partIndex]?.measures[member.measureIndex];
  if (!measure) return;
  const owns = (entry: { staff?: number; voice?: string }): boolean =>
    (entry.staff ?? 1) === member.staffIndex &&
    (entry.voice === undefined ? member.voiceIndex === 0 : entry.voice === voice);
  const removeOwned = <K extends 'dynamics' | 'directions' | 'ottavas'>(key: K): void => {
    const entries = measure[key] as ({ staff?: number; voice?: string }[] | undefined);
    const kept = (entries ?? []).filter(entry => !owns(entry));
    if (kept.length) (measure as unknown as Record<string, unknown>)[key] = kept;
    else delete (measure as unknown as Record<string, unknown>)[key];
  };
  removeOwned('dynamics');
  removeOwned('directions');
  removeOwned('ottavas');
}

/** Build the exact document mutation represented by the captured selection. */
export function planSelectionCut(
  document: MnxStructure,
  state: SelectionState,
  projection: Projection
): CutPlanResult {
  if (state.level === 'document') {
    return refuse(
      'score-unavailable',
      'A complete score cannot be cut; document deletion belongs to its library.'
    );
  }
  if (
    state.level === 'partMeasure' &&
    state.extent.kind === 'closure' &&
    state.extent.scope !== 'part'
  ) {
    return refuse('part-closure-required', 'Cutting a part requires the complete part closure.');
  }
  const resolved = resolveSelection(document, state, projection);
  if (!resolved.members.length) {
    return refuse('empty-selection', 'The current selection has no material to cut.');
  }

  let next = cloneJson(document);
  let detachedTargetReferences = 0;
  switch (state.level) {
    case 'note': {
      const ops: EditOp[] = [...resolved.noteKeys].reverse().map(noteKey =>
        /\.k\d+$/.test(noteKey)
          ? { type: 'removeKitNote', noteKey }
          : { type: 'deleteNote', noteId: noteKey }
      );
      next = applyOp(next, ops.length === 1 ? ops[0] : { type: 'batch', ops });
      break;
    }
    case 'event': {
      const ops = resolved.members.flatMap(member =>
        member.kind === 'event'
          ? [{ type: 'clearEvent' as const, event: eventAddress(member) }]
          : []
      );
      next = applyOp(next, ops.length === 1 ? ops[0] : { type: 'batch', ops });
      break;
    }
    case 'container': {
      const members = [...resolved.members].reverse().filter(
        (member): member is Extract<SelectionMember, { kind: 'container' }> => member.kind === 'container'
      );
      for (const member of members) {
        const sequence = next.parts[member.partIndex]?.measures[member.measureIndex]
          ?.sequences[member.sequenceIndex];
        const item = sequence?.content[member.eventIndex];
        if (!sequence || !item) return refuse('missing-source-member', 'A selected container no longer exists.');
        const span = itemSpan(item);
        if (!Number.isFinite(span.num) || !Number.isFinite(span.den) || span.den <= 0 || span.num < 0) {
          return refuse('unrepresentable-silence', 'The selected container has no exact representable duration.');
        }
        if (span.num === 0) sequence.content.splice(member.eventIndex, 1);
        else sequence.content.splice(member.eventIndex, 1, {
          type: 'space',
          duration: [span.num, span.den]
        } as unknown as MnxSequenceItem);
      }
      break;
    }
    case 'voiceMeasure': {
      const members = [...resolved.members].reverse().filter(
        (member): member is Extract<SelectionMember, { kind: 'voiceMeasure' }> => member.kind === 'voiceMeasure'
      );
      for (const member of members) {
        const sequence = sequenceAt(next, member);
        const measure = next.parts[member.partIndex]?.measures[member.measureIndex];
        if (!sequence || !measure) return refuse('missing-source-member', 'A selected voice bar no longer exists.');
        removeVoiceDeclarations(next, member, sequence.voice);
        measure.sequences.splice(member.sequenceIndex, 1);
      }
      break;
    }
    case 'partMeasure': {
      if (state.extent.kind === 'closure') {
        detachedTargetReferences += removeSelectionPart(next, state.anchor.partIndex ?? 0);
      } else {
        const members = resolved.members.filter(
          (member): member is Extract<SelectionMember, { kind: 'partMeasure' }> => member.kind === 'partMeasure'
        );
        for (const member of members) {
          const measure = next.parts[member.partIndex]?.measures[member.measureIndex];
          if (!measure) return refuse('missing-source-member', 'A selected staff bar no longer exists.');
          replaceSelectionStaffMaterial(measure, null, member.staffIndex);
        }
      }
      break;
    }
    case 'measure': {
      const indices = resolved.members.flatMap(member => member.kind === 'measure' ? [member.measureIndex] : []);
      detachedTargetReferences += removeSelectionMeasureColumns(next, indices);
      break;
    }
  }

  detachedTargetReferences += pruneDanglingSelectionReferences(next);
  return {
    ok: true,
    clipKind: clipKindFor(state),
    document: cloneJson(next),
    removedMembers: resolved.members.length,
    detachedTargetReferences
  };
}
