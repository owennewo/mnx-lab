// Guards the scenario rail's topic grouping (src/corpus/groups.ts).
//
// The grouping is a table of regexes with FIRST MATCH WINS, so it has exactly
// two failure modes and both are silent in the UI:
//
//   1. a new scenario matches nothing and lands in the fallback;
//   2. a broad rule placed above a narrow one swallows the narrow rule's
//      members, so a group that should exist quietly renders as nothing.
//
// The second is the subtle one, and it happened while the table was being
// written: /duration/ sat above /edge-case/, so `bar-duration-mismatch` was
// filed under Rhythm and "Edge cases & spec gaps" vanished entirely. An empty
// group is the signature of a stolen rule, so assert on it directly.
//
// This lives in the harness rather than check-scenarios.mjs because it is not
// corpus-file policing: the grouping is UI-side, and check-scenarios is plain
// Node that cannot import the .ts module it would need to stay in sync with.
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';
import { SCENARIO_GROUPS, FALLBACK_GROUP, groupOf } from '../../src/corpus/groups.ts';

const ids: string[] = loadCorpus().map((s: { id: string }) => s.id);

describe('scenario rail grouping', () => {
  it('has scenarios to group', () => {
    expect(ids.length).toBeGreaterThan(0);
  });

  it('groups every scenario', () => {
    const ungrouped = ids.filter(id => groupOf(id) === FALLBACK_GROUP);
    expect(ungrouped, `add a rule in src/corpus/groups.ts for: ${ungrouped.join(', ')}`).toEqual(
      []
    );
  });

  it('leaves no group empty', () => {
    // An empty group means its rule never fires — almost always because a
    // broader rule above it now matches everything it was written for.
    const populated = new Set(ids.map(groupOf));
    const dead = SCENARIO_GROUPS.map(g => g.name).filter(name => !populated.has(name));
    expect(
      dead,
      `these rules match nothing — a rule above them is likely stealing their ` +
        `scenarios (order is load-bearing): ${dead.join(', ')}`
    ).toEqual([]);
  });

  it('assigns each scenario exactly one group', () => {
    for (const id of ids) {
      expect(typeof groupOf(id)).toBe('string');
    }
  });
});
