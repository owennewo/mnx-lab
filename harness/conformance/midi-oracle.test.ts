import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { it, expect } from 'vitest';
import { compilePerformance } from '../../src/audio/performance.ts';
import { exportMidi } from '../../src/audio/midiFile.ts';
import {
  midiAttacks,
  performanceAttacks,
  xmlEvidence,
  comparePerformances,
  alignAttacks,
} from '../helpers/midiOracle.ts';
const dir = 'harness/fixtures/midi-oracle';
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const hash = (b: Uint8Array) => crypto.createHash('sha256').update(b).digest('hex');
const reportPath = 'harness/reports/midi-oracle.json';
const attributions = JSON.parse(fs.readFileSync(path.join(dir, 'attributions.json'), 'utf8'));
it('compares all 27 independent W3C pairs and four converter fixtures against pinned MuseScore evidence', () => {
  expect(manifest.tool.version).toBe('4.7.5');
  expect(manifest.tool.build).toBe('3654226');
  expect(manifest.cases.filter((r: any) => r.id.startsWith('w3c/'))).toHaveLength(27);
  expect(manifest.cases.filter((r: any) => r.id.startsWith('converter/'))).toHaveLength(4);
  const rows = manifest.cases.map((row: any) => {
    const xml = fs.readFileSync(row.xml),
      bytes = fs.readFileSync(path.join(dir, row.midi));
    expect(hash(xml), row.id + ' input changed: recapture the external tool').toBe(row.inputSha256);
    expect(hash(bytes), row.id + ' external recording hash').toBe(row.midiSha256);
    const doc = fs.readFileSync(row.mnx),
      compiled = compilePerformance(JSON.parse(doc.toString()));
    if (!compiled.ok) throw Error(row.id + ': ' + JSON.stringify(compiled.diagnostics));
    const external = midiAttacks(bytes),
      ours = performanceAttacks(compiled.performance),
      source = xmlEvidence(xml.toString());
    const comparison = comparePerformances(ours, external.attacks, source);
    const attribution = attributions[row.id] ?? null;
    let importedEvidence;
    if (row.importedEvidence) {
      const bytes = fs.readFileSync(path.join(dir, row.importedEvidence));
      expect(hash(bytes)).toBe(row.importedSha256);
      importedEvidence = JSON.parse(bytes.toString());
    }

    const midi = exportMidi(compiled.performance);
    const exported = midi.ok ? midiAttacks(midi.bytes) : null;
    if (exported) {
      // Written identity is attached only to OUR exported attacks. External bar
      // identity still comes solely from independent MusicXML fingerprints.
      for (const [ei, oi] of alignAttacks(exported.attacks, ours)) {
        const measures = new Set(ours[oi].notes.map((n) => n.measure));
        if (measures.size === 1)
          for (const note of exported.attacks[ei].notes) note.measure = ours[oi].notes[0].measure;
      }
    }
    const exportedComparison = exported
      ? comparePerformances(exported.attacks, external.attacks, source)
      : null;
    expect(Boolean(attribution), row.id + ' export discrepancy needs attribution').toBe(
      !comparison.strict.match || !exportedComparison?.strict.match,
    );
    return {
      id: row.id,
      attribution,
      importedEvidence,
      inputSha256: row.inputSha256,
      mnxSha256: hash(doc),
      externalMidiSha256: row.midiSha256,
      external: {
        ppq: external.ppq,
        tempoEvents: external.tempoEvents,
        pitchBendEvents: external.pitchBendEvents,
        noncentralPitchBendEvents: external.noncentralPitchBendEvents,
        techniqueComparison:
          external.noncentralPitchBendEvents === 0
            ? 'unobservable: this export contains no noncentral pitch bend events; no guitar curve agreement is claimed'
            : 'unobservable: noncentral channel bends require independent note/channel attribution before comparison',
      },
      ...comparison,
      export: {
        ok: midi.ok,
        ppq: exported?.ppq,
        match: exportedComparison?.strict.match ?? false,
        pitchOrder: exportedComparison?.strict.pitchOrder,
        timing: exportedComparison?.strict.timing,
        bars: exportedComparison
          ? {
              checked: exportedComparison.strict.bars.checked,
              mismatches: exportedComparison.strict.bars.mismatches,
            }
          : null,
        diagnostics: midi.diagnostics,
      },
      compilerDiagnostics: compiled.performance.diagnostics,
    };
  });
  const engraving = JSON.parse(
    fs.readFileSync('harness/reports/musicxml-oracle.json', 'utf8'),
  ).summary;
  const summary = {
    engravingReference: { matches: engraving.verdicts.match, comparisons: engraving.comparisons },
    comparisons: rows.length,
    w3cStrictMatches: rows.filter((r: any) => r.id.startsWith('w3c/') && r.strict.match).length,
    converterStrictMatches: rows.filter((r: any) => r.id.startsWith('converter/') && r.strict.match)
      .length,
    w3cMidiExportMatches: rows.filter((r: any) => r.id.startsWith('w3c/') && r.export.match).length,
    strictTimingChecked: rows.reduce((n: number, r: any) => n + r.strict.timing.checked, 0),
    strictTimingExcluded: rows.reduce(
      (n: number, r: any) => n + r.strict.timing.excluded.length,
      0,
    ),
    matchedNotes: rows.reduce((n: number, r: any) => n + r.coverage.matchedNotes, 0),
    totalOurNotes: rows.reduce((n: number, r: any) => n + r.coverage.ourNotes, 0),
    totalExternalNotes: rows.reduce((n: number, r: any) => n + r.coverage.externalNotes, 0),
    observableBarChecks: rows.reduce((n: number, r: any) => n + r.strict.bars.checked, 0),
  };
  const report = {
    formatVersion: 1,
    tool: manifest.tool,
    policy:
      'Independent MuseScore MIDI; strict content/timing baseline moves in either direction require review. Interpretive spans and unobservable bars remain explicit. Converter XML is derived input, not independent authorship.',
    summary,
    rows,
  };
  if (process.env.UPDATE_MIDI_ORACLE === '1')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  else expect(report).toEqual(JSON.parse(fs.readFileSync(reportPath, 'utf8')));
}, 30000);
