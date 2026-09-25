import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Golden } from './types.ts';
export const EXPERIMENT = fileURLToPath(new URL('../../', import.meta.url));
export const json = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
export const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
export const encode = (data: unknown): string => JSON.stringify(data, null, 2) + '\n';
export interface SetManifest { id: string; version: number; frozen: boolean; examples: string[]; generator: string; randomness: null }
export function setPath(id: string, root = EXPERIMENT): string {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid set id');
  return join(root, 'sets', id);
}
export function readSet(id: string, root = EXPERIMENT) {
  const path = setPath(id, root); const manifest = json<SetManifest>(join(path, 'set.json'));
  if (manifest.id !== id || manifest.version !== 1 || manifest.randomness !== null || new Set(manifest.examples).size !== manifest.examples.length) throw new Error('Invalid set manifest');
  return { path, manifest, examples: manifest.examples.map(example => {
    if (!/^[a-z0-9-]+$/.test(example)) throw new Error('Invalid example id');
    const folder = join(path, example); const golden = json<Golden>(join(folder, 'golden.json'));
    if (golden.set !== id || golden.example !== example || golden.intended.score !== 'score.mnx.json' || golden.audio.path !== 'audio.wav' || golden.partition !== 'development') throw new Error('Unexpected golden identity, path or partition');
    return { folder, golden };
  }) };
}
