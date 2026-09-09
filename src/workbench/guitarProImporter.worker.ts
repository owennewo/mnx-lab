import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
import type { MnxStructure } from '../model/mnx.ts';
import {
  GUITAR_PRO_IMPORT_COMMAND,
  GUITAR_PRO_IMPORT_RESULT,
  type GuitarProWorkerReply,
  type GuitarProWorkerRequest
} from './guitarProImporterProtocol.ts';

globalThis.onmessage = (event: MessageEvent<GuitarProWorkerRequest>) => {
  const request = event.data;
  if (request?.cmd !== GUITAR_PRO_IMPORT_COMMAND || !(request.buffer instanceof ArrayBuffer)) {
    return;
  }
  const warnings: string[] = [];
  let reply: GuitarProWorkerReply;
  try {
    const document = importGuitarProCleanRoom(new Uint8Array(request.buffer), {
      onWarning: warning => warnings.push(warning)
    });
    reply = {
      cmd: GUITAR_PRO_IMPORT_RESULT,
      ok: true,
      // The converter keeps its Node package types independent of src/model;
      // the shape is checked again by localFile before it reaches the editor.
      document: document as unknown as MnxStructure,
      warnings
    };
  } catch (error) {
    reply = {
      cmd: GUITAR_PRO_IMPORT_RESULT,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
  globalThis.postMessage(reply);
};
