// Implementation loop: ONE cursor — roadmap/proposed/core-single-cursor.md.
//
// The edit cursor is a performed position: a visit of the pass model plus the
// written address inside it. A STEP walks the performance (a `:|` on a pass
// that is not the last goes back to the repeat start, pass two skips the first
// ending, D.S. and the coda are steps like any other); a JUMP chooses a visit
// of the bar it lands in, keeping the pass when the pass plays it and
// resetting to the bar's first performance when it does not. The host's half —
// seeking, parking on pause, the label — is proved in the studio smoke; this
// is the session's half, and the pure bar-seek arithmetic the host counts with.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { hasRepeatStructure, linearizePasses } from '../../src/model/passes.ts';
import { barSeekTarget } from '../../src/model/playback.ts';
import { choosePerformance, entryContains, performedStep, remapPerformance } from '../../src/edit/performedCursor.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
// @ts-expect-error — corpus loader is plain JavaScript
import { loadCorpus } from '../verify/check-scenarios.mjs';

const corpus: { id: string; dir: string }[] = loadCorpus();
const read = (id: string): MnxStructure =>
  JSON.parse(fs.readFileSync(path.join(corpus.find(s => s.id === id)!.dir, 'document.mnx.json'), 'utf8'));

/** Press one key until it stops moving the cursor; the visits it passed through, in order. */
function walk(session: EditorSession, type: 'nextPosition' | 'prevPosition'): (number | null)[] {
  const visits: (number | null)[] = [session.performedOrdinal];
  for (let i = 0; i < 2000 && session.handleIntent({ type }); i++) {
    if (session.performedOrdinal !== visits[visits.length - 1]) visits.push(session.performedOrdinal);
  }
  return visits;
}

const repeated = corpus.filter(s => hasRepeatStructure(read(s.id)));

describe('a step walks the performance', () => {
  it('covers the corpus navigation scenarios', () => expect(repeated.length).toBeGreaterThanOrEqual(10));
  for (const { id } of repeated) it(id, () => {
    const doc = read(id);
    const session = new EditorSession(doc);
    const order = linearizePasses(doc).entries.map(entry => entry.ordinal);
    // Forward from the first stop: every visit once, in performance order,
    // then the ghost bar past the end (written-only).
    const forward = walk(session, 'nextPosition');
    expect(forward.filter(v => v !== null)).toEqual(order);
    expect(forward[forward.length - 1]).toBe(null);
    // Back from the ghost bar: the same visits in reverse — ← is the inverse of →.
    const back = walk(session, 'prevPosition');
    expect(back.filter(v => v !== null)).toEqual([...order].reverse());
    // The two halves of the cursor never disagree along the way.
    const model = session.passModel;
    const at = session.performedOrdinal;
    expect(at === null || entryContains(model.entries[at], session.cursor.measureIndex, session.cursor.onset)).toBe(true);
  });
});

describe('the loop back, on a real repeat', () => {
  // spec/repeats-alternate-endings-simple: bars 0 1 | 0 2 — the first ending is
  // bar 1, the second bar 2.
  const id = 'spec/repeats-alternate-endings-simple';

  it('→ at the first ending goes back to the repeat start, and says Pass 2', () => {
    const session = new EditorSession(read(id));
    session.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    expect(session.performedOrdinal).toBe(1);
    walkToBarChange(session, 'nextPosition');
    expect(session.cursor.measureIndex).toBe(0);
    expect(session.performedOrdinal).toBe(2);
    expect(session.passNotice).toEqual({ kind: 'pass', pass: 2 });
  });

  it('on pass 2, → skips the first ending for the second', () => {
    const session = new EditorSession(read(id));
    session.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    walkToBarChange(session, 'nextPosition');
    walkToBarChange(session, 'nextPosition');
    expect(session.cursor.measureIndex).toBe(2);
    expect(session.performedOrdinal).toBe(3);
  });

  it('a jump keeps the pass when the pass plays the bar, and resets it when it does not', () => {
    const session = new EditorSession(read(id));
    session.handleIntent({ type: 'goToMeasure', measureIndex: 2 });
    expect(session.performedOrdinal).toBe(3); // bar 2 is only played on pass 2
    session.handleIntent({ type: 'goToMeasure', measureIndex: 0 });
    expect(session.performedOrdinal).toBe(2); // bar 0 on the same pass
    expect(session.passNotice).toBe(null);
    session.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    expect(session.performedOrdinal).toBe(1); // the first ending: pass 2 skips it, so pass 1
    expect(session.passNotice).toEqual({ kind: 'pass', pass: 1 });
  });

  it('a second press where the cursor stands moves to the next visit of that moment', () => {
    const session = new EditorSession(read(id));
    const at = session.cursor;
    const press = () => session.handleIntent({
      type: 'goToPointer', measureIndex: at.measureIndex, partIndex: 0, staffIndex: 1,
      line: at.line, projection: session.projection, fraction: 0
    });
    // The cursor opens on bar 0's first visit, so the first press is already a second one.
    expect(session.performedOrdinal).toBe(0);
    expect(press()).toBe(true);
    expect(session.performedOrdinal).toBe(2);
    expect(press()).toBe(true);
    expect(session.performedOrdinal).toBe(0);
  });

  it('a press in the unrolled view lands on the visit it was drawn as', () => {
    const session = new EditorSession(read(id));
    const at = session.cursor;
    // Bar 0 is drawn twice unrolled; the press on the second drawing names visit 2.
    expect(session.handleIntent({
      type: 'goToPointer', measureIndex: 0, partIndex: 0, staffIndex: 1,
      line: at.line, projection: session.projection, fraction: 0, ordinal: 2
    })).toBe(true);
    expect(session.performedOrdinal).toBe(2);
    // A visit that does not contain the place pressed is not believed.
    session.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    session.handleIntent({
      type: 'goToPointer', measureIndex: 0, partIndex: 0, staffIndex: 1,
      line: at.line, projection: session.projection, fraction: 0, ordinal: 3
    });
    expect(session.performedOrdinal).toBe(0);
  });

  it('an edit keeps the cursor on the visit it was on', () => {
    const session = new EditorSession(read(id));
    session.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    walkToBarChange(session, 'nextPosition');
    expect(session.performedOrdinal).toBe(2);
    session.handleIntent({ type: 'shorterDuration' });
    expect(session.performedOrdinal).toBe(2);
    session.handleIntent({ type: 'undo' });
    expect(session.performedOrdinal).toBe(2);
  });
});

describe('the D.C. al Fine end', () => {
  it('→ past the final visit lands on the ghost bar, never on music already played', () => {
    const doc = read('spec/jumps-ds-al-fine');
    const session = new EditorSession(doc);
    const visits = walk(session, 'nextPosition');
    const last = linearizePasses(doc).entries.at(-1)!;
    expect(visits.at(-2)).toBe(last.ordinal);
    expect(session.cursor.measureIndex).toBe(doc.global.measures.length);
    expect(session.performedOrdinal).toBe(null);
  });
});

describe('where playing starts, and where a pause parks', () => {
  const id = 'spec/repeats-alternate-endings-simple';

  it('a bar selection plays from its first event, on the cursor’s pass', () => {
    const session = new EditorSession(read(id));
    session.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    walkToBarChange(session, 'nextPosition'); // bar 0, pass 2
    expect(session.performedOrdinal).toBe(2);
    session.handleIntent({ type: 'goToLevel', level: 'measure' });
    expect(session.playStart).toEqual({ ordinal: 2, onset: { num: 0, den: 1 } });
  });

  it('a point cursor plays from itself', () => {
    const session = new EditorSession(read(id));
    session.handleIntent({ type: 'nextPosition' });
    expect(session.playStart).toEqual({ ordinal: session.performedOrdinal, onset: session.cursor.onset });
    expect(session.performedOrdinal).toBe(1);
  });

  it('parks on the stop sounding at the playhead, on the visit it names', () => {
    const session = new EditorSession(read(id));
    expect(session.handleIntent({ type: 'goToPerformed', ordinal: 2, onset: [3, 8], level: 'note' })).toBe(true);
    expect(session.performedOrdinal).toBe(2);
    expect(session.cursor.measureIndex).toBe(0);
    // The last stop at or before 3/8 — the note just heard, not the next one.
    const stops = session.positions.positions.filter(p => p.measureIndex === 0).map(p => p.onset.num / p.onset.den);
    const expected = Math.max(...stops.filter(t => t <= 3 / 8));
    expect(session.cursor.onset.num / session.cursor.onset.den).toBe(expected);
    expect(session.selectionLevel).toBe('note');
  });
});

describe('the pure rules', () => {
  const model = linearizePasses(read('spec/repeats-alternate-endings-simple'));

  it('choosePerformance keeps the pass, nearest the current visit, else the first', () => {
    expect(choosePerformance(model, 0, { num: 0, den: 1 }, 3)).toBe(2);
    expect(choosePerformance(model, 0, { num: 0, den: 1 }, 1)).toBe(0);
    expect(choosePerformance(model, 1, { num: 0, den: 1 }, 3)).toBe(1);
    expect(choosePerformance(model, 9, { num: 0, den: 1 }, 0)).toBe(null);
  });

  it('performedStep follows, redirects, or ends', () => {
    expect(performedStep(model, 0, { measureIndex: 1, onset: { num: 0, den: 1 } }, 1)).toEqual({ kind: 'follow', ordinal: 1 });
    expect(performedStep(model, 1, { measureIndex: 2, onset: { num: 0, den: 1 } }, 1)).toEqual({ kind: 'redirect', entry: model.entries[2] });
    expect(performedStep(model, 3, { measureIndex: 3, onset: { num: 0, den: 1 } }, 1)).toEqual({ kind: 'end' });
  });

  it('remapPerformance finds the same occurrence, else the same pass, else the first', () => {
    expect(remapPerformance(model.entries[2], model, 0, { num: 0, den: 1 })).toBe(2);
    expect(remapPerformance(model.entries[3], model, 0, { num: 0, den: 1 })).toBe(2);
    expect(remapPerformance(null, model, 0, { num: 0, den: 1 })).toBe(0);
  });

  it('bar seeks while playing accumulate from the target, not the playhead', () => {
    // The first ← is the top of the bar playing; each further ← one bar back.
    let pending: number | null = null;
    for (let press = 0; press < 4; press++) pending = barSeekTarget(12, 5, pending, -1);
    expect(pending).toBe(2);
    expect(barSeekTarget(12, 5, null, 1)).toBe(6);
    expect(barSeekTarget(12, 5, 6, 1)).toBe(7);
    expect(barSeekTarget(12, 0, 0, -1)).toBe(0);
    expect(barSeekTarget(12, 11, 11, 1)).toBe(11);
  });
});

function walkToBarChange(session: EditorSession, type: 'nextPosition' | 'prevPosition') {
  const from = session.performedOrdinal;
  for (let i = 0; i < 200 && session.performedOrdinal === from; i++) session.handleIntent({ type });
}
