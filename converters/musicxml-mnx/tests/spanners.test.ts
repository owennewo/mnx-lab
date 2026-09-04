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
