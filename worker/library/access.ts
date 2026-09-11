// Access proves identity; D1 membership remains authoritative on every request.
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from '../env.ts';

export interface LibraryUser { id: string; email: string }
export class AccessError extends Error {
  constructor(readonly status: 401 | 403 | 503) { super('Library authentication failed'); }
}
// Only public verification keys are cached, never users or authorization decisions.
const remoteKeys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function accessIdentity(request: Request, env: Env, machine: boolean): Promise<LibraryUser> {
  const issuer = env.LIBRARY_ACCESS_ISSUER;
  const audience = machine ? env.LIBRARY_INGEST_AUD : env.LIBRARY_ACCESS_AUD;
  const local = issuer === 'urn:mnx-library-local' && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
  if (!issuer || !audience || (!local && !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer))) throw new AccessError(503);
  let token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (local && !token) token = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(request.headers.get('Cookie') ?? '')?.[1] ?? null;
  if (!token || token.length > 16384) throw new AccessError(401);
  let payload;
  try {
    let keys;
    if (local) {
      if (!env.LIBRARY_LOCAL_JWKS) throw new AccessError(503);
      keys = createLocalJWKSet(JSON.parse(env.LIBRARY_LOCAL_JWKS));
    } else {
      keys = remoteKeys.get(issuer);
      if (!keys) { keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), { timeoutDuration: 5000 }); remoteKeys.set(issuer, keys); }
    }
    ({ payload } = await jwtVerify(token, keys, { issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub'], clockTolerance: 0 }));
    if (payload.type !== 'app' || typeof payload.iat !== 'number' || payload.iat > Date.now() / 1000) throw new AccessError(401);
  } catch (error) { if (error instanceof AccessError) throw error; throw new AccessError(401); }
  let user;
  try {
    if (machine) {
      if (!env.LIBRARY_INGEST_CLIENT_ID || payload.common_name !== env.LIBRARY_INGEST_CLIENT_ID || payload.sub !== '' || payload.email) throw new AccessError(403);
      user = await env.LIBRARY_DB.prepare('SELECT id,email FROM users WHERE id=? AND active=1').bind('operator').first<LibraryUser>();
    } else {
      if (typeof payload.email !== 'string' || !payload.sub || payload.common_name) throw new AccessError(403);
      user = await env.LIBRARY_DB.prepare('SELECT id,email FROM users WHERE email=? AND active=1').bind(payload.email.trim().toLowerCase()).first<LibraryUser>();
    }
  } catch (error) { if (error instanceof AccessError) throw error; throw new AccessError(503); }
  if (!user) throw new AccessError(403);
  return user;
}
