// Precompiles JSON Schema validators into standalone ESM modules.
// Cloudflare Workers disallow runtime code generation (new Function), which
// ajv.compile() relies on — so validators must be generated at build time.
//
// Outputs (committed; regenerate on schema bump):
//   worker/generated/validate-mnx.mjs         — official MNX schema (default export)
//   worker/generated/validate-extensions.mjs  — `_x.mnxLab` extension v3 sub-validators
//     (named exports: validateNoteExt, validatePartExt, validateGlobalMeasureExt)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'worker', 'generated');
fs.mkdirSync(outDir, { recursive: true });

function loadSchema(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, 'schemas', rel), 'utf8'));
}

function writeModule(rel, code) {
  const outPath = path.join(outDir, rel);
  fs.writeFileSync(outPath, code);
  console.log(`Wrote ${path.relative(root, outPath)} (${(code.length / 1024).toFixed(1)} kB)`);
}

// 1. Official MNX schema → default-export validator
{
  const ajv = new Ajv2020.default({
    allErrors: true,
    code: { source: true, esm: true },
  });
  const validate = ajv.compile(loadSchema('mnx-schema.json'));
  writeModule('validate-mnx.mjs', standaloneCode.default(ajv, validate));
}

// 2. `_x.mnxLab` extensions v3 → named-export sub-validators for the three
//    placement points (note, part, global measure). The extension schema is a
//    $defs library; the worker walks the document and validates each vendor
//    dict. Validating the WHOLE dict rather than each feature block also
//    catches a misspelled sibling key, which a per-block walk cannot.
{
  const ajv = new Ajv2020.default({
    allErrors: true,
    code: { source: true, esm: true },
  });
  const extSchema = loadSchema('mnx-lab-extensions.schema.json');
  ajv.addSchema(extSchema);
  const base = extSchema.$id;
  writeModule(
    'validate-extensions.mjs',
    standaloneCode.default(ajv, {
      validateNoteExt: `${base}#/$defs/note-ext`,
      validatePartExt: `${base}#/$defs/part-ext`,
      validateGlobalMeasureExt: `${base}#/$defs/global-measure-ext`,
    })
  );
}
