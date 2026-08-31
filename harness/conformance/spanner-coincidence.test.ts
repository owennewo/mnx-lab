// The spanner half of the coincidence rule — core-selection-range-grain.md
// decision 5, first slice. A range wholly covering a slur or beam IS that
// spanner: the probe reports it, the tile reads active, and the toggle key
// removes it from ANY covered position rather than only from its start.
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { spannersUnderSelection } from '../../src/edit/spannerCoincidence.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

/** One bar, one voice: four beamed-and-slurred quarters would not beam, so
 *  eighths — e1..e4, a slur e2→e3, a beam over e1..e2, in 4/4 with a half
 *  rest closing the bar. */
function score(): MnxStructure {
  const eighth = (id: string, step: 'C' | 'D' | 'E' | 'F') => ({
    id,
    duration: { base: 'eighth' as const },
    notes: [{ id: `${id}-n`, pitch: { step, octave: 4 } }]
  });
  return {
    mnx: { version: 1, support: { useBeams: true } },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      id: 'p1',
      measures: [{
        beams: [{ events: ['e1', 'e2'] }],
        sequences: [{
          content: [
            { ...eighth('e1', 'C') },
            {
              ...eighth('e2', 'D'),
              slurs: [{ target: 'e3', startNote: 'e2-n', endNote: 'e3-n' }]
            },
            eighth('e3', 'E'),
            eighth('e4', 'F'),
            { duration: { base: 'half' as const }, rest: {} }
          ]
        }]
      }]
    }]
  } as unknown as MnxStructure;
}

/** An event range from e-index `from` to `to`, via the ordinary gestures. */
function rangeSession(from: number, to: number): EditorSession {
  const session = new EditorSession(score());
  session.handleIntent({ type: 'setProjection', projection: 'notation' });
  session.handleIntent({ type: 'relaxSelection' }); // note → event, on e1
  for (let i = 0; i < from; i++) session.handleIntent({ type: 'nextPosition' });
  for (let i = from; i < to; i++) {
    session.handleIntent({ type: 'extendSelection', direction: 'next' });
  }
  return session;
}

describe('the spanner coincidence probe', () => {
  it('reports a wholly covered slur, from either endpoint inward', () => {
    const session = rangeSession(1, 2); // e2..e3 — exactly the slur
    const hits = spannersUnderSelection(session.doc, session.resolvedSelection.members);
    expect(hits.slurs).toMatchObject([
      { coverage: 'whole', ownerNoteKey: 'e2-n', eventIndex: 1, slurIndex: 0 }
    ]);
  });

  it('reports partial coverage honestly — one endpoint is not the spanner', () => {
    const start = rangeSession(1, 1); // e2 alone: slur start, beam member
    const hits = spannersUnderSelection(start.doc, start.resolvedSelection.members);
    expect(hits.slurs).toMatchObject([{ coverage: 'partial' }]);
    expect(hits.beams).toMatchObject([{ coverage: 'partial', path: [0] }]);

    const end = rangeSession(2, 3); // e3..e4: covers only the slur's end
    expect(spannersUnderSelection(end.doc, end.resolvedSelection.members).slurs)
      .toMatchObject([{ coverage: 'partial' }]);
  });

  it('reports a wholly covered beam with its removal path', () => {
    const session = rangeSession(0, 1); // e1..e2
    const hits = spannersUnderSelection(session.doc, session.resolvedSelection.members);
    expect(hits.beams).toMatchObject([
      { coverage: 'whole', partIndex: 0, measureIndex: 0, path: [0], events: ['e1', 'e2'] }
    ]);
  });

  it('an untouched range reports nothing', () => {
    const session = rangeSession(3, 3); // e4 only
    const hits = spannersUnderSelection(session.doc, session.resolvedSelection.members);
    expect(hits.slurs).toEqual([]);
    expect(hits.beams).toEqual([]);
  });
});

describe('removal from any covered position', () => {
  it('S over a range covering the whole slur removes it, though the slur starts mid-range', () => {
    const session = rangeSession(0, 2); // e1..e3 — slur e2→e3 inside, not at the range start
    expect(session.handleIntent({ type: 'toggleSlur' })).toBe(true);
    const e2 = session.doc.parts![0].measures![0].sequences[0].content[1] as { slurs?: unknown[] };
    expect(e2.slurs ?? []).toEqual([]);
    // No new slur was created in its place.
    const e1 = session.doc.parts![0].measures![0].sequences[0].content[0] as { slurs?: unknown[] };
    expect(e1.slurs ?? []).toEqual([]);
  });

  it('B over a range covering the whole beam un-beams it from its last member', () => {
    const session = rangeSession(1, 3); // e2..e4 — beam e1..e2 is only PARTIALLY covered
    expect(spannersUnderSelection(session.doc, session.resolvedSelection.members).beams)
      .toMatchObject([{ coverage: 'partial' }]);

    const covering = rangeSession(0, 1); // e1..e2 — wholly covered
    expect(covering.handleIntent({ type: 'toggleBeam' })).toBe(true);
    expect(session.doc.parts![0].measures![0].beams).toBeDefined(); // the partial session's doc untouched
    expect(covering.doc.parts![0].measures![0].beams).toBeUndefined();
  });
});

// The slur/beam TILES retired with 11a (one-surface campaign); the
// coincidence read they exercised survives as the inspector's pills, pinned
// in rung-inspector.test.ts. (An empty describe is a failed suite to vitest,
// so the note lives here rather than in one.)
