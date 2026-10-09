/**
 * The synth engine flag (roadmap/inprogress/core-campaign-synth.md, Phases 5 and 8): which
 * synth a player plays the score with — 'host', the synth's instrument host, or 'native',
 * the old sink.
 *
 * Studio and the workbench make the host their default (`setDefaultSynthEngine` in their
 * entries): they are served beside `/synth/`, where the host loads from. Anything else — the
 * embed, the library build, on other people's pages — stays on the sink. `?synth=native` in
 * a page's address keeps this browser on the sink, `?synth=host` on the host; `?synth=default`
 * forgets the choice.
 */
export type SynthEngine = 'native' | 'host';
export const SYNTH_ENGINE_KEY = 'mnx-lab.synth-engine';
let fallback: SynthEngine = 'native';
/** A face served beside `/synth/` calls this before its first player is made. */
export function setDefaultSynthEngine(engine: SynthEngine) {
  fallback = engine;
}
export function readSynthEngine(search = typeof location === 'undefined' ? '' : location.search): SynthEngine {
  try {
    const asked = new URLSearchParams(search).get('synth');
    if (asked === 'host' || asked === 'native') localStorage.setItem(SYNTH_ENGINE_KEY, asked);
    else if (asked === 'default') localStorage.removeItem(SYNTH_ENGINE_KEY);
    const stored = localStorage.getItem(SYNTH_ENGINE_KEY);
    return stored === 'host' || stored === 'native' ? stored : fallback;
  } catch {
    return fallback;
  }
}
