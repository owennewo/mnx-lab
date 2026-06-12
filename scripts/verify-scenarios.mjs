// Marks scenarios as `verified` — the one status rung that is a human
// assertion ("I looked at the rendered output / pinned errors and approve").
// The preview contact sheet (npm run preview:scenarios) assembles the
// invocation; this script enforces eligibility and rewrites meta.json.
//
// Usage:
//   node scripts/verify-scenarios.mjs --list          show the approval queue
//   node scripts/verify-scenarios.mjs <id> [<id>...]  mark scenarios verified
//
// Eligibility: the scenario must pass check-scenarios cleanly, and (for
// expected-valid documents) must have a committed expected.primitives.json —
// i.e. you can only verify what actually renders today.
import fs from 'node:fs';
import path from 'node:path';
import { loadCorpus, createContext, checkScenario } from './check-scenarios.mjs';

function setStatus(scenario, status) {
  const metaPath = path.join(scenario.dir, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.status = status;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
}

function main() {
  const args = process.argv.slice(2);
  const ctx = createContext();
  const corpus = loadCorpus();
  const byId = new Map(corpus.map(s => [s.id, s]));

  if (args.length === 0 || args[0] === '--list') {
    const queue = { ready: [], blocked: [], verified: 0 };
    for (const scenario of corpus) {
      const { errors, meta } = checkScenario(scenario, ctx);
      if (!meta) continue;
      if (meta.status === 'verified') { queue.verified++; continue; }
      const rendered = fs.existsSync(path.join(scenario.dir, 'expected.primitives.json'));
      if (errors.length > 0) {
        queue.blocked.push(`${scenario.id} — checker errors`);
      } else if (meta.expect.standard === 'valid' && !rendered) {
        queue.blocked.push(`${scenario.id} — not rendered yet`);
      } else {
        queue.ready.push(scenario.id);
      }
    }
    console.log(`Approval queue (${queue.ready.length} ready, ${queue.blocked.length} blocked, ${queue.verified} already verified):`);
    for (const id of queue.ready) console.log(`  ready    ${id}`);
    for (const line of queue.blocked) console.log(`  blocked  ${line}`);
    console.log('\nReview visually with: npm run preview:scenarios');
    return;
  }

  let failures = 0;
  let approved = 0;
  for (const id of args) {
    const scenario = byId.get(id);
    if (!scenario) {
      console.error(`SKIP ${id}: no such scenario id`);
      failures++;
      continue;
    }
    const { errors, meta } = checkScenario(scenario, ctx);
    if (!meta || errors.length > 0) {
      console.error(`SKIP ${id}: fails check-scenarios — fix before verifying:`);
      for (const e of errors.slice(0, 3)) console.error(`    ${e}`);
      failures++;
      continue;
    }
    if (meta.status === 'verified') {
      console.log(`OK   ${id}: already verified`);
      continue;
    }
    if (meta.expect.standard === 'valid' &&
        !fs.existsSync(path.join(scenario.dir, 'expected.primitives.json'))) {
      console.error(`SKIP ${id}: not rendered yet (no expected.primitives.json) — nothing to approve`);
      failures++;
      continue;
    }
    setStatus(scenario, 'verified');
    console.log(`OK   ${id}: ${meta.status} → verified`);
    approved++;
  }
  console.log(`\n${approved} verified, ${failures} skipped.`);
  if (failures > 0) process.exit(1);
}

main();
