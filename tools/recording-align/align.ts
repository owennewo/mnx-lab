// The score half of recording alignment (.claude/skills/sync-recording): everything that
// must speak studio's own language — the piece as the library stores it, the score as the
// player performs it, the sync as the sync bar edits it — through studio's own modules.
// The audio half is align.py. Personal operator tool, like tools/library-ingest.mjs: it
// reads the local library with this checkout's signed session and writes only when told.
//
//   npx vite-node --config vitest.config.ts tools/recording-align/align.ts -- <command> --out <dir> [options]
//
//   fetch  --piece <id> [--recording <id>]   the piece, its stored score and the recording to align
//   score                                     the performed score: bar order, notes, structural starts
//   audio  [--video <url>]                    the recording's audio as mono 22.05 kHz WAV (yt-dlp / the library)
//   sync   [--write] [--replace]              the sync from structure.json; written only with --write
//
// A piece that does not exist yet — written as tab text (tabText.ts), say read off a video:
//
//   build  [--text <file>] [--width <sp>]    tab text → checked score: score.gp as studio would store it,
//                                             score.mnx.json read back from it, preview.png to compare
//   create [--write]                          make the piece from score.gp (writes piece.json)
//   attach --video <url> [--write]            put a YouTube recording on that piece
//
// Every command reads and writes files in --out, so each step can be inspected and rerun.
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
import { upgradeTabExtension } from '../../src/model/upgradeTabExtension.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { segmentsFromBarStarts, syncpointsFromSegments, SYNC_SEGMENTS_FORMAT } from '../../src/model/syncSegments.ts';
import { decodeRecordingSync } from '../../src/model/recordingSync.ts';
import { checkStorage } from '../../src/importers/storageCheckCore.ts';
import { derivedLibraryTags } from '../../src/model/libraryTags.ts';
import { computeBothSystem } from '../../src/engine/headless.ts';
import { initSmufl } from '../../harness/helpers/corpusPrimitives.ts';
import { renderSvgToString } from '../../harness/helpers/svgString.ts';
import { validateConversion } from '../library-ingest.mjs';
import { buildTabText } from './tabText.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2).filter(a => a !== '--');
const command = args[0];
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const out = resolve(option('out') ?? fail('--out <dir> is required'));
mkdirSync(out, { recursive: true });
const origin = option('origin') ?? `http://localhost:${execFileSync('node', [join(ROOT, 'tools/dev-port.mjs')], { cwd: ROOT, encoding: 'utf8' }).trim() || '5173'}`;
const readJson = (name: string) => JSON.parse(readFileSync(join(out, name), 'utf8'));
const writeJson = (name: string, value: unknown) => writeFileSync(join(out, name), JSON.stringify(value, null, 1));
const n = (x: { num: bigint; den: bigint }) => Number(x.num) / Number(x.den);

function fail(message: string): never { console.error(`align: ${message}`); process.exit(2); }

/** This checkout's signed browser session — what `npm run dev` / `npm run dev:login` writes. */
function token(): string {
  const path = option('secrets') ?? join(ROOT, '.secrets/local-library-session.json');
  if (!existsSync(path)) fail(`no local session at ${path}: run \`npm run dev:login\` in the checkout whose dev server holds the library`);
  return JSON.parse(readFileSync(path, 'utf8')).browser;
}
async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${origin}/api/library${path}`, { ...init, headers: { 'Cf-Access-Jwt-Assertion': token(), 'Content-Type': 'application/json', ...init.headers } });
  if (response.status === 401 || response.status === 403) fail(`the library refused the session (${response.status}): run \`npm run dev:login\`, or pass --origin for another dev server`);
  return response;
}

async function fetchPiece() {
  const pieceId = option('piece') ?? fail('--piece <id> is required');
  const response = await api(`/pieces/${encodeURIComponent(pieceId)}`);
  if (!response.ok) fail(`piece ${pieceId}: ${response.status}`);
  const { snapshot } = await response.json();
  const rendition = snapshot.renditions.find((r: { id: string }) => r.id === snapshot.piece.canonical_rendition_id);
  if (!rendition || !/^gp[x345]?$/.test(rendition.format)) fail(`the canonical rendition is ${rendition?.format ?? 'missing'}; only Guitar Pro files are read`);
  const bytes = new Uint8Array(await (await api(`/renditions/${encodeURIComponent(rendition.id)}`)).arrayBuffer());
  const document = upgradeTabExtension(importGuitarProCleanRoom(bytes) as unknown as MnxStructure);
  const recordings = snapshot.recordings as { id: string; kind: string; name: string | null; external_id: string | null; syncpoints: string | null; provenance: string | null }[];
  const wanted = option('recording');
  const candidates = wanted ? recordings.filter(r => r.id === wanted) : recordings;
  if (candidates.length !== 1) fail(`${candidates.length} recordings match; pass --recording <id> from: ${recordings.map(r => `${r.id} (${r.kind} "${r.name ?? ''}")`).join(', ') || 'none'}`);
  const recording = candidates[0];
  writeJson('piece.json', { pieceId, revision: snapshot.piece.revision, canonical: rendition.id, recording, origin });
  writeJson('score.mnx.json', document);
  console.log(`piece ${pieceId} r${snapshot.piece.revision}: ${document.global.measures.length} bars; recording ${recording.id} (${recording.kind}${recording.external_id ? ` ${recording.external_id}` : ''})${recording.syncpoints ? ' — ALREADY SYNCED' : ''}`);
}

/** The score as the player performs it: what every later step aligns against. */
function score() {
  const document = readJson('score.mnx.json') as MnxStructure;
  const passes = linearizePasses(document);
  const compiled = compilePerformance(document, passes);
  if (!compiled.ok) fail(`the score does not compile: ${JSON.stringify(compiled.diagnostics)}`);
  const p = compiled.performance;
  const measures = p.measures.map(m => ({ ordinal: m.ordinal, bar: m.measureIndex + 1, position: n(m.position), duration: n(m.duration), metricDuration: n(m.metricDuration) }));
  const sounding = p.sounding.map(s => ({ position: n(s.position), duration: n(s.duration), midi: s.midi }));
  // Each written bar's notes, from its first visit, as offsets in whole notes.
  const written: Record<number, { duration: number; notes: [number, number][] }> = {};
  for (const m of measures) {
    if (written[m.bar]) continue;
    written[m.bar] = { duration: m.metricDuration, notes: sounding.filter(s => s.position >= m.position - 1e-9 && s.position < m.position + m.duration - 1e-9).map(s => [s.position - m.position, s.midi]) };
  }
  // Where the score itself jumps: the bars a performance can plausibly restart at.
  const order = measures.map(m => m.bar);
  const edges = new Set<string>();
  const starts = new Set<number>([order[0]]);
  for (let i = 1; i < order.length; i++) {
    edges.add(`${order[i - 1]}>${order[i]}`);
    if (order[i] !== order[i - 1] + 1) starts.add(order[i]);
  }
  const value = {
    order, measures, sounding, written,
    edges: [...edges].map(e => e.split('>').map(Number)),
    structuralStarts: [...starts].sort((a, b) => a - b),
    capo: document.parts.map(part => part._x?.mnxLab?.capo ?? 0),
    tempo: p.tempo.map(t => ({ position: n(t.position), bpm: n(t.quarterBpm) })),
    passDiagnostics: passes.diagnostics,
  };
  writeJson('score.json', value);
  const span = measures.at(-1)!.position + measures.at(-1)!.duration;
  console.log(`performed: ${order.length} bars (${Object.keys(written).length} written), order ${order.join(' ')}`);
  console.log(`capo ${value.capo.join('/')}; marked ${value.tempo[0]?.bpm ?? '?'} bpm (${(span * 4 * 60 / (value.tempo[0]?.bpm ?? 120)).toFixed(0)} s at that tempo); structural starts ${value.structuralStarts.join(' ')}`);
  for (const d of passes.diagnostics) console.log(`  pass diagnostic: bar ${d.measureIndex + 1} — ${d.message}`);
}

/** The recording's audio, in a directory of its own (downloaded data stays apart from code). */
async function audio() {
  // --video: a video not (yet) on a piece — a candidate, or the source of a piece still to be made.
  const video = option('video');
  const { recording } = video ? { recording: { kind: 'youtube', external_id: null } } : readJson('piece.json');
  const dir = join(out, 'audio');
  mkdirSync(dir, { recursive: true });
  const raw = join(dir, 'source.wav');
  if (recording.kind === 'youtube') {
    const url = video ?? `https://www.youtube.com/watch?v=${recording.external_id}`;
    const meta = execFileSync('yt-dlp', ['-q', '--no-playlist', '-x', '--audio-format', 'wav', '--print', '%(title)s | %(duration)s s | %(uploader)s', '--no-simulate',
      '-o', join(dir, 'source.%(ext)s'), url], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    console.log(`youtube ${url}: ${meta.trim()}`);
  } else {
    const response = await api(`/recordings/${encodeURIComponent(recording.id)}/audio`);
    if (!response.ok) fail(`recording audio: ${response.status}`);
    const source = join(dir, 'source.media');
    writeFileSync(source, new Uint8Array(await response.arrayBuffer()));
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', source, raw]);
    console.log(`audio recording ${recording.id}`);
  }
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-ac', '1', '-ar', '22050', join(dir, 'mono.wav')]);
  console.log(`→ ${join(dir, 'mono.wav')}`);
}

/** structure.json's bar starts → the sync the sync bar edits, checked; written only when asked. */
async function sync() {
  const s = readJson('score.json'), structure = readJson('structure.json'), heard = readJson('notes.json') as { start: number; pitch: number }[];
  const rows = structure.rows as { bar: number; start: number; end: number }[];
  // A sync follows the score's performed order from its first bar: the found bars must BE that order.
  const departs = rows.findIndex((r, i) => s.order[i] !== r.bar);
  if (departs >= 0) fail(`the recording departs from the score's performed order at row ${departs} (heard bar ${rows[departs].bar}, score plays ${s.order[departs] ?? 'nothing more'}); a sync cannot say that — see the skill's "structure departs" step`);
  let snapped = 0;
  const cuts = rows.map((r, i) => {
    const m = s.measures[i];
    const pcs = new Set(s.sounding.filter((x: { position: number }) => Math.abs(x.position - m.position) < 1e-9).map((x: { midi: number }) => x.midi % 12));
    const near = heard.filter(h => pcs.has(h.pitch % 12) && Math.abs(h.start - r.start) <= 0.04).sort((a, b) => Math.abs(a.start - r.start) - Math.abs(b.start - r.start));
    if (near.length) { snapped++; return near[0].start; }
    return r.start;
  });
  cuts.push(rows.at(-1)!.end);
  const passes = new Map<number, number>();
  const names = rows.map(r => { const k = (passes.get(r.bar) ?? 0) + 1; passes.set(r.bar, k); return `Bar ${r.bar}${k > 1 ? ` (pass ${k})` : ''}`; });
  const segments = segmentsFromBarStarts(cuts, rows.map((_, i) => s.measures[i].metricDuration), names) ?? fail('the bar starts do not make a sync (cuts out of order, or a bar no beat divides)');
  const unit = segments.beat[0] / segments.beat[1];
  const syncpoints = syncpointsFromSegments(segments, s.measures.map((m: { metricDuration: number }) => m.metricDuration / unit));
  if (!syncpoints || !decodeRecordingSync(syncpoints).ok) fail('the derived sync points do not decode');
  const payload = { format: SYNC_SEGMENTS_FORMAT, segments, syncpoints };
  writeJson('sync-payload.json', payload);
  const gaps = cuts.slice(1).map((c, i) => c - cuts[i]);
  console.log(`${segments.segments.length} segments over ordinals 0–${rows.length - 1} of ${s.order.length}; ${cuts.length} cuts (${snapped} snapped to a heard downbeat), ${cuts[0].toFixed(2)}–${cuts.at(-1)!.toFixed(2)} s; bars ${Math.min(...gaps).toFixed(2)}–${Math.max(...gaps).toFixed(2)} s; beat 1/${segments.beat[1]}`);
  if (!flag('write')) { console.log('dry run: nothing written (pass --write)'); return; }
  const { pieceId, recording } = readJson('piece.json');
  const live = await (await api(`/pieces/${encodeURIComponent(pieceId)}`)).json();
  const row = live.snapshot.recordings.find((r: { id: string }) => r.id === recording.id) ?? fail('the recording is no longer on the piece');
  if (row.syncpoints && !flag('replace')) fail('the recording already has a sync; pass --replace only when the owner has said to replace it');
  const response = await api(`/pieces/${encodeURIComponent(pieceId)}/recordings/${encodeURIComponent(row.id)}`, { method: 'PUT',
    body: JSON.stringify({ expected_revision: live.snapshot.piece.revision, name: row.name || 'Recording', rawSync: payload }) });
  const body = await response.json();
  if (!response.ok) fail(`write refused (${response.status}): ${JSON.stringify(body)}`);
  const stored = body.snapshot.recordings.find((r: { id: string }) => r.id === row.id);
  console.log(`written: piece revision ${body.snapshot.piece.revision}; ${JSON.parse(stored.syncpoints).length} tuples; ${JSON.parse(stored.provenance).format}`);
}

/** Tab text → the score studio would store, checked every way a piece is checked, and a
 *  picture of it to hold against the source. Writes nothing to the library. */
function build() {
  const source = option('text') ?? join(out, 'score.tab.txt');
  let built: ReturnType<typeof buildTabText>;
  try { built = buildTabText(readFileSync(source, 'utf8')); } catch (e) { fail(`${source}: ${e instanceof Error ? e.message : e}`); }
  const { document, warnings } = built;
  warnings.forEach(w => console.log(`  warning: ${w}`));
  const errors = validateConversion(document) as string[];
  if (errors.length) fail(`the document does not validate:\n  ${errors.join('\n  ')}`);
  const passes = linearizePasses(document);
  for (const d of passes.diagnostics) console.log(`  pass diagnostic: bar ${d.measureIndex + 1} — ${d.message}`);
  // What studio will read is the stored .gp, so everything downstream reads that back.
  const stored = checkStorage(document);
  writeFileSync(join(out, 'score.gp'), stored.bytes);
  writeJson('score.built.mnx.json', document);
  const reread = upgradeTabExtension(importGuitarProCleanRoom(stored.bytes) as unknown as MnxStructure);
  writeJson('score.mnx.json', reread);
  writeJson('score.storage.json', { options: stored.options, check: stored.check, losses: stored.losses });
  const order = linearizePasses(reread).entries.map(e => e.measureIndex + 1);
  console.log(`${document.global.measures.length} bars written, ${order.length} performed: ${order.join(' ')}`);
  console.log(`storage check: ${stored.check.verdict}${stored.losses.length ? ` — ${stored.losses.map(l => `${l.kind} ${l.path}`).join('; ')}` : ''}`);
  stored.check.warnings.forEach(w => console.log(`  export warning: ${w}`));
  initSmufl();
  const widthSp = Number(option('width', '200'));
  const system = computeBothSystem(document, widthSp) ?? fail('the score has no tab view to preview');
  const svg = renderSvgToString({ ...system, pxPerSp: 10 });
  const font = readFileSync(join(ROOT, 'public/smufl/Bravura.woff2')).toString('base64');
  const html = join(out, 'preview.html');
  writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>@font-face { font-family: 'Bravura'; src: url(data:font/woff2;base64,${font}) format('woff2'); }
html,body { margin:0; background:#fff; } :root { --font-family-sans: Georgia, serif; } svg { display:block; margin:12px; }</style>${svg}`);
  const size = (attr: string) => Math.ceil(Number(new RegExp(`\\b${attr}="([\\d.]+)"`).exec(svg)?.[1] ?? 0)) + 24;
  execFileSync('google-chrome', ['--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--default-background-color=ffffff',
    `--window-size=${size('width')},${size('height')}`, `--screenshot=${join(out, 'preview.png')}`, html], { stdio: 'ignore' });
  unlinkSync(html);
  console.log(`→ score.gp, score.mnx.json, preview.png (${size('width')}×${size('height')})`);
}

/** The piece, made from build's score.gp exactly as studio's New piece page makes one. */
async function create() {
  if (existsSync(join(out, 'piece.json'))) fail('piece.json exists: this run already has a piece');
  const bytes = readFileSync(join(out, 'score.gp'));
  const built = readJson('score.built.mnx.json') as MnxStructure;
  const { options } = readJson('score.storage.json');
  const title = built._x?.mnxLab?.work?.title ?? 'Untitled';
  const filename = `${title.replace(/[\\/\u0000-\u001f]/g, ' ').trim().slice(0, 240) || 'Untitled'}.gp`;
  console.log(`would create "${title}" from score.gp (${bytes.length} bytes) as ${filename}`);
  if (!flag('write')) { console.log('dry run: nothing written (pass --write)'); return; }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const response = await api('/pieces', { method: 'POST', body: JSON.stringify({
    rendition: { filename, sha256, content: bytes.toString('base64'), producer_version: 'recording-align', producer_options: options },
    derived_tags: derivedLibraryTags(built) }) });
  const body = await response.json();
  if (!response.ok) fail(`create refused (${response.status}): ${JSON.stringify(body)}`);
  const pieceId = body.snapshot.piece.id;
  writeJson('piece.json', { pieceId, revision: body.snapshot.piece.revision, canonical: body.snapshot.piece.canonical_rendition_id, recording: null, origin });
  console.log(`created piece ${pieceId} r${body.snapshot.piece.revision}: ${origin}/studio/#/piece/${pieceId}`);
}

/** A YouTube recording on this run's piece; piece.json then names it, as `fetch` would. */
async function attach() {
  const piece = readJson('piece.json');
  const video = option('video') ?? fail('--video <YouTube url> is required');
  if (piece.recording) fail(`piece.json already names recording ${piece.recording.id}`);
  console.log(`would attach ${video} to piece ${piece.pieceId}`);
  if (!flag('write')) { console.log('dry run: nothing written (pass --write)'); return; }
  const live = await (await api(`/pieces/${encodeURIComponent(piece.pieceId)}`)).json();
  const id = `studio-${randomUUID()}`;
  const response = await api(`/pieces/${encodeURIComponent(piece.pieceId)}/recordings/${id}`, { method: 'PUT',
    body: JSON.stringify({ expected_revision: live.snapshot.piece.revision, name: option('name', 'Recording'), video, selectedId: null }) });
  const body = await response.json();
  if (!response.ok) fail(`attach refused (${response.status}): ${JSON.stringify(body)}`);
  const recording = body.snapshot.recordings.find((r: { id: string }) => r.id === id);
  writeJson('piece.json', { ...piece, revision: body.snapshot.piece.revision, recording });
  console.log(`attached recording ${id} (youtube ${recording.external_id}); piece revision ${body.snapshot.piece.revision}`);
}

const commands: Record<string, () => unknown> = { fetch: fetchPiece, score, audio, sync, build, create, attach };
if (!commands[command]) fail(`unknown command ${command ?? '(none)'}; one of ${Object.keys(commands).join(', ')}`);
await commands[command]();
