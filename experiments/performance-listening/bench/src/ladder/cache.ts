import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode } from '../io.ts';
import { sha } from './privateSets.ts';

/** Results of frozen candidates on frozen rungs are reused instead of recomputed. A result
 * is reusable only under the same candidate, the same bytes of every source file its code
 * reaches (and of the runner and evaluator), and the same frozen rung set. Every reuse is
 * spot-checked by recomputing one example per candidate per rung. */
const BENCH_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(BENCH_SRC, '../../../..');
/** The code that turns a candidate's decisions into a result, whatever the candidate. */
export const EVALUATION_PATH = ['run/runner.ts', 'evaluate/index.ts', 'ladder/goldens.ts', 'validate.ts', 'types.ts'];

/** Every .ts file reachable by static or dynamic relative imports from the roots. */
export function closure(roots: string[]): string[] {
  const seen = new Set<string>(), queue = roots.map(r => resolve(BENCH_SRC, r));
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(?:from|import\()\s*'(\.{1,2}\/[^']+\.ts)'/g)) queue.push(resolve(dirname(file), m[1]!));
  }
  return [...seen].sort();
}

export function fingerprint(candidateModule: string): { hash: string; files: Record<string, string> } {
  const files = Object.fromEntries(closure([candidateModule, ...EVALUATION_PATH]).map(f => [relative(REPO, f), sha(readFileSync(f))]));
  return { hash: sha(JSON.stringify(files)), files };
}

export interface CachedExample<T> { result: T; record: unknown; evaluation: unknown; sourceRun: string }
const safe = (s: string) => s.replace(/[^a-z0-9@.-]+/gi, '_');
export function cachePath(root: string, candidate: string, fingerprintHash: string, rungSha: string, example: string): string {
  return join(root, 'cache', 'examples', safe(candidate), fingerprintHash.slice(0, 16), rungSha.slice(0, 16), `${safe(example)}.json`);
}
export function readCached<T>(path: string): CachedExample<T> | null {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as CachedExample<T> : null;
}
export function writeCached<T>(path: string, entry: CachedExample<T>): void {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) writeFileSync(path, encode(entry));
}

/** What must reproduce exactly. Processing cost is measured on each run and is not. */
export function comparable(result: { gates: object; cost?: unknown }): string {
  const { cost: _cost, gates, ...rest } = result;
  const { sustainedRatio: _s, chunkP99Ms: _p, pass, failed, ...logical } = gates as { sustainedRatio: unknown; chunkP99Ms: unknown; pass: Record<string, boolean>; failed: string[] };
  const { sustained: _a, chunkP99: _b, ...logicalPass } = pass;
  return JSON.stringify({ ...rest, gates: { ...logical, pass: logicalPass, failed: failed.filter(f => f !== 'sustained' && f !== 'chunkP99') } });
}
