# MNX Lab

A test bench for the developing [W3C MNX](https://w3c.github.io/mnx/docs/) music
notation format, with a particular emphasis on guitar tab via the single-source
`_x.tab` vendor extension ([spec](docs/tab-extension-spec.md)). Renders MNX JSON
as standard notation and tab with a custom SMuFL/SVG engine, plays it back with
Tone.js, and includes an LLM-powered chat-to-edit workflow with self-correcting
dual schema validation (standard MNX + tab extension).

## Develop

```bash
npm install
npm run dev          # Vite dev server + Worker (API) in one process
```

The API routes (`/api/*`) are served by a Cloudflare Worker
([worker/index.ts](worker/index.ts)) running inside the Vite dev server via
`@cloudflare/vite-plugin`. The OpenRouter key is read from `.dev.vars` (or
`.env`) locally — without one, `/api/edit-notation` falls back to a mock mode
so the UI stays demoable offline.

## Build

```bash
npm run build
```

This regenerates the precompiled MNX schema validator
(`worker/generated/validate-mnx.mjs` — Workers disallow runtime code
generation, so Ajv compilation happens at build time via
[scripts/compile-validator.mjs](scripts/compile-validator.mjs)), type-checks
the app and the Worker, and builds both with Vite.

## Deploy (Cloudflare)

One-time setup:

```bash
npx wrangler login                              # authenticate with your Cloudflare account
npx wrangler secret put OPENROUTER_API_KEY      # store the API key as a Worker secret
```

Then:

```bash
npm run deploy
```

The Worker is configured in [wrangler.jsonc](wrangler.jsonc) to serve at
`mnx-lab.totai.uk` (custom domain on the totai.uk zone — Cloudflare creates
the DNS record automatically on first deploy). Static assets are served in
front of the Worker for free; only `/api/*` requests invoke it.

**Before sharing the URL publicly**, put Cloudflare Access in front of
`mnx-lab.totai.uk/api/*` (Zero Trust → Access → Applications) — the edit
endpoint proxies your OpenRouter key, and Access (free for up to 50 users)
prevents strangers from spending your credit.

## Schema updates

The MNX schema is pinned at [schemas/mnx-schema.json](schemas/mnx-schema.json)
(see [schemas/HISTORY.md](schemas/HISTORY.md)). After updating it, run
`npm run compile-validator` and commit the regenerated
`worker/generated/validate-mnx.mjs`.

## Sub-packages

`converters/musicxml-mnx/` is a standalone MusicXML ⇄ MNX converter with its
own tests — see [CLAUDE.md](CLAUDE.md) for commands.
