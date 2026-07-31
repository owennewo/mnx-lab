// The corpus inverted: schema object → the scenarios that exercise it.
//
// `coversDefs` is the spec's OWN answer to "which $defs does this example
// exercise" — upstream builds it in accumulate_used_json_objects() by walking
// each example's JSON against the schema's object graph, and it is the same
// data driving the "examples using this object" list on every object's
// reference page. So the slugs here are the spec's object slugs, which is why
// each one can link straight back to its reference page.
//
// Two things this makes visible that a coverage fraction cannot:
//
//   - WHICH objects nobody has exercised. "77/124" is a scoreboard; the list
//     of the ~48 with zero examples is a work queue.
//   - Whether a covered object is covered by anything ANYONE HAS LOOKED AT.
//     An object with three examples, none verified, is exercised but not
//     evidenced — and for a test bench that is nearly the same as uncovered.
//     Hence verifiedCount sits beside count everywhere.
import mnxSchema from '../../spec/mnx-schema.json';
import { corpus, type ScenarioEntry } from './corpus.ts';
import { isPlumbingDef } from './plumbingDefs.ts';

/** Where the spec documents a schema object. */
export const OBJECT_URL_BASE = 'https://w3c-cg.github.io/mnx/docs/mnx-reference/objects/';

export interface DefEntry {
  def: string;
  scenarios: ScenarioEntry[];
  /** Of `scenarios`, how many a human has signed off. */
  verifiedCount: number;
  specUrl: string;
}

const featureDefs: string[] = Object.keys(
  (mnxSchema as { $defs?: Record<string, unknown> }).$defs ?? {}
)
  .filter(d => !isPlumbingDef(d))
  .sort();

function buildIndex(): Map<string, DefEntry> {
  const index = new Map<string, DefEntry>(
    featureDefs.map(def => [
      def,
      { def, scenarios: [], verifiedCount: 0, specUrl: `${OBJECT_URL_BASE}${def}/` }
    ])
  );
  for (const entry of corpus) {
    for (const def of entry.featureDefs) {
      const row = index.get(def);
      // A scenario can name a def the schema no longer has (a moved pin);
      // coverage counts the schema's defs, so ignore rather than invent a row.
      if (!row) continue;
      row.scenarios.push(entry);
      if (entry.meta.status === 'verified') row.verifiedCount++;
    }
  }
  return index;
}

export const defIndex: Map<string, DefEntry> = buildIndex();

/** Every feature def, most-exercised first, then alphabetical. */
export const defsByCoverage: DefEntry[] = [...defIndex.values()].sort(
  (a, b) => b.scenarios.length - a.scenarios.length || a.def.localeCompare(b.def)
);

export function defEntry(def: string): DefEntry | null {
  return defIndex.get(def) ?? null;
}

/**
 * Coverage tiers — the shape of the work, not just its size. `none` is the
 * backlog, `thin` (a single example) is where a renderer bug is most likely
 * to hide, and `unverified` is covered-but-unwitnessed.
 */
export interface DefTiers {
  none: DefEntry[];
  thin: DefEntry[];
  covered: DefEntry[];
}

export function defTiers(): DefTiers {
  const tiers: DefTiers = { none: [], thin: [], covered: [] };
  for (const entry of defsByCoverage) {
    if (entry.scenarios.length === 0) tiers.none.push(entry);
    else if (entry.scenarios.length === 1) tiers.thin.push(entry);
    else tiers.covered.push(entry);
  }
  tiers.none.sort((a, b) => a.def.localeCompare(b.def));
  tiers.thin.sort((a, b) => a.def.localeCompare(b.def));
  return tiers;
}
