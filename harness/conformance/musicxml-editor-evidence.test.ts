import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const suite = read('converters/fixtures/musicxml-suite/manifest.json');

describe('retained MusicXML editor evidence provenance (not a fidelity gate)', () => {
  it('accounts for every pinned source in both shell observations', () => {
    for (const shell of ['workbench', 'studio']) {
      const report = read(`harness/reports/musicxml-editor-${shell}.json`);
      expect(report.corpusRevision).toBe(suite.revision);
      expect(report.fixtures.map((f: { id: string }) => f.id)).toEqual(suite.fixtures.map((f: { id: string }) => f.id));
      for (let i = 0; i < suite.fixtures.length; i++) {
        expect(report.fixtures[i].sourceSha256).toBe(suite.fixtures[i].sha256);
        expect(report.fixtures[i].featureAssessment).toBeTruthy();
      }
    }
  });
  it('retains exact capture bytes and binds selected imported documents to the observations', () => {
    const base = 'harness/fixtures/musicxml-editor-evidence/';
    const manifest = read(base + 'manifest.json');
    for (const [name, expected] of Object.entries(manifest.files)) {
      expect(hash(fs.readFileSync(path.join(root, base, name))), name).toBe(expected);
      if (name.endsWith('/document.mnx.json')) {
        const observation = read(base + name.replace('document.mnx.json', 'observation.json'));
        expect(hash(JSON.stringify(read(base + name)))).toBe(observation.importedDocumentSha256);
      }
    }
  });
});
