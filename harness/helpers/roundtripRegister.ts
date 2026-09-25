// The Guitar Pro round-trip register's measurement: what a document loses, gains
// or changes crossing the storage exporter and the importer, per lane. Shared by
// the register test (harness/conformance/roundtrip-register.test.ts) and the
// operator's private-library report (harness/verify/roundtrip-library.ts).
import fs from 'node:fs';
import path from 'node:path';
import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
import { exportGuitarProGpif, STORAGE_EXPORT_OPTIONS } from '../../converters/guitarpro-mnx/src/gpif/fromMnx.ts';
import { collapseDifferences, compareDocuments, type DifferenceShape } from '../../src/model/documentCompare.ts';
// @ts-expect-error plain mjs
import { loadCorpus } from '../verify/check-scenarios.mjs';

/**
 * `gains` is its own verdict because it is its own finding: nothing that went
 * in was lost or changed, but the document that comes back says MORE — Guitar
 * Pro has no "unstated", so a track always returns with a tuning, a key, a
 * transposition and a voice name. Not a loss, and not nothing either: a
 * notation-only part reloads as one with strings.
 */
export interface Entry {
  verdict: 'clean' | 'gains' | 'differs' | 'error';
  error?: string;
  differences?: DifferenceShape[];
  warnings?: { message: string; count: number }[];
}
type Exportable = Parameters<typeof exportGuitarProGpif>[0];

/** Warnings name bars, ids and texts; the register wants the KIND of warning. */
function collapseWarnings(warnings: string[]): Entry['warnings'] {
  const counts = new Map<string, number>();
  for (const warning of warnings) {
    const message = warning.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, '#');
    counts.set(message, (counts.get(message) ?? 0) + 1);
  }
  return [...counts].map(([message, count]) => ({ message, count })).sort((a, b) => a.message.localeCompare(b.message));
}

/** MNX → .gp → MNX, judged against the document that went in. */
function roundTrip(document: unknown): Entry {
  const warnings: string[] = [];
  let returned: unknown;
  try {
    // A SAVE, not an export for a person: the storage options, as studio will use.
    const bytes = exportGuitarProGpif(document as Exportable, { ...STORAGE_EXPORT_OPTIONS, onWarning: message => warnings.push(message) });
    returned = importGuitarProCleanRoom(bytes);
  } catch (error) {
    return { verdict: 'error', error: (error as Error).message.replace(/\d+/g, '#') };
  }
  const differences = collapseDifferences(compareDocuments(document, returned));
  const entry: Entry = {
    verdict: !differences.length ? 'clean' : differences.every(d => d.kind === 'gained') ? 'gains' : 'differs'
  };
  if (differences.length) entry.differences = differences;
  if (warnings.length) entry.warnings = collapseWarnings(warnings);
  return entry;
}

export function fixtureLane(dir: string): Record<string, Entry> {
  const lane: Record<string, Entry> = {};
  for (const file of fs.readdirSync(dir).filter(f => /\.(gp|gpx|gp[345])$/i.test(f)).sort()) {
    try {
      lane[file] = roundTrip(importGuitarProCleanRoom(new Uint8Array(fs.readFileSync(path.join(dir, file)))));
    } catch (error) {
      lane[file] = { verdict: 'error', error: `import: ${(error as Error).message.replace(/\d+/g, '#')}` };
    }
  }
  return lane;
}

export function corpusLane(): Record<string, Entry> {
  const lane: Record<string, Entry> = {};
  for (const scenario of loadCorpus() as { id: string; dir: string }[]) {
    const file = path.join(scenario.dir, 'document.mnx.json');
    if (fs.existsSync(file)) lane[scenario.id] = roundTrip(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  return lane;
}

export function report(lanes: Record<string, Record<string, Entry>>) {

  // The backlog, ranked: each path shape with the number of documents it bit.
  const shapes = new Map<string, { path: string; kind: string; documents: number; count: number }>();
  const verdicts = { clean: 0, gains: 0, differs: 0, error: 0 };
  for (const lane of Object.values(lanes)) for (const entry of Object.values(lane)) {
    verdicts[entry.verdict]++;
    for (const { path: shape, kind, count } of entry.differences ?? []) {
      const key = `${shape} | ${kind}`;
      const total = shapes.get(key) ?? { path: shape, kind, documents: 0, count: 0 };
      total.documents++; total.count += count;
      shapes.set(key, total);
    }
  }
  const ranked = (gained: boolean) => [...shapes.values()].filter(s => (s.kind === 'gained') === gained)
    .sort((a, b) => b.documents - a.documents || b.count - a.count || a.path.localeCompare(b.path));
  return { generatedBy: 'npm run update:roundtrip-register', verdicts, lostOrChanged: ranked(false), gained: ranked(true), lanes };
}
