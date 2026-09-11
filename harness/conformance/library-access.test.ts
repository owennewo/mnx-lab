// Implementation loop: real signatures and local D1/R2 exercise the HTTP authorization boundary.
import { beforeEach, afterEach, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { SignJWT } from 'jose';
import app from '../../worker/index.ts';
import { Library } from '../../worker/library/index.ts';
import type { Env } from '../../worker/env.ts';
import { testIdentity } from '../helpers/libraryIdentity.ts';
import score from '../../scenarios/lab/00-document/01-minimal-single-note/document.mnx.json';
let mf: Miniflare; let env: Env; let identity: Awaited<ReturnType<typeof testIdentity>>; let jwt: string;
const request = (path: string, token = jwt, headers = {}) => app.request(`http://localhost/api/library${path}`, { headers: { 'Cf-Access-Jwt-Assertion': token, ...headers } }, env);
beforeEach(async () => {
  identity = await testIdentity(); jwt = await identity.sign();
  mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-06-01', d1Databases: ['DB'], r2Buckets: ['BUCKET'] });
  env = { LIBRARY_DB: await mf.getD1Database('DB'), LIBRARY_BUCKET: await mf.getR2Bucket('BUCKET'), LIBRARY_WRITE_TOKEN: 'private-test', ...identity.config };
  for (const name of ['0001_library.sql','0002_users.sql', '0003_piece_views.sql']) {
    const sql = await readFile(new URL(`../../migrations/${name}`, import.meta.url), 'utf8');
    await env.LIBRARY_DB.batch(sql.replace(/--[^\n]*/g,'').trim().split(/;\s*(?=CREATE\b)/).map(s => env.LIBRARY_DB.prepare(s)));
  }
  await env.LIBRARY_DB.prepare("INSERT INTO users VALUES ('operator','owner@example.test',1,'now')").run();
}, 15000);
afterEach(async () => { await mf?.dispose(); });
it('requires signed identities, never email headers or browser bearer tokens', async () => {
  expect((await request('/me','', { 'Cf-Access-Authenticated-User-Email': 'owner@example.test', Authorization: 'Bearer private-test' })).status).toBe(401);
  expect((await request('/me', jwt.slice(0,-8) + 'aaaaaaaa')).status).toBe(401);
  const other = await testIdentity(); expect((await request('/me', await other.sign())).status).toBe(401);
  expect((await request('/me', await identity.sign({}, true))).status).toBe(401);
  for (const change of [{ exp: 1 }, { aud: 'wrong' }, { iss: 'https://wrong.cloudflareaccess.com' }, { iat: 9999999999 }]) {
    const token = await new SignJWT({ type: 'app', email: 'owner@example.test', sub: 'test', iss: env.LIBRARY_ACCESS_ISSUER, aud: env.LIBRARY_ACCESS_AUD, exp: Math.floor(Date.now()/1000)+60, iat: Math.floor(Date.now()/1000), ...change }).setProtectedHeader({ alg: 'RS256', kid: 'local-test' }).sign(identity.privateKey);
    expect((await request('/me', token)).status).toBe(401);
  }
});
it('checks current membership on every call without creating users', async () => {
  expect((await request('/me')).status).toBe(200);
  expect((await request('/me', await identity.sign({ email: ' OWNER@EXAMPLE.TEST ' }))).status).toBe(200);
  expect((await request('/me', await identity.sign({ email: 'stranger@example.test' }))).status).toBe(403);
  expect((await env.LIBRARY_DB.prepare('SELECT count(*) AS n FROM users').first<{n:number}>())?.n).toBe(1);
  await env.LIBRARY_DB.prepare('UPDATE users SET active=0').run();
  for (const path of ['/me','/pieces','/tags','/pieces/private','/renditions/private']) expect((await request(path)).status).toBe(403);
  const response = await request('/ingest/ABC', await identity.sign({}, true), { Authorization: 'Bearer private-test' }); expect(response.status).toBe(403);
});
it('isolates owners across list, tag completion, metadata, canonical and raw bytes', async () => {
  const lib = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET);
  for (const owner of ['operator','other']) {
    await lib.writePiece(owner, { id: owner, expected_revision: null, renditions: [{ id: `${owner}-mnx`, format: 'mnx', role: 'original', producer: 'user-upload', producer_version: null, producer_options: null, content: new TextEncoder().encode(JSON.stringify(score)) }], canonical: { mode: 'initialize', rendition_id: `${owner}-mnx` }, tags: [{ dimension: 'list', value: owner }] });
  }
  expect((await (await request('/pieces')).json()).pieces.map((p: { id: string }) => p.id)).toEqual(['operator']);
  expect((await (await request('/pieces?tag=list:other')).json()).pieces).toEqual([]);
  expect((await (await request('/tags')).json()).tags).toContainEqual({ dimension: 'list', value: 'operator', pieces: 1 });
  expect(JSON.stringify(await (await request('/tags')).json())).not.toContain('other');
  for (const path of ['/pieces/other','/pieces/other/canonical','/renditions/other-mnx']) expect((await request(path)).status).toBe(404);
  const canonical = await request('/pieces/operator/canonical'); expect(canonical.status).toBe(200); expect(canonical.headers.get('cache-control')).toContain('no-store');
  expect(canonical.headers.get('x-library-format')).toBe('mnx'); expect(await canonical.text()).toBe(JSON.stringify(score));
  expect((await (await request('/renditions/operator-mnx')).text())).toBe(JSON.stringify(score));
});
it('separates browser and machine authority and fails closed on storage/config errors', async () => {
  expect((await request('/ingest/ABC', jwt, { Authorization: 'Bearer private-test' })).status).toBe(401);
  const machine = await identity.sign({}, true);
  expect((await request('/ingest/ABC', machine)).status).toBe(401);
  expect((await request('/ingest/ABC', machine, { Authorization: 'Bearer private-test' })).status).toBe(200);
  expect((await request('/pieces', machine)).status).toBe(401);
  env.LIBRARY_ACCESS_AUD = undefined; expect((await request('/me')).status).toBe(503);
  env.LIBRARY_ACCESS_AUD = 'browser-test'; await env.LIBRARY_DB.exec('DROP TABLE users'); expect((await request('/me')).status).toBe(503);
});
it('has no login route — sign-in is the edge redirect on /studio/ — and sends the root to studio', async () => {
  expect((await request('/login?return=https://attacker.test')).status).toBe(404);
  // The root is studio's; the workbench keeps its own directory (workbench-path-prefix, studio-shell).
  const root = await app.request('http://localhost/', {}, env); expect(root.status).toBe(302); expect(root.headers.get('location')).toBe('/studio/');
  expect((await app.request('https://mnx-lab.totai.uk/api/library/me', { headers: { 'Cf-Access-Jwt-Assertion': jwt } }, env)).status).toBe(503);
});

it('lets the signed-in person open, tag and alias their own pieces only, and only with JSON', async () => {
  const lib = new Library(env.LIBRARY_DB, env.LIBRARY_BUCKET);
  await lib.writePiece('operator', { id: 'mine', expected_revision: null, derived_tags: [{ dimension: 'artist', value: 'A-Ha', source_ref: 'sidecar' }] });
  await lib.writePiece('other', { id: 'theirs', expected_revision: null });
  const send = (path: string, method: string, payload: unknown, type = 'application/json') => app.request(`http://localhost/api/library${path}`, { method, body: JSON.stringify(payload), headers: { 'Cf-Access-Jwt-Assertion': jwt, 'Content-Type': type } }, env);
  expect((await send('/pieces/mine/opened', 'POST', {})).status).toBe(204);
  expect((await send('/pieces/theirs/opened', 'POST', {})).status).toBe(404);
  expect((await send('/pieces/mine/opened', 'POST', {}, 'text/plain')).status).toBe(415);
  expect((await (await request('/pieces?sort=recent')).json()).pieces.map((p: { id: string; opened_at: string | null }) => [p.id, p.opened_at !== null])).toEqual([['mine', true]]);
  const tagged = await send('/pieces/mine/tags', 'PATCH', { expected_revision: 0, add: [{ dimension: 'favourite', value: 'yes' }] });
  expect(tagged.status).toBe(200);
  expect((await tagged.json()).snapshot.tags.map((t: { dimension: string; shown: string }) => `${t.dimension}:${t.shown}`)).toEqual(['artist:A-Ha', 'favourite:yes']);
  expect((await send('/pieces/mine/tags', 'PATCH', { expected_revision: 0, add: [{ dimension: 'genre', value: 'x' }] })).status).toBe(409);
  expect((await send('/pieces/mine/tags', 'PATCH', { expected_revision: 1, add: [{ dimension: 'artist', value: 'x' }] })).status).toBe(400);
  expect((await send('/pieces/theirs/tags', 'PATCH', { expected_revision: 0, add: [{ dimension: 'genre', value: 'x' }] })).status).toBe(404);
  const aliased = await send('/aliases', 'PUT', { dimension: 'artist', raw_value: 'A-Ha', canonical_value: 'a-ha' });
  expect((await aliased.json()).aliases).toEqual([{ owner: 'operator', dimension: 'artist', raw_value: 'A-Ha', canonical_value: 'a-ha', pieces: 1 }]);
  expect((await (await request('/facets')).json())).toEqual({ total: 1, facets: [{ dimension: 'artist', value: 'a-ha', pieces: 1 }, { dimension: 'favourite', value: 'yes', pieces: 1 }] });
  expect((await (await request('/tags?dimension=artist')).json()).tags).toEqual([{ dimension: 'artist', value: 'a-ha', pieces: 1 }]);
  expect((await (await request('/pieces/mine')).json()).snapshot.tags.find((t: { dimension: string }) => t.dimension === 'artist')).toMatchObject({ value: 'A-Ha', shown: 'a-ha' });
  expect((await (await send('/aliases', 'DELETE', { dimension: 'artist', raw_value: 'A-Ha' })).json()).aliases).toEqual([]);
  expect((await request('/pieces?sort=sideways')).status).toBe(400);
});
