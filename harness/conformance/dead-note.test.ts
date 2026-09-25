// X is the dead note (2026-09-20). It took the key from palm mute, which is a
// SPAN rather than a notehead and keeps only its inspector pill: `x` is what
// the dead note literally draws, on both staves, so the letter and the ink
// agree. The half worth pinning is the REST: a dead note is the one technique
// with nothing to fret, so no digit can precede it, and X on a rest has to
// enter the note itself — in one op, so one keystroke is one undo.
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { TAB_DIGIT_LAYER, resolveIntent } from '../../src/edit/keymap.ts';
import type { MnxEvent, MnxStructure, MnxTabTechnique } from '../../src/model/mnx.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';

/** One 4/4 bar of quarters on a declared guitar; `null` is a rest. */
function bar(items: ({ string: number; id: string } | null)[]): MnxStructure {
  const OPEN: Record<number, { step: string; octave: number }> = {
    1: { step: 'E', octave: 4 }, 2: { step: 'B', octave: 3 },
    3: { step: 'G', octave: 3 }, 4: { step: 'D', octave: 3 },
    5: { step: 'A', octave: 2 }, 6: { step: 'E', octave: 2 }
  };
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      id: 'p1',
      _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } },
      measures: [{
        sequences: [{
          content: items.map(item =>
            item === null
              ? { duration: { base: 'quarter' as const }, rest: {} }
              : {
                  duration: { base: 'quarter' as const },
                  notes: [{
                    id: item.id,
                    pitch: { ...OPEN[item.string] },
                    _x: { mnxLab: { string: item.string } }
                  }]
                }
          )
        }]
      }]
    }]
  } as unknown as MnxStructure;
}

type Event = { rest?: unknown; duration?: MnxEvent['duration']; notes?: { id?: string; pitch: { step: string; octave: number }; _x?: { mnxLab?: { string?: number; tab?: { technique?: MnxTabTechnique } } } }[] };
const eventsOf = (session: EditorSession): Event[] =>
  (session.doc.parts![0].measures![0].sequences![0].content as Event[]);

describe('the dead note — X', () => {
  it('toggles on a note, and off again, leaving no tombstone', () => {
    const session = new EditorSession(bar([{ string: 1, id: 'a' }]));
    expect(session.handleIntent({ type: 'toggleTechnique', kind: 'dead' })).toBe(true);
    expect(eventsOf(session)[0].notes![0]._x!.mnxLab!.tab!.technique).toEqual({ dead: true });

    expect(session.handleIntent({ type: 'toggleTechnique', kind: 'dead' })).toBe(true);
    // No tombstones, all the way up the vendor chain — the string survives,
    // because it was the author's choice and not the technique's doing.
    expect(eventsOf(session)[0].notes![0]._x!.mnxLab).toEqual({ string: 1 });
  });

  it('on a rest, enters one on the cursor’s string, keeping the rest’s duration', () => {
    const session = new EditorSession(bar([null, { string: 1, id: 'b' }]));
    expect(session.handleIntent({ type: 'toggleTechnique', kind: 'dead' })).toBe(true);

    const entered = eventsOf(session)[0];
    expect(entered.rest).toBeUndefined();
    expect(entered.duration).toEqual({ base: 'quarter' });
    const note = entered.notes![0];
    // The open string under the cursor: MNX requires a pitch, and nothing is
    // stopped, so the honest one is the string played open. The `x` hides it.
    expect(note.pitch).toEqual({ step: 'E', octave: 4 });
    expect(note._x!.mnxLab!.string).toBe(1);
    expect(note._x!.mnxLab!.tab!.technique).toEqual({ dead: true });
  });

  it('entering one on a rest is a single undo', () => {
    const session = new EditorSession(bar([null, { string: 1, id: 'b' }]));
    session.handleIntent({ type: 'toggleTechnique', kind: 'dead' });
    expect(session.handleIntent({ type: 'undo' })).toBe(true);
    expect(eventsOf(session)[0].rest).toEqual({});
    expect(eventsOf(session)[0].notes).toBeUndefined();
  });

  it('X resolves to the dead note, and palm mute holds no stroke', () => {
    expect(resolveIntent({ code: 'KeyX' }, [TAB_DIGIT_LAYER]))
      .toEqual({ type: 'toggleTechnique', kind: 'dead' });
    const bound = TAB_DIGIT_LAYER.bindings.filter(
      b => (b.intent as { kind?: string }).kind === 'palmMute'
    );
    expect(bound).toEqual([]);
  });
});
