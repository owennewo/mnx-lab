#!/usr/bin/env node
// Personal operator tool. Cache bytes and credentials never enter a build face.
import { readFile, readdir, realpath, stat, lstat } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = (...parts) => hash(JSON.stringify(parts));
const maxBytes = 24 * 1024 * 1024;
function required(value, label) { if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${label}`); return value; }
async function optional(path) { try { return await readFile(path); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
async function cacheFile(directory, name) {
  if (basename(name) !== name || name === '.' || name === '..') throw new Error('Cache paths must be plain filenames');
  const path = join(directory, name);
  const bytes = await optional(path);
  if (bytes && dirname(await realpath(path)) !== directory) throw new Error('Cache symlink escapes input directory');
  return bytes;
}
export async function buildConverters() {
  const converters = {};
  for (const name of ['guitarpro-mnx', 'musicxml-mnx']) {
    const relative = `converters/${name}`;
    const dirty = execFileSync('git', ['status', '--porcelain', '--', relative], { cwd: root, encoding: 'utf8' });
    if (dirty.trim()) throw new Error(`Commit ${relative} changes before recording converter provenance`);
    execFileSync('npm', ['run', 'build', '-w', `@mnx-editor/${name}`], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const pkg = JSON.parse(await readFile(join(root, relative, 'package.json'), 'utf8'));
    // Last source commit stays stable when unrelated app/roadmap commits land.
    const sha = execFileSync('git', ['log', '-1', '--format=%H', '--', relative], { cwd: root, encoding: 'utf8' }).trim();
    const module = await import(pathToFileURL(join(root, relative, 'dist/index.js')).href);
    converters[name] = { producer: name, version: `${pkg.version}+git.${sha}`, options: { package_version: pkg.version, git_sha: sha, flags: ['--import'], encoding_date: false },
      convert: name === 'guitarpro-mnx' ? bytes => module.importGuitarPro(new Uint8Array(bytes)) : bytes => module.importMxl(new Uint8Array(bytes)) };
  }
  return converters;
}
async function readIndex(directory) {
  const path = join(dirname(directory), 'index.sqlite');
  try { await stat(path); } catch (error) { if (error.code === 'ENOENT') return new Map(); throw error; }
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path, { readOnly: true });
  try { return new Map(db.prepare('SELECT key,data,fetched_at FROM entries').all().map(r => [r.key, { ...JSON.parse(r.data), fetched_at: r.fetched_at }])); }
  finally { db.close(); }
}
export async function planIngest(inputDirectory, converters) {
  const directory = await realpath(inputDirectory);
  const index = await readIndex(directory);
  const names = await readdir(directory);
  const stems = [...new Set(names.filter(n => /\.(sync|lists)\.json$/.test(n)).map(n => n.replace(/\.(sync|lists)\.json$/, '')))].sort();
  if (!stems.length) throw new Error('No Soundslice sync/list sidecars found');
  const plans = []; const seen = new Set();
  for (const stem of stems) {
    const sidecar = async kind => { const b = await cacheFile(directory, `${stem}.${kind}.json`); return b ? JSON.parse(b) : null; };
    const sync = await sidecar('sync'); const lists = await sidecar('lists'); const meta = sync ?? lists;
    const sourceId = required(meta.id, 'slice id');
    if (!/^[a-zA-Z0-9]+$/.test(sourceId) || seen.has(sourceId)) throw new Error('Invalid or duplicate slice identity');
    seen.add(sourceId);
    if (sync && lists && (sync.id !== lists.id || sync.score_file !== lists.score_file)) throw new Error('Sidecar identities disagree');
    if (meta.score_file !== `${stem}.gp`) throw new Error('Sidecar score filename disagrees with bundle');
    const files = new Map(); const renditions = []; const recordings = []; const converter_versions = {};
    const attach = bytes => { const sha256 = hash(bytes); const file = `blob-${sha256}`; files.set(file, bytes); return { file, sha256 }; };
    const checked = (bytes, entry) => { if (entry?.sha256 && hash(bytes) !== entry.sha256) throw new Error(`Cache checksum mismatch for ${entry.file}`); };
    const sourceNames = names.filter(n => n === `${stem}.gp` || n === `${stem}.musicxml` || new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.original\\.(gp|gpx|gp3|gp4|gp5|musicxml|mnx)$`).test(n)).sort();
    for (const name of sourceNames) {
      const bytes = await cacheFile(directory, name); const format = extname(name).slice(1);
      const original = name.startsWith(`${stem}.original.`);
      const entry = index.get(`${original ? 'original' : format === 'gp' ? 'gpx' : 'musicxml'}:${sourceId}`);
      if (entry?.file && entry.file !== name) throw new Error('Cache index filename disagrees with bundle');
      checked(bytes, entry);
      const role = original ? 'original' : 'export';
      const producer = original ? 'original-upload' : format === 'gp' ? 'soundslice-cli' : 'soundslice';
      const id = identity(sourceId, format, role, producer, hash(bytes));
      renditions.push({ id, format, role, producer, producer_version: null, producer_options: null, filename: name,
        fetched_at: entry?.fetched_at ?? meta.fetched_at ?? null,
        provenance: { source: 'soundslice', source_sha256: entry?.source_sha256 ?? null, header: entry?.header ?? null,
          metadata_source: entry ? 'index.sqlite' : 'sidecar', original_filename: entry?.name ?? null }, ...attach(bytes) });
      if (format === 'mnx') continue;
      const converter = converters[format === 'musicxml' ? 'musicxml-mnx' : 'guitarpro-mnx'];
      const doc = await converter.convert(bytes);
      const derived = Buffer.from(JSON.stringify(doc, null, 2) + '\n');
      converter_versions[converter.producer] = converter.version;
      renditions.push({ id: identity(id, converter.producer, converter.version, converter.options, hash(derived)), format: 'mnx', role: 'derived',
        producer: converter.producer, producer_version: converter.version, producer_options: converter.options,
        filename: `${name}.mnx.json`, derived_from: id, fetched_at: null, provenance: { source_sha256: hash(bytes) }, ...attach(derived) });
    }
    const canonical = renditions.find(r => r.format === 'gp' && r.role === 'export');
    if (!canonical) throw new Error(`Missing Soundslice .gp for ${sourceId}`);
    for (const r of sync?.recordings ?? []) {
      const source_id = String(r.id);
      if (!/^\d+$/.test(source_id)) throw new Error('Invalid recording source id');
      const row = { id: identity(sourceId, 'recording', source_id), source_id, name: r.name ?? null,
        duration_s: r.cropped_duration ?? null, syncpoints: r.syncpoints ?? null };
      if (r.source === 1) recordings.push({ ...row, kind: 'youtube', external_id: required(r.source_data, 'YouTube id') });
      else if (r.media_file) {
        const bytes = await cacheFile(directory, r.media_file);
        if (!bytes) { console.error(`Skipping missing companion ${r.media_file}; existing recording is retained`); continue; }
        const ext = extname(r.media_file).toLowerCase();
        const mime = { '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.webm': 'video/webm' }[ext];
        if (!mime) throw new Error(`Unsupported recording type ${ext}`);
        checked(bytes, index.get(`media:${sourceId}:${source_id}`));
        recordings.push({ ...row, kind: mime.startsWith('audio/') ? 'audio' : 'video', mime, ...attach(bytes) });
      } else console.error(`Skipping uncached recording ${source_id}; existing recording is retained`);
    }
    const manifest = { id: `soundslice:${sourceId}`, expected_revision: null, source: { kind: 'soundslice', id: sourceId },
      renditions, recordings, tags: (lists?.lists ?? []).map(l => ({ dimension: 'unknown', value: required(l.path, 'list path'), source_ref: required(l.id, 'list id') })),
      canonical: { mode: 'initialize', rendition_id: canonical.id }, converter_versions };
    const bytes = [...files.values()].reduce((n,b) => n + b.byteLength, 0) + Buffer.byteLength(JSON.stringify(manifest));
    if (bytes > maxBytes - 65536) throw new Error(`Bundle ${sourceId} exceeds the 24 MiB request limit`);
    plans.push({ manifest, files, bytes });
  }
  return plans;
}
export function endpointURL(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Endpoint must be an origin without credentials, path or query');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('Use HTTPS, or HTTP on loopback for local development');
  return url.origin;
}
export async function uploadPlan(plan, endpoint, token, fetcher = fetch, access = {}) {
  const origin = endpointURL(endpoint);
  const request = async (path, options = {}) => {
    const response = await fetcher(`${origin}/api/library${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...access }, redirect: 'error' });
    if (!response.ok) throw new Error(`Library request failed (${response.status}); no credentials or response body logged`);
    return response.json();
  };
  const { snapshot } = await request(`/ingest/${encodeURIComponent(plan.manifest.source.id)}`);
  const renditions = plan.manifest.renditions.map(r => {
    const old = snapshot?.renditions.find(row => row.id === r.id);
    // Losing the optional local index must not erase provenance already stored.
    if (old && r.provenance?.metadata_source === 'sidecar' && old.provenance) {
      const provenance = JSON.parse(old.provenance);
      if (provenance.metadata_source === 'index.sqlite') return { ...r, provenance, fetched_at: old.fetched_at };
    }
    return r;
  });
  const manifest = { ...plan.manifest, renditions, expected_revision: snapshot?.piece.revision ?? null };
  const form = new FormData(); form.set('manifest', JSON.stringify(manifest));
  for (const [key, bytes] of plan.files) form.set(key, new Blob([bytes]), key);
  const result = await request('/ingest', { method: 'POST', body: form });
  return { ...result, unchanged: snapshot?.piece.revision === result.snapshot.piece.revision };
}
async function privateCredentialFile(path, label, asJson = false) {
  const info = await lstat(path);
  if (!info.isFile() || (info.mode & 0o077)) throw new Error(`${label} must be an owner-only regular file (chmod 600)`);
  if (info.size > 65536) throw new Error(`${label} is too large`);
  const value = await readFile(path, 'utf8');
  if (!asJson) return value.trim();
  try { return JSON.parse(value); } catch { throw new Error(`${label} contains invalid JSON`); }
}
export async function operatorCredentials({ endpoint, tokenFile, accessFile, localSessionFile }) {
  endpointURL(endpoint);
  let token = process.env.LIBRARY_WRITE_TOKEN;
  if (tokenFile) {
    token = await privateCredentialFile(tokenFile, 'Token file');
  }
  required(token, 'LIBRARY_WRITE_TOKEN or --token-file');
  if (!/^[!-~]{1,4096}$/.test(token)) throw new Error('Invalid token format');
  let access = {};
  if (localSessionFile) {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname) || accessFile) throw new Error('Local sessions require a loopback endpoint and no Access service file');
    access = { 'Cf-Access-Jwt-Assertion': required((await privateCredentialFile(localSessionFile, 'Local session file', true))?.machine, 'local machine session') };
  } else if (accessFile) {
    const credentials = await privateCredentialFile(accessFile, 'Access token file', true);
    access = { 'CF-Access-Client-Id': required(credentials?.client_id, 'client_id'), 'CF-Access-Client-Secret': required(credentials?.client_secret, 'client_secret') };
  } else if (process.env.CF_ACCESS_CLIENT_ID || process.env.CF_ACCESS_CLIENT_SECRET) {
    access = { 'CF-Access-Client-Id': required(process.env.CF_ACCESS_CLIENT_ID, 'CF_ACCESS_CLIENT_ID'), 'CF-Access-Client-Secret': required(process.env.CF_ACCESS_CLIENT_SECRET, 'CF_ACCESS_CLIENT_SECRET') };
  }
  if (Object.values(access).some(value => typeof value !== 'string' || !/^[!-~]{1,16384}$/.test(value))) throw new Error('Invalid Access credential format');
  if (new URL(endpoint).protocol === 'https:' && !Object.keys(access).length) throw new Error('Production ingest requires --access-token-file or CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET');
  return { token, access };
}
async function main(args) {
  let directory; let dryRun = false; let endpoint = 'https://mnx-lab.totai.uk'; let tokenFile; let accessFile; let localSessionFile;
  for (let i=0; i<args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '--endpoint') endpoint = required(args[++i], 'endpoint');
    else if (a === '--local-session-file') localSessionFile = required(args[++i], 'local session file');
    else if (a === '--access-token-file') accessFile = required(args[++i], 'Access token file');
    else if (a === '--token-file') tokenFile = required(args[++i], 'token file');
    else if (a.startsWith('-') || directory) throw new Error('Usage: npm run ingest:library -- <dir> [--dry-run] [--endpoint <origin>] [--token-file <path>] [--access-token-file <path> | --local-session-file <path>]');
    else directory = a;
  }
  required(directory, 'cache directory'); endpointURL(endpoint);
  const converters = await buildConverters();
  const plans = await planIngest(resolve(directory), converters);
  for (const p of plans) console.log(JSON.stringify({ slice: p.manifest.source.id, renditions: p.manifest.renditions.length,
    recordings: p.manifest.recordings.length, tags: p.manifest.tags.length, bytes: p.bytes, converters: p.manifest.converter_versions }));
  if (dryRun) { console.log('Dry run: no network requests or storage writes.'); return; }
  const { token, access } = await operatorCredentials({ endpoint, tokenFile, accessFile, localSessionFile });
  for (const p of plans) {
    const result = await uploadPlan(p, endpoint, token, fetch, access);
    console.log(JSON.stringify({ slice: p.manifest.source.id, status: result.unchanged ? 'unchanged' : 'stored', revision: result.snapshot.piece.revision, canonical: result.canonical }));
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main(process.argv.slice(2)).catch(error => {
  console.error(error.message); process.exitCode = 1;
});
