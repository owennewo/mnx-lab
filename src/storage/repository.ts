import { MnxDocument } from '../model/mnx.ts';

export interface DocumentRepository {
  load(id: string): Promise<MnxDocument | null>;
  save(doc: MnxDocument): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<Omit<MnxDocument, 'mnxJson'>[]>;
}
