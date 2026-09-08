import { MnxStructure } from './common/types.js';
import { parseGuitarProBinary } from './gp345/gp5.js';
import { gpifToMnx, GpifImportOptions } from './gpif/toMnx.js';
import { extractScoreGpif, sniffContainer } from './gpif/container.js';
import { parseGpif } from './gpif/document.js';

/**
 * Format-dispatching clean-room import path.
 *
 * GP6–8 and the fixture-proven GP3–5 subset are implemented.
 * This also backs the production `importGuitarPro` API and workbench worker.
 */
export function importGuitarProCleanRoom(
  data: Uint8Array,
  options: GpifImportOptions = {}
): MnxStructure {
  return importGuitarProWithMetadata(data, options).document;
}

/** One parse for both notation and the host's document heading. */
export function importGuitarProWithMetadata(data: Uint8Array, options: GpifImportOptions = {}): {
  document: MnxStructure; title: string; artist: string;
} {
  const parsed = sniffContainer(data) === 'gp345-binary'
    ? parseGuitarProBinary(data, options)
    : parseGpif(extractScoreGpif(data));
  return {
    document: gpifToMnx(parsed, options),
    title: parsed.metadata?.title.trim() ?? '',
    artist: parsed.metadata?.artist.trim() ?? ''
  };
}
