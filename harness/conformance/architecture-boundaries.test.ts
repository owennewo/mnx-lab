import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);

it('checks real forbidden graphs and admits supported architecture seams', () => {
  const root = process.cwd();
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-architecture-'));
  const write = (file: string, source = 'export const value = 1;') => {
    fs.mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true });
    fs.writeFileSync(path.join(fixture, file), source);
  };
  const edge = (from: string, to: string) => {
    const relative = path.relative(path.dirname(from), to).replaceAll('\\', '/');
    write(from, `import '${relative.startsWith('.') ? relative : `./${relative}`}';`);
  };
  try {
    const config = require(path.join(root, '.dependency-cruiser.cjs'));
    // Exercise the same source roots/options as the build, including experiment discovery.
    write('.dependency-cruiser.cjs', `module.exports=${JSON.stringify({
      ...config, options: { ...config.options, tsConfig: undefined },
    })}`);
    for (const dir of ['src', 'worker', 'harness', 'apps', 'converters', 'experiments'])
      fs.mkdirSync(path.join(fixture, dir), { recursive: true });
    const command = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
      .scripts['check:boundaries'].split(' ').slice(1);
    const run = () => spawnSync(process.execPath, [
      path.join(root, 'node_modules/dependency-cruiser/bin/dependency-cruise.mjs'),
      ...command,
    ], { cwd: fixture, encoding: 'utf8', timeout: 20_000 });

    write('converters/example/index.ts');
    write('src/edit/session.ts');
    write('src/engine/layout.ts');
    write('node_modules/alphatab/package.json', '{"name":"alphatab","main":"index.js"}');
    write('node_modules/alphatab/index.js');
    edge('src/model/probe.ts', 'converters/example/index.ts');
    write('apps/studio/probe.ts', "import 'alphatab';");
    write('apps/studio/node_modules/@coderline/alphatab/package.json', '{"name":"@coderline/alphatab","main":"index.js"}');
    write('apps/studio/node_modules/@coderline/alphatab/index.js');
    write('apps/studio/nested.ts', "import '@coderline/alphatab';");
    write('src/workbench/main.ts');
    edge('converters/example/shell.ts', 'src/workbench/main.ts');
    edge('src/elements/DocumentViewer.ts', 'src/edit/session.ts');
    edge('src/elements/Player.ts', 'src/elements/shared.ts');
    edge('src/elements/shared.ts', 'src/edit/session.ts');
    edge('experiments/performance-listening/probe.mjs', 'src/engine/layout.ts');
    const denied = run();
    expect(denied.status, denied.stdout + denied.stderr).not.toBe(0);
    for (const [rule, from] of [
      ['model-is-the-floor', 'src/model/probe.ts'],
      ['alphatab-only-in-file-codecs', 'apps/studio/probe.ts'],
      ['alphatab-only-in-file-codecs', 'apps/studio/nested.ts'],
      ['nothing-imports-the-shells', 'converters/example/shell.ts'],
      ['viewer-and-player-do-not-reach-editor', 'src/elements/DocumentViewer.ts'],
      ['viewer-and-player-do-not-reach-editor', 'src/elements/Player.ts'],
      ['listening-bench-consumes-audio-and-model-only', 'experiments/performance-listening/probe.mjs'],
    ]) expect(denied.stdout).toContain(`${rule}: ${from}`);

    for (const file of ['src/model/probe.ts', 'apps/studio/probe.ts', 'apps/studio/nested.ts', 'converters/example/shell.ts',
      'src/elements/DocumentViewer.ts', 'src/elements/shared.ts',
      'experiments/performance-listening/probe.mjs']) write(file);
    edge('src/importers/probe.ts', 'converters/example/index.ts');
    edge('src/elements/editorHost.ts', 'src/edit/session.ts');
    write('src/elements/editorSelection.ts', "import type { Session } from '../edit/types.ts'; export type Selection = Session;");
    write('src/edit/types.ts', 'export interface Session { id: string }');
    write('worker/generated/validator.js');
    edge('src/model/validator.ts', 'worker/generated/validator.js');
    edge('experiments/performance-listening/probe.mjs', 'src/model/probe.ts');
    edge('apps/studio/probe.ts', 'apps/studio/shared.ts');
    write('apps/studio/shared.ts');
    write('converters/example/oracle.ts', "import 'alphatab';");
    // These generated/installed trees must never become additional source entry points.
    edge('experiments/performance-listening/output/bundle.js', 'src/engine/layout.ts');
    edge('experiments/performance-listening/node_modules/tool/index.js', 'src/engine/layout.ts');
    const allowed = run();
    expect(allowed.status, allowed.stdout + allowed.stderr).toBe(0);
    expect(allowed.stdout).toContain('no dependency violations found');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}, 50_000);
