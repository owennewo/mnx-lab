// A scripted edit saved as a version, over the real route on local D1/R2: the tool's check, and that
// what it sends is what the library takes (piece-checkpoint.test.ts covers the route; this, its caller).
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, expect, it } from 'vitest';
import { libraryBindings, useLibraryRuntime } from '../helpers/libraryRuntime.ts';
import { testIdentity } from '../helpers/libraryIdentity.ts';
import app from '../../worker/index.ts';
import type { Env } from '../../worker/env.ts';
import { LibraryClient } from '../../src/storage/libraryClient.ts';
import { derivedLibraryTags } from '../../src/model/libraryTags.ts';
import { applyOp } from '../../src/edit/ops.ts';
import { checkStorage } from '../../src/importers/storageCheckCore.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import { segmentsFromBarStarts, SYNC_SEGMENTS_FORMAT } from '../../src/model/syncSegments.ts';
import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
import { upgradeTabExtension } from '../../src/model/upgradeTabExtension.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { barsAlone, checkpointBody, prepareCheckpoint } from '../../tools/recording-align/checkpoint.ts';

const fixture = (): MnxStructure => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../../converters/fixtures/Sun-did-glide.mnx.json'), 'utf8'));
type Loose = Record<string, any>;
/** Moves a note of a bar up a fret, as a scripted edit would: bars count from 1. */
function raised(doc: MnxStructure, ...bars: number[]): MnxStructure {
  const next = structuredClone(doc) as Loose;
  for (const bar of bars) {
    const note = JSON.stringify(next.parts[0].measures[bar - 1]).includes('"notes"') ? findNote(next.parts[0].measures[bar - 1]) : null;
    if (!note) throw new Error(`bar ${bar} has no notes`);
    note.pitch.alter = (note.pitch.alter ?? 0) + 1;
    if (typeof note._x?.mnxLab?.fret === 'number') note._x.mnxLab.fret += 1;
  }
  return next as MnxStructure;
}
function findNote(node: unknown): Loose | null {
  if (Array.isArray(node)) { for (const item of node) { const hit = findNote(item); if (hit) return hit; } return null; }
  if (node && typeof node === 'object') {
    const loose = node as Loose;
    if (loose.pitch && !loose.rest) return loose;
    for (const value of Object.values(loose)) { const hit = findNote(value); if (hit) return hit; }
  }
  return null;
}
const noted = (doc: MnxStructure) => doc.parts[0]!.measures!.flatMap((m, i) => findNote(m) ? [i + 1] : []);
const prepare = (edited: MnxStructure, bars: number[], before = fixture(), over = {}) => prepareCheckpoint({ before, edited, bars, name: 'An edit', ...over });

it('passes an edit of the bars it names, and only those', () => {
  const doc = fixture(), [bar] = noted(doc);
  const prepared = prepare(raised(doc, bar!), [bar!], doc);
  expect(prepared.problems).toEqual([]);
  expect(prepared.changed).toEqual([bar]);
});

it('refuses a bar changed that the edit does not name, and a bar named that did not change', () => {
  const doc = fixture(), [a, b] = noted(doc);
  expect(prepare(raised(doc, a!, b!), [a!], doc).problems.join()).toContain(`bars changed that the edit does not name: ${b}`);
  expect(prepare(raised(doc, a!), [a!, b!], doc).problems.join()).toContain(`bars named that did not change: ${b}`);
  expect(prepare(raised(doc, a!), [], doc).problems.join()).toContain('name the bars');
});

it('does not take a renumbered note id for a change', () => {
  const doc = fixture(), [bar] = noted(doc);
  const renamed = structuredClone(doc) as Loose;
  const note = findNote(renamed.parts[0].measures[bar! - 1])!;
  note.id = 'renumbered';
  expect(prepare(renamed as MnxStructure, [bar!], doc).problems.join()).toContain(`bars named that did not change: ${bar}`);
});

it('refuses a tuning or a bar count that moves unnoticed, unless it is meant', () => {
  const doc = fixture(), [bar] = noted(doc);
  const retuned = raised(doc, bar!) as Loose;
  const strings = retuned.parts[0]._x.mnxLab.strings;
  strings[0].pitch = { ...strings[0].pitch, octave: strings[0].pitch.octave + 1 };
  const moved = prepare(retuned as MnxStructure, [bar!], doc);
  expect(moved.problems.join()).toMatch(/settings changed/);
  expect(prepare(retuned as MnxStructure, [bar!], doc, { allow: { settings: true } }).problems.join()).not.toMatch(/settings changed/);

  const longer = structuredClone(doc) as Loose, count = longer.parts[0].measures.length;
  longer.global.measures.push(structuredClone(longer.global.measures.at(-1)));
  longer.parts[0].measures.push(structuredClone(longer.parts[0].measures.at(-1)));
  expect(prepare(longer as MnxStructure, [count + 1], doc).problems.join()).toContain(`from ${count} bars to ${count + 1}`);
  expect(prepare(longer as MnxStructure, [count + 1], doc, { allow: { resize: true } }).problems.join()).not.toContain('bars to');
});

it('says, and does not stop for, a sync the edit leaves stale', () => {
  const doc = fixture(), [bar] = noted(doc);
  const read = upgradeTabExtension(importGuitarProCleanRoom(checkStorage(doc).bytes) as unknown as MnxStructure);
  const compiled = compilePerformance(read, linearizePasses(read));
  if (!compiled.ok) throw new Error('does not compile');
  const wholes = compiled.performance.measures.map(m => Number(m.metricDuration.num) / Number(m.metricDuration.den));
  const cuts = [...wholes.keys(), wholes.length].map(i => 1 + i * 2);
  const names = wholes.map((_, i) => `Bar ${i + 1}`);
  const row = (name: string, counted: number[]) => ({ name, provenance: JSON.stringify({ format: SYNC_SEGMENTS_FORMAT, raw: segmentsFromBarStarts(cuts, counted, names) }) });
  const short = [...wholes]; short[2] = short[2]! / 2;
  const prepared = prepare(raised(doc, bar!), [bar!], doc, { recordings: [row('Fine', wholes), row('Made before bar 3 was filled', short), { name: 'No sync', provenance: null }] });
  expect(prepared.problems).toEqual([]);
  expect(prepared.stale).toEqual([{ recording: 'Made before bar 3 was filled', bars: [3] }]);
});

it('draws only the bars of an edit, each with its time signature', () => {
  const doc = fixture(), [bar] = noted(doc);
  const alone = barsAlone(doc, [bar!, bar! + 1]);
  expect(alone.parts[0]!.measures).toHaveLength(2);
  expect(alone.global.measures).toHaveLength(2);
  expect(alone.global.measures[0]!.time).toBeTruthy();
});

const freshRuntime = useLibraryRuntime({ migrated: true });
let env: Env, jwt: string;
beforeEach(async () => {
  const identity = await testIdentity(); jwt = await identity.sign();
  const mf = await freshRuntime();
  env = { ...(await libraryBindings(mf)), LIBRARY_WRITE_TOKEN: 'private-test', ...identity.config };
  await env.LIBRARY_DB.prepare("INSERT INTO users VALUES ('operator','owner@example.test',1,'now')").run();
}, 15000);

it('saves what it checked: the library takes the body, and the version reads back as the edit', async () => {
  const client = new LibraryClient((input, init) => {
    const { signal: _signal, ...rest } = init ?? {};
    return app.request(`http://localhost${String(input)}`, { ...rest, headers: { 'Cf-Access-Jwt-Assertion': jwt, ...(rest.headers as Record<string, string>) } }, env) as Promise<Response>;
  });
  const doc = applyOp(fixture(), { type: 'setWork', work: { title: 'Sun did glide' } }), [bar] = noted(doc), stored = checkStorage(doc);
  const made = (await client.createPiece({ filename: 'Fixture.gp', bytes: stored.bytes, producerVersion: 'test', producerOptions: stored.options }, derivedLibraryTags(doc))).snapshot;
  const prepared = prepare(raised(doc, bar!), [bar!], doc);
  const body = checkpointBody(prepared, { revision: made.piece.revision, derivedFrom: made.piece.canonical_rendition_id!, filename: 'Fixture.gp', name: 'Bar raised', sha256: createHash('sha256').update(prepared.bytes).digest('hex') });
  const response = await app.request(`http://localhost/api/library/pieces/${made.piece.id}/renditions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cf-Access-Jwt-Assertion': jwt }, body: JSON.stringify(body) }, env);
  const saved = await response.json() as { snapshot: { piece: { revision: number; canonical_rendition_id: string } }; unchanged: boolean };
  expect(response.status).toBe(201);
  expect(saved.unchanged).toBe(false);
  expect(saved.snapshot.piece.revision).toBe(made.piece.revision + 1);
  expect(saved.snapshot.piece.canonical_rendition_id).not.toBe(made.piece.canonical_rendition_id);
  const canonical = await client.canonical(made.piece.id);
  expect(Buffer.from(canonical.bytes).equals(Buffer.from(prepared.bytes))).toBe(true);
  const row = await env.LIBRARY_DB.prepare('SELECT provenance FROM renditions WHERE id = ?').bind(saved.snapshot.piece.canonical_rendition_id).first<{ provenance: string }>();
  expect(JSON.parse(row!.provenance)).toMatchObject({ kind: 'checkpoint', name: 'Bar raised' });
});
