import { defineConfig } from 'vitest/config';

// Standalone vitest config: its presence stops vitest from loading
// vite.config.ts, whose Cloudflare Workers plugin breaks under vitest.
// Converter sub-packages run their own vitest suites (npm -w <pkg> test).
export default defineConfig({
  test: {
    include: ['harness/**/*.test.ts'],
    // One temp directory per run, gone at teardown (harness/helpers/tempScope.ts).
    globalSetup: ['harness/helpers/tempScope.ts'],
    // Every file a test reads from disk must be one the landing gate would run it
    // for (harness/helpers/readAudit.ts, tools/gate.mjs).
    setupFiles: ['harness/helpers/readAudit.ts']
  }
});
