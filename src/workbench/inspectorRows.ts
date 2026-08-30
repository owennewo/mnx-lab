// Session state → rung-inspector view (roadmap/inprogress/workbench-rung-inspector.md).
//
// The shell's half: the crumbs ARE the HUD's rows (one rung vocabulary, per
// hudRows.ts) laid horizontally, so this module reads `buildHudRows` and
// glues its labels to the machinery in edit/inspector.ts — siblings, pills,
// words. Nothing here is worth a headless test that the machinery does not
// already get.
import type { EditorSession } from '../edit/session.ts';
import {
  crumbSiblings,
  pillsFor,
  rungNote,
  wordsFor,
  type InspectorCrumb,
  type InspectorPill,
  type InspectorWord
} from '../edit/inspector.ts';
import { buildHudRows, LEVEL_BY_ROW } from './hudRows.ts';

export interface InspectorView {
  crumbs: InspectorCrumb[];
  pills: InspectorPill[];
  words: InspectorWord[];
  /** What the foot says about a range (empty for one member). */
  secondary: string;
  /** Why there are no pills, when there are none by design. */
  note: string | null;
}

/** The whole view for the current session state. */
export function buildInspectorView(
  title: string,
  session: EditorSession,
  cursorHidden: boolean
): InspectorView {
  const doc = session.doc;
  const cursor = session.cursor;
  const rows = buildHudRows(title, session, cursorHidden);
  const level = session.selectionLevel;
  const members = session.resolvedSelection.members;
  // A range: the measures the selection spans, for the bar crumb's label.
  const measureIndices = [...new Set(members.flatMap(m =>
    'measureIndex' in m ? [m.measureIndex] : []
  ))].sort((a, b) => a - b);
  const spansBars = measureIndices.length > 1;

  // The window's text: the rung's name and its 1-based index, nothing else
  // (the design's slot-machine rule). Indices come from the first member
  // where the HUD's row does not carry one.
  const first = members[0];
  const indexOf = (key: string): string => {
    switch (key) {
      case 'bar':
        return session.pastEnd
          ? `${cursor.measureIndex + 1} (new)`
          : spansBars
            ? `${measureIndices[0]! + 1}–${measureIndices[measureIndices.length - 1]! + 1}`
            : `${cursor.measureIndex + 1}`;
      case 'part':
        return `${(cursor.partIndex ?? 0) + 1}`;
      case 'voice':
        return `${(cursor.voiceIndex ?? 0) + 1}`;
      case 'event':
      case 'container':
        return first && 'eventIndex' in first ? `${first.eventIndex + 1}` : '';
      case 'note':
        return first && first.kind === 'note' ? `${first.noteIndex + 1}` : '';
      default:
        return '';
    }
  };
  // How many siblings the rung has — said on the CURRENT row only
  // (`note 1 of 4`), so the faded rows stay plain names.
  const partIndex = cursor.partIndex ?? 0;
  const partMeasure = doc.parts?.[partIndex]?.measures?.[cursor.measureIndex];
  const sequence = partMeasure?.sequences?.[cursor.voiceIndex ?? 0];
  const countOf = (key: string): number => {
    switch (key) {
      case 'bar':
        return doc.global.measures.length;
      case 'part':
        return doc.parts?.length ?? 0;
      case 'voice':
        return partMeasure?.sequences?.length ?? 0;
      case 'event':
      case 'container':
        return sequence?.content?.length ?? 0;
      case 'note': {
        const event = first && 'eventIndex' in first ? sequence?.content?.[first.eventIndex] : undefined;
        return (event as { notes?: unknown[] } | undefined)?.notes?.length ?? 0;
      }
      default:
        return 0;
    }
  };
  const crumbs: InspectorCrumb[] = rows.map(row => {
    const rowLevel = LEVEL_BY_ROW[row.key];
    const index = indexOf(row.key);
    const count = row.active && /^\d+$/.test(index) ? countOf(row.key) : 0;
    const label = index ? `${row.label} ${index}${count > 1 ? ` of ${count}` : ''}` : row.label;
    return {
      key: row.key,
      level: rowLevel,
      label,
      active: row.active === true,
      siblings: crumbSiblings(doc, row.key, cursor)
    };
  });

  const live = !cursorHidden && !session.pastEnd;
  const pills = live ? pillsFor({ doc, level, members }) : [];
  const words = live ? wordsFor(level) : [];
  const count = members.length;
  return {
    crumbs,
    pills,
    words,
    secondary: count > 1 ? `${count} ${level === 'measure' ? 'bars' : 'members'} · half-tone = on some` : '',
    note: session.pastEnd
      ? 'a bar that does not exist yet has nothing to inspect'
      : words.length === 0
        ? rungNote(level)
        : null
  };
}
