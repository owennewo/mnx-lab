// Topic grouping for the scenario rail.
//
// The spec has no taxonomy to inherit: `spectools.exampledocument` carries a
// name, slug and blurb and nothing else, and the spec's own index page is a
// flat alphabetical list of all 52 "example documents". Our side, meanwhile,
// had nine authoring categories of which seven held a single scenario — so the
// rail read as a pile of singletons next to an undifferentiated wall.
//
// So the grouping is OURS, and it is deliberately a display concern: it lives
// here, never in `scenarios/spec/` (which `sync:spec` owns byte-for-byte) and
// never in a scenario's meta.json. Regrouping is a UI decision, not a corpus
// migration.
//
// Matching is on the scenario **id**, not the title: slugs are stable, and
// upstream can reword a `name` whenever it likes. The payoff is that lab and
// spec scenarios interleave — our two dynamics scenarios sit beside the spec's
// three, our rest gallery beside seven spec rhythm examples — which is what
// makes both halves stop looking lopsided.
//
// FIRST MATCH WINS, so ORDER IS LOAD-BEARING: narrow rules must precede broad
// ones. `bar-duration-mismatch` matches both /edge-case/ and /duration/, and
// `labels-with-navigation` matches both /label/ and /navigation/ — put the
// broad rule first and a scenario silently lands in the wrong group while its
// own group quietly empties out. harness/conformance/groups.test.ts asserts
// that nothing is ungrouped AND that no group is empty; the second is the one
// that catches a rule whose members have all been stolen by a rule above it.

export interface ScenarioGroup {
  readonly name: string;
  readonly match: RegExp;
}

/** Where a scenario lands when no rule matches — should always be empty. */
export const FALLBACK_GROUP = 'Other';

export const SCENARIO_GROUPS: readonly ScenarioGroup[] = [
  { name: 'Getting started', match: /hello-world|c-major-scale|chord-and-half-rest|minimal-single-note|empty-tab-canvas/ },
  { name: 'Tab', match: /^lab\/tab-/ },
  { name: 'Edge cases & spec gaps', match: /edge-case|mismatch|spec-gap/ },
  { name: 'Pitch & accidentals', match: /accidental|key-signature|ottava/ },
  // Anchored: a bare /space/ would also claim a future "spacing-*".
  { name: 'Rhythm & rests', match: /time-signature|dotted-note|tuplet|rest|duration|(^|[/-])space([/-]|$)/ },
  { name: 'Beams', match: /beam/ },
  // Anchored: a bare /tie/ would also claim a future "properties" or "quantities".
  { name: 'Slurs & ties', match: /slur|(^|[/-])ties?([/-]|$)/ },
  { name: 'Grace notes & tremolos', match: /grace|tremolo|appoggiatura|acciaccatura/ },
  { name: 'Dynamics & articulation', match: /dynamic|articulation|accent/ },
  { name: 'Text & lyrics', match: /lyric|score-text|tempo|direction|rehearsal|section|label/ },
  { name: 'Repeats & navigation', match: /repeat|jump|navigation/ },
  { name: 'Percussion', match: /percussion/ },
  // Anchored for the same reason: a bare /part/ would claim "partial-*".
  { name: 'Layout & parts', match: /layout|(^|[/-])parts?([/-]|$)|staff|clef|voice/ }
];

/** The group a scenario id belongs to. First match wins. */
export function groupOf(id: string): string {
  for (const group of SCENARIO_GROUPS) {
    if (group.match.test(id)) return group.name;
  }
  return FALLBACK_GROUP;
}

/**
 * Buckets ids into groups, in SCENARIO_GROUPS order, dropping groups that
 * matched nothing. Input order is preserved within each group — the corpus
 * sorts lab before spec, so ours lead.
 */
export function groupScenarios<T>(items: readonly T[], idOf: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const group of SCENARIO_GROUPS) out.set(group.name, []);
  out.set(FALLBACK_GROUP, []);
  for (const item of items) out.get(groupOf(idOf(item)))!.push(item);
  for (const [name, members] of out) if (members.length === 0) out.delete(name);
  return out;
}
