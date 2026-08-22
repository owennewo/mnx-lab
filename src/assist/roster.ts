// The roster as the output of stored queries — the dev-time first consumer of
// modelSelect.ts (roadmap: core-assist-model-selector.md).
//
// worker/models.json is what /api/models serves; it used to be a hand-list of
// ids somebody once thought well of, with the judgement embedded in the choice
// and decaying silently as the catalog churned. Here the judgement is DATA:
// worker/models.query.json holds one requirements definition per roster slot,
// each with the sentence explaining why that slot exists, and the roster is
// what those queries return against a catalog. Regenerating is
// `npm run update:roster`; the committed diff is the review.
//
// Pure, DOM-free, fetchless like the scorer it sits on — the script at
// harness/conformance/roster.test.ts is the only thing that touches disk or
// the network.

import { selectModels, type ModelRequirements, type ScoredModel } from './modelSelect.ts';
import type { CatalogModel } from './modelSelect.ts';

/** One row of worker/models.json — id plus the display pair the drawer shows. */
export interface RosterEntry {
  id: string;
  name: string;
  provider: string;
}

/** One slot's stored query. `why` is the rationale column made data: the
 *  retired hand-curation had one, which is the tell that the requirements were
 *  always articulable and only the lookup was manual. */
export interface RosterQuery {
  name: string;
  why: string;
  take: number;
  /** Variant endpoints (`:free`, `:batch`, …) are excluded by default — see
   *  isCanonical below. A query opts in deliberately or not at all. */
  allowVariants?: boolean;
  requirements: ModelRequirements;
}

export interface RosterLane {
  why?: string;
  queries?: RosterQuery[];
  /** Rows no query can produce, kept verbatim with `why` saying which fact of
   *  the world makes them underivable. Deliberately not a general escape
   *  hatch: a declared row is a hand-list of one lane, visibly so. */
  declared?: RosterEntry[];
}

export interface RosterDefinition {
  /** Free text at the top of the file, echoed into the generated roster so the
   *  generated file names its own generator. */
  note?: string;
  lanes: Record<string, RosterLane>;
}

/** What each query contributed, for the regeneration report — the queries are
 *  reviewable only if you can see which one bought which row. */
export interface RosterTraceRow {
  lane: string;
  query: string;
  entry: RosterEntry;
  score: number;
  effectivePrice: number;
  /** A row a previous query in the same lane already took is not taken twice;
   *  it stays in the trace so the overlap between queries is visible. */
  duplicate: boolean;
}

export interface BuiltRoster {
  roster: Record<string, RosterEntry[]>;
  trace: RosterTraceRow[];
}

/** `:free` is a promotional endpoint that rotates on someone else's schedule,
 *  `:batch` is the asynchronous batch API, and a leading `~` marks a floating
 *  "latest" alias — none is a thing a committed roster should name, because
 *  all three move under the commit that names them. (The variants would also
 *  inherit their family's priors and so outrank the endpoint they are a
 *  variant of.) The picker reaches them live; the roster does not. */
export function isCanonical(id: string): boolean {
  return !id.includes(':') && !id.startsWith('~');
}

/** OpenRouter display names are `Provider: Model` — the same pair the drawer
 *  shows, so the split is the whole derivation. A name without the prefix
 *  falls back to the id's org segment. */
export function splitDisplayName(model: CatalogModel): { name: string; provider: string } {
  const sep = model.name.indexOf(': ');
  if (sep === -1) return { name: model.name, provider: model.id.split('/')[0] ?? '' };
  return { name: model.name.slice(sep + 2), provider: model.name.slice(0, sep) };
}

function entryOf(scored: ScoredModel): RosterEntry {
  const { name, provider } = splitDisplayName(scored.model);
  return { id: scored.model.id, name, provider };
}

/** Run every lane's queries against one catalog. Within a lane the queries run
 *  in order and their results concatenate best-first, deduplicated — so the
 *  lane order IS the query order, which is what makes the file reviewable
 *  top-to-bottom. */
export function buildRoster(def: RosterDefinition, catalog: CatalogModel[]): BuiltRoster {
  const roster: Record<string, RosterEntry[]> = {};
  const trace: RosterTraceRow[] = [];
  for (const [lane, spec] of Object.entries(def.lanes)) {
    const seen = new Set<string>();
    const entries: RosterEntry[] = [];
    for (const query of spec.queries ?? []) {
      const pool = query.allowVariants ? catalog : catalog.filter(m => isCanonical(m.id));
      for (const scored of selectModels(query.requirements, pool).slice(0, query.take)) {
        const entry = entryOf(scored);
        const duplicate = seen.has(entry.id);
        trace.push({
          lane,
          query: query.name,
          entry,
          score: scored.score,
          effectivePrice: scored.effectivePrice,
          duplicate,
        });
        if (duplicate) continue;
        seen.add(entry.id);
        entries.push(entry);
      }
    }
    for (const entry of spec.declared ?? []) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      entries.push(entry);
    }
    roster[lane] = entries;
  }
  return { roster, trace };
}

export interface RosterDelta {
  added: string[];
  dropped: string[];
}

/** What regeneration did to each lane, ids only — the line the script prints
 *  and the reason a roster refresh is reviewable rather than a mystery diff. */
export function rosterDelta(
  before: Record<string, RosterEntry[]>,
  after: Record<string, RosterEntry[]>,
): Record<string, RosterDelta> {
  const out: Record<string, RosterDelta> = {};
  for (const lane of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const was = new Set((before[lane] ?? []).map(e => e.id));
    const now = new Set((after[lane] ?? []).map(e => e.id));
    out[lane] = {
      added: [...now].filter(id => !was.has(id)),
      dropped: [...was].filter(id => !now.has(id)),
    };
  }
  return out;
}
