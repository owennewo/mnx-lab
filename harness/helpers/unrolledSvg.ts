import { initSmufl, WIDTH_SP } from './corpusPrimitives.ts';
import { renderSystemSvg } from './corpusSvg.ts';
import { rounded } from '../../src/engine/headless.ts';
import { layoutNotation } from '../../src/engine/layout/notation.ts';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { engravingEntries } from '../../src/engine/layout/unrolled.ts';
import { wantsTabView, type MnxStructure } from '../../src/model/mnx.ts';
export function unrolledSvgs(doc: MnxStructure): Record<string, string> {
  initSmufl();
  const options = { mnx: doc, widthSp: WIDTH_SP, entries: engravingEntries(doc, true) };
  const out: Record<string, string> = {
    'expected.unrolled.svg': renderSystemSvg(rounded(layoutNotation(options))),
  };
  if (wantsTabView(doc))
    out['expected.unrolled.tab.svg'] = renderSystemSvg(rounded(layoutTab(options)));
  return out;
}
