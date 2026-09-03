import { GpBinaryReader } from './binary.js';

export type GpBinaryMajorVersion = 3 | 4 | 5;
export type GpBinaryRevision = 0 | 6 | 10;

export interface GpBinaryVersion {
  major: GpBinaryMajorVersion;
  /** Decimal suffix as written: 00 → 0, 06 → 6, 10 → 10. */
  revision: GpBinaryRevision;
  raw: string;
  /** The historical L4.06 header is a normal GP4 file variant. */
  variant: 'file' | 'l4';
}

const SUPPORTED = new Map<string, Omit<GpBinaryVersion, 'raw'>>([
  ['FICHIER GUITAR PRO v3.00', { major: 3, revision: 0, variant: 'file' }],
  ['FICHIER GUITAR PRO v4.00', { major: 4, revision: 0, variant: 'file' }],
  ['FICHIER GUITAR PRO v4.06', { major: 4, revision: 6, variant: 'file' }],
  ['FICHIER GUITAR PRO L4.06', { major: 4, revision: 6, variant: 'l4' }],
  ['FICHIER GUITAR PRO v5.00', { major: 5, revision: 0, variant: 'file' }],
  ['FICHIER GUITAR PRO v5.10', { major: 5, revision: 10, variant: 'file' }]
]);

/** Reads and validates the fixed 31-byte legacy Guitar Pro version header. */
export function readGpBinaryVersion(reader: GpBinaryReader): GpBinaryVersion {
  const raw = reader.readByteSizeString('version', 30);
  const version = SUPPORTED.get(raw);
  if (!version) {
    throw new Error(
      `unsupported Guitar Pro binary version ${JSON.stringify(raw || '(empty)')}; ` +
        'expected GP3.00, GP4.00/4.06, or GP5.00/5.10'
    );
  }
  return { ...version, raw };
}

/** Convenience entry point for dispatch before parsing the score body. */
export function sniffGpBinaryVersion(data: Uint8Array): GpBinaryVersion {
  return readGpBinaryVersion(new GpBinaryReader(data));
}
