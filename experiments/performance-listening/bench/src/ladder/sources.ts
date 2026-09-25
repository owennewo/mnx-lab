import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha } from './privateSets.ts';
import { tonejsMidi, type SampleSource } from './samples.ts';

/** The rung-2 sample sets and their groups, fixed before any candidate ran on them. */
export function sampleSources(tonejsDir: string, repoSamples: string): SampleSource[] {
  const TONEJS = 'tonejs-instruments by Nicholas Brosowsky, github.com/nbrosowsky/tonejs-instruments at 622c2f1c, samples licensed CC BY 3.0';
  const tonejs = (id: string, set: string, name: string, origin: string, group: SampleSource['group']): SampleSource => ({
    id, name, source: `tonejs-instruments/${set}`, licence: 'CC-BY-3.0', group, origin,
    attribution: `${TONEJS}; ${name} recordings from ${origin}.`,
    files: readdirSync(join(tonejsDir, set)).filter(f => f.endsWith('.wav')).map(f => ({ midi: tonejsMidi(f), path: join(tonejsDir, set, f), sha256: sha(readFileSync(join(tonejsDir, set, f))) })),
  });
  /** Repository sets: one file per root, the loudest velocity layer and its first take. */
  const repo = (id: string, dir: string, origin: string, group: SampleSource['group']): SampleSource => {
    const m = JSON.parse(readFileSync(join(repoSamples, dir, 'manifest.json'), 'utf8')) as { name: string; license: string; samples: { file: string; midi: number; layer?: number; take?: number; sha256: string }[] };
    const chosen = new Map<number, typeof m.samples[number]>();
    for (const s of m.samples) {
      const c = chosen.get(s.midi);
      if (!c || (s.layer ?? 0) > (c.layer ?? 0) || ((s.layer ?? 0) === (c.layer ?? 0) && (s.take ?? 0) < (c.take ?? 0))) chosen.set(s.midi, s);
    }
  return { id, name: m.name, source: `mnx-lab public/samples/${dir}`, licence: m.license, group, origin,
      attribution: `${m.name}, ${m.license}, from the mnx-lab repository (public/samples/${dir}); origin ${origin}.`,
      files: [...chosen.values()].map(s => {
        const path = join(repoSamples, dir, s.file);
        if (sha(readFileSync(path)) !== s.sha256) throw new Error(`Repository sample does not match its manifest: ${path}`);
        return { midi: s.midi, path, sha256: s.sha256 };
      }) };
  };
  return [
    tonejs('tonejs-acoustic', 'guitar-acoustic', 'steel-string acoustic', 'University of Iowa Electronic Music Studios', 'development'),
    repo('martin', 'martin-guitar-v1', 'Kinwie Discord SFZ GM bank, Martin HD28 by Jeff Learman', 'development'),
    repo('spanish', 'spanish-guitar-v1', 'freepats Spanish classical guitar', 'development'),
    repo('fender', 'fender-guitar-v1', 'freepats Fender FSBS clean electric', 'development'),
    tonejs('tonejs-nylon', 'guitar-nylon', 'nylon-string classical', 'Freesound 11573 quartertone classicalguitar-multisampled', 'held-out'),
    tonejs('tonejs-electric', 'guitar-electric', 'electric', 'Karoryfer', 'held-out'),
    repo('shinyguitar', 'shinyguitar-v1', 'Karoryfer Shinyguitar', 'held-out'),
  ];
}
