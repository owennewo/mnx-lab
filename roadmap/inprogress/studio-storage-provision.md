# Studio storage: provision

**Campaign:** [studio storage](studio-campaign-storage.md), item 1. Inherits its whole
contract and [storage design](../../docs/studio-storage.md). Started 2026-09-11.

Create one D1 database (`mnx-studio-library`, binding `LIBRARY_DB`) and one private R2
bucket (`mnx-studio-library`, binding `LIBRARY_BUCKET`) on the existing `mnx-lab` Worker.
`LIBRARY_WRITE_TOKEN` is a Worker secret for the later ingest route; `.dev.vars` supplies
its local counterpart. No routes, tables, migrations, or blob/data writes in this item.

`npm run bootstrap:storage` wraps Wrangler list/create commands, reuses exact names,
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
2. `npm run bootstrap:storage` using the account pinned in `wrangler.jsonc`.
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
- D1 UUID is temporarily all-zero until the owner approves remote provisioning.

## Resource grouping and secrets

Tag the `mnx-lab` Worker, D1 database and R2 bucket with `project=mnx-studio` and
`environment=production`. These account resources are connected by Worker bindings;
tags provide cross-resource discovery, not a resource-group lifecycle. Use Cloudflare's
Tagging API (GET, merge, PUT, read back), preserving unrelated tags. If the account or
credential cannot use the beta API, record that explicitly rather than claiming tags
were applied. See [Cloudflare tagging](https://developers.cloudflare.com/resource-tagging/).

Keep the production ingest token in the primary checkout's ignored
`.secrets/library-write-token` (directory 0700, file 0600) and in the Worker secret.
Pass it on stdin to Wrangler; never print it or put it in command arguments.
`.dev.vars` holds only the local development value. `.secrets/` and `.dev.vars.*`
are ignored, with `.dev.vars.example` explicitly allowed.

## Account blockers (2026-09-11)

The owner approved rollout, including tags. The real bootstrap stopped on R2 discovery
with Cloudflare error `10042`: enable R2 through the Cloudflare Dashboard. Because both
resource lists are checked before creation, neither database nor bucket was created.
The tagging capability check (`GET /accounts/<account_id>/tags/keys`) returned `403`,
code `10000` (authentication error), using the existing Wrangler OAuth session. A
credential accepted by the Tagging API with tag read/write permissions is still needed;
provide it via an ignored local file or environment, never chat or tracked config.
No production ingest token has been created and no deployment has been made. Resume
with bootstrap after R2 activation, then tag, provision the secret, deploy and verify.
