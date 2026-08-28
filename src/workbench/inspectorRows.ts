// Session state → rung-inspector view (roadmap/inprogress/workbench-rung-inspector.md).
//
// The shell's half: the crumbs ARE the HUD's rows (one rung vocabulary, per
// hudRows.ts) laid horizontally, so this module reads `buildHudRows` and
// glues its labels to the machinery in edit/inspector.ts — siblings, pills,
// words. Nothing here is worth a headless test that the machinery does not
// already get.
import type { EditorSession } from '../edit/session.ts';
import {
  BAR_WORDS,
  crumbSiblings,
  measurePills,
  partName,
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
  const measureCount = doc.global.measures.length;

  const crumbs: InspectorCrumb[] = rows.map(row => {
    const level = LEVEL_BY_ROW[row.key];
    let label = row.value ? `${row.label} ${row.value}` : row.label;
    if (row.key === 'bar') label = session.pastEnd ? row.value : `bar ${row.value}`;
    else if (row.key === 'part') label = partName(doc, cursor.partIndex ?? 0);
    else if (row.key === 'section') label = row.value.split(' · ')[0] ?? row.value;
    else if (row.key === 'document') label = 'document';
    return {
      key: row.key,
      level,
      label,
      active: row.active === true,
      siblings: crumbSiblings(doc, row.key, cursor)
    };
  });

  const level = session.selectionLevel;
  const atBar = level === 'measure' && !cursorHidden;
  const pills = atBar && !session.pastEnd ? measurePills(doc, cursor.measureIndex) : [];
  const active = rows.find(r => r.active);
  return {
    crumbs,
    pills,
    words: atBar && !session.pastEnd ? BAR_WORDS : [],
    primary: active ? `${active.label}${active.value ? ` ${active.value}` : ''}` : 'no rung',
    secondary: atBar ? `${measureCount} bar${measureCount === 1 ? '' : 's'}` : '',
    note: atBar
      ? session.pastEnd
        ? 'a bar that does not exist yet has nothing to inspect'
        : null
      : 'attributes at this rung arrive in a later stage — the crumbs walk and go to'
  };
}
