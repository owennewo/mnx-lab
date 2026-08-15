// Session state → HUD rows (roadmap/inprogress/core-score-hud.md).
//
// This mapping is the workbench's half of the HUD's neutral contract: the
// component (ScoreHud.ts) renders row data and knows nothing of the editor;
// THIS module speaks `edit/` freely — levels, the presence rule, the anchor
// voice — and flattens them into display rows. Rows are the ADDRESS chain
// (score → section → bar → part → voice → event → note); the highlight is
// the RUNG. Part is deliberately not a rung (the ladder is the vertical
// axis; part is the horizontal closure of part-measure), so the part row
// maps to `partMeasure`, the voice row to `voiceMeasure`.
import {
  isTimedEvent,
  type MnxEvent,
  type MnxPitch,
  type MnxSequence,
  type MnxStructure,
  type MnxTuningEntry
} from '../model/mnx.ts';
import type { EditorSession } from '../edit/session.ts';
import { addOnsets, itemSpan, onsetsEqual, slotAt, type Onset } from '../edit/cursor.ts';
import {
  anchorVoiceIndex,
  presentLevels,
  sectionRangeAt,
  type SelectionLevel
} from '../edit/selection.ts';
import type { HudPart, HudRow } from './ScoreHud.ts';

/** Row key ↔ selection level. The component never sees the right-hand side. */
export const LEVEL_BY_ROW: Record<string, SelectionLevel> = {
  score: 'score',
  section: 'section',
  bar: 'measure',
  part: 'partMeasure',
  voice: 'voiceMeasure',
  event: 'event',
  note: 'note'
};

const ROW_BY_LEVEL = Object.fromEntries(
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

/** The staff-1 filter, restated from the layouts (see cursor.ts header). */
function staffOneSequences(sequences: MnxSequence[] | undefined): MnxSequence[] {
  return (sequences ?? []).filter(seq => (seq.staff ?? 1) === 1);
}

/** The timed event starting exactly at `onset` in one voice, walking the
 *  content the same way the grid does. */
function eventAt(sequence: MnxSequence | undefined, onset: Onset): MnxEvent | null {
  if (!sequence) return null;
  let at: Onset = { num: 0, den: 1 };
  for (const item of sequence.content) {
    if (onsetsEqual(at, onset)) return isTimedEvent(item) ? item : null;
    at = addOnsets(at, itemSpan(item));
  }
  return null;
}

/** The bar's effective time signature: the last global `time` at or before it. */
function timeAt(doc: MnxStructure, measureIndex: number): { count: number; unit: number } | null {
  let time: { count: number; unit: number } | null = null;
  for (let i = 0; i <= measureIndex && i < doc.global.measures.length; i++) {
    const t = doc.global.measures[i]?.time;
    if (t) time = t;
  }
  return time;
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
 * gets NO row — the column always matches what Escape/Enter can reach.
 * `cursorHidden` (Esc past the top = the conventional deselect) drops the
 * highlight but keeps the address readable.
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
    doc.parts[0]?.measures?.length ?? 0
  );
  const partCount = doc.parts.length;
  row(
    'score',
    'score',
    `${title} · ${measureCount} bar${measureCount === 1 ? '' : 's'} · ${partCount} part${partCount === 1 ? '' : 's'}`
  );

  if (present.has('section')) {
    const range = sectionRangeAt(doc, cursor.measureIndex)!;
    const label = doc.global.measures[range.start]?.section?.label ?? '—';
    row('section', 'section', `${label} · m${range.start + 1}–${range.end}`);
  }

  const time = timeAt(doc, cursor.measureIndex);
  row(
    'bar',
    'bar',
    `${cursor.measureIndex + 1} of ${measureCount}${time ? ` · ${time.count}/${time.unit}` : ''}`
  );

  // The part row's value is the ensemble table (buildHudParts) — the
  // component substitutes it for this placeholder text.
  row('part', 'part', '');

  const sequences = staffOneSequences(doc.parts[0]?.measures?.[cursor.measureIndex]?.sequences);
  const voice = anchorVoiceIndex(cursor);
  if (present.has('voiceMeasure')) {
    row('voice', 'voice', `${voice + 1} of ${sequences.length}`);
  }

  const event = present.has('event') ? eventAt(sequences[voice], cursor.onset) : null;
  if (event) {
    const beat = `beat ${cursor.onset.num}/${cursor.onset.den}`;
    const content = event.rest
      ? 'rest'
      : `${event.notes?.length ?? 0} note${(event.notes?.length ?? 0) === 1 ? '' : 's'}`;
    row('event', 'event', `${beat} · ${fmtDuration(event.duration)} ${content}`);
  }

  if (present.has('note')) {
    const slot = slotAt(session.positions, cursor, session.projection);
    const item = slot ? sequences[slot.voiceIndex]?.content[slot.eventIndex] : undefined;
    const note = slot && item && isTimedEvent(item) ? item.notes?.[slot.noteIndex] : undefined;
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
 * The cursor marker is only meaningful on multi-part scores (and the cursor
 * lives on parts[0] until multi-part navigation exists).
 */
export function buildHudParts(
  doc: MnxStructure,
  overrideOf: (index: number) => { instrument: string; capo: number | null }
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
      ...(parts.length > 1 && index === 0 ? { cursor: true } : {})
    };
  });
}
