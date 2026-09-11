// Local signed identities only. Produces no production credential or public route.
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(publicKey), kid: 'local', alg: 'RS256', use: 'sig' };
const vars = { LIBRARY_ACCESS_ISSUER: 'urn:mnx-library-local', LIBRARY_ACCESS_AUD: 'local-browser', LIBRARY_INGEST_AUD: 'local-machine', LIBRARY_INGEST_CLIENT_ID: 'local.access', LIBRARY_LOCAL_JWKS: JSON.stringify({ keys: [jwk] }) };
let content = await readFile(new URL('.dev.vars', root), 'utf8').catch(() => 'LIBRARY_WRITE_TOKEN=local-development-only\n');
for (const key of Object.keys(vars)) content = content.replace(new RegExp(`^${key}=.*\\n?`, 'gm'), '');
content += '\n' + Object.entries(vars).map(([k,v]) => `${k}='${v}'`).join('\n') + '\n';
await writeFile(new URL('.dev.vars', root), content, { mode: 0o600 });
const sign = machine => new SignJWT({ type: 'app', ...(machine ? { common_name: 'local.access' } : { email: 'local@example.test' }) })
  .setProtectedHeader({ alg: 'RS256', kid: 'local' }).setIssuer(vars.LIBRARY_ACCESS_ISSUER).setAudience(machine ? vars.LIBRARY_INGEST_AUD : vars.LIBRARY_ACCESS_AUD).setSubject(machine ? '' : 'local-user').setIssuedAt().setExpirationTime('8h').sign(privateKey);
await mkdir(new URL('.secrets/', root), { mode: 0o700, recursive: true });
await writeFile(new URL('.secrets/local-library-session.json', root), JSON.stringify({ browser: await sign(false), machine: await sign(true) }), { mode: 0o600 });
await chmod(new URL('.dev.vars', root), 0o600);
await chmod(new URL('.secrets/', root), 0o700);
await chmod(new URL('.secrets/local-library-session.json', root), 0o600);
console.log(`Local test sessions saved under ${fileURLToPath(new URL('.secrets/', root))}; seed local@example.test in LOCAL D1 only. Restart dev after regenerating.`);
