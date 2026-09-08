import { expect, it } from 'vitest';
import { crc32 as nodeCrc32 } from 'node:zlib';
import { zipSync } from 'fflate';
import { crc32, extractScoreGpif, writeGpContainer } from '../src/gpif/container.js';

it('portable CRC-32 matches the standard vector and Node on binary bytes', () => {
  expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  expect(crc32(new Uint8Array())).toBe(0);
  const bytes = Uint8Array.from({ length: 4096 }, (_, index) => index % 256);
  expect(crc32(bytes)).toBe(nodeCrc32(bytes));
});

it('extracts the same XML from stored and deflated ZIP containers', () => {
  const xml = '<GPIF><Score><Title>Portable café</Title></Score></GPIF>';
  const zip = zipSync({ 'Content/score.gpif': new TextEncoder().encode(xml) }, { level: 6 });
  expect(extractScoreGpif(zip)).toBe(xml);
  expect(extractScoreGpif(writeGpContainer(xml))).toBe(xml);
});
