# Studio storage rederive — converter regression sweep

Implementation loop. Item 5 of [studio storage](studio-campaign-storage.md), inheriting
its full contract and [storage design](../../docs/studio-storage.md).

Build an operator Node command that pages through the authenticated owner's stored
pieces, downloads each non-MNX source rendition, builds the checkout's converters,
compares fresh MNX against the previous child, and reports differences per source and
converter. `--dry-run` reads and compares without writes. Apply adds immutable children
and rebuilds canonical-derived tags through the Worker's revision-checked write path.
Canonical pointers, original bytes, asserted tags, recordings and aliases are preserved.
All routes live under the existing machine Access application; both secrets and active
operator membership remain mandatory. No new cloud resources or permissions.

Comparison ignores only root `_x.mnxLab.encoding` and JSON object-key order. A new
converter version still needs an evidence row even when music is unchanged (the design's
existing rule); exact bytes deduplicate in R2. Encoding-only changes are reported apart
from musical/document changes. Identical current results and tags are complete no-ops.
Alias application to documents remains deferred until the editing authority exists.

Done: tests cover changed/unchanged/encoding-only output, version evidence, corrupted
blobs, failures, isolation and stale revisions; local Worker/D1/R2 sweep and replay;
repository gates; production dry-run, apply and no-op replay of both real pieces. Land
with the fixed worktree recipe and append findings to the campaign after retirement.

## Operator use

```bash
npm run rederive:library -- --dry-run \
  --token-file /home/williao/dev/mnx-lab/.secrets/library-write-token \
  --access-token-file /home/williao/dev/mnx-lab/.secrets/library-access-service.json
# Remove --dry-run to apply; rerun to verify unchanged revisions.
```

Defaults to `https://mnx-lab.totai.uk`. For local smoke use
`--endpoint http://localhost:8791 --local-session-file .secrets/local-library-session.json`
and the local write token; see [local auth](../../docs/library-access.md).
Credentials are read from owner-only files or the existing environment variables.
JSON-lines reports contain piece/source ids, converter versions, hashes, changed JSON
paths (up to 40), evidence additions and revisions. A failed piece makes the command
exit nonzero after reporting the remaining pieces; no automatic stale-write retries.
A run visits the operator's pieces in id order; pieces added behind the cursor during a
run are picked up on the next run. Reports may be redirected to a private local file.
