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
  partName,
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
  /** What the meta line says about the rung. */
  primary: string;
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
    m.kind === 'section' ? [m.start] : 'measureIndex' in m ? [m.measureIndex] : []
  ))].sort((a, b) => a - b);
  const spansBars = measureIndices.length > 1;

  const crumbs: InspectorCrumb[] = rows.map(row => {
    const rowLevel = LEVEL_BY_ROW[row.key];
    let label = row.value ? `${row.label} ${row.value}` : row.label;
    if (row.key === 'bar')
      label = session.pastEnd
        ? row.value
        : spansBars && row.active
          ? `bars ${measureIndices[0]! + 1}–${measureIndices[measureIndices.length - 1]! + 1}`
          : `bar ${row.value}`;
    else if (row.key === 'part') label = partName(doc, cursor.partIndex ?? 0);
    else if (row.key === 'section') label = row.value.split(' · ')[0] ?? row.value;
    else if (row.key === 'document') label = 'document';
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
  const active = rows.find(r => r.active);
  const count = members.length;
  return {
    crumbs,
    pills,
    words,
    primary: active ? `${active.label}${active.value ? ` ${active.value}` : ''}` : 'no rung',
    secondary: count > 1 ? `${count} ${level === 'measure' ? 'bars' : 'members'} · half-tone = on some` : '',
    note: session.pastEnd
      ? 'a bar that does not exist yet has nothing to inspect'
      : words.length === 0
        ? rungNote(level)
        : null
  };
}
