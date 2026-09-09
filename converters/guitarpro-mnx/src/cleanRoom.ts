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
 *
 * The score header travels IN the document, as `_x.mnxLab.work` — an earlier
 * `importGuitarProWithMetadata` handed title and artist back beside it for the
 * host to hold, which meant every save dropped them.
 */
export function importGuitarProCleanRoom(
  data: Uint8Array,
  options: GpifImportOptions = {}
): MnxStructure {
  const parsed = sniffContainer(data) === 'gp345-binary'
    ? parseGuitarProBinary(data, options)
    : parseGpif(extractScoreGpif(data));
  return gpifToMnx(parsed, options);
}
