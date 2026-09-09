import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
// The original fourteen hand-stated navigation cases, plus the later clef-form
// and partial D.S./ending regressions. IDs are corpus identities, not disk paths.
export const UNROLLED_SCENARIOS = [
  'spec/repeats',
  'spec/repeats-implied-start-repeat',
  'spec/repeats-more-once-repeated',
  'spec/repeats-alternate-endings-advanced',
  'spec/repeats-alternate-endings-simple',
  'spec/jumps-dal-segno',
  'spec/jumps-ds-al-fine',
  'spec/tie-targets',
  'lab/navigation/jumps-and-signs',
  'lab/navigation/repeats-and-marks-on-tab',
  'lab/navigation/numbered-bars',
  'lab/navigation/tempo-change-mid-bar',
  'lab/score-text/labels-with-navigation',
  'lab/score-text/labels-on-a-tab-staff',
  'lab/layout/coloured-marks-and-clef-forms',
  'lab/navigation/ds-final-ending',
];
export const UNROLLED_FILES = ['expected.unrolled.svg', 'expected.unrolled.tab.svg'];
export function unrolledFiles(scenario) {
  const doc = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8'));
  const tab = (Array.isArray(doc.parts) ? doc.parts : []).some((part) =>
    ['tab', 'both'].includes(part?._x?.mnxLab?.tab?.staffKind),
  );
  return tab ? UNROLLED_FILES : UNROLLED_FILES.slice(0, 1);
}
export function unrolledHash(scenario) {
  const document = path.join(scenario.dir, 'document.mnx.json');
  if (!fs.existsSync(document)) return null;
  const files = unrolledFiles(scenario);
  if (files.some((name) => !fs.existsSync(path.join(scenario.dir, name)))) return null;
  const hash = crypto.createHash('sha256');
  for (const name of files)
    hash
      .update(name)
      .update('\0')
      .update(fs.readFileSync(path.join(scenario.dir, name)));
  return `sha256:${hash.digest('hex').slice(0, 16)}`;
}
export function unrolledState(meta, hash) {
  if (!meta.unrolled)
    return meta.verification?.unrolledHash ? 'retired-without-review' : 'disabled';
  if (!hash) return 'blocked';
  if (!meta.verification?.unrolledHash) return 'unseen';
  return meta.verification.unrolledHash === hash ? 'current' : 'stale';
}
