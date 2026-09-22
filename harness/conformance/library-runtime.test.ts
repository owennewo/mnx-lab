import { expect, it } from 'vitest';
import { useLibraryRuntime } from '../helpers/libraryRuntime.ts';

const freshRuntime = useLibraryRuntime();
it('reuses the runtime while discarding schema, cyclic rows and blobs', async () => {
  const first = await freshRuntime();
  const db = await first.getD1Database('DB');
  const bucket = await first.getR2Bucket('BUCKET');
  await db.batch([
    db.prepare('CREATE TABLE a(id INTEGER PRIMARY KEY, other INTEGER REFERENCES b(id))'),
    db.prepare('CREATE TABLE b(id INTEGER PRIMARY KEY, other INTEGER REFERENCES a(id))'),
    db.prepare('PRAGMA defer_foreign_keys = ON'),
    db.prepare('INSERT INTO a VALUES(1, 1)'),
    db.prepare('INSERT INTO b VALUES(1, 1)'),
  ]);
  await bucket.put('leftover', 'old test');
  expect(await freshRuntime()).toBe(first);
  expect((await db.prepare("SELECT name FROM sqlite_master WHERE name IN ('a','b')").all()).results).toEqual([]);
  expect((await bucket.list()).objects).toEqual([]);
  await db.exec('CREATE TABLE a(changed TEXT)');
  await db.exec('DROP TABLE a');
  await freshRuntime();
  await db.exec('CREATE TABLE a(id INTEGER PRIMARY KEY)');
  expect((await db.prepare('PRAGMA foreign_keys').first())?.foreign_keys).toBe(1);
}, 15000);
