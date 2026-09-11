import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
import type { MnxStructure } from '../model/mnx.ts';
import {
  FILE_IMPORT_COMMAND,
  FILE_IMPORT_RESULT,
  type FileImportReply,
  type FileImportRequest
} from './fileImporterProtocol.ts';

globalThis.onmessage = (event: MessageEvent<FileImportRequest>) => {
  const request = event.data;
  if (request?.cmd !== FILE_IMPORT_COMMAND || !(request.buffer instanceof ArrayBuffer)) {
    return;
  }
  const warnings: string[] = [];
  let reply: FileImportReply;
  try {
    const document = importGuitarProCleanRoom(new Uint8Array(request.buffer), {
      onWarning: warning => warnings.push(warning)
    });
    reply = {
      cmd: FILE_IMPORT_RESULT,
      ok: true,
      // The converter keeps its Node package types independent of src/model;
      // the shape is checked again by localFile before it reaches the editor.
      document: document as unknown as MnxStructure,
      warnings
    };
  } catch (error) {
    reply = {
      cmd: FILE_IMPORT_RESULT,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
  globalThis.postMessage(reply);
};
