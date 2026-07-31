// push:proposal — the UP half of the spec-loop pipeline (sync:spec is DOWN).
//
// For one proposal topic, injects its local scenarios into the proposal
// branch's Django fixture as genuine spectools.exampledocument records:
// document JSON into doctools/media/examples/json/, our engraving (from
// spec/proposals/<topic>/engravings/) as the example's image, and
// exampledocumentobject joins computed from meta.coversDefs — beside the
// jsonobject edits that constitute the schema change. The proposal branch is
// therefore "upstream + our superset" as a generated artifact: authored in
// scenario files at the bottom, reviewed by the CG in the spec's native
// format at the top.
//
// Usage:
//   node spec/tools/push-proposal.mjs <topic> [--worktree <dir>]
//
// The target is a git WORKTREE of the fork branch (default:
// ../mnx-proposals/proposal-<topic> beside this repo) — never vendor/mnx,
// which stays on the upstream pin. Verify the result by generating the site
// in the worktree (see docs/mnx-spec-submodule.md):
//   cd <worktree>/doctools && uv run manage.py makesite
//
// Reproducibility: the fixture is rewritten with freezedb's own layout
// ('[\n' + records joined by ',\n' at indent 4 + '\n]\n'), verified against
// the file before any change — so a re-run with unchanged inputs is a no-op
// and diffs stay record-level. Conservative by design: existing records'
// name/blurb are never overwritten (the admin may have enriched them);
// drift is reported instead. Media JSON is left untouched when it equals the
// scenario document modulo the spec site's own `_x.mnxdocs` display hints.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

function serializeFixture(records) {
  return '[\n' + records.map(r => JSON.stringify(r, null, 4)).join(',\n') + '\n]\n';
}

/** Strips the spec site's own display hints, same rule as specSource.mjs. */
function stripDocsAnnotations(node) {
  if (Array.isArray(node)) node.forEach(stripDocsAnnotations);
  else if (node && typeof node === 'object') {
    if (node._x && typeof node._x === 'object') {
      delete node._x.mnxdocs;
      if (Object.keys(node._x).length === 0) delete node._x;
    }
    for (const value of Object.values(node)) stripDocsAnnotations(value);
  }
  return node;
}

/** Key-order-insensitive structural equality. */
function normalize(node) {
  if (Array.isArray(node)) return node.map(normalize);
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.keys(node)
        .sort()
        .map(k => [k, normalize(node[k])])
    );
  }
  return node;
}
const same = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

function loadTopicScenarios(topic) {
  const out = [];
  const labDir = path.join(ROOT, 'scenarios', 'lab');
  for (const category of fs.readdirSync(labDir)) {
    const catDir = path.join(labDir, category);
    if (!fs.statSync(catDir).isDirectory()) continue;
    for (const dirName of fs.readdirSync(catDir).sort()) {
      const dir = path.join(catDir, dirName);
      const metaPath = path.join(dir, 'meta.json');
      if (!fs.existsSync(metaPath)) continue;
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (meta.proposal !== topic) continue;
      out.push({
        slug: dirName.replace(/^\d+-/, ''),
        meta,
        doc: JSON.parse(fs.readFileSync(path.join(dir, 'score.mnx.json'), 'utf8'))
      });
    }
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const topic = args[0];
  if (!topic || topic.startsWith('--')) {
    console.error('Usage: node spec/tools/push-proposal.mjs <topic> [--worktree <dir>]');
    process.exit(1);
  }
  const wtFlag = args.indexOf('--worktree');
  const worktree =
    wtFlag !== -1
      ? path.resolve(args[wtFlag + 1])
      : path.join(ROOT, '..', 'mnx-proposals', `proposal-${topic}`);

  const dataPath = path.join(worktree, 'doctools', 'data.json');
  const mediaDir = path.join(worktree, 'doctools', 'media', 'examples');
  if (!fs.existsSync(dataPath)) {
    console.error(
      `No fixture at ${dataPath}.\n` +
        `Check the proposal branch out as a worktree first (never in vendor/mnx):\n` +
        `    git -C vendor/mnx worktree add ${worktree} proposal-${topic}`
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(dataPath, 'utf8');
  const records = JSON.parse(raw);
  if (serializeFixture(records) !== raw) {
    console.error(
      'Refusing to write: the fixture does not round-trip through the expected ' +
        'freezedb layout, so a rewrite would produce a noisy diff. Regenerate it ' +
        'with `manage.py freezedb` and retry.'
    );
    process.exit(1);
  }

  const scenarios = loadTopicScenarios(topic);
  if (scenarios.length === 0) {
    console.error(`No scenarios declare "proposal": "${topic}".`);
    process.exit(1);
  }

  const of = model => records.filter(r => r.model === model);
  const examples = of('spectools.exampledocument');
  const bySlug = new Map(examples.map(r => [r.fields.slug, r]));
  const objectPk = new Map(of('spectools.jsonobject').map(r => [r.fields.slug, r.pk]));
  const template = examples[0];
  const maxPk = model => Math.max(0, ...of(model).map(r => r.pk));

  let changedFixture = false;
  const report = [];

  for (const { slug, meta, doc } of scenarios) {
    const lines = [];

    // 1. Document JSON — keep the media file when it equals the scenario doc
    //    modulo _x.mnxdocs, preserving hand-added display highlights.
    const docPath = path.join(mediaDir, 'json', `${slug}.json`);
    if (
      !fs.existsSync(docPath) ||
      !same(stripDocsAnnotations(JSON.parse(fs.readFileSync(docPath, 'utf8'))), doc)
    ) {
      fs.mkdirSync(path.dirname(docPath), { recursive: true });
      fs.writeFileSync(docPath, JSON.stringify(doc, null, 2) + '\n');
      lines.push('document written');
    }

    // 2. Engraving — ours, from the evidence bundle.
    const engraving = path.join(ROOT, 'spec', 'proposals', topic, 'engravings', `${slug}.png`);
    const imagePath = path.join(mediaDir, `${slug}.png`);
    if (!fs.existsSync(engraving)) {
      lines.push('NO ENGRAVING in the bundle — render it (harness/render/render-png.ts)');
    } else if (
      !fs.existsSync(imagePath) ||
      !fs.readFileSync(engraving).equals(fs.readFileSync(imagePath))
    ) {
      fs.copyFileSync(engraving, imagePath);
      lines.push('engraving copied');
    }

    // 3. The exampledocument record.
    let record = bySlug.get(slug);
    if (!record) {
      record = {
        model: 'spectools.exampledocument',
        pk: maxPk('spectools.exampledocument') + 1,
        fields: Object.fromEntries(
          Object.keys(template.fields).map(k => [
            k,
            {
              name: meta.title,
              slug,
              schema: template.fields.schema,
              blurb: meta.description,
              document: '',
              document_path: `examples/json/${slug}.json`,
              image_url: `/static/examples/${slug}.png`
            }[k] ?? template.fields[k]
          ])
        )
      };
      records.push(record);
      changedFixture = true;
      lines.push(`record created (pk ${record.pk})`);
    } else {
      // Never overwrite curated prose; surface drift instead.
      if (record.fields.name !== meta.title) {
        lines.push(`name drift: fixture "${record.fields.name}" vs meta "${meta.title}"`);
      }
    }

    // 4. Joins from coversDefs (the corpus's declaration of exercised $defs).
    const desired = new Set(
      (meta.coversDefs ?? []).map(d => objectPk.get(d)).filter(pk => pk !== undefined)
    );
    const joins = of('spectools.exampledocumentobject').filter(
      r => r.fields.example === record.pk
    );
    for (const j of joins) {
      if (!desired.has(j.fields.json_object)) {
        records.splice(records.indexOf(j), 1);
        changedFixture = true;
        lines.push(`join removed (jsonobject ${j.fields.json_object})`);
      }
    }
    const have = new Set(joins.map(j => j.fields.json_object));
    for (const pk of desired) {
      if (!have.has(pk)) {
        records.push({
          model: 'spectools.exampledocumentobject',
          pk: maxPk('spectools.exampledocumentobject') + 1,
          fields: { example: record.pk, json_object: pk }
        });
        changedFixture = true;
        lines.push(`join added (jsonobject ${pk})`);
      }
    }

    report.push(`  ${slug}: ${lines.length ? lines.join('; ') : 'up to date'}`);
  }

  if (changedFixture) {
    fs.writeFileSync(dataPath, serializeFixture(records));
  }

  console.log(`push:proposal ${topic} → ${worktree}`);
  for (const line of report) console.log(line);
  console.log(
    changedFixture ? '\nFixture updated.' : '\nFixture already up to date.',
    `Verify by generating the site in the worktree:\n    cd ${path.join(
      worktree,
      'doctools'
    )} && uv run manage.py makesite`
  );
}

main();
