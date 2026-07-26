import * as fs from 'fs';
import * as path from 'path';

/**
 * MNX file naming.
 *
 * MNX documents are JSON, and the project writes them as `.mnx.json` — the
 * double extension keeps them recognisable as MNX while still being opened,
 * syntax-highlighted and schema-validated as JSON by every editor and tool.
 * The scenario corpus (`scenarios/**\/score.mnx.json`) already uses it.
 *
 * `.json` and `.mnx` are accepted on READ so third-party documents and older
 * files still load, but nothing in this repo should write them.
 */
export const MNX_EXTENSION = '.mnx.json';

/** Accepted MNX extensions, most-preferred first. */
export const MNX_READ_EXTENSIONS = ['.mnx.json', '.json', '.mnx'] as const;

/** True if `filePath` carries a recognised MNX extension. */
export function isMnxPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return MNX_READ_EXTENSIONS.some(ext => lower.endsWith(ext));
}

/**
 * Strips any recognised MNX (or MusicXML) extension, so a new one can be
 * appended without doubling up. `.mnx.json` is checked before `.json` so the
 * longer match wins.
 */
export function stripKnownExtension(filePath: string): string {
  const lower = filePath.toLowerCase();
  for (const ext of [...MNX_READ_EXTENSIONS, '.musicxml', '.xml']) {
    if (lower.endsWith(ext)) return filePath.slice(0, -ext.length);
  }
  return filePath;
}

/**
 * Resolves a user-supplied MNX path to a file that exists, tolerating a missing
 * or non-preferred extension: `score` finds `score.mnx.json`, then `score.json`,
 * then `score.mnx`. Returns the path unchanged when nothing matches, so the
 * caller reports the error against what the user actually typed.
 */
export function resolveMnxInputPath(filePath: string): string {
  if (fs.existsSync(filePath)) return filePath;
  for (const ext of MNX_READ_EXTENSIONS) {
    const candidate = filePath + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  return filePath;
}

/** Default output path for a document being converted TO MNX. */
export function defaultMnxOutputPath(inputPath: string): string {
  return stripKnownExtension(inputPath) + MNX_EXTENSION;
}

/** Default output path for a document being converted FROM MNX to MusicXML. */
export function defaultMusicXmlOutputPath(inputPath: string): string {
  return stripKnownExtension(inputPath) + '.xml';
}

/**
 * Warns when an MNX document is about to be written to a non-preferred
 * extension. Explicit user intent is honoured — this only nudges.
 */
export function checkMnxOutputExtension(outputPath: string): string | null {
  if (outputPath.toLowerCase().endsWith(MNX_EXTENSION)) return null;
  return (
    `writing MNX to "${path.basename(outputPath)}"; the preferred extension is ` +
    `"${MNX_EXTENSION}" (.json and .mnx are read but not written).`
  );
}
