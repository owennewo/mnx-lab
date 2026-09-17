// Personal operator API. All library paths authenticate before reading a body or storage.
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { Library, LibraryError, pieceIdFor, type Json, type PieceWrite, type PieceSort, type RenditionInput, type RecordingInput, type DerivedTag } from '../library/index.ts';
import { accessIdentity, AccessError, type LibraryUser } from '../library/access.ts';

import { RecordingManager, type RecordingChange } from '../library/recordings.ts';

export const INGEST_OWNER = 'operator';
export const MAX_INGEST_BYTES = 24 * 1024 * 1024;
/** A score Studio wrote: a GP7 container is tens of KB, and it travels as base64 inside a JSON write. */
export const MAX_STUDIO_SCORE_BYTES = 1024 * 1024;
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
  let form: FormData; let manifest: Record<string, unknown>;
  const body = await bounded(request);
  try {
    form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData();
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
  // A browser write is a same-origin fetch with a JSON body; a cross-site form cannot say that.
  const audioUpload = c.req.method === 'PUT' && /^\/api\/library\/uploads\/studio-[0-9a-f-]{36}$/.test(c.req.path) && c.req.header('Content-Type') === 'application/octet-stream' && c.req.header('X-Recording-Upload') === '1';
  if (!machine && c.req.header('Origin') && c.req.header('Origin') !== new URL(c.req.url).origin) return c.json({ error: 'Same-origin writes only' }, 403);
  if (!machine && !audioUpload && c.req.method !== 'GET' && c.req.method !== 'HEAD' && !(c.req.header('Content-Type') ?? '').startsWith('application/json')) {
    return c.json({ error: 'Writes are JSON' }, 415);
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
  // A Soundslice slice id is a URL path segment and real ids carry hyphens
  // ("gn-8c", "-RBHc"); the tool's check is the same shape.
  if (!/^[A-Za-z0-9_-]+$/.test(sourceId)) invalid('Invalid slice id');
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
      syncpoints: (r.syncpoints ?? null) as Json,
      ...(r.provenance === undefined ? {} : { provenance: r.provenance as Json }),
      ...(r.file === undefined ? {} : { blob: await readBlob(r) }) });
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
  const current = rows.find(r => r.id === pointer);
  if (!isSoundsliceGp(current)) throw new LibraryError('conflict', 'A Soundslice piece keeps the Soundslice .gp as canonical');
  // A refetched Soundslice .gp is a newer copy of the same export, not a rival
  // choice: the pointer follows it forward while it still names an older
  // Soundslice .gp. Only forward — a replayed older cache never moves it back —
  // and never off a pointer the owner moved elsewhere (refused above).
  const offered = rows.find(r => r.id === canonicalId);
  const fetched = (value: string | null | undefined) => (value ? Date.parse(value) : NaN);
  const follow = !!existing && offered !== undefined && offered.id !== pointer && isSoundsliceGp(offered)
    && fetched(offered.fetched_at) > fetched(current?.fetched_at);
  const derived: DerivedTag[] | undefined = manifest.derived_tags === undefined ? undefined : array(manifest.derived_tags).map(value => {
    const t = object(value); return { dimension: text(t.dimension), value: text(t.value), source_ref: text(t.source_ref) };
  });
  const input: PieceWrite = { id, expected_revision: revision as number | null,
    source: { kind: 'soundslice', id: sourceId, url: `https://www.soundslice.com/slices/${sourceId}/` }, renditions, recordings,
    canonical: { mode: follow ? 'replace' : 'initialize', rendition_id: canonicalId },
    tags: array(manifest.tags).map(value => { const t = object(value);
      if (t.dimension !== 'list') invalid('Imported lists use the list dimension');
      return { dimension: 'list', value: text(t.value), source_ref: text(t.source_ref) };
    }), ...(derived ? { derived_tags: derived } : {}) };
  return c.json({ snapshot: await lib.writePiece(INGEST_OWNER, input) });
});

function reader(c: { env: Env }) { return new Library(c.env.LIBRARY_DB, c.env.LIBRARY_BUCKET); }
/** A JSON object body read under a byte limit, whatever Content-Length claims. */
async function boundedJson(request: Request, limit: number, what: string): Promise<Record<string, unknown>> {
  const stream = request.body?.getReader(); if (!stream) invalid(`${what}: missing request body.`);
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) { const { done, value } = await stream.read(); if (done) break; length += value.length;
    if (length > limit) { await stream.cancel(); invalid(`${what} exceeds ${limit / (1024 * 1024)} MiB.`); } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return object(JSON.parse(new TextDecoder().decode(bytes))); } catch { invalid(`${what}: expected a JSON object.`); }
}
library.get('/me', c => c.json({ user: c.get('libraryUser') }));
function filtersOf(c: { req: { queries(name: string): string[] | undefined } }) {
  const filters = c.req.queries('tag') ?? [];
  if (filters.length > 12 || filters.some(t => t.length > 512 || !t.includes(':'))) invalid('Invalid tag filters');
  return filters;
}
async function body(c: { req: { json(): Promise<unknown> } }): Promise<Record<string, unknown>> {
  try { return object(await c.req.json()); } catch { invalid('Expected a JSON object'); }
}
const SORTS: PieceSort[] = ['recent', 'title', 'artist'];
library.get('/pieces', async c => {
  const after = c.req.query('after') ?? '';
  if (after.length > 32) invalid('Invalid cursor');
  const sort = c.req.query('sort') ?? 'recent';
  if (!SORTS.includes(sort as PieceSort)) invalid('Invalid sort');
  return c.json(await reader(c).browsePieces(c.get('libraryUser').id, filtersOf(c), after, sort as PieceSort));
});
// The rail: every shown dimension:value among the matching pieces, with counts.
library.get('/facets', async c => c.json(await reader(c).facets(c.get('libraryUser').id, filtersOf(c))));
library.get('/tags', async c => {
  const prefix = c.req.query('q') ?? '';
  const dimension = c.req.query('dimension');
  if (prefix.length > 512 || (dimension !== undefined && (!dimension || dimension.length > 128))) invalid('Invalid prefix');
  return c.json({ tags: await reader(c).completeTags(c.get('libraryUser').id, prefix, dimension) });
});
library.get('/pieces/:id', async c => {
  const lib = reader(c); const owner = c.get('libraryUser').id;
  const snapshot = await lib.getPiece(owner, c.req.param('id'));
  if (!snapshot) return c.json({ error: 'Piece not found' }, 404);
  // Tags carry the stored value and how it is shown, so the sheet can draw both.
  return c.json({ snapshot: { ...snapshot, tags: Library.shown(snapshot.tags, await lib.listAliases(owner)) } });
});
// The piece page says it opened; the recent sort reads it.
library.post('/pieces/:id/opened', async c => {
  await reader(c).recordView(c.get('libraryUser').id, c.req.param('id'));
  return c.body(null, 204);
});
// A piece made in Studio. The browser built a document, exported it as Guitar
// Pro and read its tags off it; the service stores those bytes as the piece's
// first rendition and NAMES everything — piece, source and rendition ids are
// never the caller's. Like every browser write it is same-origin JSON, so the
// file travels as base64. Nothing is converted or derived here (the Worker
// holds no converter): `.gp` is the stored format and the reader converts
// (roadmap: studio-campaign-authoring, studio-piece-create).
library.post('/pieces', async c => {
  const b = await boundedJson(c.req.raw, 2 * 1024 * 1024, 'A new piece');
  if (Object.keys(b).some(k => !['rendition', 'derived_tags'].includes(k))) invalid('Unsupported field');
  const r = object(b.rendition);
  if (Object.keys(r).some(k => !['filename', 'sha256', 'content', 'producer_version', 'producer_options'].includes(k))) invalid('Unsupported rendition field');
  const filename = text(r.filename);
  if (filename.length > 255 || /[\\/\u0000-\u001f]/.test(filename) || !/\.gp$/i.test(filename)) invalid('Expected a plain .gp filename');
  const sha256 = text(r.sha256);
  if (!/^[0-9a-f]{64}$/.test(sha256)) invalid('Invalid SHA-256');
  if (typeof r.content !== 'string' || r.content.length > Math.ceil(MAX_STUDIO_SCORE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(r.content)) invalid('Expected the score as base64, at most 1 MiB');
  let content: Uint8Array;
  try { content = Uint8Array.from(atob(r.content), ch => ch.charCodeAt(0)); } catch { invalid('Expected the score as base64'); }
  // GP7 is a zip container; anything else is not something a reader could open.
  if (content.length < 4 || content.length > MAX_STUDIO_SCORE_BYTES || content[0] !== 0x50 || content[1] !== 0x4b || content[2] !== 0x03 || content[3] !== 0x04) invalid('Expected a Guitar Pro 7 file');
  const version = nullable(r.producer_version);
  const options = r.producer_options == null ? null : object(r.producer_options) as Json;
  const derived: DerivedTag[] = array(b.derived_tags).map(value => {
    const t = object(value);
    if (Object.keys(t).some(k => !['dimension', 'value'].includes(k))) invalid('Unsupported tag field');
    return { dimension: text(t.dimension), value: text(t.value), source_ref: `studio@${version ?? 'unversioned'}` };
  });
  if (!derived.some(t => t.dimension === 'title')) invalid('A piece needs a title');
  const sourceId = crypto.randomUUID();
  const id = await pieceIdFor('studio', sourceId);
  const renditionId = `${id}-${sha256.slice(0, 16)}`;
  const lib = reader(c); const owner = c.get('libraryUser').id;
  const snapshot = await lib.writePiece(owner, { id, expected_revision: null, source: { kind: 'studio', id: sourceId },
    renditions: [{ id: renditionId, format: 'gp', role: 'original', producer: 'studio', producer_version: version, producer_options: options,
      filename, content: content.buffer as ArrayBuffer, sha256 }],
    canonical: { mode: 'initialize', rendition_id: renditionId }, tags: [], derived_tags: derived });
  return c.json({ snapshot: { ...snapshot, tags: Library.shown(snapshot.tags, await lib.listAliases(owner)) } }, 201);
});
// Your own tags: add, remove, rename — never a derived one (the module refuses).
library.patch('/pieces/:id/tags', async c => {
  const owner = c.get('libraryUser').id; const id = c.req.param('id');
  const change = await body(c);
  if (Object.keys(change).some(k => !['expected_revision', 'add', 'remove', 'rename'].includes(k))) invalid('Unsupported field');
  if (!Number.isSafeInteger(change.expected_revision) || Number(change.expected_revision) < 0) invalid('Expected the piece revision');
  const pair = (v: unknown) => { const t = object(v); return { dimension: text(t.dimension), value: text(t.value) }; };
  const input: PieceWrite = { id, expected_revision: change.expected_revision as number,
    tags: change.add === undefined ? [] : array(change.add).map(pair),
    remove_tags: change.remove === undefined ? [] : array(change.remove).map(pair),
    rename_tags: change.rename === undefined ? [] : array(change.rename).map(v => { const r = object(v);
      return { ...pair(r.from), to_dimension: text(object(r.to).dimension), to_value: text(object(r.to).value) }; }) };
  const lib = reader(c);
  if (!await lib.getPiece(owner, id)) return c.json({ error: 'Piece not found' }, 404);
  const snapshot = await lib.writePiece(owner, input);
  return c.json({ snapshot: { ...snapshot, tags: Library.shown(snapshot.tags, await lib.listAliases(owner)) } });
});
// Aliases: how a value read from the music is shown, library-wide.
library.get('/aliases', async c => c.json({ aliases: await reader(c).listAliases(c.get('libraryUser').id) }));
library.put('/aliases', async c => {
  const a = await body(c);
  if (Object.keys(a).some(k => !['dimension', 'raw_value', 'canonical_value'].includes(k))) invalid('Unsupported field');
  await reader(c).setAlias(c.get('libraryUser').id, text(a.dimension), text(a.raw_value), text(a.canonical_value));
  return c.json({ aliases: await reader(c).listAliases(c.get('libraryUser').id) });
});
library.delete('/aliases', async c => {
  const a = await body(c);
  if (Object.keys(a).some(k => !['dimension', 'raw_value'].includes(k))) invalid('Unsupported field');
  await reader(c).deleteAlias(c.get('libraryUser').id, text(a.dimension), text(a.raw_value));
  return c.json({ aliases: await reader(c).listAliases(c.get('libraryUser').id) });
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

// Native audio sends Range and same-origin Access cookies. Every request checks
// membership/ownership, including HEAD; neither private keys nor signed blob URLs
// are exposed. If-Range requests receive a full response (no validators advertised).
library.on(['GET', 'HEAD'], '/recordings/:id/audio', async c => {
  const { recording, range, body } = await reader(c).readRecording(c.get('libraryUser').id, c.req.param('id'), {
    head: c.req.method === 'HEAD', range: c.req.header('If-Range') ? undefined : c.req.header('Range'),
  });
  c.header('Accept-Ranges', 'bytes');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Content-Type', recording.mime && /^audio\/[a-z0-9.+-]+$/i.test(recording.mime) ? recording.mime : 'application/octet-stream');
  c.header('Content-Disposition', 'inline');
  c.header('Content-Length', String(range.length));
  if (range.status === 416) c.header('Content-Range', `bytes */${recording.bytes}`);
  if (range.status === 206) c.header('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${recording.bytes}`);
  return c.newResponse(body, range.status);
});

// Browser recording authoring. The raw upload requires a non-simple header and
// the same authenticated owner; CORS is not enabled on these routes.
function recordingManager(c: { env: Env }) { return new RecordingManager(c.env.LIBRARY_DB, c.env.LIBRARY_BUCKET); }
function recordingBody(request: Request) { return boundedJson(request, 2 * 1024 * 1024, 'Recording metadata'); }
function recordingChange(value: Record<string, unknown>): RecordingChange {
  if (Object.keys(value).some(k => !['expected_revision','name','rawSync','selectedId','video','sha256','bytes','mime'].includes(k))) invalid('Unsupported recording field.');
  if (!Number.isSafeInteger(value.expected_revision)) invalid('Expected the piece revision.');
  return { name: text(value.name), ...(value.rawSync === undefined ? {} : { rawSync: value.rawSync }),
    selectedId: nullable(value.selectedId), ...(value.video === undefined ? {} : { video: text(value.video) }) };
}
library.put('/pieces/:piece/recordings/:id', async c => {
  const b = await recordingBody(c.req.raw); const change = recordingChange(b);
  return c.json({ snapshot: await recordingManager(c).save(c.get('libraryUser').id, c.req.param('piece'), c.req.param('id'), Number(b.expected_revision), change) });
});
library.delete('/pieces/:piece/recordings/:id', async c => {
  const b = await recordingBody(c.req.raw);
  if (!Number.isSafeInteger(b.expected_revision)) invalid('Expected the piece revision.');
  return c.json({ snapshot: await recordingManager(c).remove(c.get('libraryUser').id, c.req.param('piece'), c.req.param('id'), Number(b.expected_revision)) });
});
library.post('/pieces/:piece/uploads/:id', async c => {
  const b = await recordingBody(c.req.raw); const change = recordingChange(b);
  return c.json(await recordingManager(c).begin(c.get('libraryUser').id, c.req.param('piece'), c.req.param('id'), Number(b.expected_revision), change, { sha256: text(b.sha256), bytes: Number(b.bytes), mime: text(b.mime) }));
});
library.put('/uploads/:id', async c => {
  if (c.req.header('Content-Type') !== 'application/octet-stream' || c.req.header('X-Recording-Upload') !== '1') return c.json({ error: 'Expected an authenticated binary audio upload.' }, 415);
  return c.json({ snapshot: await recordingManager(c).upload(c.get('libraryUser').id, c.req.param('id'), c.req.raw) });
});
library.delete('/uploads/:id', async c => c.json(await recordingManager(c).cancel(c.get('libraryUser').id, c.req.param('id'))));
