import * as fs from 'fs';

/**
 * MNX file naming — mirrors `converters/musicxml-mnx/src/common/mnxFile.ts`.
 * MNX is written as `.mnx.json`; `.json` and `.mnx` are read but never written.
 */
export const MNX_EXTENSION = '.mnx.json';
export const MNX_READ_EXTENSIONS = ['.mnx.json', '.json', '.mnx'] as const;

/**
 * Guitar Pro extensions. `.gp` (GP7+) is the only one anything can WRITE —
 * alphaTab has no gp3/gp4/gp5 exporter and neither does any maintained tool —
 * but all of them can be read.
 */
export const GP_WRITE_EXTENSION = '.gp';
export const GP_READ_EXTENSIONS = ['.gp', '.gpx', '.gp5', '.gp4', '.gp3'] as const;

export function isGuitarProPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return GP_READ_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export function stripKnownExtension(filePath: string): string {
  const lower = filePath.toLowerCase();
  for (const ext of [...MNX_READ_EXTENSIONS, ...GP_READ_EXTENSIONS]) {
    if (lower.endsWith(ext)) return filePath.slice(0, -ext.length);
  }
  return filePath;
}

/** Resolves a path that may be missing its extension, preferring `.mnx.json`. */
export function resolveInputPath(
  filePath: string,
  extensions: readonly string[]
): string {
  if (fs.existsSync(filePath)) return filePath;
  for (const ext of extensions) {
    if (fs.existsSync(filePath + ext)) return filePath + ext;
  }
  return filePath;
}

export function defaultMnxOutputPath(inputPath: string): string {
  return stripKnownExtension(inputPath) + MNX_EXTENSION;
}

export function defaultGuitarProOutputPath(inputPath: string): string {
  return stripKnownExtension(inputPath) + GP_WRITE_EXTENSION;
}
