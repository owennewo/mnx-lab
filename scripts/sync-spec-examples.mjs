// Mirrors the MNX spec's worked examples into scenarios/spec/.
//
// Reads the spec's own sources from the vendor/mnx submodule (see
// scripts/specSource.mjs) — the example JSON, its blurb, and the $defs it
// exercises. Pinning the submodule pins the spec revision the corpus is
// generated from; bumping it is a deliberate commit, not silent drift.
//
// expect records the ACTUAL verdict (with auto-pinned error fragments when
// invalid) — a spec example failing its own schema is a finding to record,
// not a corpus failure. Existing status is preserved when the document is
// unchanged, so re-syncing doesn't reset rendered/verified progress.
//
// scenarios/spec/ is owned by this script. Do not hand-edit it.
//
// Usage: npm run sync:spec
import fs from 'node:fs';
import path from 'node:path';
import { createContext, computeExtensionVerdict, formatError, ROOT } from './check-scenarios.mjs';
import { loadSpecExamples, specRevision, pinIsUpstream } from './specSource.mjs';

const SPEC_DIR = path.join(ROOT, 'scenarios', 'spec');

function main() {
  const ctx = createContext();
  const { schemaVersion, examples } = loadSpecExamples(ctx.mnxDefs);

  console.log(
    `Spec sources: ${examples.length} examples, schema version ${schemaVersion}, ` +
      `revision ${specRevision().slice(0, 8)}.`
  );

  if (!pinIsUpstream()) {
    console.warn(
      `\n  WARNING: vendor/mnx is on a commit that is not reachable from origin/main.\n` +
        `  .gitmodules points at w3c-cg/mnx, so committing this pin would leave a submodule\n` +
        `  nobody else can fetch. Return to an upstream commit before committing the pin.\n`
    );
  }

  const localVersion = ctx.mnxSchemaVersion;
  if (localVersion && schemaVersion && localVersion !== schemaVersion) {
    console.warn(
      `\n  WARNING: schemas/mnx-schema.json is version ${localVersion} but the pinned spec is ` +
        `version ${schemaVersion}.\n  The corpus will be generated from examples the local ` +
        `validator does not match. Re-vendor the schema or move the submodule pin.\n`
    );
  }

  let invalidCount = 0;
  let updated = 0;

  for (const example of examples) {
    const { slug, title, description, doc, coversDefs, specUrl } = example;

    const standardOk = ctx.validateMnx(doc);
    const standardErrors = standardOk ? [] : (ctx.validateMnx.errors ?? []).map(formatError);
    const ext = computeExtensionVerdict(doc, ctx);
    if (!standardOk) invalidCount++;

    const dir = path.join(SPEC_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });

    const scorePath = path.join(dir, 'score.mnx.json');
    const newScore = JSON.stringify(doc, null, 2) + '\n';
    const scoreUnchanged = fs.existsSync(scorePath) && fs.readFileSync(scorePath, 'utf8') === newScore;
    fs.writeFileSync(scorePath, newScore);
    if (!scoreUnchanged) updated++;

    // Preserve status across re-syncs when the document hasn't changed.
    const metaPath = path.join(dir, 'meta.json');
    let status = 'valid';
    if (scoreUnchanged && fs.existsSync(metaPath)) {
      status = JSON.parse(fs.readFileSync(metaPath, 'utf8')).status ?? 'valid';
    }

    const meta = {
      title,
      description,
      tags: ['spec-example'],
      specRefs: [specUrl],
      coversDefs,
      expect: {
        standard: standardOk ? 'valid' : 'invalid',
        extension: ext.verdict,
        ...(standardOk && ext.verdict !== 'invalid'
          ? {}
          : { errors: [...new Set([...standardErrors, ...ext.errors])].slice(0, 3) })
      },
      requires: [],
      source: 'spec-example',
      status
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');

    console.log(`  ${slug}: ${standardOk ? 'valid' : 'INVALID'}${scoreUnchanged ? '' : ' (updated)'}`);
  }

  // A slug that disappeared upstream would otherwise linger as a stale scenario.
  const known = new Set(examples.map(e => e.slug));
  const stale = fs.existsSync(SPEC_DIR)
    ? fs.readdirSync(SPEC_DIR, { withFileTypes: true }).filter(d => d.isDirectory() && !known.has(d.name))
    : [];
  for (const d of stale) {
    console.warn(`  ${d.name}: no longer in the spec — remove scenarios/spec/${d.name}`);
  }

  console.log(
    `\nSynced ${examples.length} examples (${updated} changed); ${invalidCount} fail schema validation.`
  );
  if (stale.length) process.exitCode = 1;
}

main();
