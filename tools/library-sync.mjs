#!/usr/bin/env node
// Personal operator tool: reconcile two studio libraries — the local dev library
// (the primary checkout's wrangler state) and the deployed one — in both
// directions, moving the newer state each way.
//
// Two libraries can meet like this because piece and rendition ids are
// deterministic (docs/studio-storage.md): two imports of one Soundslice slice are
// the same rows, so the libraries are compared row by row, never by title.
//
// The rules, one per kind of row:
//   - A piece, rendition, recording, view or alias on one side only is copied,
//     blobs first. Deletion does not propagate (there are no tombstones), so a
//     row deleted on one side comes back; the plan lists every copy.
//   - The canonical pointer FAST-FORWARDS: a side whose canonical rendition is
//     an ancestor (`derived_from`) of the other's moves to it. Two sides that
//     each saved past their common version are a conflict, reported and left
//     alone — both lines of renditions are still copied, so nothing is lost.
//   - Derived tags are a projection of the canonical rendition: they follow a
//     pointer that moves, and otherwise each side gains the dimensions it lacks.
//   - What else a person sets on a piece — asserted tags, `deleted_at` —
//     follows the side whose piece row changed last (`updated_at`).
//   - A recording follows its newer row (`updated_at`), except for two fields
//     that only ever gain: `duration_s`, a measurement of the media rather than
//     an edit, which a side that lacks it gains; and `provenance`, which merges
//     key by key, the newer row's keys winning.
//   - A piece view keeps the later `opened_at` and the later prefs.
//   - `revision` is a per-library compare-and-set counter, never compared across
//     libraries. A changed piece is bumped by one under compare-and-set, and both
//     sides end with the later `updated_at`, so a second run plans nothing.
//
// Reads and writes go through wrangler (logged in, or CLOUDFLARE_API_TOKEN), so
// one path serves the local library, the deployed one, and a scratch library
// standing in for either. Without --apply it prints the plan and writes nothing.
import { execFile } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const DATABASE = 'mnx-studio-library', BUCKET = 'mnx-studio-library';
const TABLES = ['pieces', 'renditions', 'recordings', 'tags', 'tag_aliases', 'piece_views', 'd1_migrations'];
const RECORDING_FIELDS = ['kind', 'name', 'r2_key', 'sha256', 'bytes', 'mime', 'external_id', 'syncpoints', 'source_id'];
const COLUMNS = {
  pieces: ['id', 'owner', 'canonical_rendition_id', 'source_kind', 'source_id', 'source_url', 'revision', 'created_at', 'updated_at', 'deleted_at'],
  renditions: ['id', 'piece_id', 'format', 'role', 'filename', 'sha256', 'r2_key', 'bytes', 'producer', 'producer_version', 'producer_options', 'provenance', 'derived_from', 'fetched_at', 'created_at'],
  recordings: ['id', 'piece_id', ...RECORDING_FIELDS, 'provenance', 'duration_s', 'created_at', 'updated_at'],
  tags: ['owner', 'piece_id', 'dimension', 'value', 'origin', 'sort_key', 'source_ref'],
  tag_aliases: ['owner', 'dimension', 'raw_value', 'canonical_value'],
  piece_views: ['owner', 'piece_id', 'opened_at', 'prefs', 'prefs_updated_at'],
};

// ------------------------------------------------------------------ the plan
const groupBy = (rows, key) => { const m = new Map(); for (const r of rows) (m.get(key(r)) ?? m.set(key(r), []).get(key(r))).push(r); return m; };
const byId = rows => new Map(rows.map(r => [r.id, r]));
const tagKey = t => `${t.origin}\u0000${t.dimension}\u0000${t.value}`;
const viewKey = v => `${v.owner}\u0000${v.piece_id}`;
const aliasKey = a => `${a.owner}\u0000${a.dimension}\u0000${a.raw_value}`;
const sameFields = (a, b, fields) => fields.every(f => (a[f] ?? null) === (b[f] ?? null));
const newer = (a, b) => (a ?? '') > (b ?? '');
const parse = json => { try { const v = JSON.parse(json); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; } };
/** Provenance only gains: both objects' keys, the newer row's winning. Unparseable text follows the newer row. */
function mergeProvenance(older, newerText) {
  if (older == null || newerText == null) return newerText ?? older ?? null;
  const [o, n] = [parse(older), parse(newerText)];
  if (!o || !n) return newerText;
  const merged = { ...o, ...n };
  return JSON.stringify(Object.fromEntries(Object.keys(merged).sort().map(k => [k, merged[k]])));
}

function index(snapshot) {
  return {
    pieces: byId(snapshot.pieces), renditions: byId(snapshot.renditions), recordings: byId(snapshot.recordings),
    renditionsOf: groupBy(snapshot.renditions, r => r.piece_id), recordingsOf: groupBy(snapshot.recordings, r => r.piece_id),
    tagsOf: groupBy(snapshot.tags, t => t.piece_id), viewsOf: groupBy(snapshot.piece_views, v => v.piece_id), views: new Map(snapshot.piece_views.map(v => [viewKey(v), v])),
    aliases: new Map(snapshot.tag_aliases.map(a => [aliasKey(a), a])),
    blobs: new Set([...snapshot.renditions, ...snapshot.recordings].map(r => r.r2_key).filter(Boolean)),
  };
}

/** Is `ancestor` reached from `id` by following `derived_from` (through either side's renditions)? */
function descends(id, ancestor, lineage) {
  for (let at = lineage.get(id), seen = new Set(); at && !seen.has(at); seen.add(at), at = lineage.get(at)) if (at === ancestor) return true;
  return false;
}

/** Parents before children, so a `derived_from` reference never dangles mid-write. */
function lineageOrder(rows) {
  const here = byId(rows), done = new Set(), out = [];
  const visit = r => { if (done.has(r.id)) return; done.add(r.id); if (here.has(r.derived_from)) visit(here.get(r.derived_from)); out.push(r); };
  for (const r of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))) visit(r);
  return out;
}

function emptyChanges() {
  return { newPieces: [], renditions: [], recordings: [], recordingUpdates: [], tagsRemoved: [], tagsAdded: [], pieceUpdates: [], views: [], aliases: [], blobs: new Map(), summary: [] };
}

/**
 * Plan a two-way sync between snapshots `a` and `b` (rows of TABLES). Returns
 * what each side must receive, the conflicts left alone, and per-piece lines
 * a person can read. Pure: the caller decides whether to write it.
 */
export function planSync(a, b, names = { a: 'a', b: 'b' }) {
  const migrations = s => s.d1_migrations.map(m => m.name).sort().join();
  if (migrations(a) !== migrations(b)) throw new Error(`Schema differs: apply migrations to both libraries first (${names.a}: ${migrations(a)}; ${names.b}: ${migrations(b)})`);
  const A = index(a), B = index(b);
  const lineage = new Map([...a.renditions, ...b.renditions].filter(r => r.derived_from).map(r => [r.id, r.derived_from]));
  const into = { a: emptyChanges(), b: emptyChanges() };
  const conflicts = [];
  const sides = [['a', A, 'b', B], ['b', B, 'a', A]];
  const title = id => [A, B].map(S => S.tagsOf.get(id)?.find(t => t.dimension === 'title')?.value).find(Boolean) ?? id;
  const needBlob = (to, target, row) => { if (row.r2_key && !target.blobs.has(row.r2_key)) into[to].blobs.set(row.r2_key, row.mime ?? null); };

  for (const id of [...new Set([...A.pieces.keys(), ...B.pieces.keys()])].sort()) {
    const pa = A.pieces.get(id), pb = B.pieces.get(id);
    const name = title(id);
    if (!pa || !pb) {
      const [to, from, target] = pa ? ['b', A, B] : ['a', B, A];
      const piece = pa ?? pb, change = into[to];
      change.newPieces.push(piece);
      for (const r of lineageOrder(from.renditionsOf.get(id) ?? [])) { change.renditions.push(r); needBlob(to, target, r); }
      for (const r of from.recordingsOf.get(id) ?? []) { change.recordings.push(r); needBlob(to, target, r); }
      change.tagsAdded.push(...(from.tagsOf.get(id) ?? []));
      change.views.push(...(from.viewsOf.get(id) ?? []));
      const edits = (from.renditionsOf.get(id) ?? []).filter(r => r.role === 'edit').length;
      change.summary.push(`${name} (${id}): new piece${piece.deleted_at ? ', deleted' : ''} — ${(from.renditionsOf.get(id) ?? []).length} renditions (${edits} edits), ${(from.recordingsOf.get(id) ?? []).length} recordings`);
      continue;
    }
    const update = { a: {}, b: {} }, lines = { a: [], b: [] };
    const pieceRows = { a: pa, b: pb };

    // Renditions are immutable: each side gains the other's, in lineage order.
    for (const [to, from, , target] of sides.map(([x, X, y, Y]) => [y, X, x, Y])) {
      const missing = lineageOrder((from.renditionsOf.get(id) ?? []).filter(r => !target.renditions.has(r.id)));
      for (const r of missing) { into[to].renditions.push(r); needBlob(to, target, r); }
      if (missing.length) lines[to].push(`+${missing.length} rendition${missing.length > 1 ? 's' : ''} (${[...new Set(missing.map(r => r.role))].join(', ')})`);
    }

    // The canonical pointer fast-forwards along derived_from.
    let pointerMoved = null;
    if (pa.canonical_rendition_id !== pb.canonical_rendition_id) {
      const [ca, cb] = [pa.canonical_rendition_id, pb.canonical_rendition_id];
      if (cb && descends(ca, cb, lineage)) pointerMoved = 'b';
      else if (ca && descends(cb, ca, lineage)) pointerMoved = 'a';
      else conflicts.push(`${name} (${id}): both sides saved past their common version (${names.a} ${ca}, ${names.b} ${cb}); pointer left alone`);
      if (pointerMoved) {
        const from = pointerMoved === 'a' ? pb : pa;
        update[pointerMoved].canonical_rendition_id = from.canonical_rendition_id;
        lines[pointerMoved].push(`canonical → ${(A.renditions.get(from.canonical_rendition_id) ?? B.renditions.get(from.canonical_rendition_id)).role} ${from.canonical_rendition_id}`);
      }
    }

    // Piece-level settings follow the piece row that changed last.
    const later = newer(pa.updated_at, pb.updated_at) ? 'a' : newer(pb.updated_at, pa.updated_at) ? 'b' : null;
    const earlier = later && (later === 'a' ? 'b' : 'a');
    if (later && (pieceRows[later].deleted_at ?? null) !== (pieceRows[earlier].deleted_at ?? null)) {
      update[earlier].deleted_at = pieceRows[later].deleted_at ?? null;
      lines[earlier].push(pieceRows[later].deleted_at ? 'deleted' : 'restored');
    }
    const tags = { a: A.tagsOf.get(id) ?? [], b: B.tagsOf.get(id) ?? [] };
    const asserted = side => tags[side].filter(t => t.origin === 'asserted');
    const derived = side => tags[side].filter(t => t.origin === 'derived');
    const replace = (to, remove, add, label) => {
      const keep = new Set(add.map(tagKey)), had = new Set(remove.map(tagKey));
      const removed = remove.filter(t => !keep.has(tagKey(t))), added = add.filter(t => !had.has(tagKey(t)));
      into[to].tagsRemoved.push(...removed); into[to].tagsAdded.push(...added);
      if (removed.length || added.length) lines[to].push(`${label} tags +${added.length} −${removed.length}`);
    };
    if (later) replace(earlier, asserted(earlier), asserted(later), 'asserted');
    if (pointerMoved) replace(pointerMoved, derived(pointerMoved), derived(pointerMoved === 'a' ? 'b' : 'a'), 'derived');
    else for (const [to, other] of [['a', 'b'], ['b', 'a']]) {
      const has = new Set(derived(to).map(t => t.dimension));
      const added = derived(other).filter(t => !has.has(t.dimension));
      into[to].tagsAdded.push(...added);
      if (added.length) lines[to].push(`derived tags +${added.length} (${[...new Set(added.map(t => t.dimension))].join(', ')})`);
    }

    // Recordings: the newer row's edits, either side's measurement.
    for (const [to, from, , target] of sides.map(([x, X, y, Y]) => [y, X, x, Y])) {
      for (const r of from.recordingsOf.get(id) ?? []) {
        const there = target.recordings.get(r.id);
        if (!there) { into[to].recordings.push(r); needBlob(to, target, r); lines[to].push(`+recording ${r.kind} "${r.name ?? ''}"`); continue; }
        const set = {}, ahead = newer(r.updated_at, there.updated_at);
        if (ahead) for (const f of RECORDING_FIELDS) if ((r[f] ?? null) !== (there[f] ?? null)) set[f] = r[f] ?? null;
        if (set.r2_key) needBlob(to, target, r);
        const [older, latest] = ahead ? [there, r] : [r, there];
        const duration = latest.duration_s ?? older.duration_s ?? null;
        if (duration !== (there.duration_s ?? null)) set.duration_s = duration;
        const provenance = mergeProvenance(older.provenance, latest.provenance);
        if (provenance !== (there.provenance ?? null)) set.provenance = provenance;
        if (Object.keys(set).length) {
          into[to].recordingUpdates.push({ id: r.id, piece_id: id, set: { ...set, updated_at: latest.updated_at } });
          lines[to].push(`recording ${r.kind} "${r.name ?? ''}" [${Object.keys(set)}]`);
        }
      }
    }

    // Views: the later opening, the later setup.
    for (const owner of new Set([pa.owner, pb.owner])) {
      const va = A.views.get(viewKey({ owner, piece_id: id })), vb = B.views.get(viewKey({ owner, piece_id: id }));
      if (!va && !vb) continue;
      const merged = {
        owner, piece_id: id,
        opened_at: [va?.opened_at, vb?.opened_at].filter(Boolean).sort().at(-1),
        ...(newer(vb?.prefs_updated_at, va?.prefs_updated_at) ? { prefs: vb.prefs, prefs_updated_at: vb.prefs_updated_at } : { prefs: va?.prefs ?? vb?.prefs ?? null, prefs_updated_at: va?.prefs_updated_at ?? vb?.prefs_updated_at ?? null }),
      };
      for (const [to, v] of [['a', va], ['b', vb]]) if (!v || !sameFields(v, merged, COLUMNS.piece_views)) {
        into[to].views.push(merged);
        if ((v?.prefs_updated_at ?? null) !== merged.prefs_updated_at) lines[to].push('setup (prefs)');
      }
    }

    // A side whose music, tags or recordings changed takes one revision under
    // compare-and-set, and the later updated_at, so both sides agree after.
    for (const side of ['a', 'b']) {
      const touched = Object.keys(update[side]).length || lines[side].some(l => l !== 'setup (prefs)');
      if (touched) into[side].pieceUpdates.push({ id, revision: pieceRows[side].revision, set: { ...update[side], updated_at: [pa.updated_at, pb.updated_at].sort().at(-1) } });
      if (lines[side].length) into[side].summary.push(`${name} (${id}): ${lines[side].join('; ')}`);
    }
  }

  for (const [to, from, , target] of sides.map(([x, X, y, Y]) => [y, X, x, Y])) for (const [key, alias] of from.aliases) {
    const there = target.aliases.get(key);
    if (!there) { into[to].aliases.push(alias); into[to].summary.push(`tag alias ${alias.dimension}: "${alias.raw_value}" → "${alias.canonical_value}"`); }
    else if (there.canonical_value !== alias.canonical_value && to === 'b') conflicts.push(`tag alias ${alias.dimension} "${alias.raw_value}": ${names.a} → "${there.canonical_value}", ${names.b} → "${alias.canonical_value}"`);
  }
  return { into, conflicts };
}

// ------------------------------------------------------------------ the writes
/** A side's changes as ordered SQL: rows that others reference before their references. */
export function statements(change) {
  const out = [];
  const insert = (table, row) => out.push({ sql: `INSERT INTO ${table} (${COLUMNS[table].join(',')}) VALUES (${COLUMNS[table].map(() => '?').join(',')})`, params: COLUMNS[table].map(c => row[c] ?? null) });
  for (const p of change.newPieces) insert('pieces', { ...p, canonical_rendition_id: null });
  for (const r of change.renditions) insert('renditions', r);
  for (const p of change.newPieces) out.push({ sql: 'UPDATE pieces SET canonical_rendition_id=? WHERE id=?', params: [p.canonical_rendition_id, p.id] });
  for (const r of change.recordings) insert('recordings', r);
  for (const { id, piece_id, set } of change.recordingUpdates) {
    const fields = Object.keys(set);
    out.push({ sql: `UPDATE recordings SET ${fields.map(f => `${f}=?`).join(',')} WHERE id=? AND piece_id=?`, params: [...fields.map(f => set[f]), id, piece_id] });
  }
  for (const t of change.tagsRemoved) out.push({ sql: 'DELETE FROM tags WHERE owner=? AND piece_id=? AND dimension=? AND value=?', params: [t.owner, t.piece_id, t.dimension, t.value] });
  for (const t of change.tagsAdded) insert('tags', t);
  // The revisions trigger rejects anything but OLD+1; the WHERE makes it compare-and-set.
  for (const { id, revision, set } of change.pieceUpdates) {
    const fields = Object.keys(set);
    out.push({ sql: `UPDATE pieces SET ${fields.map(f => `${f}=?`).join(',')},revision=revision+1 WHERE id=? AND revision=?`, params: [...fields.map(f => set[f]), id, revision] });
  }
  for (const v of change.views) out.push({ sql: `INSERT INTO piece_views (${COLUMNS.piece_views.join(',')}) VALUES (?,?,?,?,?) ON CONFLICT(owner,piece_id) DO UPDATE SET opened_at=excluded.opened_at, prefs=excluded.prefs, prefs_updated_at=excluded.prefs_updated_at`, params: COLUMNS.piece_views.map(c => v[c] ?? null) });
  for (const a of change.aliases) insert('tag_aliases', a);
  return out;
}

const literal = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? (Number.isFinite(v) ? String(v) : 'NULL') : `'${String(v).replaceAll("'", "''")}'`;
/** Statements as one SQL file, parameters inlined (wrangler's --file takes no bindings). */
export function renderSql(list) {
  return list.map(({ sql, params }) => { let i = 0; return sql.replace(/\?/g, () => literal(params[i++])) + ';'; }).join('\n') + '\n';
}

// ------------------------------------------------------------------ wrangler
function primaryState() {
  // The primary checkout (the one whose `.git` is the common dir) serves `npm run dev`.
  return run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root }).then(({ stdout }) => join(dirname(stdout.trim()), '.wrangler/state'));
}
/**
 * One library. A local one (a wrangler state directory) is opened in-process
 * through wrangler's platform proxy, as `npm run dev` seeds it: one D1 batch is
 * one transaction, and blobs move without booting a miniflare per object. The
 * deployed one is reached through the wrangler CLI.
 */
function side(label, persist) {
  const wrangler = async args => (await run(join(root, 'node_modules/.bin/wrangler'), args, { cwd: root, maxBuffer: 256 * 1024 * 1024, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } })).stdout;
  if (persist) {
    let proxy;
    const env = async () => (proxy ??= await (await import('wrangler')).getPlatformProxy({ configPath: join(root, 'wrangler.jsonc'), persist: { path: join(persist, 'v3') }, envFiles: [] })).env;
    return {
      label, describe: persist,
      async snapshot() {
        const db = (await env()).LIBRARY_DB;
        return Object.fromEntries(await Promise.all(TABLES.map(async t => [t, (await db.prepare(`SELECT * FROM ${t}`).all()).results])));
      },
      async execute(list) { const db = (await env()).LIBRARY_DB; await db.batch(list.map(({ sql, params }) => db.prepare(sql).bind(...params))); },
      // `d1 export` takes no --persist-to: the D1 state directory is the backup, restored by copying it back.
      async backupTo(dir) { await cp(join(persist, 'v3/d1'), join(dir, `${label}-d1`), { recursive: true }); },
      async get(key, file) { const object = await (await env()).LIBRARY_BUCKET.get(key); if (!object) throw new Error(`${label}: ${key} is missing`); await writeFile(file, Buffer.from(await object.arrayBuffer())); },
      async put(key, file, mime) { await (await env()).LIBRARY_BUCKET.put(key, await readFile(file), mime ? { httpMetadata: { contentType: mime } } : {}); },
      async close() { await proxy?.dispose(); },
    };
  }
  return {
    label, describe: 'deployed (remote)',
    async snapshot() {
      const out = JSON.parse(await wrangler(['d1', 'execute', DATABASE, '--remote', '--json', '--command', TABLES.map(t => `SELECT * FROM ${t}`).join('; ')]));
      if (!Array.isArray(out) || out.length !== TABLES.length || out.some(r => !r.success)) throw new Error(`${label}: unreadable snapshot`);
      return Object.fromEntries(TABLES.map((t, i) => [t, out[i].results]));
    },
    async execute(list) {
      const dir = await mkdtemp(join(tmpdir(), 'library-sync-sql-'));
      try { await writeFile(join(dir, 'sync.sql'), renderSql(list)); await wrangler(['d1', 'execute', DATABASE, '--remote', '--yes', '--file', join(dir, 'sync.sql')]); }
      finally { await rm(dir, { recursive: true, force: true }); }
    },
    // Data only: wrangler's schema dump does not load back (it creates pieces before
    // the renditions they reference). Restore onto a migrated database, minus d1_migrations.
    async backupTo(dir) { await wrangler(['d1', 'export', DATABASE, '--remote', '--no-schema', '--output', join(dir, `${label}.sql`)]); },
    async get(key, file) { await wrangler(['r2', 'object', 'get', `${BUCKET}/${key}`, '--remote', '--file', file]); },
    async put(key, file, mime) { await wrangler(['r2', 'object', 'put', `${BUCKET}/${key}`, '--remote', '--file', file, ...(mime ? ['--content-type', mime] : [])]); },
    async close() {},
  };
}

/** At most `size` at once; the first failure stops the queue. */
async function pool(items, size, work) {
  const queue = [...items];
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length && !failed) try { await work(queue.shift()); } catch (e) { failed = true; throw e; }
  }));
}

/** Blobs first: each copied, hash-checked against its content address, before any row names it. */
async function copyBlobs(from, to, blobs, scratch) {
  let done = 0;
  await pool([...blobs], 6, async ([key, mime]) => {
    const file = join(scratch, key.replace('/', '-'));
    await from.get(key, file);
    const sha = createHash('sha256').update(await readFile(file)).digest('hex');
    if (key !== `${key.split('/')[0]}/${sha}`) throw new Error(`${from.label}: ${key} does not hold the bytes its key names (${sha})`);
    await to.put(key, file, mime);
    await rm(file);
    if (++done % 20 === 0) console.error(`  ${to.label}: ${done}/${blobs.size} blobs`);
  });
}

function report(plan, names) {
  const lines = [];
  for (const [to, from] of [['a', 'b'], ['b', 'a']]) {
    const c = plan.into[to];
    lines.push(`\n${names[from]} → ${names[to]}: ${c.summary.length} piece${c.summary.length === 1 ? '' : 's'} changed, ${c.blobs.size} blob${c.blobs.size === 1 ? '' : 's'}, ${c.views.length} piece view${c.views.length === 1 ? '' : 's'} (last opened / setup)`);
    for (const s of c.summary) lines.push(`  ${s}`);
  }
  lines.push(`\nconflicts: ${plan.conflicts.length}`);
  for (const s of plan.conflicts) lines.push(`  ${s}`);
  return lines.join('\n');
}
const empty = plan => ['a', 'b'].every(s => !plan.into[s].summary.length && !plan.into[s].blobs.size && !plan.into[s].views.length);

const USAGE = `Usage: npm run sync:library -- [--apply --writers-stopped] [--local-state <dir>] [--remote-state <dir>] [--backup <dir>]

  Plans a two-way sync between the local dev library and the deployed one and
  prints it. --apply writes it, after backing both databases up to --backup
  (default ~/.cache/mnx-lab/library-sync/<time>): a local library's D1 state
  directory, copied; the deployed one's data, exported. --local-state defaults to the
  primary checkout's .wrangler/state; --remote-state replaces the deployed
  library with a local one (a rehearsal).`;

async function main(argv) {
  const flags = new Set(), values = {};
  for (let i = 0; i < argv.length; i++) {
    if (['--local-state', '--remote-state', '--backup'].includes(argv[i])) { if (!argv[i + 1]) throw new Error(USAGE); values[argv[i]] = resolve(argv[++i]); }
    else if (['--apply', '--writers-stopped', '--help'].includes(argv[i])) flags.add(argv[i]);
    else throw new Error(USAGE);
  }
  if (flags.has('--help')) return console.log(USAGE);
  if (flags.has('--apply') && !flags.has('--writers-stopped')) throw new Error('Stop every writer to BOTH libraries (dev servers on the local state, studio tabs on the deployed site), then pass --writers-stopped.');
  const local = side('local', values['--local-state'] ?? await primaryState());
  const remote = side('remote', values['--remote-state'] ?? null);
  try { await sync(local, remote, flags.has('--apply'), values['--backup']); }
  finally { await Promise.all([local.close(), remote.close()]); }
}

async function sync(local, remote, apply, backup) {
  const names = { a: 'local', b: 'remote' };
  console.error(`local:  ${local.describe}\nremote: ${remote.describe}`);
  const [a, b] = await Promise.all([local.snapshot(), remote.snapshot()]);
  const plan = planSync(a, b, names);
  console.log(report(plan, names));
  if (!apply || empty(plan)) return;

  backup ??= join(homedir(), '.cache/mnx-lab/library-sync', new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(backup, { recursive: true });
  await Promise.all([local.backupTo(backup), remote.backupTo(backup)]);
  console.error(`\nbackup: ${backup}`);
  // Nothing may have moved since the plan was read.
  const [a2, b2] = await Promise.all([local.snapshot(), remote.snapshot()]);
  if (JSON.stringify([a, b]) !== JSON.stringify([a2, b2])) throw new Error('A library changed while planning — a writer is still running. Nothing was written.');

  const scratch = await mkdtemp(join(tmpdir(), 'library-sync-'));
  try {
    await copyBlobs(remote, local, plan.into.a.blobs, scratch);
    await copyBlobs(local, remote, plan.into.b.blobs, scratch);
  } finally { await rm(scratch, { recursive: true, force: true }); }
  for (const [target, change] of [[local, plan.into.a], [remote, plan.into.b]]) {
    const list = statements(change);
    if (!list.length) continue;
    await writeFile(join(backup, `applied-${target.label}.sql`), renderSql(list));
    await target.execute(list);
    console.error(`${target.label}: ${list.length} statements`);
  }

  const after = planSync(...await Promise.all([local.snapshot(), remote.snapshot()]), names);
  if (!empty(after)) { console.log(`\nNOT converged — run again to finish, or read what remains:${report(after, names)}`); process.exitCode = 1; }
  else console.log(`\nconverged${after.conflicts.length ? `, with ${after.conflicts.length} conflict(s) left for a person` : ''}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });
}
