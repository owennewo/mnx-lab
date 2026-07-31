import { defineConfig } from 'vitest/config';

// Standalone vitest config: its presence stops vitest from loading
// vite.config.ts, whose Cloudflare Workers plugin breaks under vitest.
// Converter sub-packages run their own vitest suites (npm -w <pkg> test).
export default defineConfig({
  test: {
    include: ['harness/**/*.test.ts']
  }
});
