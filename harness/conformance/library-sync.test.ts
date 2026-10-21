import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node-only operator tool has no declaration file.
import { planSync, statements, renderSql } from '../../tools/library-sync.mjs';

// Two real libraries: the migrations (revision trigger included), the planned
// SQL executed as wrangler would run it, and a second plan that must be empty.
type Row = Record<string, string | number | null>;
const MIGRATIONS = new URL('../../migrations/', import.meta.url);
const TABLES = ['pieces', 'renditions', 'recordings', 'tags', 'tag_aliases', 'piece_views', 'd1_migrations'];

function library() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON; CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT)');
  for (const name of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(name, MIGRATIONS), 'utf8'));
    db.prepare('INSERT INTO d1_migrations (name, applied_at) VALUES (?, ?)').run(name, 'then');
  }
  return db;
}
const insert = (db: DatabaseSync, table: string, row: Row) =>
  db.prepare(`INSERT INTO ${table} (${Object.keys(row)}) VALUES (${Object.keys(row).map(() => '?')})`).run(...Object.values(row));
const snapshot = (db: DatabaseSync) => Object.fromEntries(TABLES.map(t => [t, db.prepare(`SELECT * FROM ${t}`).all().map(r => ({ ...r }))]));
function sync(a: DatabaseSync, b: DatabaseSync) {
  const plan = planSync(snapshot(a), snapshot(b));
  a.exec(renderSql(statements(plan.into.a)));
  b.exec(renderSql(statements(plan.into.b)));
  return plan;
}
const quiet = (plan: { into: Record<'a' | 'b', { summary: string[]; views: unknown[]; blobs: Map<string, unknown> }> }) =>
  (['a', 'b'] as const).every(s => !plan.into[s].summary.length && !plan.into[s].views.length && !plan.into[s].blobs.size);

const T = (day: number) => `2026-10-${String(day).padStart(2, '0')}T00:00:00.000Z`;
function piece(db: DatabaseSync, id: string, { revision = 0, updated = 1, deleted = null as string | null } = {}) {
  insert(db, 'pieces', { id, owner: 'operator', source_kind: 'soundslice', source_id: id, revision, created_at: T(1), updated_at: T(updated), deleted_at: deleted });
}
function rendition(db: DatabaseSync, piece: string, id: string, { role = 'export', from = null as string | null, day = 1 } = {}) {
  insert(db, 'renditions', { id, piece_id: piece, format: 'gp', role, sha256: id.padEnd(64, '0'), r2_key: `renditions/${id.padEnd(64, '0')}`, bytes: 1, producer: 'studio', derived_from: from, created_at: T(day) });
}
const canonical = (db: DatabaseSync, piece: string, id: string) => db.prepare('UPDATE pieces SET canonical_rendition_id=? WHERE id=?').run(id, piece);
const row = (db: DatabaseSync, sql: string, ...params: string[]) => ({ ...db.prepare(sql).get(...params) });

describe('library sync', () => {
  it('copies a piece one side lacks, its edit lineage in order, and converges', () => {
    const [a, b] = [library(), library()];
    piece(a, 'p1', { revision: 3, updated: 5 });
    rendition(a, 'p1', 'o', { role: 'original', day: 2 });
    rendition(a, 'p1', 'e1', { role: 'edit', from: 'o', day: 3 });
    rendition(a, 'p1', 'e2', { role: 'edit', from: 'e1', day: 1 }); // a skewed clock: dated before its parents
    canonical(a, 'p1', 'e2');
    insert(a, 'tags', { owner: 'operator', piece_id: 'p1', dimension: 'title', value: 'Song', origin: 'derived' });
    insert(a, 'piece_views', { owner: 'operator', piece_id: 'p1', opened_at: T(5), prefs: '{"x":1}', prefs_updated_at: T(5) });
    const plan = sync(a, b);
    expect([...plan.into.b.blobs.keys()]).toHaveLength(3);
    expect(row(b, 'SELECT canonical_rendition_id c, revision r FROM pieces')).toEqual({ c: 'e2', r: 3 });
    expect(row(b, 'SELECT prefs FROM piece_views').prefs).toBe('{"x":1}');
    expect(quiet(planSync(snapshot(a), snapshot(b)))).toBe(true);
  });

  it('fast-forwards each pointer along derived_from, one revision each, and takes the derived tags along', () => {
    const [a, b] = [library(), library()];
    for (const db of [a, b]) for (const id of ['p1', 'p2']) { piece(db, id, { revision: 1 }); rendition(db, id, `${id}x`); canonical(db, id, `${id}x`); }
    rendition(a, 'p1', 'p1e', { role: 'edit', from: 'p1x', day: 4 }); canonical(a, 'p1', 'p1e'); // a is ahead on p1
    rendition(b, 'p2', 'p2e', { role: 'edit', from: 'p2x', day: 4 }); canonical(b, 'p2', 'p2e'); // b is ahead on p2
    insert(a, 'tags', { owner: 'operator', piece_id: 'p1', dimension: 'capo', value: '2', origin: 'derived' });
    insert(b, 'tags', { owner: 'operator', piece_id: 'p1', dimension: 'capo', value: '0', origin: 'derived' });
    const plan = sync(a, b);
    expect(plan.conflicts).toEqual([]);
    for (const db of [a, b]) {
      expect(row(db, "SELECT canonical_rendition_id c FROM pieces WHERE id='p1'").c).toBe('p1e');
      expect(row(db, "SELECT canonical_rendition_id c FROM pieces WHERE id='p2'").c).toBe('p2e');
      expect(row(db, "SELECT value FROM tags WHERE piece_id='p1' AND dimension='capo'").value).toBe('2');
    }
    expect(row(b, "SELECT revision r FROM pieces WHERE id='p1'").r).toBe(2);
    expect(row(a, "SELECT revision r FROM pieces WHERE id='p1'").r).toBe(1);
    expect(quiet(planSync(snapshot(a), snapshot(b)))).toBe(true);
  });

  it('leaves a pointer alone when both sides saved past their common version, but keeps both lines', () => {
    const [a, b] = [library(), library()];
    for (const db of [a, b]) { piece(db, 'p1'); rendition(db, 'p1', 'base'); }
    rendition(a, 'p1', 'ea', { role: 'edit', from: 'base' }); canonical(a, 'p1', 'ea');
    rendition(b, 'p1', 'eb', { role: 'edit', from: 'base' }); canonical(b, 'p1', 'eb');
    const plan = sync(a, b);
    expect(plan.conflicts).toHaveLength(1);
    expect(row(a, 'SELECT canonical_rendition_id c FROM pieces').c).toBe('ea');
    expect(row(b, 'SELECT canonical_rendition_id c FROM pieces').c).toBe('eb');
    for (const db of [a, b]) expect(row(db, 'SELECT count(*) n FROM renditions').n).toBe(3);
  });

  it('takes the newer recording, keeps either side\'s duration, and merges provenance', () => {
    const [a, b] = [library(), library()];
    const recording = { id: 'r1', piece_id: 'p1', kind: 'youtube', external_id: 'yt', created_at: T(1) };
    for (const db of [a, b]) piece(db, 'p1');
    insert(a, 'recordings', { ...recording, name: 'Video', syncpoints: '[[0,1]]', duration_s: 138, provenance: '{"scoreShape":"4x1/1"}', updated_at: T(2) });
    insert(b, 'recordings', { ...recording, name: 'Video', syncpoints: '[[0,2]]', duration_s: null, provenance: '{"source":"wrapper"}', updated_at: T(3) });
    sync(a, b);
    for (const db of [a, b]) expect(row(db, 'SELECT syncpoints, duration_s, provenance FROM recordings')).toEqual({
      syncpoints: '[[0,2]]', duration_s: 138, provenance: '{"scoreShape":"4x1/1","source":"wrapper"}' });
    expect(quiet(planSync(snapshot(a), snapshot(b)))).toBe(true);
  });

  it('follows the later piece row for deletion and asserted tags, and the later view for prefs', () => {
    const [a, b] = [library(), library()];
    piece(a, 'p1', { updated: 9, deleted: T(9) }); piece(b, 'p1', { updated: 4 });
    insert(a, 'tags', { owner: 'operator', piece_id: 'p1', dimension: 'list', value: 'Gig', origin: 'asserted' });
    insert(b, 'tags', { owner: 'operator', piece_id: 'p1', dimension: 'list', value: 'Old', origin: 'asserted' });
    insert(a, 'piece_views', { owner: 'operator', piece_id: 'p1', opened_at: T(9), prefs: '{"old":1}', prefs_updated_at: T(2) });
    insert(b, 'piece_views', { owner: 'operator', piece_id: 'p1', opened_at: T(4), prefs: '{"new":1}', prefs_updated_at: T(4) });
    sync(a, b);
    for (const db of [a, b]) {
      expect(row(db, 'SELECT deleted_at d FROM pieces').d).toBe(T(9));
      expect(db.prepare('SELECT value FROM tags').all().map(t => t.value)).toEqual(['Gig']);
      expect(row(db, 'SELECT opened_at, prefs FROM piece_views')).toEqual({ opened_at: T(9), prefs: '{"new":1}' });
    }
    expect(quiet(planSync(snapshot(a), snapshot(b)))).toBe(true);
  });

  it('refuses libraries on different migrations', () => {
    const [a, b] = [library(), library()];
    b.exec("DELETE FROM d1_migrations WHERE name LIKE '0006%'");
    expect(() => planSync(snapshot(a), snapshot(b))).toThrow('Schema differs');
  });

  it('inlines parameters as SQL literals', () => {
    expect(renderSql([{ sql: 'INSERT INTO t VALUES (?,?,?)', params: ["it's", null, 1.5] }])).toBe("INSERT INTO t VALUES ('it''s',NULL,1.5);\n");
  });
});
