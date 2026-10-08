/**
 * The synth engine flag (roadmap/inprogress/core-campaign-synth.md, Phase 5): which synth a
 * player plays the score with. `?synth=host` in a page's address turns the synth's
 * instrument host on for this browser, `?synth=native` turns it back off; it is off
 * by default until the host replaces the sink (Phase 8).
 */
export type SynthEngine = 'native' | 'host';
export const SYNTH_ENGINE_KEY = 'mnx-lab.synth-engine';
export function readSynthEngine(search = typeof location === 'undefined' ? '' : location.search): SynthEngine {
  try {
    const asked = new URLSearchParams(search).get('synth');
    if (asked === 'host') localStorage.setItem(SYNTH_ENGINE_KEY, 'host');
    else if (asked === 'native') localStorage.removeItem(SYNTH_ENGINE_KEY);
    return localStorage.getItem(SYNTH_ENGINE_KEY) === 'host' ? 'host' : 'native';
  } catch {
    return 'native';
  }
}
