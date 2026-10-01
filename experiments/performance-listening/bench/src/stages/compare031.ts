/** 031, read-only: event-chain@3's bar summaries against 030's promoted summaries of @2's
 * intervals (prediction 3). Runs no listener; reads verified private artifacts only. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { encode, EXPERIMENT } from '../io.ts';
import { sha } from '../ladder/privateSets.ts';

type Bar = { ordinal: number; quartersPerMinute: number | null; reference: number | null; ratio: number | null; otherBars: number; eligible: boolean };
type Artifact = { path: string; sha256: string };
if (import.meta.url === `file://${process.argv[1]}`) {
  const [privateRun] = process.argv.slice(2);
  if (!privateRun) throw new Error('Usage: compare031.ts <private 031 run directory>');
  // g031a wrote no public summary; its files are named by the post-failure inventory's hashes.
  // g031b's are named by its results artifact.
  const inventory: Record<string, string> = existsSync(join(privateRun, 'results.json'))
    ? Object.fromEntries(Object.values(JSON.parse(readFileSync(join(privateRun, 'results.json'), 'utf8')) as Record<string, { artifact: Artifact }>)
      .map(r => [basename(r.artifact.path), r.artifact.sha256]))
    : JSON.parse(readFileSync(join(privateRun, 'post-failure-inventory.json'), 'utf8')).files;
  const read = (a: Artifact) => { const bytes = readFileSync(a.path); assert.equal(sha(bytes), a.sha256, a.path); return JSON.parse(bytes.toString()); };
  const old = JSON.parse(readFileSync(join(EXPERIMENT, 'runs/g030-current-instruments/summary.json'), 'utf8')).results as Record<string, { artifact: Artifact }>;
  let bars = 0, structural = 0, maxRelative = 0;
  for (const [id, r] of Object.entries(old)) {
    const a = read(r.artifact).report.tempo.bars as Bar[], b = read({ path: join(privateRun, `event-chain-3.${id}.json`), sha256: inventory[`event-chain-3.${id}.json`]! }).report.tempo.bars as Bar[];
    if (a.length !== b.length) structural++;
    a.forEach((x, k) => {
      const y = b[k]; bars++;
      if (!y || x.ordinal !== y.ordinal || x.otherBars !== y.otherBars || x.eligible !== y.eligible) { structural++; return; }
      for (const f of ['quartersPerMinute', 'reference', 'ratio'] as const) {
        if ((x[f] === null) !== (y[f] === null)) structural++;
        else if (x[f] !== null) maxRelative = Math.max(maxRelative, Math.abs(x[f]! - y[f]!) / Math.abs(x[f]!));
      }
    });
  }
  console.log(encode({ examples: Object.keys(old).length, bars, structural, maxRelative }));
}
