import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
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

/**
 * Local library sign-in for the dev server. A studio page asked for with no
 * live session is signed in and sent back to itself, so dev never stops at a
 * sign-in step; GET /__local-logout clears the cookie and switches that off
 * (to see the signed-out page), GET /__local-login switches it back on and
 * bounces to `next`. Dev only, and served only to a loopback client asking
 * for a loopback host — the same two conditions under which
 * worker/library/access.ts honours the local issuer, so this can never hand
 * out anything a deployed hostname would accept (a tablet on the LAN gets the
 * signed-out page). It trusts no header: the cookie it sets is the signed
 * test session in .secrets/, renewed first when it is missing or about to
 * expire.
 */
function localLibraryLogin(): Plugin {
  const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
  const SIGNED_OUT = 'mnx-local-signed-out';
  const cookies = (header = '') => new Map(header.split(';').map(c => c.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, v.join('=')]));
  /** Whether a token has more than a minute to run. */
  const live = (jwt = '') => {
    try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).exp * 1000 > Date.now() + 60_000; } catch { return false; }
  };
  return {
    name: 'mnx-lab:local-library-login',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const route = url.pathname === '/__local-login' || url.pathname === '/__local-logout';
        const jar = cookies(req.headers.cookie);
        const studioPage = req.method === 'GET' && url.pathname.startsWith('/studio/') && (req.headers.accept ?? '').includes('text/html');
        const auto = studioPage && !jar.has(SIGNED_OUT) && !live(jar.get('CF_Authorization'));
        if (!route && !auto) return next();
        const host = (req.headers.host ?? '').replace(/:\d+$/, '');
        if (!LOOPBACK.has(req.socket.remoteAddress ?? '') || !LOCAL_HOSTS.has(host)) {
          if (auto) return next();
          res.statusCode = 404;
          res.end();
          return;
        }
        const next_ = url.searchParams.get('next') ?? '/studio/';
        const target = auto ? req.url! : /^\/(?!\/)/.test(next_) ? next_ : '/studio/';
        void (async () => {
          if (url.pathname === '/__local-logout') {
            res.setHeader('Set-Cookie', ['CF_Authorization=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax', `${SIGNED_OUT}=1; Path=/; SameSite=Lax`]);
            res.statusCode = 303;
            res.setHeader('Location', target);
            res.end();
            return;
          }
          const auth = await import('./tools/library-local-auth.mjs');
          const root = new URL('./', import.meta.url);
          const expiry = await auth.localSessionExpiry(root);
          let restart = false;
          if (!expiry || expiry - Date.now() < 15 * 60 * 1000) {
            const renewed = await auth.renewLocalSessions(root);
            restart = renewed.varsChanged;
          }
          if (restart) {
            // Only if the key vanished while dev ran: start-up writes it otherwise.
            res.statusCode = 503;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Local signing key created and .dev.vars updated. Restart `npm run dev`.\n');
            return;
          }
          const session = JSON.parse(
            fs.readFileSync(path.join(ROOT, '.secrets/local-library-session.json'), 'utf8')
          ) as { browser: string };
          res.setHeader('Set-Cookie', [`CF_Authorization=${session.browser}; Path=/; HttpOnly; SameSite=Lax`, `${SIGNED_OUT}=; Path=/; Max-Age=0; SameSite=Lax`]);
          res.statusCode = 303;
          res.setHeader('Location', target);
          res.end();
        })().catch(next);
      });
    }
  };
}

/**
 * Before the Worker starts: the local trust in .dev.vars, live sessions and a
 * local D1 at the latest migration with the local user in it — so a fresh
 * worktree's `npm run dev` needs no `dev:login` and never asks for a restart.
 * A failure is reported, not fatal: the app still serves without the library.
 */
async function prepareLocalLibrary() {
  const started = performance.now();
  try {
    const auth = await import('./tools/library-local-auth.mjs');
    const { applied } = await auth.prepareLocalLibrary(new URL('./', import.meta.url));
    const migrations = applied.length ? `, applied ${applied.join(', ')}` : '';
    console.log(`local library ready in ${Math.round(performance.now() - started)}ms${migrations}`);
  } catch (error) {
    console.warn(`local library not prepared (${(error as Error).message}); studio's library may be unavailable`);
  }
}

/** The commit a build was made from — stamped on the scores and recovery records studio writes. */
function commit(): string {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
}

export default defineConfig(async ({ command }) => {
  if (command === 'serve') await prepareLocalLibrary();
  return {
    define: { __MNX_COMMIT__: JSON.stringify(commit()) },
    plugins: [
      // Runs the Worker (worker/index.ts) inside the Vite dev server via
      // workerd, so `npm run dev` serves both the app and /api/* — no separate
      // backend process. Reads OPENROUTER_API_KEY from .dev.vars.
      cloudflare(),
      specMedia(),
      localLibraryLogin()
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
              main: 'workbench/index.html',
              // Studio — the consumer product, served at /studio/ (apps/studio/).
              studio: 'studio/index.html',
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
  };
});
