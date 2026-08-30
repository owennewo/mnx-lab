// Session state → HUD rows (roadmap/inprogress/core-score-hud.md).
//
// This mapping is the workbench's half of the HUD's neutral contract: the
// component (ScoreHud.ts) renders row data and knows nothing of the editor;
// THIS module speaks `edit/` freely — levels, the presence rule, the anchor
// voice — and flattens them into display rows. Rows are the ADDRESS chain
// (document → bar → part → voice → event → note); the highlight is
// the RUNG. Part is deliberately not a rung (the ladder is the vertical
// axis; part is the horizontal closure of part-measure), so the part row
// maps to `partMeasure`, the voice row to `voiceMeasure`.
import {
  type MnxEvent,
  type MnxPitch,
  type MnxSequence,
  type MnxStructure,
  type MnxTuningEntry
} from '../model/mnx.ts';
import type { EditorSession } from '../edit/session.ts';
import { eventAtCursor, slotAt } from '../edit/cursor.ts';
import {
  anchorVoiceIndex,
  presentLevels,
  type SelectionLevel
} from '../edit/selection.ts';
import { timeAt } from '../edit/inspector.ts';
import type { HudPart, HudRow } from './ScoreHud.ts';

/** Row key ↔ selection level. The component never sees the right-hand side. */
export const LEVEL_BY_ROW: Record<string, SelectionLevel> = {
  document: 'document',
  bar: 'measure',
  part: 'partMeasure',
  voice: 'voiceMeasure',
  event: 'event',
  note: 'note'
};

/** Exported for the rung chip (workbench-rung-legibility.md): the chip, the
 *  HUD and the tray share ONE rung vocabulary or none of them can be trusted. */
export const ROW_BY_LEVEL = Object.fromEntries(
  Object.entries(LEVEL_BY_ROW).map(([row, level]) => [level, row])
) as Record<SelectionLevel, string>;

function fmtPitch(pitch: MnxPitch): string {
  const alter = pitch.alter ?? 0;
  const accidental = alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter);
  return `${pitch.step}${accidental}${pitch.octave}`;
}

/** "quarter", "eighth." — one trailing dot per augmentation dot. */
function fmtDuration(duration: MnxEvent['duration'] | undefined): string {
  if (!duration) return '';
  return `${duration.base}${'.'.repeat(duration.dots ?? 0)}`;
}

/** The cursor's staff filter, matching buildGrid's per-staff voice numbering. */
function staffSequences(sequences: MnxSequence[] | undefined, staffIndex: number): MnxSequence[] {
  return (sequences ?? []).filter(seq => (seq.staff ?? 1) === staffIndex);
}


/** Display form of a string set, recited the way players do (low first). */
export function fmtTuning(strings: readonly MnxTuningEntry[]): string {
  return [...strings]
    .sort((a, b) => b.string - a.string)
    .map(entry => fmtPitch(entry.pitch))
    .join(' ');
}

/**
 * The containment chain at the cursor. Presence rule honored: a level the
 * ladder would skip (no sections anywhere, no event/note under the cursor)
 * gets NO row — the column always matches what the ladder keys can reach,
 * which is also what Shift+1..8 will refuse to jump to. `cursorHidden`
 * (Escape with nothing pending = deselect) drops the highlight but keeps the
 * address readable.
 */
export function buildHudRows(
  title: string,
  session: EditorSession,
  cursorHidden: boolean
): HudRow[] {
  const doc = session.doc;
  const cursor = session.cursor;
  const present = presentLevels(doc, session.positions, cursor, session.projection);
  const activeRow = cursorHidden ? null : ROW_BY_LEVEL[session.selectionLevel];

  const rows: HudRow[] = [];
  const row = (key: string, label: string, value: string) =>
    rows.push({ key, label, value, active: key === activeRow, activatable: true });

  // Each row carries the identity AND the properties that live at that level
  // of the document — the ladder's thesis, made readable.
  const measureCount = Math.max(
    doc.global.measures.length,
    ...doc.parts.map(part => part.measures?.length ?? 0)
  );
  const partCount = doc.parts.length;
  row(
    'document',
    'document',
    `${title} · ${measureCount} bar${measureCount === 1 ? '' : 's'} · ${partCount} part${partCount === 1 ? '' : 's'}`
  );

  const time = timeAt(doc, cursor.measureIndex);
  // Past the end of the score the cursor stands on the ghost bar
  // (core-rung-insert.md), which the document does not contain — so the row
  // names the vacancy rather than reading "13 of 12". The meter is the one the
  // bar would inherit if a keystroke made it real.
  row(
    'bar',
    'bar',
    session.pastEnd
      ? `new bar ${cursor.measureIndex + 1}${time ? ` · ${time.count}/${time.unit}` : ''}`
      : `${cursor.measureIndex + 1} of ${measureCount}${time ? ` · ${time.count}/${time.unit}` : ''}`
  );

  // The part row's value is the ensemble table (buildHudParts) — the
  // component substitutes it for this placeholder text.
  row('part', 'part', '');

  const partIndex = cursor.partIndex ?? 0;
  const staffIndex = cursor.staffIndex ?? 1;
  const sequences = staffSequences(
    doc.parts[partIndex]?.measures?.[cursor.measureIndex]?.sequences,
    staffIndex
  );
  const voice = anchorVoiceIndex(cursor);
  if (present.has('voiceMeasure')) {
    row('voice', 'voice', `${voice + 1} of ${sequences.length}`);
  }

  const event = present.has('event')
    ? eventAtCursor(doc, session.positions, cursor, session.projection)
    : undefined;
  if (event) {
    const beat = `beat ${cursor.onset.num}/${cursor.onset.den}`;
    const content = event.rest
      ? 'rest'
      : `${event.notes?.length ?? 0} note${(event.notes?.length ?? 0) === 1 ? '' : 's'}`;
    row('event', 'event', `${beat} · ${fmtDuration(event.duration)} ${content}`);
  }

  if (present.has('note')) {
    const slot = slotAt(session.positions, cursor, session.projection);
    const note = slot ? event?.notes?.[slot.noteIndex] : undefined;
    const where =
      session.projection === 'tab'
        ? `string ${cursor.line}`
        : `staff position ${cursor.line}`;
    row('note', 'note', note ? `${fmtPitch(note.pitch)} · ${where}` : where);
  }

  return rows;
}

/**
 * The ensemble table: every part with its declared strings/capo and its
 * override state (supplied by the page — presentation-only session state).
 * The cursor marker is only meaningful on multi-part scores.
 */
export function buildHudParts(
  doc: MnxStructure,
  overrideOf: (index: number) => { instrument: string; capo: number | null },
  cursorPartIndex = 0
): HudPart[] {
  const parts = doc.parts ?? [];
  return parts.map((part, index) => {
    const lab = part._x?.mnxLab;
    const declared =
      lab?.strings && lab.strings.length > 0
        ? fmtTuning(lab.strings) + (lab.capo ? ` · capo ${lab.capo}` : '')
        : null;
    const override = overrideOf(index);
    return {
      index,
      name: part.name ?? part.id ?? `part ${index + 1}`,
      declared,
      instrument: override.instrument,
      capo: override.capo,
      ...(parts.length > 1 && index === cursorPartIndex ? { cursor: true } : {})
    };
  });
}
