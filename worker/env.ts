// Storage types come from wrangler.jsonc via worker/bindings.d.ts.
// Secrets come from .dev.vars locally and Worker secrets in production.
// The ingest route (item 2/3) must reject writes when its token is absent.
export interface Env extends Pick<StorageBindings, 'LIBRARY_DB' | 'LIBRARY_BUCKET'> {
  OPENROUTER_API_KEY?: string;
  LIBRARY_WRITE_TOKEN?: string;
}
