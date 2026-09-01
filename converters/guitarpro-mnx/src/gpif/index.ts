import { MnxStructure } from '../common/types.js';
import {
  extractScoreGpif,
  sniffContainer,
  decompressBcfz,
  writeGpContainer,
  GpContainerKind
} from './container.js';
import { parseGpif, GpifDocument } from './document.js';
import { gpifToMnx, GpifImportOptions } from './toMnx.js';
import { exportGuitarProGpif, mnxToGpifXml, GpifExportOptions } from './fromMnx.js';

export { extractScoreGpif, sniffContainer, decompressBcfz, writeGpContainer };
export type { GpContainerKind, GpifDocument, GpifImportOptions, GpifExportOptions };
export { parseGpif, gpifToMnx, exportGuitarProGpif, mnxToGpifXml };

/**
 * The clean-room GPIF import path: reads any `.gp` (GP7/8 zip) or `.gpx`
 * (GP6 BCFS/BCFZ) into MNX without alphaTab. The gp3–5 binary family is out
 * of scope here and throws with a precise reason.
 *
 * `tests/gpif-parity.test.ts` holds this path to output identical to the
 * alphaTab-backed `importGuitarPro` (modulo note-id naming) over every Guitar
 * Pro fixture.
 */
export function importGuitarProGpif(
  data: Uint8Array,
  options: GpifImportOptions = {}
): MnxStructure {
  return gpifToMnx(parseGpif(extractScoreGpif(data)), options);
}
