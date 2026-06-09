import { defineConfig } from 'vitest/config';

// Present so vitest doesn't walk up and load the repo root's vite.config.ts
// (which carries the Cloudflare Workers plugin — irrelevant and incompatible
// here).
export default defineConfig({
  test: {}
});
