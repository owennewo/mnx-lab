import path from "node:path";
import { readJSON, readWav } from "./io.mjs";
export function compareRenders(left, right) {
  const a = readJSON(path.join(left, "manifest.json")),
    b = readJSON(path.join(right, "manifest.json"));
  if (a.records.length !== b.records.length)
    throw Error("Different fixture counts");
  let changedSamples = 0,
    sumSquares = 0,
    maxAbs = 0,
    comparedSamples = 0;
  const differences = [];
  for (let i = 0; i < a.records.length; i++) {
    const x = a.records[i],
      y = b.records[i];
    if (x.file !== y.file || x.fixtureHash !== y.fixtureHash)
      throw Error("Different fixture identity");
    const p = readWav(path.join(left, x.file)),
      q = readWav(path.join(right, y.file));
    if (p.hash !== x.audioHash || q.hash !== y.audioHash)
      throw Error("Recording does not match its manifest");
    if (p.samples.length !== q.samples.length || p.sampleRate !== q.sampleRate)
      throw Error("Incompatible audio shape");
    if (p.hash === q.hash) continue;
    let localMax = 0,
      localChanged = 0;
    for (let j = 0; j < p.samples.length; j++) {
      const d = Math.abs(p.samples[j] - q.samples[j]);
      if (d) {
        localChanged++;
        changedSamples++;
      }
      sumSquares += d * d;
      localMax = Math.max(localMax, d);
      comparedSamples++;
    }
    maxAbs = Math.max(maxAbs, localMax);
    differences.push({
      file: x.file,
      leftHash: p.hash,
      rightHash: q.hash,
      changedSamples: localChanged,
      maxAbs: localMax,
    });
  }
  return {
    version: 1,
    leftBrowser: a.browser,
    rightBrowser: b.browser,
    totalRecordings: a.records.length,
    differentRecordings: differences.length,
    changedRendererSources: [
      ...new Set([
        ...Object.keys(a.rendererSourceHashes),
        ...Object.keys(b.rendererSourceHashes),
      ]),
    ].filter((k) => a.rendererSourceHashes[k] !== b.rendererSourceHashes[k]),
    changedSamples,
    maxAbs,
    rmsOverDifferingRecordings: comparedSamples
      ? Math.sqrt(sumSquares / comparedSamples)
      : 0,
    differences,
  };
}
