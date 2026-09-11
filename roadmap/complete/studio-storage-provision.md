# Studio storage: provision

**Built and deployed 2026-09-11.** Item 1 of the
[studio storage campaign](../inprogress/studio-campaign-storage.md), inheriting its
whole contract and the [storage design](../../docs/studio-storage.md).

## Created

| Resource | Identity | Worker binding |
| --- | --- | --- |
| D1 database | `mnx-studio-library` / `2e76025c-80d7-40b8-a2dd-c80f051b1867` | `LIBRARY_DB` |
| R2 bucket | `mnx-studio-library` | `LIBRARY_BUCKET` |
| Worker secret | Private ingest write token | `LIBRARY_WRITE_TOKEN` |

Bound to `mnx-lab` in account `e95cec11beeb0167dcd9f5c034f564ec`, deployed to
`mnx-lab.totai.uk`. No tables, migrations, library routes or data writes were added.
D1 reports zero tables and R2 reports zero objects. The account had no `mnx-lab` Worker;
secret installation created its initial shell before the first application deployment.

## Reproduce and operate

`node tools/bootstrap-storage.mjs` wraps Wrangler list/create commands. It reuses exact
resource names, records the D1 UUID in `wrangler.jsonc`, and refuses a missing or changed
committed database. Both resources are discovered before creation; a partial failure is
safe to retry. The second real run did only discovery and left the config unchanged.

Wrangler is sufficient for these resources; Terraform would add state and another
toolchain for resources already named here. Revisit if item 4 chooses Cloudflare Access,
or DNS management or a second environment makes it worthwhile. Resource tags were
considered, then explicitly skipped by the owner after the beta API rejected OAuth.
The owner activated R2 after the first bootstrap returned Cloudflare error `10042`.

For local development, copy `.dev.vars.example` to `.dev.vars` if absent; both storage
bindings use local state under `.wrangler/state`. `worker/env.ts` selects storage types
from Wrangler-generated `worker/bindings.d.ts`. Item 2 owns `migrations/`, local and
remote migration application, and library writes; absent write tokens must fail closed.

The production token is in the primary checkout's ignored `.secrets/library-write-token`
(directory 0700, file 0600) and the Worker secret. It was passed to Wrangler on stdin,
never printed or committed. `.dev.vars` uses a separate development-only value.
`.secrets/` and `.dev.vars.*` are ignored; `.dev.vars.example` is explicitly allowed.

## Validation and landing

- Five bootstrap tests cover repeat runs, partial failures, UUID drift and discovery errors.
- Local `wrangler dev --local` started with D1/R2 marked local; `/api/models` returned JSON.
- After commit and rebase: 1,683 tests passed, scenario checks passed, build passed.
- `npm run deploy` reported both real bindings; the settings API confirmed their identities
  and the `LIBRARY_WRITE_TOKEN` secret name.
- Deployment version: `e343f161-3383-40ca-a9d1-dbb91b53cf01`.
- Live HTML and a spec reference image matched the build byte-for-byte; `/api/models`
  returned HTTP 200. Curl passed after a Python HTTP request returned 403.
- Included 52 reference images from the primary checkout's verified, clean spec pin
  `46fbe9393067221ee83ef08de209cb3c4edf0d8d`, staged as temporary public assets for deployment.
- Fast-forward merged and pushed; worktree and branch removed before this completion record.
  Unrelated primary-checkout package edits were preserved.


Item 4 revisited Terraform after choosing Access: retain a checked-in idempotent API
bootstrap for this single-account application pair. Keep resource IDs in config and
credentials in ignored owner-only files; reconsider Terraform for multiple environments
or broader DNS/network management. See studio-storage-read for the implementation.
