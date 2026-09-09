// Reproducible embed comparison. Keep exports so tree shaking cannot erase playback.
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { build, loadConfigFromFile, mergeConfig } from 'vite';
const root = process.cwd(),
  scratch = fs.mkdtempSync(path.join(root, '.audio-cost-'));
try {
  const loaded = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    path.join(root, 'vite.embed.config.ts'),
  );
  const result = {};
  for (const [name, extra] of Object.entries({
    viewer: '',
    sink: "export { NativeSink, nativeClock } from '../src/audio/native/sink.ts';",
    player:
      "export { NativeSink, nativeClock } from '../src/audio/native/sink.ts';\nexport { Transport } from '../src/audio/transport.ts';\nexport { compilePerformance } from '../src/audio/performance.ts';",
  })) {
    const entry = path.join(scratch, `${name}.ts`),
      outDir = path.join(scratch, name);
    fs.writeFileSync(entry, `import '../src/entries/embed.ts';\n${extra}\n`);
    await build(
      mergeConfig(loaded.config, {
        configFile: false,
        logLevel: 'error',
        build: { outDir, copyPublicDir: false, lib: { entry } },
      }),
    );
    result[name] = {};
    for (const [format, file] of [
      ['iife', 'mnx-lab.js'],
      ['esm', 'mnx-lab.esm.js'],
    ]) {
      const bytes = fs.readFileSync(path.join(outDir, file));
      result[name][format] = { raw: bytes.length, gzip: gzipSync(bytes).length };
    }
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
