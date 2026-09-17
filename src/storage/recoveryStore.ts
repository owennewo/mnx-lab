/**
 * The local recovery record: the live document of a piece with unsaved edits,
 * kept on this device until the next checkpoint (roadmap: studio-save-pipeline).
 *
 * Disposable by design. It is not a storage format and is never migrated: the
 * record is the working document exactly as the editor held it, stamped with the
 * build that wrote it, and it opens through the same upgrade path as any
 * `.mnx.json`. One that will not open is offered to the owner as a file, not
 * repaired. It exists only while the piece is dirty, so losing it costs at most
 * the edits since the last checkpoint — and the service never sees it.
 */
export interface RecoveryRecord<D> {
  pieceId: string;
  document: D;
  /** The rendition the document was last saved as: a record against any other base is a fork. */
  baseRenditionId: string;
  build: string;
  /** History events since that checkpoint, for the chip. */
  edits: number;
  writtenAt: number;
}

export interface RecoveryStore<D> {
  read(pieceId: string): Promise<RecoveryRecord<D> | null>;
  write(record: RecoveryRecord<D>): Promise<void>;
  clear(pieceId: string): Promise<void>;
}

export function memoryRecoveryStore<D>(): RecoveryStore<D> {
  const records = new Map<string, RecoveryRecord<D>>();
  return {
    read: async id => records.get(id) ?? null,
    // A structured clone, as IndexedDB makes: the record must not alias the live document.
    write: async record => { records.set(record.pieceId, structuredClone(record)); },
    clear: async id => { records.delete(id); }
  };
}

const STORE = 'recovery';

/** IndexedDB, one record per piece. Every failure is the caller's to ignore: a blocked store must not stop an editor. */
export function indexedDbRecoveryStore<D>(name = 'mnx-studio.recovery'): RecoveryStore<D> {
  let opening: Promise<IDBDatabase> | null = null;
  const open = () => (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE, { keyPath: 'pieceId' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(request.error ?? new Error('The recovery store could not be opened.')); };
    request.onblocked = () => { opening = null; reject(new Error('The recovery store is blocked by another tab.')); };
  }));
  const run = async <T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = act(transaction.objectStore(STORE));
      // Durable means the transaction committed, not that the request was accepted.
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? request.error ?? new Error('The recovery store refused the write.'));
    });
  };
  return {
    read: async id => (await run<RecoveryRecord<D> | undefined>('readonly', store => store.get(id))) ?? null,
    write: async record => { await run('readwrite', store => store.put(record)); },
    clear: async id => { await run('readwrite', store => store.delete(id)); }
  };
}
