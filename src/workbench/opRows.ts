// The ops panel's display rows — the element-ops exemplar's provenance
// columns (roadmap/inprogress/core-element-ops-exemplar.md): each op-queue
// entry renders as op · provoking intent · the key/surface that produced it.
// Provenance is forward-stamped by the session (opQueue); this module only
// REVERSE-JOINS intent type → key label through the keymap's own tables —
// workbench-tier, receiving editor types and producing display strings, the
// same layering as hudRows.ts. An intent with no binding and no surface
// renders "(no key)" honestly: the panel is a live gap detector.
import type { EditorIntent } from '../edit/intents.ts';
import type { EditOp, OpLogEntry } from '../edit/ops.ts';
import type { MnxTuningEntry } from '../model/mnx.ts';
import { EDIT_LAYER, NAVIGATION_LAYER, TAB_DIGIT_LAYER } from '../edit/keymap.ts';
import { KEY_DOCS, SURFACE_INTENTS, strokeKey } from '../edit/keymapDocs.ts';
import { parseTuning, TUNING_PRESET_NAMES } from '../edit/setupGrammar.ts';

export interface OpRow {
  /** What changed — the op, human-readable. */
  op: string;
  /** What provoked it — the stamped intent ('—' for foreign ops, e.g. a
   *  future AI-emitted EditOp[] with no intent provenance). */
  intent: string;
  /** The key or surface that produces the intent, via the reverse join. */
  keys: string;
}

/** Human labels for the shell surfaces SURFACE_INTENTS names. */
const SURFACE_LABELS: Record<string, string> = {
  timeSignaturePopover: 'Shift+T · popover',
  tuningPopover: 'Shift+U · popover',
  partPopover: 'Shift+P · popover',
  commandPalette: 'Ctrl+K · palette',
  goTo: 'Ctrl+G · go-to',
  viewSwitcher: 'view tabs'
};

/** intent type → display key label: a binding's KeyDoc row when one claims
 *  the type, else the emitting surface, else the honest gap. */
function keyLabelFor(type: string): string {
  const binding = [
    ...NAVIGATION_LAYER.bindings,
    ...EDIT_LAYER.bindings,
    ...TAB_DIGIT_LAYER.bindings
  ].find(b => b.intent.type === type);
  if (binding) {
    const stroke = strokeKey(binding);
    const row = KEY_DOCS.find(doc => doc.strokes.some(s => strokeKey(s) === stroke));
    if (row) return row.keys;
  }
  const surface = Object.entries(SURFACE_INTENTS).find(([, types]) => types.includes(type));
  if (surface) return SURFACE_LABELS[surface[0]] ?? surface[0];
  return '(no key)';
}

/** The tuning as the popover grammar would have taken it: a preset name when
 *  one matches, else the pitch list recited low string first. */
function tuningText(tuning: MnxTuningEntry[]): string {
  for (const name of TUNING_PRESET_NAMES) {
    if (JSON.stringify(parseTuning(name)) === JSON.stringify(tuning)) return name;
  }
  return [...tuning]
    .sort((a, b) => b.string - a.string)
    .map(t => `${t.pitch.step}${t.pitch.alter === 1 ? '#' : t.pitch.alter === -1 ? 'b' : ''}${t.pitch.octave}`)
    .join(' ');
}

const onsetText = (onset: [number, number]) => `${onset[0]}/${onset[1]}`;
const durationText = (d: { base: string; dots?: number }) => `${d.base}${'·'.repeat(d.dots ?? 0)}`;

function opLabel(op: EditOp): string {
  switch (op.type) {
    case 'transposeSelection':
      return `transpose ${op.semitones > 0 ? '+' : ''}${op.semitones} (${op.noteIds?.length ?? 'all'} notes)`;
    case 'setFret':
      return `fret ${op.fret} on s${op.string} · ${op.noteId}`;
    case 'insertNote':
      return `insert fret ${op.fret} on s${op.string} @ m${op.measureIndex + 1} ${onsetText(op.onset)} (${durationText(op.duration)})`;
    case 'insertPitchNote':
      return `insert ${op.pitch.step}${op.pitch.octave} @ m${op.measureIndex + 1} ${onsetText(op.onset)} (${durationText(op.duration)})`;
    case 'deleteNote':
      return `delete note ${op.noteId}`;
    case 'setDuration':
      return `duration ${durationText(op.duration)} @ m${op.measureIndex + 1} ${onsetText(op.onset)}`;
    case 'nudgeRest':
      return `nudge rest ${op.delta > 0 ? 'up' : 'down'} @ m${op.measureIndex + 1} ${onsetText(op.onset)}`;
    case 'toggleTie':
      return `toggle tie · ${op.noteId}`;
    case 'setTimeSignature':
      return `time ${op.time.count}/${op.time.unit} @ m${op.measureIndex + 1}`;
    case 'setTuning':
      return `tuning · ${tuningText(op.tuning)}`;
    case 'setStaffKind':
      return `tab staff · ${op.kind}`;
    case 'appendMeasure':
      return 'append bar';
    case 'addPart':
      return `add part${op.name ? ` “${op.name}”` : op.partId ? ` ${op.partId}` : ' (anonymous)'}`;
  }
}

function intentLabel(intent: EditorIntent): string {
  switch (intent.type) {
    case 'fretDigit':
      return `fret digit ${intent.digit}`;
    case 'toggleNote':
      return 'toggle note';
    case 'delete':
      return 'delete';
    case 'shorterDuration':
      return 'shorter duration';
    case 'longerDuration':
      return 'longer duration';
    case 'toggleTie':
      return 'toggle tie';
    case 'transpose':
      return `transpose ${intent.semitones > 0 ? '+' : ''}${intent.semitones}`;
    case 'appendMeasure':
      return 'append bar';
    case 'setTimeSignature':
      return `“${intent.count}/${intent.unit}”`;
    case 'setTuning':
      return `“${tuningText(intent.tuning)}”`;
    case 'addPart':
      return intent.name ? `“${intent.name}”` : '“” (anonymous)';
    case 'setStaffKind':
      return `staff kind ${intent.kind}`;
    default:
      return intent.type;
  }
}

export function buildOpRow(entry: OpLogEntry): OpRow {
  return {
    op: opLabel(entry.op),
    intent: entry.intent ? intentLabel(entry.intent) : '—',
    keys: entry.intent ? keyLabelFor(entry.intent.type) : '(no key)'
  };
}
