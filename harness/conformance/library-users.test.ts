// Implementation loop: pre-provisioned users preserve existing library owner identities.
import { beforeEach, afterEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';
let mf: Miniflare;
let db: D1Database;
beforeEach(async () => {
  mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-06-01', d1Databases: ['DB'] });
  db = await mf.getD1Database('DB');
  for (const name of ['0001_library.sql', '0002_users.sql']) {
    const sql = readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8');
    await db.batch(sql.replace(/--[^\n]*/g, '').trim().split(/;\s*(?=CREATE\b)/).map(s => db.prepare(s)));
  }
}, 15000);
afterEach(async () => { await mf?.dispose(); });
it('requires unique normalized email, nonempty stable identity and boolean activity', async () => {
  const add = (id: string, email: string, active = 1) => db.prepare('INSERT INTO users (id,email,active,created_at) VALUES (?,?,?,?)').bind(id,email,active,'2026-09-11').run();
  await add('operator','owner@example.com');
  await expect(add('other','owner@example.com')).rejects.toThrow();
  await expect(add('other','Owner@example.com')).rejects.toThrow();
  await expect(add('other',' owner@example.com ')).rejects.toThrow();
  await expect(add('','other@example.com')).rejects.toThrow();
  await expect(add('other','other@example.com',2)).rejects.toThrow();
  expect((await db.prepare('SELECT COUNT(*) AS n FROM users').first())?.n).toBe(1);
});
it('links an existing piece by owner id without updating its revision or timestamp', async () => {
  await db.prepare("INSERT INTO pieces (id,owner,revision,created_at,updated_at) VALUES ('piece','operator',7,'before','before')").run();
  await db.prepare("INSERT INTO users (id,email,active,created_at) VALUES ('operator','owner@example.com',1,'now')").run();
  expect(await db.prepare('SELECT u.email,p.revision,p.updated_at FROM pieces p JOIN users u ON u.id=p.owner WHERE p.id=?').bind('piece').first()).toEqual({ email: 'owner@example.com', revision: 7, updated_at: 'before' });
  await db.prepare("UPDATE users SET active=0 WHERE id='operator'").run();
  expect(await db.prepare('SELECT p.id FROM pieces p JOIN users u ON u.id=p.owner WHERE u.active=1').first()).toBeNull();
});
