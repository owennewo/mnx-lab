/** The sync bar's authoring model (roadmap/complete/studio-sync-bar.md).
 *
 *  A recording made to a steady pulse is described by where its beats start,
 *  where they stop and how many there are. The model is therefore a row of CUT
 *  LINES in media seconds and the SEGMENTS between them, each a whole number of
 *  beats; tempo is derived, never stored, once a segment has both its ends.
 *  It knows nothing of the score: Soundslice tuples are derived from it and the
 *  score's bar lengths by `syncpointsFromSegments`, and a score with no bars
 *  yet simply derives nothing. Pure and Node-safe; shared with the Worker. */
import type { SoundsliceSyncpoint } from './recordingSync.ts';

export const SYNC_SEGMENTS_FORMAT = 'studio-sync-segments';

export interface SyncSegment {
  readonly name: string;
  /** Whole beats between this segment's two cuts; null while its tempo is unknown.
   *  Always null on the open segment, which has no second cut to count to. */
  readonly beats: number | null;
  /** The open segment's tempo in beats per minute; null on every closed segment,
   *  whose tempo follows from `beats` and its two cut times. */
  readonly bpm: number | null;
}
export interface SyncSegments {
  readonly version: 1;
  /** One beat as a fraction of a whole note: [1, 4] is a quarter. */
  readonly beat: readonly [number, number];
  /** Media seconds, strictly increasing. `cuts[0]` is the start handle; when
   *  `closed`, the last is the end handle. Everything outside is unsynced. */
  readonly cuts: readonly number[];
  /** Whether the end handle is placed. Open, the last segment runs to the end
   *  of the recording at a free tempo. */
  readonly closed: boolean;
  readonly segments: readonly SyncSegment[];
}
/** What Studio sends as `rawSync`; the segments land in `provenance`. */
export interface StudioSyncPayload {
  readonly format: typeof SYNC_SEGMENTS_FORMAT;
  readonly segments: SyncSegments;
  readonly syncpoints: readonly SoundsliceSyncpoint[] | null;
}

/** Two cuts closer than this cannot be told apart by ear or by a pointer. */
export const MIN_CUT_GAP = 0.05;
export const MIN_BPM = 10;
export const MAX_BPM = 1000;
const MAX_CUTS = 1000;
const MAX_NAME = 80;

export function emptySyncSegments(beat: readonly [number, number] = [1, 4]): SyncSegments {
  return { version: 1, beat: [beat[0], beat[1]], cuts: [], closed: false, segments: [] };
}
/** Dotted quarter in compound meters, otherwise the signature's own unit. */
export function defaultBeatUnit(time?: { count: number; unit: number } | null): [number, number] {
  if (!time || !Number.isSafeInteger(time.unit) || time.unit < 1) return [1, 4];
  return time.unit === 8 && time.count > 3 && time.count % 3 === 0 ? [3, 8] : [1, time.unit];
}
const round = (seconds: number) => Math.round(seconds * 10000) / 10000;
const boundedBpm = (bpm: number) => Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)) * 100) / 100;

/** Whether segment `i` has a cut at its far end. */
export function isClosedSegment(doc: SyncSegments, i: number) { return i + 1 < doc.cuts.length; }
/** A segment's far end: its next cut, or — open — the recording's end when known. */
export function segmentEnd(doc: SyncSegments, i: number, mediaEnd?: number): number | null {
  return isClosedSegment(doc, i) ? doc.cuts[i + 1] : mediaEnd !== undefined && mediaEnd > doc.cuts[i] ? mediaEnd : null;
}
/** Beats per minute, or null while the segment has no tempo. */
export function segmentTempo(doc: SyncSegments, i: number): number | null {
  const segment = doc.segments[i];
  if (!segment) return null;
  if (!isClosedSegment(doc, i)) return segment.bpm;
  return segment.beats === null ? null : segment.beats * 60 / (doc.cuts[i + 1] - doc.cuts[i]);
}
/** The segment a media time falls in, or -1 in the unsynced ends. */
export function segmentAt(doc: SyncSegments, seconds: number): number {
  if (!doc.cuts.length || seconds < doc.cuts[0]) return -1;
  if (doc.closed && seconds >= doc.cuts[doc.cuts.length - 1]) return -1;
  let i = 0;
  while (i + 1 < doc.segments.length && seconds >= doc.cuts[i + 1]) i++;
  return i;
}
function nextName(doc: SyncSegments) {
  const taken = new Set(doc.segments.map(s => s.name));
  let n = doc.segments.length + 1;
  while (taken.has(`Segment ${n}`)) n++;
  return `Segment ${n}`;
}
function fitted(seconds: number, tempo: number) { return Math.max(1, Math.round(seconds * tempo / 60)); }

/** Place the start handle, or move it. Left of it is unsynced. */
export function placeStart(doc: SyncSegments, seconds: number): SyncSegments {
  if (doc.cuts.length) return moveCut(doc, 0, seconds);
  if (!Number.isFinite(seconds) || seconds < 0) return doc;
  return { ...doc, cuts: [round(seconds)], closed: false, segments: [{ name: 'Segment 1', beats: null, bpm: null }] };
}
/** Place the end handle, or move it. Right of it is unsynced, and the open
 *  segment closes on the whole beat count nearest its tempo. */
export function placeEnd(doc: SyncSegments, seconds: number): SyncSegments {
  if (!doc.cuts.length) return doc;
  const last = doc.cuts.length - 1;
  if (doc.closed) return moveCut(doc, last, seconds);
  if (!Number.isFinite(seconds) || seconds < doc.cuts[last] + MIN_CUT_GAP) return doc;
  const end = round(seconds), open = doc.segments[last];
  const segments = [...doc.segments];
  segments[last] = { name: open.name, beats: open.bpm === null ? null : fitted(end - doc.cuts[last], open.bpm), bpm: null };
  return { ...doc, cuts: [...doc.cuts, end], closed: true, segments };
}
/** Move a cut between its neighbours. Each closed neighbour keeps its tempo as
 *  nearly as a whole beat count allows: a nudge never changes a count, a long
 *  drag re-counts. The open segment keeps its tempo exactly. */
export function moveCut(doc: SyncSegments, i: number, seconds: number, mediaEnd = Infinity): SyncSegments {
  if (i < 0 || i >= doc.cuts.length || !Number.isFinite(seconds)) return doc;
  const lo = i > 0 ? doc.cuts[i - 1] + MIN_CUT_GAP : 0;
  const hi = i + 1 < doc.cuts.length ? doc.cuts[i + 1] - MIN_CUT_GAP : mediaEnd;
  if (hi < lo) return doc;
  const to = round(Math.min(hi, Math.max(lo, seconds)));
  if (to === doc.cuts[i]) return doc;
  const cuts = [...doc.cuts]; cuts[i] = to;
  const segments = [...doc.segments];
  for (const s of [i - 1, i]) {
    const tempo = segmentTempo(doc, s);
    if (s < 0 || s >= segments.length || !isClosedSegment(doc, s) || tempo === null) continue;
    segments[s] = { ...segments[s], beats: fitted(cuts[s + 1] - cuts[s], tempo) };
  }
  return { ...doc, cuts, segments };
}
/** Split the segment under `seconds`. With a tempo the cut lands on the nearest
 *  beat and both halves keep it, so the split moves no timing. Null when there
 *  is nothing to split there. */
export function splitAt(doc: SyncSegments, seconds: number): { doc: SyncSegments; cut: number } | null {
  const i = segmentAt(doc, seconds);
  if (i < 0) return null;
  const segment = doc.segments[i], start = doc.cuts[i], closed = isClosedSegment(doc, i), tempo = segmentTempo(doc, i);
  let at = seconds, left: SyncSegment, right: SyncSegment;
  if (tempo !== null) {
    let k = Math.round((seconds - start) * tempo / 60);
    if (closed) { if (segment.beats! < 2) return null; k = Math.min(segment.beats! - 1, Math.max(1, k)); } else k = Math.max(1, k);
    at = start + k * 60 / tempo;
    left = { name: segment.name, beats: k, bpm: null };
    right = closed ? { name: nextName(doc), beats: segment.beats! - k, bpm: null } : { name: nextName(doc), beats: null, bpm: segment.bpm };
  } else {
    left = { name: segment.name, beats: null, bpm: null };
    right = { name: nextName(doc), beats: null, bpm: null };
  }
  at = round(at);
  if (at < start + MIN_CUT_GAP || (closed && at > doc.cuts[i + 1] - MIN_CUT_GAP)) return null;
  const cuts = [...doc.cuts]; cuts.splice(i + 1, 0, at);
  const segments = [...doc.segments]; segments.splice(i, 1, left, right);
  return { doc: { ...doc, cuts, segments }, cut: i + 1 };
}
/** Remove a cut. The start handle takes its segment with it; the end handle
 *  reopens the last segment at its tempo; an inner cut merges its neighbours. */
export function removeCut(doc: SyncSegments, i: number): SyncSegments {
  if (i < 0 || i >= doc.cuts.length) return doc;
  const last = doc.cuts.length - 1;
  if (i === 0) {
    if (doc.cuts.length <= (doc.closed ? 2 : 1)) return emptySyncSegments(doc.beat);
    return { ...doc, cuts: doc.cuts.slice(1), segments: doc.segments.slice(1) };
  }
  if (i === last && doc.closed) {
    const tempo = segmentTempo(doc, last - 1);
    const segments = [...doc.segments];
    segments[last - 1] = { name: segments[last - 1].name, beats: null, bpm: tempo === null ? null : boundedBpm(tempo) };
    return { ...doc, cuts: doc.cuts.slice(0, -1), closed: false, segments };
  }
  const a = doc.segments[i - 1], b = doc.segments[i];
  const merged: SyncSegment = isClosedSegment(doc, i)
    ? { name: a.name, beats: a.beats !== null && b.beats !== null ? a.beats + b.beats : null, bpm: null }
    : { name: a.name, beats: null, bpm: b.bpm ?? (segmentTempo(doc, i - 1) === null ? null : boundedBpm(segmentTempo(doc, i - 1)!)) };
  const cuts = [...doc.cuts]; cuts.splice(i, 1);
  const segments = [...doc.segments]; segments.splice(i - 1, 2, merged);
  return { ...doc, cuts, segments };
}
/** A closed segment's whole beat count. */
export function setBeats(doc: SyncSegments, i: number, beats: number): SyncSegments {
  if (!doc.segments[i] || !isClosedSegment(doc, i) || !Number.isSafeInteger(beats) || beats < 1 || beats > 100000) return doc;
  const segments = [...doc.segments]; segments[i] = { ...segments[i], beats };
  return { ...doc, segments };
}
/** A tempo: stored as such on the open segment, counted into whole beats on a closed one. */
export function setBpm(doc: SyncSegments, i: number, bpm: number): SyncSegments {
  if (!doc.segments[i] || !Number.isFinite(bpm) || bpm <= 0) return doc;
  const segments = [...doc.segments];
  segments[i] = isClosedSegment(doc, i)
    ? { ...segments[i], beats: fitted(doc.cuts[i + 1] - doc.cuts[i], boundedBpm(bpm)) }
    : { ...segments[i], bpm: boundedBpm(bpm) };
  return { ...doc, segments };
}
export function renameSegment(doc: SyncSegments, i: number, name: string): SyncSegments {
  if (!doc.segments[i]) return doc;
  const segments = [...doc.segments]; segments[i] = { ...segments[i], name: name.trim().slice(0, MAX_NAME) || segments[i].name };
  return { ...doc, segments };
}

export interface SyncBeat { readonly time: number; readonly cut: boolean }
/** Every cut, and every beat of every segment with a tempo, in [from, to). What
 *  the click sounds and the zoomed bar draws. */
export function beatTimes(doc: SyncSegments, from: number, to: number, mediaEnd?: number): SyncBeat[] {
  const out: SyncBeat[] = [];
  doc.cuts.forEach((start, i) => {
    if (start >= from && start < to) out.push({ time: start, cut: true });
    const tempo = segmentTempo(doc, i), end = segmentEnd(doc, i, mediaEnd) ?? Infinity;
    if (tempo === null || i >= doc.segments.length) return;
    const step = 60 / tempo, stop = Math.min(to, end - step / 1000);
    for (let k = Math.max(1, Math.ceil((from - start) / step - 1e-9)); start + k * step < stop; k++)
      out.push({ time: start + k * step, cut: false });
  });
  return out.sort((a, b) => a.time - b.time);
}

/** Soundslice tuples from the segments and the score's performed bar lengths in
 *  beats: one point per bar start the beats reach, plus an inner-bar point where
 *  they end. Never a sparse pair — the sync map gives sparse bars equal time,
 *  which is wrong across a pickup or a meter change. Beats stop at the first
 *  segment without a tempo. Null when fewer than two points result. */
export function syncpointsFromSegments(doc: SyncSegments, barBeats: readonly number[], mediaEnd?: number): SoundsliceSyncpoint[] | null {
  const pieces: { beat: number; time: number; step: number; until: number }[] = [];
  let beat = 0;
  for (let i = 0; i < doc.segments.length; i++) {
    const tempo = segmentTempo(doc, i);
    if (tempo === null) break;
    const step = 60 / tempo, start = doc.cuts[i], end = segmentEnd(doc, i, mediaEnd);
    const beats = isClosedSegment(doc, i) ? doc.segments[i].beats! : end === null ? Infinity : (end - start) / step;
    pieces.push({ beat, time: start, step, until: beat + beats });
    beat += beats;
  }
  if (!pieces.length || !barBeats.length || barBeats.some(b => !(b > 0))) return null;
  const covered = beat, epsilon = 1e-9;
  const timeAt = (b: number) => {
    const piece = pieces.find(p => b <= p.until + epsilon) ?? pieces[pieces.length - 1];
    return round(piece.time + (b - piece.beat) * piece.step);
  };
  const points: SoundsliceSyncpoint[] = [];
  const push = (point: SoundsliceSyncpoint) => { if (!points.length || point[1] > points[points.length - 1][1]) points.push(point); };
  let barStart = 0, bar = 0;
  for (; bar < barBeats.length && barStart <= covered + epsilon; bar++) { push([bar, timeAt(barStart)]); barStart += barBeats[bar]; }
  if (barStart <= covered + epsilon) push([barBeats.length, timeAt(barStart)]);
  else if (Number.isFinite(covered) && bar > 0) {
    const inside = covered - (barStart - barBeats[bar - 1]);
    const offset = Math.round(480 * inside / barBeats[bar - 1] * 1000) / 1000;
    if (offset > 0 && offset < 480) push([bar - 1, timeAt(covered), offset]);
  }
  return points.length < 2 ? null : points;
}

/**
 * The tuples a recording PLAYS BY. A sync made in Studio is its segments — a
 * beat count over time — and the stored tuples beside them are a cache derived
 * from those segments and the bars the score had when the sync was last touched.
 * Bars written since (or a meter changed, or a repeat added) leave that cache
 * stale, so whenever segments exist the tuples are derived again from the
 * segments and the bars as they are NOW, and the stored ones are not consulted:
 * no bars yet is "not synchronised", never yesterday's tuples. An imported sync
 * has no segments and plays by its stored tuples, which are its only evidence.
 * `barBeats` takes the segments because the beat unit is theirs.
 */
export function playingSyncpoints(
  source: { syncpoints: unknown; syncSegments?: unknown },
  barBeats: (segments: SyncSegments) => readonly number[],
  mediaEnd?: number
): { syncpoints: unknown; segments: SyncSegments | null } {
  const decoded = source.syncSegments == null ? null : decodeSyncSegments(source.syncSegments);
  if (!decoded?.ok || !decoded.value.cuts.length) return { syncpoints: source.syncpoints, segments: null };
  return { syncpoints: syncpointsFromSegments(decoded.value, barBeats(decoded.value), mediaEnd), segments: decoded.value };
}

export type SyncSegmentsResult = { readonly ok: true; readonly value: SyncSegments } | { readonly ok: false; readonly message: string };
/** Shape and invariant validation for stored or received segments. */
export function decodeSyncSegments(input: unknown): SyncSegmentsResult {
  const bad = (message: string): SyncSegmentsResult => ({ ok: false, message });
  if (!input || typeof input !== 'object' || Array.isArray(input)) return bad('Sync segments must be an object.');
  const { version, beat, cuts, closed, segments } = input as Record<string, unknown>;
  if (version !== 1) return bad('Unsupported sync segments version.');
  if (!Array.isArray(beat) || beat.length !== 2 || !beat.every(n => Number.isSafeInteger(n) && n >= 1 && n <= 64) || beat[0] > beat[1])
    return bad('The beat unit must be a fraction of a whole note.');
  if (typeof closed !== 'boolean' || !Array.isArray(cuts) || !Array.isArray(segments)) return bad('Expected cuts, segments and a closed flag.');
  if (cuts.length > MAX_CUTS) return bad(`At most ${MAX_CUTS} cuts are supported.`);
  if (closed && cuts.length < 2) return bad('A closed sync needs a start and an end cut.');
  if (segments.length !== Math.max(0, cuts.length - (closed ? 1 : 0))) return bad('Segments must match the cuts.');
  for (let i = 0; i < cuts.length; i++) {
    const t: unknown = cuts[i];
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > 86400) return bad('Cut times must be finite seconds within a day.');
    if (i && t < (cuts[i - 1] as number) + 0.001) return bad('Cut times must increase.');
  }
  const value: SyncSegment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i] as Record<string, unknown> | null;
    if (!s || typeof s !== 'object' || typeof s.name !== 'string' || !s.name.trim() || s.name.length > MAX_NAME) return bad('Every segment needs a name of up to 80 characters.');
    const open = i + 1 >= cuts.length;
    if (s.beats !== null && (open || !Number.isSafeInteger(s.beats) || (s.beats as number) < 1 || (s.beats as number) > 100000)) return bad('A closed segment counts whole beats; the open segment has none.');
    if (s.bpm !== null && (!open || typeof s.bpm !== 'number' || !(s.bpm >= MIN_BPM && s.bpm <= MAX_BPM))) return bad(`Only the open segment stores a tempo, from ${MIN_BPM} to ${MAX_BPM} beats per minute.`);
    value.push({ name: s.name, beats: s.beats as number | null, bpm: s.bpm as number | null });
  }
  return { ok: true, value: { version: 1, beat: [beat[0] as number, beat[1] as number], cuts: [...cuts] as number[], closed, segments: value } };
}
