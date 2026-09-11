// Storage types come from wrangler.jsonc via worker/bindings.d.ts.
// Secrets come from .dev.vars locally and Worker secrets in production.
// Every library route rejects access when its token is absent.
export interface Env extends Pick<StorageBindings, 'LIBRARY_DB' | 'LIBRARY_BUCKET'> {
  LIBRARY_ACCESS_ISSUER?: string;
  LIBRARY_ACCESS_AUD?: string;
  LIBRARY_INGEST_AUD?: string;
  LIBRARY_INGEST_CLIENT_ID?: string;
  /** Local signed test identities only; never set on a deployed Worker. */
  LIBRARY_LOCAL_JWKS?: string;
  OPENROUTER_API_KEY?: string;
  LIBRARY_WRITE_TOKEN?: string;
}
