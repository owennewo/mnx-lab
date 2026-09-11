// The importers layer: bytes in any format the lab reads → an in-memory MNX
// document, converted off the main thread in a per-format clean-room worker.
// Promoted out of the workbench (roadmap: studio-storage-source-canonical) so
// that studio can open a library piece the way the workbench opens a local
// file: the mnx-lab service stores the source, and the reader converts.
import type { MnxStructure } from '../model/mnx.ts';
import { upgradeTabExtension } from '../model/upgradeTabExtension.ts';
import {
  FILE_IMPORT_COMMAND,
  FILE_IMPORT_RESULT,
  type FileImportReply,
  type FileImportRequest
} from './fileImporterProtocol.ts';

export const LOCAL_FILE_ACCEPT =
  '.mnx.json,.mnx,.json,.musicxml,.mxl,.xml,.gp,.gpx,.gp3,.gp4,.gp5';

const MNX_EXTENSIONS = ['.mnx.json', '.mnx', '.json'] as const;
const MUSICXML_EXTENSIONS = ['.musicxml', '.mxl', '.xml'] as const;
const GUITAR_PRO_EXTENSIONS = ['.gp', '.gpx', '.gp5', '.gp4', '.gp3'] as const;

export interface LocalDocumentSource {
  /** Unique only for this application lifetime; local files are never persisted. */
  id: string;
  fileName: string;
  /** Filename fallback. The piece's own title lives in the document, under
   *  `_x.mnxLab.work` — read it with `documentTitle()`. */
  name: string;
  format: 'MNX' | 'MusicXML' | 'Guitar Pro';
  document: MnxStructure;
  warnings: string[];
}

function extensionIn(name: string, extensions: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return extensions.some(extension => lower.endsWith(extension));
}

function withoutKnownExtension(name: string): string {
  const lower = name.toLowerCase();
  for (const extension of [...MNX_EXTENSIONS, ...MUSICXML_EXTENSIONS, ...GUITAR_PRO_EXTENSIONS]) {
    if (lower.endsWith(extension)) return name.slice(0, -extension.length);
  }
  return name;
}

function assertDocumentShape(value: unknown): asserts value is MnxStructure {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The file does not contain an MNX document object.');
  }
  const document = value as Record<string, unknown>;
  if (!document.mnx || !document.global || !Array.isArray(document.parts)) {
    throw new Error('The JSON is not an MNX document: expected mnx, global, and parts.');
  }
}

// `new Worker(new URL(…, import.meta.url))` has to be written out literally for
// Vite to find and bundle the worker, so each format keeps its own spawn line.
const IMPORTERS = {
  MusicXML: () =>
    new Worker(new URL('./musicXmlImporter.worker.ts', import.meta.url), { type: 'module' }),
  'Guitar Pro': () =>
    new Worker(new URL('./guitarProImporter.worker.ts', import.meta.url), { type: 'module' })
} satisfies Record<string, () => Worker>;

/** Convert a file off the main thread, in its format's clean-room import worker. */
function importInWorker(
  format: keyof typeof IMPORTERS,
  buffer: ArrayBuffer
): Promise<{
  document: MnxStructure;
  warnings: string[];
}> {
  return new Promise((resolve, reject) => {
    const worker = IMPORTERS[format]();
    worker.onmessage = (event: MessageEvent<FileImportReply>) => {
      const reply = event.data;
      if (reply?.cmd !== FILE_IMPORT_RESULT) return;
      worker.terminate();
      if (!reply.ok || !reply.document) {
        reject(new Error(reply.error || `${format} conversion failed.`));
        return;
      }
      resolve({ document: reply.document, warnings: reply.warnings ?? [] });
    };
    worker.onerror = event => {
      worker.terminate();
      reject(new Error(event.message || `The ${format} converter could not start.`));
    };
    const request: FileImportRequest = {
      cmd: FILE_IMPORT_COMMAND,
      buffer
    };
    worker.postMessage(request, [buffer]);
  });
}

/** Read one file — user-selected, or fetched from the library — into an in-memory document. */
export async function openLocalFile(file: File): Promise<LocalDocumentSource> {
  let document: MnxStructure;
  let warnings: string[] = [];
  let format: LocalDocumentSource['format'];

  if (extensionIn(file.name, MNX_EXTENSIONS)) {
    format = 'MNX';
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not parse ${file.name} as JSON: ${detail}`);
    }
    assertDocumentShape(parsed);
    document = parsed;
  } else if (extensionIn(file.name, MUSICXML_EXTENSIONS)) {
    format = 'MusicXML';
    ({ document, warnings } = await importInWorker(format, await file.arrayBuffer()));
    assertDocumentShape(document);
  } else if (extensionIn(file.name, GUITAR_PRO_EXTENSIONS)) {
    format = 'Guitar Pro';
    ({ document, warnings } = await importInWorker(format, await file.arrayBuffer()));
    assertDocumentShape(document);
  } else {
    throw new Error(
      `Unsupported file type for ${file.name}. Open MNX JSON, MusicXML (MUSICXML, MXL, XML), ` +
        'or a GP, GPX, GP3, GP4, or GP5 file.'
    );
  }

  return {
    id: `local:${crypto.randomUUID()}`,
    fileName: file.name,
    name: withoutKnownExtension(file.name) || file.name,
    format,
    document: upgradeTabExtension(document),
    warnings
  };
}
