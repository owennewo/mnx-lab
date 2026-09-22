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
  it('binds the meter review to every pinned meter source, shown preferences and retained bytes', () => {
    const base = 'harness/fixtures/musicxml-meter-evidence/';
    const manifest = read(base + 'manifest.json');
    for (const [name, expected] of Object.entries(manifest.files)) {
      expect(hash(fs.readFileSync(path.join(root, base, name))), name).toBe(expected);
      if (name.endsWith('/document.mnx.json')) {
        const observation = read(base + name.replace('document.mnx.json', 'observation.json'));
        expect(hash(JSON.stringify(read(base + name)))).toBe(observation.importedDocumentSha256);
      }
    }
    const fixtures = suite.fixtures.filter((f: { id: string }) => f.id.startsWith('11'));
    const review = read('harness/reports/musicxml-meter-assessment.json');
    expect(review.corpusRevision).toBe(suite.revision);
    expect(review.fixtures.map((f: { id: string }) => f.id)).toEqual(fixtures.map((f: { id: string }) => f.id));
    for (const shell of ['workbench', 'studio']) {
      const report = read(base + shell + '/index.json');
      expect(report.corpusRevision).toBe(suite.revision);
      expect(report.fixtures.map((f: { id: string }) => f.id)).toEqual(fixtures.map((f: { id: string }) => f.id));
      for (let i = 0; i < fixtures.length; i++) {
        expect(report.fixtures[i].sourceSha256).toBe(fixtures[i].sha256);
        expect(review.fixtures[i].sourceSha256).toBe(fixtures[i].sha256);
        expect(report.fixtures[i].displayOptions.timeSignatures).toBe('show');
      }
    }
    const write = read(base + 'write/report.json');
    expect(write.error).toBeUndefined();
    expect(write.tasks.map((t: { task: string }) => t.task)).toEqual(['remove', 'create', 'change', 'common', 'cut']);
  });

  it('binds the post-fix captures to source bytes and both-shell documents', () => {
    const base = 'harness/fixtures/musicxml-import-fix-evidence/';
    const manifest = read(base + 'manifest.json');
    for (const [name, expected] of Object.entries(manifest.files)) {
      expect(hash(fs.readFileSync(path.join(root, base, name))), name).toBe(expected);
    }
    const workbench = read(base + 'workbench/index.json');
    const studio = read(base + 'studio/index.json');
    expect(workbench.corpusRevision).toBe(suite.revision);
    expect(studio.corpusRevision).toBe(suite.revision);
    expect(studio.fixtures.map((f: { id: string }) => f.id)).toEqual(workbench.fixtures.map((f: { id: string }) => f.id));
    for (let i = 0; i < workbench.fixtures.length; i++) {
      const row = workbench.fixtures[i];
      expect(row.sourceSha256).toBe(suite.fixtures.find((f: { id: string }) => f.id === row.id).sha256);
      expect(studio.fixtures[i].importedDocumentSha256).toBe(row.importedDocumentSha256);
      for (const shell of ['workbench', 'studio']) {
        expect(hash(JSON.stringify(read(base + shell + '/' + row.id + '/document.mnx.json')))).toBe(row.importedDocumentSha256);
      }
    }
  });

  it('retains complete-source clef containment observations in both shells', () => {
    const base = 'harness/fixtures/musicxml-clef-evidence/';
    const manifest = read(base + 'manifest.json');
    for (const [name, expected] of Object.entries(manifest.files)) {
      expect(hash(fs.readFileSync(path.join(root, base, name))), name).toBe(expected);
    }
    const reports = ['workbench', 'studio'].map(shell => read(base + shell + '/index.json'));
    for (const report of reports) {
      expect(report.captureScriptSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(report.corpusRevision).toBe(suite.revision);
      expect(report.fixtures.map((f: { id: string }) => f.id)).toEqual(['12a-Clefs', '34c-Font-Size', '41c-StaffGroups', '73a-Percussion']);
      for (const row of report.fixtures) {
        expect(row.sourceSha256).toBe(suite.fixtures.find((f: { id: string }) => f.id === row.id).sha256);
        expect(row.captureError).toBeUndefined();
        expect(hash(JSON.stringify(read(base + report.shell + '/' + row.id + '/document.mnx.json')))).toBe(row.importedDocumentSha256);
        for (const view of row.views) expect(view.renderErrors).toEqual([]);
      }
    }
    expect(reports[0].fixtures.map((f: { importedDocumentSha256: string }) => f.importedDocumentSha256))
      .toEqual(reports[1].fixtures.map((f: { importedDocumentSha256: string }) => f.importedDocumentSha256));
    const tall = reports[1].fixtures.find((f: { id: string }) => f.id === '41c-StaffGroups').views[0];
    expect(tall.scrollTarget).toBe('viewer');
    expect(tall.scrollHeight).toBeGreaterThan(tall.clientHeight);
    expect(tall.screenshots).toContain(`notation-0-${tall.scrollHeight - tall.clientHeight}.png`);
  });

  it('binds the exact-meter follow-up to all twelve sources and equal shell documents', () => {
    const base = 'harness/fixtures/musicxml-meter-fix-evidence/';
    const manifest = read(base + 'manifest.json');
    for (const [name, expected] of Object.entries(manifest.files)) {
      expect(hash(fs.readFileSync(path.join(root, base, name))), name).toBe(expected);
    }
    const fixtures = suite.fixtures.filter((f: { id: string }) => f.id.startsWith('11'));
    const reports = ['workbench', 'studio'].map(shell => read(base + shell + '/index.json'));
    for (const report of reports) {
      expect(report.corpusRevision).toBe(suite.revision);
      expect(report.fixtures.map((f: { id: string }) => f.id)).toEqual(fixtures.map((f: { id: string }) => f.id));
      for (const row of report.fixtures) {
        expect(row.sourceSha256).toBe(fixtures.find((f: { id: string }) => f.id === row.id).sha256);
        expect(row.captureError).toBeUndefined();
        expect(row.importError).toBeNull();
        expect(row.displayOptions.timeSignatures).toBe('show');
        expect(hash(JSON.stringify(read(base + report.shell + '/' + row.id + '/document.mnx.json')))).toBe(row.importedDocumentSha256);
        for (const view of row.views) expect(view.renderErrors).toEqual([]);
      }
    }
    expect(reports[0].fixtures.map((f: { importedDocumentSha256: string }) => f.importedDocumentSha256))
      .toEqual(reports[1].fixtures.map((f: { importedDocumentSha256: string }) => f.importedDocumentSha256));
  });

});
