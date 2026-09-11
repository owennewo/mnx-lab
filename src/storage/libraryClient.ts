// Optional same-origin library access. No credentials or private documents are persisted.
import type { MnxStructure } from '../model/mnx.ts';
export interface LibraryPiece { id: string; title: string | null; artist: string | null }
export interface LibraryTag { dimension: string; value: string }
export class LibraryRequestError extends Error {
  constructor(readonly status: number) { super(status === 401 ? 'Sign in to load your library.' : status === 403 ? 'This account is not permitted. Contact the operator.' : status === 409 ? 'This piece needs a current MNX conversion before it can be loaded.' : 'The library is unavailable. You can still open local files.'); }
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
  me() { return this.get<{ user: { id: string; email: string } }>('/me'); }
  pieces(tags: string[], after = '') { const q = new URLSearchParams({ after }); tags.forEach(t => q.append('tag', t)); return this.get<{ pieces: LibraryPiece[]; next: string | null }>(`/pieces?${q}`); }
  tags(prefix: string) { return this.get<{ tags: LibraryTag[] }>(`/tags?${new URLSearchParams({ q: prefix })}`); }
  mnx(id: string) { return this.get<{ document: MnxStructure; revision: number }>(`/pieces/${encodeURIComponent(id)}/mnx`); }
  signIn() { location.assign('/api/library/login'); }
  signOut() { location.assign('/cdn-cgi/access/logout'); }
}
