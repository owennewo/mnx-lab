# Library access operations

Studio (`/studio/`) reads the library through `src/storage/libraryClient.ts`; the workbench
(`/workbench/`) never touches the service — it is static and public, by rule. The public
`/api/capabilities` flag advertises availability without exposing user/library data.
Every `/api/library` route authenticates before storage; reads use the signed email's
active D1 user id. Browser login never inserts users.

Access is configured for `mnx-labs-team.cloudflareaccess.com`. Browser application:
`mnx-lab.totai.uk/api/library` **and** `mnx-lab.totai.uk/studio` (one application, one
audience, one cookie — the studio page and its library fetches are one session; an
anonymous visit to `/studio/` meets the OTP prompt before any HTML), OTP provider only, 720h application sessions and an operator-configured one-month global session,
policy duration inherited. Machine application: the more-specific `/api/library/ingest`,
Service Auth only, separate audience and 1h token lifetime. Requests also require the
Worker write token and active D1 `operator`. Neither credential grants browser reads.
JWTs are verified by `jose` against the fixed issuer's JWKS, RS256, audience and expiry;
D1 membership is checked on every request. Logout uses `/cdn-cgi/access/logout`. Studio
(`/studio/`) has no login route of its own: sign-in is the edge redirect, and the shell
learns the address from `/api/library/me` at boot — a 403 there (Access admitted the
address, D1 has it inactive) shows its not-permitted page with a sign-out link.
Adding the `/studio` path to an already-provisioned browser application is the one
change `bootstrap` applies in place (a PUT of the declared configuration); every other
difference still refuses as drift. Re-run `bootstrap` after deploying the studio face and
confirm the browser policy is still attached (the same run's `sync` step checks it).

## Bootstrap and membership

Use Python 3.11+, a current Wrangler D1 login, and an owner-only Access API token file.
The token needs account-scoped **Access: Apps and Policies — Edit**, **Access:
Identity Providers — Edit**, **Access: Service Tokens — Edit**.
Never put credentials in command arguments or git. `.secrets/` and `.dev.vars` are ignored.

```sh
python3 tools/library-access.py bootstrap --token-file /private/.secrets/cloudflare-access-token --service-file /private/.secrets/library-access-service.json
python3 tools/library-access.py add --id stable-id --email person@example.com --token-file /private/.secrets/cloudflare-access-token
python3 tools/library-access.py disable --id stable-id --token-file /private/.secrets/cloudflare-access-token
python3 tools/library-access.py enable --id stable-id --token-file /private/.secrets/cloudflare-access-token
python3 tools/library-access.py sync --token-file /private/.secrets/cloudflare-access-token
```

Bootstrap records resource IDs in `tools/library-access-resources.json`, audiences and
issuer in `wrangler.jsonc`; service secrets are written once to a 0600 file. The default service file lives in the primary checkout’s ignored `.secrets/`, so retiring a task worktree cannot delete it. A rerun
reads existing resources, refuses configuration drift and missing recorded resources,
and updates only a changed allowlist. The global session duration is managed manually in Zero Trust; this command neither reads nor changes organization settings. Existing service credentials are
never silently rotated. A missing local service secret requires deliberate recovery or
rotation. User disable happens in D1 first; a subsequent edge-sync failure cannot keep
that user authorized. Retry `sync` after correcting account access. Add never reassigns
an existing stable id or silently enables a disabled user.

Bootstrap enables edge protection immediately. Deploy the matching Worker configuration
next; until then requests can fail closed during this operator-controlled cutover.
Verify the global/app durations, the exact policies, anonymous redirects, authenticated
studio's library page, and a machine ingest replay before marking rollout complete. Keep the
original private write-token file. Ingest now also takes
`--access-token-file /private/.secrets/library-access-service.json`, or the paired
`CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET` environment variables. No redirects are
followed by the ingest client. A service token initially expires after one year; renew it
explicitly before that date.

## Local development

Run `node tools/library-local-auth.mjs` in the worktree. This creates local public-key
trust in ignored `.dev.vars` and signed eight-hour test sessions in the ignored file
`.secrets/local-library-session.json`. Apply both migrations with Wrangler **--local**,
then insert a local user (`operator`, `local@example.test`, active 1, creation timestamp)
in local D1. For the built browser smoke start `npx wrangler dev --config wrangler.jsonc --assets dist/client --port 8791 --local-upstream localhost`. Wrangler otherwise rewrites the request hostname to the production route, which correctly rejects local identities. A browser test can set its loopback-only
`CF_Authorization` cookie from the file's `browser` field; a local ingest request sends
its `machine` field as `Cf-Access-Jwt-Assertion` alongside the local write token (the ingest CLI supports `--local-session-file .secrets/local-library-session.json --endpoint http://localhost:8791`). Local
trust requires both the special configured issuer and a loopback URL; it cannot be used
against deployed hostnames. No development identity header is trusted.

Local logout clears the test cookie manually; production logout is handled by Access.
`node harness/verify/studio-smoke.mjs` drives the built studio face against the same local
setup (root redirect, signed-out page, library list and filter, piece view with player,
missing piece), the studio counterpart of `library-smoke.mjs`.
Never deploy `.dev.vars` or `LIBRARY_LOCAL_JWKS`. Do not copy private scores into public
assets for testing. The harness uses synthetic scores with local D1/R2 and signed keys.

## Canonical reads

`GET /pieces` accepts up to twelve repeated `tag=dimension:value` filters (AND), and
an `after` cursor; pages contain at most fifty pieces. `GET /tags?q=prefix` completes
literal tag prefixes. `GET /pieces/:id` returns an owner-scoped snapshot;
`GET /pieces/:id/canonical` streams the canonical file; `GET /renditions/:id` streams an
owner-scoped attachment. All responses are private/no-store. Missing and other-owner
objects are indistinguishable. No client selects an owner or raw R2 key.

`GET /pieces/:id/canonical` streams the canonical rendition's bytes with `X-Library-Format`,
`X-Library-Rendition`, `X-Library-Revision` and a `Content-Disposition` filename; a piece
with no canonical answers 409. The service converts nothing: the shells run the importer
worker on those bytes (`src/importers/`). Nothing derived is stored and no converter version
is pinned; a converter change needs no deploy and no sweep. Reading changes no canonical
pointer or stored blob.
