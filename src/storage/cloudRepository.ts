// Reserved seam — STUB by design (structure-lab). The workbench must never
// use this: it has no backend by rule (the corpus is committed JSON, and the
// only browser persistence today is localStorage UI preferences).
// CloudRepository exists so the future studio product has a typed client for
// the equally-reserved /api/documents route (worker/api/documents.ts,
// currently 501) when it starts.
import type { MnxDocument } from '../model/mnx.ts';
import type { DocumentRepository } from './repository.ts';

export class CloudRepository implements DocumentRepository {
  constructor(private readonly endpoint = '/api/documents') {}

  private async call<T>(pathname: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.endpoint}${pathname}`, init);
    if (response.status === 501) {
      throw new Error('Document sync is reserved for the studio product; not implemented.');
    }
    if (!response.ok) throw new Error(`documents API: ${response.status}`);
    return (await response.json()) as T;
  }

  load(id: string): Promise<MnxDocument | null> {
    return this.call(`/${encodeURIComponent(id)}`);
  }

  async save(doc: MnxDocument): Promise<void> {
    await this.call(`/${encodeURIComponent(doc.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc)
    });
  }

  async delete(id: string): Promise<void> {
    await this.call(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  list(): Promise<Omit<MnxDocument, 'mnxJson'>[]> {
    return this.call('/');
  }
}
