# Studio storage read — private library Load

Implementation loop. Item 4 of [studio storage](studio-campaign-storage.md), inheriting
its full contract and [storage design](../../docs/studio-storage.md).

Create owner-scoped piece, tag-completion, rendition and canonical-MNX read routes,
a typed storage client and an optional workbench Load dialog. Access email codes verify
identity; every request requires an existing active D1 user. Browser and machine Access
audiences are separate. Ingest additionally requires the existing write token and the
active operator user. No login creates users; no private content is persisted by the UI.

Provision Access with an idempotent Cloudflare API operator script: explicit applications,
email policy, OTP identity provider and service credential. Set browser app sessions to 720h; the owner configured the global session to one month manually. Commit only resource IDs/configuration; credentials stay in ignored,
owner-readable files. The same command manages D1 users and reconciles the edge allowlist.
The infrastructure revisit chooses API bootstrap for this single-account pair of apps:
Cloudflare is the resource inventory, D1 the membership inventory; no separate Terraform
state containing service secrets. Reconsider Terraform with a second environment or wider
DNS/network management. Detect mismatched resources rather than silently adopting them.

Done: signed-token and owner-isolation tests, expired/forged/unknown/disabled-user cases,
local D1/R2 and browser smoke, unchanged static workbench, all repository gates; deployed
Access gate with 30-day settings verified, real owner login and both pieces load, and
operator ingest replay remains a no-op. Account credential/sign-in steps may await owner
participation; do not mark built until production checks finish.

## Implementation checkpoint

Routes, typed client, Load dialog, JWT validation, operator bootstrap/user command and
local signed identities are implemented. Auth tests use real RS256 signatures and local
D1/R2; browser smoke covers sign-in prompt, completion/filtering and MNX Load. Bootstrap
checks idempotence, drift refusal and empty-user denial without account calls. See
[operations](../../docs/library-access.md).

The owner configured the global Access session to one month manually, verified in the
dashboard. The scoped API token is saved outside this worktree in the primary checkout's
ignored secrets directory. Browser and machine applications, OTP provider and policies
are provisioned; real audiences are committed in Wrangler config. Bootstrap rerun passed.
Deployment, live browser sign-in and ingest replay checks remain before completion.
