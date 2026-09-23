// A private library for one smoke: wrangler's own dev server (the same config,
// assets, _headers and Worker as `wrangler dev`), run in-process on a free
// port over a throwaway D1/R2 that holds only the local user, trusting a key
// made for this run. Nothing to start by hand, no fixed port to collide on,
// no worktree state touched, and nothing left running: `close()` stops it and
// the reaper covers a smoke killed before it could.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPair, exportJWK } from 'jose';
import { unstable_dev, getPlatformProxy, unstable_splitSqlQuery } from 'wrangler';
import { VARS, LOCAL_WRITE_TOKEN, signLocalSessions, localUserInsert } from '../../tools/library-local-auth.mjs';
import { startReaper } from './reaper.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** A killed smoke's state outlives it; its folder names the pid that made it. */
function sweepStaleState() {
  for (const name of fs.readdirSync(os.tmpdir())) {
    const pid = Number(name.match(/^mnx-library-(\d+)-/)?.[1]);
    if (!pid) continue;
    try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') fs.rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true }); }
  }
}

/** Start it; resolves once it answers. Needs `dist/client` (npm run build). */
export async function startLocalLibrary() {
  startReaper();
  sweepStaleState();
  const state = fs.mkdtempSync(path.join(os.tmpdir(), `mnx-library-${process.pid}-`));
  try {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'local', alg: 'RS256', use: 'sig' };
    const config = path.join(ROOT, 'wrangler.jsonc');
    // Seed through the same persistence the server then opens.
    const proxy = await getPlatformProxy({ configPath: config, persist: { path: path.join(state, 'v3') }, envFiles: [] });
    try {
      const db = proxy.env.LIBRARY_DB;
      for (const name of fs.readdirSync(path.join(ROOT, 'migrations')).filter(n => n.endsWith('.sql')).sort()) {
        await db.batch(unstable_splitSqlQuery(fs.readFileSync(path.join(ROOT, 'migrations', name), 'utf8')).map(sql => db.prepare(sql)));
      }
      await db.prepare(localUserInsert()).run();
    } finally {
      await proxy.dispose();
    }
    const worker = await unstable_dev(path.join(ROOT, 'worker/index.ts'), {
      config,
      assets: path.join(ROOT, 'dist/client'),
      ip: '127.0.0.1',
      port: 0,
      persistTo: state,
      // Otherwise wrangler rewrites the hostname to the production route, and
      // the Worker rightly refuses a local identity there (untyped, passed through).
      localUpstream: 'localhost',
      envFiles: [],
      vars: { ...VARS, LIBRARY_LOCAL_JWKS: JSON.stringify({ keys: [jwk] }), LIBRARY_WRITE_TOKEN: LOCAL_WRITE_TOKEN },
      logLevel: 'warn',
      experimental: { disableExperimentalWarning: true, disableDevRegistry: true },
    });
    let closed = false;
    return {
      origin: `http://127.0.0.1:${worker.port}`,
      session: await signLocalSessions(privateKey),
      writeToken: LOCAL_WRITE_TOKEN,
      async close() {
        if (closed) return;
        closed = true;
        await worker.stop();
        fs.rmSync(state, { recursive: true, force: true });
      },
    };
  } catch (error) {
    fs.rmSync(state, { recursive: true, force: true });
    throw error;
  }
}
