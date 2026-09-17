/**
 * The save check, off the main thread: export → re-import → compare runs in a
 * worker, so an autosave never stalls the score it is saving
 * (`storageCheckCore.ts` is the work; this is the door).
 */
import type { MnxStructure } from '../model/mnx.ts';
import type { StorageCheckResult } from './storageCheckCore.ts';

export type { StorageCheckResult, StorageLoss } from './storageCheckCore.ts';
export const STORAGE_CHECK_COMMAND = 'mnx-lab:check-storage';
export const STORAGE_CHECK_RESULT = 'mnx-lab:storage-checked';
export interface StorageCheckRequest { cmd: typeof STORAGE_CHECK_COMMAND; document: unknown }
export interface StorageCheckReply { cmd: typeof STORAGE_CHECK_RESULT; ok: boolean; result?: StorageCheckResult; error?: string }

export function checkForStorage(document: MnxStructure): Promise<StorageCheckResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./storageCheck.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<StorageCheckReply>) => {
      const reply = event.data;
      if (reply?.cmd !== STORAGE_CHECK_RESULT) return;
      worker.terminate();
      if (reply.ok && reply.result) resolve(reply.result);
      else reject(new Error(reply.error || 'The score could not be written as Guitar Pro.'));
    };
    worker.onerror = event => { worker.terminate(); reject(new Error(event.message || 'The save check could not start.')); };
    const request: StorageCheckRequest = { cmd: STORAGE_CHECK_COMMAND, document };
    worker.postMessage(request);
  });
}
