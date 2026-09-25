// The ingest tool and the ingest route's refusals that need no storage: the
// tool's planning and transport, conversion validation, and the route failing
// closed without its secret. Split from library-ingest.test.ts, whose tests each
// pay for a fresh D1/R2 — these never touched it.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import realApp from '../../worker/index.ts';
import { ingestSources } from '../helpers/ingestFixture.ts';
// Operator scripts are deliberately JavaScript and excluded from the app build.
// @ts-expect-error No declaration file for the Node operator tool.
import { planIngest, uploadPlan, endpointURL, validateConversion } from '../../tools/library-ingest.mjs';
import score from '../../scenarios/lab/00-document/01-minimal-single-note/document.mnx.json';

const token = 'test-only-private-token';
let directory: string;
const plan = async () => (await planIngest(directory))[0];
beforeEach(async () => { directory = await ingestSources(); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

it('fails closed when the server secret is absent', async () => {
  const response = await realApp.request('/api/library/ingest/ABC', { headers: { Authorization: `Bearer ${token}` } }, {});
  expect(response.status).toBe(503);
});
it('uses stable identities and refuses sidecar disagreement and path traversal', async () => {
  expect((await plan()).manifest).toEqual((await plan()).manifest);
  await writeFile(join(directory,'Song_ABC.lists.json'), JSON.stringify({ id: 'OTHER', score_file: 'Song_ABC.gp', lists: [] }));
  await expect(plan()).rejects.toThrow('disagree');
  await rm(join(directory,'Song_ABC.lists.json'));
  await writeFile(join(directory,'Song_ABC.sync.json'), JSON.stringify({ id: 'ABC', score_file: 'Song_ABC.gp', recordings: [{ id: 2, source: 2, media_file: '../secret' }] }));
  await expect(plan()).rejects.toThrow('plain filenames');
});
it('never sends credentials to insecure endpoints or follows redirects', async () => {
  for (const value of ['http://example.com','https://user:secret@example.com','https://example.com/path']) expect(() => endpointURL(value)).toThrow();
  let calls = 0;
  await expect(uploadPlan(await plan(), 'https://example.com', token, async (_url: string, options: RequestInit) => {
    calls++; expect(options.redirect).toBe('error'); return new Response('private response', { status: 302 });
  })).rejects.toThrow('302');
  expect(calls).toBe(1);
});
it('preserves validated converter labels without accepting other proposed fields', async () => {
  const { parseMnx } = await import('../../worker/library/tags.ts');
  const { default: published } = await import('../../worker/generated/validate-mnx.mjs');
  const doc = structuredClone(score);
  Object.assign(doc.global.measures[0], { section: { label: 'Verse' }, rehearsal: { label: 'A' } });
  expect(published(doc)).toBe(false); // AI validation stays published-only.
  const bytes = new TextEncoder().encode(JSON.stringify(doc)).buffer;
  expect(parseMnx(bytes)).toEqual(doc);
  Object.assign(doc.global.measures[0], { section: { label: 42 } });
  expect(() => parseMnx(new TextEncoder().encode(JSON.stringify(doc)).buffer)).toThrow('Invalid section');
  Object.assign(doc.global.measures[0], { section: { label: 'Verse' }, invented: true });
  expect(() => parseMnx(new TextEncoder().encode(JSON.stringify(doc)).buffer)).toThrow('storage schema');
});
it.each(['87.5', null, -0.5, Infinity, NaN])('does not exempt invalid tempo %s', bpm => {
  const doc = structuredClone(score);
  Object.assign(doc.global.measures[0], { tempos: [{ bpm, value: { base: 'quarter' } }] });
  const warnings: string[] = [];
  expect(validateConversion(doc, warnings).length).toBeGreaterThan(0);
  expect(warnings).toEqual([]);
});
