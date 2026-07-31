// Marks scenarios as `verified` — the one status rung that is a human
// assertion ("I looked at the rendered output / pinned errors and approve").
// This script enforces eligibility and rewrites meta.json; it is the ONLY
// writer of the `verification` provenance record.
//
// Usage:
//   node harness/verify/verify-scenarios.mjs --list             show the attention queue
//   node harness/verify/verify-scenarios.mjs --list --json      same, machine-readable
//   node harness/verify/verify-scenarios.mjs <id> [<id>...]     mark scenarios verified
//   node harness/verify/verify-scenarios.mjs --backfill <date>  add provenance records to
//                                                        already-verified scenarios
//                                                        that predate provenance
//
// Eligibility: the scenario must pass check-scenarios cleanly, and (for
// expected-valid documents) must have a committed expected.primitives.json —
// i.e. you can only verify what actually renders today.
//
// Provenance: verifying writes `verification: {at, primitivesHash}` beside
// `status`. Demotion (update:primitives) rewrites `status` but KEEPS the
// record, so the queue can tell three states apart:
//   current    — status verified, hash matches the committed primitives
//   stale      — a record exists, but status was demoted or the hash differs;
//                the committed goldens diff shows exactly what changed
//   never seen — renders, but no human has ever approved it (no record)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadCorpus, createContext, checkScenario } from './check-scenarios.mjs';

/** sha256 of the committed primitives snapshot, or null when there is none. */
function primitivesHash(scenario) {
  const primsPath = path.join(scenario.dir, 'expected.primitives.json');
  if (!fs.existsSync(primsPath)) return null;
  const digest = crypto.createHash('sha256').update(fs.readFileSync(primsPath)).digest('hex');
  return `sha256:${digest.slice(0, 16)}`;
}

function writeMeta(scenario, mutate) {
  const metaPath = path.join(scenario.dir, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  mutate(meta);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
}

function markVerified(scenario, at) {
  writeMeta(scenario, meta => {
    meta.status = 'verified';
    const hash = primitivesHash(scenario);
    meta.verification = hash === null ? { at } : { at, primitivesHash: hash };
  });
}

/**
 * Classifies every scenario for the attention queue. Ordered by attention:
 * blocked (checker errors / render crashes) first, then stale, then never
 * seen; current items are counted, not listed.
 */
export function buildQueue() {
  const ctx = createContext();
  const corpus = loadCorpus();
  const queue = { blocked: [], stale: [], neverSeen: [], current: [] };

  for (const scenario of corpus) {
    const { errors, meta } = checkScenario(scenario, ctx);
    if (!meta) {
      queue.blocked.push({ id: scenario.id, reason: 'meta.json missing or invalid' });
      continue;
    }
    const hash = primitivesHash(scenario);
    const record = meta.verification ?? null;
    const entry = {
      id: scenario.id,
      status: meta.status,
      verifiedAt: record?.at ?? null,
      approvedHash: record?.primitivesHash ?? null,
      currentHash: hash
    };
    if (errors.length > 0) {
      queue.blocked.push({ ...entry, reason: 'checker errors', errors: errors.slice(0, 3) });
    } else if (meta.expect.standard === 'valid' && hash === null) {
      queue.blocked.push({ ...entry, reason: 'not rendered (no expected.primitives.json)' });
    } else if (meta.status === 'verified' && (record?.primitivesHash ?? null) === hash) {
      // Verified with no record and no primitives (invalid-by-design, pre-provenance)
      // also lands here: both sides are null.
      queue.current.push(entry);
    } else if (meta.status === 'verified' && record === null) {
      // Pre-provenance approval: trusted (tests would have demoted a drifted
      // snapshot), but backfill a record so staleness becomes observable.
      queue.current.push({ ...entry, note: 'no provenance record — run --backfill' });
    } else if (record !== null) {
      queue.stale.push(entry);
    } else {
      queue.neverSeen.push(entry);
    }
  }
  return queue;
}

function printQueue(queue, asJson) {
  if (asJson) {
    console.log(JSON.stringify(queue, null, 2));
    return;
  }
  const attention = queue.blocked.length + queue.stale.length + queue.neverSeen.length;
  console.log(
    `Attention queue: ${queue.blocked.length} blocked, ${queue.stale.length} stale, ` +
    `${queue.neverSeen.length} never seen (${queue.current.length} current, not shown)`
  );
  for (const e of queue.blocked) console.log(`  blocked    ${e.id} — ${e.reason}`);
  for (const e of queue.stale) {
    console.log(`  stale      ${e.id} — approved ${e.verifiedAt} at ${e.approvedHash}, now ${e.currentHash}`);
  }
  for (const e of queue.neverSeen) console.log(`  never-seen ${e.id}`);
  if (attention === 0) console.log('The queue is empty.');
}

function main() {
  const args = process.argv.slice(2);
  const corpus = loadCorpus();
  const byId = new Map(corpus.map(s => [s.id, s]));

  if (args.length === 0 || args[0] === '--list') {
    printQueue(buildQueue(), args.includes('--json'));
    return;
  }

  if (args[0] === '--backfill') {
    // Adds provenance to scenarios verified before the record existed. The
    // date is required and should be when the approval actually happened
    // (e.g. 2026-07-17 for the initial 57/57 sweep — see SPEC_APPROVAL.md),
    // not today: the record states when a human looked, and inventing a
    // fresher date would be false provenance.
    const at = args[1];
    if (!at || !/^\d{4}-\d{2}-\d{2}$/.test(at)) {
      console.error('Usage: verify-scenarios.mjs --backfill <YYYY-MM-DD of the original approval>');
      process.exit(1);
    }
    const ctx = createContext();
    let backfilled = 0;
    for (const scenario of corpus) {
      const { errors, meta } = checkScenario(scenario, ctx);
      if (!meta || errors.length > 0) continue;
      if (meta.status !== 'verified' || meta.verification !== undefined) continue;
      markVerified(scenario, at);
      console.log(`BACKFILL ${scenario.id}: verification { at: ${at} }`);
      backfilled++;
    }
    console.log(`\n${backfilled} record(s) backfilled.`);
    return;
  }

  const ctx = createContext();
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
    const hash = primitivesHash(scenario);
    if (meta.expect.standard === 'valid' && hash === null) {
      console.error(`SKIP ${id}: not rendered yet (no expected.primitives.json) — nothing to approve`);
      failures++;
      continue;
    }
    if (meta.status === 'verified' && (meta.verification?.primitivesHash ?? null) === hash) {
      console.log(`OK   ${id}: already verified and current`);
      continue;
    }
    markVerified(scenario, new Date().toISOString());
    console.log(`OK   ${id}: ${meta.status} → verified (${hash ?? 'no primitives — invalid-by-design'})`);
    approved++;
  }
  console.log(`\n${approved} verified, ${failures} skipped.`);
  if (failures > 0) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main();
}
