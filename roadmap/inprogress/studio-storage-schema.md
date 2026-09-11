# Studio storage: schema and library module

Item 2 of the [storage campaign](studio-campaign-storage.md); inherits its contract
and [storage design](../../docs/studio-storage.md). Started 2026-09-11.

Build the five-table D1 migration, content-addressed R2 writes, and a DOM-free
`worker/library/` module with owner-scoped reads and atomic piece writes. A revision
trigger makes stale writes abort the whole D1 batch. Blobs are conditionally created
and verified before rows commit. Canonical MNX alone determines derived tags; imports
preserve existing canonical choices and renamed asserted tags.

Done: the harness exercises the real local D1/R2 runtime, including stale concurrent
writers, rollback, blob reuse, owner isolation, immutable renditions and canonical tag
projection. Apply migrations locally and remotely only after tests pass; production
stays empty. No HTTP routes or ingest script in this item (items 3/4 own those).
Land through the fixed commit/rebase/gates/fast-forward/push sequence; retire the
worktree before the campaign log and completion move.

## Implementation and validation

The migration mirrors the design's five tables and adds `pieces_revision_cas`, a
trigger rejecting stale next revisions. Library reads are owner-scoped snapshots;
revision and ownership are checked again inside the write transaction. Content-addressed
R2 puts use an absent-object condition plus checksum/size verification.

Seventeen local Miniflare tests cover graph validation, canonical version selection,
metadata projection, immutable rendition history, recording upserts, renamed list
tags, owner isolation, no-op retries, corruption, late SQL failure, and competing SQL
and R2 writers. Wrangler applied the migration locally successfully. Production
migration follows the complete repository gates. No library HTTP route is added.

Operator commands (from the checkout root):

```bash
npx wrangler d1 migrations apply LIBRARY_DB --local --config wrangler.jsonc
npx wrangler d1 migrations apply LIBRARY_DB --remote --config wrangler.jsonc
```
