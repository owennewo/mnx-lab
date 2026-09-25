// External inputs widen the observation surface. Nothing in this baseline is
// an independent correctness verdict; music21 is campaign item 14.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importMusicXML } from '../../converters/musicxml-mnx/src/import/musicxml.ts';
import { exportMusicXML } from '../../converters/musicxml-mnx/src/export/mnx.ts';
import { readMxl } from '../../converters/musicxml-mnx/src/common/mxl.ts';
import { defsInDocument, extensionKeysInDocument } from '../helpers/mnxDefs.ts';
import validateMnx from '../../worker/generated/validate-mnx.mjs';
import * as extensionValidators from '../../worker/generated/validate-extensions.mjs';


const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SUITE = path.join(ROOT, 'converters/fixtures/musicxml-suite');
const REPORT = path.join(ROOT, 'harness/reports/musicxml-suite.json');
const UPDATING = process.env.UPDATE_MUSICXML_SUITE === '1';
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
interface Fixture {
  id: string; path: string; sha256: string; bytes: number;
  format: 'musicxml' | 'mxl'; testClass: 'feature' | 'negative' | 'compatibility';
  description: string | null; elements: Record<string, number>;
}
const manifest = JSON.parse(fs.readFileSync(path.join(SUITE, 'manifest.json'), 'utf8')) as {
  repository: string; revision: string; notices: Record<string, string>; fixtures: Fixture[];
};

function observedDefs(document: unknown): string[] {
  return [...defsInDocument(document), ...extensionKeysInDocument(document)].sort();
}
type Validator = ((value: unknown) => boolean) & { errors: unknown[] | null };
const validators = extensionValidators as Record<string, Validator>;
for (const name of ['validateNoteExt', 'validatePartExt', 'validateGlobalMeasureExt', 'validateRootExt']) {
  if (typeof validators[name] !== 'function') throw new Error(`Missing extension validator: ${name}`);
}
// Walk nested grace/tuplet containers too. Validate all four allowed placements;
// an extension in another location is explicitly unassessed, not silently valid.
function extensionErrors(document: unknown) {
  const errors: { path: string; errors: unknown[] }[] = [];
  function walk(value: unknown, location: string): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${location}/${index}`));
      return;
    }
    const object = value as Record<string, unknown>;
    const vendor = (object._x as { mnxLab?: unknown } | undefined)?.mnxLab;
    if (vendor !== undefined) {
      const name = location === '' ? 'validateRootExt'
        : /^\/parts\/\d+$/.test(location) ? 'validatePartExt'
          : /^\/global\/measures\/\d+$/.test(location) ? 'validateGlobalMeasureExt'
            : /\/notes\/\d+$/.test(location) ? 'validateNoteExt' : undefined;
      if (!name) errors.push({ path: location, errors: ['Unsupported extension placement'] });
      else if (!validators[name](vendor)) {
        errors.push({ path: `${location}/_x/mnxLab`, errors: structuredClone(validators[name].errors ?? []) });
      }
    }
    for (const [key, child] of Object.entries(object)) {
      if (key !== '_x') walk(child, `${location}/${key}`);
    }
  }
  walk(document, '');
  return errors;
}
function validity(document: unknown) {
  const standard = validateMnx(document);
  const standardErrors = structuredClone(validateMnx.errors ?? []);
  const errors = extensionErrors(document);
  return { standard, extensions: errors.length === 0, standardErrors, extensionErrors: errors };
}
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

async function observe(fixture: Fixture) {
  const warnings: string[] = [];
  let stage = 'read';
  const result: Record<string, unknown> = { id: fixture.id, testClass: fixture.testClass };
  try {
    const bytes = fs.readFileSync(path.join(SUITE, fixture.path));
    const xml = fixture.format === 'mxl' ? await readMxl(bytes) : bytes.toString('utf8');
    stage = 'import';
    const imported = importMusicXML(xml, { onWarning: warning => warnings.push(warning) });
    stage = 'observation';
    result.import = {
      sha256: hash(JSON.stringify(imported)), warnings: [...warnings],
      validity: validity(imported), observedDefs: observedDefs(imported),
      parts: imported.parts.length, measures: imported.global.measures.length,
    };
    warnings.length = 0;
    stage = 'export';
    const exported = exportMusicXML(imported, { onWarning: warning => warnings.push(warning) });
    result.export = { sha256: hash(exported), warnings: [...warnings] };
    warnings.length = 0;
    stage = 'reimport';
    const returned = importMusicXML(exported, { onWarning: warning => warnings.push(warning) });
    stage = 'observation';
    const returnedDefs = new Set(observedDefs(returned));
    result.reimport = {
      sha256: hash(JSON.stringify(returned)), warnings: [...warnings], validity: validity(returned),
      lostDefs: observedDefs(imported).filter(def => !returnedDefs.has(def)),
    };
    result.pipeline = 'completed';
  } catch (error) {
    if (stage === 'observation') throw error; // harness errors must fail, not become converter findings
    result.pipeline = 'failed';
    result.failure = { stage, message: errorMessage(error), warnings: [...warnings] };
  }
  return result;
}

const rows: Awaited<ReturnType<typeof observe>>[] = [];
for (const fixture of manifest.fixtures) rows.push(await observe(fixture));
const report = {
  note: 'Generated by npm run update:musicxml-suite. Observations only, NOT semantic accuracy, '
    + 'rendering or authoring verdicts. Output hashes detect changes, including improvements. '
    + 'lostDefs detects disappearance of entire definitions, not value/instance loss. '
    + 'Negative and compatibility inputs are distinct from feature cases. Do not update merely to hide regressions.',
  revision: manifest.revision,
  summary: Object.fromEntries(['feature', 'negative', 'compatibility'].map(kind => {
    const group = rows.filter(row => row.testClass === kind);
    return [kind, {
      fixtures: group.length,
      completed: group.filter(row => row.pipeline === 'completed').length,
      failed: group.filter(row => row.pipeline === 'failed').length,
      validImports: group.filter(row => {
        const imported = row.import as { validity: { standard: boolean; extensions: boolean } } | undefined;
        return imported?.validity.standard && imported.validity.extensions;
      }).length,
    }];
  })),
  rows,
};
if (UPDATING) fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');

describe('pinned external MusicXML suite', () => {
  it('validates vendor data inside nested tuplet and grace containers', () => {
    const doc = { parts: [{ measures: [{ sequences: [{ content: [
      { type: 'tuplet', content: [{ type: 'grace', content: [
        { type: 'event', notes: [{ _x: { mnxLab: { string: 'invalid' } } }] }
      ] }] }
    ] }] }] }] };
    const errors = extensionErrors(doc);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('/parts/0/measures/0/sequences/0/content/0/content/0/content/0/notes/0/_x/mnxLab');
  });

  it('retains every inventoried byte and the upstream licence notices', () => {
    const paths = manifest.fixtures.map(fixture => fixture.path).sort();
    const actual = fs.readdirSync(path.join(SUITE, 'xmlFiles'), { recursive: true })
      .map(String).filter(name => fs.statSync(path.join(SUITE, 'xmlFiles', name)).isFile())
      .map(name => `xmlFiles/${name}`).sort();
    expect(actual).toEqual(paths);
    expect(new Set(manifest.fixtures.map(f => f.id)).size).toBe(paths.length);
    expect(paths.length).toBe(183); // pinned upstream tree, change only with a reviewed pin
    for (const fixture of manifest.fixtures) {
      const bytes = fs.readFileSync(path.join(SUITE, fixture.path));
      expect(bytes.length, fixture.id).toBe(fixture.bytes);
      expect(hash(bytes), fixture.id).toBe(fixture.sha256);
    }
    for (const [name, expected] of Object.entries(manifest.notices)) {
      expect(hash(fs.readFileSync(path.join(SUITE, name))), name).toBe(expected);
    }
  });

  it('records every fixture, including invalid and compressed inputs, without silently skipping failures', () => {
    expect(rows.map(row => row.id)).toEqual(manifest.fixtures.map(fixture => fixture.id));
    expect(manifest.fixtures.some(f => f.format === 'mxl')).toBe(true);
    expect(manifest.fixtures.some(f => f.testClass === 'negative')).toBe(true);
    for (const row of rows) {
      expect(['completed', 'failed']).toContain(row.pipeline);
      if (row.pipeline === 'completed') expect(row.reimport).toBeDefined();
      else expect(row.failure).toBeDefined();
    }
  });

  it('matches the reviewed observation baseline', () => {
    if (UPDATING) return;
    expect(report).toEqual(JSON.parse(fs.readFileSync(REPORT, 'utf8')));
  });
});
