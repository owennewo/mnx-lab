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
// Run directly to renew (`node tools/library-local-auth.mjs`); the Vite dev
// server imports `renewLocalSessions` to do the same behind /__local-login.
// `--seed` also applies the D1 migrations locally and inserts the local user,
// so a fresh clone reaches a signed-in studio in one command (`npm run dev:login`).
import { generateKeyPair, exportJWK, importJWK, SignJWT } from 'jose';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const LOCAL_EMAIL = 'local@example.test';
export const LOCAL_USER_ID = 'operator';
export const SESSION_HOURS = 8;
const VARS = {
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
  const before = await readFile(file, 'utf8').catch(() => 'LIBRARY_WRITE_TOKEN=local-development-only\n');
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

/** Sign fresh local sessions; says whether .dev.vars changed (a new key —
 *  the running dev server must restart to trust it). */
export async function renewLocalSessions(root = new URL('../', import.meta.url)) {
  const { privateKey, publicJwk, created } = await signingKey(root);
  const varsChanged = await ensureDevVars(root, publicJwk);
  const sign = (machine) =>
    new SignJWT({ type: 'app', ...(machine ? { common_name: VARS.LIBRARY_INGEST_CLIENT_ID } : { email: LOCAL_EMAIL }) })
      .setProtectedHeader({ alg: 'RS256', kid: 'local' })
      .setIssuer(VARS.LIBRARY_ACCESS_ISSUER)
      .setAudience(machine ? VARS.LIBRARY_INGEST_AUD : VARS.LIBRARY_ACCESS_AUD)
      .setSubject(machine ? '' : 'local-user')
      .setIssuedAt()
      .setExpirationTime(`${SESSION_HOURS}h`)
      .sign(privateKey);
  const session = { browser: await sign(false), machine: await sign(true) };
  await mkdir(new URL('.secrets/', root), { mode: 0o700, recursive: true });
  const file = new URL('.secrets/local-library-session.json', root);
  await writeFile(file, JSON.stringify(session), { mode: 0o600 });
  await chmod(new URL('.secrets/', root), 0o700);
  await chmod(file, 0o600);
  return { session, keyCreated: created, varsChanged };
}

/** Local D1 only: apply the migrations and insert the local user. */
export function seedLocalUser(root = new URL('../', import.meta.url)) {
  const cwd = fileURLToPath(root);
  const run = (args) => {
    const result = spawnSync('npx', ['wrangler', ...args], { cwd, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`wrangler ${args.slice(0, 3).join(' ')} failed`);
  };
  run(['d1', 'migrations', 'apply', 'LIBRARY_DB', '--local']);
  const insert = `INSERT OR IGNORE INTO users (id, email, active, created_at) VALUES ('${LOCAL_USER_ID}', '${LOCAL_EMAIL}', 1, '${new Date().toISOString()}')`;
  run(['d1', 'execute', 'LIBRARY_DB', '--local', '--command', insert]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = new URL('../', import.meta.url);
  const { keyCreated, varsChanged } = await renewLocalSessions(root);
  if (process.argv.includes('--seed')) seedLocalUser(root);
  console.log(`Local test sessions (${SESSION_HOURS}h) saved under ${fileURLToPath(new URL('.secrets/', root))}.`);
  if (keyCreated) console.log('Created the local signing key (.secrets/local-library-signing-key.json).');
  console.log(varsChanged ? 'Updated .dev.vars — restart `npm run dev` so the Worker trusts the key.' : '.dev.vars unchanged — no restart needed.');
  if (!process.argv.includes('--seed')) console.log(`The local user must exist in LOCAL D1 (\`npm run dev:login\` seeds ${LOCAL_EMAIL}).`);
  console.log('Sign the browser in at http://localhost:5173/__local-login while `npm run dev` runs.');
}
