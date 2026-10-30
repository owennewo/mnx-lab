import { expect, it } from 'vitest';
import { misfitBars, parseBars, syncReach, syncRefusal, type SyncWrite } from '../../tools/recording-align/decisions.ts';

// What the recording-align tool will and will not write. Each refusal is something that went wrong once (RUNS.md run 9).
const good: SyncWrite = { misfits: [], verified: true, bars: 10, stored: null, scoreMoved: false, allow: {} };
const tuples = (bars: number) => JSON.stringify([...Array(bars + 1).keys()].map(i => [i, i * 2]));

it('writes a sync when nothing is against it', () => {
  expect(syncRefusal(good)).toBeNull();
});

it('refuses each thing, and lets its own flag — and only its own — through', () => {
  const cases: [Partial<SyncWrite>, keyof SyncWrite['allow'], RegExp][] = [
    [{ misfits: ['80', '81'] }, 'misfit', /bars 80 81 hold more or less/],
    [{ verified: false }, 'unverified', /would not play this sync/],
    [{ stored: tuples(10) }, 'replace', /already has a sync/],
  ];
  for (const [over, flag, says] of cases) {
    expect(syncRefusal({ ...good, ...over })).toMatch(says);
    expect(syncRefusal({ ...good, ...over, allow: { [flag]: true } })).toBeNull();
    for (const other of ['misfit', 'unverified', 'replace', 'shorter'] as const)
      if (other !== flag) expect(syncRefusal({ ...good, ...over, allow: { [other]: true } })).toMatch(says);
  }
});

it('holds a replacement to the bars the old sync reached, replacing or not', () => {
  const replacing = { ...good, stored: tuples(111), bars: 80, allow: { replace: true } };
  expect(syncRefusal(replacing)).toMatch(/end of performed bar 80, the one it would replace bar 111/);
  expect(syncRefusal({ ...replacing, allow: { replace: true, shorter: true } })).toBeNull();
  // `shorter` alone is not `replace`.
  expect(syncRefusal({ ...replacing, allow: { shorter: true } })).toMatch(/already has a sync/);
  expect(syncRefusal({ ...replacing, bars: 111 })).toBeNull();
});

it('lets nothing past a score saved since the fetch: everything was checked against other bars', () => {
  const allowed = { misfit: true, unverified: true, replace: true, shorter: true };
  expect(syncRefusal({ ...good, scoreMoved: true, allow: allowed })).toMatch(/saved since this run fetched it/);
});

it('names misfit bars by what they hold against their signature, ignoring bars with no signature', () => {
  expect(misfitBars({
    1: { duration: 1, signature: 1 }, 80: { duration: 2 / 3, signature: 1 }, 110: { duration: 1.25, signature: 1 }, 111: { duration: 0.5, signature: null },
    2: { duration: 1 / 3 + 1 / 3 + 1 / 3, signature: 1 },
  })).toEqual(['80', '110']);
});

it('reads how far a stored sync reaches', () => {
  expect(syncReach(null)).toBe(0);
  expect(syncReach('[]')).toBe(0);
  expect(syncReach(tuples(44))).toBe(44);
});

it('parses the bars an edit names', () => {
  expect(parseBars('1,5-8,3')).toEqual([1, 3, 5, 6, 7, 8]);
  expect(parseBars(' 2 , 2 ')).toEqual([2]);
  for (const bad of [undefined, '', 'x', '0', '8-5', '1,,2', '1-']) expect(parseBars(bad)).toBeNull();
});
