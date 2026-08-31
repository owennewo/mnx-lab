import manifest from '../../scenarios/manifest.json';
import mnxSchema from '../../spec/mnx-schema.json';
import { isPlumbingDef } from './plumbingDefs.ts';

/**
 * The scenario corpus as the front-end sees it (see
 * roadmap/complete/lab-04-scenario-library.md). Metadata is bundled eagerly (it is
 * small and drives the rail, facets, and the coverage dashboard); MNX
 * documents and notes.md load on demand. The data model is deliberately FLAT:
 * "category" is just the default grouping facet — shelving by status, source,
 * or schema $def regroups the same filtered list.
 */

export interface ScenarioExpect {
  standard: 'valid' | 'invalid';
  extension: 'valid' | 'invalid' | 'n/a';
  errors?: string[];
}

export interface ScenarioMeta {
  title: string;
  description: string;
  bars?: number;
  tags?: string[];
  specRefs?: string[];
  coversDefs?: string[];
  /** Which MNX schema judges expect.standard; default "published". */
  schema?: 'published' | 'proposed';
  expect: ScenarioExpect;
  requires?: string[];
  idRefs?: boolean;
  source: string;
  status: 'draft' | 'valid' | 'rendered' | 'verified';
  /**
   * Provenance of the last human approval — written only by
   * harness/verify/verify-scenarios.mjs and kept through demotion, so the
   * workbench can tell stale (record present, status demoted) from
   * never-seen (no record). Display-only here: the workbench never writes it.
   */
  verification?: { at: string; primitivesHash?: string; renderHash?: string; bothHash?: string };
}

export interface ScenarioEntry {
  id: string;
  ns: 'lab' | 'spec';
  /**
   * The authoring category — 'lab/document', …, or 'spec' for the W3C mirror.
   * A property of where the scenario lives, NOT how the rail groups it: the
   * rail groups by topic so lab and spec interleave (src/corpus/groups.ts).
   */
  category: string;
  meta: ScenarioMeta;
  /** coversDefs minus plumbing — the coverage axis. */
  featureDefs: string[];
  /** Spec-reference links split out of specRefs. */
  specRef: string | null;
  issueRef: string | null;
  invalidByDesign: boolean;
  hasTab: boolean;
  loadDocument: () => Promise<unknown>;
  loadNotes: (() => Promise<string>) | null;
}

const metaModules = import.meta.glob('../../scenarios/{lab,spec}/**/meta.json', {
  eager: true,
  import: 'default'
}) as Record<string, ScenarioMeta>;

const documentModules = import.meta.glob('../../scenarios/{lab,spec}/**/document.mnx.json', {
  import: 'default'
}) as Record<string, () => Promise<unknown>>;

const notesModules = import.meta.glob('../../scenarios/{lab,spec}/**/notes.md', {
  query: '?raw',
  import: 'default'
}) as Record<string, () => Promise<string>>;

function buildEntries(): ScenarioEntry[] {
  const entries: ScenarioEntry[] = [];
  for (const metaPath of Object.keys(metaModules).sort()) {
    const rel = metaPath.replace(/^.*?scenarios\//, '').replace(/\/meta\.json$/, '');
    const segments = rel.split('/').map(s => s.replace(/^\d+-/, ''));
    const documentPath = metaPath.replace(/meta\.json$/, 'document.mnx.json');
    const loader = documentModules[documentPath];
    if (!loader) continue;
    const meta = metaModules[metaPath];
    const ns = segments[0] as 'lab' | 'spec';
    const refs = meta.specRefs ?? [];
    const issueRef = refs.find(r => r.includes('github.com')) ?? null;
    const specRef = refs.find(r => !r.includes('github.com')) ?? null;
    const notesPath = metaPath.replace(/meta\.json$/, 'notes.md');
    entries.push({
      id: segments.join('/'),
      ns,
      category: ns === 'spec' ? 'spec' : segments.slice(0, -1).join('/'),
      meta,
      featureDefs: (meta.coversDefs ?? []).filter(d => !isPlumbingDef(d)),
      specRef,
      issueRef,
      invalidByDesign: meta.expect.standard === 'invalid' || meta.expect.extension === 'invalid',
      hasTab: meta.expect.extension !== 'n/a',
      loadDocument: loader,
      loadNotes: notesModules[notesPath] ?? null
    });
  }
  // lab/ (ours) first, then spec/, in path order within each namespace
  return entries.sort((a, b) =>
    a.ns === b.ns ? a.id.localeCompare(b.id) : a.ns === 'lab' ? -1 : 1
  );
}

export const corpus: ScenarioEntry[] = buildEntries();

export const corpusManifest = {
  mnxVersion: manifest.mnxSchemaVersion,
  extensionVersion: manifest.extensionVersion,
  categories: manifest.categories as Record<string, string>,
  specSynced: (manifest.specExamples as { synced?: string }).synced ?? ''
};

// ---------- feature-def coverage (the dashboard's progress metric) ----------

export interface Coverage {
  covered: number;
  total: number;
  uncovered: string[];
}

const allFeatureDefs = Object.keys((mnxSchema as { $defs?: Record<string, unknown> }).$defs ?? {})
  .filter(d => !isPlumbingDef(d))
  .sort();

export function computeCoverage(): Coverage {
  const covered = new Set<string>();
  for (const e of corpus) {
    for (const d of e.featureDefs) covered.add(d);
  }
  const uncovered = allFeatureDefs.filter(d => !covered.has(d));
  return {
    covered: allFeatureDefs.length - uncovered.length,
    total: allFeatureDefs.length,
    uncovered
  };
}

export const coverage: Coverage = computeCoverage();
