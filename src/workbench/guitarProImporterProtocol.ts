import type { MnxStructure } from '../model/mnx.ts';

/**
 * alphaTab initializes its own rendering/synth listeners whenever it detects a
 * Worker. Those listeners assume every message has a string `cmd`, so our
 * codec protocol must share that envelope even though it does not use
 * alphaTab's renderer or synth.
 */
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
  warnings?: string[];
  error?: string;
}
