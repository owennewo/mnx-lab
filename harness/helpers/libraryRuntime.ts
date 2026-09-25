import { readdirSync, readFileSync } from 'node:fs';
import { afterAll } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { D1_EXECUTOR_SCRIPT, executorD1 } from './d1Executor.ts';

/** Sequential tests in one file share a process, never storage. Do not use with it.concurrent.
 *
 *  By default each call hands back an EMPTY database (every table dropped) and bucket.
 *  With `migrated`, it hands back the migrated schema with no rows: the schema is
 *  applied once, and between tests only the rows are deleted (~55 ms against ~120 ms
 *  for dropping and migrating again). A test that alters the schema on purpose needs
 *  nothing special — the schema is compared with the pristine one on every reset, and
 *  any difference rebuilds it from the migrations. */
export function useLibraryRuntime({ bucket = true, migrated = false } = {}) {
  let runtime: Miniflare | undefined;
  let pristine: string | undefined;
  afterAll(async () => { await runtime?.dispose(); });
  const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
  return async () => {
    if (!runtime) {
      runtime = new Miniflare(convertV4MiniflareOptions({
        modules: true,
        // Executes D1 calls sent from Node in one request each (./d1Executor.ts).
        script: D1_EXECUTOR_SCRIPT,
        compatibilityDate: '2026-06-01',
        d1Databases: ['DB'],
        ...(bucket ? { r2Buckets: ['BUCKET'] } : {}),
      }));
      if (migrated) {
        const db = executorD1(runtime);
        await applyMigrations(db);
        pristine = signature(await schema(db));
      }
      return runtime;
    }
    const db = executorD1(runtime);
    const objects = await schema(db);
    const tables = objects.filter(object => object.type === 'table').map(object => object.name);
    // D1 batch is a transaction; defer cyclic foreign keys until it commits.
    // https://developers.cloudflare.com/d1/sql-api/foreign-keys/
    if (migrated && signature(objects) === pristine) {
      if (tables.length) await db.batch([db.prepare('PRAGMA defer_foreign_keys = ON'), ...tables.map(name => db.prepare(`DELETE FROM ${quote(name)}`))]);
    } else {
      if (tables.length) await db.batch([db.prepare('PRAGMA defer_foreign_keys = ON'), ...tables.map(name => db.prepare(`DROP TABLE ${quote(name)}`))]);
      if (migrated) await applyMigrations(db);
    }
    if (bucket) {
      const storage = await runtime.getR2Bucket('BUCKET');
      // Re-list after deletion, avoiding cursors into a changing result set.
      for (;;) {
        const page = await storage.list({ limit: 1000 });
        if (!page.objects.length) break;
        await storage.delete(page.objects.map(object => object.key));
      }
    }
    return runtime;
  };
}

type SchemaObject = { type: string; name: string; sql: string | null };
async function schema(db: { prepare(sql: string): { all<T>(): Promise<{ results: T[] }> } }): Promise<SchemaObject[]> {
  const { results } = await db.prepare(
    "SELECT type, name, sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' ORDER BY type, name",
  ).all<SchemaObject>();
  return results;
}
const signature = (objects: SchemaObject[]) => objects.map(o => `${o.type}:${o.name}:${o.sql ?? ''}`).join('\n');

const MIGRATIONS = new URL('../../migrations/', import.meta.url);

/** Anything that can prepare and batch statements — the D1 binding or Miniflare's proxy of it. */
interface Batching { prepare(sql: string): unknown; batch(statements: never[]): Promise<unknown> }

/**
 * Every migration in migrations/, in order — the schema production has — as ONE
 * batch. Nine test files used to keep hand-written lists that had drifted apart
 * (library.test lacked 0002 and 0004, library-users stopped at 0005, two built
 * their own `users` table) and paid a round trip per file. The migrations hold
 * only CREATE and ALTER statements, so they split between those; anything else
 * is refused rather than mis-split, so a new kind of statement is noticed.
 */
export async function applyMigrations(db: Batching): Promise<void> {
  const statements = readdirSync(MIGRATIONS).filter(name => name.endsWith('.sql')).sort().flatMap(name =>
    readFileSync(new URL(name, MIGRATIONS), 'utf8').replace(/--[^\n]*/g, '').trim()
      .split(/;\s*(?=(?:CREATE|ALTER)\b)/).map(sql => {
        if (!/^(CREATE|ALTER)\b/.test(sql)) throw new Error(`migrations/${name}: cannot split a statement that is not CREATE or ALTER: ${sql.slice(0, 60)}`);
        return sql;
      }));
  await db.batch(statements.map(sql => db.prepare(sql)) as never[]);
}

/** The storage bindings as the Worker sees them. Miniflare types its Node-side
 *  R2 proxy against undici's Headers, not the Workers runtime's; it IS the
 *  Worker's R2Bucket, so the one cast lives here rather than in every test. */
export async function libraryBindings(mf: Miniflare): Promise<{ LIBRARY_DB: D1Database; LIBRARY_BUCKET: R2Bucket }> {
  return {
    LIBRARY_DB: libraryDatabase(mf),
    LIBRARY_BUCKET: await mf.getR2Bucket('BUCKET') as unknown as R2Bucket,
  };
}

/** The runtime's D1, through the one-request executor rather than Miniflare's proxy. */
export const libraryDatabase = (mf: Miniflare): D1Database => executorD1(mf);
