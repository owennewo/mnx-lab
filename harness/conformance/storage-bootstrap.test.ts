// Implementation loop: provisioning retries must never replace a live library.
import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrap, UNPROVISIONED } from '../../tools/bootstrap-storage.mjs';

const dirs: string[] = [];
const uuid = '12345678-1234-1234-1234-123456789abc';
function fixture(id = UNPROVISIONED) {
  const dir = mkdtempSync(join(tmpdir(), 'storage-bootstrap-'));
  dirs.push(dir);
  const path = join(dir, 'wrangler.jsonc');
  writeFileSync(path, JSON.stringify({
    account_id: 'test-account',
    d1_databases: [{ binding: 'LIBRARY_DB', database_name: 'library', database_id: id }],
    r2_buckets: [{ binding: 'LIBRARY_BUCKET', bucket_name: 'library' }]
  }));
  return path;
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true }); });

it('creates once, commits the UUID, then does only discovery on a rerun', () => {
  const path = fixture();
  let database = false;
  let bucket = false;
  const creates: string[] = [];
  const run = (args: string[], account: string) => {
    expect(account).toBe('test-account');
    const cmd = args.join(' ');
    if (cmd === 'd1 list --json') return JSON.stringify(database ? [{ name: 'library', uuid }] : []);
    if (cmd === 'r2 bucket list') return `Listing buckets...\nname: library-other\n${bucket ? 'name: library\n' : ''}`;
    creates.push(cmd);
    if (cmd === 'd1 create library --update-config=false') database = true;
    else if (cmd === 'r2 bucket create library --update-config=false') bucket = true;
    else throw new Error(cmd);
    return '';
  };
  bootstrap(path, run);
  const saved = readFileSync(path, 'utf8');
  expect(saved).toContain(uuid);
  bootstrap(path, run);
  expect(readFileSync(path, 'utf8')).toBe(saved);
  expect(creates).toEqual(['d1 create library --update-config=false', 'r2 bucket create library --update-config=false']);
});

it('recovers from a partial run without recreating the successful database', () => {
  const path = fixture();
  const commands: string[] = [];
  let fail = true;
  const run = (args: string[]) => {
    const cmd = args.join(' ');
    commands.push(cmd);
    if (cmd === 'd1 list --json') return JSON.stringify([{ name: 'library', uuid }]);
    if (cmd === 'r2 bucket list') return 'Listing buckets...\n';
    if (cmd === 'r2 bucket create library --update-config=false') {
      if (fail) throw new Error('account failure');
      return '';
    }
    throw new Error(cmd);
  };
  expect(() => bootstrap(path, run)).toThrow('account failure');
  expect(readFileSync(path, 'utf8')).toContain(UNPROVISIONED);
  fail = false;
  bootstrap(path, run);
  expect(readFileSync(path, 'utf8')).toContain(uuid);
  expect(commands.some(c => c.startsWith('d1 create'))).toBe(false);
});

it.each([{ databases: [] }, { databases: [{ name: 'library', uuid: '87654321-1234-1234-1234-123456789abc' }] }])(
  'refuses a missing or mismatched committed database', ({ databases }) => {
    const path = fixture(uuid);
    const commands: string[][] = [];
    expect(() => bootstrap(path, (args: string[]) => {
      commands.push(args);
      return JSON.stringify(databases);
    })).toThrow('D1 UUID differs');
    expect(commands).toEqual([['d1', 'list', '--json']]);
  }
);

it('propagates discovery errors before creating anything', () => {
  const path = fixture();
  expect(() => bootstrap(path, () => { throw new Error('unauthorized'); })).toThrow('unauthorized');
  expect(readFileSync(path, 'utf8')).toContain(UNPROVISIONED);
});
