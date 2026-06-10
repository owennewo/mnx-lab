// Mirrors the MNX spec's worked examples into scenarios/spec/.
//
// Fetches the example index at w3c-cg.github.io/mnx/docs/mnx-reference/examples/,
// then for each example: extracts the JSON document from the annotated
// <div class="xmlmarkup"> markup, harvests coversDefs from the markup's
// objects/<def>/ hyperlinks (the spec's own annotations), computes the actual
// validation verdicts, and writes score.mnx.json + a GENERATED meta.json.
//
// expect records the ACTUAL verdict (with auto-pinned error fragments when
// invalid) — a spec example failing its own schema is a finding to record,
// not a corpus failure. Existing status is preserved when the document is
// unchanged, so re-syncing doesn't reset rendered/verified progress.
//
// scenarios/spec/ is owned by this script. Do not hand-edit it.
//
// Usage: node scripts/sync-spec-examples.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, computeExtensionVerdict, formatError } from './check-scenarios.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SPEC_DIR = path.join(ROOT, 'scenarios', 'spec');
const BASE = 'https://w3c-cg.github.io/mnx/docs/mnx-reference/examples/';

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

function extractSlugs(indexHtml) {
  const slugs = [];
  for (const m of indexHtml.matchAll(/href="([a-z0-9-]+)\/"/g)) {
    if (!slugs.includes(m[1])) slugs.push(m[1]);
  }
  return slugs;
}

function extractExample(html, slug) {
  const titleMatch = html.match(/<h1>(.*?)<\/h1>/s);
  const title = decodeEntities((titleMatch?.[1] ?? slug).replace(/<[^>]+>/g, '')).replace(/[“”]/g, '').trim();

  // Description: plain <p> paragraphs in the body that aren't breadcrumbs,
  // images, or the "See also" link line.
  const paragraphs = [...html.matchAll(/<p>(.*?)<\/p>/gs)]
    .map(m => decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim())
    .filter(t => t && !t.startsWith('See also'));
  const description = paragraphs[0] ?? `MNX spec example "${slug}".`;

  const markupMatch = html.match(/<div class="xmlmarkup">(.*?)<\/div>/s);
  if (!markupMatch) throw new Error(`${slug}: no xmlmarkup div found`);
  const markup = markupMatch[1];

  // coversDefs from the spec's own annotation links
  const defs = new Set();
  for (const m of markup.matchAll(/href="\.\.\/\.\.\/objects\/([a-z0-9-]+)\/"/g)) {
    defs.add(m[1]);
  }

  const jsonText = decodeEntities(markup.replace(/<[^>]+>/g, ''));
  let doc;
  try {
    doc = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`${slug}: extracted markup is not valid JSON — ${e.message}`);
  }

  return { title, description, defs, doc };
}

async function main() {
  const ctx = createContext();
  const indexHtml = await fetchText(BASE);
  const slugs = extractSlugs(indexHtml);
  console.log(`Found ${slugs.length} spec examples.`);

  let invalidCount = 0;
  const failures = [];

  for (const slug of slugs) {
    try {
      const html = await fetchText(`${BASE}${slug}/`);
      const { title, description, defs, doc } = extractExample(html, slug);

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
        specRefs: [`${BASE}${slug}/`],
        coversDefs: [...defs].filter(d => ctx.mnxDefs.has(d)).sort(),
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
    } catch (e) {
      failures.push(`${slug}: ${e.message}`);
      console.error(`  ${slug}: FAILED — ${e.message}`);
    }
  }

  console.log(`\nSynced ${slugs.length - failures.length}/${slugs.length} examples; ${invalidCount} fail schema validation.`);
  if (failures.length) {
    console.error(`Failures:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

main();
