// Type-check harness/ — part of `npm run build`.
//
// `tsc -p harness` alone cannot be the check: the library tests import the Worker
// (worker/index.ts, worker/library/*), so its sources join the harness program and
// are judged against the harness's environment — the DOM lib and Node's types —
// where the web-stream types Hono speaks and the ones @cloudflare/workers-types
// declares for R2 are two different declarations. Under `tsc -p worker` they are
// one. So the Worker is judged where it runs (`tsc -p worker`, also in the build),
// and its diagnostics are dropped here; every other file's — the harness's own and
// the src/ it imports — fail the build.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const WORKER = path.join(ROOT, 'worker') + path.sep;

const host = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n')); } };
const config = ts.getParsedCommandLineOfConfigFile(path.join(ROOT, 'harness/tsconfig.json'), {}, host);
const program = ts.createProgram({ rootNames: config.fileNames, options: config.options, projectReferences: config.projectReferences });
const all = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
const kept = all.filter(d => !d.file || !path.resolve(d.file.fileName).startsWith(WORKER));

const format = { getCanonicalFileName: f => f, getCurrentDirectory: () => ROOT, getNewLine: () => '\n' };
if (kept.length) {
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(kept, format));
  console.error(`\nharness type check: ${kept.length} error(s)`);
  process.exitCode = 1;
} else {
  console.log(`harness type check: clean (${all.length - kept.length} diagnostic(s) in worker/ left to tsc -p worker)`);
}
