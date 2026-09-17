import { checkStorage } from './storageCheckCore.ts';
import type { MnxStructure } from '../model/mnx.ts';
import { STORAGE_CHECK_COMMAND, STORAGE_CHECK_RESULT, type StorageCheckReply, type StorageCheckRequest } from './storageCheck.ts';

globalThis.onmessage = (event: MessageEvent<StorageCheckRequest>) => {
  const request = event.data;
  if (request?.cmd !== STORAGE_CHECK_COMMAND) return;
  let reply: StorageCheckReply;
  try { reply = { cmd: STORAGE_CHECK_RESULT, ok: true, result: checkStorage(request.document as MnxStructure) }; }
  catch (error) { reply = { cmd: STORAGE_CHECK_RESULT, ok: false, error: error instanceof Error ? error.message : String(error) }; }
  globalThis.postMessage(reply, { transfer: reply.ok && reply.result ? [reply.result.bytes.buffer as ArrayBuffer] : [] });
};
