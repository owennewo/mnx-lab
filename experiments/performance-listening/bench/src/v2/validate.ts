import type { Band, Bounds, GoldenV2 } from './types.ts';
const requireThat = (ok: unknown, message: string): void => { if (!ok) throw new Error(message); };
const text = (s: unknown): boolean => typeof s === 'string' && s.trim().length > 0;
const finite = (n: number): boolean => Number.isFinite(n) && n >= 0;
const hash = (s: string): boolean => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
function bounds(b: Bounds): void {
  requireThat(b && finite(b.lower) && finite(b.upper) && b.lower <= b.upper && b.upper - b.lower <= .25 + 1e-10, 'Judged position uncertainty must be at most ±0.125 quarter');
}
function band(b: Band, route: number[]): void {
  requireThat(b && Number.isSafeInteger(b.route) && route.includes(b.route), 'Unknown route occurrence');
  bounds(b.start); bounds(b.end);
  requireThat(b.end.lower >= b.start.lower && b.end.upper >= b.start.upper, 'Trajectory must not run backwards');
}
/** Runtime semantic schema. Missing or malformed fields are errors, never defaults. */
export function validateGoldenV2(g: GoldenV2): void {
  requireThat(g && g.version === 2 && g.noteAssessment === null, 'Expected following golden v2');
  requireThat(text(g.set) && text(g.example), 'Missing evidence identity');
  requireThat(['development', 'reserved', 'acceptance'].includes(g.partition), 'Invalid partition');
  requireThat(['positive', 'wrong-score', 'silence', 'room-noise', 'interruption'].includes(g.role), 'Invalid example role');
  requireThat(g.group && Object.values(g.group).every(text) && text(g.group.piece) && text(g.group.performer) && text(g.group.session), 'Missing grouping identity');
  requireThat(g.intended && hash(g.intended.scoreSha256) && g.intended.tempo?.unit === 'quarter' && finite(g.intended.tempo.bpm) && g.intended.tempo.bpm > 0, 'Invalid intended score / nominal tempo');
  requireThat(Array.isArray(g.intended.route) && g.intended.route.length > 0 && new Set(g.intended.route).size === g.intended.route.length && g.intended.route.every(r => Number.isSafeInteger(r) && r > 0), 'Invalid route');
  const a = g.audio;
  requireThat(a && hash(a.sha256) && hash(a.sourceSha256) && a.sampleRate === 48000 && a.channels === 1 && Number.isSafeInteger(a.samples) && a.samples > 0 && Number.isSafeInteger(a.cropStartSample) && a.cropStartSample >= 0 && text(a.timeOrigin), 'Invalid sample-clock audio identity');
  const p = g.provenance;
  requireThat(p && ['recording', 'generated', 'handwritten'].includes(p.kind) && text(p.reviewer) && /^\d{4}-\d{2}-\d{2}$/.test(p.reviewedOn) && hash(p.evidenceSha256) && p.independentOfCandidate === true, 'Missing independent review provenance');
  requireThat(p.sourceChecks && ['soloGuitar', 'scoreRoute', 'cropTimeOrigin', 'tempoEnvelope'].every(k => typeof p.sourceChecks[k as keyof typeof p.sourceChecks] === 'boolean'), 'Missing source checks');
  requireThat(g.profile && Object.keys(g.profile).length > 0 && Object.values(g.profile).every(text), 'Missing measured profile');
  const duration = a.samples / a.sampleRate;
  requireThat(Array.isArray(g.labels) && g.labels.length > 0, 'Explicit labels, including unknown regions, required');
  let end = 0;
  for (const l of g.labels) {
    requireThat(l.start === end && finite(l.end) && l.end > l.start && l.end <= duration && text(l.evidence), 'Labels must tile the audio and cite independent evidence');
    requireThat(['supported', 'unsupported', 'unknown'].includes(l.state), 'Invalid label state');
    if (l.state === 'unknown') requireThat(text(l.reason), 'Unknown region needs a reason');
    else {
      requireThat(finite(l.answerableFrom) && l.answerableFrom >= l.start && l.answerableFrom <= l.end, 'Invalid answerability');
      if (l.state === 'supported') {
        requireThat(['observed', 'bounded-interpolation'].includes(l.method), 'Distinguish observation from interpolation');
        band(l.truth, g.intended.route);
        requireThat(Array.isArray(l.alternatives), 'Acoustic alternatives must be explicit');
        l.alternatives.forEach(b => band(b, g.intended.route));
      }
    }
    end = l.end;
  }
  requireThat(end === duration, 'Unknown tails must be explicit');
  requireThat(Array.isArray(g.recoveries), 'Recovery evidence must be explicit');
  let last = -1;
  for (const r of g.recoveries) {
    requireThat(finite(r.at) && r.at < duration && r.at > last && text(r.evidence) && g.labels.some(l => l.state === 'supported' && l.start <= r.at && l.end > r.at && l.answerableFrom <= r.at), 'Invalid independently labelled recovery');
    last = r.at;
  }
}
/** A valid schema is not evidence readiness. Keep these holds visible to the driver. */
export function evidenceHolds(g: GoldenV2): string[] {
  validateGoldenV2(g);
  const holds: string[] = [];
  if (g.provenance.kind === 'recording') for (const [key, checked] of Object.entries(g.provenance.sourceChecks)) if (!checked) holds.push(`${g.example}: ${key} is not independently checked`);
  if (g.partition !== 'development' && g.role !== 'silence' && (g.provenance.kind !== 'recording' || Object.values(g.group).some(v => /^(unknown|unallocated|pending)$/i.test(v)))) holds.push(`${g.example}: independent real source group is unestablished`);
  return holds;
}
