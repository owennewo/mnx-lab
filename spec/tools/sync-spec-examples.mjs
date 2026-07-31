// Mirrors the MNX spec's worked examples into scenarios/spec/.
//
// Reads the spec's own sources from the vendor/mnx submodule (see
// spec/tools/specSource.mjs) — the example JSON, its blurb, and the $defs it
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
import { createContext, computeExtensionVerdict, formatError, ROOT } from '../../harness/verify/check-scenarios.mjs';
import { loadSpecExamples, loadSpecProse, specRevision, pinIsUpstream } from './specSource.mjs';

const SPEC_DIR = path.join(ROOT, 'scenarios', 'spec');
const PROSE_MANIFEST = path.join(ROOT, 'spec', 'spec-prose.json');
const PROSE_REPORT_LIMIT = 25;

/**
 * Reports changes to the spec's normative prose and refreshes the manifest.
 *
 * Descriptions live only in the fixture, so this is the only tripwire that
 * catches them — moving the pin can restate what a field means with no schema
 * change at all.
 */
function reportProseDrift(revision, schemaVersion, upstream) {
  const current = loadSpecProse();
  const previous = fs.existsSync(PROSE_MANIFEST)
    ? JSON.parse(fs.readFileSync(PROSE_MANIFEST, 'utf8')).prose ?? {}
    : null;

  // Only persist for an upstream pin. Running this while a proposal branch is
  // checked out should still *report* what that branch changes, but recording
  // it would leave the committed manifest describing prose that only exists on
  // a fork — disagreeing with the committed pin.
  if (upstream) {
    fs.writeFileSync(
      PROSE_MANIFEST,
      JSON.stringify({ specRevision: revision, schemaVersion, prose: current }, null, 2) + '\n'
    );
  } else {
    console.log('(pin is not upstream — reporting prose drift without recording it)');
  }

  if (!previous) {
    console.log(`Prose manifest created: ${Object.keys(current).length} documented items.`);
    return;
  }

  const added = Object.keys(current).filter(k => !(k in previous));
  const removed = Object.keys(previous).filter(k => !(k in current));
  const changed = Object.keys(current).filter(k => k in previous && current[k] !== previous[k]);

  if (!added.length && !removed.length && !changed.length) {
    console.log(`Prose unchanged (${Object.keys(current).length} documented items).`);
    return;
  }

  console.log(
    `\nProse drift: ${changed.length} reworded, ${added.length} added, ${removed.length} removed.` +
      `\n  A reworded description can change what a field MEANS with no schema change —` +
      `\n  read the new text in the submodule before assuming it is cosmetic.`
  );
  const show = (label, keys) => {
    for (const k of keys.slice(0, PROSE_REPORT_LIMIT)) console.log(`  ${label} ${k}`);
    if (keys.length > PROSE_REPORT_LIMIT) {
      console.log(`  ${label} … and ${keys.length - PROSE_REPORT_LIMIT} more (see the manifest diff)`);
    }
  };
  show('~', changed);
  show('+', added);
  show('-', removed);
  console.log();
}

function main() {
  const ctx = createContext();
  const { schemaVersion, examples } = loadSpecExamples(ctx.mnxDefs);

  console.log(
    `Spec sources: ${examples.length} examples, schema version ${schemaVersion}, ` +
      `revision ${specRevision().slice(0, 8)}.`
  );

  const upstream = pinIsUpstream();
  if (!upstream) {
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
  reportProseDrift(specRevision(), schemaVersion, upstream);
  if (stale.length) process.exitCode = 1;
}

main();
