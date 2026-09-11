#!/usr/bin/env node
// Implementation-loop infrastructure only. Never writes library data or secrets.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
export const UNPROVISIONED = '00000000-0000-0000-0000-000000000000';

// Inject the command runner in the harness: no account is needed to test retries.
export function bootstrap(configPath, run) {
  const source = readFileSync(configPath, 'utf8');
  const { config, error } = ts.parseConfigFileTextToJson(configPath, source);
  if (error) throw new Error('Cannot parse wrangler.jsonc');
  const db = config.d1_databases?.find(b => b.binding === 'LIBRARY_DB');
  const bucket = config.r2_buckets?.find(b => b.binding === 'LIBRARY_BUCKET');
  if (!config.account_id || !db?.database_name || !db.database_id || !bucket?.bucket_name) {
    throw new Error('Expected account_id, LIBRARY_DB and LIBRARY_BUCKET in wrangler.jsonc');
  }
  const invoke = args => run(args, config.account_id);
  const findDatabase = () => {
    const databases = JSON.parse(invoke(['d1', 'list', '--json']));
    if (!Array.isArray(databases)) throw new Error('Unexpected D1 list output');
    const matches = databases.filter(d => d.name === db.database_name);
    if (matches.length > 1) throw new Error('Ambiguous D1 database name');
    return matches[0];
  };
  let database = findDatabase();
  // A missing or changed committed database must never silently become a new library.
  if (db.database_id !== UNPROVISIONED && database?.uuid !== db.database_id) {
    throw new Error('D1 UUID differs from wrangler.jsonc; check the account and database before proceeding');
  }
  // Wrangler 4.99 has no JSON flag for R2 list. Match complete labelled names only.
  const buckets = invoke(['r2', 'bucket', 'list']);
  if (!buckets.includes('Listing buckets...')) throw new Error('Unexpected R2 list output');
  const bucketNames = [...buckets.matchAll(/^name:\s+(\S+)\s*$/gm)].map(m => m[1]);
  if (!database) {
    invoke(['d1', 'create', db.database_name, '--update-config=false']);
    database = findDatabase();
  }
  if (!database || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(database.uuid)) {
    throw new Error('D1 create did not yield a database UUID');
  }
  if (!bucketNames.includes(bucket.bucket_name)) {
    invoke(['r2', 'bucket', 'create', bucket.bucket_name, '--update-config=false']);
  }
  if (db.database_id !== database.uuid) {
    const oldId = JSON.stringify(db.database_id);
    if (source.split(oldId).length !== 2) throw new Error('D1 UUID is not unique in config');
    writeFileSync(configPath, source.replace(oldId, JSON.stringify(database.uuid)));
  }
  return { databaseId: database.uuid, bucketName: bucket.bucket_name };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('Usage: node tools/bootstrap-storage.mjs');
    const configPath = resolve(root, 'wrangler.jsonc');
    const result = bootstrap(configPath, (args, accountId) => {
      console.log(`wrangler ${args.join(' ')}`);
      // Pin the account even for account-level commands that skip project config.
      return execFileSync(resolve(root, 'node_modules/.bin/wrangler'), args, {
        cwd: root,
        env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, NO_COLOR: '1', CI: 'true' },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit']
      });
    });
    console.log(`Ready: LIBRARY_DB=${result.databaseId}, LIBRARY_BUCKET=${result.bucketName}`);
    console.log('No secret or deployment changed. Set LIBRARY_WRITE_TOKEN separately before the first deploy.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
