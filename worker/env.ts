// Worker bindings. OPENROUTER_API_KEY comes from .dev.vars locally and a
// Worker secret (`wrangler secret put OPENROUTER_API_KEY`) in production.
export interface Env {
  OPENROUTER_API_KEY?: string;
}
