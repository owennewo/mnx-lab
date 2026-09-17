import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { attachmentSync, MAX_AUDIO_BYTES, MAX_SYNC_BYTES, AUDIO_FORMATS } from '../../src/model/recordingAttachment.ts';
import { youtubeVideoId } from '../../src/model/youtubeUrl.ts';
import { Library } from './index.ts';
import { LibraryError, json, type Json, type Recording, type Snapshot } from './types.ts';

export interface RecordingChange { name: string; rawSync?: unknown; selectedId?: string | null; video?: string;
  /** The score shape this sync is known good for; null forgets it. Rides in the provenance, whatever else is there. */
  scoreShape?: string | null }
interface Metadata { name: string; syncpoints: string | null; provenance: string | null; external_id: string | null }
interface Upload { id: string; owner: string; piece_id: string; expected_revision: number; metadata: string; sha256: string; bytes: number; mime: string; state: 'pending' | 'complete' | 'cancelled'; expires_at: string }
function invalid(message: string): never { throw new LibraryError('invalid', message); }
function revision(value: number) { if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) invalid('Expected the piece revision.'); }
export function recordingId(id: string) { if (!/^studio-[0-9a-f-]{36}$/.test(id)) invalid('Expected a Studio recording ID.'); }
function metadata(change: RecordingChange, old?: Recording): Metadata {
  if (typeof change.name !== 'string' || !change.name.trim() || change.name.length > 200) invalid('Name the recording (up to 200 characters).');
  let syncpoints = old?.syncpoints ?? null, provenance = old?.provenance ?? null;
  if (change.rawSync !== undefined || !old) {
    if (new TextEncoder().encode(JSON.stringify(change.rawSync ?? null)).length > MAX_SYNC_BYTES) invalid('Sync JSON exceeds 1 MiB.');
    try {
      const parsed = attachmentSync(change.rawSync ?? null, change.selectedId ?? null);
      syncpoints = parsed.syncpoints === null ? null : json(parsed.syncpoints as Json);
      provenance = json(JSON.parse(JSON.stringify(parsed.provenance)) as Json);
    } catch (e) { invalid(e instanceof Error ? e.message : 'Invalid sync data.'); }
  }
  if (change.scoreShape !== undefined) {
    if (change.scoreShape !== null && (typeof change.scoreShape !== 'string' || !change.scoreShape || change.scoreShape.length > 4096)) invalid('A score shape is up to 4096 characters.');
    let held: Record<string, Json> = {};
    try { const parsed = provenance === null ? null : JSON.parse(provenance); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) held = parsed; } catch { /* unreadable provenance is replaced by the stamp alone */ }
    if (change.scoreShape === null) delete held.scoreShape; else held.scoreShape = change.scoreShape;
    provenance = Object.keys(held).length ? json(held) : null;
  }
  let external_id = old?.external_id ?? null;
  if (change.video !== undefined) { try { external_id = youtubeVideoId(change.video); } catch (e) { invalid(String(e instanceof Error ? e.message : e)); } }
  const result = { name: change.name.trim(), syncpoints, provenance, external_id };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 1536 * 1024) invalid('Combined raw and validated recording metadata exceeds 1.5 MiB.');
  return result;
}
export class RecordingManager {
  private library: Library;
  constructor(private db: D1Database, private bucket: R2Bucket) { this.library = new Library(db, bucket); }
  private sql(text: string, ...values: unknown[]) { return this.db.prepare(text).bind(...values); }
  private async piece(owner: string, id: string) { const snapshot = await this.library.getPiece(owner, id); if (!snapshot) throw new LibraryError('not_found', 'Piece not found.'); return snapshot; }
  private check(snapshot: Snapshot, expected: number) { revision(expected); if (snapshot.piece.revision !== expected) throw new LibraryError('conflict', 'This piece changed. Reload and review before saving again.'); }
  private cas(owner: string, piece: string, expected: number) {
    return this.sql('UPDATE pieces SET revision=?,updated_at=? WHERE id=? AND owner=?', expected + 1, new Date().toISOString(), piece, owner);
  }
  private async commit(statements: ReturnType<RecordingManager['sql']>[]) {
    try { const r = await this.db.batch(statements); if (r[0].meta.changes !== 1) throw new LibraryError('conflict', 'Piece changed.'); }
    catch (e) { if (/library_revision_conflict|UNIQUE constraint|CHECK constraint/.test(String(e))) throw new LibraryError('conflict', 'The recording changed or upload was cancelled. Reload before retrying.'); throw e; }
  }
  async save(owner: string, piece: string, id: string, expected: number, change: RecordingChange) {
    const snapshot = await this.piece(owner, piece); revision(expected);
    const old = snapshot.recordings.find(r => r.id === id);
    const m = metadata(change, old);
    if (old) {
      if (change.video !== undefined && m.external_id !== old.external_id) invalid('Attach a new recording to use different media.');
      // Lost-response retries are safe without rewriting a concurrent edit.
      if (Object.entries(m).every(([k,v]) => old[k as keyof Recording] === v)) return snapshot;
      this.check(snapshot, expected);
      await this.commit([this.cas(owner, piece, expected), this.sql('UPDATE recordings SET name=?,syncpoints=?,provenance=?,updated_at=? WHERE id=? AND piece_id=?', m.name, m.syncpoints, m.provenance, new Date().toISOString(), id, piece)]);
    } else {
      recordingId(id); this.check(snapshot, expected);
      if (!m.external_id) invalid('A new recording needs a YouTube link or an audio upload.');
      await this.commit([this.cas(owner, piece, expected), this.insert(piece, id, m)]);
    }
    return (await this.piece(owner, piece));
  }
  private insert(piece: string, id: string, m: Metadata, upload?: Upload) {
    const now = new Date().toISOString();
    return this.sql(`INSERT INTO recordings (id,piece_id,kind,name,r2_key,sha256,bytes,mime,external_id,syncpoints,provenance,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, piece, upload ? 'audio' : 'youtube', m.name, upload ? `recordings/${upload.sha256}` : null,
      upload?.sha256 ?? null, upload?.bytes ?? null, upload?.mime ?? null, m.external_id, m.syncpoints, m.provenance, now, now);
  }
  async remove(owner: string, piece: string, id: string, expected: number) {
    const snapshot = await this.piece(owner, piece); this.check(snapshot, expected);
    if (!snapshot.recordings.some(r => r.id === id)) throw new LibraryError('not_found', 'Recording not found.');
    await this.commit([this.cas(owner, piece, expected), this.sql('DELETE FROM recordings WHERE id=? AND piece_id=?', id, piece)]);
    // Shared content-addressed bytes are never deleted by a detach. Offline GC owns them.
    return this.piece(owner, piece);
  }
  async begin(owner: string, piece: string, id: string, expected: number, change: RecordingChange, audio: { sha256: string; bytes: number; mime: string }) {
    recordingId(id); revision(expected);
    const snapshot = await this.piece(owner, piece);
    if (!/^[0-9a-f]{64}$/.test(audio.sha256) || !Number.isSafeInteger(audio.bytes) || audio.bytes < 1 || audio.bytes > MAX_AUDIO_BYTES) invalid('Audio must be 1 byte–64 MiB, with a SHA-256 checksum.');
    if (!Object.values(AUDIO_FORMATS).includes(audio.mime)) invalid('Supported audio: MP3, M4A, WAV, Ogg and FLAC.');
    if (change.video !== undefined) invalid('Audio uploads cannot contain a YouTube link.');
    const m = metadata(change), encoded = JSON.stringify(m);
    const old = await this.sql('SELECT * FROM recording_uploads WHERE id=? AND owner=? AND piece_id=?', id, owner, piece).first<Upload>();
    if (old) {
      if (old.state === 'cancelled' || old.expires_at <= new Date().toISOString() || old.expected_revision !== expected || old.metadata !== encoded || old.sha256 !== audio.sha256 || old.bytes !== audio.bytes || old.mime !== audio.mime) throw new LibraryError('conflict', 'Use a new upload after cancellation or changing its details.');
      return { id, state: old.state, expiresAt: old.expires_at };
    }
    this.check(snapshot, expected);
    if (snapshot.recordings.some(r => r.id === id)) throw new LibraryError('conflict', 'Recording identity already exists. Attach with a new ID.');
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    try { await this.sql('INSERT INTO recording_uploads (id,owner,piece_id,expected_revision,metadata,sha256,bytes,mime,expires_at) VALUES (?,?,?,?,?,?,?,?,?)', id, owner, piece, expected, encoded, audio.sha256, audio.bytes, audio.mime, expiresAt).run(); }
    catch (e) { if (/UNIQUE constraint/.test(String(e))) throw new LibraryError('conflict', 'Upload identity already exists. Retry.'); throw e; }
    return { id, state: 'pending' as const, expiresAt };
  }
  async upload(owner: string, id: string, request: Request) {
    const u = await this.sql('SELECT * FROM recording_uploads WHERE id=? AND owner=?', id, owner).first<Upload>();
    if (!u) throw new LibraryError('not_found', 'Upload not found.');
    const snapshot = await this.piece(owner, u.piece_id);
    if (u.state === 'complete') { await request.body?.cancel(); return snapshot; }
    if (u.state !== 'pending' || u.expires_at <= new Date().toISOString()) throw new LibraryError('conflict', 'Upload cancelled or expired. Start a new upload.');
    this.check(snapshot, u.expected_revision);
    if (Number(request.headers.get('content-length')) !== u.bytes || !request.body) invalid('Upload length differs from the selected file.');
    // R2 validates the supplied SHA-256 while streaming; no whole-file Worker buffer.
    // Always consume/verify bytes, even when this digest is already stored: a hash is not an ownership credential.
    let stored;
    try { stored = await this.bucket.put(`recordings/${u.sha256}`, request.body, { sha256: u.sha256 }); }
    catch { throw new LibraryError('blob', 'Audio transfer or checksum verification failed. Retry the selected file.'); }
    if (!stored || stored.size !== u.bytes) throw new LibraryError('blob', 'Upload integrity check failed. Retry the file.');
    await this.commit([this.cas(owner, u.piece_id, u.expected_revision),
      this.sql("UPDATE recording_uploads SET state=CASE WHEN state='pending' AND expires_at>? THEN 'complete' ELSE 'invalid' END WHERE id=? AND owner=?", new Date().toISOString(), id, owner),
      this.insert(u.piece_id, id, JSON.parse(u.metadata) as Metadata, u)]);
    return this.piece(owner, u.piece_id);
  }
  async cancel(owner: string, id: string) {
    const u = await this.sql('SELECT * FROM recording_uploads WHERE id=? AND owner=?', id, owner).first<Upload>();
    if (!u) throw new LibraryError('not_found', 'Upload not found.');
    await this.piece(owner, u.piece_id);
    await this.sql("UPDATE recording_uploads SET state='cancelled' WHERE id=? AND owner=? AND state='pending'", id, owner).run();
    return { state: (await this.sql('SELECT state FROM recording_uploads WHERE id=? AND owner=?', id, owner).first<{state: string}>())!.state };
  }
}
