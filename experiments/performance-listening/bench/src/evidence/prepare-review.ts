import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { checkAnchors, inspectScore } from './preflight.ts';
import { readWav, writeWav } from '../generate/wav.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';

const [filesArg, scoresArg, outputArg, mediaMapArg, ...ids] = process.argv.slice(2);
if (!filesArg || !scoresArg || !outputArg || !mediaMapArg || !ids.length || ids.some(id => !/^[A-Za-z0-9_-]+$/.test(id))) throw new Error('Usage: tsx src/evidence/prepare-review.ts <library-files> <converted-mnx-dir> <private-output-dir> <media-map.json|-> <piece-id> ...');
const files = realpathSync(filesArg), scores = realpathSync(scoresArg), output = resolve(outputArg);
mkdirSync(output, { recursive: true });
for (let at = realpathSync(output); ; at = dirname(at)) {
  if (existsSync(join(at, '.git')) && (statSync(join(at, '.git')).isFile() || existsSync(join(at, '.git/HEAD')))) throw new Error('Review outputs contain private annotations; choose a directory outside every git checkout');
  if (dirname(at) === at) break;
}
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const local = (name: string) => {
  if (basename(name) !== name || name === '.' || name === '..') throw new Error('Sidecar file paths must be basenames');
  const file = realpathSync(join(files, name));
  if (dirname(file) !== files) throw new Error('Sidecar file escapes the library folder');
  return file;
};
const esc = (s: unknown) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
interface Recording { id: number; name: string; media_file?: string; youtube_url?: string; syncpoints?: unknown; cropped_duration?: number }
interface Sidecar { id: string; title: string; artist: string; score_file: string; recordings: Recording[] }
interface MediaBinding { path: string; sourceUrl: string; sha256: string; downloadTool: string }
const bindings: Record<string, MediaBinding> = mediaMapArg === '-' ? {} : JSON.parse(readFileSync(mediaMapArg, 'utf8'));
const rows = [];
for (const id of ids) {
  const matches = readdirSync(files).filter(name => name.endsWith(`_${id}.sync.json`));
  if (matches.length !== 1) throw new Error(`Expected one sidecar for ${id}`);
  const sidecarPath = local(matches[0]!);
  const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8')) as Sidecar;
  if (sidecar.id !== id) throw new Error('Sidecar identity mismatch');
  const gp = local(sidecar.score_file), mnx = join(scores, `${id}.mnx.json`);
  const doc = JSON.parse(readFileSync(mnx, 'utf8')) as MnxStructure;
  const inspected = inspectScore(doc);
  const scoreIssues = Object.fromEntries([...new Set(inspected.issues)].map(issue => [issue, inspected.issues.filter(x => x === issue).length]));
  for (const recording of sidecar.recordings) {
    const binding = bindings[String(recording.id)] ?? null;
    if (binding && (binding.sourceUrl !== recording.youtube_url || hash(binding.path) !== binding.sha256)) throw new Error('Media binding URL or content hash mismatch');
    const media = binding ? realpathSync(binding.path) : recording.media_file && existsSync(join(files, recording.media_file)) ? local(recording.media_file) : null;
    let mediaInfo: { sha256: string; duration: number | null; audioStreams: unknown[] } | null = null;
    if (media) {
      const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,sample_rate,channels,start_time,duration', '-of', 'json', media], { encoding: 'utf8' }));
      const duration = Number(probe.format?.duration);
      mediaInfo = { sha256: hash(media), duration: Number.isFinite(duration) && duration > 0 ? duration : null,
        audioStreams: (probe.streams ?? []).filter((s: { codec_type: string }) => s.codec_type === 'audio') };
    }
    const checked = checkAnchors(recording.syncpoints, inspected.measures, mediaInfo?.duration ?? null);
    // Initial preparation is limited to the first four performed bars, selected by the user.
    const reviewIndices = new Set<number>();
    checked.anchors.forEach((a, i) => { if (a.bar < 4 || (a.bar === 4 && a.offset === 0)) reviewIndices.add(i); });
    const first = checked.anchors.find(a => a.bar === 0 && a.offset === 0);
    const last = checked.anchors.find(a => a.bar === 4 && a.offset === 0);
    const firstWindow = { performedBars: [0, 4], startSeconds: first?.seconds ?? null, endSeconds: last?.seconds ?? null,
      durationSeconds: first && last ? last.seconds - first.seconds : null,
      anchorDerivedQuarterBpm: first && last && first.scoreQuarter !== null && last.scoreQuarter !== null ? (last.scoreQuarter - first.scoreQuarter) * 60 / (last.seconds - first.seconds) : null,
      structuralRangeFit: inspected.measures.length >= 4 && [...reviewIndices].every(i => checked.anchors[i]!.scoreQuarter !== null),
      labelStatus: 'unverified anchor proposal; no accepted intervals' };
    let clip = null;
    if (media && first && last && firstWindow.structuralRangeFit && last.seconds > first.seconds && mediaInfo?.duration && last.seconds <= mediaInfo.duration) {
      const fromSample = Math.round(first.seconds * 48000), untilSample = Math.round(last.seconds * 48000);
      const path = join(output, `${id}-${recording.id}-four-bars-review.wav`);
      const filter = `aresample=48000,atrim=start_sample=${fromSample}:end_sample=${untilSample},asetpts=PTS-STARTPTS`;
      const args = ['-v', 'error', '-i', media, '-vn', '-af', filter, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', '-f', 's16le', 'pipe:1'];
      const bytes = execFileSync('ffmpeg', args, { maxBuffer: 64 * 1024 * 1024, timeout: 120000 });
      if (bytes.length % 2) throw new Error('Incomplete decoded PCM sample');
      const samples = Int16Array.from({ length: bytes.length / 2 }, (_, i) => bytes.readInt16LE(i * 2));
      writeFileSync(path, writeWav(samples));
      const pcm = readWav(readFileSync(path));
      if (pcm.length !== untilSample - fromSample) throw new Error('Decoded review crop has unexpected sample count');
      clip = { path, sha256: hash(path), sampleRate: 48000, samples: pcm.length, fromSample, untilSample,
        sourceStartSeconds: fromSample / 48000, sourceEndSeconds: untilSample / 48000, ffmpegArgs: args,
        timeOrigin: 'Decoded source sample zero; correspondence to cached video times still requires review',
        status: 'provisional review crop, not a golden or accepted interval' };
    }
    rows.push({ piece: id, recording: recording.id, title: `${sidecar.artist} — ${sidecar.title}`, name: recording.name,
      score: { path: gp, sha256: hash(gp), convertedPath: mnx, convertedSha256: hash(mnx), writtenBars: doc.global.measures.length, performedBars: inspected.measures.length, issues: scoreIssues },
      sidecar: { path: sidecarPath, sha256: hash(sidecarPath) }, media, mediaInfo, remote: recording.youtube_url ?? null,
      exportedDuration: recording.cropped_duration ?? null, ...checked,
      clip, downloadTool: binding?.downloadTool ?? null, firstWindow, reviewIndices: [...reviewIndices].sort((a, b) => a - b),
      review: { permission: null, reviewer: null, reviewedAt: null, solo: null, performer: null, session: null, instrument: null, room: null, microphone: null,
        scoreCorrespondence: null, actualRoute: null, anchorUncertaintySeconds: null, interpolationEvidence: null, answerableFromEvidence: null },
    });
  }
}
const record = { version: 1, kind: 'evidence-preparation', checkedAt: new Date().toISOString(),
  tools: { preflight: hash(fileURLToPath(new URL('./preflight.ts', import.meta.url))), prepare: hash(fileURLToPath(new URL('./prepare-review.ts', import.meta.url))), ffprobe: execFileSync('ffprobe', ['-version'], { encoding: 'utf8' }).split('\n')[0], ffmpeg: execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0] },
  limits: 'Structural checks and decoded crop lengths only. ffprobe duration is container/stream metadata; each available review crop has a checked decoded sample count. No listening or anchor correction; nothing eligible; development preparation, no reserved access.', rows };
writeFileSync(join(output, 'review.json'), JSON.stringify(record, null, 2) + '\n');
// Commit-safe summary: metadata and aggregates only, never raw anchors, scores or media.
const summary = { ...record, rows: rows.map(({ anchors, reviewIndices, review, score, sidecar, media, clip, ...row }) => ({ ...row,
  score: { sha256: score.sha256, convertedSha256: score.convertedSha256, writtenBars: score.writtenBars, performedBars: score.performedBars, issues: score.issues },
  clip: clip ? { sha256: clip.sha256, samples: clip.samples, sampleRate: clip.sampleRate, fromSample: clip.fromSample, untilSample: clip.untilSample, sourceStartSeconds: clip.sourceStartSeconds, sourceEndSeconds: clip.sourceEndSeconds, status: clip.status, timeOrigin: clip.timeOrigin } : null,
  sidecarSha256: sidecar.sha256, localMedia: media !== null, anchorCount: anchors.length,
  anchorRange: anchors.length ? { seconds: [anchors[0]!.seconds, anchors.at(-1)!.seconds], bars: [anchors[0]!.bar, anchors.at(-1)!.bar] } : null,
  reviewPoints: reviewIndices.length, humanReview: 'pending',
})) };
writeFileSync(join(output, 'preflight-summary.json'), JSON.stringify(summary, null, 2) + '\n');
const sections = rows.map(row => {
  const windows = row.reviewIndices.map(index => {
    const anchor = row.anchors[index]!;
    const start = Math.max(0, anchor.seconds - .75), end = Math.min(row.mediaInfo?.duration ?? Infinity, anchor.seconds + .75);
    const reference = row.remote ? `${row.remote}&t=${Math.floor(start)}s` : null;
    return `<tr><td>${index}</td><td>${anchor.seconds}</td><td>${anchor.bar} / ${anchor.offset}</td><td>${anchor.written ?? 'end/outside'} / ${anchor.occurrence ?? '—'}</td><td>${row.media ? `<audio controls preload="none" src="${esc(pathToFileURL(row.media).href)}#t=${start},${end}"></audio>` : reference ? `<a href="${esc(reference)}" rel="noreferrer">Open video near anchor</a>` : 'No local media'}</td><td>Unreviewed</td></tr>`;
  }).join('\n');
  return `<section><h2>${esc(row.title)} · ${row.recording}</h2><p>Written/performed bars: ${row.score.writtenBars}/${row.score.performedBars}; anchors: ${row.anchors.length}; eligible: no.</p>${row.clip ? `<p><strong>First four bars — provisional review crop</strong></p><audio controls preload="none" src="${esc(pathToFileURL(row.clip.path).href)}"></audio><p>Original audio ${row.clip.sourceStartSeconds.toFixed(3)}–${row.clip.sourceEndSeconds.toFixed(3)} s. Crop timing has not yet been checked against the performance.</p>` : ""}<p><a href="${esc(pathToFileURL(row.score.path).href)}">Open original GP score</a> · <a href="${esc(pathToFileURL(row.score.convertedPath).href)}">Converted MNX</a>${row.remote ? ` · <a href="${esc(row.remote)}" rel="noreferrer">Recording reference</a>` : ''}</p><details><summary>Technical checks and source metadata</summary><pre>${esc(JSON.stringify({ scoreIssues: row.score.issues, anchorIssues: row.issues, firstFourBars: row.firstWindow, media: row.mediaInfo }, null, 2))}</pre></details><details><summary>First four performed bars: anchor checks (not verified)</summary><div class="scroll"><table><thead><tr><th>Anchor index</th><th>Time (s)</th><th>Performed bar / offset (0–480)</th><th>Written bar (1-based) / occurrence</th><th>Listen around anchor</th><th>Finding</th></tr></thead><tbody>${windows}</tbody></table></div></details></section>`;
}).join('\n');
writeFileSync(join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Real-evidence preparation · private review</title><style>body{font:16px/1.6 system-ui;color:#213a3e;background:#f2f4f1;max-width:1150px;margin:auto;padding:24px}section{background:white;padding:24px;margin:24px 0;border:1px solid #ccd8d1;border-radius:8px}a{color:#185f68}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}.scroll{overflow:auto}table{border-collapse:collapse}td,th{padding:12px;border:1px solid #d5ded9;text-align:left}audio{width:240px}summary{cursor:pointer}</style><h1>Real-evidence preparation</h1><p><strong>Review packet, not a golden set or experiment result.</strong> Source files stay on this machine. Controls load local audio only when used. No source is approved by this page.</p><p>Check solo status and score/route correspondence first. Only anchors bounding or inside the first four performed bars are selected for review. Timed video links seek approximately; they do not verify sample-accurate timing. They only identify where to investigate. Review every labelled interval and beat before accepting a clip; unchecked interiors remain unknown. Record independently observed times, conservative uncertainty bounds and reviewer identity in a separate review record. Do not silently overwrite the source anchors.</p><p>All raw anchors and source hashes are in <a href="review.json">review.json</a>. Blank review fields are deliberately unanswered.</p>${sections}</html>\n`);
console.log(JSON.stringify({ output, recordings: rows.length, localMedia: rows.filter(r => r.media).length, eligible: 0 }));
