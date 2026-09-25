import { isDeepStrictEqual as semanticEqual } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { EXPERIMENT, encode, json, readSet, sha256 } from '../io.ts';
import { validateGolden } from '../validate.ts';
import { synthesize } from './sine.ts';
export function setHashes(id: string, root = EXPERIMENT): Record<string, string> {
  const set = readSet(id, root);
  const paths = ['set.json', ...set.examples.flatMap(e => [`${e.golden.example}/score.mnx.json`, `${e.golden.example}/golden.json`])];
  return { ...Object.fromEntries(paths.map(p => [p, sha256(readFileSync(join(set.path, p)))])), 'generator-manifest': sha256(readFileSync(join(root, 'generators', 'sine-v1.json'))) };
}
export function verifySetLock(id: string, root = EXPERIMENT): void {
  const set = readSet(id, root);
  if (!set.manifest.frozen) throw new Error('Set is not frozen');
  const lock = json<{ version: 1; hashes: Record<string, string> }>(join(set.path, 'set.lock.json'));
  if (lock.version !== 1 || JSON.stringify(lock.hashes) !== JSON.stringify(setHashes(id, root))) throw new Error('Frozen set content changed; create a new version');
}
export function generateSet(id: string, root = EXPERIMENT): Record<string, string> {
  const set = readSet(id, root);
  if (set.manifest.frozen) verifySetLock(id, root);
  else if (existsSync(join(set.path, 'set.lock.json'))) throw new Error('A locked set cannot be thawed');
  const artifacts = set.examples.map(({ folder, golden }) => {
    validateGolden(golden);
    const generated = synthesize(json<MnxStructure>(join(folder, golden.intended.score)), golden.audio.recipe);
    if (!semanticEqual({ duration: generated.duration, labels: { notes: generated.notes, following: generated.following } }, { duration: golden.audio.duration, labels: golden.labels })) throw new Error(`${golden.example}: generated labels disagree with the independent draft; trace the defect before changing evidence`);
    const hash = sha256(generated.wav);
    if (golden.audio.sha256 !== null && golden.audio.sha256 !== hash) throw new Error(`${golden.example}: audio hash differs; create a new set version`);
    return { folder, golden, generated, hash };
  });
  // All examples are validated before any output changes.
  for (const { folder, golden, generated, hash } of artifacts) {
    writeFileSync(join(folder, golden.audio.path), generated.wav);
    if (golden.audio.sha256 === null) {
      golden.audio.sha256 = hash;
      golden.labels = { notes: generated.notes, following: generated.following };
      writeFileSync(join(folder, 'golden.json'), encode(golden));
    }
  }
  return Object.fromEntries(artifacts.map(g => [g.golden.example, g.hash]));
}
export function freezeSet(id: string, root = EXPERIMENT): void {
  const set = readSet(id, root);
  if (set.manifest.frozen) { verifySetLock(id, root); generateSet(id, root); return; }
  generateSet(id, root);
  writeFileSync(join(set.path, 'set.json'), encode({ ...set.manifest, frozen: true }));
  writeFileSync(join(set.path, 'set.lock.json'), encode({ version: 1, hashes: setHashes(id, root) }));
}
