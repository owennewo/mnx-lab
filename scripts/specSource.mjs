// Reads the MNX spec's own sources out of the vendor/mnx submodule.
//
// The spec docs are database-driven: doctools/data.json is a Django fixture
// (freezedb output) and docs/ is generated from it by `manage.py makesite`.
// Everything we want is therefore a *record*, not a file we can read directly:
//
//   spectools.exampledocument        one per worked example (49)
//     .document_path                 -> doctools/media/examples/json/<x>.json
//     .image_url                     -> doctools/media/examples/<x>.png (as /static/…)
//   spectools.exampledocumentobject  example -> jsonobject join
//   spectools.jsonobject             the $defs, by slug
//   spectools.xmlschema  .version    the number in mnx-schema.json's $id
//
// We used to scrape the *rendered* HTML at w3c-cg.github.io for all of this.
// Reading the fixture is both offline and more accurate — see coversDefs below.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT } from './check-scenarios.mjs';

export const SUBMODULE = path.join(ROOT, 'vendor', 'mnx');
export const DOCTOOLS = path.join(SUBMODULE, 'doctools');
export const MEDIA = path.join(DOCTOOLS, 'media');
export const DATA_JSON = path.join(DOCTOOLS, 'data.json');

/** Canonical public URL for an example, still used as meta.specRefs. */
export const EXAMPLE_URL_BASE = 'https://w3c-cg.github.io/mnx/docs/mnx-reference/examples/';

/**
 * Absolute path to an example's reference engraving. The spec stores these as
 * `/static/examples/x.png` (the URL the generated site serves them at); on disk
 * `/static/` is the media directory.
 */
export function referenceImagePath(imageUrl) {
  return path.join(MEDIA, imageUrl.replace('/static/', ''));
}

/**
 * Strips `_x.mnxdocs` in place.
 *
 * The spec's source documents carry the doc generator's own vendor dict —
 * `_x: {mnxdocs: {highlight: [...]}}` — which tells the renderer which keys to
 * emphasise on the example's page. It is presentation metadata for the spec
 * site, not part of the example, and the published markup doesn't show it (81
 * occurrences across the 49 examples, all `mnxdocs`). Same `_x.<vendor>`
 * convention we use for `_x.mnxLab`, so it must be removed by vendor key
 * rather than by dropping `_x` wholesale.
 */
function stripDocsAnnotations(node) {
  if (Array.isArray(node)) {
    node.forEach(stripDocsAnnotations);
  } else if (node && typeof node === 'object') {
    if (node._x && typeof node._x === 'object') {
      delete node._x.mnxdocs;
      if (Object.keys(node._x).length === 0) delete node._x;
    }
    for (const value of Object.values(node)) stripDocsAnnotations(value);
  }
  return node;
}

/**
 * Normalises an example's blurb into a description string.
 *
 * `freezedb` serialises a multi-line text field as an array of lines (the same
 * convention it uses for exampledocumentcomparison.document), so a blurb is a
 * string when it is one paragraph and an array when it is several. 33 of the 49
 * examples have no blurb at all upstream; those get a synthetic description, as
 * the previous HTML-scraping importer did.
 */
function describeExample(blurb, slug) {
  const text = (Array.isArray(blurb) ? blurb.join('\n') : blurb ?? '').trim();
  return text || `MNX spec example "${slug}".`;
}

function requireSubmodule() {
  if (fs.existsSync(DATA_JSON)) return;
  throw new Error(
    `MNX spec sources not found at ${path.relative(ROOT, DATA_JSON)}.\n` +
      `The spec is a git submodule. Fetch it with:\n\n` +
      `    git submodule update --init vendor/mnx\n`
  );
}

/**
 * Loads the spec fixture and returns its worked examples plus the schema
 * version, resolved into plain objects.
 *
 * `coversDefs` comes from the exampledocumentobject join, which upstream builds
 * in `accumulate_used_json_objects()` by walking each example's JSON against
 * the schema's object graph. It is the same data that drives the "examples
 * using this object" list on every object's reference page, so it is the
 * spec's own answer to "which $defs does this example exercise".
 */
export function loadSpecExamples(mnxDefs) {
  requireSubmodule();
  const records = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));
  const of = model => records.filter(r => r.model === model);

  const objectSlug = new Map(of('spectools.jsonobject').map(r => [r.pk, r.fields.slug]));
  const defsByExample = new Map();
  for (const { fields } of of('spectools.exampledocumentobject')) {
    if (!defsByExample.has(fields.example)) defsByExample.set(fields.example, new Set());
    defsByExample.get(fields.example).add(objectSlug.get(fields.json_object));
  }

  const schemaVersion = of('spectools.xmlschema')[0]?.fields.version ?? null;

  const examples = of('spectools.exampledocument').map(({ pk, fields }) => {
    const docPath = path.join(MEDIA, fields.document_path);
    let doc;
    try {
      doc = stripDocsAnnotations(JSON.parse(fs.readFileSync(docPath, 'utf8')));
    } catch (e) {
      throw new Error(`${fields.slug}: cannot read ${path.relative(ROOT, docPath)} — ${e.message}`);
    }
    return {
      slug: fields.slug,
      // Upstream wraps a couple of names in typographic quotes ("Hello world").
      title: fields.name.replace(/[“”]/g, '').trim(),
      description: describeExample(fields.blurb, fields.slug),
      doc,
      coversDefs: [...(defsByExample.get(pk) ?? [])].filter(d => mnxDefs.has(d)).sort(),
      imagePath: referenceImagePath(fields.image_url),
      specUrl: `${EXAMPLE_URL_BASE}${fields.slug}/`
    };
  });

  examples.sort((a, b) => a.slug.localeCompare(b.slug));
  return { schemaVersion, examples };
}

/**
 * Fingerprints the spec's normative prose, keyed by readable name.
 *
 * MNX's descriptions are normative but live *only* in the fixture — the
 * generated mnx-schema.json drops them entirely, so a prose change has zero
 * schema footprint and a schema diff cannot see it. Real example: v24's
 * dynamic-group-type description gained "accent", a value that had been in the
 * enum and undocumented since v19; and attackValue -> residualValue reversed
 * which dynamic `value` holds for an "fp", which validates either way.
 *
 * We store hashes rather than the text: it says *which* items moved without
 * copying upstream's documentation into this repo, and the manifest diff stays
 * readable in review. Read the actual wording from the submodule.
 */
export function loadSpecProse() {
  requireSubmodule();
  const records = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));
  const of = model => records.filter(r => r.model === model);
  const slug = new Map(of('spectools.jsonobject').map(r => [r.pk, r.fields.slug]));

  // freezedb splits a multi-line text field into an array of lines.
  const text = v => (Array.isArray(v) ? v.join('\n') : v ?? '');
  const digest = v => createHash('sha256').update(text(v)).digest('hex').slice(0, 12);

  const prose = {};
  for (const { fields } of of('spectools.jsonobject')) {
    prose[`object:${fields.slug}`] = digest(fields.description);
  }
  for (const { fields } of of('spectools.jsonobjectrelationship')) {
    prose[`relationship:${slug.get(fields.parent)}.${fields.child_key}`] = digest(fields.description);
  }
  for (const { fields } of of('spectools.jsonobjectenum')) {
    prose[`enum:${slug.get(fields.parent)}.${fields.name}`] = digest(fields.description);
  }
  return Object.fromEntries(Object.entries(prose).sort(([a], [b]) => a.localeCompare(b)));
}

/** The submodule's checked-out commit, for provenance in generated output. */
export function specRevision() {
  requireSubmodule();
  return execFileSync('git', ['-C', SUBMODULE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

/**
 * True when the checked-out commit is reachable from upstream's default branch.
 *
 * .gitmodules points at w3c-cg/mnx, so a commit that exists only on a fork —
 * an in-flight proposal branch — is unfetchable for anyone else and for CI.
 * Contribution work belongs on a branch pushed to a `fork` remote; the recorded
 * pin must stay on an upstream commit. Offline check against the local clone's
 * origin/main, so it is only as fresh as the last fetch.
 */
export function pinIsUpstream() {
  try {
    execFileSync('git', ['-C', SUBMODULE, 'merge-base', '--is-ancestor', 'HEAD', 'origin/main'], {
      stdio: 'ignore'
    });
    return true;
  } catch {
    return false;
  }
}
