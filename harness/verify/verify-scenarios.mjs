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
//   node harness/verify/verify-scenarios.mjs --backfill-render  stamp renderHash onto
//                                                        current records that predate
//                                                        the SVG golden
//
// Eligibility: the scenario must pass check-scenarios cleanly, and (for
// expected-valid documents) must have a committed expected.primitives.json —
// i.e. you can only verify what actually renders today.
//
// Provenance: verifying writes `verification: {at, primitivesHash, renderHash}`
// beside `status`. Demotion (update:primitives) rewrites `status` but KEEPS the
// record, so the queue can tell three states apart:
//   current    — status verified, both hashes match the committed goldens
//   stale      — a record exists, but status was demoted or a hash differs;
//                the committed goldens diff shows exactly what changed
//   never seen — renders, but no human has ever approved it (no record)
//
// One hash per golden: `primitivesHash` covers layout
// (expected.primitives.json), `renderHash` covers the emitter's own output
// (expected.svg + expected.tab.svg — see harness/helpers/corpusSvg.ts), and
// `bothHash` covers the combined notation+tab system (expected.both.svg).
// `renderHash` and `bothHash` are OPTIONAL in a record, and their absence is
// not staleness: approvals predating each golden were real human assertions
// made on the evidence that existed, and demoting all of them to introduce a
// new field would be exactly the mass-demotion this record exists to avoid.
// They stay current, carry a note, and pick up the hash the next time they
// are approved. (That is also why renderHash's file set is FROZEN at the two
// standalone SVGs: folding expected.both.svg into it would move every
// committed digest at once. There is no --backfill for bothHash — nobody
// approved a both view before the golden existed, so the combined system
// earns its hash only through a real approval.)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadCorpus, createContext, checkScenario } from './check-scenarios.mjs';

// renderHash's file set — frozen (see header); expected.both.svg is hashed
// separately as bothHash.
const RENDER_HASH_FILES = ['expected.svg', 'expected.tab.svg'];
const BOTH_GOLDEN_FILE = 'expected.both.svg';

function shortHash(update) {
  const hash = crypto.createHash('sha256');
  update(hash);
  return `sha256:${hash.digest('hex').slice(0, 16)}`;
}

/** sha256 of the committed primitives snapshot, or null when there is none. */
function primitivesHash(scenario) {
  const primsPath = path.join(scenario.dir, 'expected.primitives.json');
  if (!fs.existsSync(primsPath)) return null;
  return shortHash(h => h.update(fs.readFileSync(primsPath)));
}

/**
 * sha256 over the committed SVG goldens, or null when none exist. Filenames
 * are hashed alongside contents so gaining or losing the tab golden moves the
 * digest even if the notation SVG is untouched.
 */
function renderHash(scenario) {
  const present = RENDER_HASH_FILES.map(name => [name, path.join(scenario.dir, name)]).filter(
    ([, p]) => fs.existsSync(p)
  );
  if (present.length === 0) return null;
  return shortHash(h => {
    for (const [name, p] of present) h.update(name).update('\0').update(fs.readFileSync(p));
  });
}

/** sha256 of the combined-system golden, or null when there is none. */
function bothHash(scenario) {
  const p = path.join(scenario.dir, BOTH_GOLDEN_FILE);
  if (!fs.existsSync(p)) return null;
  return shortHash(h => h.update(fs.readFileSync(p)));
}

function writeMeta(scenario, mutate) {
  const metaPath = path.join(scenario.dir, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  mutate(meta);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
}

/**
 * `skipBothHash` is for the backfill commands: they re-stamp records with the
 * ORIGINAL approval date, and no approval that old can have looked at the
 * both view — recording a bothHash there would be false provenance.
 */
function markVerified(scenario, at, { skipBothHash = false } = {}) {
  writeMeta(scenario, meta => {
    meta.status = 'verified';
    const prims = primitivesHash(scenario);
    const render = renderHash(scenario);
    const both = skipBothHash ? null : bothHash(scenario);
    const record = { at };
    if (prims !== null) record.primitivesHash = prims;
    if (render !== null) record.renderHash = render;
    if (both !== null) record.bothHash = both;
    meta.verification = record;
  });
}

/**
 * Is this record still an assertion about the current goldens? A missing
 * renderHash or bothHash is grandfathered (see the header); a present one
 * must match.
 */
function recordMatches(record, prims, render, both) {
  if (record === null) return false;
  if ((record.primitivesHash ?? null) !== prims) return false;
  if (record.renderHash !== undefined && record.renderHash !== render) return false;
  return record.bothHash === undefined || record.bothHash === both;
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
    const render = renderHash(scenario);
    const both = bothHash(scenario);
    const record = meta.verification ?? null;
    const entry = {
      id: scenario.id,
      status: meta.status,
      verifiedAt: record?.at ?? null,
      approvedHash: record?.primitivesHash ?? null,
      currentHash: hash,
      approvedRenderHash: record?.renderHash ?? null,
      currentRenderHash: render,
      approvedBothHash: record?.bothHash ?? null,
      currentBothHash: both
    };
    if (errors.length > 0) {
      queue.blocked.push({ ...entry, reason: 'checker errors', errors: errors.slice(0, 3) });
    } else if (meta.expect.standard === 'valid' && hash === null) {
      queue.blocked.push({ ...entry, reason: 'not rendered (no expected.primitives.json)' });
    } else if (meta.status === 'verified' && recordMatches(record, hash, render, both)) {
      // Approvals that predate a golden stay current (see the header) but say
      // which evidence a fresh approval would add to the record.
      const predates = [];
      if (record !== null && record.renderHash === undefined && render !== null) {
        predates.push('the SVG golden');
      }
      if (record !== null && record.bothHash === undefined && both !== null) {
        predates.push('the both golden');
      }
      queue.current.push(
        predates.length
          ? { ...entry, note: `approved before ${predates.join(' and ')} — hash recorded on next approval` }
          : entry
      );
    } else if (meta.status === 'verified' && record === null) {
      // Pre-provenance approval — including invalid-by-design scenarios, which
      // have no goldens at all. Trusted (tests would have demoted a drifted
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
    // Name which golden moved: layout and emitter drift are different bugs.
    const drifted = [];
    if (e.approvedHash !== e.currentHash) {
      drifted.push(`primitives ${e.approvedHash} → ${e.currentHash}`);
    }
    if (e.approvedRenderHash !== null && e.approvedRenderHash !== e.currentRenderHash) {
      drifted.push(`svg ${e.approvedRenderHash} → ${e.currentRenderHash}`);
    }
    if (e.approvedBothHash !== null && e.approvedBothHash !== e.currentBothHash) {
      drifted.push(`both ${e.approvedBothHash} → ${e.currentBothHash}`);
    }
    const why = drifted.length > 0 ? drifted.join(', ') : `status demoted to ${e.status}`;
    console.log(`  stale      ${e.id} — approved ${e.verifiedAt}; ${why}`);
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
      markVerified(scenario, at, { skipBothHash: true });
      console.log(`BACKFILL ${scenario.id}: verification { at: ${at} }`);
      backfilled++;
    }
    console.log(`\n${backfilled} record(s) backfilled.`);
    return;
  }

  if (args[0] === '--backfill-render') {
    // Stamps renderHash onto approvals made before the SVG golden existed,
    // keeping each record's original `at` date.
    //
    // Read what this asserts before running it: "the SVG our emitter produces
    // today is the output that was approved on that date". That is true only
    // if nothing downstream of the primitives has moved since — the emitter,
    // the glyph name → codepoint table, the sp→px arithmetic. Layout drift
    // would already have demoted these scenarios out of `current`; emitter
    // drift is exactly what nothing was watching, which is why the golden was
    // added. So this is a judgement call, not a derivation, and it is a
    // separate command for that reason. If in doubt, re-verify through
    // /verify instead and let a human look at the render.
    const ctx = createContext();
    let stamped = 0;
    for (const scenario of corpus) {
      const { errors, meta } = checkScenario(scenario, ctx);
      if (!meta || errors.length > 0 || meta.status !== 'verified') continue;
      const record = meta.verification ?? null;
      if (record === null || record.renderHash !== undefined) continue;
      const hash = primitivesHash(scenario);
      const render = renderHash(scenario);
      if (render === null || (record.primitivesHash ?? null) !== hash) continue;
      markVerified(scenario, record.at, { skipBothHash: true });
      console.log(`STAMP ${scenario.id}: renderHash ${render} (approved ${record.at})`);
      stamped++;
    }
    console.log(`\n${stamped} record(s) stamped with a renderHash.`);
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
    const render = renderHash(scenario);
    const both = bothHash(scenario);
    if (meta.status === 'verified' && recordMatches(meta.verification ?? null, hash, render, both)) {
      console.log(`OK   ${id}: already verified and current`);
      continue;
    }
    markVerified(scenario, new Date().toISOString().slice(0, 10));
    console.log(`OK   ${id}: ${meta.status} → verified (${hash ?? 'no primitives — invalid-by-design'})`);
    approved++;
  }
  console.log(`\n${approved} verified, ${failures} skipped.`);
  if (failures > 0) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main();
}
