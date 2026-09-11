#!/usr/bin/env node
// Personal operator tool. Cache bytes and credentials never enter a build face.
//
// The mnx-lab service stores what Soundslice exported and nothing derived from
// it (roadmap: studio-storage-source-canonical): MNX is the lab's working
// format, not (yet) its storage format. So this tool COPIES bytes, ASSERTS the
// Soundslice .gp as canonical, VALIDATES each conversion without storing it —
// forgiving ingest (a verdict never blocks storing), strict validator (every
// error printed, nonzero exit) — PROJECTS tags from the sidecar and from a
// conversion that validated, and SKIPS any slice the service already holds,
// judged by the SHA-256 the Worker recorded at upload. A converter change
// therefore moves no bytes: it refreshes the projected tags and nothing else.
import { readFile, readdir, realpath, stat, lstat } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import validateMnx from '../worker/generated/validate-mnx.mjs';
import validateLabel from '../worker/generated/validate-library-label.mjs';
import { validatePartExt, validateRootExt } from '../worker/generated/validate-extensions.mjs';

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

// ---------------------------------------------------------------- validation mode
// The Worker's own storage-schema rule, applied here to a conversion that is
// never stored: proposed section/rehearsal labels are checked narrowly, the
// rest against the published schema plus the _x.mnxLab vendor schema.
export function validateConversion(doc) {
  const errors = [];
  const describe = (fn, where) => (fn.errors ?? []).map(e => `${where}${e.instancePath} ${e.message}`);
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.parts)) return ['not an MNX document object'];
  const standard = structuredClone(doc);
  if (Array.isArray(standard.global?.measures)) standard.global.measures.forEach((measure, i) => {
    for (const field of ['section', 'rehearsal']) if (measure?.[field] !== undefined) {
      if (!validateLabel(measure[field])) errors.push(...describe(validateLabel, `/global/measures/${i}/${field}`));
      delete measure[field];
    }
  });
  if (!validateMnx(standard)) errors.push(...describe(validateMnx, ''));
  if (doc._x?.mnxLab !== undefined && !validateRootExt(doc._x.mnxLab)) errors.push(...describe(validateRootExt, '/_x/mnxLab'));
  doc.parts.forEach((part, i) => { if (part?._x?.mnxLab !== undefined && !validatePartExt(part._x.mnxLab)) errors.push(...describe(validatePartExt, `/parts/${i}/_x/mnxLab`)); });
  return errors;
}
const WORK_FIELDS = ['subtitle', 'album', 'copyright', 'source', 'notes'];
const TUNING_NAMES = {
  'E2 A2 D3 G3 B3 E4': 'standard', 'D2 A2 D3 G3 B3 E4': 'drop D', 'D2 A2 D3 G3 B3 D4': 'double drop D', 'D2 A2 D3 G3 A3 D4': 'DADGAD',
  'D2 G2 D3 G3 B3 D4': 'open G', 'D2 A2 D3 F#3 A3 D4': 'open D', 'E2 B2 E3 G#3 B3 E4': 'open E', 'E2 A2 E3 A3 C#4 E4': 'open A',
  'D#2 G#2 C#3 F#3 A#3 D#4': 'half-step down', 'D2 G2 C3 F3 A3 D4': 'whole-step down', 'E1 A1 D2 G2': 'bass standard', 'G4 C4 E4 A4': 'ukulele standard'
};
const pitchName = ({ step, alter, octave }) => `${step}${alter > 0 ? '#'.repeat(alter) : alter < 0 ? 'b'.repeat(-alter) : ''}${octave}`;
/** What a validated conversion states about the piece: the fact sheet. */
export function conversionFacts(doc) {
  const work = doc?._x?.mnxLab?.work ?? {};
  const facts = { title: work.title ?? null, artist: work.artist ?? null, work: {}, creators: [], capos: [], tunings: [], parts: [] };
  for (const field of WORK_FIELDS) if (typeof work[field] === 'string' && work[field].trim()) facts.work[field] = work[field].trim();
  for (const c of work.creators ?? []) if (c?.role && c?.name) facts.creators.push({ role: String(c.role), name: String(c.name) });
  for (const part of doc?.parts ?? []) {
    facts.parts.push(part?.name ?? null);
    const ext = part?._x?.mnxLab;
    if (ext?.strings?.length) {
      const tuning = [...ext.strings].sort((a, b) => b.string - a.string).map(s => pitchName(s.pitch)).join(' ');
      if (!facts.tunings.includes(tuning)) facts.tunings.push(tuning);
    }
    if (ext?.capo !== undefined && !facts.capos.includes(ext.capo)) facts.capos.push(ext.capo);
  }
  return facts;
}
export const tuningName = tuning => TUNING_NAMES[tuning] ?? null;

// ---------------------------------------------------------------- planning
/** What the cache says about each slice — bytes, identities, sidecar facts —
 *  with no conversion. Conversion is validatePlan's, and only when needed. */
export async function planIngest(inputDirectory) {
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
    const files = new Map(); const renditions = []; const recordings = []; const sources = [];
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
      if (format !== 'mnx') sources.push({ id, name, format, role, bytes });
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
    // Title and artist are the piece as its owner named it on Soundslice.
    const sidecarTags = [];
    for (const [dimension, value] of [['title', meta.title], ['artist', meta.artist]]) {
      if (typeof value === 'string' && value.trim()) sidecarTags.push({ dimension, value: value.trim(), source_ref: 'sidecar' });
    }
    const manifest = { expected_revision: null, source: { kind: 'soundslice', id: sourceId },
      renditions, recordings, tags: (lists?.lists ?? []).map(l => ({ dimension: 'unknown', value: required(l.path, 'list path'), source_ref: required(l.id, 'list id') })),
      canonical: { mode: 'initialize', rendition_id: canonical.id } };
    const bytes = [...files.values()].reduce((n,b) => n + b.byteLength, 0) + Buffer.byteLength(JSON.stringify(manifest));
    if (bytes > maxBytes - 65536) throw new Error(`Bundle ${sourceId} exceeds the 24 MiB request limit`);
    plans.push({ manifest, files, bytes, sources, sidecarTags, canonicalId: canonical.id });
  }
  return plans;
}

/** Run every source through its converter in validation mode. Returns the
 *  per-source report and the derived projection: the sidecar's tags always,
 *  the canonical .gp's facts only when that conversion validated. */
export async function validatePlan(plan, converters) {
  const report = []; let facts = null;
  for (const source of plan.sources) {
    const converter = converters[source.format === 'musicxml' ? 'musicxml-mnx' : 'guitarpro-mnx'];
    if (!converter) throw new Error(`No converter for ${source.format}`);
    const entry = { source: source.name, producer: converter.producer, version: converter.version, valid: false, errors: [] };
    try {
      const doc = await converter.convert(source.bytes);
      entry.errors = validateConversion(doc);
      entry.valid = entry.errors.length === 0;
      if (entry.valid && source.id === plan.canonicalId) facts = conversionFacts(doc);
    } catch (error) { entry.errors = [`conversion failed: ${error instanceof Error ? error.message : String(error)}`]; }
    report.push(entry);
  }
  const derived = [...plan.sidecarTags];
  if (facts) {
    const gp = converters['guitarpro-mnx']; const source_ref = `${gp.producer}@${gp.version}`;
    const add = (dimension, value) => { if (value != null && String(value).trim()) derived.push({ dimension, value: String(value).trim(), source_ref }); };
    for (const [field, value] of Object.entries(facts.work)) add(field, value);
    for (const c of facts.creators) add(`creator.${c.role}`, c.name);
    for (const capo of facts.capos) add('capo', capo);
    for (const tuning of facts.tunings) { add('tuning', tuning); add('tuning-name', tuningName(tuning)); }
  }
  return { report, derived_tags: derived, facts };
}

// ---------------------------------------------------------------- upload
export function endpointURL(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Endpoint must be an origin without credentials, path or query');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('Use HTTPS, or HTTP on loopback for local development');
  return url.origin;
}
const tagKey = t => `${t.dimension}:${t.value}`;
/** Upload only what the service lacks. `converters` enables validation mode;
 *  it runs when a slice is new, incomplete, forced, or when the projected tags
 *  no longer name the current converter version. */
export async function uploadPlan(plan, endpoint, token, fetcher = fetch, access = {}, { converters = null, force = false } = {}) {
  const origin = endpointURL(endpoint);
  const request = async (path, options = {}) => {
    const response = await fetcher(`${origin}/api/library${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...access }, redirect: 'error' });
    if (!response.ok) throw new Error(`Library request failed (${response.status}); no credentials or response body logged`);
    return response.json();
  };
  const { snapshot } = await request(`/ingest/${encodeURIComponent(plan.manifest.source.id)}`);
  if (snapshot) {
    const pointer = snapshot.renditions.find(r => r.id === snapshot.piece.canonical_rendition_id);
    if (!pointer || pointer.format !== 'gp' || pointer.role !== 'export') throw new Error(`${plan.manifest.source.id}: stored canonical is not the Soundslice .gp; refusing`);
  }
  const have = { renditions: new Set(snapshot?.renditions.map(r => r.id) ?? []), recordings: new Set(snapshot?.recordings.map(r => r.source_id) ?? []),
    tags: snapshot?.tags ?? [] };
  const missingRenditions = plan.manifest.renditions.filter(r => !have.renditions.has(r.id));
  const missingRecordings = plan.manifest.recordings.filter(r => !have.recordings.has(r.source_id));
  const listsStale = plan.manifest.tags.some(t => !have.tags.some(s => s.source_ref === t.source_ref));
  const derivedNow = have.tags.filter(t => t.origin === 'derived');
  const currentRef = converters ? `${converters['guitarpro-mnx'].producer}@${converters['guitarpro-mnx'].version}` : null;
  const projectionStale = !plan.sidecarTags.every(t => derivedNow.some(d => tagKey(d) === tagKey(t) && d.source_ref === t.source_ref))
    || (currentRef !== null && !derivedNow.some(d => d.source_ref === currentRef));
  let validation = null;
  const needValidation = converters && (force || !snapshot || missingRenditions.length || projectionStale);
  if (needValidation) validation = await validatePlan(plan, converters);
  if (!force && snapshot && !missingRenditions.length && !missingRecordings.length && !listsStale && !projectionStale) {
    return { status: 'skipped', snapshot, unchanged: true, validation };
  }
  const manifest = { ...plan.manifest, renditions: missingRenditions, expected_revision: snapshot?.piece.revision ?? null,
    ...(validation ? { derived_tags: validation.derived_tags } : {}) };
  // Recordings travel every time (their names and syncpoints may change) but
  // bytes only for the ones the service lacks.
  const form = new FormData(); form.set('manifest', JSON.stringify({ ...manifest,
    recordings: manifest.recordings.map(r => have.recordings.has(r.source_id) ? { ...r, file: undefined } : r) }));
  const wanted = new Set([...missingRenditions, ...missingRecordings].map(r => r.file).filter(Boolean));
  for (const [key, bytes] of plan.files) if (wanted.has(key)) form.set(key, new Blob([bytes]), key);
  const result = await request('/ingest', { method: 'POST', body: form });
  const unchanged = snapshot?.piece.revision === result.snapshot.piece.revision;
  return { status: unchanged ? 'unchanged' : 'stored', snapshot: result.snapshot, unchanged, validation };
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
  let directory; let dryRun = false; let force = false; let endpoint = 'https://mnx-lab.totai.uk'; let tokenFile; let accessFile; let localSessionFile;
  for (let i=0; i<args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '--force') force = true;
    else if (a === '--endpoint') endpoint = required(args[++i], 'endpoint');
    else if (a === '--local-session-file') localSessionFile = required(args[++i], 'local session file');
    else if (a === '--access-token-file') accessFile = required(args[++i], 'Access token file');
    else if (a === '--token-file') tokenFile = required(args[++i], 'token file');
    else if (a.startsWith('-') || directory) throw new Error('Usage: npm run ingest:library -- <dir> [--dry-run] [--force] [--endpoint <origin>] [--token-file <path>] [--access-token-file <path> | --local-session-file <path>]');
    else directory = a;
  }
  required(directory, 'cache directory'); endpointURL(endpoint);
  const converters = await buildConverters();
  const plans = await planIngest(resolve(directory));
  for (const p of plans) console.log(JSON.stringify({ slice: p.manifest.source.id, renditions: p.manifest.renditions.length,
    recordings: p.manifest.recordings.length, tags: p.manifest.tags.length, bytes: p.bytes }));
  let invalid = 0;
  const show = (slice, validation) => {
    if (!validation) return;
    for (const entry of validation.report) {
      if (!entry.valid) invalid++;
      console.log(JSON.stringify({ slice, source: entry.source, producer: entry.producer, valid: entry.valid, errors: entry.errors.slice(0, 20) }));
    }
  };
  if (dryRun) {
    for (const p of plans) show(p.manifest.source.id, await validatePlan(p, converters));
    console.log(`Dry run: no network requests or storage writes.${invalid ? ` ${invalid} conversion(s) invalid.` : ''}`);
    if (invalid) process.exitCode = 1;
    return;
  }
  const { token, access } = await operatorCredentials({ endpoint, tokenFile, accessFile, localSessionFile });
  for (const p of plans) {
    const result = await uploadPlan(p, endpoint, token, fetch, access, { converters, force });
    show(p.manifest.source.id, result.validation);
    const pointer = result.snapshot.renditions.find(r => r.id === result.snapshot.piece.canonical_rendition_id);
    console.log(JSON.stringify({ slice: p.manifest.source.id, status: result.status, revision: result.snapshot.piece.revision,
      canonical: pointer ? { rendition_id: pointer.id, format: pointer.format } : null,
      derived: result.snapshot.tags.filter(t => t.origin === 'derived').map(t => `${t.dimension}:${t.value}`) }));
  }
  // Forgiving ingest, strict validator: everything above was stored regardless.
  if (invalid) { console.error(`${invalid} conversion(s) did not validate; the sources were stored, no tags were projected from them.`); process.exitCode = 1; }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main(process.argv.slice(2)).catch(error => {
  console.error(error.message); process.exitCode = 1;
});
