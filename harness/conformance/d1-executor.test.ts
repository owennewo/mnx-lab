// The library tests reach D1 through a one-request executor (helpers/d1Executor.ts)
// instead of Miniflare's proxy, for speed. It must be indistinguishable: every case
// here runs through BOTH, against the same database, and must give the same result
// or the same error — values JSON would change, D1's own errors, and transactions.
import { expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { libraryDatabase, useLibraryRuntime } from '../helpers/libraryRuntime.ts';

const fresh = useLibraryRuntime({ bucket: false });

async function both() {
  const mf = await fresh();
  const proxy = await mf.getD1Database('DB') as unknown as D1Database;
  const executor = libraryDatabase(mf);
  await proxy.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, v, UNIQUE(v))');
  return { proxy, executor };
}
/** The outcome of a call, comparable across routes: a value, or an error's message —
 *  thrown synchronously (as bind() does) or rejected. */
const outcome = async (call: () => Promise<unknown>) => {
  try { return { value: await call() }; } catch (error) { return { error: (error as Error).message }; }
};
/** Run results carry timings; the rest must match. */
const stable = (value: unknown) => JSON.parse(JSON.stringify(value, (key, v) => (key === 'duration' || key === 'timings' || key === 'served_by' || key === 'served_by_region' || key === 'served_by_primary' || key === 'total_attempts' ? undefined : v)));

it('binds what JSON would change exactly as D1 does', async () => {
  const { proxy, executor } = await both();
  for (const value of [undefined, NaN, Infinity, 10n, 'text', 1.5, null, true]) {
    await proxy.exec('DELETE FROM t');
    const viaProxy = await outcome(() => proxy.prepare('INSERT INTO t(v) VALUES (?)').bind(value).run());
    const readBack = await outcome(() => proxy.prepare('SELECT v FROM t').all());
    await proxy.exec('DELETE FROM t');
    const viaExecutor = await outcome(() => executor.prepare('INSERT INTO t(v) VALUES (?)').bind(value).run());
    expect(stable(viaExecutor), String(value)).toEqual(stable(viaProxy));
    expect(stable(await outcome(() => executor.prepare('SELECT v FROM t').all())), String(value)).toEqual(stable(readBack));
  }
});

it('raises D1’s own error, message and all', async () => {
  const { proxy, executor } = await both();
  await proxy.prepare('INSERT INTO t(v) VALUES (?)').bind('same').run();
  const viaProxy = await outcome(() => proxy.prepare('INSERT INTO t(v) VALUES (?)').bind('same').run());
  const viaExecutor = await outcome(() => executor.prepare('INSERT INTO t(v) VALUES (?)').bind('same').run());
  expect(viaExecutor).toEqual(viaProxy);
  expect(JSON.stringify(viaExecutor)).toContain('UNIQUE constraint failed');
});

it('reports changes, first() by column, and exec the same way', async () => {
  const { proxy, executor } = await both();
  await proxy.prepare('INSERT INTO t(v) VALUES (?)').bind('a').run();
  const viaExecutor = await executor.prepare('UPDATE t SET v = ? WHERE v = ?').bind('b', 'a').run();
  await proxy.prepare('UPDATE t SET v = ? WHERE v = ?').bind('a', 'b').run();
  const viaProxy = await proxy.prepare('UPDATE t SET v = ? WHERE v = ?').bind('b', 'a').run();
  expect(stable(viaExecutor)).toEqual(stable(viaProxy));
  expect(await executor.prepare('SELECT v FROM t').first('v')).toBe(await proxy.prepare('SELECT v FROM t').first('v'));
  expect(await executor.prepare('SELECT v FROM t WHERE v = ?').bind('none').first()).toBe(null);
  expect(stable(await outcome(() => executor.exec('SELECT 1')))).toEqual(stable(await outcome(() => proxy.exec('SELECT 1'))));
});

it('rolls a failing batch back as one transaction', async () => {
  const { proxy, executor } = await both();
  await proxy.prepare('INSERT INTO t(v) VALUES (?)').bind('taken').run();
  const batch = (db: D1Database) => db.batch([
    db.prepare('INSERT INTO t(v) VALUES (?)').bind('first'),
    db.prepare('INSERT INTO t(v) VALUES (?)').bind('taken'),
  ]);
  const viaExecutor = await outcome(() => batch(executor));
  expect(await executor.prepare("SELECT COUNT(*) AS n FROM t WHERE v = 'first'").first('n')).toBe(0);
  const viaProxy = await outcome(() => batch(proxy));
  expect(viaExecutor).toEqual(viaProxy);
});
