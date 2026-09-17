// The round-trip judge, proved before it judges anything
// (roadmap/inprogress/core-roundtrip-register.md).
//
// `src/model/documentCompare.ts` decides whether a converter round trip lost
// something. A judge that cries wolf is worse than none — studio will show its
// verdicts to a person — so the first proofs are about what it must NOT report:
// the same music under different ids. Only then, what it must.
import { describe, it, expect } from 'vitest';
import {
  ID_REFERENCE_FIELDS, canonicalizeDocument, collapseDifferences, compareDocuments
} from '../../src/model/documentCompare.ts';
import mnxSchema from '../../spec/mnx-schema.json';
import extensionSchema from '../../spec/mnx-lab-extensions.schema.json';

/** Every reference shape the engine knows, in one small document. */
const score = () => ({
  mnx: { version: 1 },
  _x: { mnxLab: { work: { title: 'Ids' }, encoding: { software: 'one writer' } } },
  global: {
    measures: [
      { _x: { mnxLab: { navigation: { marks: [{ id: 'ID_coda', kind: 'coda' }], jumps: [{ type: 'toCoda', target: 'ID_coda' }] } } } },
      {}
    ]
  },
  parts: [{
    id: 'ID_part',
    measures: [{
      beams: [{ events: ['ID_ev1', 'ID_ev2'] }],
      arpeggios: [{ span: { start: 'ID_ev1', end: 'ID_ev2' } }],
      sequences: [{
        content: [
          { id: 'ID_ev1', duration: { base: 'eighth' }, slurs: [{ target: 'ID_ev2' }],
            notes: [{ id: 'ID_n1', pitch: { step: 'C', octave: 4 }, ties: [{ target: 'ID_n2' }],
              _x: { mnxLab: { tab: { technique: { slide: { target: 'ID_n2' } } } } } }] },
          { id: 'ID_ev2', duration: { base: 'eighth' },
            notes: [{ id: 'ID_n2', pitch: { step: 'C', octave: 4 } }, { id: 'ID_n3', pitch: { step: 'E', octave: 4 } }] }
        ]
      }]
    }, { sequences: [{ content: [{ id: 'ID_unused', duration: { base: 'whole' }, rest: {} }] }] }]
  }],
  layouts: [{ id: 'ID_layout', content: [{ type: 'staff', sources: [{ part: 'ID_part' }] }] }],
  scores: [{ name: 'Full score', layout: 'ID_layout' }]
});

/** Respells ids by TEXT substitution — deliberately ignorant of the module's
 *  reference table, so the proof is not the table agreeing with itself. */
function respell(document: unknown, spelling: (id: string) => string): unknown {
  return JSON.parse(JSON.stringify(document).replace(/ID_[A-Za-z0-9]+/g, spelling));
}

describe('document comparison: what is not a difference', () => {
  it('the same music under entirely different ids compares clean', () => {
    const renamed = respell(score(), id => `zz-${[...id].reverse().join('')}`);
    expect(JSON.stringify(renamed)).not.toBe(JSON.stringify(score()));
    expect(compareDocuments(score(), renamed)).toEqual([]);
  });

  it('ids swapped between two objects, with every reference following, compare clean', () => {
    const swapped = respell(score(), id => (id === 'ID_n2' ? 'ID_n3' : id === 'ID_n3' ? 'ID_n2' : id));
    expect(compareDocuments(score(), swapped)).toEqual([]);
  });

  it('an id nothing references is not part of the music', () => {
    const bare = score();
    delete (bare.parts[0].measures[1].sequences[0].content[0] as { id?: string }).id;
    delete (bare.parts[0].measures[0].sequences[0].content[1].notes![1] as { id?: string }).id;
    expect(compareDocuments(score(), bare)).toEqual([]);
  });

  it('the encoding stamp belongs to whoever wrote the file', () => {
    const restamped = score();
    restamped._x.mnxLab.encoding = { software: 'another writer' };
    expect(compareDocuments(score(), restamped)).toEqual([]);
    const unstamped = score();
    delete (unstamped._x.mnxLab as { encoding?: unknown }).encoding;
    expect(compareDocuments(score(), unstamped)).toEqual([]);
  });

  it('key order is not a difference, and canonicalising never mutates', () => {
    const original = score();
    const before = JSON.stringify(original);
    const reordered = JSON.parse(JSON.stringify(original, Object.keys(flatKeys(original)).sort().reverse()));
    expect(compareDocuments(original, reordered)).toEqual([]);
    canonicalizeDocument(original);
    expect(JSON.stringify(original)).toBe(before);
  });
});

describe('document comparison: what is', () => {
  it('a retargeted reference is a change, named by what it resolves to', () => {
    const retargeted = score();
    retargeted.parts[0].measures[0].sequences[0].content[0].notes![0].ties = [{ target: 'ID_n3' }];
    const differences = compareDocuments(score(), retargeted);
    expect(differences.some(d => d.kind === 'changed' && d.path.join('/').endsWith('ties/0/target'))).toBe(true);
  });

  it('crossed targets differ even though the same ids are all still present', () => {
    const crossed = score();
    const note = crossed.parts[0].measures[0].sequences[0].content[0].notes![0];
    note.ties = [{ target: 'ID_n3' }];
    note._x.mnxLab.tab.technique.slide.target = 'ID_n3';
    expect(compareDocuments(score(), crossed).length).toBeGreaterThan(0);
  });

  it('a dangling reference differs from a good one, and stays as spelled', () => {
    const dangling = score();
    dangling.parts[0].measures[0].sequences[0].content[0].slurs = [{ target: 'ID_gone' }];
    const differences = compareDocuments(score(), dangling);
    expect(differences.some(d => d.after === 'ID_gone')).toBe(true);
  });

  it('a duplicated id is left visible rather than named away', () => {
    const duplicated = score();
    duplicated.parts[0].measures[0].sequences[0].content[1].notes![1].id = 'ID_n2';
    expect(compareDocuments(score(), duplicated).length).toBeGreaterThan(0);
  });

  it('a lost slur is one difference, not a cascade through every later id', () => {
    const lost = score();
    delete (lost.parts[0].measures[0].sequences[0].content[0] as { slurs?: unknown }).slurs;
    expect(collapseDifferences(compareDocuments(score(), lost))).toEqual([
      { path: 'parts/[]/measures/[]/sequences/[]/content/[]/slurs', kind: 'lost', count: 1 }
    ]);
  });

  it('a spliced array reports its members, not every shifted index', () => {
    const shorter = score();
    shorter.parts[0].measures[0].sequences[0].content[1].notes!.pop();
    expect(collapseDifferences(compareDocuments(score(), shorter))).toEqual([
      { path: 'parts/[]/measures/[]/sequences/[]/content/[]/notes/[]', kind: 'lost', count: 1 }
    ]);
  });
});

/** Every key anywhere in a document — JSON.stringify's array replacer is a key whitelist. */
function flatKeys(value: unknown, into: Record<string, true> = {}): Record<string, true> {
  if (Array.isArray(value)) value.forEach(item => flatKeys(item, into));
  else if (value && typeof value === 'object')
    for (const [key, child] of Object.entries(value)) { into[key] = true; flatKeys(child, into); }
  return into;
}

describe('the reference inventory is the schemas\', not ours', () => {
  const ID_PATTERN = (mnxSchema as { $defs: Record<string, { pattern?: string }> }).$defs.id.pattern;

  /** property name → reference kind, for every property a schema types as an id reference. */
  function referencesIn(schema: unknown, kindOf: (node: Record<string, unknown>) => string | null) {
    const found = new Map<string, string>();
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== 'object') return;
      const record = node as Record<string, unknown>;
      if (record.properties && typeof record.properties === 'object')
        for (const [name, property] of Object.entries(record.properties as Record<string, Record<string, unknown>>)) {
          const kind = property && typeof property === 'object' ? kindOf(property) : null;
          if (kind && name !== 'id') found.set(name, kind);
        }
      Object.values(record).forEach(visit);
    };
    visit(schema);
    return found;
  }

  it('names every id reference in the published schema', () => {
    const found = referencesIn(mnxSchema, node =>
      typeof node.$ref === 'string' && /^#\/\$defs\/(id|id-list|id-pair)$/.test(node.$ref) ? node.$ref.slice('#/$defs/'.length) : null);
    expect(found.size).toBeGreaterThan(10);
    for (const [name, kind] of found) {
      expect(ID_REFERENCE_FIELDS[name], `published schema property "${name}" refers to an id`).toBeDefined();
      if (ID_REFERENCE_FIELDS[name] !== 'name') expect(ID_REFERENCE_FIELDS[name], name).toBe(kind);
    }
  });

  it('names every id reference in the _x.mnxLab schema', () => {
    const found = referencesIn(extensionSchema, node =>
      node.$ref === '#/$defs/note-id' || node.pattern === ID_PATTERN ? 'id' : null);
    expect(found.size).toBeGreaterThan(0);
    for (const [name] of found)
      expect(ID_REFERENCE_FIELDS[name], `extension schema property "${name}" refers to an id`).toBe('id');
  });
});
