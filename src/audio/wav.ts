/**
 * What a recording needs to seek exactly (the owner, 2026-11-09: "if I start from bar 13 the audio
 * plays about 2 beats off the visuals"). A browser asked to jump into a variable-bitrate MP3 cannot
 * know where that second begins in the file: it estimates from the Xing header's coarse table and
 * lands as much as ±0.7 s away — while reporting the time it was asked for. Measured on Strolling
 * Down the Highway's recording in Chrome: +0.67 s at bar 13, −0.33 s at bar 12, 0 when played
 * straight through. PCM has no such guess: sample n is at byte 44 + n·frame. So an MP3 is decoded
 * once and played as WAV (`native/htmlAudio.ts`); the element, and its pitch-kept slow playback,
 * stay as they were.
 *
 * DOM-free: the decode is the browser's; this recognises the file and writes the WAV.
 */

/** An MP3 by its bytes: an ID3v2 tag, or an MPEG audio layer III frame header, at the start. */
export function isMp3(bytes: Uint8Array): boolean {
  let at = 0;
  if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    // ID3v2: a synchsafe size, then the audio.
    at = 10 + (((bytes[6]! & 0x7f) << 21) | ((bytes[7]! & 0x7f) << 14) | ((bytes[8]! & 0x7f) << 7) | (bytes[9]! & 0x7f));
    if (bytes[5]! & 0x10) at += 10; // a footer
    // Some encoders pad after the tag: find the first frame sync within a little way.
    for (const end = Math.min(bytes.length - 1, at + 4096); at < end; at++) if (bytes[at] === 0xff && (bytes[at + 1]! & 0xe0) === 0xe0) break;
  }
  if (at + 1 >= bytes.length || bytes[at] !== 0xff || (bytes[at + 1]! & 0xe0) !== 0xe0) return false;
  // Layer III is `01` in bits 2–1 of the second byte (MPEG-1, 2 and 2.5 alike).
  return ((bytes[at + 1]! >> 1) & 0x03) === 0x01;
}

/** Decoded channels → a 16-bit PCM WAV file (at most two channels; all the same length). */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array<ArrayBuffer> {
  const count = Math.min(2, channels.length);
  if (count === 0 || !(sampleRate > 0)) throw new RangeError('A WAV needs a channel and a sample rate.');
  const frames = channels[0]!.length;
  const bytes = new Uint8Array(44 + frames * count * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); };
  text(0, 'RIFF'); view.setUint32(4, 36 + frames * count * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * count * 2, true);
  view.setUint16(32, count * 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, frames * count * 2, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < count; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c]![i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return bytes;
}
