import type { MnxStructure } from '../model/mnx.ts';
import { upgradeTabExtension } from '../model/upgradeTabExtension.ts';
import {
  GUITAR_PRO_IMPORT_COMMAND,
  GUITAR_PRO_IMPORT_RESULT,
  type GuitarProWorkerReply,
  type GuitarProWorkerRequest
} from './guitarProImporterProtocol.ts';

export const LOCAL_FILE_ACCEPT = '.mnx.json,.mnx,.json,.gp,.gpx,.gp3,.gp4,.gp5';

const MNX_EXTENSIONS = ['.mnx.json', '.mnx', '.json'] as const;
const GUITAR_PRO_EXTENSIONS = ['.gp', '.gpx', '.gp5', '.gp4', '.gp3'] as const;

export interface LocalDocumentSource {
  /** Unique only for this application lifetime; local files are never persisted. */
  id: string;
  fileName: string;
  name: string;
  format: 'MNX' | 'Guitar Pro';
  document: MnxStructure;
  warnings: string[];
}

function extensionIn(name: string, extensions: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return extensions.some(extension => lower.endsWith(extension));
}

function withoutKnownExtension(name: string): string {
  const lower = name.toLowerCase();
  for (const extension of [...MNX_EXTENSIONS, ...GUITAR_PRO_EXTENSIONS]) {
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

function importGuitarPro(buffer: ArrayBuffer): Promise<{ document: MnxStructure; warnings: string[] }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./guitarProImporter.worker.ts', import.meta.url), {
      type: 'module'
    });
    worker.onmessage = (event: MessageEvent<GuitarProWorkerReply>) => {
      const reply = event.data;
      if (reply?.cmd !== GUITAR_PRO_IMPORT_RESULT) return;
      worker.terminate();
      if (!reply.ok || !reply.document) {
        reject(new Error(reply.error || 'Guitar Pro conversion failed.'));
        return;
      }
      resolve({ document: reply.document, warnings: reply.warnings ?? [] });
    };
    worker.onerror = event => {
      worker.terminate();
      reject(new Error(event.message || 'The Guitar Pro converter could not start.'));
    };
    const request: GuitarProWorkerRequest = {
      cmd: GUITAR_PRO_IMPORT_COMMAND,
      buffer
    };
    worker.postMessage(request, [buffer]);
  });
}

/** Read one user-selected file into an in-memory workbench document. */
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
  } else if (extensionIn(file.name, GUITAR_PRO_EXTENSIONS)) {
    format = 'Guitar Pro';
    ({ document, warnings } = await importGuitarPro(await file.arrayBuffer()));
    assertDocumentShape(document);
  } else {
    throw new Error(
      `Unsupported file type for ${file.name}. Open MNX JSON or a GP, GPX, GP3, GP4, or GP5 file.`
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
