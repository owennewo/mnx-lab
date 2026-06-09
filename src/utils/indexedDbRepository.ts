import { get, set, del, entries } from 'idb-keyval';
import { MnxDocument } from '../types/mnx.ts';
import { DocumentRepository } from '../types/repository.ts';

export class IndexedDbRepository implements DocumentRepository {
  private keyPrefix = 'mnx-doc:';

  async load(id: string): Promise<MnxDocument | null> {
    const doc = await get<MnxDocument>(`${this.keyPrefix}${id}`);
    return doc || null;
  }

  async save(doc: MnxDocument): Promise<void> {
    await set(`${this.keyPrefix}${doc.id}`, doc);
  }

  async delete(id: string): Promise<void> {
    await del(`${this.keyPrefix}${id}`);
  }

  async list(): Promise<Omit<MnxDocument, 'mnxJson'>[]> {
    const allEntries = await entries();
    const docs: Omit<MnxDocument, 'mnxJson'>[] = [];
    
    for (const [key, value] of allEntries) {
      if (typeof key === 'string' && key.startsWith(this.keyPrefix)) {
        const doc = value as MnxDocument;
        docs.push({
          id: doc.id,
          name: doc.name,
          lastUpdated: doc.lastUpdated
        });
      }
    }
    
    return docs.sort((a, b) => b.lastUpdated - a.lastUpdated);
  }
}
export const documentRepository: DocumentRepository = new IndexedDbRepository();
