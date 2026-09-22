import { afterAll } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

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
