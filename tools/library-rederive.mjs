#!/usr/bin/env node
// Operator-only: stored sources are the input; no Soundslice cache or direct cloud writes.
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildConverters, endpointURL, operatorCredentials } from './library-ingest.mjs';

const maxBytes = 24 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const normalized = value => Array.isArray(value) ? value.map(normalized) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, normalized(value[k])])) : value;
const stable = value => JSON.stringify(normalized(value));
export function comparable(document) {
  const copy = structuredClone(document);
  if (copy._x?.mnxLab) {
    delete copy._x.mnxLab.encoding;
    if (!Object.keys(copy._x.mnxLab).length) delete copy._x.mnxLab;
    if (!Object.keys(copy._x).length) delete copy._x;
  }
  return normalized(copy);
}
export function compareDocuments(before, after) {
  const paths = []; let changes = 0;
  const visit = (a, b, path) => {
    if (stable(a) === stable(b)) return;
    if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) visit(a[key], b[key], path + '/' + key.replaceAll('~','~0').replaceAll('/','~1'));
    } else { changes++; if (paths.length < 40) paths.push(path || '/'); }
  };
  visit(comparable(before), comparable(after), '');
  return { changes, paths, truncated: changes > paths.length };
}
async function bounded(response) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Library response exceeds 24 MiB');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Missing library response');
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); throw new Error('Library response exceeds 24 MiB'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks, size);
}
export function operatorClient(endpoint, token, access = {}, fetcher = fetch) {
  const origin = endpointURL(endpoint);
  const request = async (path, options = {}) => {
    const response = await fetcher(origin + '/api/library/ingest/rederive' + path, {
      ...options, headers: { Authorization: `Bearer ${token}`, ...access }, redirect: 'error', signal: AbortSignal.timeout(60000)
    });
    if (!response.ok) { const error = new Error(`Library request failed (${response.status}); rerun after resolving the failure`); error.status = response.status; throw error; }
    return bounded(response);
  };
  return {
    page: async after => JSON.parse(await request('/pieces?after=' + encodeURIComponent(after))),
    snapshot: async id => (JSON.parse(await request('/pieces/' + encodeURIComponent(id)))).snapshot,
    blob: async row => {
      const bytes = await request('/renditions/' + encodeURIComponent(row.id));
      if (bytes.length !== row.bytes || hash(bytes) !== row.sha256) throw new Error('Stored rendition checksum mismatch');
      return bytes;
    },
    apply: async plan => {
      const form = new FormData(); form.set('manifest', JSON.stringify(plan.manifest));
      for (const [key, bytes] of plan.files) form.set(key, new Blob([bytes]), key);
      return JSON.parse(await request('', { method: 'POST', body: form }));
    }
  };
}
export async function planRederive(snapshot, converters, readBlob) {
  const files = new Map(); const renditions = []; const comparisons = [];
  const converter_versions = Object.fromEntries(Object.values(converters).map(c => [c.producer, c.version]));
  for (const source of snapshot.renditions.filter(r => r.format !== 'mnx')) {
    const converter = converters[source.format === 'musicxml' ? 'musicxml-mnx' : 'guitarpro-mnx'];
    if (!converter) throw new Error('Missing source converter');
    let document;
    try { document = await converter.convert(await readBlob(source)); }
    catch { throw new Error(`Conversion or source read failed for ${source.id} (${converter.producer}); no piece writes`); }
    const bytes = Buffer.from(JSON.stringify(document, null, 2) + '\n');
    const sha256 = hash(bytes);
    const children = snapshot.renditions.filter(r => r.format === 'mnx' && r.derived_from === source.id && r.producer === converter.producer)
      .sort((a,b) => a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? 1 : -1);
    const previous = children[0];
    const previousDocument = previous ? JSON.parse(await readBlob(previous)) : null;
    const diff = previous ? compareDocuments(previousDocument, document) : { changes: 0, paths: [], truncated: false };
    const candidate = children.find(r => r.producer_version === converter.version && stable(JSON.parse(r.producer_options ?? 'null')) === stable(converter.options));
    const current = candidate && (candidate.id === previous?.id ? diff.changes === 0
      : compareDocuments(JSON.parse(await readBlob(candidate)), document).changes === 0) ? candidate : null;
    // New version evidence remains a row, even for equal music; immutable bytes retain their actual encoding stamp.
    if (!current) {
      const id = hash(JSON.stringify([source.id, converter.producer, converter.version, converter.options, sha256]));
      const file = 'blob-' + sha256; files.set(file, bytes);
      renditions.push({ id, derived_from: source.id, producer: converter.producer, producer_version: converter.version,
        producer_options: converter.options, sha256, file });
    }
    comparisons.push({ source: source.id, format: source.format, converter: converter.producer, version: converter.version,
      previous_version: previous?.producer_version ?? null, previous_sha256: previous?.sha256 ?? null, sha256,
      outcome: !previous ? 'first-conversion' : diff.changes ? 'changed' : previous.sha256 === sha256 ? 'unchanged' : 'encoding-or-serialization-only',
      evidence: current ? 'already-stored' : 'new-rendition', ...diff });
  }
  const manifest = { id: snapshot.piece.id, expected_revision: snapshot.piece.revision, renditions, converter_versions };
  if ([...files.values()].reduce((n,b) => n+b.length, Buffer.byteLength(JSON.stringify(manifest))) > maxBytes - 65536 || renditions.length > 100) {
    throw new Error('Derived piece exceeds the atomic upload limit; no piece writes');
  }
  return { manifest, files, comparisons };
}
export async function sweep(client, converters, { dryRun = false, report = value => console.log(JSON.stringify(value)) } = {}) {
  const versions = Object.fromEntries(Object.values(converters).map(c => [c.producer, c.version]));
  let after = ''; const seen = new Set(); const summary = { pieces: 0, changed: 0, new_renditions: 0, failed: 0, dry_run: dryRun };
  do {
    const page = await client.page(after);
    if (stable(page.converter_versions) !== stable(versions)) throw new Error('Deploy matching converter versions before running the sweep');
    for (const piece of page.pieces) {
      if (seen.has(piece.id)) throw new Error('Repeated piece in library pagination');
      seen.add(piece.id); summary.pieces++;
      let stage = 'read';
      try {
        const snapshot = await client.snapshot(piece.id);
        stage = 'convert-and-compare';
        const plan = await planRederive(snapshot, converters, row => client.blob(row));
        stage = 'apply';
        const result = dryRun ? null : await client.apply(plan); // Empty upload also rebuilds canonical-derived tags.
        const tagSet = tags => tags.filter(t => t.origin === 'derived').map(t => [t.dimension,t.value]).sort();
        const tagsChanged = result ? stable(tagSet(snapshot.tags)) !== stable(tagSet(result.snapshot.tags)) : null;
        const changed = plan.comparisons.some(c => c.changes > 0); if (changed) summary.changed++;
        summary.new_renditions += plan.manifest.renditions.length;
        report({ piece: piece.id, status: dryRun ? 'dry-run' : result.unchanged ? 'unchanged' : 'stored',
          revision_before: snapshot.piece.revision, revision_after: result?.snapshot.piece.revision ?? null,
          tags_changed: tagsChanged, comparisons: plan.comparisons });
      } catch (error) {
        summary.failed++;
        // Converter exceptions can quote private input. Report a bounded operator error, never their raw payload.
        report({ piece: piece.id, status: 'failed', stage, http_status: Number.isInteger(error.status) ? error.status : null, error: 'Piece could not be rederived; no automatic retry. Check source validity, checksum, size, converter versions and concurrent writes.' });
      }
    }
    if (page.next !== null && (typeof page.next !== 'string' || page.next <= after)) throw new Error('Invalid library pagination');
    after = page.next;
  } while (after !== null);
  report({ summary }); return summary;
}
async function main(args) {
  let endpoint = 'https://mnx-lab.totai.uk'; let tokenFile; let accessFile; let localSessionFile; let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') dryRun = true;
    else if (['--endpoint','--token-file','--access-token-file','--local-session-file'].includes(a)) {
      const value = args[++i]; if (!value || value.startsWith('--')) throw new Error('Missing option value');
      if (a === '--endpoint') endpoint = value; else if (a === '--token-file') tokenFile = value;
      else if (a === '--access-token-file') accessFile = value; else localSessionFile = value;
    } else throw new Error('Usage: npm run rederive:library -- [--dry-run] [--endpoint <origin>] [--token-file <path>] [--access-token-file <path> | --local-session-file <path>]');
  }
  const { token, access } = await operatorCredentials({ endpoint, tokenFile, accessFile, localSessionFile });
  const converters = await buildConverters();
  const result = await sweep(operatorClient(endpoint, token, access), converters, { dryRun });
  if (result.failed) process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main(process.argv.slice(2)).catch(error => {
  console.error(error.message); process.exitCode = 1;
});
