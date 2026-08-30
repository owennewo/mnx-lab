// Intent-trace replay over the editor session — the editor's fixture
// mechanism (roadmap/complete/core-editor-input-layer.md).
//
// A fixture in harness/fixtures/edit-traces/ names a corpus scenario (the
// starting document — fixtures never copy scores), an intent list (never
// keystrokes: intents survive every keymap rebinding), and the expected final
// document + cursor. Each fixture is replayed through the same EditorSession
// the workbench mounts, then held to four assertions:
//
//   1. final document deep-equals expect.doc
//   2. final cursor equals expect.cursor
//   3. the final document is schema-valid — a trace that mutates a document
//      into invalidity must fail loudly
//   4. undo-all returns the initial document BYTE-identically — the
//      determinism invariant that makes "copy trace" recordings trustworthy
//
// Regenerate expectations after deliberate op-behavior changes with:
// npm run update:edit-traces   (git diff is the review — no verify queue;
// these are machine-checkable, unlike the render goldens.)
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { replayIntents } from '../../src/edit/session.ts';
import type { TraceFixture } from '../../src/edit/session.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import validateMnx from '../../worker/generated/validate-mnx.mjs';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

const UPDATE = process.env.UPDATE_EDIT_TRACES === '1';

const FIXTURES_DIR = path.join(__dirname, '../fixtures/edit-traces');

const fixtureFiles = fs.existsSync(FIXTURES_DIR)
  ? fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json')).sort()
  : [];

// Fixtures name scenarios by CORPUS id (the one the workbench shows and
// "copy trace" stamps) — directory names carry ordering prefixes the id
// strips, so resolution goes through the corpus loader, not a path join.
const dirById = new Map<string, string>(
  loadCorpus().map((s: { id: string; dir: string }) => [s.id, s.dir])
);

function loadScenarioDoc(scenarioId: string): MnxStructure {
  const dir = dirById.get(scenarioId);
  if (!dir) throw new Error(`fixture names unknown scenario id: ${scenarioId}`);
  return JSON.parse(fs.readFileSync(path.join(dir, 'document.mnx.json'), 'utf8')) as MnxStructure;
}

describe(`edit traces${UPDATE ? ' (UPDATING)' : ''}`, () => {
  it('has at least one fixture', () => {
    expect(fixtureFiles.length).toBeGreaterThan(0);
  });

  for (const file of fixtureFiles) {
    it(file, () => {
      const fixturePath = path.join(FIXTURES_DIR, file);
      const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as TraceFixture;
      const initial = loadScenarioDoc(fixture.scenario);
      const session = replayIntents(initial, fixture.intents, fixture.scenario);

      if (UPDATE) {
        const updated: TraceFixture = { ...fixture, ...session.trace(), scenario: fixture.scenario };
        fs.writeFileSync(fixturePath, JSON.stringify(updated, null, 2) + '\n');
      } else {
        expect(fixture.expect, `${file} has no expectations — run npm run update:edit-traces`).toBeTruthy();
        expect(session.doc).toEqual(fixture.expect.doc);
        expect(session.cursor).toEqual(fixture.expect.cursor);
        expect(session.selection).toEqual(fixture.expect.selection);
      }

      // Both modes: the invariants hold for freshly-written fixtures too.
      expect(
        validateMnx(session.doc),
        `replayed document is schema-invalid: ${JSON.stringify(validateMnx.errors?.slice(0, 3))}`
      ).toBe(true);

      while (session.canUndo) session.handleIntent({ type: 'undo' });
      expect(JSON.stringify(session.doc)).toBe(JSON.stringify(initial));
    });
  }
});
