import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dev-only middleware serving the spec's reference engravings from the pinned
 * vendor/mnx checkout at /spec-media/<slug>.png — the compare view's right
 * pane. Strictly dev-time: the submodule never reaches a build or deploy
 * (the deployed compare pane degrades to a note), and this is read-only —
 * the sanctioned "ephemeral file API" pattern from structure-lab, minus even
 * the writes.
 */
function specMedia(): Plugin {
  let bySlug: Map<string, string> | null = null;
  const load = async () => {
    if (bySlug) return bySlug;
    const { loadSpecExamples } = await import('./spec/tools/specSource.mjs');
    const mnxSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'spec/mnx-schema.json'), 'utf8'));
    const defs = new Set(Object.keys(mnxSchema.$defs ?? {}));
    const { examples } = loadSpecExamples(defs);
    bySlug = new Map(
      examples
        .filter((e: { imagePath: string | null }) => e.imagePath)
        .map((e: { slug: string; imagePath: string }) => [e.slug, e.imagePath])
    );
    return bySlug;
  };
  return {
    name: 'mnx-lab:spec-media',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/spec-media', (req, res, next) => {
        void (async () => {
          const slug = (req.url ?? '').replace(/^\//, '').replace(/\.png$/, '');
          const imagePath = (await load()).get(slug);
          if (!imagePath || !fs.existsSync(imagePath)) {
            next();
            return;
          }
          res.setHeader('Content-Type', 'image/png');
          fs.createReadStream(imagePath).pipe(res);
        })().catch(next);
      });
    }
  };
}

export default defineConfig({
  plugins: [
    // Runs the Worker (worker/index.ts) inside the Vite dev server via
    // workerd, so `npm run dev` serves both the app and /api/* — no separate
    // backend process. Reads OPENROUTER_API_KEY from .dev.vars.
    cloudflare(),
    specMedia()
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
