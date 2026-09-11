import type { MnxStructure } from '../model/mnx.ts';

/** Message envelope shared by the host and the clean-room import workers. There is
 *  one worker per file format, so each converter is its own lazy chunk: opening a
 *  Guitar Pro file never downloads the MusicXML reader, nor the reverse. */
export const FILE_IMPORT_COMMAND = 'mnxLab.importFile';
export const FILE_IMPORT_RESULT = 'mnxLab.importFile.result';

export interface FileImportRequest {
  cmd: typeof FILE_IMPORT_COMMAND;
  buffer: ArrayBuffer;
}

export interface FileImportReply {
  cmd: typeof FILE_IMPORT_RESULT;
  ok: boolean;
  /** Metadata travels IN the document, as `_x.mnxLab.work` — it used to ride
   *  beside it as title/artist, which meant the host held facts the document
   *  did not, and every save dropped them. */
  document?: MnxStructure;
  warnings?: string[];
  error?: string;
}
