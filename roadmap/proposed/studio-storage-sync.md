# Studio: storage, sync and sharing

**Status: proposed (design only — nothing built).** Fills in the biggest blank in
[apps/studio/README.md](../../apps/studio/README.md): where a user's scores live, how they
survive, and how they are shared. Everything here builds on the reserved seams
(`worker/api/documents.ts`/`auth.ts` 501 stubs, `src/storage/cloudRepository.ts`,
`DocumentRepository`) and starts only when studio starts. Recorded 2026-08-11 from a
design conversation; decisions carry their reasons so they can be re-litigated honestly.

## The problem

The workbench needs no backend by rule, but studio is the opposite product: a person's
whole library, on every device, durable against the two failure modes already lived
through in a previous life:

- **IndexedDB as the only store** — browsers treat it as evictable cache. One
  reinstall or "clear site data" is total loss.
- **Google Drive as the sync backend** — constant re-auth (third-party OAuth tokens
  expire on Google's schedule) and, structurally, a passive store with no compute at
  the point of authority: nowhere to arbitrate order, validate, or merge, so every
  client carries conflict logic. The unpleasantness was not incidental.

## The decision in one paragraph

A **hand-rolled op-log sync engine** in the Replicache mold (server-authoritative
rebase, not CRDT), persisted on Cloudflare: a **SQLite-backed Durable Object per
document** as the transactional authority, **D1** as the library layer (tags, shares,
projections), **R2** for immutable snapshots and published captures, and IndexedDB
demoted to what it should always have been — a disposable local replica plus an
offline op queue. Sharing has tiers: URL-fragment for one-off snippets, capability
URLs over **tag-shares** (a tag is the unit of share), and a read-only git/jsDelivr
publish tier. Drive survives only as a one-shot export target.

## Why a sync engine, and why this kind

The engine's shape: clients apply every edit **instantly and locally**, and a
background protocol reconciles with an authoritative server copy. Offline is the
normal case; a wiped browser is a re-clone; every logged-in device is a de-facto
backup of the server too.

The fork in the road is who merges:

- **CRDT (Yjs/Automerge)** — rejected, with the reason recorded: the document would
  have to live *inside* the CRDT's data model with MNX JSON as a projection out of it.
  This repo's entire premise is that the `.mnx.json` document **is** the artifact
  (byte-identical goldens, committed corpus, interchange format). A foreign source of
  truth underneath all that is the wrong trade unless real-time multi-person
  co-editing becomes a headline feature.
- **Server-authoritative rebase (the Replicache model)** — chosen. Clients send named
  mutations; the server applies them in arrival order against its state using the
  *same deterministic code* the client ran optimistically; clients replay
  unacknowledged mutations on top of the server's answer. No merge math — an op that
  no longer applies simply drops.

The entry requirements for that model are (1) all edits flow through a typed set of
deterministic mutators and (2) a mutation can re-apply against a different base state
sensibly. That is [`src/edit/ops.ts`](../../src/edit/ops.ts) — `EditOp` through one
`applyOp` funnel, deterministic by design (the trace fixtures replay it), addressing
notes by id/positional key, returning false when inapplicable. The hard half of the
engine already exists; what remains is a few hundred lines of protocol, not a research
project. "Never build your own sync engine" warns against *general* SQL sync — the
SQL-shaped engines (Zero, ElectricSQL, PowerSync) were considered and rejected
because they sync relational rows and our unit is a schema-validated JSON document
with its own op language. Replicache's openly published protocol docs are the
reference design.

Convergence bonus: once assist emits `EditOp[]` (the plan
[editor-ai-prompt.md](core-editor-ai-prompt.md) owns), an AI edit is just another client
pushing mutations — same validation, same history, same conflict story.

## Persistence: what lives where

| Store | Role | Why |
| --- | --- | --- |
| DO (SQLite) per document | **Authority** for content + op log | Single-threaded actor = serialization for free; storage is transactional *with the code applying ops* — apply, append, bump version, record idempotency in one commit |
| D1 | **Library layer**: asserted tags & shares (system of record), derived tags & doc metadata (rebuildable projection) | The only cross-document query surface; tags are the most relational data in the design |
| R2 | Immutable snapshots, published captures, future fat assets (audio, `.gpx`) | Cheap, zero egress; wrong as live authority (no transactions) |
| IndexedDB | Client replica + queued unacknowledged ops | Its proper role at last — losing it costs a re-sync |
| KV | **Nothing** | Eventually consistent last-writer-wins — the two properties a sync authority exists not to have |

DO internal schema: `snapshot(version, doc)`, `ops(version, clientId, mutationId, op)`,
`clients(clientId, lastMutationId)`. Push is
`{docId, baseVersion, ops[], clientId, mutationId}`; pull returns ops-since-version or
a snapshot. Compaction folds the op tail into the snapshot but *keeps* folded ops
(they are tiny): version history falls out of the transport layer for free. The
precompiled validators in `worker/generated/` run in the DO, so a push that would
corrupt a document is rejected at the authority — a guarantee blob upload cannot give.
Undo stays local (`EditHistory` semantics: undo *my* edits, not whatever synced in).
WebSockets (later, for live multi-device/collaboration) use the Hibernation API so
idle connections cost nothing.

**Granularity — DO per document, not per user.** The rule: draw the actor boundary at
the unit of *concurrent interest*. Users are not edited concurrently; documents are —
a second device, a bandmate, a viewer, the AI loop. Per-user was honestly weighed: it
wins `list()`-without-projection, atomic cross-doc operations, one warm actor — and
loses the moment anything is shared (a collaborator's push executes inside the actor
holding your whole library; one popular score serializes everything you own). A DO is
a few-KB file plus a routing entry, not a provisioned server; millions of tiny objects
is the platform's intended shape. The hybrid (per-user index DO instead of D1) is the
variant to reconsider if the D1 projection ever feels like the soft spot — recorded,
not chosen, because tags want relational queries and the sharing tiers eventually want
cross-*user* queries (community library, search).

## The library model: tags, in dimensions

A user has a flat collection of documents plus **multi-dimensional tags**:
`(owner, dimension, value, doc_id, sort_key)`. A path is a hierarchical tag dimension
(a doc can live in several collections; renames are row updates; no empty-folder edge
cases). A setlist is a tag whose rows carry order. Artist, tuning, key are dimensions
too — with a distinction built in from day one:

- **Derived dimensions** (tuning from `strings[]`+capo, artist/title from score
  metadata) are **extracted by the doc DO** into the index on every accepted push —
  never typed, never stale, always rebuildable by a re-index sweep. This is the
  authoritative-vs-derived discipline of
  [derived-positions.md](../complete/core-derived-positions.md) applied to the library layer.
- **Asserted dimensions** (path, setlist) have no source of truth but the user. They
  are first-class data — D1 is their system of record, writes go through auth, and
  offline tag edits join the client's queued-mutation machinery (as LWW rows, not
  rebased ops: tag contention is a human racing themself).

## Sharing: the tag is the unit

A share grant attaches to `(owner, dimension, value)` — a collection, not a file —
issued as a capability URL. Design decision to make deliberately at build time,
default recorded here: a shared tag is a **live set** ("everything I tag
`setlist:friday`, now and future"), matching folder intuition — with the consequence
that tagging a doc into a shared tag shares it, which the UI must say out loud
("this collection is shared with 3 people"). Mechanics: membership changes fan out
into a materialized `doc_grants(doc_id, principal, via_share)` table (collections are
dozens of docs, so fan-out-on-write is cheap) and each doc DO's access check is one
indexed lookup. Revocation deletes the share row and its fanned-out grants.

The full tier ladder, cheapest first:

1. **URL-fragment** (`#z=<deflated doc>`) — serverless one-off shares; scores are
   kilobytes, nothing to host, nothing to take down.
2. **Capability URLs over tag-shares** — the product's native sharing (above).
3. **Git/jsDelivr publish tier** — read-only interop for power users: a public repo
   or gist of `.mnx.json` files, listed via jsDelivr's data API, fetched via its CDN
   (CORS, no rate-limit pain, immutable at a pinned sha). "Publish setlist to repo"
   is *export snapshot at version N* — a pure function of DO state. Also the
   dogfooding vehicle: the community library can bootstrap from a repo of our own
   example scores. Never the backend (no server-side reducer; ToS gray zone at scale).
4. **Drive/file export** — one-shot backup, no refresh tokens, no sync.

**Copyright**: publishing is an explicit *act*, not a permission bit — private
library first, unlisted capability links second, truly public publishing a later,
deliberate step that brings DMCA basics (registered agent, takedown path) with it.
The share/publish moment is where the copyright warning lives; a tag-share of tabs is
precisely the act that needs it.

## Schema evolution — the tax this design pays

Once ops are a wire+storage format, an `EditOp` reshape needs the same discipline as
`_x.mnxLab` versions: an op-schema version and an upgrade path, à la
`upgradeTabExtension.ts`. The sharp event is **spec adoption** (a vendor block's
similar-but-not-the-same shape lands in core MNX): documents migrate by a new ladder
rung (lift / translate-via-derivation / residue-stays-vendor), and for sync it is a
**snapshot barrier** — fold the op tail, migrate the snapshot, bump the op version,
reject pushes from clients still speaking the old op dialect (they refresh, rebase,
resend). Old ops replayed onto a migrated doc would resurrect the old spelling;
the barrier is what prevents it.

## Boundary note for this repo

Applying `EditOp`s server-side means studio's backend needs `applyOp`, and today's
ceiling is `worker: model + assist only`. Assist is the sanctioned carrier of op
*types*; the *executor* crossing into a worker is a boundary decision to make
deliberately when studio starts — its backend is greenfield and can carry its own
dependency-cruiser rules without loosening the lab worker's.

## Cost

Everything above fits Cloudflare's **free plan** (DOs came to the free tier
2025-04, SQLite-backed only — the flavor wanted anyway) for development and small
beta; the free tier's ceilings are *hard daily caps* (writes fail, not bill), so the
**$5/mo Workers Paid plan is the floor the day real users arrive**. At kilobyte
document sizes the binding dimensions are requests and row-writes, not bytes —
batching ops per push (which the protocol does naturally) keeps both comfortable.

## Staging

1. **LWW whole-document sync** through the existing `DocumentRepository` seam —
   `save()` as the degenerate snapshot-with-empty-op-tail. Small, kills the
   data-loss fear immediately, forces auth (own origin, passkey/magic-link — owning
   sessions is what actually ends the sign-on woes).
2. **Library layer**: D1 tags (derived + asserted), the workbench-independent list.
3. **Op-log engine**: the DO protocol above; `CloudRepository` grows `pushOps`/`pull`
   beside `load`/`save`. Migration from stage 1 is additive.
4. **Tag-shares** (capability URLs, materialized grants), then the publish tiers.
5. **Live multi-device** (WebSocket + hibernation) — and only if it earns headline
   status, revisit CRDTs for real-time co-editing.
