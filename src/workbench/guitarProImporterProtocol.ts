import type { MnxStructure } from '../model/mnx.ts';

/** Message envelope shared by the host and the clean-room import worker. */
export const GUITAR_PRO_IMPORT_COMMAND = 'mnxLab.importGuitarPro';
export const GUITAR_PRO_IMPORT_RESULT = 'mnxLab.importGuitarPro.result';

export interface GuitarProWorkerRequest {
  cmd: typeof GUITAR_PRO_IMPORT_COMMAND;
  buffer: ArrayBuffer;
}

export interface GuitarProWorkerReply {
  cmd: typeof GUITAR_PRO_IMPORT_RESULT;
  ok: boolean;
  /** Metadata travels IN the document, as `_x.mnxLab.work` — it used to ride
   *  beside it as title/artist, which meant the host held facts the document
   *  did not, and every save dropped them. */
  document?: MnxStructure;
  warnings?: string[];
  error?: string;
}
