import { MAX_AUDIO_BYTES, AUDIO_FORMATS } from '../model/recordingAttachment.ts';
// Optional same-origin library access. No credentials or private documents are persisted.
export interface LibraryPiece { id: string; revision: number; title: string | null; artist: string | null; favourite: boolean; opened_at: string | null; chips: { dimension: string; value: string }[] }
export interface LibraryFacet { dimension: string; value: string; pieces: number }
export interface LibraryAlias { dimension: string; raw_value: string; canonical_value: string; pieces: number }
export interface ShownTag { dimension: string; value: string; shown: string; origin: 'derived' | 'asserted'; source_ref: string | null }
export type LibrarySort = 'recent' | 'title' | 'artist';
export interface TagChange { add?: { dimension: string; value: string }[]; remove?: { dimension: string; value: string }[]; rename?: { from: { dimension: string; value: string }; to: { dimension: string; value: string } }[] }
export interface LibraryTag { dimension: string; value: string }
export interface RecordingChange { name: string; rawSync?: unknown; selectedId?: string | null; video?: string }
export interface LibraryRecording {
  provenance?: string | null;
  id: string; kind: 'audio' | 'video' | 'youtube'; name: string | null;
  mime: string | null; duration_s: number | null; external_id: string | null; syncpoints: string | null;
}
export interface LibrarySnapshot { piece: { id: string; revision: number; canonical_rendition_id?: string | null }; tags: ShownTag[]; recordings: LibraryRecording[] }
export interface CanonicalFile { bytes: ArrayBuffer; format: string; filename: string; revision: number; renditionId?: string }
export class LibraryRequestError extends Error {
  constructor(readonly status: number, message?: string) { super(message ?? (status === 401 ? 'Sign in to load your library.' : status === 403 ? 'This account is not permitted. Contact the operator.' : status === 409 ? 'This piece has no canonical file to open.' : 'The library is unavailable. You can still open local files.')); }
}
export class LibraryClient {
  constructor(private readonly transport: typeof fetch = (input, init) => fetch(input, init)) {}
  async available(): Promise<boolean> {
    try { const r = await this.transport('/api/capabilities', { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) }); return r.ok && (await r.json()).library === true; }
    catch { return false; }
  }
  private async get<T>(path: string): Promise<T> {
    let r: Response;
    try { r = await this.transport(`/api/library${path}`, { credentials: 'same-origin', cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15000) }); }
    catch { throw new LibraryRequestError(0); }
    if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)) throw new LibraryRequestError(401);
    if (!r.ok) throw new LibraryRequestError(r.status);
    if (!r.headers.get('content-type')?.includes('application/json')) throw new LibraryRequestError(0);
    return r.json();
  }
  private async send<T>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, payload: unknown): Promise<T> {
    let r: Response;
    try { r = await this.transport(`/api/library${path}`, { method, body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15000) }); }
    catch { throw new LibraryRequestError(0); }
    if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)) throw new LibraryRequestError(401);
    if (!r.ok) throw new LibraryRequestError(r.status);
    if (r.status === 204) return undefined as T;
    if (!r.headers.get('content-type')?.includes('application/json')) throw new LibraryRequestError(0);
    return r.json();
  }
  me() { return this.get<{ user: { id: string; email: string } }>('/me'); }
  facets(tags: string[]) { const q = new URLSearchParams(); tags.forEach(t => q.append('tag', t)); return this.get<{ total: number; facets: LibraryFacet[] }>(`/facets?${q}`); }
  opened(id: string) { return this.send<void>('POST', `/pieces/${encodeURIComponent(id)}/opened`, {}); }
  changeTags(id: string, revision: number, change: TagChange) { return this.send<{ snapshot: { piece: { id: string; revision: number; canonical_rendition_id?: string | null }; tags: ShownTag[] } }>('PATCH', `/pieces/${encodeURIComponent(id)}/tags`, { expected_revision: revision, ...change }); }
  aliases() { return this.get<{ aliases: LibraryAlias[] }>('/aliases'); }
  setAlias(dimension: string, raw: string, canonical: string) { return this.send<{ aliases: LibraryAlias[] }>('PUT', '/aliases', { dimension, raw_value: raw, canonical_value: canonical }); }
  deleteAlias(dimension: string, raw: string) { return this.send<{ aliases: LibraryAlias[] }>('DELETE', '/aliases', { dimension, raw_value: raw }); }
  piece(id: string) { return this.get<{ snapshot: LibrarySnapshot }>(`/pieces/${encodeURIComponent(id)}`); }
  recordingUrl(id: string) { return `/api/library/recordings/${encodeURIComponent(id)}/audio`; }
  pieces(tags: string[], after = '', sort: LibrarySort = 'recent') { const q = new URLSearchParams({ after, sort }); tags.forEach(t => q.append('tag', t)); return this.get<{ pieces: LibraryPiece[]; next: string | null }>(`/pieces?${q}`); }
  tags(prefix: string, dimension?: string) { const q = new URLSearchParams({ q: prefix }); if (dimension) q.set('dimension', dimension); return this.get<{ tags: LibraryFacet[] }>(`/tags?${q}`); }
  /** The canonical file as stored — a .gp for a Soundslice piece. The caller
   *  converts (src/importers); the service never does. */
  async canonical(id: string): Promise<CanonicalFile> {
    let r: Response;
    try { r = await this.transport(`/api/library/pieces/${encodeURIComponent(id)}/canonical`, { credentials: 'same-origin', cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(30000) }); }
    catch { throw new LibraryRequestError(0); }
    if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)) throw new LibraryRequestError(401);
    if (!r.ok) throw new LibraryRequestError(r.status);
    const format = r.headers.get('x-library-format') ?? '';
    const encoded = /filename\*=UTF-8''([^;]+)/.exec(r.headers.get('content-disposition') ?? '')?.[1];
    const filename = encoded ? decodeURIComponent(encoded) : `piece.${format || 'bin'}`;
    return { bytes: await r.arrayBuffer(), format, filename, revision: Number(r.headers.get('x-library-revision') ?? 0), renditionId: r.headers.get('x-library-rendition') ?? undefined };
  }
  private async recordingRequest<T>(path: string, method: string, payload: unknown, signal?: AbortSignal, file?: File): Promise<T> {
    let response: Response;
    try { response = await this.transport(`/api/library${path}`, { method, credentials: 'same-origin', cache: 'no-store', redirect: 'manual',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(file ? 300000 : 30000)]) : AbortSignal.timeout(30000),
      headers: file ? { 'Content-Type': 'application/octet-stream', 'X-Recording-Upload': '1' } : { 'Content-Type': 'application/json' },
      body: file ?? JSON.stringify(payload) }); }
    catch (error) { if (signal?.aborted) throw new Error('Upload cancelled.'); throw new LibraryRequestError(0, 'The request did not finish. Retry to check whether it saved.'); }
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) throw new LibraryRequestError(401);
    if (!response.headers.get('content-type')?.includes('application/json')) throw new LibraryRequestError(response.status);
    const value = await response.json();
    if (!response.ok) throw new LibraryRequestError(response.status, typeof value.error === 'string' ? value.error : undefined);
    return value as T;
  }
  saveRecording(piece: string, id: string, revision: number, change: RecordingChange) {
    return this.recordingRequest<{ snapshot: LibrarySnapshot }>(`/pieces/${encodeURIComponent(piece)}/recordings/${encodeURIComponent(id)}`, 'PUT', { expected_revision: revision, ...change });
  }
  removeRecording(piece: string, id: string, revision: number) {
    return this.recordingRequest<{ snapshot: LibrarySnapshot }>(`/pieces/${encodeURIComponent(piece)}/recordings/${encodeURIComponent(id)}`, 'DELETE', { expected_revision: revision });
  }
  cancelRecordingUpload(id: string) { return this.recordingRequest<{ state: string }>(`/uploads/${encodeURIComponent(id)}`, 'DELETE', {}); }
  async uploadRecording(piece: string, id: string, revision: number, change: RecordingChange, file: File, signal: AbortSignal, progress: (stage: string) => void) {
    const mime = AUDIO_FORMATS[file.name.split('.').at(-1)?.toLowerCase() ?? ''];
    if (!mime || file.size < 1 || file.size > MAX_AUDIO_BYTES) throw new Error('Choose MP3, M4A, WAV, Ogg or FLAC audio, up to 64 MiB.');
    progress('Checking audio…');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
    signal.throwIfAborted();
    await this.recordingRequest(`/pieces/${encodeURIComponent(piece)}/uploads/${encodeURIComponent(id)}`, 'POST', { expected_revision: revision, ...change, sha256, bytes: file.size, mime }, signal);
    signal.throwIfAborted(); progress('Uploading audio…');
    return this.recordingRequest<{ snapshot: LibrarySnapshot }>(`/uploads/${encodeURIComponent(id)}`, 'PUT', null, signal, file);
  }
  signOut() { location.assign('/cdn-cgi/access/logout'); }
}
