import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
it('rejects native backend imports from pure audio while admitting the browser harness', () => {
  const root = process.cwd(),
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-audio-fence-'));
  try {
    const config = require(path.join(root, '.dependency-cruiser.cjs'));
    fs.writeFileSync(
      path.join(fixture, 'rules.cjs'),
      `module.exports=${JSON.stringify({ forbidden: config.forbidden, options: { tsPreCompilationDeps: true } })}`,
    );
    for (const dir of ['src/audio/native', 'harness/browser'])
      fs.mkdirSync(path.join(fixture, dir), { recursive: true });
    fs.writeFileSync(path.join(fixture, 'src/audio/native/sink.ts'), 'export const native = 1;');
    fs.writeFileSync(
      path.join(fixture, 'src/audio/probe.ts'),
      "import {native} from './native/sink.ts'; console.log(native);",
    );
    fs.writeFileSync(
      path.join(fixture, 'harness/browser/probe.ts'),
      "import {native} from '../../src/audio/native/sink.ts'; console.log(native);",
    );
    const run = (file: string) =>
      spawnSync(
        process.execPath,
        [
          path.join(root, 'node_modules/dependency-cruiser/bin/dependency-cruise.mjs'),
          '--config',
          'rules.cjs',
          file,
        ],
        { cwd: fixture, encoding: 'utf8' },
      );
    const denied = run('src/audio/probe.ts');
    expect(denied.status).toBe(1);
    expect(denied.stdout).toContain('native-audio-only-at-browser-boundary');
    const allowed = run('harness/browser/probe.ts');
    expect(allowed.status).toBe(0);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
