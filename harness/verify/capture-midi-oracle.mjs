// External evidence refresh, deliberately separate from report regeneration.
// No shell interpolation, user settings, network fetches or runtime app dependency.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'vite';
const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, 'harness/fixtures/midi-oracle');
const binary = process.env.MUSESCORE_BIN || 'musescore';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-musescore-'));
const env = {
  ...process.env,
  QT_QPA_PLATFORM: 'offscreen',
  XDG_CONFIG_HOME: path.join(temp, 'config'),
  XDG_DATA_HOME: path.join(temp, 'data'),
  XDG_CACHE_HOME: path.join(temp, 'cache'),
};
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const run = (args) => {
  const p = spawnSync(binary, args, {
    env,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (p.error || p.status !== 0)
    throw Error(`MuseScore ${args.join(' ')}: ${p.error?.message ?? p.stderr ?? p.status}`);
  return p.stdout + '\n' + p.stderr;
};
let vite;
try {
  vite = await createServer({
    root,
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
    appType: 'custom',
  });
  const { musescoreImportedEvidence } = await vite.ssrLoadModule('/harness/helpers/midiOracle.ts');
  const imports = new Set([
    'w3c/beams-inner-grace-notes',
    'w3c/jumps-dal-segno',
    'w3c/jumps-ds-al-fine',
    'w3c/repeats-alternate-endings-simple',
    'w3c/repeats-alternate-endings-advanced',
  ]);
  const version = run(['--version']).match(/MuseScore4\s+([\d.]+)/)?.[1];
  if (version !== '4.7.5')
    throw Error(`Expected MuseScore 4.7.5, got ${version}; review a version change explicitly.`);
  const build = run(['--long-version']).match(/Build ([a-zA-Z0-9]+)/)?.[1];
  if (build !== '3654226') throw Error(`Expected MuseScore build 3654226, got ${build}.`);
  const pairs = [
    ...fs
      .readdirSync(path.join(root, 'converters/fixtures/w3c-comparisons'))
      .filter((f) => f.endsWith('.musicxml'))
      .sort()
      .map((f) => ({
        id: 'w3c/' + f.slice(0, -9),
        xml: 'converters/fixtures/w3c-comparisons/' + f,
        mnx: 'scenarios/spec/' + f.slice(0, -9) + '/document.mnx.json',
      })),
    ...fs
      .readdirSync(path.join(root, 'converters/fixtures'))
      .filter((f) => f.endsWith('.xml'))
      .sort()
      .map((f) => ({
        id: 'converter/' + f.slice(0, -4),
        xml: 'converters/fixtures/' + f,
        mnx: 'converters/fixtures/' + f.slice(0, -4) + '.mnx.json',
      })),
  ];
  const manifest = {
    formatVersion: 1,
    tool: {
      name: 'MuseScore Studio',
      version,
      build,
      platform: 'Linux x86_64',
      release: 'https://github.com/musescore/MuseScore/releases/tag/v4.7.5',
      appImageSha256: 'a31b2da2dbcc2191bcc98beb7be5c15f2f517bedb3444def96fe3088b74d3a1e',
      arguments: ['-o', 'OUTPUT.mid', 'INPUT.musicxml'],
      environment: 'QT_QPA_PLATFORM=offscreen; fresh XDG config/data/cache per capture',
    },
    cases: [],
  };
  for (const pair of pairs) {
    const name = pair.id.replace('/', '--') + '.mid',
      dest = path.join(temp, name);
    run(['-o', dest, path.join(root, pair.xml)]);
    const bytes = fs.readFileSync(dest);
    if (bytes.subarray(0, 4).toString() !== 'MThd') throw Error('Invalid export: ' + pair.id);
    let imported = {};
    if (imports.has(pair.id)) {
      const file = pair.id.replace('/', '--') + '.import.json',
        mscx = path.join(temp, 'import.mscx');
      run(['-o', mscx, path.join(root, pair.xml)]);
      const receipt =
        JSON.stringify(musescoreImportedEvidence(fs.readFileSync(mscx, 'utf8')), null, 2) + '\n';
      fs.writeFileSync(path.join(temp, file), receipt);
      imported = { importedEvidence: file, importedSha256: hash(Buffer.from(receipt)) };
    }
    manifest.cases.push({
      ...pair,
      inputSha256: hash(fs.readFileSync(path.join(root, pair.xml))),
      midi: name,
      midiSha256: hash(bytes),
      ...imported,
    });
    console.log(pair.id);
  }
  // Stage all successful exports before touching committed evidence.
  fs.mkdirSync(output, { recursive: true });
  const files = manifest.cases.flatMap((r) => [
    r.midi,
    ...(r.importedEvidence ? [r.importedEvidence] : []),
  ]);
  fs.writeFileSync(path.join(temp, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  files.push('manifest.json');
  if (process.argv.includes('--check')) {
    for (const file of files)
      if (
        !fs.existsSync(path.join(output, file)) ||
        !fs.readFileSync(path.join(temp, file)).equals(fs.readFileSync(path.join(output, file)))
      )
        throw Error('External evidence changed: ' + file);
  } else for (const file of files) fs.copyFileSync(path.join(temp, file), path.join(output, file));
  console.log(
    `${process.argv.includes('--check') ? 'Verified' : 'Captured'} ${manifest.cases.length} performances with MuseScore ${version}.`,
  );
} finally {
  await vite?.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
