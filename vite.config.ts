import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [
    // Runs the Worker (worker/index.ts) inside the Vite dev server via
    // workerd, so `npm run dev` serves both the app and /api/* — no separate
    // Express process needed. Reads OPENROUTER_API_KEY from .dev.vars.
    cloudflare()
  ],
  build: {
    target: 'es2022',
    sourcemap: true
  },
  server: {
    port: 5173,
    host: true
  }
});
