# Studio storage: provision

**Campaign:** [studio storage](studio-campaign-storage.md), item 1. Inherits its whole
contract and [storage design](../../docs/studio-storage.md). Started 2026-09-11.

Create one D1 database (`mnx-studio-library`, binding `LIBRARY_DB`) and one private R2
bucket (`mnx-studio-library`, binding `LIBRARY_BUCKET`) on the existing `mnx-lab` Worker.
`LIBRARY_WRITE_TOKEN` is a Worker secret for the later ingest route; `.dev.vars` supplies
its local counterpart. No routes, tables, migrations, or blob/data writes in this item.

`node tools/bootstrap-storage.mjs` wraps Wrangler list/create commands, reuses exact names,
stops on failures or a mismatched committed UUID, and records the D1 UUID in
`wrangler.jsonc`. R2 is identified by its bucket name. Re-running makes no changes.
Wrangler is sufficient for these resources; Terraform would add state and a toolchain
for resources already named here. Revisit at item 4 if auth uses Cloudflare Access,
or when DNS management or another environment makes it worthwhile.

Done: bootstrap run twice with stable config; `wrangler dev` starts with local D1/R2;
`npm run deploy` reports the real bindings; token exists remotely; all landing gates
pass. Owner approved account provisioning, token creation and the first deploy on 2026-09-11.

## Operator steps

1. `npm ci`; copy `.dev.vars.example` to `.dev.vars` if absent (local value only).
2. `node tools/bootstrap-storage.mjs` using the account pinned in `wrangler.jsonc`.
3. Create a random write token and store it with `wrangler secret put LIBRARY_WRITE_TOKEN`;
   keep the ingest copy privately, never in git or command arguments.
4. `npm run build`, then `npx wrangler dev --local` (or `npm run dev` for Vite).
5. `npm run deploy` after owner approval; inspect the deployment binding summary.

Item 2 owns `migrations/` and applies migrations separately, local and remote. Local
state stays in `.wrangler/state`; no `remote: true` binding is needed for development.
The write token is only declared here: later library routes must fail closed when absent.

## Preparation checks

- Five harness tests cover repeat runs, partial failures, UUID drift and discovery failure.
- `wrangler dev --local --port 8791` starts with both storage bindings marked local;
  `GET /api/models` returns valid JSON. No storage data is written.
- The committed lockfile uses Wrangler 4.99.0; R2 listing is labelled text, not JSON.
- Real D1 UUID: `2e76025c-80d7-40b8-a2dd-c80f051b1867`.

## Resource grouping and secrets

Resource tags (`project=mnx-studio`, `environment=production`) were added to the
plan, then explicitly skipped by the owner on 2026-09-11. No tagging credential
is required. Names and `wrangler.jsonc` remain the resource inventory.

Keep the production ingest token in the primary checkout's ignored
`.secrets/library-write-token` (directory 0700, file 0600) and in the Worker secret.
Pass it on stdin to Wrangler; never print it or put it in command arguments.
`.dev.vars` holds only the local development value. `.secrets/` and `.dev.vars.*`
are ignored, with `.dev.vars.example` explicitly allowed.

## Account setup

Initial provisioning stopped before creation because R2 was not enabled (`10042`).
The owner enabled it; the subsequent bootstrap created both resources successfully.
The tagging API rejected the OAuth credential (`403`); the owner explicitly skipped
tags. Neither issue requires further account setup.

## Provisioning evidence

- D1 `mnx-studio-library`: `2e76025c-80d7-40b8-a2dd-c80f051b1867`; R2: `mnx-studio-library`.
- Second bootstrap run performed only discovery; the config stayed unchanged.
- `LIBRARY_WRITE_TOKEN` installed through stdin; private copy stored in the primary
  checkout's `.secrets/library-write-token`, mode 0600, with ignore verified before creation.
- The account had no `mnx-lab` Worker; secret installation created its initial shell.
- Bootstrap is invoked directly with Node, leaving unrelated primary-checkout package
  edits untouched.
