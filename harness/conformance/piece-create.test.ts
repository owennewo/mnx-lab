// Implementation loop: a piece made in Studio, end to end without a browser
// (roadmap/complete/studio-piece-create.md, studio authoring campaign item 2).
//
// The form's work is three pure steps and one write, and each is pinned here:
// build a blank document from ops, export it as the `.gp` Studio stores, read
// its library tags off it, and POST it through the real Worker route over local
// D1/R2 with a signed Access identity. The first write path for score content
// gets the same treatment the ingest got.
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import app from '../../worker/index.ts';
import type { Env } from '../../worker/env.ts';
import { testIdentity } from '../helpers/libraryIdentity.ts';
import { LibraryClient } from '../../src/storage/libraryClient.ts';
import { buildNewDocument, newDocumentProblem, type NewDocumentSpec } from '../../src/edit/newDocument.ts';
import { parseTuning } from '../../src/edit/setupGrammar.ts';
import { derivedLibraryTags } from '../../src/model/libraryTags.ts';
import { compareDocuments } from '../../src/model/documentCompare.ts';
import { exportGuitarProGpif, STORAGE_EXPORT_OPTIONS } from '../../converters/guitarpro-mnx/src/gpif/fromMnx.ts';
import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
import { conversionFacts, tuningName } from '../../tools/library-ingest.mjs';
import validateMnx from '../../worker/generated/validate-mnx.mjs';
import { validatePartExt, validateRootExt } from '../../worker/generated/validate-extensions.mjs';

const spec = (over: Partial<NewDocumentSpec> = {}): NewDocumentSpec => ({
  title: 'Anji', artist: 'Davy Graham', tuning: parseTuning('standard')!, capo: 2,
  time: { count: 4, unit: 4 }, fifths: 0, bars: 12, ...over
});
type Exportable = Parameters<typeof exportGuitarProGpif>[0];
const toGp = (document: unknown) => exportGuitarProGpif(document as Exportable, { ...STORAGE_EXPORT_OPTIONS });

describe('a blank piece', () => {
  it('is a valid document with the bars, meter, key, strings and capo that were asked for', () => {
    const document = buildNewDocument(spec({ time: { count: 6, unit: 8 }, fifths: -1, bars: 7 }));
    expect(validateMnx(document), JSON.stringify(validateMnx.errors)).toBe(true);
    expect(validateRootExt(document._x!.mnxLab), JSON.stringify(validateRootExt.errors)).toBe(true);
    expect(validatePartExt(document.parts[0]._x!.mnxLab), JSON.stringify(validatePartExt.errors)).toBe(true);
    expect(document.global.measures).toHaveLength(7);
    expect(document.parts[0].measures).toHaveLength(7);
    expect(document.global.measures[0]).toMatchObject({ time: { count: 6, unit: 8 }, key: { fifths: -1 } });
    expect(document.parts[0]).toMatchObject({ name: 'Guitar', _x: { mnxLab: { capo: 2, tab: { staffKind: 'both' } } } });
    expect(document.parts[0]._x!.mnxLab!.strings).toHaveLength(6);
    expect(document._x!.mnxLab!.work).toEqual({ title: 'Anji', artist: 'Davy Graham' });
  });

  it('writes no capo at fret 0, and refuses what it cannot build', () => {
    expect(buildNewDocument(spec({ capo: 0 })).parts[0]._x!.mnxLab).not.toHaveProperty('capo');
    expect(newDocumentProblem(spec())).toBeNull();
    for (const bad of [{ title: '  ' }, { bars: 0 }, { bars: 1000 }, { capo: 25 }, { fifths: 8 }, { tuning: parseTuning('standard')!.slice(0, 2) }])
      expect(() => buildNewDocument(spec(bad)), JSON.stringify(bad)).toThrow();
  });

  it('survives its own first save: the .gp reads back with nothing lost or changed', () => {
    for (const s of [spec(), spec({ tuning: parseTuning('dadgad')!, capo: 0, time: { count: 3, unit: 4 }, fifths: 2, bars: 1 }), spec({ tuning: parseTuning('bass')!, artist: '' })]) {
      const document = buildNewDocument(s);
      const differences = compareDocuments(document, importGuitarProCleanRoom(toGp(document))).filter(d => d.kind !== 'gained');
      expect(differences.map(d => `${d.kind} ${d.path.join('/')}`)).toEqual([]);
    }
  });

  it('reads the same tags off a document as the operator ingest does', () => {
    const document = buildNewDocument(spec({ tuning: parseTuning('open-g')! }));
    const tags = derivedLibraryTags(document);
    expect(tags).toEqual([
      { dimension: 'title', value: 'Anji' }, { dimension: 'artist', value: 'Davy Graham' },
      { dimension: 'part', value: 'Guitar' }, { dimension: 'capo', value: '2' },
      { dimension: 'tuning', value: 'D2 G2 D3 G3 B3 D4' }, { dimension: 'tuning-name', value: 'open G' }
    ]);
    const facts = conversionFacts(document);
    expect(tags.filter(t => t.dimension === 'tuning').map(t => t.value)).toEqual(facts.tunings);
    expect(tags.filter(t => t.dimension === 'tuning-name').map(t => t.value)).toEqual(facts.tunings.map(tuningName));
    expect(tags.filter(t => t.dimension === 'capo').map(t => t.value)).toEqual(facts.capos.map(String));
    expect(tags.filter(t => t.dimension === 'part').map(t => t.value)).toEqual(facts.parts);
  });
});

describe('POST /api/library/pieces', () => {
  let mf: Miniflare; let env: Env; let jwt: string; let identity: Awaited<ReturnType<typeof testIdentity>>;
  const send = (path: string, init: RequestInit = {}, token = jwt) => app.request(`http://localhost/api/library${path}`,
    { ...init, headers: { 'Cf-Access-Jwt-Assertion': token, ...(init.headers ?? {}) } }, env);
  // The typed client, pointed at the app in-process: what Studio actually sends.
  const client = () => new LibraryClient((input, init) => {
    const { signal: _signal, ...rest } = init ?? {};
    return app.request(`http://localhost${String(input)}`, { ...rest, headers: { 'Cf-Access-Jwt-Assertion': jwt, ...(rest.headers as Record<string, string>) } }, env) as Promise<Response>;
  });
  const create = (document = buildNewDocument(spec())) => client().createPiece(
    { filename: 'Anji.gp', bytes: toGp(document), producerVersion: '0.3.0', producerOptions: { ...STORAGE_EXPORT_OPTIONS } }, derivedLibraryTags(document));
  const post = (body: unknown, headers: Record<string, string> = { 'Content-Type': 'application/json' }) =>
    send('/pieces', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const valid = async () => {
    const bytes = toGp(buildNewDocument(spec()));
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    return { rendition: { filename: 'Anji.gp', sha256, content: Buffer.from(bytes).toString('base64'), producer_version: null, producer_options: null },
      derived_tags: [{ dimension: 'title', value: 'Anji' }] };
  };

  beforeEach(async () => {
    identity = await testIdentity(); jwt = await identity.sign();
    mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-06-01', d1Databases: ['DB'], r2Buckets: ['BUCKET'] }));
    env = { LIBRARY_DB: await mf.getD1Database('DB'), LIBRARY_BUCKET: await mf.getR2Bucket('BUCKET'), LIBRARY_WRITE_TOKEN: 'private-test', ...identity.config };
    for (const name of ['0001_library', '0002_users', '0003_piece_views', '0004_recording_management']) {
      const sql = (await readFile(new URL(`../../migrations/${name}.sql`, import.meta.url), 'utf8')).replace(/--[^\n]*/g, '').trim();
      await env.LIBRARY_DB.batch(sql.split(/;\s*(?=(?:CREATE|ALTER)\b)/).map(s => env.LIBRARY_DB.prepare(s)));
    }
    await env.LIBRARY_DB.prepare("INSERT INTO users VALUES ('operator','owner@example.test',1,'now')").run();
  }, 15000);
  afterEach(async () => { await mf?.dispose(); });

  it('stores the .gp as the canonical original of a piece the service named, and reads back the same music', async () => {
    const document = buildNewDocument(spec());
    const { snapshot } = await create(document);
    expect(snapshot.piece.id).toMatch(/^[0-9a-f]{16}$/);
    const row = await env.LIBRARY_DB.prepare('SELECT * FROM pieces WHERE id = ?').bind(snapshot.piece.id).first<Record<string, unknown>>();
    expect(row).toMatchObject({ owner: 'operator', source_kind: 'studio', revision: 0 });
    expect(String(row!.source_id)).toMatch(/^[0-9a-f-]{36}$/);
    const rendition = await env.LIBRARY_DB.prepare('SELECT * FROM renditions WHERE piece_id = ?').bind(snapshot.piece.id).first<Record<string, unknown>>();
    expect(rendition).toMatchObject({ id: row!.canonical_rendition_id, format: 'gp', role: 'original', producer: 'studio', producer_version: '0.3.0', filename: 'Anji.gp', derived_from: null });
    expect(JSON.parse(String(rendition!.producer_options))).toEqual({ collapseTabUnisons: false });

    const canonical = await client().canonical(snapshot.piece.id);
    expect(canonical.format).toBe('gp');
    const reopened = importGuitarProCleanRoom(new Uint8Array(canonical.bytes));
    expect(compareDocuments(document, reopened).filter(d => d.kind !== 'gained')).toEqual([]);

    // Listed, titled and sortable like any other piece; recordings hang off its snapshot.
    const { pieces } = await client().pieces([], '', 'title');
    expect(pieces.map(p => p.id)).toEqual([snapshot.piece.id]);
    expect(snapshot.tags.map(t => `${t.dimension}:${t.value}`)).toEqual(expect.arrayContaining(['title:Anji', 'artist:Davy Graham', 'tuning-name:standard', 'capo:2']));
    expect(snapshot.tags.every(t => t.origin === 'derived')).toBe(true);
    const saved = await client().saveRecording(snapshot.piece.id, `studio-${crypto.randomUUID()}`, snapshot.piece.revision, { name: 'Live', video: 'https://youtu.be/M7lc1UVf-VE', rawSync: null, selectedId: null });
    expect(saved.snapshot.recordings.map(r => r.kind)).toEqual(['youtube']);
  });

  it('makes a new piece every time: identical files are two pieces sharing one blob', async () => {
    const [a, b] = [await create(), await create()];
    expect(a.snapshot.piece.id).not.toBe(b.snapshot.piece.id);
    expect((await env.LIBRARY_BUCKET.list({ prefix: 'renditions/' })).objects).toHaveLength(1);
  });

  it('belongs to whoever made it', async () => {
    await env.LIBRARY_DB.prepare("INSERT INTO users VALUES ('second','second@example.test',1,'now')").run();
    const { snapshot } = await create();
    const other = await identity.sign({ email: 'second@example.test' });
    expect((await send(`/pieces/${snapshot.piece.id}`, {}, other)).status).toBe(404);
    expect((await send(`/pieces/${snapshot.piece.id}/canonical`, {}, other)).status).toBe(404);
    expect((await (await send('/pieces', {}, other)).json()).pieces).toEqual([]);
  });

  it('is a same-origin JSON write by a permitted member, like every browser write', async () => {
    const body = await valid();
    expect((await post(body, { 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await post(body, { 'Content-Type': 'application/json', Origin: 'https://evil.example' })).status).toBe(403);
    expect((await send('/pieces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, await identity.sign({ email: 'stranger@example.test' }))).status).toBe(403);
    expect((await send('/pieces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, '')).status).toBe(401);
    expect((await post(body)).status).toBe(201);
  });

  it('names nothing the caller asks it to, and stores nothing it cannot vouch for', async () => {
    const body = await valid();
    const bad: [string, unknown][] = [
      ['a caller-chosen piece id', { ...body, id: 'mine' }],
      ['a caller-chosen rendition id', { ...body, rendition: { ...body.rendition, id: 'mine' } }],
      ['a source_ref on a tag', { ...body, derived_tags: [{ dimension: 'title', value: 'Anji', source_ref: 'sidecar' }] }],
      ['no title', { ...body, derived_tags: [{ dimension: 'artist', value: 'Davy Graham' }] }],
      ['a path in the filename', { ...body, rendition: { ...body.rendition, filename: '../Anji.gp' } }],
      ['another format', { ...body, rendition: { ...body.rendition, filename: 'Anji.mnx.json' } }],
      ['bytes that are not a GP7 container', { ...body, rendition: { ...body.rendition, content: Buffer.from('{"mnx":{}}').toString('base64') } }],
      ['a hash of other bytes', { ...body, rendition: { ...body.rendition, sha256: 'a'.repeat(64) } }],
      ['not base64', { ...body, rendition: { ...body.rendition, content: '<score/>' } }],
      ['not an object', '[]']
    ];
    for (const [what, payload] of bad) expect((await post(payload)).status, what).toBe(400);
    expect((await post(JSON.stringify({ ...body, pad: 'x'.repeat(2 * 1024 * 1024) }))).status).toBe(400);
    expect((await env.LIBRARY_DB.prepare('SELECT count(*) AS n FROM pieces').first<{ n: number }>())?.n).toBe(0);
    expect((await env.LIBRARY_BUCKET.list()).objects).toHaveLength(0);
  });
});
