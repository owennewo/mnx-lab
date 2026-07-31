import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * Serves the spec's reference engravings at /spec-media/<slug>.png — the
 * compare view's right pane — in dev from the pinned vendor/mnx checkout, and
 * in a build by copying them into the client output as emitted assets.
 *
 * The submodule may be READ by a build but is never REQUIRED by one: with no
 * vendor/mnx checked out (a fresh clone, a CI runner that skipped submodules)
 * the copy is skipped, the build still succeeds, and the compare pane falls
 * back to its note. That is the whole contract — `npm run deploy` runs from a
 * working tree that has the submodule, so the deployed site gets the images,
 * and nothing of the spec's ever enters this repo's own history.
 *
 * Read-only in both modes: the sanctioned "ephemeral file API" pattern from
 * structure-lab, minus even the writes.
 */
function specMedia(): Plugin {
  let bySlug: Map<string, string> | null = null;

  /** slug → absolute PNG path; empty when the submodule isn't checked out. */
  const load = async (): Promise<Map<string, string>> => {
    if (bySlug) return bySlug;
    try {
      const { loadSpecExamples } = await import('./spec/tools/specSource.mjs');
      const mnxSchema = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'spec/mnx-schema.json'), 'utf8')
      );
      const defs = new Set(Object.keys(mnxSchema.$defs ?? {}));
      const { examples } = loadSpecExamples(defs);
      bySlug = new Map(
        examples
          .filter((e: { imagePath: string | null }) => e.imagePath)
          .map((e: { slug: string; imagePath: string }) => [e.slug, e.imagePath])
      );
    } catch {
      // No submodule (or an unreadable fixture): degrade, never fail.
      bySlug = new Map();
    }
    return bySlug;
  };

  return {
    name: 'mnx-lab:spec-media',

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
    },

    // Client bundle only — the Worker build has no business carrying images.
    applyToEnvironment: environment => environment.name === 'client',

    async generateBundle() {
      const images = await load();
      if (images.size === 0) {
        this.warn(
          'vendor/mnx not checked out — building without the spec reference engravings. ' +
            'The compare view will show its fallback note. ' +
            'Run `git submodule update --init vendor/mnx` to include them.'
        );
        return;
      }
      let copied = 0;
      for (const [slug, imagePath] of images) {
        if (!fs.existsSync(imagePath)) continue;
        this.emitFile({
          type: 'asset',
          fileName: `spec-media/${slug}.png`,
          source: fs.readFileSync(imagePath)
        });
        copied++;
      }
      this.info(`spec-media: ${copied} reference engraving(s) copied from vendor/mnx`);
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
