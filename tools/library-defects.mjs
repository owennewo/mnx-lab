#!/usr/bin/env node
// Personal operator tool: what Studio's saves lost, pulled out as converter work.
//
// Studio stores `.gp` and works in MNX, so every save crosses the Guitar Pro
// exporter and is checked for what did not survive (roadmap: studio-campaign-
// authoring, clauses 3–4). A save that lost something is stored with its check,
// and — once per new kind of loss — with the document it was exported from.
// This lists those saves and writes each as a directory a converter test can be
// built from:
//
//   <out>/<piece>/<rendition>/check.json       verdict, difference shapes, warnings
//   <out>/<piece>/<rendition>/stored.gp        what was saved
//   <out>/<piece>/<rendition>/saved.mnx.json   what it was saved FROM (when kept)
//
// The music is the owner's and mostly copyrighted: `--out` must be OUTSIDE the
// repo, and what becomes a committed fixture is a person's decision, made on a
// reduced example. Same credentials as the ingest (tools/library-ingest.mjs).
import { mkdir, writeFile, realpath } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { operatorCredentials } from './library-ingest.mjs';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
function required(value, label) { if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${label}`); return value; }
const safe = name => name.replace(/[^A-Za-z0-9._-]/g, '_');

/** The listing as rows a person can scan: one per defective save, its losses collapsed. */
export function defectRows(defects) {
  return defects.map(d => ({
    piece: d.piece_id, rendition: d.rendition_id, saved: d.created_at, build: d.producer_version,
    evidence: d.evidence_id ? 'kept' : (d.provenance?.evidence ?? 'none'),
    lost: (d.provenance?.check?.differences ?? []).filter(x => x.kind !== 'gained').map(x => `${x.kind} ${x.count}x ${x.path}`),
    warned: d.provenance?.check?.warnings ?? []
  }));
}

async function main(args) {
  let out; let endpoint = 'https://mnx-lab.totai.uk'; let tokenFile; let accessFile; let localSessionFile; let listOnly = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') out = required(args[++i], 'output directory');
    else if (a === '--list') listOnly = true;
    else if (a === '--endpoint') endpoint = required(args[++i], 'endpoint');
    else if (a === '--token-file') tokenFile = required(args[++i], 'token file');
    else if (a === '--access-token-file') accessFile = required(args[++i], 'Access token file');
    else if (a === '--local-session-file') localSessionFile = required(args[++i], 'local session file');
    else throw new Error('Usage: npm run defects:library -- (--list | --out <dir outside the repo>) [--endpoint <origin>] [--token-file <path>] [--access-token-file <path> | --local-session-file <path>]');
  }
  if (!listOnly) {
    out = resolve(required(out, '--out <dir> (or --list)'));
    if (out === root || out.startsWith(root + sep)) throw new Error('--out must be outside the repository: this is private music');
  }
  const { token, access } = await operatorCredentials({ endpoint, tokenFile, accessFile, localSessionFile });
  const get = async path => {
    const response = await fetch(`${endpoint}/api/library/ingest/studio${path}`, { headers: { Authorization: `Bearer ${token}`, ...access }, redirect: 'error' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response;
  };
  const { defects } = await (await get('/defects')).json();
  for (const row of defectRows(defects)) console.log(JSON.stringify(row));
  if (listOnly || !defects.length) { console.log(`${defects.length} save(s) lost something.`); return; }
  for (const d of defects) {
    const dir = join(out, safe(d.piece_id), safe(d.rendition_id));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'check.json'), JSON.stringify({ piece: d.piece_id, rendition: d.rendition_id, saved: d.created_at, build: d.producer_version, ...d.provenance }, null, 2) + '\n');
    await writeFile(join(dir, 'stored.gp'), new Uint8Array(await (await get(`/renditions/${encodeURIComponent(d.rendition_id)}`)).arrayBuffer()));
    if (d.evidence_id) await writeFile(join(dir, 'saved.mnx.json'), new Uint8Array(await (await get(`/renditions/${encodeURIComponent(d.evidence_id)}`)).arrayBuffer()));
  }
  console.log(`${defects.length} save(s) written under ${out}. Reduce before committing anything: this is private music.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
