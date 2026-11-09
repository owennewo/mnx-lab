// A recording is played as WAV when it is an MP3, because a seek into a
// variable-bitrate MP3 lands up to ±0.7 s from where the element reports
// (measured in Chrome on Strolling Down the Highway's recording, 2026-11-09:
// +0.67 s starting at bar 13). These are the two pure halves: telling an MP3
// by its bytes, and writing the PCM the element can seek exactly.
import { describe, it, expect } from 'vitest';
import { encodeWav, isMp3 } from '../../src/audio/wav.ts';

const frame = [0xff, 0xfb, 0x90, 0x64]; // MPEG-1 layer III, 128 kbps, 44.1 kHz
const id3 = (size: number) => [0x49, 0x44, 0x33, 0x04, 0x00, 0x00, (size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f, ...new Array(size).fill(0)];

describe('isMp3', () => {
  it('knows an MP3 by its first frame, after an ID3 tag or without one', () => {
    expect(isMp3(new Uint8Array(frame))).toBe(true);
    expect(isMp3(new Uint8Array([...id3(300), ...frame]))).toBe(true);
    expect(isMp3(new Uint8Array([...id3(20), 0, 0, 0, ...frame]))).toBe(true); // padding after the tag
  });

  it('leaves WAV, Ogg, FLAC, AAC and a bare tag alone', () => {
    const ascii = (s: string) => [...s].map(c => c.charCodeAt(0));
    expect(isMp3(new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE')]))).toBe(false);
    expect(isMp3(new Uint8Array(ascii('OggS')))).toBe(false);
    expect(isMp3(new Uint8Array(ascii('fLaC')))).toBe(false);
    expect(isMp3(new Uint8Array([0xff, 0xf1, 0x50, 0x80]))).toBe(false); // AAC in ADTS: layer bits 00
    expect(isMp3(new Uint8Array(id3(50)))).toBe(false);
    expect(isMp3(new Uint8Array([]))).toBe(false);
  });
});

describe('encodeWav', () => {
  const header = (bytes: Uint8Array) => {
    const v = new DataView(bytes.buffer), text = (o: number, n: number) => String.fromCharCode(...bytes.slice(o, o + n));
    return { riff: text(0, 4), wave: text(8, 4), fmt: text(12, 4), data: text(36, 4), format: v.getUint16(20, true), channels: v.getUint16(22, true),
      rate: v.getUint32(24, true), byteRate: v.getUint32(28, true), align: v.getUint16(32, true), bits: v.getUint16(34, true), dataBytes: v.getUint32(40, true), riffSize: v.getUint32(4, true) };
  };

  it('writes a 16-bit PCM header a browser can seek by sample', () => {
    const wav = encodeWav([new Float32Array(1000), new Float32Array(1000)], 48_000);
    expect(header(wav)).toEqual({ riff: 'RIFF', wave: 'WAVE', fmt: 'fmt ', data: 'data', format: 1, channels: 2, rate: 48_000,
      byteRate: 192_000, align: 4, bits: 16, dataBytes: 4000, riffSize: 4036 });
    expect(wav.length).toBe(4044);
  });

  it('interleaves the channels, clamps, and keeps the samples', () => {
    const left = new Float32Array([0, 0.5, -0.5, 2]), right = new Float32Array([1, -1, 0.25, -2]);
    const wav = encodeWav([left, right], 44_100), v = new DataView(wav.buffer);
    const samples = Array.from({ length: 8 }, (_, i) => v.getInt16(44 + i * 2, true));
    expect(samples).toEqual([0, 32767, 16383, -32768, -16384, 8191, 32767, -32768]);
  });

  it('keeps at most two channels, and refuses nothing to write', () => {
    expect(header(encodeWav([new Float32Array(4), new Float32Array(4), new Float32Array(4)], 8_000)).channels).toBe(2);
    expect(() => encodeWav([], 48_000)).toThrow();
    expect(() => encodeWav([new Float32Array(4)], 0)).toThrow();
  });
});
