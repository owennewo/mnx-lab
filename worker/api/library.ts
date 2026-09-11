// Personal operator API. All library paths authenticate before reading a body or storage.
import type { FormData as MultipartFormData } from '@cloudflare/workers-types/2023-07-01';
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { Library, LibraryError, type Json, type PieceWrite, type RenditionInput, type RecordingInput } from '../library/index.ts';
import { documentWork } from '../../src/model/mnx.ts';

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
function versions(v: unknown): Record<string, string> { return Object.fromEntries(Object.entries(object(v)).map(([k,v]) => [text(k), text(v)])); }
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
export const library = new Hono<{ Bindings: Env }>();
library.use('*', async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  const secret = c.env.LIBRARY_WRITE_TOKEN;
  if (!secret?.trim()) return c.json({ error: 'Library authentication is not configured' }, 503);
  const header = c.req.header('Authorization') ?? '';
  const match = /^Bearer ([^\s]{1,4096})$/.exec(header);
  if (!match || !await authentic(match[1], secret)) {
    c.header('WWW-Authenticate', 'Bearer');
    return c.json({ error: 'Authentication required' }, 401);
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
  const contentType = c.req.header('Content-Type') ?? '';
  if (!contentType.startsWith('multipart/form-data;')) return c.json({ error: 'Expected multipart/form-data' }, 415);
  let form: MultipartFormData; let manifest: Record<string, unknown>;
  const body = await bounded(c.req.raw);
  try {
    form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData() as MultipartFormData;
    const raw = form.get('manifest'); if (typeof raw !== 'string' || raw.length > 1024 * 1024) invalid('Invalid manifest');
    manifest = object(JSON.parse(raw));
  } catch { invalid('Invalid multipart manifest'); }
  const allowed = ['id','expected_revision','source','renditions','recordings','tags','canonical','converter_versions'];
  if (Object.keys(manifest).some(k => !allowed.includes(k))) invalid('Unsupported manifest field');
  const source = object(manifest.source);
  if (source.kind !== 'soundslice') invalid('Only Soundslice operator imports are supported');
  const sourceId = text(source.id);
  if (!/^[a-zA-Z0-9]+$/.test(sourceId)) invalid('Invalid slice id');
  const id = text(manifest.id);
  if (id !== `soundslice:${sourceId}`) invalid('Piece id must match source identity');
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
  const input: PieceWrite = { id, expected_revision: revision as number | null,
    source: { kind: 'soundslice', id: sourceId, url: `https://www.soundslice.com/slices/${sourceId}/` }, renditions, recordings,
    canonical: { mode: 'initialize', rendition_id: text(canonical.rendition_id) },
    tags: array(manifest.tags).map(value => { const t = object(value);
      if (t.dimension !== 'unknown') invalid('Imported lists use the unknown dimension');
      return { dimension: 'unknown', value: text(t.value), source_ref: text(t.source_ref) };
    }) };
  const lib = new Library(c.env.LIBRARY_DB, c.env.LIBRARY_BUCKET, versions(manifest.converter_versions));
  const snapshot = await lib.writePiece(INGEST_OWNER, input);
  const canonicalMnx = await lib.readCanonicalMnx(INGEST_OWNER, id);
  return c.json({ snapshot, canonical: canonicalMnx ? { rendition_id: canonicalMnx.rendition.id,
    work: documentWork(canonicalMnx.document), capos: canonicalMnx.document.parts.map(p => p._x?.mnxLab?.capo ?? null) } : null });
});
