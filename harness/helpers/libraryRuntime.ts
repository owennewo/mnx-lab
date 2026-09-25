import { readdirSync, readFileSync } from 'node:fs';
import { afterAll } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

/** Sequential tests in one file share a process, never storage. Migrations still run
 * per test: some tests deliberately destroy schema. Do not use with it.concurrent. */
export function useLibraryRuntime({ bucket = true } = {}) {
  let runtime: Miniflare | undefined;
  afterAll(async () => { await runtime?.dispose(); });
  return async () => {
    if (!runtime) {
      runtime = new Miniflare(convertV4MiniflareOptions({
        modules: true,
        script: 'export default {fetch(){return new Response("test")}}',
        compatibilityDate: '2026-06-01',
        d1Databases: ['DB'],
        ...(bucket ? { r2Buckets: ['BUCKET'] } : {}),
      }));
    } else {
      const db = await runtime.getD1Database('DB');
      const { results } = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*'",
      ).all<{ name: string }>();
      if (results.length) {
        // D1 batch is a transaction; defer cyclic foreign keys until every table is gone.
        // https://developers.cloudflare.com/d1/sql-api/foreign-keys/
        const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
        await db.batch([
          db.prepare('PRAGMA defer_foreign_keys = ON'),
          ...results.map(({ name }) => db.prepare(`DROP TABLE ${quote(name)}`)),
        ]);
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
    }
    return runtime;
  };
}

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
    LIBRARY_DB: await mf.getD1Database('DB') as unknown as D1Database,
    LIBRARY_BUCKET: await mf.getR2Bucket('BUCKET') as unknown as R2Bucket,
  };
}
