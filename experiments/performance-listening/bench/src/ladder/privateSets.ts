import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const sha = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

/** Audio, scores and anything derived from them stay outside every git checkout. */
export function requireOutsideGit(path: string): string {
  const absolute = resolve(path);
  for (let at = absolute; ; at = dirname(at)) {
    if (existsSync(join(at, '.git'))) throw new Error(`Private evidence must stay outside git: ${absolute}`);
    if (dirname(at) === at) return absolute;
  }
}

export const PROXY_SET_SHA256 = '80c8a6358751f356e164f75389dd50d49a2a0da6ad094f95847bd304eb5c5b8b';

export interface ProxyExample { id: string; scorePath: string; audioPath: string; reference: import('../proxy/reference.ts').ProxyReference }
export interface ProxyManifest { id: string; nominalBpm: number; assets: Record<string, string>; examples: ProxyExample[] }

/** The frozen experiment 002 set, verified byte for byte before any use. */
export function readProxySet(dir: string): { manifest: ProxyManifest; sha256: string } {
  const bytes = readFileSync(join(requireOutsideGit(dir), 'manifest.json'));
  const frozen = JSON.parse(readFileSync(join(dir, 'freeze.json'), 'utf8')).sha256;
  if (sha(bytes) !== frozen || frozen !== PROXY_SET_SHA256) throw new Error('Expected the unchanged experiment 002 set');
  const manifest = JSON.parse(bytes.toString('utf8')) as ProxyManifest;
  for (const [path, hash] of Object.entries(manifest.assets)) if (sha(readFileSync(path)) !== hash) throw new Error(`Frozen asset changed: ${path}`);
  return { manifest, sha256: frozen };
}

export interface RungExample {
  /** Rung 0 names its three examples by kind; later rungs add a kind and a seed group. */
  id: string;
  kind?: 'positive' | 'wrong-score' | 'silence';
  group?: 'development' | 'held-out' | 'fixed';
  scorePath: string;
  audioPath: string;
  golden: import('./goldens.ts').LadderGolden;
}
export interface RungManifest {
  id: string; version: 1; rung: number; partition: 'development';
  seeds: { development: number[]; heldOut: number[]; note: string };
  sourceSet: { id: string; sha256: string };
  maxPolyphony: number;
  examples: RungExample[];
  assets: Record<string, string>;
}

/** A frozen rung set, verified byte for byte before any use. */
export function readRungSet(dir: string): { manifest: RungManifest; sha256: string } {
  const bytes = readFileSync(join(requireOutsideGit(dir), 'manifest.json'));
  if (sha(bytes) !== JSON.parse(readFileSync(join(dir, 'freeze.json'), 'utf8')).sha256) throw new Error('Rung set changed since freezing');
  const manifest = JSON.parse(bytes.toString('utf8')) as RungManifest;
  for (const [path, hash] of Object.entries(manifest.assets)) if (sha(readFileSync(path)) !== hash) throw new Error(`Rung asset changed: ${path}`);
  return { manifest, sha256: sha(bytes) };
}
