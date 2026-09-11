// Personal operator API. All library paths authenticate before reading a body or storage.
import type { FormData as MultipartFormData } from '@cloudflare/workers-types/2023-07-01';
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { Library, LibraryError, pieceIdFor, type Json, type PieceWrite, type RenditionInput, type RecordingInput, type DerivedTag } from '../library/index.ts';
import { accessIdentity, AccessError, type LibraryUser } from '../library/access.ts';

export const INGEST_OWNER = 'operator';
export const MAX_INGEST_BYTES = 24 * 1024 * 1024;
const encoder = new TextEncoder();
async function authentic(candidate: string, secret: string) {
  const key = (value: string) => crypto.subtle.importKey('raw', encoder.encode(value), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  // Native HMAC verification avoids a secret-dependent string comparison.
  const message = encoder.encode('mnx-library-ingest-auth-v1');
  const signature = await crypto.subtle.sign('HMAC', await key(secret), message);
  return crypto.subtle.verify('HMAC', await key(candidate), signature, message);
}
function invalid(message: string): never { throw new LibraryError('invalid', message); }
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) invalid('Expected an object');
  return v as Record<string, unknown>;
}
function text(v: unknown): string {
  if (typeof v !== 'string' || !v.trim() || v.length > 4096) invalid('Expected nonempty text (maximum 4096 characters)');
  return v;
}
function nullable(v: unknown): string | null { return v == null ? null : text(v); }
function array(v: unknown): unknown[] { if (!Array.isArray(v) || v.length > 100) invalid('Expected at most 100 entries'); return v; }
async function bounded(request: Request): Promise<ArrayBuffer> {
  if (Number(request.headers.get('content-length')) > MAX_INGEST_BYTES) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) invalid('Missing request body');
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_INGEST_BYTES) { await reader.cancel(); throw new RangeError(); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}
async function multipart(request: Request) {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.startsWith('multipart/form-data;')) invalid('Expected multipart/form-data');
  let form: MultipartFormData; let manifest: Record<string, unknown>;
  const body = await bounded(request);
  try {
    form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData() as MultipartFormData;
    const raw = form.get('manifest'); if (typeof raw !== 'string' || raw.length > 1024 * 1024) invalid('Invalid manifest');
    manifest = object(JSON.parse(raw));
  } catch { invalid('Invalid multipart manifest'); }
  return { form, manifest };
}
export const library = new Hono<{ Bindings: Env; Variables: { libraryUser: LibraryUser } }>();
library.use('*', async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  const machine = /^\/api\/library\/ingest(?:\/|$)/.test(c.req.path);
  if (machine) {
    const secret = c.env.LIBRARY_WRITE_TOKEN;
    if (!secret?.trim()) return c.json({ error: 'Library authentication is not configured' }, 503);
    const match = /^Bearer ([^\s]{1,4096})$/.exec(c.req.header('Authorization') ?? '');
    if (!match || !await authentic(match[1], secret)) return c.json({ error: 'Authentication required' }, 401);
  }
  try { c.set('libraryUser', await accessIdentity(c.req.raw, c.env, machine)); }
  catch (error) {
    const status = error instanceof AccessError ? error.status : 503;
    return c.json({ error: status === 403 ? 'User is not permitted' : 'Authentication required' }, status);
  }
  await next();
});
library.onError((error, c) => {
  if (error instanceof RangeError) return c.json({ error: 'Ingest exceeds 24 MiB' }, 413);
  if (error instanceof LibraryError) return c.json({ error: error.message }, error.code === 'conflict' ? 409 : error.code === 'not_found' ? 404 : 400);
  // Do not log request bodies, credentials or private score data.
  return c.json({ error: 'Library operation failed' }, 500);
});
library.get('/ingest/:sourceId', async c => {
  const lib = new Library(c.env.LIBRARY_DB, c.env.LIBRARY_BUCKET);
  const piece = await lib.findPiece(INGEST_OWNER, 'soundslice', c.req.param('sourceId'));
  return c.json({ snapshot: piece ? await lib.getPiece(INGEST_OWNER, piece.id) : null });
});
library.post('/ingest', async c => {
  const { form, manifest } = await multipart(c.req.raw);
  const allowed = ['expected_revision','source','renditions','recordings','tags','derived_tags','canonical'];
  if (Object.keys(manifest).some(k => !allowed.includes(k))) invalid('Unsupported manifest field');
  const source = object(manifest.source);
  if (source.kind !== 'soundslice') invalid('Only Soundslice operator imports are supported');
  const sourceId = text(source.id);
  if (!/^[a-zA-Z0-9]+$/.test(sourceId)) invalid('Invalid slice id');
  // The service names the piece; the manifest cannot (an `id` field is refused above).
  const id = await pieceIdFor('soundslice', sourceId);
  const revision = manifest.expected_revision;
  if (revision !== null && (!Number.isSafeInteger(revision) || Number(revision) < 0)) invalid('Invalid revision');
  const readBlob = async (row: Record<string, unknown>) => {
    const file = form.get(text(row.file));
    if (file === null || typeof file === 'string') invalid('Missing upload file');
    const sha256 = text(row.sha256);
    if (!/^[0-9a-f]{64}$/.test(sha256)) invalid('Invalid SHA-256');
    return { content: await file.arrayBuffer(), sha256 };
  };
  const renditions: RenditionInput[] = [];
  for (const value of array(manifest.renditions)) {
    const r = object(value);
    if (!['gp','gpx','gp5','gp4','gp3','musicxml','mnx'].includes(String(r.format)) || !['original','export','derived'].includes(String(r.role))) invalid('Invalid rendition');
    renditions.push({ id: text(r.id), format: r.format as RenditionInput['format'], role: r.role as RenditionInput['role'],
      producer: text(r.producer), producer_version: nullable(r.producer_version), producer_options: (r.producer_options ?? null) as Json,
      filename: nullable(r.filename), fetched_at: nullable(r.fetched_at), provenance: (r.provenance ?? null) as Json,
      derived_from: nullable(r.derived_from), ...await readBlob(r) });
  }
  const recordings: RecordingInput[] = [];
  for (const value of array(manifest.recordings)) {
    const r = object(value);
    if (!['audio','video','youtube'].includes(String(r.kind))) invalid('Invalid recording');
    if (r.duration_s != null && (typeof r.duration_s !== 'number' || !Number.isFinite(r.duration_s) || r.duration_s < 0)) invalid('Invalid duration');
    recordings.push({ id: text(r.id), kind: r.kind as RecordingInput['kind'], source_id: text(r.source_id),
      name: nullable(r.name), mime: nullable(r.mime), external_id: nullable(r.external_id), duration_s: r.duration_s as number | null,
      syncpoints: (r.syncpoints ?? null) as Json, ...(r.file === undefined ? {} : { blob: await readBlob(r) }) });
  }
  const canonical = object(manifest.canonical);
  if (canonical.mode !== 'initialize') invalid('Ingest may only initialize the canonical pointer');
  const canonicalId = text(canonical.rendition_id);
  const lib = new Library(c.env.LIBRARY_DB, c.env.LIBRARY_BUCKET);
  // A Soundslice piece's canonical is the Soundslice .gp — asserted by the tool,
  // enforced here, for the pointer being set now and for one already stored.
  // MNX is not (yet) a storage format; nothing derived is stored, and the
  // reader converts the .gp itself (roadmap: studio-storage-source-canonical).
  const existing = await lib.getPiece(INGEST_OWNER, id);
  const isSoundsliceGp = (r: { format: string; role: string } | undefined) => r?.format === 'gp' && r.role === 'export';
  const pointer = existing?.piece.canonical_rendition_id ?? canonicalId;
  const rows = [...(existing?.renditions ?? []), ...renditions];
  if (!isSoundsliceGp(rows.find(r => r.id === pointer))) throw new LibraryError('conflict', 'A Soundslice piece keeps the Soundslice .gp as canonical');
  const derived: DerivedTag[] | undefined = manifest.derived_tags === undefined ? undefined : array(manifest.derived_tags).map(value => {
    const t = object(value); return { dimension: text(t.dimension), value: text(t.value), source_ref: text(t.source_ref) };
  });
  const input: PieceWrite = { id, expected_revision: revision as number | null,
    source: { kind: 'soundslice', id: sourceId, url: `https://www.soundslice.com/slices/${sourceId}/` }, renditions, recordings,
    canonical: { mode: 'initialize', rendition_id: canonicalId },
    tags: array(manifest.tags).map(value => { const t = object(value);
      if (t.dimension !== 'unknown') invalid('Imported lists use the unknown dimension');
      return { dimension: 'unknown', value: text(t.value), source_ref: text(t.source_ref) };
    }), ...(derived ? { derived_tags: derived } : {}) };
  return c.json({ snapshot: await lib.writePiece(INGEST_OWNER, input) });
});

function reader(c: { env: Env }) { return new Library(c.env.LIBRARY_DB, c.env.LIBRARY_BUCKET); }
library.get('/me', c => c.json({ user: c.get('libraryUser') }));
library.get('/pieces', async c => {
  const filters = c.req.queries('tag') ?? [];
  if (filters.length > 12 || filters.some(t => t.length > 512 || !t.includes(':'))) return c.json({ error: 'Invalid tag filters' }, 400);
  const after = c.req.query('after') ?? '';
  if (after.length > 512) return c.json({ error: 'Invalid cursor' }, 400);
  return c.json(await reader(c).browsePieces(c.get('libraryUser').id, filters, after));
});
library.get('/tags', async c => {
  const prefix = c.req.query('q') ?? '';
  if (prefix.length > 512) return c.json({ error: 'Invalid prefix' }, 400);
  return c.json({ tags: await reader(c).completeTags(c.get('libraryUser').id, prefix) });
});
library.get('/pieces/:id', async c => {
  const snapshot = await reader(c).getPiece(c.get('libraryUser').id, c.req.param('id'));
  return snapshot ? c.json({ snapshot }) : c.json({ error: 'Piece not found' }, 404);
});
// The canonical file, as stored, in whatever format the owner regards as the
// source. The reader converts; the service never does.
library.get('/pieces/:id/canonical', async c => {
  const canonical = await reader(c).readCanonical(c.get('libraryUser').id, c.req.param('id'));
  if (!canonical) return c.json({ error: 'This piece has no canonical rendition' }, 409);
  const { rendition, object, revision } = canonical;
  c.header('Content-Type', 'application/octet-stream');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Content-Length', String(rendition.bytes));
  c.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(rendition.filename ?? `${rendition.id}.${rendition.format}`)}`);
  c.header('X-Library-Format', rendition.format);
  c.header('X-Library-Rendition', rendition.id);
  c.header('X-Library-Revision', String(revision));
  return c.body(object.body);
});
library.get('/renditions/:id', async c => {
  const { object, rendition } = await reader(c).readRendition(c.get('libraryUser').id, c.req.param('id'));
  c.header('Content-Type', 'application/octet-stream');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(rendition.filename ?? 'rendition')}`);
  return c.body(object.body);
});
