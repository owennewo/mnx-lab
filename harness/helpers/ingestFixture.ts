// The ingest tool's input: one Soundslice slice as the export cache holds it —
// score, MusicXML, a recording, the sync sidecar and the lists sidecar. Shared by
// the tool's own tests (library-ingest-tool) and the Worker contract tests
// (library-ingest), which each make a fresh copy per test.
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function ingestSources(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'mnx-ingest-'));
  await writeFile(join(directory,'Song_ABC.gp'), 'synthetic GP input');
  await writeFile(join(directory,'Song_ABC.musicxml'), 'synthetic MusicXML input');
  await writeFile(join(directory,'Song_ABC.mp3'), 'synthetic recording');
  await writeFile(join(directory,'Song_ABC.sync.json'), JSON.stringify({ id: 'ABC', title: 'Sidecar song', artist: 'Sidecar artist', score_file: 'Song_ABC.gp', fetched_at: '2026-09-11', recordings: [
    { id: 1, source: 1, source_data: 'youtube123', name: 'Video', syncpoints: [[0,0]] },
    { id: 2, source: 2, media_file: 'Song_ABC.mp3', name: 'Audio', syncpoints: [[0,0]], cropped_duration: 10, crop_start: 1, crop_end: 11 }
  ] }));
  await writeFile(join(directory,'Song_ABC.lists.json'), JSON.stringify({ id: 'ABC', score_file: 'Song_ABC.gp', lists: [{ id: 'L1', path: 'Folder / List' }] }));
  return directory;
}
