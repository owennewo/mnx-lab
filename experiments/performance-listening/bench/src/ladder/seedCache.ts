// Seeds the result cache from an earlier scoreboard run:
//   tsx src/ladder/seedCache.ts <run-id> <ladder-dir>
// A candidate's results are seeded only if every bench file its fingerprint covers has
// the bytes that run pinned, and the score model is unchanged since that run's commit.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXPERIMENT } from '../io.ts';
import { cachePath, fingerprint, writeCached } from './cache.ts';
import { CANDIDATES } from './candidates.ts';

const [runId, ladderDir] = process.argv.slice(2);
if (!runId || !ladderDir) throw new Error('Usage: tsx src/ladder/seedCache.ts <run-id> <ladder-dir>');
type Example = { example: string } & Record<string, unknown>;
const summary = JSON.parse(readFileSync(join(EXPERIMENT, 'runs', runId, 'summary.json'), 'utf8')) as {
  gitCommit: string; sourceHashes: Record<string, string>;
  rungs: { rung: number; sha256: string; candidates: { candidate: string; examples: Example[] }[] }[];
};
const repo = join(EXPERIMENT, '../..');
try { execFileSync('git', ['diff', '--quiet', summary.gitCommit, 'HEAD', '--', 'src/audio', 'src/model'], { cwd: repo }); }
catch { throw new Error(`The score model changed since ${runId}; its results cannot be reused`); }
const records = JSON.parse(readFileSync(join(ladderDir, 'runs', runId, 'records.json'), 'utf8')) as Record<string, unknown>;
const evaluations = JSON.parse(readFileSync(join(ladderDir, 'runs', runId, 'evaluations.json'), 'utf8')) as Record<string, unknown>;
let seeded = 0; const skipped: string[] = [];
for (const c of CANDIDATES) {
  const print = fingerprint(c.module);
  const benchPrefix = 'experiments/performance-listening/';
  const changed = Object.entries(print.files).filter(([file, hash]) => file.startsWith(benchPrefix) && summary.sourceHashes[file.slice(benchPrefix.length)] !== hash);
  if (changed.length) { skipped.push(`${c.id}: ${changed.map(([f]) => f).join(', ')}`); continue; }
  for (const rung of summary.rungs) {
    const recorded = rung.candidates.find(x => x.candidate === c.id);
    if (!recorded) continue;
    for (const { computedIn: _c, ...result } of recorded.examples as (Example & { computedIn?: string })[]) {
      const key = `rung-${rung.rung}/${c.id}/${result.example}`;
      writeCached(cachePath(ladderDir, c.id, print.hash, rung.sha256, result.example), { result, record: records[key], evaluation: evaluations[key], sourceRun: runId });
      seeded++;
    }
  }
}
console.log(JSON.stringify({ runId, seeded, skipped }, null, 2));
