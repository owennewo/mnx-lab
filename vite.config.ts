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
  environments: {
    // Scoped to the client build only — the Worker has its own entry.
    client: {
      build: {
        rollupOptions: {
          input: {
            main: 'index.html',
            // The embeddability demo (a mock third-party host page).
            embed: 'embed.html'
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true
  }
});
