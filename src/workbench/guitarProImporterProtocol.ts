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
  document?: MnxStructure;
  title?: string;
  artist?: string;
  warnings?: string[];
  error?: string;
}
