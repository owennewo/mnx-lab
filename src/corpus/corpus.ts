import manifest from '../../scenarios/manifest.json';
import mnxSchema from '../../spec/mnx-schema.json';
import { isPlumbingDef } from './plumbingDefs.ts';

/**
 * The scenario corpus as the front-end sees it (see
 * roadmap/inprogress/04-scenario-library.md). Metadata is bundled eagerly (it is
 * small and drives the rail, facets, and the coverage dashboard); score
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
  expect: ScenarioExpect;
  requires?: string[];
  idRefs?: boolean;
  source: string;
  status: 'draft' | 'valid' | 'rendered' | 'verified';
}

export interface ScenarioEntry {
  id: string;
  ns: 'lab' | 'spec';
  /** 'lab/document', …, or 'spec' for the W3C mirror. */
  category: string;
  meta: ScenarioMeta;
  /** coversDefs minus plumbing — the coverage axis. */
  featureDefs: string[];
  /** Spec-reference links split out of specRefs. */
  specRef: string | null;
  issueRef: string | null;
  invalidByDesign: boolean;
  hasTab: boolean;
  loadScore: () => Promise<unknown>;
  loadNotes: (() => Promise<string>) | null;
}

const metaModules = import.meta.glob('../../scenarios/{lab,spec}/**/meta.json', {
  eager: true,
  import: 'default'
}) as Record<string, ScenarioMeta>;

const scoreModules = import.meta.glob('../../scenarios/{lab,spec}/**/score.mnx.json', {
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
    const scorePath = metaPath.replace(/meta\.json$/, 'score.mnx.json');
    const loader = scoreModules[scorePath];
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
      loadScore: loader,
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

// ---------- filtering (one flat filter feeds every shelving facet) ----------

export type StatusFilter = 'all' | 'verified' | 'rendered' | 'needs' | 'gaps';
export type Facet = 'category' | 'status' | 'source' | 'def';

export interface LibraryFilter {
  status: StatusFilter;
  query: string;
  idRefsOnly: boolean;
}

export function matchesFilter(e: ScenarioEntry, f: LibraryFilter): boolean {
  if (f.idRefsOnly && !e.meta.idRefs) return false;
  const st = e.meta.status;
  if (f.status === 'verified' && st !== 'verified') return false;
  if (f.status === 'rendered' && !(st === 'rendered' || st === 'verified')) return false;
  if (f.status === 'needs' && !((st === 'valid' || st === 'draft') && !e.invalidByDesign)) return false;
  if (f.status === 'gaps' && !e.invalidByDesign) return false;
  if (f.query) {
    const q = f.query.toLowerCase();
    if (
      !e.meta.title.toLowerCase().includes(q) &&
      !e.id.toLowerCase().includes(q) &&
      !(e.meta.tags ?? []).some(t => t.toLowerCase().includes(q)) &&
      !(e.meta.coversDefs ?? []).some(d => d.toLowerCase().includes(q))
    ) {
      return false;
    }
  }
  return true;
}

export function filterCorpus(f: LibraryFilter): ScenarioEntry[] {
  return corpus.filter(e => matchesFilter(e, f));
}

export interface StatusCounts {
  all: number;
  verified: number;
  rendered: number;
  needs: number;
  gaps: number;
  idRefs: number;
}

/** Counts for the rail's filter chips — always global, never post-filter. */
export function statusCounts(): StatusCounts {
  const all = corpus;
  return {
    all: all.length,
    verified: all.filter(e => e.meta.status === 'verified').length,
    rendered: all.filter(e => e.meta.status === 'rendered' || e.meta.status === 'verified').length,
    needs: all.filter(
      e => (e.meta.status === 'valid' || e.meta.status === 'draft') && !e.invalidByDesign
    ).length,
    gaps: all.filter(e => e.invalidByDesign).length,
    idRefs: all.filter(e => e.meta.idRefs).length
  };
}

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
