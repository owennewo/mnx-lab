import { GpBinaryReader } from './binary.js';
import { GpBinaryVersion, readGpBinaryVersion } from './version.js';

export interface GpBinaryScoreInfo {
  title: string;
  subtitle: string;
  artist: string;
  album: string;
  words: string;
  /** GP5 split music authorship from words; older files have no such field. */
  music: string;
  copyright: string;
  tab: string;
  instructions: string;
  notice: string[];
}

export interface GpBinaryPreamble {
  version: GpBinaryVersion;
  scoreInfo: GpBinaryScoreInfo;
  /** Offset of the next field, useful while the sequential body reader grows. */
  bodyOffset: number;
}

/**
 * Reads the common version + score-information prefix of a GP3/4/5 file.
 *
 * This deliberately stops at a stable record boundary. It is the first
 * fixture-backed slice of the reader, not a claim that the score body has
 * already been implemented.
 */
export function readGpBinaryPreamble(data: Uint8Array): GpBinaryPreamble {
  const reader = new GpBinaryReader(data);
  return readGpBinaryPreambleFromReader(reader);
}

/** Same prefix reader for callers which continue through the sequential body. */
export function readGpBinaryPreambleFromReader(reader: GpBinaryReader): GpBinaryPreamble {
  const version = readGpBinaryVersion(reader);
  const read = (field: string) => reader.readIntByteSizeString(field);

  const title = read('title');
  const subtitle = read('subtitle');
  const artist = read('artist');
  const album = read('album');
  const words = read('words');
  const music = version.major >= 5 ? read('music') : '';
  const copyright = read('copyright');
  const tab = read('tabbed by');
  const instructions = read('instructions');

  const noticeCount = reader.readInt32('notice line count');
  if (noticeCount < 0 || noticeCount > 10_000) {
    throw new Error(`invalid Guitar Pro notice line count ${noticeCount}`);
  }
  const notice = Array.from({ length: noticeCount }, (_, index) =>
    read(`notice line ${index + 1}`)
  );

  return {
    version,
    scoreInfo: {
      title,
      subtitle,
      artist,
      album,
      words,
      music,
      copyright,
      tab,
      instructions,
      notice
    },
    bodyOffset: reader.offset
  };
}
