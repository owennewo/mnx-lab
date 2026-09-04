import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML, exportMusicXML } from '../src/index.js';
import type { MnxEvent, MnxNote, MnxStructure } from '../src/common/types.js';

/**
 * Ties and slurs, both directions.
 *
 * These use the W3C comparison fixtures rather than the guitar corpus, and that
 * is the point: none of the three guitar scores contains a single tie, which is
 * how 46 round-trip invariant tests passed over a feature that existed in
 * neither direction. A round trip cannot see a symmetric omission, so the
 * fixtures have to contain the feature before the assertion means anything.
 *
 * The layout-level verdict on these same documents lives in
 * harness/conformance/musicxml-oracle.test.ts, which judges them against the
 * spec's own paired MNX. Here we assert the structure directly.
 */
const FIXTURES = path.resolve(__dirname, '../../fixtures/w3c-comparisons');

async function load(slug: string): Promise<MnxStructure> {
  return importMusicXML(await fs.readFile(path.join(FIXTURES, `${slug}.musicxml`), 'utf-8'));
}

/** Every event of the first part, containers flattened. */
function events(mnx: MnxStructure): MnxEvent[] {
  const out: MnxEvent[] = [];
  const walk = (items: MnxEvent[]): void => {
    for (const item of items) {
      const content = (item as { content?: MnxEvent[] }).content;
      if (content) walk(content);
      else out.push(item);
    }
  };
  for (const measure of mnx.parts[0].measures ?? []) {
    for (const sequence of measure.sequences ?? []) walk((sequence.content ?? []) as MnxEvent[]);
  }
  return out;
}

const notes = (mnx: MnxStructure): MnxNote[] => events(mnx).flatMap(e => e.notes ?? []);

describe('ties', () => {
  it('links each tie to the note it ties into, by id', async () => {
    const mnx = await load('ties');
    const tied = notes(mnx).filter(n => n.ties?.length);
    expect(tied.length).toBeGreaterThan(0);

    const byId = new Map(notes(mnx).map(n => [n.id, n]));
    for (const note of tied) {
      for (const tie of note.ties ?? []) {
        // A tie names a real note...
        expect(tie.target, `tie on ${note.id} has no target`).toBeTruthy();
        const target = byId.get(tie.target!);
        expect(target, `tie on ${note.id} points at nothing`).toBeDefined();
        // ...and joins the same pitch, which is what a tie means.
        expect(target!.pitch.step).toBe(note.pitch.step);
        expect(target!.pitch.octave).toBe(note.pitch.octave);
      }
    }
  });
});

describe('slurs', () => {
  it('states an ordinary slur event-to-event, with no note narrowing', async () => {
    const mnx = await load('slurs');
    const slurred = events(mnx).filter(e => e.slurs?.length);
    expect(slurred.length).toBeGreaterThan(0);

    const ids = new Set(events(mnx).map(e => e.id).filter(Boolean));
    for (const event of slurred) {
      for (const slur of event.slurs ?? []) {
        expect(ids.has(slur.target)).toBe(true);
        expect(slur.startNote).toBeUndefined();
        expect(slur.endNote).toBeUndefined();
      }
    }
  });

  it('keeps a chord-to-chord slur event-level', async () => {
    // The slur hangs off the first note of each chord, which means the chord,
    // not that note — so it must NOT be narrowed to startNote/endNote.
    const mnx = await load('slurs-chords');
    const slurs = events(mnx).flatMap(e => e.slurs ?? []);
    expect(slurs.length).toBeGreaterThan(0);
    expect(slurs.every(s => !s.startNote && !s.endNote)).toBe(true);
  });

  it('narrows to particular chord members when the source does', async () => {
    // Three slurs between the same pair of chords, one per voice of the chord.
    // Event-level slurs could not tell them apart, so each names its notes.
    const mnx = await load('slurs-targeting-specific-notes');
    const slurs = events(mnx).flatMap(e => e.slurs ?? []);
    expect(slurs.length).toBe(3);
    expect(slurs.every(s => s.startNote && s.endNote)).toBe(true);
    // Distinct members, not the same note three times.
    expect(new Set(slurs.map(s => s.startNote)).size).toBe(3);
    expect(new Set(slurs.map(s => s.endNote)).size).toBe(3);
  });
});

describe('round trip', () => {
  it.each(['ties', 'slurs', 'slurs-chords', 'slurs-targeting-specific-notes'])(
    'preserves %s through MNX → MusicXML → MNX',
    async slug => {
      const first = await load(slug);
      const second = importMusicXML(exportMusicXML(first));
      expect(second).toEqual(first);
    }
  );

  it('does not read a legato-slide marker as a musical slur', async () => {
    // Our own exporter writes a bare `<slur type="start">` to mark a slide as
    // picked-once; it has no matching stop. An unmatched start must resolve to
    // nothing rather than inventing a slur to the end of the part.
    const xml = await fs.readFile(
      path.resolve(__dirname, '../../fixtures/House-of-the-Rising-Sun.xml'),
      'utf-8'
    );
    const mnx = importMusicXML(xml);
    expect(events(mnx).some(e => e.slurs?.length)).toBe(false);
  });
});

describe('beams', () => {
  it('groups a run, and does not beam a lone note', async () => {
    const mnx = await load('beams');
    const groups = (mnx.parts[0].measures ?? []).flatMap(m => m.beams ?? []);
    expect(groups.length).toBeGreaterThan(0);
    // A beam joins notes; one event with nothing nested under it is a flag.
    expect(groups.every(b => b.events.length > 1 || b.beams?.length || b.direction)).toBe(true);
  });

  it('keeps a beamed rest inside its group', async () => {
    // measure 2 of `beams` is begin/continue/continue/continue/end where the
    // second event is a <rest/>. Miss it and the group splits in two.
    const mnx = await load('beams');
    const groups = (mnx.parts[0].measures ?? []).flatMap(m => m.beams ?? []);
    expect(groups.some(b => b.events.length === 5)).toBe(true);
  });

  it('nests secondary beams inside the primary', async () => {
    const mnx = await load('beams-secondary-beam-breaks');
    const groups = (mnx.parts[0].measures ?? []).flatMap(m => m.beams ?? []);
    const nested = groups.filter(b => b.beams?.length);
    expect(nested.length).toBeGreaterThan(0);
    // A secondary covers a SUB-run of its parent, never more.
    for (const parent of nested) {
      for (const child of parent.beams ?? []) {
        expect(child.events.every(id => parent.events.includes(id))).toBe(true);
      }
    }
  });

  it('reads hooks as one-event groups with a direction', async () => {
    const mnx = await load('beam-hooks');
    const hooks = (mnx.parts[0].measures ?? [])
      .flatMap(m => m.beams ?? [])
      .flatMap(b => b.beams ?? [])
      .filter(b => b.direction);
    expect(hooks.length).toBeGreaterThan(0);
    expect(hooks.every(h => h.events.length === 1)).toBe(true);
    expect(new Set(hooks.map(h => h.direction))).toEqual(new Set(['left', 'right']));
  });

  it('files a cross-barline group on the measure its first event is in', async () => {
    const mnx = await load('beams-across-barlines');
    const measures = mnx.parts[0].measures ?? [];
    const withBeams = measures.filter(m => m.beams?.length);
    expect(withBeams).toHaveLength(1);
    // ...and it names events that live in the NEXT measure.
    const ids = new Set(
      (measures[0].sequences ?? []).flatMap(s => (s.content ?? []).map(e => (e as MnxEvent).id))
    );
    const group = withBeams[0].beams![0];
    expect(group.events.some(id => !ids.has(id))).toBe(true);
  });

  it('leaves a grace note out of the beam it sits inside', async () => {
    // The spec's own fixture beams ev1, ev3, ev4, ev5 and says so in a comment:
    // the grace note interrupts nothing.
    const mnx = await load('beams-inner-grace-notes');
    const groups = (mnx.parts[0].measures ?? []).flatMap(m => m.beams ?? []);
    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(4);
  });

  it.each([
    'beams',
    'beam-hooks',
    'beams-across-barlines',
    'beams-secondary-beam-breaks',
    'beams-inner-grace-notes'
  ])('preserves %s through MNX → MusicXML → MNX', async slug => {
    const first = await load(slug);
    expect(importMusicXML(exportMusicXML(first))).toEqual(first);
  });
});

describe('repeat barlines', () => {
  it.each(['repeats-alternate-endings-simple', 'repeats-alternate-endings-advanced'])(
    'states a repeat once in %s, without a barline beside it',
    async slug => {
      // MusicXML draws a repeat with <bar-style>heavy-light</bar-style> plus
      // <repeat direction="forward"/> on the SAME <barline>. The bar-style is
      // how the repeat is drawn, not a barline of its own, and MNX says it once.
      const mnx = await load(slug);
      for (const measure of mnx.global.measures) {
        if (measure.repeatStart || measure.repeatEnd) {
          expect(measure.barline, 'a repeat measure carries no separate barline').toBeUndefined();
        }
      }
      expect(mnx.global.measures.some(m => m.repeatStart || m.repeatEnd)).toBe(true);
    }
  );
});
