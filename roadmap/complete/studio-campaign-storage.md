# Campaign: studio storage — songs in Cloudflare, every format kept

> **A campaign** (see CLAUDE.md → Roadmap-driven development): this doc is an index over
> normal proposals sharing one goal, the shared contract they follow, and the running log
> of progress and learnings as items land. Indexed items are ordinary `studio-*` proposals
> that name this campaign. **Opened 2026-09-11.** **Closed 2026-09-11: all five items are built.** The design it
> implements is [docs/studio-storage.md](../../docs/studio-storage.md); this doc owns the
> order and the contract, that doc owns the shape.

## The goal

**Studio has songs to play, and the workbench can borrow them.** A person's scores —
notation in whatever formats exist for them, the recordings that go with them, the
syncpoints that line the two up, and the lists they were filed in — live in Cloudflare
under one *piece* each. Filling it is a **personal ingest script** — a lab tool, run by
hand from the local `soundslice-cli` cache, not a product feature and not studio code.
Studio (not yet written) reads the result as its library. The workbench
gets a **Load** button that finds a piece by tags, "for testing", without acquiring a
backend of its own.

**And, on purpose, a converter-bug detector.** Every notation format a piece has is kept
as an immutable rendition beside the others — the uploaded `.gp5`, Soundslice's `.gp`
and MusicXML, our derived MNX from each — with producer and version on every one. The
on-disk canonical format is deliberately undecided; the schema carries a pointer, not a
policy. When a converter changes, re-deriving and diffing across the whole library is the
regression test. The first ingest, done by hand on 2026-09-11, already found three
Soundslice MusicXML exporter defects and one stale build of our own CLI this way (log
entry 1).

Not in scope: the sync engine, sharing, editing, and studio's front end. Each is its own
later campaign; this one lays the storage they all stand on.

## Baseline at campaign opening

- **The source.** `~/dev/soundslice-cli` (a separate repo, Python) exports a Soundslice
  library into `gp/files/`, one bundle per slice named `Artist_Title_<sliceId>.*`: the
  Soundslice `.gp` re-export, the `.original.<ext>` upload when there was one, Soundslice's
  `.musicxml`, uploaded `.mp3`/`.mp4` recordings, `.sync.json` (recordings, YouTube ids,
  syncpoints) and `.lists.json` (list memberships with hierarchical paths). Its README says
  the store reads without its SQLite index, and file identity is the slice id plus a
  recorded sha256. Two slices are exported today.
- **The Worker.** `wrangler.jsonc` deploys `worker/index.ts` (Hono) to `mnx-lab.totai.uk`
  with static assets in front; the only binding is the `OPENROUTER_API_KEY` secret.
  `worker/api/documents.ts` and `worker/api/auth.ts` are the reserved 501 seams;
  `src/storage/cloudRepository.ts` is their typed stub client. The layer order caps the
  Worker at `model + assist` and makes `workbench/` a leaf that reaches the Worker only
  through `assist/`.
- **The converters.** `guitarpro-mnx` (clean-room, GP3–GP8) and `musicxml-mnx` are Node
  CLIs whose live import paths already carry the score header into `_x.mnxLab.work` and
  strings/capo into the part. Their CLIs run from `dist/`, which is a build step, not a
  checkout (log entry 1).
- **The workbench** has no backend by rule and must stay fully functional from static build
  output alone. Its only Worker traffic is the assist demo.
- **The player campaign** owns performed ordinals (`core-campaign-player.md`), which
  Soundslice syncpoints are counted in.
- **Studio** is a README (`apps/studio/README.md`): framework and hosting shape are
  deliberately undecided until it starts.

## The contract

1. **The design doc is the schema.** [docs/studio-storage.md](../../docs/studio-storage.md)
   holds the tables, the R2 key layout and the invariants. An item that needs a schema change
   edits the doc *and* adds a migration; applied migrations are never edited. The five
   invariants there (immutable renditions, one canonical pointer, derived tags as a
   projection, originals never rewritten, producer on every rendition) are acceptance
   criteria for every item.
2. **Same origin, for now.** D1 and R2 bind to the existing `mnx-lab` Worker. One config,
   one deploy, and the workbench's Load route needs that origin anyway. This settles
   studio's *storage* hosting, not its front end; the Worker-side library module is
   DOM-free and portable if studio later takes its own origin.
3. **The Worker owns every write.** The ingest script, and later studio, write through Worker
   routes, never to D1 or R2 directly. That is where the invariants are enforced and where
   derived tags are materialised, and it is the same code path an edit will use later. Local
   development runs against `wrangler dev`'s local D1 and R2, so nothing needs the account
   to test.
4. **Conversion stays in Node.** Deriving MNX from `.gp`/MusicXML happens in the ingest script
   with the converters as they are. The Worker reads `_x.mnxLab.work` and part-level
   `strings`/`capo` out of MNX JSON to derive tags; no converter enters the Worker bundle.
   The layer ceiling `worker: model + assist only` is unchanged.
5. **The workbench stays static-functional.** Library access is additive: the Load button
   degrades to absent when the route is unreachable, the corpus and localStorage remain the
   only things the workbench *requires*. Reaching the Worker for the library goes through
   `src/storage/` (a typed client beside `cloudRepository.ts`), which amends the rule
   "workbench reaches the Worker only through `assist/`" to "through `assist/` and
   `storage/`" — a CLAUDE.md edit that item 4 makes explicitly.
6. **Nothing is public.** Every library route requires authentication from day one, in some
   form; the tabs are copyrighted and the read routes serve them whole. **Chosen for
   item 4: Cloudflare Access email codes, 30-day sessions, and an active users-table
   check on every library request** (details below). **No self-registration:** a person must
   already have a users-table record before login is allowed; signing in must never
   create that record. Browser identity must resolve server-side to that user and owner.
   The operator ingest token is a separate machine credential, not a user login.
7. **Idempotent, additive, never destructive.** A re-run of the ingest script against
   unchanged files writes nothing. A piece is keyed by `(owner, source_kind, source_id)`, so
   a re-export of the same slice updates the piece and adds renditions rather than creating
   a second piece; a recording is keyed by `(piece, source_id)`, so corrected syncpoints
   update the row rather than duplicating the blob; a list membership carries its upstream
   id in `source_ref`, so a tag the owner has renamed is not resurrected. The script sets
   the canonical pointer only when there is none (to the Soundslice `.gp`) and never moves
   it. It never deletes anything: a companion missing from a later export is not a deletion.
   Every write follows the design doc's order — blobs first and verified, then one D1 batch
   under the piece revision.
8. **The ingest script is not a product surface.** It lives beside the repo's other
   operator scripts (`spec/tools/*.mjs` is the precedent), runs only from a checkout by the
   person who owns the Cloudflare account, enters no build face, and is not studio's: studio
   reads the library, it never fills it this way. Nothing under `apps/studio/` changes in this
   campaign. **And studio never grows a Soundslice importer for its users**: studio is a
   product other people may use, and pulling their Soundslice libraries into it is not
   something this project wants to offer — the owner has no wish to disrupt Soundslice that
   way. The ingest stays a script for one account, by design, not by omission.
9. **Every item lands through the worktree recipe** (CLAUDE.md → Working in parallel) with
   the roadmap slug as the worktree name, and closes with a log entry here.

## The index

Ordered; each item is a normal proposal doc written when it is picked up, not before.

| # | Item | Status | Summary |
| --- | --- | --- | --- |
| 1 | [studio-storage-provision](../complete/studio-storage-provision.md) | **built 2026-09-11** | Create the Cloudflare resources — one D1 database, one R2 bucket — and bind them: `wrangler.jsonc` bindings, `worker/env.ts` types, a Worker secret for the ingest script's write token, `.dev.vars` for local. **Tooling decision inside the item:** `wrangler d1 create` / `wrangler r2 bucket create` wrapped in one checked-in, idempotent bootstrap script, rather than Terraform — see *Why not Terraform (yet)* below. Done when `wrangler dev` starts with local D1 and R2 and `npm run deploy` reaches the real ones. |
| 2 | [studio-storage-schema](../complete/studio-storage-schema.md) | built | The D1 migrations for the design doc's five tables (`migrations/`, applied with `wrangler d1 migrations apply`, local and remote), the R2 key layout, and a DOM-free `worker/library/` module: typed reads and writes that enforce the invariants (insert rendition → immutable; set canonical → one pointer; write MNX → re-derive tags). A harness test runs the module against local D1 via `wrangler dev`/Miniflare so the schema is exercised before any real data touches it. |
| 3 | [lab-library-ingest](../complete/lab-library-ingest.md) | **built 2026-09-11** | A personal operator script, `tools/library-ingest.mjs` run as `npm run ingest:library -- <dir>` (`lab-` because it serves the repo's owner, not a shell). Reads a `soundslice-cli` `gp/files/` directory, builds one piece per slice (renditions from every notation file with role, producer — the cached `.gp` is `soundslice-cli`, header-injected, with the raw export's sha256 in `provenance` — filename and fetch time; recordings with syncpoints keyed by Soundslice recording id; asserted tags from `lists.json` as `unknown:<path>` with the list id as `source_ref`), derives MNX from the `.gp` **and** from the MusicXML with the converters built from the checkout (recording package version, git sha and flags as `producer_version`/`producer_options`), and pushes everything through the Worker's ingest route with the write token. `--dry-run` prints the plan; re-runs are no-ops by sha256 (contract 7). Done when both exported slices are in the real library and `Blues Run The Game` resolves through its canonical pointer to an MNX with title, artist and capo 3. |
| 4 | [studio-storage-read](../complete/studio-storage-read.md) | built | Cloudflare Access email codes, 30-day sessions and pre-provisioned users; see the decision below. Add authenticated owner-scoped piece/tag/rendition reads and canonical MNX resolution, plus the workbench Load button with tag completion. No self-registration. The workbench remains usable without login; only its optional library access is protected. |
| 5 | [studio-storage-rederive](studio-storage-rederive.md) | built | The payoff for keeping every format. A sweep (an ingest-script subcommand or a Worker cron) that, for every piece, derives a fresh MNX child from each source rendition with the converters at their current versions, stores it as a new rendition when its bytes differ from the previous child (with `_x.mnxLab.encoding` discounted in the comparison; new converter versions still retain evidence rows per the design), rebuilds derived tags from the canonical path, and reports the differences per piece and per converter. A converter regression is then a line in that report rather than a bug someone happens to notice. Also the home of the alias table's "apply to documents" action once editing exists — not before. |

## Item 4 authentication decision — 2026-09-11

**Chosen by the owner:** Cloudflare Access sends one-time email codes; keep the browser
session for 30 days; require a pre-existing active D1 user. No passwords, social login,
passkeys, custom email delivery or public registration in the initial implementation.

Implementation defaults, to make the item concrete:

- **Two checks, both mandatory.** Access verifies mailbox control. The Worker validates
  the signed Access JWT (signature, issuer, application audience and expiry), then
  matches its email to a pre-added active user. Never trust a bare email header or
  create a user at login. Access authentication alone is not studio authorization.
- **Admin provisioning first.** A checked-in operator command adds/disables users and
  maintains Access's explicit email allowlist. No public add-user endpoint or admin UI
  initially. D1 is authoritative even if the edge allowlist is temporarily stale; fail
  closed on missing users, disabled users, missing auth configuration or database errors.
- **Stable ownership.** Add users with a stable id, unique normalized email, active flag
  and creation timestamp. Use the stable id as the library owner, never a client-supplied
  email or id. Seed the existing account with id `operator` so its two imported pieces
  retain ownership. The owner explicitly supplied the first permitted email for manual
  provisioning; keep it as account data rather than a committed seed.
- **Session and revocation.** Set global and application durations to 30 days (`720h`),
  with policies inheriting the application duration. This is a fixed browser-session
  policy, not a per-device checkbox or a rolling 30-day inactivity promise. Check user
  activity on every library request; disabling a user blocks subsequent requests without
  waiting for cookie expiry. Provide logout and a route back to the workbench.
- **Protect the library, preserve the public workbench.** Cover library metadata and
  blobs, plus a browser login entry point; leave the static corpus and assist demo as
  they are. Use top-level navigation for the Access challenge, not a redirect hidden
  inside a background fetch. Expiry/rejection must leave the viewer usable and offer
  sign-in. Validate JWTs in the Worker even on alternate hostnames; keep R2 private.
- **Keep machine ingest explicit.** Plan a separate Access Service Auth policy/application
  scoped to the ingest paths, using an Access service token alongside the existing
  Worker write token. Both remain operator secrets. Browser identity does not grant
  operator ingest privileges; machine credentials do not grant general browser reads.
  The ingest owner must also be active in D1. Verify path-policy precedence and repeat
  the real ingest no-op smoke when Access is enabled; never add an anonymous bypass.
- **Local and rollout checks.** Use local signed test identities with a local-only trust
  configuration; production never accepts a development identity header. Test unknown
  and disabled users, forged/expired/wrong-audience tokens, owner isolation, logout,
  session settings and machine ingest. Only account setup, the initial permitted email
  and real sign-in verification require the owner's participation.

The Access choice **triggers the infrastructure tooling revisit** recorded below. Item 4
must record its concrete choice (Terraform vs an idempotent Cloudflare API bootstrap),
including state/secret handling, before provisioning Access resources. This decision
does not configure Access. The owner has separately requested the users migration and
manual provisioning before browser integration (see the progress log).

References: [Access email codes](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/),
[session durations](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/),
[JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/),
[service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

Later, outside this campaign: the sync engine and Durable Object (the design doc's *When
the Durable Object arrives*), sharing tiers, studio's front end.

Resource tags (`project=mnx-studio`, `environment=production`) were considered on
2026-09-11 and then explicitly skipped by the owner after the tagging API rejected
the OAuth credentials. Names and `wrangler.jsonc` provide the resource inventory.

### Why not Terraform (yet)

Terraform is the right tool when there are many resources, several environments, and
things wrangler cannot see. Item 1 has three resources — one database, one bucket, one
secret — and every one of them must *also* be declared in `wrangler.jsonc` for the Worker to
bind to it, so Terraform would hold state for objects wrangler already names. It also needs
a state backend (an R2 bucket, which is the thing being created) and adds a second
toolchain for every agent working in the repo. A checked-in idempotent bootstrap script
over the wrangler commands, with the resulting ids committed in `wrangler.jsonc` (ids are
not secrets), reproduces the account from nothing and reads in one screen.

The trigger has now fired: **item 4 chose Cloudflare Access on 2026-09-11.**
That adds an Access application plus policies — resources outside wrangler's reach, exactly
the kind Terraform is for — and DNS or a second environment would tip the same way. Record
the choice in item 1's doc so the revisit is a known cost, not a surprise.

## Progress + learnings log

Appended as items land, newest last. Each entry: what landed, what was learned, what the
next item should know.

### 1. 2026-09-11 — campaign opened from a hand ingest

Two slices exported from Soundslice (`Sweet_Child_O_Mine_B2qHc`, `Jackson_C_Frank_Ole_Kirkeng_Blues_Run_The_Game_wJPHc`) were read by hand to
settle the storage unit. Findings the items inherit:

- **A converter's CLI is its `dist/`, and `dist/` is not the checkout.** Both
  `guitarpro-mnx` and `musicxml-mnx` resolve to `converters/*/dist/cli.js`, and the
  worktree's build was eight days behind source: the first import came back with no
  `_x.mnxLab.work` at all and was briefly misread as a converter gap. Item 3's tool must
  build (or import from source) rather than trust an installed binary, and must stamp the
  producer version it actually ran.
- **Soundslice's MusicXML exporter loses what the `.gp` keeps**: no `<work>`/`<credit>`
  (title and artist absent), no `<capo>` (Blues Run The Game is capo 3 in the `.gp`), and
  an empty `<step> </step>` on every flattened note (606 of them in E♭ major), which our
  aligner already detects and rebuilds from string/fret/tuning. The MNX derived from the
  MusicXML is therefore a *weaker* rendition than the one derived from the `.gp` — useful
  precisely as a comparison, wrong as a canonical.
- **The original upload can be a different arrangement.** The `.original.gp5` is 72 bars
  at capo 6 with the composer, lyricist and transcriber named in its header; the Soundslice
  `.gp` is 151 bars at capo 3. `role: original` is a fact about provenance, not "an older
  copy of the same thing", and which one is canonical is a choice the pointer records.
- **Syncpoints count performed bars.** 82 written bars → 139 syncpoints on one slice; 151
  → 152 on the other (an end marker). The recordings column says so; the player campaign's
  unroll is what makes them usable.
- **List paths arrive without a dimension.** "80s", "tunings / drop d", "Ole Kirking" are
  asserted tags with no name yet; `unknown:<path>` on import, renamed later by row update,
  is the design's answer.

### 2. 2026-09-11 — design reviewed before anything was built

An independent review of the design doc proposed eight changes; seven were taken, one was
already the case, and one claim was corrected. What the items inherit:

- **Blob dedupe is the hash key, not a constraint.** `UNIQUE (piece_id, sha256)` is gone.
  A re-derive that reproduces last time's bytes gets its own row against the same blob —
  the "same result at version Y" evidence item 5 wants.
- **The cached `.gp` is `soundslice-cli`'s, not Soundslice's.** The CLI injects the title
  and artist into the empty exported header; the rendition's producer says so and
  `provenance` carries the raw export's sha256. Item 3 reads the sidecar JSON for ids and
  fetch times; the CLI's `index.sqlite` is optional.
- **Rows are mutable, blobs are not.** Recordings upsert by Soundslice recording id;
  syncpoints, filenames and provenance are corrected in place; the piece `revision` is the
  compare-and-set token. Item 2's library module owns the write order (blobs first, then
  one D1 batch) and the same-piece rule for pointers and parents.
- **Import never deletes, never renames, never moves the pointer once set.** Asserted tags
  from lists carry `source_ref` so the owner's renames survive re-runs.
- **A dimension is derived or asserted, never both.** Corrections to derived values are
  aliases or edits.
- **The size claim was wrong**: D1 could hold a 1 MB MNX. Renditions live in R2 for
  uniformity, not necessity.
- **Syncpoints reference no rendition.** The player checks performed-bar count against
  syncpoint count before syncing and refuses with a reason on a mismatch.

### 3. 2026-09-11 — item 1: storage provisioned and deployed

[studio-storage-provision](../complete/studio-storage-provision.md) landed: D1
`mnx-studio-library` (`2e76025c-80d7-40b8-a2dd-c80f051b1867`), R2
`mnx-studio-library`, and the `LIBRARY_WRITE_TOKEN` Worker secret. The existing Worker
entry now deploys to `mnx-lab.totai.uk` with `LIBRARY_DB` and `LIBRARY_BUCKET`; neither
store contains application data. All 1,683 tests and the scenario/build gates passed.

What was learned, and what item 2 inherits:

- **Account activation precedes bootstrap.** R2 initially returned `10042`; the owner
  enabled R2, then the same script succeeded. Listing both resources before creation
  avoided a partial provisioning attempt. A second successful run was a no-op.
- **Names and UUIDs are the inventory.** Use `node tools/bootstrap-storage.mjs`; the
  script refuses to replace a missing or mismatched committed D1 database. R2 is
  identified by its name; Wrangler 4.99.0 lists it as labelled text, not JSON.
- **Resource tags were explicitly skipped.** The beta API returned 403 for the OAuth
  credential; the owner chose to omit tags rather than provision another credential.
- **Secrets are separate from resources.** The private ingest copy is in the primary
  checkout's ignored `.secrets/library-write-token` (0600), outside the retired worktree.
  Local `.dev.vars` uses a development-only value. The account had no Worker; setting
  the secret created its shell, and the first app deploy preserved the secret.
- **Item 2 starts with empty stores.** Bindings and types exist; `migrations/`, the five
  tables, the Worker library module and all invariant-enforcing writes are its work.
  Keep local bindings local, apply remote migrations deliberately, and reject writes
  when the token is absent. No public library route or ingest endpoint exists yet.
- **Deployment assets need the reference engravings.** The worktree left `vendor/mnx`
  empty as prescribed. The deploy included 52 images from the primary checkout's
  verified clean pin as temporary public assets; live HTML and PNG bytes matched.

Fast-forwarded and pushed through `a14f25d`; the worktree and branch were retired before
this log entry. Production version: `e343f161-3383-40ca-a9d1-dbb91b53cf01`.


### 4. 2026-09-11 — item 2: schema and library module built

[studio-storage-schema](../complete/studio-storage-schema.md) landed through `4873c79`;
its worktree and branch were retired before this entry. Migration `0001_library.sql`
is applied locally and remotely. Five application tables and the revision trigger
exist; production has zero application rows. Reapplying the migration is a no-op.
All 1,702 tests (including 19 local D1/R2 library tests), scenario checks and build passed.

What item 3 inherits:

- **Use `Library` from `worker/library/index.ts`.** Supply the authenticated owner and
  explicit current converter versions; the module never converts files. Stable piece,
  rendition and recording IDs, source identity, producer versions/options and lineage
  belong in the ingest payload. Inputs carry buffered bytes; the route owns transport
  and size limits. No HTTP route or ingest script exists yet.
- **Revision conflicts abort the entire batch.** The SQL trigger rejects stale writers
  and changed ownership inside the transaction, after immutable blobs are verified.
  A losing write can leave an orphan blob, never partial metadata. Read the current
  revision before retrying; unchanged writes preserve revision and timestamps.
- **Blob reuse and rendition history are separate.** Conditional R2 creation prevents
  overwrite; SHA-256 and size are verified before SQL. New producer versions can have
  distinct rendition rows sharing the same content hash. Existing rendition content
  and lineage cannot be changed.
- **Imports preserve owner choices.** Initialize the canonical pointer only when absent;
  list tags use `source_ref` so renames survive import. Recording upserts use source IDs,
  retain row identity, and never delete missing companions. Derived tags come only from
  canonical MNX (or its child at an explicitly selected current converter version).
  Missing current conversion must be handled explicitly rather than selecting stale MNX.
- **Remote CLI versions mattered in this session.** Wrangler 4.99.0 returned D1 `7403`
  despite visible resources and D1 write scope. The already installed 4.131.0 succeeded
  for a read-only probe, migration and empty-table verification. No credential change
  was needed; the cause remains unproven. User package edits were left untouched.
- **Authentication remains item 3's route responsibility.** Bind the existing private
  write token, fail closed when absent, and call the owner-scoped module. Item 2 adds
  no public route and needs no Worker application deploy on its own.


### 5. 2026-09-11 — item 3: authenticated ingest live, both pieces stored

[lab-library-ingest](../complete/lab-library-ingest.md) landed and was pushed through
`c435e53`; its worktree and branch were retired before this entry. Production Worker
version `a83ea21a-8df8-42dc-b99b-91402c676062` stores both approved slices: ten renditions,
two uploaded recordings and two YouTube references. Blues Run The Game resolves through
its canonical pointer to MNX with title, artist and capo 3. Production replay leaves
both pieces at revision 0. All 1,715 tests, scenario checks and build passed.

What item 4 inherits:

- **No anonymous library access.** All `/api/library` paths authenticate before reading
  bodies or storage; live unauthenticated reads and writes return 401. The current
  bearer token is a private operator credential, mapped server-side to owner `operator`.
  It is not browser login, and no client chooses an owner. Preserve that owner mapping
  deliberately when introducing actual user identities.
- **The owner ruled out self-registration.** Login requires an existing users-table
  record. Identity-provider sign-in must never create a user automatically. Item 4
  still needs to choose identity verification and add the users/session schema; even
  Cloudflare Access would require the Worker membership check. No browser auth option
  has been selected yet.
- **Converters and storage had different schema assumptions.** Real cache conversion
  exposed intentional section/rehearsal labels rejected by published MNX. Storage now
  validates just those label shapes separately and the remaining structure against
  published MNX, without modifying stored bytes. AI validation remains published-only;
  the full experimental schema is not admitted by storage.
- **Provenance must survive partial caches.** The optional SQLite index supplies exact
  fetch times, file hashes, raw-export hashes and injected headers. A sidecar-only
  replay preserves previously known indexed provenance. Converter versions include
  package version and last converter-source commit, so unrelated commits are no-ops.
- **The operator protocol is intentionally bounded.** One multipart piece per request,
  at most 24 MiB. Replays retransmit bytes but do not rewrite existing blobs or unchanged
  rows. Missing companions never delete rows; canonical choices and renamed lists stay
  intact. General browsing, user login and larger staged uploads are not implemented.
- **Deploy with matching build tooling.** The newer installed Wrangler rejected the
  old Vite plugin's generated `legacy_env` field; the locked Wrangler deployed it.
  The 52 reference PNGs were preserved from the clean pinned spec checkout. Existing
  user package upgrades remain uncommitted and untouched.


### 6. 2026-09-11 — browser auth selected

The owner chose Cloudflare Access email codes, 30-day sessions and a pre-existing users
table. Item 4 is ready to design against the decision above; the former open menu of
identity mechanisms is closed for the initial implementation. User provisioning,
revocation, stable ownership, machine ingest and the infrastructure tooling revisit
are explicitly included. This is a planning update; no authentication resources changed.


### 7. 2026-09-11 — first user provisioned

The owner supplied the initial email explicitly and requested manual provisioning.
`0002_users.sql` adds stable user ids, unique normalized emails, an active flag and a
creation timestamp. The first user keeps id `operator`, so the two imported pieces are
already assigned to that identity. No ownership rewrite or blob mutation is needed.
The email is account data, not a committed seed. Access setup, active-user enforcement
and the reusable provisioning command remain item 4 work; this schema alone does not
change the deployed private-token API or enable browser login.


Completion: migration `0002_users.sql` is applied locally and in production. The owner's
explicitly supplied email is provisioned as active user `operator`; a production join
verified ownership of both `B2qHc` and `wJPHc`, with piece revisions, timestamps and
canonical pointers unchanged. All 1,717 tests, scenario checks and build passed after
rebase. Landed and pushed through `d5a49fc`; the worktree and branch were retired before
this completion record. Browser login and active-user enforcement remain item 4 work.


Item 4 infrastructure revisit: use an idempotent Cloudflare API bootstrap for the two
Access applications, policies and OTP provider. Cloudflare and D1 hold resource and user
inventory; private service credentials stay in ignored owner-only files. No Terraform
state backend yet. Revisit for a second environment or broader DNS/network management.


### 2026-09-11 — item 4 built: private library reads

[studio-storage-read](../complete/studio-storage-read.md) landed through `b34cfc1` and
was deployed as `ad82d1f4-88ae-41a4-a014-843ab5b17043`; its worktree is retired.
Access email OTP verifies identity, browser sessions are 720h and global sessions are
one month. Every read resolves an existing active D1 user; login never provisions one.
The owner loaded both real scores, filtered by capo and signed out successfully. Ingest
still requires both its separate Access service credential and write token, plus active
operator membership; replay remained unchanged at revision 0. All 1,725 tests and the
scenario/build gates passed, along with local browser and operator bootstrap checks.

Learnings: SPA assets intercept navigation requests unless `/api/*` runs Worker-first;
this matters for the login callback even when fetch-based API tests pass. Access adds a
derived OTP callback URL that must be normalized narrowly for idempotent comparison.
Keep service secrets outside disposable worktrees, ignored and mode 0600. Global session
settings are operator-managed; the bootstrap needs no organization-settings permission.

Item 5: reads select a child matching `worker/library/converter-versions.json` and fail
explicitly when that conversion is missing. Update the version manifest with converter
changes and derive matching immutable children before expecting Load to succeed. Retain
owner scoping, canonical pointers, machine authentication and unchanged replay behavior;
no read performs conversion or writes storage. The two real pieces remain the regression
fixture, with ten renditions and four recording rows.


### 2026-09-11 — item 5 built; campaign complete

[studio-storage-rederive](studio-storage-rederive.md) landed through `f2c789d` and deployed
as `b75960cf-2cf4-46dd-ae24-d732d6f5b04d`; its worktree is retired. The operator command
reads stored sources, builds both Node converters, reports per-source/per-converter
changes and applies immutable children plus canonical tag rebuilds through the existing
authenticated, revision-checked Worker path. No new account resources or permissions.

The five real source renditions reproduced their stored MNX exactly. Local and production
dry-run, apply and replay passed; both complete production snapshots remained identical
at revision 0. The library still has ten renditions and four recordings. All 1,736 tests,
scenario checks and build passed, including eleven sweep-specific tests.

Learnings: unchanged music at a new converter version still needs an evidence row for
current-version resolution; equal bytes reuse R2 storage. Same-version encoding-only
churn reuses existing evidence. Reports discount only root encoding and object-key order,
retain array order, and include bounded JSON-path diffs. A failed source prevents that
piece's write; other pieces continue and the run exits nonzero. Dry-run performs reads
but no tag writes; apply reports whether the canonical tag projection changed.

All five storage items are built. Future converter changes must update the deployed
version manifest and run this sweep; missing current conversions fail explicitly.
Studio editing, sharing, sync and alias application to documents remain outside this
campaign. Originals and canonical ownership remain protected for those later efforts.
