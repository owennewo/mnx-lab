// Renders a document's synth playback offline to a 16-bit stereo WAV, as studio would play it
// with the default mix (no recording, no click): for listening to a synth change on a real piece.
// Run: npx tsx harness/tools/render-piece.ts <piece.mnx.json> <out.wav> [from seconds] [to seconds]
import fs from 'node:fs';
import { render } from '@mnx-lab/synth/node';
import { compilePerformance } from '../../src/audio/performance.ts';
import { hostSetup } from '../../src/audio/hostSetup.ts';
import { performanceToStream } from '../../src/audio/contractStream.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const [file, out, fromArg, toArg] = process.argv.slice(2);
if (!file || !out) throw new Error('usage: render-piece.ts <piece.mnx.json> <out.wav> [from seconds] [to seconds]');
const RATE = 48000, TAIL = 2;
const document = JSON.parse(fs.readFileSync(file, 'utf8')) as MnxStructure, compiled = compilePerformance(document);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
const routed = hostSetup(compiled.performance, document);
const stream = performanceToStream(compiled.performance, { partOf: routed.partOf, document });
const from = Number(fromArg ?? 0), to = Math.min(Number(toArg ?? Infinity), stream.seconds);
const r = render({ setup: routed.setup, notes: stream.notes, controls: stream.controls, rate: RATE, seconds: to + TAIL });
for (const d of r.diagnostics) if (d.severity !== 'info') console.warn(d.code, d.message ?? '');
const [L, R] = r.audio, first = Math.floor(from * RATE), frames = L.length - first;
const wav = Buffer.alloc(44 + frames * 4);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + frames * 4, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(RATE, 24);
wav.writeUInt32LE(RATE * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(frames * 4, 40);
const pcm = (x: number) => Math.round(Math.max(-1, Math.min(1, x)) * 32767);
for (let i = 0; i < frames; i++) { wav.writeInt16LE(pcm(L[first + i]!), 44 + 4 * i); wav.writeInt16LE(pcm(R[first + i]!), 46 + 4 * i); }
fs.writeFileSync(out, wav);
console.log(`${out}: ${(frames / RATE).toFixed(1)} s from ${from} s; design ${routed.parts.map(p => p.design ?? p.source).join(', ')}`);
