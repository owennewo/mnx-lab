import { MnxStructure } from './common/types.js';
import { importGuitarPro5 } from './gp345/gp5.js';
import { sniffGpBinaryVersion } from './gp345/version.js';
import { GpifImportOptions } from './gpif/toMnx.js';
import { importGuitarProGpif, sniffContainer } from './gpif/index.js';

/**
 * Format-dispatching clean-room import path.
 *
 * GP6–8 and the GP5 baseline are implemented. GP3/4 deliberately retain a
 * precise refusal until their phases land. The production `importGuitarPro`
 * remains AlphaTab-backed until legacy coverage is broad enough for the flip.
 */
export function importGuitarProCleanRoom(
  data: Uint8Array,
  options: GpifImportOptions = {}
): MnxStructure {
  if (sniffContainer(data) !== 'gp345-binary') {
    return importGuitarProGpif(data, options);
  }

  const version = sniffGpBinaryVersion(data);
  if (version.major === 5) return importGuitarPro5(data, options);
  throw new Error(
    `${version.raw} clean-room import is not implemented yet; ` +
      'GP5 is active, GP4 and GP3 are the next phases'
  );
}
