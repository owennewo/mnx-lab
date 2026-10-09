// The synth's deployable runtime (synth/scripts/build_app.mjs: its app page, the host and
// AudioWorklet code, the DSP and the data the host fetches), copied into a build's output
// directory. The site serves it at /synth/ (vite.config.ts synthShell); the embed ships it
// beside its script (vite.embed.config.ts), where the player finds it (setSynthBase).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export function copySynthRuntime(destination) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-synth-'));
  try {
    const out = path.join(staging, 'app');
    execFileSync(process.execPath, [path.join(ROOT, 'synth/scripts/build_app.mjs'), out], { stdio: 'inherit' });
    fs.cpSync(out, destination, { recursive: true });
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
