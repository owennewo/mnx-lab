import { MnxStructure } from './common/types.js';
import { importMusicXML, ImportOptions } from './import/musicxml.js';
import { exportMusicXML, ExportOptions } from './export/mnx.js';
import { readMxl, writeMxl, isZip } from './common/mxl.js';

export { importMusicXML, ImportOptions, exportMusicXML, ExportOptions };

/**
 * Reads a `.mxl` (compressed MusicXML), or a plain one handed over as bytes.
 *
 * Async because decompression is: `DecompressionStream` is the only inflater
 * both Node and browsers have, and it is a stream. The asynchrony stops here —
 * `importMusicXML` itself stays synchronous.
 */
export async function importMxl(
  data: Uint8Array,
  options: ImportOptions = {}
): Promise<MnxStructure> {
  const xml = isZip(data) ? await readMxl(data) : new TextDecoder().decode(data);
  return importMusicXML(xml, options);
}

/** Writes a `.mxl`, container manifest and all. */
export function exportMxl(
  mnx: MnxStructure,
  options: ExportOptions & { scoreName?: string } = {}
): Uint8Array {
  return writeMxl(exportMusicXML(mnx, options), options.scoreName);
}

export { readMxl, writeMxl, isZip };
export * from './common/types.js';
// MNX file-naming helpers, shared so future converters agree on `.mnx.json`.
export * from './common/mnxFile.js';
