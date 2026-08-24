// The ops panel's display rows — the element-ops exemplar's provenance
// columns (roadmap/complete/core-element-ops-exemplar.md): each op-queue
// entry renders as op · provoking intent · the key/surface that produced it.
// Provenance is forward-stamped by the session (opQueue); this module only
// REVERSE-JOINS intent type → key label through the keymap's own tables —
// workbench-tier, receiving editor types and producing display strings, the
// same layering as hudRows.ts. An intent with no binding and no surface
// renders "(no key)" honestly: the panel is a live gap detector.
import type { EditorIntent } from '../edit/intents.ts';
import type { EditOp, EntryTarget, MeasureAttribute, OpLogEntry } from '../edit/ops.ts';
import type { MnxTuningEntry } from '../model/mnx.ts';
import { EDIT_LAYER, NAVIGATION_LAYER, TAB_DIGIT_LAYER } from '../edit/keymap.ts';
import { KEY_DOCS, SURFACE_INTENTS, strokeKey } from '../edit/keymapDocs.ts';
import { CLEF_NAME_LIST, parseClef, parseTuning, TUNING_PRESET_NAMES } from '../edit/setupGrammar.ts';

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
  clefPopover: 'Shift+C · popover',
  keySignaturePopover: 'Shift+K · popover',
  barAttributePopover: 'Shift+B · popover',
  adornmentPopover: 'Shift+A · popover',
  lyricPopover: 'Shift+L · popover',
  rhythmPopover: 'Shift+R · popover',
  selectionTray: '/ · tray',
  commandPalette: 'Ctrl+G › · palette',
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
  ].find(b => b.intent.type === type || (type === 'enterFret' && b.intent.type === 'tabDigit'));
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

/** The clef as its popover name, when it has one — the same reverse-join
 *  posture as `tuningText`: show what the user would have typed. */
function clefText(clef: { sign: string; staffPosition?: number; octave?: number }): string {
  for (const name of CLEF_NAME_LIST) {
    const parsed = parseClef(name);
    if (
      parsed &&
      parsed !== 'inherit' &&
      parsed.sign === clef.sign &&
      parsed.staffPosition === (clef.staffPosition ?? parsed.staffPosition) &&
      (parsed.octave ?? 0) === (clef.octave ?? 0)
    )
      return name;
  }
  return `${clef.sign}${clef.staffPosition ?? ''}`;
}

/** Fifths as the key name a player would say, with the count in parentheses. */
function keyText(fifths: number): string {
  const names = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  const name = names[fifths + 7];
  return name ? `${name} (${fifths > 0 ? '+' : ''}${fifths})` : `${fifths}`;
}

const onsetText = (onset: [number, number]) => `${onset[0]}/${onset[1]}`;

/** The write address, spoken only when it is NOT the default one (part 1,
 *  staff 1, voice 1). The ops panel is provenance, and "which voice did that
 *  land in" is the question the entry surface made worth asking — but saying
 *  it on every row would bury the answer in the ordinary case. */
function whereText(target: EntryTarget): string {
  const said = [
    target.partIndex ? `part ${target.partIndex + 1}` : '',
    target.staffIndex && target.staffIndex !== 1 ? `staff ${target.staffIndex}` : '',
    target.voiceIndex ? `voice ${target.voiceIndex + 1}` : ''
  ].filter(Boolean);
  return said.length > 0 ? ` · ${said.join(' ')}` : '';
}
const durationText = (d: { base: string; dots?: number }) => `${d.base}${'·'.repeat(d.dots ?? 0)}`;

function opLabel(op: EditOp): string {
  switch (op.type) {
    case 'batch':
      return `${op.ops.length} edits · ${op.ops[0] ? opLabel(op.ops[0]) : 'empty'}${op.ops.length > 1 ? ` · +${op.ops.length - 1} more` : ''}`;
    case 'pasteSelection':
      return `paste ${op.clipKind}${op.detachedTargetReferences ? ` · ${op.detachedTargetReferences} detached ref${op.detachedTargetReferences === 1 ? '' : 's'}` : ''}`;
    case 'cutSelection':
      return `cut ${op.clipKind} · ${op.removedMembers} member${op.removedMembers === 1 ? '' : 's'}`;
    case 'transposeSelection':
      return `transpose ${op.semitones > 0 ? '+' : ''}${op.semitones} (${op.noteIds?.length ?? 'all'} notes)`;
    case 'setFret':
      return `fret ${op.fret} on s${op.string} · ${op.noteId}`;
    case 'insertNote':
      return `insert fret ${op.fret} on s${op.string} @ m${op.measureIndex + 1} ${onsetText(op.onset)} (${durationText(op.duration)})${whereText(op)}`;
    case 'insertPitchNote':
      return `insert ${op.pitch.step}${op.pitch.octave} @ m${op.measureIndex + 1} ${onsetText(op.onset)} (${durationText(op.duration)})${whereText(op)}`;
    case 'deleteNote':
      return `delete note ${op.noteId}`;
    case 'clearEvent':
      return `clear event @ m${op.event.measureIndex + 1}`;
    case 'setDuration':
      return `duration ${durationText(op.duration)} @ m${op.measureIndex + 1} ${onsetText(op.onset)}${whereText(op)}`;
    case 'nudgeRest':
      return `nudge rest ${op.delta > 0 ? 'up' : 'down'} @ m${op.measureIndex + 1} ${onsetText(op.onset)}${whereText(op)}`;
    case 'toggleTie':
      return `toggle tie · ${op.noteId}`;
    case 'setTimeSignature':
      return `time ${op.time.count}/${op.time.unit} @ m${op.measureIndex + 1}`;
    case 'removeTimeSignature':
      return `time inherited @ m${op.measureIndex + 1}`;
    case 'setTuning':
      return `tuning · ${tuningText(op.tuning)}`;
    case 'setStaffKind':
      return `tab staff · ${op.kind}`;
    case 'appendMeasure':
      return `append bar${whereText({ partIndex: op.partIndex })}`;
    case 'insertMeasure':
      return `insert bar ${op.side} m${op.measureIndex + 1}${whereText({ partIndex: op.partIndex })}`;
    case 'removeMeasure':
      return `remove bar m${op.measureIndex + 1} (empty)`;
    case 'removePart':
      return 'remove part (empty)';
    case 'addPart':
      return `${op.partIndex === undefined ? 'add' : `insert`} part${
        op.name ? ` “${op.name}”` : op.partId ? ` ${op.partId}` : ' (anonymous)'
      }${op.partIndex === undefined ? '' : ` at ${op.partIndex + 1}`}`;
    case 'setClef':
      return `clef ${clefText(op)} @ m${op.measureIndex + 1}`;
    case 'removeClef':
      return `clef inherited @ m${op.measureIndex + 1}`;
    case 'setKeySignature':
      return `key ${keyText(op.fifths)} @ m${op.measureIndex + 1}`;
    case 'removeKeySignature':
      return `key inherited @ m${op.measureIndex + 1}`;
    case 'setMeasureAttribute':
      return `${attributeText(op.attribute)} @ m${op.measureIndex + 1}`;
    case 'removeMeasureAttribute':
      return `no ${op.kind} @ m${op.measureIndex + 1}`;
    case 'setSlur':
      return `slur ${op.fromNoteKey} → ${op.toNoteKey}`;
    case 'removeSlur':
      return `remove slur at ${op.noteKey}`;
    case 'setTieVariant':
      return `tie ${op.lv ? 'l.v.' : (op.targetType ?? 'variant')} · ${op.noteId}`;
    case 'setSyllable':
      return `lyric ${op.line}: “${op.text}” · ${op.noteKey}`;
    case 'removeSyllable':
      return `no lyric ${op.line} · ${op.noteKey}`;
    case 'setLyricLine':
      return `lyric line ${op.line}${op.label ? ` “${op.label}”` : ''}`;
    case 'removeLyricLine':
      return `no lyric line ${op.line}`;
    case 'setTechnique':
      return `${op.technique.kind} · ${op.noteKey}`;
    case 'removeTechnique':
      return `no ${op.kind} · ${op.noteKey}`;
    case 'removeStringAnnotation':
      return `no string · ${op.noteKey}`;
    case 'setFingering':
      return `fingering ${op.hand} ${op.finger} · ${op.noteKey}`;
    case 'removeFingering':
      return `no fingering · ${op.noteKey}`;
    case 'removeContainer':
      return `remove container @ m${op.measureIndex + 1} (empty)`;
    case 'addVoiceMeasure':
      return `add voice bar @ m${op.measureIndex + 1} (full of rests)${whereText(op)}`;
    case 'removeVoiceMeasure':
      return `remove voice bar @ m${op.measureIndex + 1} (empty)`;
    case 'removePartMeasure':
      return `remove staff bar @ m${op.measureIndex + 1} (empty)`;
    case 'wrapInContainer': {
      const span = op.to - op.from + 1;
      const what =
        op.spec.type === 'tuplet'
          ? `${op.spec.inner.multiple} ${op.spec.inner.duration.base} in ${op.spec.outer.multiple} ${op.spec.outer.duration.base}`
          : op.spec.type === 'tremolo'
            ? `tremolo${op.spec.marks === undefined ? '' : ` ${op.spec.marks}`}`
            : 'grace';
      return `wrap ${span} event${span === 1 ? '' : 's'} in ${what} @ m${op.measureIndex + 1}`;
    }
    case 'respellNote':
      return `respell ${op.noteId}`;
    case 'setSupport':
      return `${op.value ? 'declare' : 'un-declare'} ${op.key === 'useBeams' ? 'explicit beams' : 'explicit accidentals'}`;
    case 'setRestSpelling':
      return `respell rest as ${durationText(op.duration)} @ m${op.measureIndex + 1} ${onsetText(op.onset)}`;
    case 'insertSpace':
      return `insert space ${onsetText(op.duration)} @ m${op.measureIndex + 1}`;
    case 'removeKitNote':
      return `remove kit note ${op.noteKey}`;
    case 'removeKitComponent':
      return `remove kit component “${op.component}”`;
    case 'removeSound':
      return `remove sound “${op.sound}”`;
    case 'setAccidentalDisplay':
      return `accidental ${op.show ? 'shown' : 'hidden'} · ${op.noteKey}`;
    case 'removeAccidentalDisplay':
      return `accidental auto · ${op.noteKey}`;
    case 'setLayout':
      return `layout ${op.index + 1} · ${op.layout.id} · ${op.layout.content.length} node${op.layout.content.length === 1 ? '' : 's'}`;
    case 'setScore':
      return `score ${op.index + 1} · ${op.score.name ?? 'untitled'}`;
    case 'addMultimeasureRest':
      return `multimeasure rest ${op.start} ×${op.duration} (score ${op.scoreIndex + 1})`;
    case 'removeLayout':
      return `remove layout ${op.index + 1}`;
    case 'removeScore':
      return `remove score ${op.index + 1}`;
    case 'removeMultimeasureRest':
      return `remove multimeasure rest ${op.index + 1} (score ${op.scoreIndex + 1})`;
    case 'setPartDeclaration':
      return `part ${op.declaration.kind} ${op.declaration.value}`;
    case 'removePartDeclaration':
      return `part: no ${op.kind}`;
    case 'setMarking':
      return `${op.marking} · ${op.noteKey ?? eventAddressText(op.event)}`;
    case 'removeMarking':
      return `no ${op.marking} · ${op.noteKey ?? eventAddressText(op.event)}`;
    case 'setPositioned': {
      const where = `@ m${op.measureIndex + 1} ${onsetText(op.onset)}`;
      if (op.attribute.kind === 'dynamic')
        return `dynamic ${op.attribute.value ?? (op.attribute.glyphs ?? []).join(' ')} ${where}`;
      if (op.attribute.kind === 'ottava')
        return `ottava ${op.attribute.value > 0 ? '+' : ''}${op.attribute.value} ${where}`;
      return `text “${op.attribute.text}” ${where}`;
    }
    case 'removePositioned':
      return `no ${op.kind} @ m${op.measureIndex + 1}`;
    case 'setBeam':
      return `beam events ${op.from}–${op.to} @ m${op.measureIndex + 1}`;
    case 'removeBeam':
      return `remove beam @ m${op.measureIndex + 1}`;
    case 'setFullMeasureRest':
      return `full-measure rest @ m${op.measureIndex + 1}`;
    case 'removeFullMeasureRest':
      return `no full-measure rest @ m${op.measureIndex + 1}`;
    case 'setMeasureRepeat':
      return `measure repeat ${op.number} @ m${op.measureIndex + 1}`;
    case 'removeMeasureRepeat':
      return `no measure repeat @ m${op.measureIndex + 1}`;
  }
}

function eventAddressText(
  address: Extract<EditOp, { type: 'setMarking' }>['event']
): string {
  if (!address) return 'event';
  return `p${address.partIndex + 1} s${address.staffIndex} m${address.measureIndex + 1} v${address.voiceIndex + 1} e${address.eventIndex + 1}`;
}

/** A bar attribute as the popover grammar would have taken it. */
function attributeText(attribute: MeasureAttribute): string {
  switch (attribute.kind) {
    case 'barline':
      return `barline ${attribute.type}`;
    case 'repeatStart':
      return 'repeat start';
    case 'repeatEnd':
      return `repeat end${attribute.times !== undefined ? ` ${attribute.times}` : ''}`;
    case 'ending':
      return `ending ${(attribute.numbers ?? []).join(',')}${attribute.open ? ' open' : ''}`.trim();
    case 'segno':
      return 'segno';
    case 'fine':
      return 'fine';
    case 'jump':
      return `jump ${attribute.type}`;
    case 'tempo':
      return `tempo ${attribute.base}=${attribute.bpm}`;
    case 'rehearsal':
      return `rehearsal ${attribute.label}`;
    case 'section':
      return `section ${attribute.label}`;
  }
}

function intentLabel(intent: EditorIntent): string {
  switch (intent.type) {
    case 'enterFret':
      return `enter fret ${intent.fret}`;
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
    case 'insertAtRung':
      return `insert ${intent.side}`;
    case 'goToEdge':
      return `go to the ${intent.edge} bar`;
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
