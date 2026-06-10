import { defineConfig } from 'vitest/config';

// Standalone vitest config: its presence stops vitest from loading
// vite.config.ts, whose Cloudflare Workers plugin breaks under vitest.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts']
  }
});
