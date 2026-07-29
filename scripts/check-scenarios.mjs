// Corpus police for scenarios/ (see roadmap/inprogress/04-scenario-library.md).
// Checks, per scenario: metadata validates against meta.schema.json, JSON files
// are canonically formatted, actual validation verdicts (standard MNX + _x.mnxLab
// extension) match the declared `expect` in both directions, pinned error
// fragments match for invalid-by-design scenarios, claimed status isn't ahead
// of reality, and coversDefs entries actually exist in the schema.
//
// Usage: node scripts/check-scenarios.mjs
// Also imported as a library by tests/scenarios.test.ts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCENARIOS_DIR = path.join(ROOT, 'scenarios');

const ALLOWED_FILES = new Set(['meta.json', 'score.mnx.json', 'expected.primitives.json', 'notes.md']);
const SEGMENT_RE = /^(\d+-)?[a-z0-9][a-z0-9-]*$/;
const STATUS_ORDER = { draft: 0, valid: 1, rendered: 2, verified: 3 };

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function stripPrefix(segment) {
  return segment.replace(/^\d+-/, '');
}

/** Builds the validators + manifest shared by every scenario check. */
export function createContext() {
  const ajv = new Ajv2020.default({ allErrors: true, validateFormats: false });
  const mnxSchema = readJson(path.join(ROOT, 'schemas', 'mnx-schema.json'));
  const extSchema = readJson(path.join(ROOT, 'schemas', 'mnx-lab-extensions.schema.json'));
  const metaSchema = readJson(path.join(SCENARIOS_DIR, 'meta.schema.json'));
  ajv.addSchema(extSchema);

  // The proposed schema is optional and present only while a spec proposal is in
  // flight. It is generated from our fork of the spec, so a scenario declaring
  // `"schema": "proposed"` is asserting "this is what the document looks like IF
  // the proposal is adopted" — see docs/mnx-spec-submodule.md.
  const proposedPath = path.join(ROOT, 'schemas', 'mnx-schema.proposed.json');
  const proposedSchema = fs.existsSync(proposedPath) ? readJson(proposedPath) : null;

  return {
    proposedSchema: proposedSchema
      ? {
          version: /\/version\/(.+)$/.exec(proposedSchema.$id ?? '')?.[1] ?? null,
          defs: new Set(Object.keys(proposedSchema.$defs ?? {})),
          validate: new Ajv2020.default({ allErrors: true, validateFormats: false }).compile(
            proposedSchema
          )
        }
      : null,
    manifest: readJson(path.join(SCENARIOS_DIR, 'manifest.json')),
    mnxDefs: new Set(Object.keys(mnxSchema.$defs ?? {})),
    // The trailing segment of the schema's $id: ".../mnx-schema.json/version/19".
    mnxSchemaVersion: /\/version\/(\d+)$/.exec(mnxSchema.$id ?? '')?.[1] ?? null,
    validateMnx: ajv.compile(mnxSchema),
    validateMeta: ajv.compile(metaSchema),
    validateNoteExt: ajv.getSchema(`${extSchema.$id}#/$defs/note-ext`),
    validatePartExt: ajv.getSchema(`${extSchema.$id}#/$defs/part-ext`),
    validateGlobalMeasureExt: ajv.getSchema(`${extSchema.$id}#/$defs/global-measure-ext`)
  };
}

/** Walks scenarios/: spec/<scenario> (depth 1) and lab/<category>/<scenario> (depth 2). */
export function loadCorpus() {
  const corpus = [];
  for (const ns of ['spec', 'lab']) {
    const nsDir = path.join(SCENARIOS_DIR, ns);
    if (!fs.existsSync(nsDir)) continue;
    if (ns === 'spec') {
      for (const dirName of listDirs(nsDir)) {
        corpus.push(makeScenario(ns, null, dirName));
      }
    } else {
      for (const categoryName of listDirs(nsDir)) {
        for (const dirName of listDirs(path.join(nsDir, categoryName))) {
          corpus.push(makeScenario(ns, categoryName, dirName));
        }
      }
    }
  }
  return corpus;
}

function listDirs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort();
}

function makeScenario(ns, categoryDir, dirName) {
  const segments = categoryDir === null ? [ns, dirName] : [ns, categoryDir, dirName];
  return {
    id: segments.map(stripPrefix).join('/'),
    ns,
    category: categoryDir === null ? null : `${ns}/${stripPrefix(categoryDir)}`,
    segments,
    dir: path.join(SCENARIOS_DIR, ...segments)
  };
}

/** Formats an Ajv error so pinned fragments can match path, schema location, or message. */
export function formatError(err) {
  return `${err.instancePath || '/'} [${err.schemaPath}] ${err.message}`;
}

/** Computes the `_x.mnxLab` verdict: 'n/a' when nothing carries one, else valid/invalid + errors. */
export function computeExtensionVerdict(doc, ctx) {
  const errors = [];
  let sawExtension = false;
  const check = (validator, value) => {
    sawExtension = true;
    if (!validator(value)) errors.push(...(validator.errors ?? []).map(formatError));
  };

  for (const measure of doc?.global?.measures ?? []) {
    if (measure?._x?.mnxLab !== undefined) {
      check(ctx.validateGlobalMeasureExt, measure._x.mnxLab);
    }
  }
  for (const part of doc?.parts ?? []) {
    if (part?._x?.mnxLab !== undefined) check(ctx.validatePartExt, part._x.mnxLab);
    for (const measure of part?.measures ?? []) {
      for (const seq of measure?.sequences ?? []) {
        for (const event of seq?.content ?? []) {
          for (const note of event?.notes ?? []) {
            if (note?._x?.mnxLab !== undefined) check(ctx.validateNoteExt, note._x.mnxLab);
          }
        }
      }
    }
  }
  if (!sawExtension) return { verdict: 'n/a', errors: [] };
  return { verdict: errors.length === 0 ? 'valid' : 'invalid', errors };
}

/** Returns { errors, warnings, meta } for one scenario. */
export function checkScenario(scenario, ctx) {
  const errors = [];
  const warnings = [];
  const fail = msg => errors.push(`${scenario.id}: ${msg}`);

  for (const seg of scenario.segments) {
    if (!SEGMENT_RE.test(seg)) fail(`folder segment "${seg}" must be (NN-)kebab-case`);
  }
  if (scenario.category !== null && !(scenario.category in (ctx.manifest.categories ?? {}))) {
    fail(`category "${scenario.category}" is not declared in scenarios/manifest.json`);
  }

  const entries = fs.readdirSync(scenario.dir);
  for (const entry of entries) {
    if (!ALLOWED_FILES.has(entry)) fail(`unexpected file "${entry}"`);
  }

  // meta.json
  let meta = null;
  const metaPath = path.join(scenario.dir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    fail('missing meta.json');
  } else {
    meta = checkJsonFile(metaPath, 'meta.json', fail);
    if (meta && !ctx.validateMeta(meta)) {
      for (const e of ctx.validateMeta.errors ?? []) fail(`meta.json: ${formatError(e)}`);
      meta = null;
    }
  }

  // score.mnx.json
  let doc = null;
  const scorePath = path.join(scenario.dir, 'score.mnx.json');
  if (!fs.existsSync(scorePath)) {
    fail('missing score.mnx.json');
  } else {
    doc = checkJsonFile(scorePath, 'score.mnx.json', fail);
  }

  // expected.primitives.json (generated, but still kept canonical)
  const primsPath = path.join(scenario.dir, 'expected.primitives.json');
  if (fs.existsSync(primsPath)) {
    checkJsonFile(primsPath, 'expected.primitives.json', fail);
  }

  if (!meta || !doc) return { errors, warnings, meta };

  // Which MNX schema is this scenario written against? Default is the published
  // one; `"schema": "proposed"` opts into a spec change we have drafted but the
  // CG has not adopted, so the corpus can prove a proposal works.
  const wantsProposed = meta.schema === 'proposed';
  if (wantsProposed && !ctx.proposedSchema) {
    fail(
      'declares "schema": "proposed" but schemas/mnx-schema.proposed.json is absent — ' +
        'generate it from the spec fork, or drop the declaration'
    );
    return { errors, warnings, meta };
  }
  const validateMnx = wantsProposed ? ctx.proposedSchema.validate : ctx.validateMnx;
  const knownDefs = wantsProposed ? ctx.proposedSchema.defs : ctx.mnxDefs;
  const schemaLabel = wantsProposed ? 'the PROPOSED MNX schema' : 'the MNX schema';

  // coversDefs typo check
  for (const def of meta.coversDefs ?? []) {
    if (!knownDefs.has(def)) fail(`coversDefs entry "${def}" is not a $def in ${schemaLabel}`);
  }

  // Verdicts, both directions
  const standardOk = validateMnx(doc);
  const standardErrors = standardOk ? [] : (validateMnx.errors ?? []).map(formatError);
  const standardVerdict = standardOk ? 'valid' : 'invalid';
  const ext = computeExtensionVerdict(doc, ctx);

  const isDraft = meta.status === 'draft';
  const verdictProblems = [];
  if (standardVerdict !== meta.expect.standard) {
    verdictProblems.push(
      `standard verdict is "${standardVerdict}" but expect.standard is "${meta.expect.standard}"` +
      (standardErrors.length ? ` — actual errors:\n    ${standardErrors.slice(0, 5).join('\n    ')}` : '')
    );
  }
  if (ext.verdict !== meta.expect.extension) {
    verdictProblems.push(
      `extension verdict is "${ext.verdict}" but expect.extension is "${meta.expect.extension}"` +
      (ext.errors.length ? ` — actual errors:\n    ${ext.errors.slice(0, 5).join('\n    ')}` : '')
    );
  }
  for (const p of verdictProblems) (isDraft ? warnings : errors).push(`${scenario.id}: ${p}`);

  // Pinned error fragments for invalid-by-design scenarios
  const expectsInvalid = meta.expect.standard === 'invalid' || meta.expect.extension === 'invalid';
  if (expectsInvalid) {
    const fragments = meta.expect.errors ?? [];
    if (fragments.length === 0) {
      fail('expect declares an invalid verdict but pins no expect.errors fragments');
    }
    const actual = [...standardErrors, ...ext.errors];
    for (const fragment of fragments) {
      if (!actual.some(e => e.includes(fragment))) {
        fail(`pinned error fragment "${fragment}" matches no actual validation error` +
          (actual.length ? ` — actual errors:\n    ${actual.slice(0, 8).join('\n    ')}` : ' (document validated clean)'));
      }
    }
  } else if ((meta.expect.errors ?? []).length > 0) {
    fail('expect.errors is set but both verdicts are expected valid');
  }

  // Status vs reality
  if (STATUS_ORDER[meta.status] >= STATUS_ORDER.rendered && meta.expect.standard === 'valid') {
    if (!fs.existsSync(path.join(scenario.dir, 'expected.primitives.json'))) {
      fail(`status "${meta.status}" requires expected.primitives.json (not yet generated)`);
    }
  }

  return { errors, warnings, meta };
}

function checkJsonFile(file, label, fail) {
  const raw = fs.readFileSync(file, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(`${label}: invalid JSON — ${e.message}`);
    return null;
  }
  const canonical = JSON.stringify(parsed, null, 2) + '\n';
  if (raw !== canonical) {
    fail(`${label}: not canonically formatted (2-space indent, trailing newline)`);
  }
  return parsed;
}

// ---------- CLI ----------
function main() {
  const ctx = createContext();
  const corpus = loadCorpus();
  if (corpus.length === 0) {
    console.error('No scenarios found under scenarios/.');
    process.exit(1);
  }

  let allErrors = [];
  let allWarnings = [];
  const statusCounts = {};
  const coveredDefs = new Set();

  for (const scenario of corpus) {
    const { errors, warnings, meta } = checkScenario(scenario, ctx);
    allErrors = allErrors.concat(errors);
    allWarnings = allWarnings.concat(warnings);
    if (meta) {
      statusCounts[meta.status] = (statusCounts[meta.status] ?? 0) + 1;
      for (const def of meta.coversDefs ?? []) coveredDefs.add(def);
    }
  }

  for (const w of allWarnings) console.warn(`WARN  ${w}`);
  for (const e of allErrors) console.error(`ERROR ${e}`);

  const statusSummary = Object.entries(STATUS_ORDER)
    .map(([s]) => `${s}: ${statusCounts[s] ?? 0}`)
    .join(', ');
  console.log(`\n${corpus.length} scenario(s) — ${statusSummary}`);
  console.log(`Defs coverage: ${coveredDefs.size} of ${ctx.mnxDefs.size} schema $defs referenced by coversDefs`);
  console.log(allErrors.length === 0 ? 'check-scenarios: OK' : `check-scenarios: ${allErrors.length} error(s)`);
  process.exit(allErrors.length === 0 ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
