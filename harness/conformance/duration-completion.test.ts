// Duration completion (campaign item 4): the dot, and the time signature's
// glyph.
//
// Same evidence shape as the wrap verbs: take the corpus document that holds
// the thing, remove just that thing, rebuild it through navigation plus the
// key or the typed text, and demand the document come back byte-identical.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { parseTimeSignature, parseRhythm } from '../../src/edit/setupGrammar.ts';
import type { MnxEvent, MnxStructure } from '../../src/model/mnx.ts';

const REPO = path.join(__dirname, '../..');
const load = (id: string): MnxStructure =>
  JSON.parse(fs.readFileSync(path.join(REPO, 'scenarios', id, 'document.mnx.json'), 'utf8'));

/** Walk to the bar and onset a cursor must reach, using intents only. */
function driveTo(session: EditorSession, measureIndex: number, steps: number): void {
  session.handleIntent({ type: 'setProjection', projection: 'notation' });
  session.handleIntent({ type: 'goToMeasure', measureIndex });
  for (let i = 0; i < steps; i++) session.handleIntent({ type: 'nextPosition' });
}

describe('the time signature glyph', () => {
  it('spec/time-signature-glyphs: “common” and “2/2 cut” rebuild it', () => {
    const original = load('spec/time-signature-glyphs');
    const stripped = JSON.parse(JSON.stringify(original)) as MnxStructure;
    for (const measure of stripped.global!.measures!) delete measure.time?.display;

    const session = new EditorSession(stripped, 'spec/time-signature-glyphs');
    for (const [measureIndex, typed] of [
      [0, 'common'],
      [1, '2/2 cut']
    ] as const) {
      driveTo(session, measureIndex, 0);
      const parsed = parseTimeSignature(typed);
      expect(parsed, `"${typed}" did not parse`).not.toBe(null);
      expect(parsed).not.toBe('inherit');
      const time = parsed as { count: number; unit: number; display?: 'common' | 'cut' };
      expect(
        session.handleIntent({
          type: 'setTimeSignature',
          count: time.count,
          unit: time.unit,
          ...(time.display ? { display: time.display } : {})
        })
      ).toBe(true);
    }
    expect(session.doc).toEqual(original);
  });

  it('reads the bare words and the qualified form', () => {
    expect(parseTimeSignature('common')).toEqual({ count: 4, unit: 4, display: 'common' });
    expect(parseTimeSignature('cut')).toEqual({ count: 2, unit: 2, display: 'cut' });
    expect(parseTimeSignature('4/4 common')).toEqual({ count: 4, unit: 4, display: 'common' });
    // The meter alone still parses to a meter — no glyph is not a glyph.
    expect(parseTimeSignature('6/8')).toEqual({ count: 6, unit: 8 });
    expect(parseTimeSignature('6/8 common')).toEqual({ count: 6, unit: 8, display: 'common' });
    expect(parseTimeSignature('4/4 sharp')).toBeNull();
  });
});

describe('the dot', () => {
  it('spec/dotted-notes: “.” on each undotted event rebuilds it', () => {
    const original = load('spec/dotted-notes');
    const stripped = JSON.parse(JSON.stringify(original)) as MnxStructure;

    // Where the dots were, in cursor terms: bar, and how many ink positions in.
    const sites: { measureIndex: number; steps: number; dots: number }[] = [];
    (stripped.parts![0].measures ?? []).forEach((measure, measureIndex) => {
      (measure.sequences?.[0]?.content ?? []).forEach((item, index) => {
        const event = item as MnxEvent;
        if (!event.duration?.dots) return;
        sites.push({ measureIndex, steps: index, dots: event.duration.dots });
        delete event.duration.dots;
      });
    });
    expect(sites.length, 'the scenario has no dotted events').toBeGreaterThan(0);

    const session = new EditorSession(stripped, 'spec/dotted-notes');
    for (const site of sites) {
      driveTo(session, site.measureIndex, site.steps);
      for (let i = 0; i < site.dots; i++)
        expect(session.handleIntent({ type: 'toggleDots' })).toBe(true);
    }
    expect(session.doc).toEqual(original);
  });

  it('cycles 0 → 1 → 2 → none on one key', () => {
    const session = new EditorSession(load('spec/dotted-notes'), 'spec/dotted-notes');
    driveTo(session, 0, 0);
    const value = () =>
      (session.doc.parts![0].measures![0].sequences![0].content[0] as MnxEvent).duration;
    const start = value().dots ?? 0;
    for (let i = 0; i < 3; i++) session.handleIntent({ type: 'toggleDots' });
    expect(value().dots ?? 0).toBe(start);
  });

  it('survives a re-value: a dotted quarter steps to a dotted eighth', () => {
    const session = new EditorSession(quarters(), '');
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    session.handleIntent({ type: 'toggleDots' });
    session.handleIntent({ type: 'shorterDuration' });
    const event = session.doc.parts![0].measures![0].sequences![0].content[0] as MnxEvent;
    expect(event.duration).toEqual({ base: 'eighth', dots: 1 });
  });

  it('over absence it moves the PENDING duration, and entry carries it', () => {
    const session = new EditorSession(emptyBar(), '');
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    expect(session.entryDurationDots).toBe(0);
    session.handleIntent({ type: 'toggleDots' });
    expect(session.entryDurationDots).toBe(1);
    // Nothing was written — a rest is absence, so there was nothing to dot.
    expect(session.doc).toEqual(emptyBar());
    session.handleIntent({ type: 'toggleNote' });
    const event = session.doc.parts![0].measures![0].sequences![0].content[0] as MnxEvent;
    expect(event.duration).toEqual({ base: 'quarter', dots: 1 });
  });

  it('a dotted REST is reached by the spelling verb, not the dot key', () => {
    // Three quarter rests are what padding writes; an engraver writes one
    // dotted half plus a quarter (`lab/10-durations/01-rest-gallery`).
    const session = new EditorSession(restBar(), '');
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    const parsed = parseRhythm('rest half.');
    expect(parsed).toEqual({ rest: { base: 'half', dots: 1 } });
    expect(
      session.handleIntent({
        type: 'setRestSpelling',
        duration: (parsed as { rest: { base: 'half'; dots?: number } }).rest
      })
    ).toBe(true);
    expect(session.doc.parts![0].measures![0].sequences![0].content).toEqual([
      { duration: { base: 'half', dots: 1 }, rest: {} },
      { type: 'event', duration: { base: 'quarter' }, rest: {} }
    ]);
  });
});

/** A 4/4 bar of four quarter notes. */
function quarters(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [
      {
        measures: [
          {
            clefs: [{ clef: { sign: 'G', staffPosition: -2 } }],
            sequences: [
              {
                content: (['C', 'D', 'E', 'F'] as const).map(step => ({
                  type: 'event' as const,
                  duration: { base: 'quarter' as const },
                  notes: [{ pitch: { step, octave: 4 } }]
                }))
              }
            ]
          }
        ]
      }
    ]
  } as MnxStructure;
}

/** The same bar, all rests — what entry pads with. */
function restBar(count = 4): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [
      {
        measures: [
          {
            clefs: [{ clef: { sign: 'G', staffPosition: -2 } }],
            sequences: [
              {
                content: Array.from({ length: count }, () => ({
                  type: 'event' as const,
                  duration: { base: 'quarter' as const },
                  rest: {}
                }))
              }
            ]
          }
        ]
      }
    ]
  } as MnxStructure;
}

const emptyBar = (): MnxStructure => restBar();
