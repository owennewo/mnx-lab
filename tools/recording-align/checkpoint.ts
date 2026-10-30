// A scripted edit to a score, as a named version: what it would store, and whether that is the edit it
// says it is. Every bar not named must read back from the stored .gp as it did before (note ids aside,
// which the importer renumbers), the export must lose nothing new, and a tuning or a bar count does not
// change unnoticed. Grew up as a session's script through run 9's edits (RUNS.md), which is how it knows.
import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
import { upgradeTabExtension } from '../../src/model/upgradeTabExtension.ts';
import { checkStorage } from '../../src/importers/storageCheckCore.ts';
import { derivedLibraryTags } from '../../src/model/libraryTags.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import { compilePerformance } from '../../src/audio/performance.ts';
import { performedBarBeats } from '../../src/audio/recordingSync.ts';
import { staleSegmentBars } from '../../src/model/syncSegments.ts';
import { storedSyncSegments } from '../../src/model/recordingAttachment.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

const MAX_NAME = 120;   // the library's own limit on a version's name
/** A document without what the importer renumbers. */
const comparable = (v: unknown) => JSON.stringify(v, (k, x) => (k === 'id' || k === 'target') && typeof x === 'string' ? undefined : x);
const without = <T extends object>(value: T, key: keyof T) => { const { [key]: _, ...rest } = value; return rest; };

export interface CheckpointRequest {
  before: MnxStructure; edited: MnxStructure;
  /** The bars this edit says it changes, from 1. */
  bars: readonly number[];
  name: string;
  /** The piece's recordings as the library holds them: an edit that moves a bar's length leaves a sync stale. */
  recordings?: readonly { name: string | null; provenance?: unknown }[];
  allow?: { resize?: boolean; settings?: boolean };
}
export interface PreparedCheckpoint {
  bytes: Uint8Array; options: ReturnType<typeof checkStorage>['options']; check: ReturnType<typeof checkStorage>['check'];
  /** The stored file read back, to draw. */
  document: MnxStructure;
  /** The library's tags, projected from the document being saved, as studio's save does. */
  tags: ReturnType<typeof derivedLibraryTags>;
  changed: number[];
  /** Why it may not be saved; empty when it may. */
  problems: string[];
  /** Recordings whose sync no longer fits: said, not rewritten — one rewrite when the edits are done. */
  stale: { recording: string; bars: number[] }[];
}

export function prepareCheckpoint(request: CheckpointRequest): PreparedCheckpoint {
  const { before, edited, bars, name, allow = {} } = request;
  const read = (bytes: Uint8Array) => upgradeTabExtension(importGuitarProCleanRoom(bytes) as unknown as MnxStructure);
  const base = checkStorage(before), stored = checkStorage(edited);
  const was = read(base.bytes), now = read(stored.bytes);
  const problems: string[] = [];
  if (!name.trim() || name.length > MAX_NAME) problems.push(`a version's name is 1 to ${MAX_NAME} characters; this one is ${name.length}`);
  if (!bars.length) problems.push('name the bars this edit changes');

  const named = new Set(bars), changed: number[] = [], unexpected: number[] = [];
  const count = now.parts[0]!.measures!.length, had = was.parts[0]!.measures!.length;
  for (let i = 0; i < count; i++) {
    const moved = i >= had || comparable(now.global.measures[i]) !== comparable(was.global.measures[i])
      || now.parts.some((part, p) => comparable(part.measures![i]) !== comparable(was.parts[p]?.measures?.[i]));
    if (moved) (named.has(i + 1) ? changed : unexpected).push(i + 1);
  }
  if (unexpected.length) problems.push(`bars changed that the edit does not name: ${unexpected.join(' ')}`);
  const unchanged = bars.filter(bar => bar <= count && !changed.includes(bar));
  if (unchanged.length) problems.push(`bars named that did not change: ${unchanged.join(' ')}`);
  if (count !== had && !allow.resize) problems.push(`the score goes from ${had} bars to ${count}: --resize when that is meant`);
  const settings = (d: MnxStructure) => comparable([without(d.global, 'measures'), d.parts.map(part => without(part, 'measures'))]);
  if (settings(now) !== settings(was) && !allow.settings) problems.push('the parts or the score\'s settings changed (a tuning, say): --settings when that is meant');
  const lost = stored.check.differences.filter(d => !base.check.differences.some(b => b.path === d.path && b.kind === d.kind && b.count === d.count));
  if (lost.length) problems.push(`the export changes more than it did: ${lost.map(d => `${d.kind} ${d.path} ×${d.count}`).join(', ')}`);

  const compiled = compilePerformance(now, linearizePasses(now));
  const stale = compiled.ok ? (request.recordings ?? []).flatMap(row => {
    const segments = storedSyncSegments(row.provenance ?? null);
    const off = segments ? staleSegmentBars(segments, performedBarBeats(compiled.performance, compiled.writtenBarDurations, segments)) : [];
    return off.length ? [{ recording: row.name ?? 'Unnamed recording', bars: off.map(i => i + 1) }] : [];
  }) : [];
  return { bytes: stored.bytes, options: stored.options, check: stored.check, document: now, tags: derivedLibraryTags(edited), changed, problems, stale };
}

/** What POST /pieces/:id/renditions takes for it, as studio's own save sends it. */
export function checkpointBody(prepared: PreparedCheckpoint, target: { revision: number; derivedFrom: string; filename: string; name: string; sha256: string }) {
  return {
    expected_revision: target.revision, derived_from: target.derivedFrom,
    rendition: { filename: target.filename.replace(/\.[^.]+$/, '') + '.gp', sha256: target.sha256, content: Buffer.from(prepared.bytes).toString('base64'), producer_version: 'recording-align', producer_options: prepared.options },
    derived_tags: prepared.tags, check: prepared.check, name: target.name,
  };
}

/** Just these bars of a document, side by side, each carrying its time signature: the picture of an edit. */
export function barsAlone(document: MnxStructure, bars: readonly number[]): MnxStructure {
  let time: unknown;
  const times = document.global.measures.map(g => (time = g.time ?? time));
  const pick = bars.map(bar => bar - 1).filter(i => i < document.global.measures.length);
  return {
    ...document,
    global: { ...document.global, measures: pick.map((i, k) => ({ ...document.global.measures[i]!, time: k === 0 || JSON.stringify(times[i]) !== JSON.stringify(times[pick[k - 1]!]) ? times[i] : undefined,
      ...(k === 0 && document.global.measures[0]!.tempos ? { tempos: document.global.measures[0]!.tempos } : {}) })) },
    parts: document.parts.map(part => ({ ...part, measures: pick.map(i => part.measures![i]!) })),
  } as MnxStructure;
}
