// What a recording's stored sync points amount to against this score: the
// points in use, any dropped as out of range, and the coverage or the problem.
// Shared by the Source panel's rows and the recording editor.
import type { LibraryRecording } from '../../../src/storage/libraryClient.ts';
import { decodeRecordingSync, type RecordingSyncpoint } from '../../../src/model/recordingSync.ts';
import type { linearizePasses } from '../../../src/model/passes.ts';
import type { compilePerformance } from '../../../src/audio/performance.ts';
import { createRecordingSync } from '../../../src/audio/recordingSync.ts';

export interface SyncSummary {
  points: RecordingSyncpoint[];
  dropped?: number;
  warning?: boolean;
  coverage?: 'full' | 'partial';
  message: string;
}

export function syncSummary(
  row: LibraryRecording | null,
  compiled: ReturnType<typeof compilePerformance> | undefined,
  passes: ReturnType<typeof linearizePasses> | undefined,
): SyncSummary {
  if (!row?.syncpoints) return { points: [], message: 'No sync points. Playback is available without score following or score seeking.' };
  try {
    const raw: unknown = JSON.parse(row.syncpoints);
    const decoded = decodeRecordingSync(raw);
    if (!decoded.ok) return { points: [], message: decoded.diagnostic.message, warning: true };
    const mapped = compiled?.ok && passes ? createRecordingSync(raw, compiled, passes) : null;
    const dropped = new Set(mapped?.droppedPointIndices ?? []);
    const points = decoded.value.points.filter((_, i) => !dropped.has(i));
    if (mapped?.ok) return { points, dropped: dropped.size, coverage: mapped.value.coverage === 'full' ? 'full' : 'partial',
      message: `${mapped.value.coverage === 'full' ? 'Full' : 'Partial'} score coverage.` };
    return { points, dropped: dropped.size, warning: true, message: mapped ? mapped.diagnostic.message : 'Score timing is unavailable.' };
  } catch { return { points: [], message: 'Stored sync points could not be read.', warning: true }; }
}
