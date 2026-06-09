// Precompiles schemas/mnx-schema.json into a standalone ESM validator module.
// Cloudflare Workers disallow runtime code generation (new Function), which
// ajv.compile() relies on — so the validator must be generated at build time.
// Output: worker/generated/validate-mnx.mjs (committed, regenerate on schema bump).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const schemaPath = path.join(root, 'schemas', 'mnx-schema.json');
const outDir = path.join(root, 'worker', 'generated');
const outPath = path.join(outDir, 'validate-mnx.mjs');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv2020.default({
  allErrors: true,
  code: { source: true, esm: true },
});

const validate = ajv.compile(schema);
const moduleCode = standaloneCode.default(ajv, validate);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, moduleCode);
console.log(`Wrote ${path.relative(root, outPath)} (${(moduleCode.length / 1024).toFixed(1)} kB)`);
