// The edit seam — deliberately a placeholder (structure-lab). This is the
// point the editor UI and the AI loop are intended to CONVERGE on: today the
// assist loop replaces whole documents; the plan is for it to emit EditOp[]
// instead, and for editor chrome to funnel through applyOp, so undo/redo,
// validation and provenance all live in one place. Three ops prove the shape;
// grow the union as real editing features land.
import type {
  MnxEvent,
  MnxNote,
  MnxNoteValueBase,
  MnxPart,
  MnxSequence,
  MnxStructure,
  MnxTuningEntry
} from '../model/mnx.ts';
import type { EditorIntent } from './intents.ts';
import { isTimedEvent } from '../model/mnx.ts';
import {
  addOnsets,
  forEachKeyedNote,
  itemSpan,
  noteKeyOf,
  onsetLess,
  onsetsEqual,
  type Onset
} from './cursor.ts';
import { capoOf, midiOfPitch, tuningOf } from './tabStrings.ts';

// Note addressing: every `noteId(s)` field accepts a note's real `id` OR its
// synthetic positional key (src/model/noteKeys.ts) — most spec mirrors carry
// no ids, and the cursor must be able to edit them too. Positional ops
// (insert/setDuration) address (measureIndex, onset-as-whole-note-fraction)
// in voice 0 of staff 1 — the entry surface phase 2 defines.
export type EditOp =
  | {
      /** Shift the selected notes (or every note) by a signed semitone count. */
      type: 'transposeSelection';
      semitones: number;
      noteIds?: string[];
    }
  | {
      /** Put one note on (string, fret): sets flat `_x.mnxLab.string`/`fret`
       *  AND the pitch the fingerboard place sounds — the fret is a choice,
       *  the pitch its consequence (string 1 = highest-pitched). */
      type: 'setFret';
      noteId: string;
      string: number;
      fret: number;
    }
  | {
      /** Insert a note at a metric position in voice 0 (an existing event
       *  there gains a chord member; a rest there becomes the note; empty
       *  space gains a new event of `duration`). Pitch derives from
       *  string+fret against the part's tuning. */
      type: 'insertNote';
      measureIndex: number;
      onset: [number, number];
      string: number;
      fret: number;
      duration: { base: MnxNoteValueBase; dots?: number };
    }
  | {
      /** Insert a note BY PITCH at a metric position in voice 0 — the
       *  notation projection's entry (spatial cursor + toggle; the
       *  selection-ladder navigation map). Same event/rest/insert mechanics
       *  as `insertNote`; a chord member on the same letter+octave is
       *  replaced (one staff position, one note). No string/fret is written
       *  — tab derives positions from pitch as usual. */
      type: 'insertPitchNote';
      measureIndex: number;
      onset: [number, number];
      pitch: { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; alter?: number };
      duration: { base: MnxNoteValueBase; dots?: number };
    }
  | {
      /** Remove one note; a now-empty event becomes a rest of the same
       *  duration, so the measure's grid does not shift under the cursor. */
      type: 'deleteNote';
      noteId: string;
    }
  | {
      /** Re-value the voice-0 event at a metric position. */
      type: 'setDuration';
      measureIndex: number;
      onset: [number, number];
      duration: { base: MnxNoteValueBase; dots?: number };
    }
  | {
      /** Nudge the voice-0 rest at a metric position vertically —
       *  `rest.staffPosition`, in half-staff-spaces, +up. The §8.11
       *  polymorphic verb: Alt+↑↓ re-pitches a note, repositions a rest. */
      type: 'nudgeRest';
      measureIndex: number;
      onset: [number, number];
      delta: number;
    }
  | {
      /** Tie the note to the SAME pitch in the immediately following event
       *  (same voice, or the next measure's first event); toggles off if the
       *  note is already tied. Mints a deterministic id on the target when it
       *  has none — MNX ties point at note ids. */
      type: 'toggleTie';
      noteId: string;
    }
  | {
      /** Set the time signature on a global measure (persists until changed). */
      type: 'setTimeSignature';
      measureIndex: number;
      time: { count: number; unit: number };
    }
  | {
      /** Declare the part's string tuning (`_x.mnxLab.strings`). */
      type: 'setTuning';
      tuning: MnxTuningEntry[];
    }
  | {
      /** Declare the part's tab staff preference (`_x.mnxLab.tab.staffKind`).
       *  Presentation, but document-level: it gates the tab/both projections
       *  (engine/headless), so the goldens — and the construct-trace verdict
       *  — see it. Discovered by the element-ops exemplar. */
      type: 'setStaffKind';
      kind: 'notation' | 'tab' | 'both';
    }
  | {
      /** Append an empty measure to every part and the global timeline. */
      type: 'appendMeasure';
    }
  | {
      /** Add a part (id/name both optional — an anonymous part is legal
       *  MNX), materializing the document skeleton on demand: construct
       *  traces start from the literal `{}` and genesis is ops, not chrome
       *  (roadmap/complete/core-element-ops-exemplar.md). New part measures
       *  align with the global timeline. */
      type: 'addPart';
      partId?: string;
      name?: string;
    }
  | {
      /** Remove one measure column (the global measure + every part's) —
       *  refused while the bar holds any note, anywhere. The campaign's
       *  anti-cheat rule refined: a CONTAINER may be removed only once it is
       *  empty, so removal never destroys ink implicitly; the bar's own
       *  attributes (time signature, barline) go with their container. */
      type: 'removeMeasure';
      measureIndex: number;
    }
  | {
      /** Remove parts[0] (the entry surface — item 13 owns the rest) —
       *  refused while the part holds any note. Its declarations (name,
       *  tuning, staffKind) go with their container: no tombstones. */
      type: 'removePart';
    };

const NOTE_STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midiOf(note: MnxNote): number {
  const { step, octave, alter = 0 } = note.pitch;
  return (octave + 1) * 12 + STEP_SEMITONES[step] + alter;
}

function setPitchFromMidi(note: MnxNote, midi: number): void {
  const octave = Math.floor(midi / 12) - 1;
  const pc = midi - (octave + 1) * 12;
  // Prefer a natural, then a sharp — good enough for a placeholder; real
  // spelling policy arrives with the editor feature work.
  for (const step of NOTE_STEPS) {
    if (STEP_SEMITONES[step] === pc) {
      note.pitch = { step, octave };
      return;
    }
  }
  for (const step of NOTE_STEPS) {
    if (STEP_SEMITONES[step] === pc - 1) {
      note.pitch = { step, octave, alter: 1 };
      return;
    }
  }
}

/** Every note of every part/staff — the "no selection" universe, wider than
 *  the keyed (parts[0], staff-1) universe the cursor can address. */
function forEachNote(doc: MnxStructure, fn: (note: MnxNote) => void): void {
  for (const part of doc.parts ?? []) {
    for (const measure of part.measures ?? []) {
      for (const seq of measure.sequences ?? []) {
        for (const item of seq.content ?? []) {
          for (const note of (item as { notes?: MnxNote[] }).notes ?? []) fn(note);
        }
      }
    }
  }
}

/** Pure: returns a new document with the op applied; never mutates `doc`. */
export function applyOp(doc: MnxStructure, op: EditOp): MnxStructure {
  const next = JSON.parse(JSON.stringify(doc)) as MnxStructure;
  switch (op.type) {
    case 'transposeSelection': {
      if (!op.noteIds || op.noteIds.length === 0) {
        forEachNote(next, note => setPitchFromMidi(note, midiOf(note) + op.semitones));
        return next;
      }
      forEachKeyedNote(next, (note, key) => {
        if (!op.noteIds!.includes(key)) return;
        setPitchFromMidi(note, midiOf(note) + op.semitones);
      });
      return next;
    }
    case 'setFret': {
      const midi = fingerboardMidi(next, op.string, op.fret);
      forEachKeyedNote(next, (note, key) => {
        if (key !== op.noteId) return;
        const x = ((note._x ??= {}).mnxLab ??= {});
        x.string = op.string;
        x.fret = op.fret;
        if (midi !== undefined) setPitchFromMidi(note, midi);
      });
      return next;
    }
    case 'insertNote': {
      const seq = entrySequence(next, op.measureIndex);
      if (!seq) return next;
      const midi = fingerboardMidi(next, op.string, op.fret);
      if (midi === undefined) return next;
      const note: MnxNote = { pitch: { step: 'C', octave: 4 } };
      setPitchFromMidi(note, midi);
      note._x = { mnxLab: { string: op.string, fret: op.fret } };

      const target: Onset = { num: op.onset[0], den: op.onset[1] };
      const found = eventAtOnset(seq, target);
      if (found?.event) {
        const event = found.event;
        if (event.rest) {
          delete event.rest;
          event.notes = [note];
          return next;
        }
        event.notes ??= [];
        // One string, one note: re-entering an occupied string replaces it.
        const existing = event.notes.findIndex(
          n => n._x?.mnxLab?.string === op.string
        );
        if (existing >= 0) event.notes.splice(existing, 1, note);
        else event.notes.push(note);
        return next;
      }
      if (found) {
        seq.content.splice(found.index, 0, { duration: { ...op.duration }, notes: [note] });
        // The §8.11 invariant: a touched measure always has content for its
        // full metric duration, so unentered positions are already rests.
        padMeasureRests(next, op.measureIndex);
      }
      return next;
    }
    case 'insertPitchNote': {
      const seq = entrySequence(next, op.measureIndex);
      if (!seq) return next;
      const note: MnxNote = { pitch: { ...op.pitch } };
      const target: Onset = { num: op.onset[0], den: op.onset[1] };
      const found = eventAtOnset(seq, target);
      if (found?.event) {
        const event = found.event;
        if (event.rest) {
          delete event.rest;
          event.notes = [note];
          return next;
        }
        event.notes ??= [];
        // One staff position, one note: same letter+octave replaces.
        const existing = event.notes.findIndex(
          n => n.pitch.step === op.pitch.step && n.pitch.octave === op.pitch.octave
        );
        if (existing >= 0) event.notes.splice(existing, 1, note);
        else event.notes.push(note);
        return next;
      }
      if (found) {
        seq.content.splice(found.index, 0, { duration: { ...op.duration }, notes: [note] });
        padMeasureRests(next, op.measureIndex);
      }
      return next;
    }
    case 'deleteNote': {
      forEachEventNote(next, (event, note, key) => {
        if (key !== op.noteId) return;
        event.notes!.splice(event.notes!.indexOf(note), 1);
        if (event.notes!.length === 0) {
          delete event.notes;
          event.rest = {};
        }
      });
      return next;
    }
    case 'setDuration': {
      const seq = entrySequence(next, op.measureIndex);
      if (!seq) return next;
      const found = eventAtOnset(seq, { num: op.onset[0], den: op.onset[1] });
      if (found?.event) {
        found.event.duration = { ...op.duration };
        // Shrinking opens a gap at the end (later events slide earlier) —
        // pad it; growing eats trailing rests instead.
        padMeasureRests(next, op.measureIndex);
      }
      return next;
    }
    case 'nudgeRest': {
      const seq = entrySequence(next, op.measureIndex);
      if (!seq) return next;
      const found = eventAtOnset(seq, { num: op.onset[0], den: op.onset[1] });
      if (found?.event?.rest) {
        const position = (found.event.rest.staffPosition ?? 0) + op.delta;
        found.event.rest = { ...found.event.rest, staffPosition: position };
      }
      return next;
    }
    case 'toggleTie': {
      const located = findKeyedNote(next, op.noteId);
      if (!located) return next;
      const { note } = located;
      if (note.ties && note.ties.length > 0) {
        delete note.ties;
        return next;
      }
      const target = tieTarget(next, located);
      if (!target) return next;
      target.id ??= mintNoteId(next);
      note.ties = [{ target: target.id }];
      return next;
    }
    case 'setTimeSignature': {
      const measure = next.global?.measures?.[op.measureIndex];
      if (!measure) return next;
      measure.time = { ...op.time };
      // The signature persists until the next explicit one — re-establish the
      // full-bar invariant for every measure it now governs.
      for (let i = op.measureIndex; i < next.global.measures.length; i++) {
        if (i > op.measureIndex && next.global.measures[i].time) break;
        padMeasureRests(next, i);
      }
      return next;
    }
    case 'setTuning': {
      const part = next.parts?.[0];
      if (!part) return next;
      const x = ((part._x ??= {}).mnxLab ??= {});
      x.strings = op.tuning.map(t => ({ string: t.string, pitch: { ...t.pitch } }));
      return next;
    }
    case 'setStaffKind': {
      const part = next.parts?.[0];
      if (!part) return next;
      const x = ((part._x ??= {}).mnxLab ??= {});
      (x.tab ??= {}).staffKind = op.kind;
      return next;
    }
    case 'appendMeasure': {
      ensureSkeleton(next);
      next.global.measures.push({});
      for (const part of next.parts ?? []) {
        part.measures?.push({ sequences: [{ content: [] }] });
      }
      // New bars arrive pre-filled with beat rests (§8.11: unentered
      // positions ARE rests; the cursor walks them, digits convert them).
      padMeasureRests(next, next.global.measures.length - 1);
      return next;
    }
    case 'addPart': {
      ensureSkeleton(next);
      const part: MnxPart = {
        ...(op.partId !== undefined ? { id: op.partId } : {}),
        ...(op.name !== undefined ? { name: op.name } : {}),
        measures: next.global.measures.map(() => ({ sequences: [{ content: [] }] }))
      };
      next.parts.push(part);
      // Only the entry surface (parts[0]) holds the full-bar invariant.
      if (next.parts.length === 1) {
        for (let i = 0; i < next.global.measures.length; i++) padMeasureRests(next, i);
      }
      return next;
    }
    case 'removeMeasure': {
      if (!next.global?.measures?.[op.measureIndex]) return next;
      if (measureHasInk(next, op.measureIndex)) return next;
      next.global.measures.splice(op.measureIndex, 1);
      for (const part of next.parts ?? []) part.measures?.splice(op.measureIndex, 1);
      return dissolveIfHollow(next);
    }
    case 'removePart': {
      const part = next.parts?.[0];
      if (!part || partHasInk(part)) return next;
      next.parts.shift();
      return dissolveIfHollow(next);
    }
  }
}

/** Any note in any part's copy of this bar? (Rests are absence, not ink.) */
export function measureHasInk(doc: MnxStructure, measureIndex: number): boolean {
  for (const part of doc.parts ?? []) {
    for (const seq of part.measures?.[measureIndex]?.sequences ?? []) {
      for (const item of seq.content ?? []) {
        if (isTimedEvent(item) && (item.notes?.length ?? 0) > 0) return true;
      }
    }
  }
  return false;
}

/** Any note anywhere in the part? */
export function partHasInk(part: MnxPart): boolean {
  for (const measure of part.measures ?? []) {
    for (const seq of measure.sequences ?? []) {
      for (const item of seq.content ?? []) {
        if (isTimedEvent(item) && (item.notes?.length ?? 0) > 0) return true;
      }
    }
  }
  return false;
}

/** The skeleton follows the content in BOTH directions: ensureSkeleton
 *  materializes it on demand, and a doc left with no parts and no measures
 *  dissolves back to the literal `{}` — the construct start, so the
 *  construct/destruct round trip closes without tombstones. */
function dissolveIfHollow(doc: MnxStructure): MnxStructure {
  const hollow = (doc.parts?.length ?? 0) === 0 && (doc.global?.measures?.length ?? 0) === 0;
  return hollow ? ({} as MnxStructure) : doc;
}

/** Genesis: materialize the document skeleton — `{}` is a legal starting
 *  document (construct traces begin there), so the ops that can run on it
 *  create `mnx`/`global`/`parts` on demand, the same `??=` posture
 *  entrySequence takes one level down. */
function ensureSkeleton(doc: MnxStructure): void {
  const d = doc as Partial<MnxStructure>;
  d.mnx ??= { version: 1 };
  d.global ??= { measures: [] };
  d.global.measures ??= [];
  d.parts ??= [];
}

/** Beat-value bases by time-signature unit (and the greedy pad ladder). */
const BASE_BY_UNIT: Record<number, MnxNoteValueBase> = {
  1: 'whole',
  2: 'half',
  4: 'quarter',
  8: 'eighth',
  16: '16th',
  32: '32nd',
  64: '64th'
};

const PAD_LADDER: { base: MnxNoteValueBase; span: Onset }[] = (
  [
    ['whole', 1, 1],
    ['half', 1, 2],
    ['quarter', 1, 4],
    ['eighth', 1, 8],
    ['16th', 1, 16],
    ['32nd', 1, 32],
    ['64th', 1, 64]
  ] as [MnxNoteValueBase, number, number][]
).map(([base, num, den]) => ({ base, span: { num, den } }));

/** The meter governing a measure: metric span + the beat value for padding.
 *  MNX time signatures persist until changed; 4/4 before the first one. */
function meterOf(doc: MnxStructure, measureIndex: number): { span: Onset; beatBase: MnxNoteValueBase } {
  let time = { count: 4, unit: 4 };
  const measures = doc.global?.measures ?? [];
  for (let i = 0; i <= measureIndex && i < measures.length; i++) {
    const t = measures[i].time;
    if (t) time = t;
  }
  return {
    span: { num: time.count, den: time.unit },
    beatBase: BASE_BY_UNIT[time.unit] ?? 'quarter'
  };
}

function voiceFill(seq: MnxSequence): Onset {
  let onset: Onset = { num: 0, den: 1 };
  for (const item of seq.content) onset = addOnsets(onset, itemSpan(item));
  return onset;
}

function subtractOnsets(a: Onset, b: Onset): Onset {
  return addOnsets(a, { num: -b.num, den: b.den });
}

/**
 * The §8.11 full-bar invariant for a touched measure: voice 0 always sums to
 * the measure's metric span. Underfull → append beat rests (then smaller
 * values for any tail); overfull → consume trailing RESTS only (real notes
 * are never deleted — a still-overfull bar stays overfull and the renderer's
 * duration-mismatch badge says so).
 */
function padMeasureRests(doc: MnxStructure, measureIndex: number): void {
  const seq = entrySequence(doc, measureIndex);
  if (!seq || seq.fullMeasure) return; // a full-measure rest is already full
  const { span, beatBase } = meterOf(doc, measureIndex);
  const beat = PAD_LADDER.find(l => l.base === beatBase)?.span ?? { num: 1, den: 4 };

  // Overfull: pop trailing rests while they help.
  while (onsetLess(span, voiceFill(seq))) {
    const last = seq.content[seq.content.length - 1];
    if (!last || !isTimedEvent(last) || !last.rest) break;
    seq.content.pop();
  }

  // Underfull: beat rests first, then the greedy tail.
  let remainder = subtractOnsets(span, voiceFill(seq));
  while (!onsetLess(remainder, beat) && remainder.num > 0) {
    seq.content.push({ duration: { base: beatBase }, rest: {} });
    remainder = subtractOnsets(remainder, beat);
  }
  while (remainder.num > 0) {
    const fit = PAD_LADDER.find(l => !onsetLess(remainder, l.span));
    if (!fit) break; // a sliver finer than the ladder: leave it (badge shows it)
    seq.content.push({ duration: { base: fit.base }, rest: {} });
    remainder = subtractOnsets(remainder, fit.span);
  }
}

interface LocatedNote {
  seq: MnxSequence;
  measureIndex: number;
  voiceIndex: number;
  eventIndex: number;
  note: MnxNote;
}

function findKeyedNote(doc: MnxStructure, key: string): LocatedNote | null {
  const measures = doc.parts?.[0]?.measures ?? [];
  for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
    const sequences = (measures[measureIndex].sequences ?? []).filter(s => (s.staff ?? 1) === 1);
    for (let voiceIndex = 0; voiceIndex < sequences.length; voiceIndex++) {
      const seq = sequences[voiceIndex];
      for (let eventIndex = 0; eventIndex < seq.content.length; eventIndex++) {
        const item = seq.content[eventIndex];
        if (!isTimedEvent(item)) continue;
        const notes = item.notes ?? [];
        for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
          if (noteKeyOf(notes[noteIndex], measureIndex, voiceIndex, eventIndex, noteIndex) === key) {
            return { seq, measureIndex, voiceIndex, eventIndex, note: notes[noteIndex] };
          }
        }
      }
    }
  }
  return null;
}

function samePitch(a: MnxNote, b: MnxNote): boolean {
  return (
    a.pitch.step === b.pitch.step &&
    a.pitch.octave === b.pitch.octave &&
    (a.pitch.alter ?? 0) === (b.pitch.alter ?? 0)
  );
}

/** The same pitch in the immediately following timed event — this voice's
 *  next event, else the next measure's same-voice first event. */
function tieTarget(doc: MnxStructure, located: LocatedNote): MnxNote | undefined {
  for (let i = located.eventIndex + 1; i < located.seq.content.length; i++) {
    const item = located.seq.content[i];
    if (!isTimedEvent(item)) continue;
    return (item.notes ?? []).find(n => samePitch(n, located.note));
  }
  const nextMeasure = doc.parts?.[0]?.measures?.[located.measureIndex + 1];
  const seq = (nextMeasure?.sequences ?? []).filter(s => (s.staff ?? 1) === 1)[located.voiceIndex];
  for (const item of seq?.content ?? []) {
    if (!isTimedEvent(item)) continue;
    return (item.notes ?? []).find(n => samePitch(n, located.note));
  }
  return undefined;
}

/** A fresh deterministic note id: t1, t2, … skipping anything taken. */
function mintNoteId(doc: MnxStructure): string {
  const taken = new Set<string>();
  for (const part of doc.parts ?? []) {
    for (const measure of part.measures ?? []) {
      for (const seq of measure.sequences ?? []) {
        for (const item of seq.content ?? []) {
          for (const note of (item as { notes?: MnxNote[] }).notes ?? []) {
            if (note.id) taken.add(note.id);
          }
        }
      }
    }
  }
  for (let i = 1; ; i++) {
    if (!taken.has(`t${i}`)) return `t${i}`;
  }
}

/** What (string, fret) sounds under the part's (or standard) tuning. */
function fingerboardMidi(doc: MnxStructure, string: number, fret: number): number | undefined {
  const open = tuningOf(doc.parts?.[0]).find(t => t.string === string);
  // Frets are capo-relative, so the sounding pitch includes the capo shift.
  return open ? midiOfPitch(open.pitch) + capoOf(doc.parts?.[0]) + fret : undefined;
}

/** Voice 0 of staff 1 in a part-0 measure — the entry surface. Created on
 *  demand so entry works in measures that never had a sequence. */
function entrySequence(doc: MnxStructure, measureIndex: number): MnxSequence | undefined {
  const measure = doc.parts?.[0]?.measures?.[measureIndex];
  if (!measure) return undefined;
  measure.sequences ??= [];
  const existing = measure.sequences.filter(s => (s.staff ?? 1) === 1)[0];
  if (existing) return existing;
  const created: MnxSequence = { content: [] };
  measure.sequences.push(created);
  return created;
}

/** The timed event starting exactly at `target`, or (event: undefined) with
 *  the content index where a new event at `target` belongs. Returns undefined
 *  when `target` falls INSIDE an item's span — phase 2 does not split events. */
function eventAtOnset(
  seq: MnxSequence,
  target: Onset
): { event?: MnxEvent; index: number } | undefined {
  let onset: Onset = { num: 0, den: 1 };
  for (let index = 0; index < seq.content.length; index++) {
    const item = seq.content[index];
    if (onsetsEqual(onset, target)) {
      return isTimedEvent(item) ? { event: item, index } : { index };
    }
    onset = addOnsets(onset, itemSpan(item));
    if (onsetLess(target, onset)) return undefined; // inside the item just passed
  }
  return onsetsEqual(onset, target) ? { index: seq.content.length } : undefined;
}

/** Like forEachKeyedNote but with the owning event, for structural edits. */
function forEachEventNote(
  doc: MnxStructure,
  fn: (event: MnxEvent, note: MnxNote, key: string) => void
): void {
  (doc.parts?.[0]?.measures ?? []).forEach((measure, measureIndex) => {
    (measure.sequences ?? [])
      .filter(s => (s.staff ?? 1) === 1)
      .forEach((sequence, voiceIndex) => {
        sequence.content.forEach((item, eventIndex) => {
          if (!isTimedEvent(item)) return;
          for (const [noteIndex, note] of [...(item.notes ?? []).entries()]) {
            fn(item, note, noteKeyOf(note, measureIndex, voiceIndex, eventIndex, noteIndex));
          }
        });
      });
  });
}

/** One op-queue entry: the op plus the intent that provoked it — stamped
 *  FORWARD at apply time (never inferred backward), so the ops panel can
 *  reverse-join intent → key/surface through the keymap docs
 *  (roadmap/complete/core-element-ops-exemplar.md, provenance columns). */
export interface OpLogEntry {
  op: EditOp;
  intent?: EditorIntent;
}

/**
 * Undo/redo over applyOp. The history RETAINS the ops it applied — undo
 * history, trace recording, and (later) the AI loop's EditOp[] output are
 * three consumers of one log (roadmap/complete/core-editor-input-layer.md).
 * Snapshots ride along for O(1) undo; the op log is the durable artifact.
 */
export class EditHistory {
  private past: { op: EditOp; intent?: EditorIntent; before: MnxStructure }[] = [];
  private future: { op: EditOp; intent?: EditorIntent; after: MnxStructure }[] = [];

  constructor(private present: MnxStructure) {}

  get current(): MnxStructure {
    return this.present;
  }

  /** The ops currently in effect, oldest first. */
  get appliedOps(): EditOp[] {
    return this.past.map(entry => entry.op);
  }

  /** The applied queue with intent provenance, oldest first. */
  get appliedEntries(): OpLogEntry[] {
    return this.past.map(({ op, intent }) => ({ op, intent }));
  }

  /** The redo stack with intent provenance, next-to-redo first. */
  get futureEntries(): OpLogEntry[] {
    return [...this.future].reverse().map(({ op, intent }) => ({ op, intent }));
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  apply(op: EditOp, intent?: EditorIntent): MnxStructure {
    this.past.push({ op, intent, before: this.present });
    this.present = applyOp(this.present, op);
    this.future = [];
    return this.present;
  }

  undo(): MnxStructure {
    const entry = this.past.pop();
    if (entry) {
      this.future.push({ op: entry.op, intent: entry.intent, after: this.present });
      this.present = entry.before;
    }
    return this.present;
  }

  redo(): MnxStructure {
    const entry = this.future.pop();
    if (entry) {
      this.past.push({ op: entry.op, intent: entry.intent, before: this.present });
      this.present = entry.after;
    }
    return this.present;
  }
}
