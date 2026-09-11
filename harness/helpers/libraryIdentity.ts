import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import type { Env } from '../../worker/env.ts';
export async function testIdentity() {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'local-test', alg: 'RS256', use: 'sig' };
  const config: Partial<Env> = { LIBRARY_ACCESS_ISSUER: 'urn:mnx-library-local', LIBRARY_ACCESS_AUD: 'browser-test', LIBRARY_INGEST_AUD: 'machine-test', LIBRARY_INGEST_CLIENT_ID: 'test-client.access', LIBRARY_LOCAL_JWKS: JSON.stringify({ keys: [jwk] }) };
  const sign = (claims: Record<string, unknown> = {}, machine = false) => new SignJWT({ type: 'app', ...(machine ? { common_name: config.LIBRARY_INGEST_CLIENT_ID } : { email: 'owner@example.test' }), ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'local-test' }).setIssuer(config.LIBRARY_ACCESS_ISSUER!).setAudience(machine ? config.LIBRARY_INGEST_AUD! : config.LIBRARY_ACCESS_AUD!).setSubject(machine ? '' : 'test-subject').setIssuedAt().setExpirationTime('1h').sign(privateKey);
  return { config, sign, privateKey };
}
