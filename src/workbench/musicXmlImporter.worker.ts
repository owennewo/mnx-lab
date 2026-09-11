// Deliberately not the package's `importMxl`: its index also re-exports the
// Node-only `.mnx.json` file helpers (`fs`, `path`), which have no business in a
// browser chunk. The two modules below are the platform-independent core.
import { isZip, readMxl } from '../../converters/musicxml-mnx/src/common/mxl.ts';
import { importMusicXML } from '../../converters/musicxml-mnx/src/import/musicxml.ts';
import type { MnxStructure } from '../model/mnx.ts';
import {
  FILE_IMPORT_COMMAND,
  FILE_IMPORT_RESULT,
  type FileImportReply,
  type FileImportRequest
} from './fileImporterProtocol.ts';

globalThis.onmessage = async (event: MessageEvent<FileImportRequest>) => {
  const request = event.data;
  if (request?.cmd !== FILE_IMPORT_COMMAND || !(request.buffer instanceof ArrayBuffer)) {
    return;
  }
  const warnings: string[] = [];
  let reply: FileImportReply;
  try {
    const data = new Uint8Array(request.buffer);
    // The bytes decide, not the name: `.mxl` is a zip, but the extension habit
    // is loose in the wild and a compressed `.musicxml` is not unheard of.
    const xml = isZip(data) ? await readMxl(data) : new TextDecoder().decode(data);
    const document = importMusicXML(xml, { onWarning: warning => warnings.push(warning) });
    reply = {
      cmd: FILE_IMPORT_RESULT,
      ok: true,
      // As for Guitar Pro: the converter's types are its own, and localFile
      // checks the shape again before the document reaches the editor.
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
