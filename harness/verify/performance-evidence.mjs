import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const PERFORMANCE_FILES = ['expected.performance.json', 'expected.midi.json'];
/** One approval covers the rational tables and the bounded MIDI byte verdict. */
export function performanceHash(scenario) {
  const paths = PERFORMANCE_FILES.map((name) => path.join(scenario.dir, name));
  if (paths.some((file) => !fs.existsSync(file))) return null;
  const hash = crypto.createHash('sha256');
  PERFORMANCE_FILES.forEach((name, i) =>
    hash.update(name).update('\0').update(fs.readFileSync(paths[i])),
  );
  return `sha256:${hash.digest('hex').slice(0, 16)}`;
}
export function performanceState(meta, hash) {
  if (!meta.performance)
    return meta.verification?.performanceHash ? 'retired-without-review' : 'disabled';
  if (!hash) return 'blocked';
  if (!meta.verification?.performanceHash) return 'unseen';
  return meta.verification.performanceHash === hash ? 'current' : 'stale';
}
/** Initial evidence selection; sync owns mirrored metadata. No status writes. */
export function performanceCandidate(doc) {
  let found = false;
  const walk = (value) => {
    if (!value || typeof value !== 'object') return;
    if (
      ['tuplet', 'grace', 'tremolo'].includes(value.type) ||
      ['ties', 'tempos', 'repeatStart', 'repeatEnd', 'jump', 'fermata', 'tremolo'].some((key) => key in value)
    )
      found = true;
    Object.values(value).forEach(walk);
  };
  walk(doc);
  return found;
}
