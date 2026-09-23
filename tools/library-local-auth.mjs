// Local signed identities only. Produces no production credential or public route.
//
// Two jobs, both loopback-only by construction (worker/library/access.ts honours
// this issuer on localhost alone):
//   · TRUST — a signing key pair under .secrets/, its PUBLIC half written into
//     .dev.vars as LIBRARY_LOCAL_JWKS. The key is created once and reused, so
//     renewing a session never changes .dev.vars and never needs a dev restart.
//   · SESSIONS — eight-hour browser and machine tokens in
//     .secrets/local-library-session.json, re-signed on every run.
//
// `npm run dev` does all of this itself on start (`prepareLocalLibrary`) and
// signs a studio page in without being asked, so a fresh worktree reaches a
// signed-in studio with no step of its own. Run directly (`npm run dev:login`)
// only to renew the sessions for a CLI such as the ingest tool; `--seed` also
// brings the local D1 up to date.
import { generateKeyPair, exportJWK, importJWK, SignJWT } from 'jose';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LOCAL_EMAIL = 'local@example.test';
export const LOCAL_USER_ID = 'operator';
export const SESSION_HOURS = 8;
/** The ingest bearer token `.dev.vars` starts with; local only. */
export const LOCAL_WRITE_TOKEN = 'local-development-only';
export const VARS = {
  LIBRARY_ACCESS_ISSUER: 'urn:mnx-library-local',
  LIBRARY_ACCESS_AUD: 'local-browser',
  LIBRARY_INGEST_AUD: 'local-machine',
  LIBRARY_INGEST_CLIENT_ID: 'local.access',
};

function publicOf(jwk) {
  const { kty, n, e, kid, alg, use } = jwk;
  return { kty, n, e, kid, alg, use };
}

/** The persistent local signing key: read it, or create it once. */
async function signingKey(root) {
  const file = new URL('.secrets/local-library-signing-key.json', root);
  try {
    const jwk = JSON.parse(await readFile(file, 'utf8'));
    return { privateKey: await importJWK(jwk, 'RS256'), publicJwk: publicOf(jwk), created: false };
  } catch {
    const { privateKey } = await generateKeyPair('RS256', { extractable: true });
    const jwk = { ...(await exportJWK(privateKey)), kid: 'local', alg: 'RS256', use: 'sig' };
    await mkdir(new URL('.secrets/', root), { mode: 0o700, recursive: true });
    await writeFile(file, JSON.stringify(jwk), { mode: 0o600 });
    await chmod(file, 0o600);
    return { privateKey, publicJwk: publicOf(jwk), created: true };
  }
}

/** Write the local trust into .dev.vars — only when a line would change. */
async function ensureDevVars(root, publicJwk) {
  const file = new URL('.dev.vars', root);
  const vars = { ...VARS, LIBRARY_LOCAL_JWKS: JSON.stringify({ keys: [publicJwk] }) };
  const before = await readFile(file, 'utf8').catch(() => `LIBRARY_WRITE_TOKEN=${LOCAL_WRITE_TOKEN}\n`);
  const valueOf = (key) => {
    const line = before.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1];
    return line === undefined ? undefined : line.replace(/^'(.*)'$/, '$1');
  };
  if (Object.entries(vars).every(([k, v]) => valueOf(k) === v)) return false;
  let content = before;
  for (const key of Object.keys(vars)) content = content.replace(new RegExp(`^${key}=.*\\n?`, 'gm'), '');
  content = content.replace(/\n*$/, '\n\n') + Object.entries(vars).map(([k, v]) => `${k}='${v}'`).join('\n') + '\n';
  await writeFile(file, content, { mode: 0o600 });
  await chmod(file, 0o600);
  return true;
}

/** The session file's browser token expiry, in ms since the epoch — or null. */
export async function localSessionExpiry(root = new URL('../', import.meta.url)) {
  try {
    const session = JSON.parse(await readFile(new URL('.secrets/local-library-session.json', root), 'utf8'));
    const [, body] = String(session.browser).split('.');
    const { exp } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** A browser and a machine token for the local user, signed with `privateKey`
 *  (kid `local`). The smokes' private library signs with a key of its own. */
export async function signLocalSessions(privateKey) {
  const sign = (machine) =>
    new SignJWT({ type: 'app', ...(machine ? { common_name: VARS.LIBRARY_INGEST_CLIENT_ID } : { email: LOCAL_EMAIL }) })
      .setProtectedHeader({ alg: 'RS256', kid: 'local' })
      .setIssuer(VARS.LIBRARY_ACCESS_ISSUER)
      .setAudience(machine ? VARS.LIBRARY_INGEST_AUD : VARS.LIBRARY_ACCESS_AUD)
      .setSubject(machine ? '' : 'local-user')
      .setIssuedAt()
      .setExpirationTime(`${SESSION_HOURS}h`)
      .sign(privateKey);
  return { browser: await sign(false), machine: await sign(true) };
}

/** Sign fresh local sessions; says whether .dev.vars changed (a new key —
 *  the running dev server must restart to trust it). */
export async function renewLocalSessions(root = new URL('../', import.meta.url)) {
  const { privateKey, publicJwk, created } = await signingKey(root);
  const varsChanged = await ensureDevVars(root, publicJwk);
  const session = await signLocalSessions(privateKey);
  await mkdir(new URL('.secrets/', root), { mode: 0o700, recursive: true });
  const file = new URL('.secrets/local-library-session.json', root);
  await writeFile(file, JSON.stringify(session), { mode: 0o600 });
  await chmod(new URL('.secrets/', root), 0o700);
  await chmod(file, 0o600);
  return { session, keyCreated: created, varsChanged };
}

/**
 * Local D1 only: apply the migrations not yet applied and make the local user
 * exist. In-process through wrangler's own platform proxy (well under a second,
 * where two `wrangler d1` runs took ~6.5s), recording each migration in
 * wrangler's `d1_migrations` table exactly as `wrangler d1 migrations apply
 * --local` would, so the two always agree. `persistPath` defaults to the
 * checkout's `.wrangler/state/v3`, the state `npm run dev` serves.
 */
export async function seedLocalLibrary(root = new URL('../', import.meta.url), { persistPath } = {}) {
  const { getPlatformProxy, unstable_splitSqlQuery } = await import('wrangler');
  const dir = fileURLToPath(root);
  const proxy = await getPlatformProxy({
    configPath: path.join(dir, 'wrangler.jsonc'),
    persist: { path: persistPath ?? path.join(dir, '.wrangler/state/v3') },
    envFiles: [],
  });
  try {
    const db = proxy.env.LIBRARY_DB;
    await db.prepare(`CREATE TABLE IF NOT EXISTS "d1_migrations"(
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)`).run();
    const applied = new Set((await db.prepare('SELECT name FROM "d1_migrations"').all()).results.map(r => r.name));
    const pending = fs.readdirSync(path.join(dir, 'migrations')).filter(n => n.endsWith('.sql') && !applied.has(n)).sort();
    for (const name of pending) {
      const sql = unstable_splitSqlQuery(fs.readFileSync(path.join(dir, 'migrations', name), 'utf8'));
      await db.batch([...sql.map(q => db.prepare(q)), db.prepare('INSERT INTO "d1_migrations" (name) VALUES (?)').bind(name)]);
    }
    await db.prepare(localUserInsert()).run();
    return { applied: pending };
  } finally {
    await proxy.dispose();
  }
}

/** Everything `npm run dev` needs before its Worker starts: the trust in
 *  `.dev.vars` (so no restart is ever asked for), live sessions, and a local
 *  D1 at the latest migration with the local user in it. */
export async function prepareLocalLibrary(root = new URL('../', import.meta.url)) {
  const expiry = await localSessionExpiry(root);
  // Re-sign only when it matters: the sessions file is what /__local-login reads.
  if (!expiry || expiry - Date.now() < 60 * 60 * 1000) await renewLocalSessions(root);
  else await ensureDevVars(root, (await signingKey(root)).publicJwk);
  return seedLocalLibrary(root);
}

/** The statement that makes the local user exist. */
export function localUserInsert() {
  return `INSERT OR IGNORE INTO users (id, email, active, created_at) VALUES ('${LOCAL_USER_ID}', '${LOCAL_EMAIL}', 1, '${new Date().toISOString()}')`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = new URL('../', import.meta.url);
  const { keyCreated, varsChanged } = await renewLocalSessions(root);
  if (process.argv.includes('--seed')) {
    const { applied } = await seedLocalLibrary(root);
    console.log(`Local D1: ${applied.length ? `applied ${applied.join(', ')}` : 'up to date'}; ${LOCAL_EMAIL} present.`);
  }
  console.log(`Local test sessions (${SESSION_HOURS}h) saved under ${fileURLToPath(new URL('.secrets/', root))}.`);
  if (keyCreated) console.log('Created the local signing key (.secrets/local-library-signing-key.json).');
  if (varsChanged) console.log('Updated .dev.vars — restart a running `npm run dev` so the Worker trusts the key.');
  console.log('`npm run dev` does this on start and signs studio in by itself; this is only needed for a CLI.');
}
