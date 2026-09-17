import type { MnxStructure } from '../model/mnx.ts';

export type ExportFormat = 'mnx' | 'gp7' | 'musicxml';

/**
 * The `.gp` Studio STORES — not the one it hands a person. Same writer, the
 * converter's storage options: the defaults tidy a score for a reader, and a
 * tidied file does not read back as the document that was saved
 * (harness/fixtures/roundtrip-register.json). `options` is what ran, for the
 * rendition's provenance.
 */
export async function exportForStorage(document: MnxStructure): Promise<{ bytes: Uint8Array; options: Record<string, unknown>; warnings: string[] }> {
  const { exportGuitarProGpif, STORAGE_EXPORT_OPTIONS } = await import('../../converters/guitarpro-mnx/src/gpif/fromMnx.ts');
  const warnings: string[] = [];
  const bytes = exportGuitarProGpif(document as unknown as Parameters<typeof exportGuitarProGpif>[0], { ...STORAGE_EXPORT_OPTIONS, onWarning: message => warnings.push(message) });
  return { bytes, options: { ...STORAGE_EXPORT_OPTIONS }, warnings };
}

/** Browser-safe writers; load a converter only when its format is requested. */
export async function exportDocument(document: MnxStructure, format: ExportFormat): Promise<{
  blob: Blob; extension: string; warnings: string[];
}> {
  const warnings: string[] = [];
  const onWarning = (message: string) => warnings.push(message);
  switch (format) {
    case 'mnx': {
      const copy = structuredClone(document);
      copy._x = { ...copy._x, mnxLab: { ...copy._x?.mnxLab, encoding: { software: 'MNX Studio' } } };
      return { blob: new Blob([JSON.stringify(copy, null, 2) + '\n'], { type: 'application/json' }), extension: '.mnx.json', warnings };
    }
    case 'gp7': {
      const { exportGuitarProGpif } = await import('../../converters/guitarpro-mnx/src/gpif/fromMnx.ts');
      const bytes = exportGuitarProGpif(document as unknown as Parameters<typeof exportGuitarProGpif>[0], { onWarning });
      return { blob: new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }), extension: '.gp', warnings };
    }
    case 'musicxml': {
      const { exportMusicXML } = await import('../../converters/musicxml-mnx/src/export/mnx.ts');
      return { blob: new Blob([exportMusicXML(document as unknown as Parameters<typeof exportMusicXML>[0], { onWarning })], { type: 'application/vnd.recordare.musicxml+xml' }), extension: '.musicxml', warnings };
    }
    default: throw new Error('Unsupported export format.');
  }
}
